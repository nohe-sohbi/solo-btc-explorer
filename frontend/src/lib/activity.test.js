import { describe, it, expect } from 'vitest';
import { plain } from './testUtils.js';
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

    it('merges share events that arrive in quick succession', () => {
        let feed = pushEvent([], makeEvent('shares', 'feedShares', { count: 12 }, T0));
        feed = pushEvent(feed, makeEvent('shares', 'feedShares', { count: 8 }, T0 + 5000));
        expect(feed).toHaveLength(1);
        expect(feed[0].params.count).toBe(20);
        expect(feed[0].ts).toBe(T0 + 5000);
    });

    it('starts a new share entry once the merge window has passed', () => {
        let feed = pushEvent([], makeEvent('shares', 'feedShares', { count: 12 }, T0));
        feed = pushEvent(feed, makeEvent('shares', 'feedShares', { count: 8 }, T0 + 31000));
        expect(feed).toHaveLength(2);
        expect(feed[0].params.count).toBe(8);
    });

    it('does not merge shares across a different event in between', () => {
        let feed = pushEvent([], makeEvent('shares', 'feedShares', { count: 1 }, T0));
        feed = pushEvent(feed, makeEvent('info', 'feedBlockLoaded', { height: 5 }, T0 + 1000));
        feed = pushEvent(feed, makeEvent('shares', 'feedShares', { count: 1 }, T0 + 2000));
        expect(feed.map((e) => e.kind)).toEqual(['shares', 'info', 'shares']);
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
        expect(events.map((e) => e.key)).toEqual(['feedConnected', 'feedBlockLoaded', 'feedShares', 'feedRecord']);
        expect(events[0].params.pool).toBe('solo.ckpool.org');
        expect(events[1].params.height).toBe(952143);
        expect(events[2].params.count).toBe(3);
        expect(events[3].params.value).toBe(0.002);
    });

    it('reports only the delta of newly validated proofs', () => {
        const events = deriveEvents(base, { ...base, accepted_shares: 17 });
        expect(events).toHaveLength(1);
        expect(events[0].params.count).toBe(7);
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

    it('uses the singular for one validated proof', () => {
        expect(describeEvent(makeEvent('shares', 'feedShares', { count: 1 }), tFr, 'fr')).toBe(
            '1 preuve de travail validée par le pool'
        );
    });

    it('formats the proof count per language', () => {
        const event = makeEvent('shares', 'feedShares', { count: 1234 });
        expect(plain(describeEvent(event, tFr, 'fr'))).toBe('1 234 preuves de travail validées par le pool');
        expect(describeEvent(event, tEn, 'en')).toBe('1,234 proofs of work validated by the pool');
    });

    it('shows a record with four decimals', () => {
        expect(describeEvent(makeEvent('record', 'feedRecord', { value: 0.01294 }), tFr, 'fr')).toBe(
            'Nouveau record : votre meilleur essai monte à 0.0129'
        );
    });

    it('passes raw backend text through untouched', () => {
        const event = makeEvent('info', 'raw', { text: 'job 4f2a received' });
        expect(describeEvent(event, tFr, 'fr')).toBe('job 4f2a received');
    });

    it('translates parameterised messages', () => {
        const event = makeEvent('info', 'feedBlockLoaded', { height: 952143 });
        expect(describeEvent(event, tEn, 'en')).toBe(
            'Bitcoin block #952143 fetched: this is the one you are trying to validate'
        );
    });
});
