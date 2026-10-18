import { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// An accessible modal: it takes focus when opened, keeps Tab inside, closes on
// Escape or a click on the backdrop, locks page scroll, and hands focus back to
// whatever opened it. `role="alertdialog"` is for confirmations of destructive
// actions.
export default function Dialog({ title, eyebrow, closeLabel, onClose, role = 'dialog', art, children }) {
    const titleId = useId();
    const dialogRef = useRef(null);

    useEffect(() => {
        const opener = document.activeElement;
        dialogRef.current?.focus();
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
            opener?.focus?.();
        };
    }, []);

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab') return;

        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <div
            className="dialog-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                className="dialog"
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
            >
                {art}
                <button type="button" className="dialog__close" aria-label={closeLabel} onClick={onClose}>
                    <Icon name="close" size={18} />
                </button>
                <div className="dialog__body">
                    {eyebrow && <div className="dialog__eyebrow">{eyebrow}</div>}
                    <h2 id={titleId} className="dialog__title">
                        {title}
                    </h2>
                    {children}
                </div>
            </div>
        </div>
    );
}
