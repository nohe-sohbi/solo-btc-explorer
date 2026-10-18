import { describe, it, expect } from 'vitest';
import {
    SAMPLE_CAPACITY,
    CHART_POINTS,
    PERIODS,
    appendSample,
    windowSeries,
    bucketSizeFor,
    slotsFor,
    chartRange,
    buildPaths,
} from './series.js';
import { DICTIONARIES } from '../i18n/index.js';

describe('appendSample', () => {
    it('appends without mutating the buffer', () => {
        const buffer = [1, 2];
        const next = appendSample(buffer, 3);
        expect(next).toEqual([1, 2, 3]);
        expect(buffer).toEqual([1, 2]);
    });

    it('drops the oldest samples beyond the capacity', () => {
        expect(appendSample([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
    });

    it('defaults to one hour of per-second samples', () => {
        const full = Array.from({ length: SAMPLE_CAPACITY }, (_, i) => i);
        const next = appendSample(full, -1);
        expect(next).toHaveLength(SAMPLE_CAPACITY);
        expect(next[next.length - 1]).toBe(-1);
        expect(next[0]).toBe(1);
    });
});

describe('windowSeries', () => {
    it('keeps only the most recent samples of the window', () => {
        expect(windowSeries([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    });

    it('returns everything when the buffer is shorter than the window', () => {
        expect(windowSeries([1, 2], 60)).toEqual([1, 2]);
    });

    it('averages long windows into at most maxPoints points', () => {
        const samples = Array.from({ length: 3600 }, () => 10);
        const series = windowSeries(samples, 3600);
        expect(series).toHaveLength(CHART_POINTS);
        expect(series.every((v) => v === 10)).toBe(true);
    });

    it('preserves the overall mean when downsampling', () => {
        const samples = Array.from({ length: 300 }, (_, i) => i);
        const series = windowSeries(samples, 300, 30);
        const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
        expect(series).toHaveLength(30);
        expect(mean(series)).toBeCloseTo(mean(samples), 6);
    });

    it('keeps the time scale: a partial window yields proportionally fewer points', () => {
        const samples = Array.from({ length: 200 }, () => 5);
        // 1 h window -> 30 s per point -> 200 s of data is 7 points, not 120.
        expect(windowSeries(samples, 3600)).toHaveLength(7);
    });

    it('aligns the buckets on the newest sample', () => {
        const samples = [1, 1, 1, 1, 9, 9, 9, 9, 9];
        // Buckets of 3 counted back from the newest sample: (9,9,9), then (1,9,9),
        // then (1,1,1) - reported oldest first.
        const series = windowSeries(samples, 9, 3);
        expect(series).toEqual([(1 + 1 + 1) / 3, (1 + 9 + 9) / 3, 9]);
    });
});

describe('bucketSizeFor / slotsFor', () => {
    it('uses raw samples when the window already fits', () => {
        expect(bucketSizeFor(60)).toBe(1);
        expect(slotsFor(60)).toBe(60);
    });

    it('buckets longer windows so they fit in CHART_POINTS', () => {
        expect(bucketSizeFor(300)).toBe(3);
        expect(slotsFor(300)).toBe(100);
        expect(bucketSizeFor(3600)).toBe(30);
        expect(slotsFor(3600)).toBe(120);
        for (const { samples } of PERIODS) {
            expect(slotsFor(samples)).toBeLessThanOrEqual(CHART_POINTS);
        }
    });
});

describe('chartRange', () => {
    it('gives an empty series a usable range', () => {
        expect(chartRange([])).toEqual({ min: 0, max: 1 });
    });

    it('adds headroom around the data and never goes below zero', () => {
        const { min, max } = chartRange([100, 200]);
        expect(min).toBeLessThan(100);
        expect(max).toBeGreaterThan(200);
        expect(chartRange([0, 10]).min).toBe(0);
    });

    it('widens a flat series so it does not collapse onto an edge', () => {
        const { min, max } = chartRange([50, 50, 50]);
        expect(min).toBeLessThan(50);
        expect(max).toBeGreaterThan(50);
        const zero = chartRange([0, 0]);
        expect(zero.max).toBeGreaterThan(zero.min);
    });
});

describe('buildPaths', () => {
    const box = { width: 100, height: 50, min: 0, max: 10 };

    it('returns empty paths for an empty series', () => {
        expect(buildPaths([], box)).toEqual({ line: '', area: '' });
    });

    it('maps the series onto the box (high values near the top)', () => {
        const { line } = buildPaths([0, 10], box);
        expect(line).toBe('M0.0 50.0 L100.0 0.0');
    });

    it('closes the area down to the baseline under the drawn span', () => {
        const { area } = buildPaths([5, 5], box);
        expect(area.endsWith('L100.0 50 L0.0 50 Z')).toBe(true);
    });

    it('draws a single sample at the left edge instead of dividing by zero', () => {
        const { line } = buildPaths([5], box);
        expect(line).toBe('M0.0 25.0');
    });

    it('right-aligns a series shorter than the time axis', () => {
        const { line } = buildPaths([0, 10], { ...box, slots: 5 });
        // 2 samples on a 5-slot axis occupy the last two slots (x = 75 and 100).
        expect(line).toBe('M75.0 50.0 L100.0 0.0');
    });
});

describe('PERIODS', () => {
    it('are ordered from shortest to longest with unique ids', () => {
        const lengths = PERIODS.map((p) => p.samples);
        expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
        expect(new Set(PERIODS.map((p) => p.id)).size).toBe(PERIODS.length);
        expect(Math.max(...lengths)).toBeLessThanOrEqual(SAMPLE_CAPACITY);
    });

    it('reference translation keys that exist', () => {
        for (const period of PERIODS) {
            for (const key of [period.labelKey, period.startKey, period.midKey]) {
                expect(DICTIONARIES.fr[key], key).toBeTruthy();
                expect(DICTIONARIES.en[key], key).toBeTruthy();
            }
        }
    });
});
