import { describe, it, expect } from 'vitest';
import { formatHashrate, formatNumber, formatUptime, splitHashrate, hashrateScale, approximateCount, formatReward, formatSi } from './format.js';

describe('formatHashrate', () => {
    it('handles zero / falsy input', () => {
        expect(formatHashrate(0)).toBe('0 H/s');
        expect(formatHashrate(undefined)).toBe('0 H/s');
    });

    it('scales to the right unit', () => {
        expect(formatHashrate(12.5)).toBe('12.50 H/s');
        expect(formatHashrate(1500)).toBe('1.50 KH/s');
        expect(formatHashrate(2_500_000)).toBe('2.50 MH/s');
        expect(formatHashrate(3_200_000_000)).toBe('3.20 GH/s');
    });
});

describe('formatNumber', () => {
    it('handles zero', () => {
        expect(formatNumber(0)).toBe('0');
    });

    it('abbreviates large counters', () => {
        expect(formatNumber(1_500)).toBe('1.50K');
        expect(formatNumber(2_000_000)).toBe('2.00M');
        expect(formatNumber(3_000_000_000)).toBe('3.00B');
        expect(formatNumber(4_000_000_000_000)).toBe('4.00T');
    });
});

describe('formatUptime', () => {
    it('handles zero', () => {
        expect(formatUptime(0)).toBe('0s');
    });

    it('formats seconds, minutes and hours', () => {
        expect(formatUptime(45)).toBe('45s');
        expect(formatUptime(125)).toBe('2m 5s');
        expect(formatUptime(3725)).toBe('1h 2m');
    });
});

describe('splitHashrate', () => {
    it('separates the number from its unit', () => {
        expect(splitHashrate(475260)).toEqual({ value: 475.26, unit: 'KH/s' });
        expect(splitHashrate(2.5e6)).toEqual({ value: 2.5, unit: 'MH/s' });
        expect(splitHashrate(12)).toEqual({ value: 12, unit: 'H/s' });
    });

    it('treats a missing hashrate as zero H/s', () => {
        expect(splitHashrate(0)).toEqual({ value: 0, unit: 'H/s' });
        expect(splitHashrate(undefined)).toEqual({ value: 0, unit: 'H/s' });
    });
});

describe('approximateCount', () => {
    it('rounds to thousands above 1 000 and to units below', () => {
        expect(approximateCount(475260)).toBe(475000);
        expect(approximateCount(1499)).toBe(1000);
        expect(approximateCount(812.4)).toBe(812);
    });

    it('returns 0 for missing or negative values', () => {
        expect(approximateCount(0)).toBe(0);
        expect(approximateCount(-5)).toBe(0);
        expect(approximateCount(undefined)).toBe(0);
    });
});

describe('formatReward', () => {
    it('uses the locale decimal separator without trailing zeros', () => {
        expect(formatReward(3.125, 'fr')).toBe('3,125');
        expect(formatReward(3.125, 'en')).toBe('3.125');
        expect(formatReward(50, 'fr')).toBe('50');
    });
});

describe('formatHashrate at industrial scale', () => {
    it('scales up to TH/s, PH/s and EH/s for the simulator', () => {
        expect(formatHashrate(2e14)).toBe('200.00 TH/s');
        expect(formatHashrate(2e17)).toBe('200.00 PH/s');
        expect(formatHashrate(8.66e20)).toBe('866.00 EH/s');
    });
});

describe('hashrateScale', () => {
    it('returns the unit and its divisor', () => {
        expect(hashrateScale(540000)).toEqual({ unit: 'KH/s', divisor: 1e3 });
        expect(hashrateScale(3e9)).toEqual({ unit: 'GH/s', divisor: 1e9 });
        expect(hashrateScale(5)).toEqual({ unit: 'H/s', divisor: 1 });
    });
});

describe('formatSi', () => {
    it('suffixes large quantities with their SI letter', () => {
        expect(formatSi(1.21e14, 'en')).toBe('121 T');
        expect(formatSi(1.389e14, 'fr')).toBe('139 T');
        expect(formatSi(4.5e9, 'en')).toBe('4.5 G');
        expect(formatSi(2.5e15, 'fr')).toBe('2,5 P');
    });

    it('handles small and empty values', () => {
        expect(formatSi(12.345, 'en')).toBe('12.35');
        expect(formatSi(0, 'en')).toBe('0');
    });
});
