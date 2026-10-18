// Helpers shared by the formatting tests.

// Intl groups digits with narrow no-break spaces in French; normalise every kind
// of non-breaking space to a plain one so assertions stay readable.
export const plain = (text) => text.replace(/[\u202f\u00a0]/g, ' ');
