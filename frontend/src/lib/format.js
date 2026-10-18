// Shared display formatters, centralised so the dashboard, the workers list and
// the chart render identical units and so the logic can be unit-tested in
// isolation.
import { LOCALES, formatDecimal } from './bigNumbers.js';

const HASHRATE_UNITS = [
    ['EH/s', 1e18],
    ['PH/s', 1e15],
    ['TH/s', 1e12],
    ['GH/s', 1e9],
    ['MH/s', 1e6],
    ['KH/s', 1e3],
];

// hashrateScale picks the largest sensible SI-ish unit for an H/s figure.
export function hashrateScale(hash) {
    for (const [unit, divisor] of HASHRATE_UNITS) {
        if (hash >= divisor) return { unit, divisor };
    }
    return { unit: 'H/s', divisor: 1 };
}

// splitHashrate breaks an H/s figure into a number and its unit, so callers can
// style them separately: 475260 -> { value: 475.26, unit: 'KH/s' }.
export function splitHashrate(hash) {
    if (!hash) return { value: 0, unit: 'H/s' };
    const { unit, divisor } = hashrateScale(hash);
    return { value: hash / divisor, unit };
}

// formatHashrate renders an H/s figure with its unit ("475.26 KH/s").
export function formatHashrate(hash) {
    if (!hash) return '0 H/s';
    const { value, unit } = splitHashrate(hash);
    return `${value.toFixed(2)} ${unit}`;
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

// approximateCount rounds an attempts-per-second figure to a readable
// approximation: thousands above 1 000 ("475 000"), units below.
export function approximateCount(value) {
    if (!(value > 0)) return 0;
    return value >= 1000 ? Math.round(value / 1000) * 1000 : Math.round(value);
}

// formatReward renders a block reward in BTC with the locale's decimal separator
// ("3,125" / "3.125"), without padding zeros.
export function formatReward(btc, lang) {
    return btc.toLocaleString(LOCALES[lang] || LOCALES.en, { maximumFractionDigits: 8 });
}

const SI_LETTERS = [
    ['P', 1e15],
    ['T', 1e12],
    ['G', 1e9],
    ['M', 1e6],
    ['K', 1e3],
];

// formatSi renders a large unitless quantity with a one-letter SI suffix, e.g. the
// network difficulty: 1.21e14 -> "121 T".
export function formatSi(value, lang) {
    if (!(value > 0)) return '0';
    for (const [letter, divisor] of SI_LETTERS) {
        if (value >= divisor) {
            const scaled = value / divisor;
            return `${formatDecimal(scaled, lang, scaled < 10 ? 2 : scaled < 100 ? 1 : 0)} ${letter}`;
        }
    }
    return formatDecimal(value, lang, 2);
}
