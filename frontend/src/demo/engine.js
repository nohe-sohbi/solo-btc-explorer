// Client-side mining engine for the demo. Singleton that orchestrates the mining
// WebWorkers and exposes a surface mirroring the Go backend's REST + WebSocket API
// (backend/internal/api/server.go), so the React hooks can talk to it transparently.

import { buildBlockHeader, fetchLatestBlock, FALLBACK_BLOCK } from './header.js';

const DEFAULT_CONFIG = {
    pool_url: 'solo.ckpool.org',
    pool_port: 3333,
    wallet_address: '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9',
    max_cpu_percent: 80,
    num_workers: 4,
};

const SHARE_DIFFICULTY = 0.00002; // share target (a real pool sets one far below the network)
const MAX_HISTORY = 1000;

class DemoEngine {
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
        this.blockPromise = null;

        this.subscribers = new Set();
        this.statsTimer = null;
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

    _log(message, color) {
        this._emit('log', { message, color });
    }

    _startStatsLoop() {
        if (this.statsTimer) return;
        this.statsTimer = setInterval(() => {
            this._emit('stats', this.buildStatsPayload());
        }, 1000);
    }

    // ---------- block source (real data, no backend) ----------
    async ensureBlock() {
        if (this.block) return this.block;
        if (!this.blockPromise) {
            this.blockPromise = (async () => {
                let raw, live;
                try {
                    raw = await fetchLatestBlock();
                    live = true;
                } catch (err) {
                    raw = FALLBACK_BLOCK;
                    live = false;
                }
                this.block = {
                    header: buildBlockHeader(raw),
                    height: raw.height,
                    networkDifficulty: raw.difficulty,
                    id: raw.id,
                };
                // Deferred so this log lands in its own tick and isn't batched away by
                // the stats event emitted right after mining starts.
                setTimeout(() => {
                    if (live) this._log(`📡 Bloc réseau #${raw.height} chargé (mempool.space)`, 'var(--info)');
                    else this._log(`⚠️ API hors ligne — bloc de secours #${raw.height}`, 'var(--warning)');
                }, 0);
                return this.block;
            })();
        }
        return this.blockPromise;
    }

    // ---------- worker plumbing ----------
    _spawn(name) {
        const id = this.nextWorkerId++;
        const worker = new Worker(new URL('./miner.worker.js', import.meta.url), { type: 'module' });
        const rec = { id, name: name || `cpu-worker-${id}`, worker, hashCount: 0, startTime: 0, running: false };
        worker.onmessage = (e) => this._onWorkerMessage(rec, e.data);
        this.workers.set(id, rec);
        return rec;
    }

    _startWorker(rec) {
        rec.startTime = Date.now();
        rec.hashCount = 0;
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
                rec.hashCount = msg.hashCount;
                if (msg.bestDifficulty > this.bestDifficulty) this.bestDifficulty = msg.bestDifficulty;
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
                break;
            case 'block':
                this.blockHistory.push({
                    timestamp: Date.now(),
                    height: this.block ? this.block.height : 0,
                    prev_hash: this.block ? this.block.id : '',
                });
                if (this.blockHistory.length > MAX_HISTORY) this.blockHistory.shift();
                this._emit('block', { difficulty: msg.difficulty });
                this._log('🆕 Bloc candidat trouvé (démo) !', 'var(--gold)');
                break;
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
            best_difficulty: this.bestDifficulty,
            uptime_seconds: uptime,
            workers,
            connected: this.running,
            authorized: this.running,
        };
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
