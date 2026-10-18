// Locale-aware number formatting, including the named large-number scales used to
// make astronomical odds readable ("12,7 billions" / "12.7 trillion").
//
// French uses the long scale (1e9 = milliard, 1e12 = billion) while English uses
// the short scale (1e9 = billion, 1e12 = trillion). Mixing them up would be wrong
// by three orders of magnitude, so each language carries its own table.

export const LOCALES = { fr: 'fr-FR', en: 'en-US' };

const SCALES = {
    fr: [
        [1e21, 'trilliard'],
        [1e18, 'trillion'],
        [1e15, 'billiard'],
        [1e12, 'billion'],
        [1e9, 'milliard'],
        [1e6, 'million'],
    ],
    en: [
        [1e21, 'sextillion'],
        [1e18, 'quintillion'],
        [1e15, 'quadrillion'],
        [1e12, 'trillion'],
        [1e9, 'billion'],
        [1e6, 'million'],
    ],
};

// Only French pluralises these words ("2 millions"); English keeps them invariant.
const PLURALISES = { fr: true, en: false };

function localeOf(lang) {
    return LOCALES[lang] || LOCALES.en;
}

// formatInteger renders a whole number with the locale's digit grouping.
export function formatInteger(n, lang) {
    return Math.round(n).toLocaleString(localeOf(lang));
}

// formatDecimal renders a number with at most `maxFractionDigits` decimals.
export function formatDecimal(n, lang, maxFractionDigits = 1) {
    return n.toLocaleString(localeOf(lang), { maximumFractionDigits: maxFractionDigits });
}

// formatBigNumber renders n with a named scale once it reaches a million:
// 12.7e12 -> "12,7 billions" (fr) / "12.7 trillion" (en). Smaller values are
// plain grouped integers.
export function formatBigNumber(n, lang) {
    const scales = SCALES[lang] || SCALES.en;
    for (const [threshold, word] of scales) {
        if (n >= threshold) {
            const scaled = n / threshold;
            const text = formatDecimal(scaled, lang, scaled < 100 ? 1 : 0);
            const plural = PLURALISES[lang] && scaled >= 2 ? 's' : '';
            return `${text} ${word}${plural}`;
        }
    }
    return formatInteger(n, lang);
}
