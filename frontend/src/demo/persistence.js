// Durable stats for the in-browser demo. The real backend persists stats to
// disk (backend/internal/stats/collector.go) so a restart never wipes history;
// the demo had no equivalent, so a simple page refresh threw away every share,
// session and best-difficulty record. This module mirrors that durability using
// localStorage.
//
// The serialize/deserialize functions are pure and the storage accessors take an
// injectable store, so the whole module is testable in a plain Node environment
// without a DOM.

export const STORAGE_KEY = 'soloforge-demo-stats';
export const SCHEMA_VERSION = 1;

// Caps mirroring the engine so a long-running demo can't grow storage unbounded.
const MAX_HISTORY = 1000;
const MAX_SESSIONS = 50;

function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
}

function arr(v) {
    return Array.isArray(v) ? v : [];
}

// serializeSnapshot reduces engine state to the plain, capped object we persist.
export function serializeSnapshot(snapshot = {}) {
    const tail = (a, n) => arr(a).slice(-n);
    return {
        v: SCHEMA_VERSION,
        totalShares: num(snapshot.totalShares),
        acceptedShares: num(snapshot.acceptedShares),
        bestDifficulty: num(snapshot.bestDifficulty),
        previousSeconds: num(snapshot.previousSeconds),
        shareHistory: tail(snapshot.shareHistory, MAX_HISTORY),
        blockHistory: tail(snapshot.blockHistory, MAX_HISTORY),
        sessionHistory: tail(snapshot.sessionHistory, MAX_SESSIONS),
    };
}

// deserializeSnapshot validates persisted data and normalises it back into the
// engine's field shape. Returns null for anything missing, malformed, or written
// by an incompatible schema version, so the engine simply starts fresh.
export function deserializeSnapshot(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== SCHEMA_VERSION) return null;
    return {
        totalShares: num(raw.totalShares),
        acceptedShares: num(raw.acceptedShares),
        bestDifficulty: num(raw.bestDifficulty),
        previousSeconds: num(raw.previousSeconds),
        shareHistory: arr(raw.shareHistory),
        blockHistory: arr(raw.blockHistory),
        sessionHistory: arr(raw.sessionHistory),
    };
}

// resolveStore returns a usable Storage-like object, or null when none exists
// (SSR, Node tests, or a browser with storage disabled / blocked).
function resolveStore(store) {
    if (store) return store;
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        // Accessing localStorage can throw in sandboxed iframes / privacy modes.
        return null;
    }
}

// loadSnapshot reads and validates the persisted snapshot. Any error (no store,
// missing key, corrupt JSON, bad schema) yields null — the demo then starts clean
// rather than crashing.
export function loadSnapshot(store) {
    const s = resolveStore(store);
    if (!s) return null;
    try {
        const txt = s.getItem(STORAGE_KEY);
        if (!txt) return null;
        return deserializeSnapshot(JSON.parse(txt));
    } catch {
        return null;
    }
}

// saveSnapshot persists a snapshot. Returns true on success, false if there is no
// store or the write failed (e.g. quota exceeded) — callers ignore the result.
export function saveSnapshot(snapshot, store) {
    const s = resolveStore(store);
    if (!s) return false;
    try {
        s.setItem(STORAGE_KEY, JSON.stringify(serializeSnapshot(snapshot)));
        return true;
    } catch {
        return false;
    }
}

// clearSnapshot removes the persisted snapshot (used by the Reset action).
export function clearSnapshot(store) {
    const s = resolveStore(store);
    if (!s) return;
    try {
        s.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
