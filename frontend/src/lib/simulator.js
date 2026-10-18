// "What if my computer were faster?" odds simulator. Pure functions: the screen
// feeds in a hashrate and renders the structured result, so every comparison below
// is unit-tested without a DOM.
import {
    SECONDS_PER_DAY,
    SECONDS_PER_YEAR,
    DEFAULT_BLOCK_REWARD_BTC,
    computeOdds,
    computeExpectedValue,
    probabilityWithin,
} from './odds.js';

// The slider is logarithmic: 10^3 H/s (1 KH/s) up to 10^18 H/s (1 EH/s).
export const MIN_LOG_HASHRATE = 3;
export const MAX_LOG_HASHRATE = 18;

// Orders of magnitude for the "examples" shortcuts, in H/s. `browser` has no fixed
// value: it follows the live hashrate of the visitor's own tab.
export const HASHRATE_PRESETS = [
    { id: 'browser', hashrate: null },
    { id: 'gpu', hashrate: 2e9 }, // a desktop PC with a graphics card
    { id: 'asic', hashrate: 2e14 }, // a recent ASIC miner (~200 TH/s)
    { id: 'farm', hashrate: 2e17 }, // a farm of ~1 000 ASICs
];

// Time horizons for "chance of winning at least once within…".
export const HORIZONS = [
    { id: 'day', seconds: SECONDS_PER_DAY },
    { id: 'month', seconds: 30 * SECONDS_PER_DAY },
    { id: 'year', seconds: SECONDS_PER_YEAR },
    { id: 'decade', seconds: 10 * SECONDS_PER_YEAR },
];

// Reference points that make the numbers tangible.
export const EUROMILLIONS_JACKPOT_ODDS = 139838160; // 1 in 139,838,160
export const UNIVERSE_AGE_YEARS = 13.8e9;
export const WRITTEN_HISTORY_YEARS = 5000;
export const HUMAN_LIFETIME_YEARS = 80;

// What a browser tab typically manages, used where the visitor hasn't measured their own yet.
export const TYPICAL_BROWSER_HASHRATE = 475000;

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// hashrateToSlider / sliderToHashrate convert between H/s and the log slider value.
export function hashrateToSlider(hashrate) {
    if (!(hashrate > 0)) return MIN_LOG_HASHRATE;
    return clamp(Math.log10(hashrate), MIN_LOG_HASHRATE, MAX_LOG_HASHRATE);
}

export function sliderToHashrate(value) {
    return 10 ** clamp(value, MIN_LOG_HASHRATE, MAX_LOG_HASHRATE);
}

// compareToLottery places the daily odds against the EuroMillions jackpot.
//   kind 'less'    → `factor` times less likely
//   kind 'more'    → `factor` times more likely
//   kind 'similar' → roughly as likely
export function compareToLottery(probPerDay) {
    if (!(probPerDay > 0)) return null;
    const ratio = 1 / probPerDay / EUROMILLIONS_JACKPOT_ODDS; // >1 means harder than the lottery
    if (ratio >= 1.5) return { kind: 'less', factor: ratio };
    if (ratio <= 1 / 1.5) return { kind: 'more', factor: 1 / ratio };
    return { kind: 'similar', factor: 1 };
}

// compareToTimescale expresses the expected waiting time against familiar spans.
export function compareToTimescale(expectedSeconds) {
    if (!isFinite(expectedSeconds) || expectedSeconds <= 0) return null;
    const years = expectedSeconds / SECONDS_PER_YEAR;
    const universe = years / UNIVERSE_AGE_YEARS;

    if (universe >= 1) return { kind: 'universeMultiple', value: universe };
    if (universe >= 0.001) return { kind: 'universePercent', value: universe * 100 };
    if (years >= WRITTEN_HISTORY_YEARS) return { kind: 'history', value: years / WRITTEN_HISTORY_YEARS };
    if (years >= HUMAN_LIFETIME_YEARS) return { kind: 'lifetimes', value: years / HUMAN_LIFETIME_YEARS };
    if (years >= 1) return { kind: 'underLifetime', value: years };
    return { kind: 'withinReach', value: years };
}

// simulate computes everything the "Mes chances" screen shows for a hashrate.
export function simulate({ hashrate, networkDifficulty, rewardBTC = DEFAULT_BLOCK_REWARD_BTC, priceUSD = 0 }) {
    const odds = computeOdds(hashrate, networkDifficulty);
    if (!odds.hasData) return { hasData: false };

    const expectedValue = computeExpectedValue({
        probPerDay: odds.probPerDay,
        probPerYear: odds.probPerYear,
        blockRewardBTC: rewardBTC,
        priceUSD,
    });

    return {
        hasData: true,
        hashrate,
        expectedSeconds: odds.expectedSeconds,
        probPerDay: odds.probPerDay,
        usdPerDay: expectedValue.usdPerDay,
        horizons: HORIZONS.map(({ id, seconds }) => ({
            id,
            probability: probabilityWithin(seconds, odds.expectedSeconds),
        })),
        lottery: compareToLottery(odds.probPerDay),
        timescale: compareToTimescale(odds.expectedSeconds),
    };
}
