// Minimal i18n: flat dictionaries per language plus `{name}` interpolation.
// English is the fallback so a key missing from French still renders readable text
// (a unit test keeps both dictionaries in sync).
import fr from './fr.js';
import en from './en.js';

export const LANGUAGES = ['fr', 'en'];
export const DEFAULT_LANGUAGE = 'fr';

const DICTIONARIES = { fr, en };

// interpolate replaces `{name}` placeholders; unknown placeholders are left as-is
// so a missing parameter is visible rather than silently blank.
export function interpolate(template, params) {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export function translate(lang, key, params) {
    const template = DICTIONARIES[lang]?.[key] ?? DICTIONARIES.en[key] ?? key;
    return interpolate(template, params);
}

// createTranslator returns the `t(key, params)` function handed to components.
export function createTranslator(lang) {
    return (key, params) => translate(lang, key, params);
}

export { DICTIONARIES };
