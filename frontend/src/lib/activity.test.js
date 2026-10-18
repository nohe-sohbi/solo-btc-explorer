import { describe, it, expect } from 'vitest';
import { FEED_LIMIT, makeEvent, pushEvent, deriveEvents, describeEvent } from './activity.js';
import { createTranslator } from '../i18n/index.js';

const T0 = 1_700_000_000_000;

describe('pushEvent', () => {
    it('adds events newest first', () => {
        let feed = [];
        feed = pushEvent(feed, makeEvent('info', 'feedConnected', {}, T0));
        feed = pushEvent(feed, makeEvent('info', 'feedBlockLoaded', { height: 1 }, T0 + 1000));
        expect(feed.map((e) => e.key)).toEqual(['feedBlockLoaded', 'feedConnected']);
    });

    it('keeps every proof of work as its own line', () => {
        let feed = pushEvent([], makeEvent('share', 'feedShare', { worker: 'cpu-worker-1' }, T0));
        feed = pushEvent(feed, makeEvent('share', 'feedShare', { worker: 'cpu-worker-3' }, T0 + 1000));
        expect(feed.map((e) => e.params.worker)).toEqual(['cpu-worker-3', 'cpu-worker-1']);
    });

    it('replaces a recent record with the newer one', () => {
        let feed = pushEvent([], makeEvent('record', 'feedRecord', { value: 0.01 }, T0));
        feed = pushEvent(feed, makeEvent('record', 'feedRecord', { value: 0.02 }, T0 + 2000));
        expect(feed).toHaveLength(1);
        expect(feed[0].params.value).toBe(0.02);
    });

    it('caps the feed length', () => {
        let feed = [];
        for (let i = 0; i < FEED_LIMIT + 10; i++) {
            feed = pushEvent(feed, makeEvent('info', 'feedBlockLoaded', { height: i }, T0 + i * 100000));
        }
        expect(feed).toHaveLength(FEED_LIMIT);
        expect(feed[0].params.height).toBe(FEED_LIMIT + 9);
    });
});

describe('deriveEvents', () => {
    const base = { connected: true, accepted_shares: 10, best_difficulty: 0.01, block_height: 100 };

    it('produces nothing without two snapshots or when nothing changed', () => {
        expect(deriveEvents(null, base)).toEqual([]);
        expect(deriveEvents(base, null)).toEqual([]);
        expect(deriveEvents(base, { ...base })).toEqual([]);
    });

    it('reports a connection, the loaded block and the first proofs', () => {
        const prev = { connected: false, accepted_shares: 0, best_difficulty: 0, block_height: 0 };
        const next = { connected: true, accepted_shares: 3, best_difficulty: 0.002, block_height: 952143 };
        const events = deriveEvents(prev, next, { pool: 'solo.ckpool.org' }, T0);
        expect(events.map((e) => e.key)).toEqual(['feedConnected', 'feedBlockLoaded', 'feedShare', 'feedRecord']);
        expect(events[0].params.pool).toBe('solo.ckpool.org');
        expect(events[1].params.height).toBe(952143);
        expect(events[3].params.value).toBe(0.002);
    });

    it('names the worker that found the latest proof', () => {
        const events = deriveEvents(base, { ...base, accepted_shares: 11, last_share_worker: 'cpu-worker-3' });
        expect(events).toHaveLength(1);
        expect(events[0].params.worker).toBe('cpu-worker-3');
    });

    it('writes one line per update even when several proofs arrived at once', () => {
        expect(deriveEvents(base, { ...base, accepted_shares: 17 })).toHaveLength(1);
    });

    it('ignores counters going down (stats reset)', () => {
        expect(deriveEvents(base, { ...base, accepted_shares: 0, best_difficulty: 0 })).toEqual([]);
    });

    it('warns when the pool connection drops', () => {
        const events = deriveEvents(base, { ...base, connected: false });
        expect(events.map((e) => e.kind)).toEqual(['warning']);
        expect(events[0].key).toBe('feedDisconnected');
    });
});

describe('describeEvent', () => {
    const tFr = createTranslator('fr');
    const tEn = createTranslator('en');

    it('writes a proof of work with the worker that found it', () => {
        const event = makeEvent('share', 'feedShare', { worker: 'cpu-worker-3' });
        expect(describeEvent(event, tFr)).toBe('Preuve de travail validée par le pool · cpu-worker-3');
        expect(describeEvent(event, tEn)).toBe('Proof of work validated by the pool · cpu-worker-3');
    });

    it('still writes the line when the source does not say which worker', () => {
        const event = makeEvent('share', 'feedShare', { worker: '' });
        expect(describeEvent(event, tFr)).toBe('Preuve de travail validée par le pool');
    });

    it('shows a record with four decimals', () => {
        expect(describeEvent(makeEvent('record', 'feedRecord', { value: 0.01294 }), tFr)).toBe(
            'Nouveau record : votre meilleur essai monte à 0.0129'
        );
    });

    it('translates parameterised messages', () => {
        const event = makeEvent('info', 'feedBlockLoaded', { height: 952143 });
        expect(describeEvent(event, tEn)).toBe(
            'Bitcoin block #952143 fetched: this is the one you are trying to validate'
        );
    });
});
