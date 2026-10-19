// The "what's happening" feed: a short, human-readable stream of notable events
// (proofs validated, new best attempt, connection changes…). Events are kept as
// structured data ({ kind, key, params }) and translated at render time, so
// switching language re-translates the whole history.
//
// Everything here is pure: `deriveEvents` compares two consecutive stats
// snapshots, and `pushEvent` folds an event into the feed.

export const FEED_LIMIT = 30;

// Records merge into the most recent entry when they arrive in quick succession,
// so a run of small improvements doesn't flood the feed.
const COALESCE_WINDOW_MS = { record: 10000 };

let nextId = 1;

// makeEvent builds a feed entry. `ts` is injectable for deterministic tests.
export function makeEvent(kind, key, params = {}, ts = Date.now()) {
    return { id: nextId++, kind, key, params, ts };
}

// pushEvent returns a new feed (newest first) with `event` added, merging into
// the head when it's the same coalescable kind within its window.
export function pushEvent(feed, event, limit = FEED_LIMIT) {
    const head = feed[0];
    const window = COALESCE_WINDOW_MS[event.kind];

    if (head && window && head.kind === event.kind && event.ts - head.ts <= window) {
        return [{ ...head, ts: event.ts, params: event.params }, ...feed.slice(1)];
    }
    return [event, ...feed].slice(0, limit);
}

// describeEvent renders an event as a sentence in the current language.
export function describeEvent(event, t) {
    const { key, params } = event;
    switch (key) {
        case 'feedShare':
            return params.worker ? t('feedShare', { worker: params.worker }) : t('feedShareAnon');
        case 'feedRecord':
            return t('feedRecord', { value: params.value.toFixed(4) });
        default:
            return t(key, params);
    }
}

// deriveEvents turns the change between two stats snapshots into feed events,
// oldest first. `context.pool` names the pool in connection messages.
export function deriveEvents(prev, next, context = {}, ts = Date.now()) {
    if (!prev || !next) return [];
    const events = [];

    if (!prev.connected && next.connected) {
        events.push(makeEvent('info', 'feedConnected', { pool: context.pool || '' }, ts));
    }
    if (next.block_height > 0 && next.block_height !== prev.block_height) {
        events.push(makeEvent('info', 'feedBlockLoaded', { height: next.block_height }, ts));
    }
    // One line per proof of work, naming the worker that found it. When several
    // arrive within the same update, the line is for the latest one.
    if ((next.accepted_shares || 0) > (prev.accepted_shares || 0)) {
        events.push(makeEvent('share', 'feedShare', { worker: next.last_share_worker || '' }, ts));
    }
    if (next.best_difficulty > 0 && next.best_difficulty > (prev.best_difficulty || 0)) {
        events.push(makeEvent('record', 'feedRecord', { value: next.best_difficulty }, ts));
    }
    if (prev.connected && !next.connected) {
        events.push(makeEvent('warning', 'feedDisconnected', {}, ts));
    }
    return events;
}
