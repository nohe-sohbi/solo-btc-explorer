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

// Default mainnet block subsidy (BTC) used when the backend hasn't reported the
// live, height-derived reward yet. Kept in sync with the current halving era.
export const DEFAULT_BLOCK_REWARD_BTC = 3.125;

const HALVING_INTERVAL = 210000;

// blockSubsidy returns the block reward (BTC) at a given height, following
// Bitcoin's halving schedule (50 BTC, halved every 210000 blocks). Mirrors
// network.BlockSubsidy in the Go backend so the demo computes the same value.
export function blockSubsidy(height) {
    if (!(height > 0)) return DEFAULT_BLOCK_REWARD_BTC;
    const halvings = Math.floor(height / HALVING_INTERVAL);
    if (halvings >= 64) return 0;
    return 50 / 2 ** halvings;
}

// computeExpectedValue turns the abstract odds into concrete economics: how much
// the mined reward is worth on average per day / per year. It's the long-run
// expectation of a lottery — the probability of solving a block over the horizon
// times the reward's fiat value. For solo CPU mining this is vanishingly small,
// which is exactly the educational point.
//
//   blockRewardBTC: the block subsidy you'd win (defaults to the current era).
//   priceUSD:       BTC/USD price; when unknown, the USD figures are null but the
//                   BTC expectation is still returned.
export function computeExpectedValue({ probPerDay, probPerYear, blockRewardBTC, priceUSD }) {
    const reward = blockRewardBTC > 0 ? blockRewardBTC : DEFAULT_BLOCK_REWARD_BTC;
    const day = probPerDay > 0 ? probPerDay : 0;
    const year = probPerYear > 0 ? probPerYear : 0;

    const btcPerDay = day * reward;
    const btcPerYear = year * reward;
    const hasPrice = priceUSD > 0;

    return {
        rewardBTC: reward,
        btcPerDay,
        btcPerYear,
        usdPerDay: hasPrice ? btcPerDay * priceUSD : null,
        usdPerYear: hasPrice ? btcPerYear * priceUSD : null,
        hasPrice,
    };
}

// formatUSD renders a USD expectation. Solo-mining expectations are tiny, so it
// keeps enough significant figures to stay non-zero, and switches to scientific
// notation once the value gets absurdly small.
export function formatUSD(value) {
    if (value == null || !isFinite(value) || value <= 0) return '—';
    if (value >= 0.01) {
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (value >= 1e-6) return `$${value.toFixed(6)}`;
    return `$${value.toExponential(2)}`;
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
