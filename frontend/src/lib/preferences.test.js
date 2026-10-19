import { describe, it, expect } from 'vitest';
import { resolveTheme, resolveLanguage, parseRoute, routeToHash, ROUTES } from './preferences.js';

describe('resolveTheme', () => {
    it('honours an explicit stored choice over the system preference', () => {
        expect(resolveTheme('dark', false)).toBe('dark');
        expect(resolveTheme('light', true)).toBe('light');
    });

    it('follows the system preference when nothing valid is stored', () => {
        expect(resolveTheme(null, true)).toBe('dark');
        expect(resolveTheme('sepia', false)).toBe('light');
    });
});

describe('resolveLanguage', () => {
    it('honours an explicit stored choice', () => {
        expect(resolveLanguage('en', 'fr-FR')).toBe('en');
        expect(resolveLanguage('fr', 'en-US')).toBe('fr');
    });

    it('uses the browser language, French or English only', () => {
        expect(resolveLanguage(null, 'fr-CA')).toBe('fr');
        expect(resolveLanguage(null, 'en-GB')).toBe('en');
        expect(resolveLanguage(null, 'de-DE')).toBe('en');
    });

    it('defaults to French when the browser reports nothing', () => {
        expect(resolveLanguage(null, undefined)).toBe('fr');
        expect(resolveLanguage('xx', '')).toBe('fr');
    });
});

describe('routing', () => {
    it('parses every known screen', () => {
        for (const route of ROUTES) {
            expect(parseRoute(routeToHash(route))).toBe(route);
        }
    });

    it('treats an empty, root or unknown hash as the dashboard', () => {
        expect(parseRoute('')).toBe('dashboard');
        expect(parseRoute('#')).toBe('dashboard');
        expect(parseRoute('#/')).toBe('dashboard');
        expect(parseRoute('#/nope')).toBe('dashboard');
        expect(parseRoute(undefined)).toBe('dashboard');
    });

    it('ignores trailing path or query parts', () => {
        expect(parseRoute('#/history?tab=blocks')).toBe('history');
        expect(parseRoute('#/config/extra')).toBe('config');
    });

    it('falls back to the dashboard hash for an unknown route', () => {
        expect(routeToHash('nope')).toBe('#/');
    });
});
