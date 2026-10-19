// Artwork shipped in public/assets. Every image has a dark-scene version and a
// "-light" version, so the picture always matches the active theme.
export function assetUrl(name, theme) {
    return `/assets/${name}${theme === 'light' ? '-light' : ''}.png`;
}
