// Pure helpers behind the user-preference and routing hooks, kept separate so the
// decisions (which theme? which language? which screen?) are unit-testable.
import { LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/index.js';

export const THEMES = ['light', 'dark'];

// resolveTheme prefers an explicit stored choice, then the OS preference, and
// defaults to the light theme.
export function resolveTheme(stored, prefersDark) {
    if (THEMES.includes(stored)) return stored;
    return prefersDark ? 'dark' : 'light';
}

// resolveLanguage prefers a stored choice, then the browser language (French
// browsers get French, everything else English), then the app default.
export function resolveLanguage(stored, browserLanguage) {
    if (LANGUAGES.includes(stored)) return stored;
    const base = String(browserLanguage || '').toLowerCase().split('-')[0];
    if (LANGUAGES.includes(base)) return base;
    return base ? 'en' : DEFAULT_LANGUAGE;
}

// Screens and the URL hash that addresses each of them.
export const ROUTES = ['dashboard', 'chances', 'history', 'config', 'help'];
const ROUTE_HASHES = {
    dashboard: '#/',
    chances: '#/chances',
    history: '#/history',
    config: '#/config',
    help: '#/help',
};

// parseRoute maps a location hash to a screen id; anything unknown is the dashboard.
export function parseRoute(hash) {
    const name = String(hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
    return ROUTES.includes(name) ? name : 'dashboard';
}

export function routeToHash(route) {
    return ROUTE_HASHES[route] || ROUTE_HASHES.dashboard;
}
