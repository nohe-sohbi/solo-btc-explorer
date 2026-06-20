import { describe, it, expect } from 'vitest';
import {
    computeOdds,
    formatTimespan,
    formatOdds,
    HASHES_PER_DIFFICULTY,
    SECONDS_PER_DAY,
} from './odds.js';

// Minimal translation stub: returns the key so assertions stay readable.
const t = (k) => k;

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

describe('formatTimespan', () => {
    it('renders the empty marker for non-positive / infinite input', () => {
        expect(formatTimespan(0, t)).toBe('—');
        expect(formatTimespan(Infinity, t)).toBe('—');
    });

    it('renders seconds, hours, days and years', () => {
        expect(formatTimespan(30, t)).toBe('30 s');
        expect(formatTimespan(7200, t)).toBe('2.0 h');
        expect(formatTimespan(2 * SECONDS_PER_DAY, t)).toBe('2.0 oddsDays');
        expect(formatTimespan(2 * 365.25 * SECONDS_PER_DAY, t)).toBe('2 oddsYears');
    });

    it('falls back to scientific notation for astronomical spans', () => {
        const huge = 1e7 * 365.25 * SECONDS_PER_DAY; // 10 million years
        expect(formatTimespan(huge, t)).toMatch(/e\+/);
    });
});

describe('formatOdds', () => {
    it('renders the empty marker for invalid probabilities', () => {
        expect(formatOdds(0, t)).toBe('—');
        expect(formatOdds(-1, t)).toBe('—');
    });

    it('renders certainty and "1 in N" odds', () => {
        expect(formatOdds(1, t)).toBe('oddsCertain');
        expect(formatOdds(0.5, t)).toBe('1 oddsIn 2');
        expect(formatOdds(1e-9, t)).toMatch(/1 oddsIn .*e\+/);
    });
});
