// Human-readable rendering of mining odds. Solo CPU mining lands in the "billions
// of years" range, so these helpers lean on named scales (see bigNumbers.js)
// instead of scientific notation. `t(key, params)` is the i18n translator.
import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from './odds.js';
import { LOCALES, formatBigNumber, formatDecimal, formatInteger } from './bigNumbers.js';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const EMPTY = '—';

// formatDuration renders a span in seconds with the most natural unit:
// "45 s", "12 min", "3,5 h", "120 jours", "5 400 ans", "34,7 milliards d'années".
export function formatDuration(seconds, lang, t) {
    if (!isFinite(seconds) || seconds <= 0) return EMPTY;
    if (seconds < SECONDS_PER_MINUTE) return t('durSeconds', { n: formatInteger(seconds, lang) });
    if (seconds < SECONDS_PER_HOUR) return t('durMinutes', { n: formatInteger(seconds / SECONDS_PER_MINUTE, lang) });
    if (seconds < SECONDS_PER_DAY) return t('durHours', { n: formatDecimal(seconds / SECONDS_PER_HOUR, lang, 1) });
    if (seconds < SECONDS_PER_YEAR) return t('durDays', { n: formatInteger(seconds / SECONDS_PER_DAY, lang) });

    const years = seconds / SECONDS_PER_YEAR;
    if (years < 10) return t('durYears', { n: formatDecimal(years, lang, 1) });
    if (years < 1e6) return t('durYears', { n: formatInteger(years, lang) });
    return t('durYearsBig', { n: formatBigNumber(years, lang) });
}

// formatOneIn renders a probability as "1 in N" odds ("1 sur 12,7 billions").
export function formatOneIn(probability, lang, t) {
    if (!isFinite(probability) || probability <= 0) return EMPTY;
    if (probability >= 1) return t('oddsCertain');
    return t('oddsOneIn', { n: formatBigNumber(1 / probability, lang) });
}

// formatChance picks the friendlier notation: a percentage once the chance is
// at least 1 %, "1 in N" below that.
export function formatChance(probability, lang, t) {
    if (!isFinite(probability) || probability <= 0) return EMPTY;
    if (probability >= 0.01) return t('oddsPercent', { n: formatDecimal(probability * 100, lang, 1) });
    return formatOneIn(probability, lang, t);
}

// formatUsd renders a dollar amount, keeping enough decimals for the vanishingly
// small expectations solo mining produces (down to a billionth of a dollar).
export function formatUsd(value, lang) {
    if (value == null || !isFinite(value) || value <= 0) return EMPTY;
    const locale = LOCALES[lang] || LOCALES.en;
    const MIN_VISIBLE = 1e-9;
    if (value < MIN_VISIBLE) {
        return `< $${MIN_VISIBLE.toLocaleString(locale, { minimumFractionDigits: 9 })}`;
    }
    const fraction = value >= 0.01 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 2, maximumFractionDigits: 9 };
    return `$${value.toLocaleString(locale, fraction)}`;
}

// formatUsdWhole renders a dollar amount rounded to whole dollars ("$307 500"),
// for headline figures such as the value of a block reward.
export function formatUsdWhole(value, lang) {
    if (value == null || !isFinite(value) || value <= 0) return EMPTY;
    return `$${value.toLocaleString(LOCALES[lang] || LOCALES.en, { maximumFractionDigits: 0 })}`;
}
