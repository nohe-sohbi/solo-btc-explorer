import { Fragment } from 'react';

// Renders a translated string with two inline markers: **double asterisks** for
// emphasis and `backticks` for a figure or formula set in the monospace font.
// Splitting on the markers keeps everything as React text nodes (no HTML
// injection), and the i18n test guarantees the markers are always paired.
function withCode(text, keyPrefix) {
    return text.split('`').map((part, index) =>
        index % 2 === 1 ? <code key={`${keyPrefix}-${index}`}>{part}</code> : <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
    );
}

export default function Rich({ text }) {
    return text.split('**').map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{withCode(part, index)}</strong> : <Fragment key={index}>{withCode(part, index)}</Fragment>
    );
}
