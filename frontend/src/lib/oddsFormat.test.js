import { describe, it, expect } from 'vitest';
import { plain } from './testUtils.js';
import { formatDuration, formatOneIn, formatChance, formatUsd, formatUsdWhole } from './oddsFormat.js';
import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from './odds.js';
import { createTranslator } from '../i18n/index.js';

const tFr = createTranslator('fr');
const tEn = createTranslator('en');

describe('formatDuration', () => {
    it('renders the empty marker for non-positive or infinite input', () => {
        expect(formatDuration(0, 'fr', tFr)).toBe('—');
        expect(formatDuration(-3, 'fr', tFr)).toBe('—');
        expect(formatDuration(Infinity, 'fr', tFr)).toBe('—');
    });

    it('picks seconds, minutes, hours, days and years', () => {
        expect(formatDuration(45, 'fr', tFr)).toBe('45 s');
        expect(formatDuration(12 * 60, 'fr', tFr)).toBe('12 min');
        expect(formatDuration(3.5 * 3600, 'fr', tFr)).toBe('3,5 h');
        expect(formatDuration(120 * SECONDS_PER_DAY, 'fr', tFr)).toBe('120 jours');
        expect(formatDuration(5.5 * SECONDS_PER_YEAR, 'fr', tFr)).toBe('5,5 ans');
        expect(plain(formatDuration(5400 * SECONDS_PER_YEAR, 'fr', tFr))).toBe('5 400 ans');
    });

    it('names astronomical spans with a scale word instead of exponents', () => {
        expect(formatDuration(34.7e9 * SECONDS_PER_YEAR, 'fr', tFr)).toBe("34,7 milliards d'années");
        expect(formatDuration(34.7e9 * SECONDS_PER_YEAR, 'en', tEn)).toBe('34.7 billion years');
    });
});

describe('formatOneIn', () => {
    it('renders the empty marker for invalid probabilities', () => {
        expect(formatOneIn(0, 'fr', tFr)).toBe('—');
        expect(formatOneIn(NaN, 'fr', tFr)).toBe('—');
    });

    it('renders certainty and "1 in N" odds in both languages', () => {
        expect(formatOneIn(1, 'fr', tFr)).toBe('quasi certain');
        expect(formatOneIn(1 / 12.7e12, 'fr', tFr)).toBe('1 sur 12,7 billions');
        expect(formatOneIn(1 / 12.7e12, 'en', tEn)).toBe('1 in 12.7 trillion');
    });
});

describe('formatChance', () => {
    it('uses a percentage from 1 % upwards and "1 in N" below', () => {
        expect(formatChance(0.255, 'fr', tFr)).toBe('25,5 %');
        expect(plain(formatChance(0.001, 'fr', tFr))).toBe('1 sur 1 000');
    });

    it('renders the empty marker for invalid probabilities', () => {
        expect(formatChance(0, 'fr', tFr)).toBe('—');
    });
});

describe('formatUsd', () => {
    it('renders the empty marker for non-positive / nullish input', () => {
        expect(formatUsd(null, 'fr')).toBe('—');
        expect(formatUsd(0, 'fr')).toBe('—');
        expect(formatUsd(-1, 'en')).toBe('—');
    });

    it('renders normal and tiny amounts', () => {
        expect(formatUsd(307500, 'en')).toBe('$307,500.00');
        expect(formatUsd(2.4e-8, 'en')).toBe('$0.000000024');
        expect(formatUsd(2.4e-8, 'fr')).toBe('$0,000000024');
    });

    it('flags amounts below a billionth of a dollar', () => {
        expect(formatUsd(1e-12, 'en')).toBe('< $0.000000001');
    });
});

describe('formatUsdWhole', () => {
    it('rounds to whole dollars with locale grouping', () => {
        expect(formatUsdWhole(307500.4, 'en')).toBe('$307,500');
        expect(plain(formatUsdWhole(307500.4, 'fr'))).toBe('$307 500');
    });

    it('renders the empty marker for missing amounts', () => {
        expect(formatUsdWhole(0, 'fr')).toBe('—');
        expect(formatUsdWhole(null, 'fr')).toBe('—');
    });
});
