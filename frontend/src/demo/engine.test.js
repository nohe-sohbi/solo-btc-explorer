import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./header.js', () => ({
    buildBlockHeader: () => ({ buffer: new ArrayBuffer(80) }),
    candidateHashHex: (header, nonce) => `hash-of-${nonce}`,
    fetchLatestBlock: vi.fn(),
    fetchBtcPrice: vi.fn().mockResolvedValue(0),
}));

const { fetchLatestBlock } = await import('./header.js');
const { DemoEngine } = await import('./engine.js');

const LIVE_BLOCK = { id: 'live-id', height: 952143, difficulty: 1.21e14 };

describe('DemoEngine block source', () => {
    let engine;

    beforeEach(() => {
        fetchLatestBlock.mockReset();
        engine = new DemoEngine();
    });

    it('uses the live block when the API answers', async () => {
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        await engine.ensureBlock();
        expect(engine.blockSource).toBe('live');
        expect(engine.buildStatsPayload()).toMatchObject({ block_source: 'live', block_height: 952143 });
    });

    it('reports the block as unavailable when the API is unreachable', async () => {
        fetchLatestBlock.mockRejectedValue(new Error('offline'));
        expect(await engine.ensureBlock()).toBeNull();
        expect(engine.buildStatsPayload()).toMatchObject({ block_source: 'unavailable', block_height: 0 });
    });

    it('asks the API again on the next call after a failure', async () => {
        fetchLatestBlock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(LIVE_BLOCK);
        await engine.ensureBlock();
        const block = await engine.ensureBlock();
        expect(block.height).toBe(952143);
    });

    it('reports no source before any block was requested', () => {
        expect(engine.buildStatsPayload().block_source).toBe('none');
    });

    it('recovers on refresh after a failed first attempt', async () => {
        fetchLatestBlock.mockRejectedValue(new Error('offline'));
        await engine.ensureBlock();

        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        const result = await engine.refreshBlock();
        expect(result).toEqual({ block_source: 'live' });
        expect(engine.block.height).toBe(952143);
    });

    it('keeps the block it has when a refresh fails', async () => {
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        await engine.ensureBlock();

        fetchLatestBlock.mockRejectedValue(new Error('offline'));
        const result = await engine.refreshBlock();
        expect(result).toEqual({ block_source: 'live' });
        expect(engine.block.height).toBe(952143);
    });

    it('announces a refreshed block to subscribers', async () => {
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        const seen = [];
        const unsubscribe = engine.subscribe((event) => seen.push(event));
        await engine.refreshBlock();
        unsubscribe();
        clearInterval(engine.statsTimer);
        expect(seen.some((e) => e.type === 'stats' && e.data.block_source === 'live')).toBe(true);
    });
});

describe('DemoEngine prefetch', () => {
    it('fetches the block as soon as someone listens, and announces it', async () => {
        fetchLatestBlock.mockReset();
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        const engine = new DemoEngine();
        const seen = [];
        const unsubscribe = engine.subscribe((event) => seen.push(event));
        await vi.waitFor(() => expect(seen.some((e) => e.data.block_height === 952143)).toBe(true));
        unsubscribe();
        clearInterval(engine.statsTimer);
    });

    it('fetches only once, however many listeners come', async () => {
        fetchLatestBlock.mockReset();
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        const engine = new DemoEngine();
        engine.subscribe(() => {});
        engine.subscribe(() => {});
        await engine.ensureBlock();
        expect(fetchLatestBlock).toHaveBeenCalledTimes(1);
        clearInterval(engine.statsTimer);
    });
});

describe('DemoEngine waiting for a block', () => {
    let engine;

    beforeEach(() => {
        vi.useFakeTimers();
        fetchLatestBlock.mockReset();
        engine = new DemoEngine();
        engine._spawn = vi.fn((name) => {
            const rec = { id: engine.nextWorkerId++, name: name || 'w', worker: { postMessage: vi.fn() }, hashCount: 0, hashBase: 0, startTime: 0, running: false };
            engine.workers.set(rec.id, rec);
            return rec;
        });
    });

    afterEach(() => {
        engine.stopMining();
        vi.useRealTimers();
    });

    it('starts computing as soon as the block is there', async () => {
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        expect(await engine.startMining()).toEqual({ status: 'started' });
        expect(engine.workers.size).toBeGreaterThan(0);
        expect([...engine.workers.values()].every((rec) => rec.running)).toBe(true);
    });

    it('counts as running but computes nothing while the block is missing', async () => {
        fetchLatestBlock.mockRejectedValue(new Error('offline'));
        expect(await engine.startMining()).toEqual({ status: 'waiting' });
        expect(engine.running).toBe(true);
        expect(engine.workers.size).toBe(0);
        expect(engine.buildStatsPayload()).toMatchObject({ block_source: 'unavailable', block_retry_in_seconds: 15 });
    });

    it('retries every 15 seconds and starts once the block arrives', async () => {
        fetchLatestBlock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(LIVE_BLOCK);
        await engine.startMining();

        await vi.advanceTimersByTimeAsync(15000);
        expect(engine.block.height).toBe(952143);
        expect(engine.workers.size).toBeGreaterThan(0);
        expect(engine.buildStatsPayload()).not.toHaveProperty('block_retry_in_seconds');
    });

    it('keeps waiting and keeps retrying while the API stays down', async () => {
        fetchLatestBlock.mockRejectedValue(new Error('offline'));
        await engine.startMining();
        await vi.advanceTimersByTimeAsync(15000);
        expect(engine.workers.size).toBe(0);
        expect(engine.buildStatsPayload().block_retry_in_seconds).toBe(15);
    });

    it('starts right away when the user retries by hand', async () => {
        fetchLatestBlock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(LIVE_BLOCK);
        await engine.startMining();
        await engine.refreshBlock();
        expect(engine.workers.size).toBeGreaterThan(0);
    });

    it('stops retrying once mining is stopped', async () => {
        fetchLatestBlock.mockRejectedValue(new Error('offline'));
        await engine.startMining();
        engine.stopMining();
        fetchLatestBlock.mockClear();
        await vi.advanceTimersByTimeAsync(60000);
        expect(fetchLatestBlock).not.toHaveBeenCalled();
    });
});

describe('DemoEngine block candidates', () => {
    it('records who found the block and emits the full entry', async () => {
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        const engine = new DemoEngine();
        await engine.ensureBlock();

        const rec = { id: 2, name: 'cpu-worker-2' };
        engine.workers.set(rec.id, rec);
        const events = [];
        engine.subscribe((e) => e.type === 'block' && events.push(e));

        engine._onWorkerMessage(rec, { type: 'block', difficulty: 1.214e14, nonce: '3fa91c07' });
        clearInterval(engine.statsTimer);

        const { blocks } = engine.getHistory(10);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatchObject({
            height: 952143,
            prev_hash: 'live-id',
            worker_name: 'cpu-worker-2',
            nonce: '3fa91c07',
            hash: 'hash-of-3fa91c07',
            difficulty: 1.214e14,
        });
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual(blocks[0]);
    });
});

describe('DemoEngine reset and undo', () => {
    const makeEngine = () => {
        const engine = new DemoEngine();
        const rec = { id: 1, name: 'cpu-worker-1', hashCount: 0, hashBase: 0, startTime: 0, running: true };
        engine.workers.set(1, rec);
        engine.running = true;
        engine.startTime = Date.now();
        engine.totalShares = 10;
        engine.acceptedShares = 10;
        engine.bestDifficulty = 0.04;
        engine.shareHistory = [{ nonce: 'a' }];
        engine._onWorkerMessage(rec, { type: 'progress', hashCount: 1000, bestDifficulty: 0.04 });
        return { engine, rec };
    };

    it('keeps the hash counter at zero when the running workers report again', () => {
        const { engine, rec } = makeEngine();
        engine.resetStats();
        engine._onWorkerMessage(rec, { type: 'progress', hashCount: 1500, bestDifficulty: 0 });
        // Only the 500 hashes computed since the reset count.
        expect(rec.hashCount).toBe(500);
    });

    it('restores everything the reset erased, plus what was computed meanwhile', () => {
        const { engine, rec } = makeEngine();
        engine.resetStats();
        engine._onWorkerMessage(rec, { type: 'progress', hashCount: 1500, bestDifficulty: 0 });
        expect(engine.undoReset()).toEqual({ status: 'restored' });

        engine._onWorkerMessage(rec, { type: 'progress', hashCount: 2000, bestDifficulty: 0 });
        expect(rec.hashCount).toBe(2000);
        expect(engine.totalShares).toBe(10);
        expect(engine.bestDifficulty).toBe(0.04);
        expect(engine.shareHistory).toEqual([{ nonce: 'a' }]);
    });

    it('can only undo once, and only right after a reset', () => {
        const { engine } = makeEngine();
        expect(() => engine.undoReset()).toThrow('Nothing to restore');
        engine.resetStats();
        engine.undoReset();
        expect(() => engine.undoReset()).toThrow('Nothing to restore');
    });

    it('refuses to undo a reset that is too old', () => {
        const { engine } = makeEngine();
        engine.resetStats();
        engine.undoSnapshot.takenAt -= 31000;
        expect(() => engine.undoReset()).toThrow('Nothing to restore');
    });
});

describe('DemoEngine stats payload', () => {
    it('reports the current block as the last job the "pool" sent', async () => {
        fetchLatestBlock.mockResolvedValue(LIVE_BLOCK);
        const engine = new DemoEngine();
        await engine.ensureBlock();
        const payload = engine.buildStatsPayload();
        expect(payload).toMatchObject({ pool_reconnects: 0, pool_last_job_id: 'ive-id' });
        expect(payload.pool_last_job_age_seconds).toBeGreaterThanOrEqual(0);
    });

    it('has no last job before a block was received', () => {
        const payload = new DemoEngine().buildStatsPayload();
        expect(payload).not.toHaveProperty('pool_last_job_age_seconds');
    });

    it('derives rejected shares from the counters', () => {
        const engine = new DemoEngine();
        engine.totalShares = 10;
        engine.acceptedShares = 7;
        expect(engine.buildStatsPayload()).toMatchObject({ accepted_shares: 7, rejected_shares: 3 });
    });
});
