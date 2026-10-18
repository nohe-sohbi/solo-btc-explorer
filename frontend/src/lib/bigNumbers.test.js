import { describe, it, expect } from 'vitest';
import { plain } from './testUtils.js';
import { formatBigNumber, formatDecimal, formatInteger } from './bigNumbers.js';


describe('formatInteger / formatDecimal', () => {
    it('groups digits per locale', () => {
        expect(plain(formatInteger(1234567, 'fr'))).toBe('1 234 567');
        expect(formatInteger(1234567, 'en')).toBe('1,234,567');
    });

    it('uses the locale decimal separator and caps the fraction digits', () => {
        expect(formatDecimal(12.345, 'fr', 1)).toBe('12,3');
        expect(formatDecimal(12.345, 'en', 1)).toBe('12.3');
    });
});

describe('formatBigNumber', () => {
    it('leaves numbers below a million as grouped integers', () => {
        expect(plain(formatBigNumber(90818, 'fr'))).toBe('90 818');
        expect(formatBigNumber(999999, 'en')).toBe('999,999');
    });

    it('uses the French long scale (1e12 = billion, 1e9 = milliard)', () => {
        expect(formatBigNumber(12.7e12, 'fr')).toBe('12,7 billions');
        expect(formatBigNumber(34.7e9, 'fr')).toBe('34,7 milliards');
        expect(formatBigNumber(4e15, 'fr')).toBe('4 billiards');
    });

    it('uses the English short scale (1e12 = trillion, 1e9 = billion)', () => {
        expect(formatBigNumber(12.7e12, 'en')).toBe('12.7 trillion');
        expect(formatBigNumber(34.7e9, 'en')).toBe('34.7 billion');
    });

    it('only pluralises in French and only from 2 upwards', () => {
        expect(formatBigNumber(1.5e6, 'fr')).toBe('1,5 million');
        expect(formatBigNumber(2e6, 'fr')).toBe('2 millions');
        expect(formatBigNumber(2e6, 'en')).toBe('2 million');
    });

    it('keeps one decimal below 100 and drops it from 100 upwards', () => {
        expect(formatBigNumber(42.5e9, 'fr')).toBe('42,5 milliards');
        expect(formatBigNumber(123.4e9, 'fr')).toBe('123 milliards');
    });

    it('falls back to English scales for an unknown language', () => {
        expect(formatBigNumber(3e9, 'de')).toBe('3 billion');
    });
});
