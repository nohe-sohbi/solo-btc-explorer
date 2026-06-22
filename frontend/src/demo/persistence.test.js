import { describe, it, expect } from 'vitest';
import {
    serializeSnapshot,
    deserializeSnapshot,
    loadSnapshot,
    saveSnapshot,
    clearSnapshot,
    STORAGE_KEY,
    SCHEMA_VERSION,
} from './persistence.js';

// A minimal Storage-like fake so these tests run in the default Node env (no DOM).
function fakeStore(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
        _map: map,
    };
}

const sampleSnapshot = () => ({
    totalShares: 12,
    acceptedShares: 12,
    bestDifficulty: 0.0042,
    previousSeconds: 99.5,
    shareHistory: [{ timestamp: 1, difficulty: 0.001, accepted: true }],
    blockHistory: [],
    sessionHistory: [{ id: 's1', total_hashes: 5000, best_difficulty: 0.0042 }],
});

describe('serializeSnapshot', () => {
    it('stamps the schema version and coerces missing fields', () => {
        const out = serializeSnapshot({});
        expect(out.v).toBe(SCHEMA_VERSION);
        expect(out.totalShares).toBe(0);
        expect(out.shareHistory).toEqual([]);
    });

    it('caps history arrays to their limits, keeping the newest entries', () => {
        const shareHistory = Array.from({ length: 1500 }, (_, i) => ({ i }));
        const sessionHistory = Array.from({ length: 80 }, (_, i) => ({ i }));
        const out = serializeSnapshot({ shareHistory, sessionHistory });
        expect(out.shareHistory).toHaveLength(1000);
        expect(out.shareHistory[0]).toEqual({ i: 500 }); // oldest 500 dropped
        expect(out.sessionHistory).toHaveLength(50);
        expect(out.sessionHistory[0]).toEqual({ i: 30 });
    });
});

describe('deserializeSnapshot', () => {
    it('round-trips a serialized snapshot', () => {
        const snap = sampleSnapshot();
        const restored = deserializeSnapshot(serializeSnapshot(snap));
        expect(restored).toMatchObject({
            totalShares: 12,
            acceptedShares: 12,
            bestDifficulty: 0.0042,
            previousSeconds: 99.5,
        });
        expect(restored.shareHistory).toHaveLength(1);
        expect(restored.sessionHistory).toHaveLength(1);
    });

    it('rejects malformed or version-mismatched data', () => {
        expect(deserializeSnapshot(null)).toBeNull();
        expect(deserializeSnapshot('nope')).toBeNull();
        expect(deserializeSnapshot({ v: 999, totalShares: 5 })).toBeNull();
    });
});

describe('storage round-trip', () => {
    it('saves and loads through an injected store', () => {
        const store = fakeStore();
        expect(saveSnapshot(sampleSnapshot(), store)).toBe(true);
        const loaded = loadSnapshot(store);
        expect(loaded.totalShares).toBe(12);
        expect(loaded.bestDifficulty).toBe(0.0042);
    });

    it('returns null when nothing is stored', () => {
        expect(loadSnapshot(fakeStore())).toBeNull();
    });

    it('returns null (not throw) on corrupt JSON', () => {
        const store = fakeStore({ [STORAGE_KEY]: '{not json' });
        expect(loadSnapshot(store)).toBeNull();
    });

    it('clears the persisted snapshot', () => {
        const store = fakeStore();
        saveSnapshot(sampleSnapshot(), store);
        clearSnapshot(store);
        expect(loadSnapshot(store)).toBeNull();
    });

    it('degrades gracefully when no store is available', () => {
        // Passing an explicit null-ish store and having no global localStorage in
        // the Node env exercises the "no store" path without throwing.
        expect(saveSnapshot(sampleSnapshot(), undefined)).toBe(false);
        expect(loadSnapshot(undefined)).toBeNull();
    });
});
