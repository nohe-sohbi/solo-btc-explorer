import { Fragment } from 'react';

// Renders a translated string where **double asterisks** mark emphasis. Splitting
// on the marker keeps everything as React text nodes (no HTML injection), and the
// i18n test guarantees the markers are always paired.
export default function Rich({ text }) {
    return text.split('**').map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>
    );
}
