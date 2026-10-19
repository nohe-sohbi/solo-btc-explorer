// Optional Umami analytics. The script is only injected on the production domain
// (see index.html), so `window.umami` is usually absent; calling track() is then a
// harmless no-op.
export function track(event, data) {
    if (typeof window !== 'undefined') {
        window.umami?.track(event, data);
    }
}
