// Tiny, failure-tolerant wrapper around localStorage. Storage can be missing or
// throw (private windows, blocked site data, SSR/tests), and none of the
// preferences stored here are worth crashing the UI for.

export function readStorage(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeStorage(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Preference simply won't persist; the in-memory value still works.
    }
}
