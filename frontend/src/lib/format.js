// Shared display formatters. Previously duplicated across App.jsx and
// WorkerCard.jsx; centralised here so the dashboard and worker rows render
// identical units and so the logic can be unit-tested in isolation.

// formatHashrate renders an H/s figure with the largest sensible SI-ish unit.
export function formatHashrate(hash) {
    if (!hash) return '0 H/s';
    if (hash >= 1e9) return `${(hash / 1e9).toFixed(2)} GH/s`;
    if (hash >= 1e6) return `${(hash / 1e6).toFixed(2)} MH/s`;
    if (hash >= 1e3) return `${(hash / 1e3).toFixed(2)} KH/s`;
    return `${hash.toFixed(2)} H/s`;
}

// formatNumber renders large counters compactly (e.g. 1.23M).
export function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
}

// formatUptime renders a duration in seconds as a short h/m/s string.
export function formatUptime(seconds) {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
