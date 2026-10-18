import { describe, it, expect } from 'vitest';
import { DICTIONARIES, LANGUAGES, createTranslator, interpolate, translate } from './index.js';

// Every source file except tests and the dictionaries themselves, as raw text.
const sources = Object.entries(
    import.meta.glob(['../**/*.{js,jsx}', '!../**/*.test.{js,jsx}', '!../i18n/**'], {
        query: '?raw',
        import: 'default',
        eager: true,
    })
);

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const boldMarkers = (text) => (text.match(/\*\*/g) || []).length;
const codeMarkers = (text) => (text.match(/`/g) || []).length;

describe('interpolate / translate', () => {
    it('replaces known placeholders and keeps unknown ones visible', () => {
        expect(interpolate('Hello {name}, {missing}', { name: 'Ada' })).toBe('Hello Ada, {missing}');
        expect(interpolate('No params {x}')).toBe('No params {x}');
    });

    it('falls back to English, then to the key itself', () => {
        expect(translate('xx', 'appName')).toBe('SoloForge');
        expect(translate('fr', 'definitelyMissingKey')).toBe('definitelyMissingKey');
    });

    it('binds a language with createTranslator', () => {
        expect(createTranslator('fr')('statusRunning', { time: '16 s' })).toBe('Mining en cours · 16 s');
        expect(createTranslator('en')('statusRunning', { time: '16 s' })).toBe('Mining · 16 s');
    });
});

describe('dictionaries', () => {
    const [first, ...others] = LANGUAGES;

    it('define exactly the same keys in every language', () => {
        const reference = Object.keys(DICTIONARIES[first]).sort();
        for (const lang of others) {
            expect(Object.keys(DICTIONARIES[lang]).sort(), `keys of "${lang}"`).toEqual(reference);
        }
    });

    it('use the same placeholders and bold markers in every language', () => {
        for (const [key, text] of Object.entries(DICTIONARIES[first])) {
            for (const lang of others) {
                const other = DICTIONARIES[lang][key];
                expect(placeholders(other), `placeholders of "${key}" in ${lang}`).toEqual(placeholders(text));
                expect(boldMarkers(other), `bold markers of "${key}" in ${lang}`).toBe(boldMarkers(text));
                expect(codeMarkers(other), `code markers of "${key}" in ${lang}`).toBe(codeMarkers(text));
            }
        }
    });

    it('never leave a bold marker unpaired', () => {
        for (const lang of LANGUAGES) {
            for (const [key, text] of Object.entries(DICTIONARIES[lang])) {
                expect(boldMarkers(text) % 2, `"${key}" in ${lang}`).toBe(0);
                expect(codeMarkers(text) % 2, `"${key}" in ${lang}`).toBe(0);
            }
        }
    });

    it('have no empty entries', () => {
        for (const lang of LANGUAGES) {
            for (const [key, text] of Object.entries(DICTIONARIES[lang])) {
                expect(text.trim().length, `"${key}" in ${lang}`).toBeGreaterThan(0);
            }
        }
    });
});

describe('usage in the source', () => {
    it('only asks for keys that exist', () => {
        const known = new Set(Object.keys(DICTIONARIES.en));
        const missing = [];
        for (const [file, text] of sources) {
            for (const match of text.matchAll(/\bt\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
                if (!known.has(match[1])) missing.push(`${file}: ${match[1]}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('has no dictionary entry that nothing references', () => {
        const allSource = sources.map(([, text]) => text).join('\n');
        const unused = Object.keys(DICTIONARIES.en).filter(
            (key) => !allSource.includes(`'${key}'`) && !allSource.includes(`"${key}"`)
        );
        expect(unused).toEqual([]);
    });
});
