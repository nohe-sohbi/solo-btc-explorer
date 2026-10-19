import { describe, it, expect } from 'vitest';
import {
    computeOdds,
    computeExpectedValue,
    blockSubsidy,
    probabilityWithin,
    HASHES_PER_DIFFICULTY,
    SECONDS_PER_DAY,
    DEFAULT_BLOCK_REWARD_BTC,
} from './odds.js';

describe('computeOdds', () => {
    it('reports no data when hashrate or difficulty is missing', () => {
        expect(computeOdds(0, 1e12).hasData).toBe(false);
        expect(computeOdds(1000, 0).hasData).toBe(false);
        const none = computeOdds(0, 0);
        expect(none.hasData).toBe(false);
        expect(none.expectedSeconds).toBe(Infinity);
        expect(none.probPerDay).toBe(0);
    });

    it('derives expected time = difficulty * 2^32 / hashrate', () => {
        const diff = 1e6;
        const rate = 1e3;
        const { expectedSeconds, hasData } = computeOdds(rate, diff);
        expect(hasData).toBe(true);
        expect(expectedSeconds).toBeCloseTo((diff * HASHES_PER_DIFFICULTY) / rate, 5);
    });

    it('produces probabilities in (0,1) that grow with the horizon', () => {
        const { probPerDay, probPerYear } = computeOdds(1e9, 1e9);
        expect(probPerDay).toBeGreaterThan(0);
        expect(probPerDay).toBeLessThan(1);
        expect(probPerYear).toBeGreaterThan(probPerDay);
    });

    it('matches the Poisson formula for a known expected time', () => {
        // Pick rate so that expectedSeconds == SECONDS_PER_DAY exactly.
        const diff = 1;
        const rate = (diff * HASHES_PER_DIFFICULTY) / SECONDS_PER_DAY;
        const { probPerDay } = computeOdds(rate, diff);
        expect(probPerDay).toBeCloseTo(1 - Math.exp(-1), 6); // ~0.632
    });
});

describe('computeExpectedValue', () => {
    it('multiplies probability by reward and price', () => {
        const ev = computeExpectedValue({
            probPerDay: 0.001,
            probPerYear: 0.3,
            blockRewardBTC: 3.125,
            priceUSD: 100000,
        });
        expect(ev.btcPerDay).toBeCloseTo(0.003125, 9);
        expect(ev.btcPerYear).toBeCloseTo(0.9375, 6);
        expect(ev.usdPerDay).toBeCloseTo(312.5, 4);
        expect(ev.usdPerYear).toBeCloseTo(93750, 1);
        expect(ev.hasPrice).toBe(true);
    });

    it('falls back to the default reward when none is given', () => {
        const ev = computeExpectedValue({ probPerDay: 1, probPerYear: 1 });
        expect(ev.rewardBTC).toBe(DEFAULT_BLOCK_REWARD_BTC);
        expect(ev.btcPerDay).toBe(DEFAULT_BLOCK_REWARD_BTC);
    });

    it('returns null USD figures when the price is unknown', () => {
        const ev = computeExpectedValue({ probPerDay: 0.5, probPerYear: 0.9, blockRewardBTC: 3.125 });
        expect(ev.hasPrice).toBe(false);
        expect(ev.usdPerDay).toBeNull();
        expect(ev.usdPerYear).toBeNull();
        expect(ev.btcPerDay).toBeCloseTo(1.5625, 6);
    });
});

describe('blockSubsidy', () => {
    it('follows the halving schedule', () => {
        expect(blockSubsidy(0)).toBe(DEFAULT_BLOCK_REWARD_BTC); // unknown/zero -> default
        expect(blockSubsidy(210000)).toBe(25);
        expect(blockSubsidy(420000)).toBe(12.5);
        expect(blockSubsidy(840000)).toBe(3.125);
        expect(blockSubsidy(64 * 210000)).toBe(0);
    });
});

describe('probabilityWithin', () => {
    it('is 0 for an unusable expected time', () => {
        expect(probabilityWithin(100, 0)).toBe(0);
        expect(probabilityWithin(100, Infinity)).toBe(0);
        expect(probabilityWithin(100, NaN)).toBe(0);
    });

    it('follows 1 - e^(-T/λ)', () => {
        expect(probabilityWithin(1, 1)).toBeCloseTo(1 - Math.exp(-1), 12);
    });

    it('keeps full precision for astronomically small probabilities', () => {
        // 1 - exp(-1e-20) rounds to exactly 0 in floating point; expm1 does not.
        expect(probabilityWithin(1, 1e20)).toBeCloseTo(1e-20, 30);
    });
});
