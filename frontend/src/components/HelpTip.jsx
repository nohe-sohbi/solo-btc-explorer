import { useState, useEffect, useRef, useId } from 'react';

// A "?" button that discloses a short explanation of a technical term. Closes on
// Escape or a click elsewhere, and works with keyboard and touch (unlike a title
// attribute).
export default function HelpTip({ term, text, t }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const popoverId = useId();

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <span className="help-tip" ref={rootRef}>
            <button
                type="button"
                className="help-tip__button"
                aria-label={t('helpAria', { term })}
                aria-expanded={open}
                aria-controls={open ? popoverId : undefined}
                onClick={() => setOpen((value) => !value)}
            >
                ?
            </button>
            {open && (
                <span id={popoverId} role="note" className="help-tip__popover">
                    {text}
                </span>
            )}
        </span>
    );
}
