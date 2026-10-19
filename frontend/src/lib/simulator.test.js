import { describe, it, expect } from 'vitest';
import {
    MIN_LOG_HASHRATE,
    MAX_LOG_HASHRATE,
    HASHRATE_PRESETS,
    hashrateToSlider,
    sliderToHashrate,
    compareToLottery,
    compareToTimescale,
    simulate,
} from './simulator.js';
import { SECONDS_PER_YEAR } from './odds.js';

const NETWORK_DIFFICULTY = 1.21e14;

describe('slider conversion', () => {
    it('round-trips a hashrate through the log slider', () => {
        const rate = 475260;
        expect(sliderToHashrate(hashrateToSlider(rate))).toBeCloseTo(rate, 0);
    });

    it('clamps to the slider range and treats a missing hashrate as the minimum', () => {
        expect(hashrateToSlider(0)).toBe(MIN_LOG_HASHRATE);
        expect(hashrateToSlider(1)).toBe(MIN_LOG_HASHRATE);
        expect(hashrateToSlider(1e30)).toBe(MAX_LOG_HASHRATE);
        expect(sliderToHashrate(99)).toBe(10 ** MAX_LOG_HASHRATE);
    });

    it('keeps every fixed preset inside the slider range', () => {
        for (const { hashrate } of HASHRATE_PRESETS.filter((p) => p.hashrate)) {
            const v = hashrateToSlider(hashrate);
            expect(v).toBeGreaterThan(MIN_LOG_HASHRATE);
            expect(v).toBeLessThan(MAX_LOG_HASHRATE);
        }
    });
});

describe('compareToLottery', () => {
    it('is null without odds', () => {
        expect(compareToLottery(0)).toBeNull();
    });

    it('reports how many times less likely than the EuroMillions jackpot', () => {
        const result = compareToLottery(1 / 12.7e12);
        expect(result.kind).toBe('less');
        expect(result.factor).toBeGreaterThan(90000);
        expect(result.factor).toBeLessThan(91500);
    });

    it('reports "more likely" and "similar" cases', () => {
        expect(compareToLottery(1e-3).kind).toBe('more');
        expect(compareToLottery(1 / 139838160).kind).toBe('similar');
    });
});

describe('compareToTimescale', () => {
    const years = (n) => n * SECONDS_PER_YEAR;

    it('is null for an unusable duration', () => {
        expect(compareToTimescale(Infinity)).toBeNull();
        expect(compareToTimescale(0)).toBeNull();
    });

    it('compares against the age of the universe, then smaller scales', () => {
        expect(compareToTimescale(years(34.7e9)).kind).toBe('universeMultiple');
        expect(compareToTimescale(years(1e9)).kind).toBe('universePercent');
        expect(compareToTimescale(years(1e6)).kind).toBe('history');
        expect(compareToTimescale(years(500)).kind).toBe('lifetimes');
        expect(compareToTimescale(years(5)).kind).toBe('underLifetime');
        expect(compareToTimescale(years(0.2)).kind).toBe('withinReach');
    });

    it('gives ~2.5 universe ages for a browser tab on mainnet difficulty', () => {
        const { expectedSeconds } = simulate({ hashrate: 475260, networkDifficulty: NETWORK_DIFFICULTY });
        const result = compareToTimescale(expectedSeconds);
        expect(result.kind).toBe('universeMultiple');
        expect(result.value).toBeCloseTo(2.5, 1);
    });
});

describe('simulate', () => {
    it('reports no data without a usable hashrate or difficulty', () => {
        expect(simulate({ hashrate: 0, networkDifficulty: NETWORK_DIFFICULTY }).hasData).toBe(false);
        expect(simulate({ hashrate: 1e6, networkDifficulty: 0 }).hasData).toBe(false);
    });

    it('matches the known figures for a browser tab (475 KH/s)', () => {
        const sim = simulate({
            hashrate: 475260,
            networkDifficulty: NETWORK_DIFFICULTY,
            rewardBTC: 3.125,
            priceUSD: 98400,
        });
        expect(sim.hasData).toBe(true);
        // ~34.7 billion years on average
        expect(sim.expectedSeconds / SECONDS_PER_YEAR).toBeGreaterThan(34.5e9);
        expect(sim.expectedSeconds / SECONDS_PER_YEAR).toBeLessThan(34.9e9);
        // ~1 in 12.7 trillion per day
        expect(1 / sim.probPerDay).toBeGreaterThan(12.6e12);
        expect(1 / sim.probPerDay).toBeLessThan(12.8e12);
        expect(sim.usdPerDay).toBeGreaterThan(2.3e-8);
        expect(sim.usdPerDay).toBeLessThan(2.6e-8);
    });

    it('returns one probability per horizon, growing with the horizon', () => {
        const sim = simulate({ hashrate: 2e14, networkDifficulty: NETWORK_DIFFICULTY });
        expect(sim.horizons.map((h) => h.id)).toEqual(['day', 'month', 'year', 'decade']);
        const probabilities = sim.horizons.map((h) => h.probability);
        expect([...probabilities].sort((a, b) => a - b)).toEqual(probabilities);
        expect(probabilities.every((p) => p > 0 && p <= 1)).toBe(true);
    });

    it('divides the waiting time by the speed-up', () => {
        const slow = simulate({ hashrate: 1e9, networkDifficulty: NETWORK_DIFFICULTY });
        const fast = simulate({ hashrate: 1e11, networkDifficulty: NETWORK_DIFFICULTY });
        expect(slow.expectedSeconds / fast.expectedSeconds).toBeCloseTo(100, 6);
    });

    it('leaves the dollar expectation null when the price is unknown', () => {
        const sim = simulate({ hashrate: 1e9, networkDifficulty: NETWORK_DIFFICULTY });
        expect(sim.usdPerDay).toBeNull();
    });
});
