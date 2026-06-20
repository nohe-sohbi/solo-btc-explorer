import { describe, it, expect } from 'vitest';
import { formatHashrate, formatNumber, formatUptime } from './format.js';

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
