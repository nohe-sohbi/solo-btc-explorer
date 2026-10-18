// Client-side mining engine for the demo. Singleton that orchestrates the mining
// WebWorkers and exposes a surface mirroring the Go backend's REST + WebSocket API
// (backend/internal/api/server.go), so the React hooks can talk to it transparently.

import { buildBlockHeader, candidateHashHex, fetchLatestBlock, fetchBtcPrice, FALLBACK_BLOCK } from './header.js';
import { blockSubsidy } from '../lib/odds.js';
import { loadSnapshot, saveSnapshot, clearSnapshot } from './persistence.js';
import { EXAMPLE_WALLET_ADDRESS } from '../config/runtime.js';

const DEFAULT_CONFIG = {
    pool_url: 'solo.ckpool.org',
    pool_port: 3333,
    wallet_address: EXAMPLE_WALLET_ADDRESS,
    max_cpu_percent: 80,
    num_workers: 4,
};

const SHARE_DIFFICULTY = 0.00002; // share target (a real pool sets one far below the network)
const MAX_HISTORY = 1000;
const UNDO_WINDOW_MS = 30000; // how long a reset can still be undone (the backend allows the same)
const PERSIST_THROTTLE_MS = 5000; // shares fire ~20/s; coalesce writes to localStorage

export class DemoEngine {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.running = false;
        this.startTime = 0;
        this.previousSeconds = 0;

        this.workers = new Map(); // id -> { id, name, worker, hashCount, startTime, running }
        this.nextWorkerId = 1;

        this.totalShares = 0;
        this.acceptedShares = 0;
        this.bestDifficulty = 0;

        this.shareHistory = [];
        this.blockHistory = [];
        this.sessionHistory = [];

        this.block = null;          // { header, height, networkDifficulty, id }
        this.blockSource = 'none';  // 'live' (mempool.space) | 'fallback' (bundled block) | 'none'
        this.undoSnapshot = null;   // what the last reset cleared
        this.blockFetchedAt = 0;    // when the current block was received (the demo's "last job")
        this.blockPromise = null;
        this.priceUSD = 0;          // best-effort BTC/USD, for the odds panel's expected value

        this.subscribers = new Set();
        this.statsTimer = null;
        this.persistTimer = null;

        // Restore any previously persisted history/counters so a page refresh no
        // longer wipes the demo's progress (mirrors the backend's durable stats).
        this._restore();
    }

    // ---------- persistence (mirrors the backend's durable stats) ----------
    _restore() {
        const snap = loadSnapshot();
        if (!snap) return;
        this.totalShares = snap.totalShares;
        this.acceptedShares = snap.acceptedShares;
        this.bestDifficulty = snap.bestDifficulty;
        this.previousSeconds = snap.previousSeconds;
        this.shareHistory = snap.shareHistory;
        this.blockHistory = snap.blockHistory;
        this.sessionHistory = snap.sessionHistory;
    }

    _snapshot() {
        return {
            totalShares: this.totalShares,
            acceptedShares: this.acceptedShares,
            bestDifficulty: this.bestDifficulty,
            previousSeconds: this.previousSeconds,
            shareHistory: this.shareHistory,
            blockHistory: this.blockHistory,
            sessionHistory: this.sessionHistory,
        };
    }

    // Coalesced save: high-frequency events (shares) schedule a single write.
    _persist() {
        if (this.persistTimer) return;
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            saveSnapshot(this._snapshot());
        }, PERSIST_THROTTLE_MS);
    }

    // Immediate save for low-frequency, high-value moments (session end, block).
    _persistNow() {
        if (this.persistTimer) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }
        saveSnapshot(this._snapshot());
    }

    // ---------- pub/sub (WebSocket-like) ----------
    subscribe(cb) {
        this.subscribers.add(cb);
        this._startStatsLoop();
        return () => this.subscribers.delete(cb);
    }

    _emit(type, data) {
        const evt = { type, data, timestamp: Date.now() };
        for (const cb of this.subscribers) cb(evt);
    }

    _startStatsLoop() {
        if (this.statsTimer) return;
        this.statsTimer = setInterval(() => {
            this._emit('stats', this.buildStatsPayload());
        }, 1000);
    }

    // ---------- block source (real data, no backend) ----------
    // Fetches the current chain tip from mempool.space. When the API is unreachable
    // it falls back to a bundled recent block so the demo works even offline; a
    // block we already hold is never replaced by the fallback.
    async _fetchBlock() {
        let raw;
        let live;
        try {
            raw = await fetchLatestBlock();
            live = true;
        } catch {
            if (this.block) return this.block;
            raw = FALLBACK_BLOCK;
            live = false;
        }
        this.block = {
            header: buildBlockHeader(raw),
            height: raw.height,
            networkDifficulty: raw.difficulty,
            id: raw.id,
        };
        this.blockSource = live ? 'live' : 'fallback';
        this.blockFetchedAt = Date.now();
        // Best-effort price so the odds can show expected value; a failure just
        // leaves it at 0 and the USD figures stay hidden.
        if (live) {
            fetchBtcPrice().then((p) => { this.priceUSD = p; }).catch(() => {});
        }
        return this.block;
    }

    async ensureBlock() {
        if (this.block) return this.block;
        if (!this.blockPromise) this.blockPromise = this._fetchBlock();
        return this.blockPromise;
    }

    // Retries the network fetch after a fallback. Workers that are already running
    // keep hashing their current header (restarting them would zero their
    // counters); the fresh block is used from the next start.
    async refreshBlock() {
        await this._fetchBlock();
        this._emit('stats', this.buildStatsPayload());
        return { block_source: this.blockSource };
    }

    // ---------- worker plumbing ----------
    _spawn(name) {
        const id = this.nextWorkerId++;
        const worker = new Worker(new URL('./miner.worker.js', import.meta.url), { type: 'module' });
        const rec = { id, name: name || `cpu-worker-${id}`, worker, hashCount: 0, hashBase: 0, startTime: 0, running: false };
        worker.onmessage = (e) => this._onWorkerMessage(rec, e.data);
        this.workers.set(id, rec);
        return rec;
    }

    _startWorker(rec) {
        rec.startTime = Date.now();
        rec.hashCount = 0;
        rec.hashBase = 0;
        rec.running = true;
        rec.worker.postMessage({
            cmd: 'start',
            workerId: rec.id,
            header: this.block.header.buffer.slice(0),
            cpuPercent: this.config.max_cpu_percent,
            shareDifficulty: SHARE_DIFFICULTY,
            networkDifficulty: this.block.networkDifficulty,
        });
    }

    _onWorkerMessage(rec, msg) {
        if (!this.workers.has(rec.id)) return;
        switch (msg.type) {
            case 'progress':
                // The worker counts since it started; a reset moves the baseline instead.
                rec.hashCount = msg.hashCount - rec.hashBase;
                if (msg.bestDifficulty > this.bestDifficulty) {
                    this.bestDifficulty = msg.bestDifficulty;
                    this._persist(); // capture new best-difficulty records
                }
                break;
            case 'share':
                this.totalShares++;
                this.acceptedShares++;
                if (msg.difficulty > this.bestDifficulty) this.bestDifficulty = msg.difficulty;
                this._pushShare({
                    timestamp: Date.now(),
                    worker_id: rec.id,
                    worker_name: rec.name,
                    job_id: this.block ? this.block.id : '',
                    nonce: msg.nonce,
                    difficulty: msg.difficulty,
                    accepted: true,
                });
                // Shares surface via history polling + counters; no per-share event
                // emission (they fire ~20/s and would needlessly churn the UI).
                this._persist();
                break;
            case 'block': {
                const entry = {
                    timestamp: Date.now(),
                    height: this.block ? this.block.height : 0,
                    prev_hash: this.block ? this.block.id : '',
                    worker_name: rec.name,
                    nonce: msg.nonce,
                    hash: this.block ? candidateHashHex(this.block.header, msg.nonce) : '',
                    difficulty: msg.difficulty,
                };
                this.blockHistory.push(entry);
                if (this.blockHistory.length > MAX_HISTORY) this.blockHistory.shift();
                this._persistNow(); // a candidate block is the rarest, most precious event
                this._emit('block', entry);
                break;
            }
            default:
                break;
        }
    }

    _pushShare(entry) {
        this.shareHistory.push(entry);
        if (this.shareHistory.length > MAX_HISTORY) this.shareHistory.shift();
    }

    // ---------- API surface (mirrors server.go) ----------
    getConfig() {
        return { ...this.config };
    }

    putConfig(updates) {
        this.config = { ...this.config, ...updates };
        if (updates.max_cpu_percent !== undefined && this.running) {
            for (const rec of this.workers.values()) {
                rec.worker.postMessage({ cmd: 'setCpu', cpuPercent: this.config.max_cpu_percent });
            }
        }
        return { status: 'updated' };
    }

    getStatus() {
        return {
            running: this.running,
            connected: this.running,
            authorized: this.running,
            worker_count: this.workers.size,
            pool_url: this.config.pool_url,
            pool_port: this.config.pool_port,
        };
    }

    buildStatsPayload() {
        const now = Date.now();
        let totalHashrate = 0;
        let totalHashes = 0;
        const workers = [];
        for (const rec of this.workers.values()) {
            const elapsed = rec.startTime ? (now - rec.startTime) / 1000 : 0;
            const hashrate = rec.running && elapsed > 0 ? rec.hashCount / elapsed : 0;
            totalHashrate += hashrate;
            totalHashes += rec.hashCount;
            workers.push({
                id: rec.id,
                name: rec.name,
                running: rec.running,
                hashrate,
                hashCount: rec.hashCount,
            });
        }
        const uptime = this.previousSeconds + (this.running && this.startTime ? (now - this.startTime) / 1000 : 0);
        return {
            hashrate: totalHashrate,
            total_hashes: totalHashes,
            total_shares: this.totalShares,
            accepted_shares: this.acceptedShares,
            rejected_shares: this.totalShares - this.acceptedShares,
            best_difficulty: this.bestDifficulty,
            uptime_seconds: uptime,
            // Surfaced so the odds estimator can use the live network difficulty,
            // the height-derived block reward and (best-effort) the BTC price.
            network_difficulty: this.block ? this.block.networkDifficulty : 0,
            block_height: this.block ? this.block.height : 0,
            block_reward_btc: this.block ? blockSubsidy(this.block.height) : 0,
            btc_price_usd: this.priceUSD,
            block_source: this.blockSource,
            pool_reconnects: 0,
            ...(this.block && {
                pool_last_job_age_seconds: Math.floor((now - this.blockFetchedAt) / 1000),
                pool_last_job_id: String(this.block.id || '').slice(-6),
            }),
            workers,
            connected: this.running,
            authorized: this.running,
        };
    }

    // Clear all accumulated counters and history (mirrors POST /api/stats/reset).
    // What was cleared is kept for UNDO_WINDOW_MS so the reset can be undone.
    resetStats() {
        this.undoSnapshot = {
            takenAt: Date.now(),
            startTime: this.startTime,
            state: this._snapshot(),
            workers: [...this.workers.values()].map((rec) => ({
                rec,
                hashBase: rec.hashBase,
                hashCount: rec.hashCount,
                startTime: rec.startTime,
            })),
        };
        this.totalShares = 0;
        this.acceptedShares = 0;
        this.bestDifficulty = 0;
        this.shareHistory = [];
        this.blockHistory = [];
        this.sessionHistory = [];
        this.previousSeconds = 0;
        for (const rec of this.workers.values()) {
            rec.hashBase += rec.hashCount;
            rec.hashCount = 0;
            rec.startTime = rec.running ? Date.now() : 0;
        }
        if (this.running) this.startTime = Date.now();
        clearSnapshot(); // drop persisted history so the reset survives a refresh
        this._emit('stats', this.buildStatsPayload());
        return { status: 'reset' };
    }

    // Bring back what the last reset cleared (mirrors POST /api/stats/restore).
    undoReset() {
        const undo = this.undoSnapshot;
        this.undoSnapshot = null;
        if (!undo || Date.now() - undo.takenAt > UNDO_WINDOW_MS) {
            throw new Error('Nothing to restore');
        }
        const { state } = undo;
        this.totalShares = state.totalShares;
        this.acceptedShares = state.acceptedShares;
        this.bestDifficulty = state.bestDifficulty;
        this.previousSeconds = state.previousSeconds;
        this.shareHistory = state.shareHistory;
        this.blockHistory = state.blockHistory;
        this.sessionHistory = state.sessionHistory;
        for (const { rec, hashBase, hashCount, startTime } of undo.workers) {
            // The worker kept counting: with the old baseline its count includes
            // everything, before and after the reset.
            rec.hashBase = hashBase;
            rec.hashCount = hashCount;
            rec.startTime = rec.running ? startTime : 0;
        }
        if (this.running) this.startTime = undo.startTime;
        this._persistNow();
        this._emit('stats', this.buildStatsPayload());
        return { status: 'restored' };
    }

    getHistory(limit) {
        const slice = (arr) => {
            const rev = arr.slice().reverse(); // newest first
            return limit > 0 ? rev.slice(0, limit) : rev;
        };
        return { shares: slice(this.shareHistory), blocks: slice(this.blockHistory) };
    }

    getSessions(limit) {
        const rev = this.sessionHistory.slice().reverse();
        return limit > 0 ? rev.slice(0, limit) : rev;
    }

    async startMining() {
        await this.ensureBlock();

        if (this.workers.size === 0) {
            const n = this.config.num_workers > 0 ? this.config.num_workers : 1;
            for (let i = 0; i < n; i++) this._spawn('');
        }

        this.running = true;
        this.startTime = Date.now();
        for (const rec of this.workers.values()) this._startWorker(rec);

        this._emit('stats', this.buildStatsPayload());
        return { status: 'started' };
    }

    stopMining() {
        if (this.running && this.startTime) {
            const durationSec = (Date.now() - this.startTime) / 1000;
            this.previousSeconds += durationSec;
            let sessionHashes = 0;
            for (const rec of this.workers.values()) sessionHashes += rec.hashCount;
            this.sessionHistory.push({
                id: new Date().toISOString(),
                start_time: this.startTime,
                end_time: Date.now(),
                duration: formatDuration(durationSec),
                total_hashes: sessionHashes,
                best_difficulty: this.bestDifficulty,
            });
            if (this.sessionHistory.length > 50) this.sessionHistory.shift();
        }
        this.running = false;
        for (const rec of this.workers.values()) {
            rec.running = false;
            rec.worker.postMessage({ cmd: 'stop' });
        }
        this._persistNow(); // flush the just-recorded session before going idle
        this._emit('stats', this.buildStatsPayload());
        return { status: 'stopped' };
    }

    addWorker(name) {
        const rec = this._spawn(name);
        if (this.running && this.block) this._startWorker(rec);
        return { id: rec.id, name: rec.name };
    }

    removeWorker(id) {
        const rec = this.workers.get(id);
        if (!rec) return false;
        rec.worker.postMessage({ cmd: 'stop' });
        rec.worker.terminate();
        this.workers.delete(id);
        return true;
    }
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h${m}m${s}s`;
    if (m > 0) return `${m}m${s}s`;
    return `${s}s`;
}

export const demoEngine = new DemoEngine();
