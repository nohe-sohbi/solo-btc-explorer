// Mining-odds math, kept free of any DOM or i18n so it can be unit-tested directly.
// Uses the standard Bitcoin proof-of-work model: a block needs, on average,
// difficulty * 2^32 hashes, and block discovery is a Poisson process.
// Rendering of these numbers lives in oddsFormat.js.

export const HASHES_PER_DIFFICULTY = 2 ** 32; // expected hashes per unit of difficulty
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

// A recent mainnet difficulty, used for the odds until the live value is known.
export const FALLBACK_NETWORK_DIFFICULTY = 1.21e14;

// probabilityWithin returns P(at least one block within `seconds`) for a Poisson
// process whose expected time to a single block is `expectedSeconds`:
// 1 - e^(-T/λ). expm1 keeps full precision when the probability is astronomically
// small (as it is for solo mining), where `1 - exp(-x)` would lose digits.
export function probabilityWithin(seconds, expectedSeconds) {
    if (!(expectedSeconds > 0) || !isFinite(expectedSeconds)) return 0;
    return -Math.expm1(-seconds / expectedSeconds);
}

// computeOdds derives the expected time to a block and the probability of finding
// one within a day / a year from a hashrate (H/s) and the network difficulty.
export function computeOdds(hashrate, networkDifficulty) {
    const diff = networkDifficulty > 0 ? networkDifficulty : 0;
    const rate = hashrate > 0 ? hashrate : 0;

    if (diff <= 0 || rate <= 0) {
        return { expectedSeconds: Infinity, probPerDay: 0, probPerYear: 0, hasData: false };
    }

    const expectedSeconds = (diff * HASHES_PER_DIFFICULTY) / rate;

    return {
        expectedSeconds,
        probPerDay: probabilityWithin(SECONDS_PER_DAY, expectedSeconds),
        probPerYear: probabilityWithin(SECONDS_PER_YEAR, expectedSeconds),
        hasData: true,
    };
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
