import { useState, useEffect, useMemo, useCallback } from 'react';
import { createTranslator } from '../i18n/index.js';
import { resolveTheme, resolveLanguage, parseRoute, routeToHash } from '../lib/preferences.js';
import { readStorage, writeStorage } from '../lib/storage.js';

// Same keys as before the redesign, so returning visitors keep their choices.
const THEME_KEY = 'soloforge-theme';
const LANGUAGE_KEY = 'soloforge-lang';

// useTheme returns the active theme and its setter; the choice is applied to the
// <html> element (where the CSS variables are scoped) and persisted.
export function useTheme() {
    const [theme, setTheme] = useState(() =>
        resolveTheme(readStorage(THEME_KEY), window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    );

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        writeStorage(THEME_KEY, theme);
    }, [theme]);

    return [theme, setTheme];
}

// useLanguage returns the active language, its setter and the bound `t` function.
export function useLanguage() {
    const [lang, setLang] = useState(() => resolveLanguage(readStorage(LANGUAGE_KEY), navigator.language));

    useEffect(() => {
        document.documentElement.lang = lang;
        writeStorage(LANGUAGE_KEY, lang);
    }, [lang]);

    const t = useMemo(() => createTranslator(lang), [lang]);
    return { lang, setLang, t };
}

// useRoute keeps the current screen in the URL hash, so the browser's back button
// and deep links work without a router dependency.
export function useRoute() {
    const [route, setRoute] = useState(() => parseRoute(window.location.hash));

    useEffect(() => {
        const onHashChange = () => setRoute(parseRoute(window.location.hash));
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // A new screen starts at the top, like a page load.
    useEffect(() => {
        window.scrollTo?.(0, 0);
    }, [route]);

    const navigate = useCallback((next) => {
        window.location.hash = routeToHash(next);
    }, []);

    return [route, navigate];
}

// useStoredFlag is a boolean that survives reloads (e.g. "advanced view on",
// "welcome page already seen").
export function useStoredFlag(key, initial = false) {
    const [value, setValue] = useState(() => {
        const stored = readStorage(key);
        return stored === null ? initial : stored === 'true';
    });

    useEffect(() => {
        writeStorage(key, String(value));
    }, [key, value]);

    return [value, setValue];
}
