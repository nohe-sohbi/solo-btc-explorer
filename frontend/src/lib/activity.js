// The "what's happening" feed: a short, human-readable stream of notable events
// (proofs validated, new best attempt, connection changes…). Events are kept as
// structured data ({ kind, key, params }) and translated at render time, so
// switching language re-translates the whole history.
//
// Everything here is pure: `deriveEvents` compares two consecutive stats
// snapshots, and `pushEvent` folds an event into the feed.

import { formatInteger } from './bigNumbers.js';

export const FEED_LIMIT = 30;

// Events of these kinds merge into the most recent entry when they arrive in
// quick succession, so a demo producing ~20 shares/s doesn't flood the feed.
const COALESCE_WINDOW_MS = { shares: 30000, record: 10000 };

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
        const merged =
            event.kind === 'shares'
                ? { ...head, ts: event.ts, params: { count: head.params.count + event.params.count } }
                : { ...head, ts: event.ts, params: event.params };
        return [merged, ...feed.slice(1)];
    }
    return [event, ...feed].slice(0, limit);
}

// describeEvent renders an event as a sentence in the current language. Events of
// kind 'raw' carry text that was already written by the backend.
export function describeEvent(event, t, lang) {
    const { key, params } = event;
    switch (key) {
        case 'raw':
            return params.text;
        case 'feedShares':
            return params.count === 1
                ? t('feedSharesOne')
                : t('feedSharesMany', { count: formatInteger(params.count, lang) });
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
    const newShares = (next.accepted_shares || 0) - (prev.accepted_shares || 0);
    if (newShares > 0) {
        events.push(makeEvent('shares', 'feedShares', { count: newShares }, ts));
    }
    if (next.best_difficulty > 0 && next.best_difficulty > (prev.best_difficulty || 0)) {
        events.push(makeEvent('record', 'feedRecord', { value: next.best_difficulty }, ts));
    }
    if (prev.connected && !next.connected) {
        events.push(makeEvent('warning', 'feedDisconnected', {}, ts));
    }
    return events;
}
