// Mining-odds math, extracted from OddsPanel so it can be unit-tested without a
// DOM. Uses the standard Bitcoin proof-of-work model: a block needs, on average,
// difficulty * 2^32 hashes, and block discovery is a Poisson process.

export const HASHES_PER_DIFFICULTY = 2 ** 32; // expected hashes per unit of difficulty
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

// computeOdds derives the expected time to a block and the probability of finding
// one within a day / a year from a hashrate (H/s) and the network difficulty.
export function computeOdds(hashrate, networkDifficulty) {
    const diff = networkDifficulty > 0 ? networkDifficulty : 0;
    const rate = hashrate > 0 ? hashrate : 0;

    if (diff <= 0 || rate <= 0) {
        return { expectedSeconds: Infinity, probPerDay: 0, probPerYear: 0, hasData: false };
    }

    const expectedHashes = diff * HASHES_PER_DIFFICULTY;
    const expectedSeconds = expectedHashes / rate;

    // P(at least one block in T) = 1 - e^(-T/λ), where λ is the expected time
    // to a single block.
    const probPerDay = 1 - Math.exp(-SECONDS_PER_DAY / expectedSeconds);
    const probPerYear = 1 - Math.exp(-SECONDS_PER_YEAR / expectedSeconds);

    return { expectedSeconds, probPerDay, probPerYear, hasData: true };
}

// formatTimespan renders a (possibly astronomical) duration in seconds. Solo CPU
// mining lands in the "billions of years" range, so it falls back to scientific
// notation once years get unwieldy. `t` is the translation function.
export function formatTimespan(seconds, t) {
    if (!isFinite(seconds) || seconds <= 0) return '—';
    if (seconds < 60) return `${seconds.toFixed(0)} s`;
    if (seconds < SECONDS_PER_DAY) {
        const h = seconds / 3600;
        return `${h.toFixed(1)} h`;
    }
    if (seconds < SECONDS_PER_YEAR) {
        const d = seconds / SECONDS_PER_DAY;
        return `${d.toFixed(1)} ${t('oddsDays')}`;
    }
    const years = seconds / SECONDS_PER_YEAR;
    if (years < 1e6) return `${Math.round(years).toLocaleString()} ${t('oddsYears')}`;
    return `${years.toExponential(2)} ${t('oddsYears')}`;
}

// formatOdds renders a probability as compact "1 in N" odds. `t` is the
// translation function.
export function formatOdds(probability, t) {
    if (!isFinite(probability) || probability <= 0) return '—';
    if (probability >= 1) return t('oddsCertain');
    const n = 1 / probability;
    if (n < 1e6) return `1 ${t('oddsIn')} ${Math.round(n).toLocaleString()}`;
    return `1 ${t('oddsIn')} ${n.toExponential(2)}`;
}
