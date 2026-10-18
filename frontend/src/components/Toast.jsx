import { useEffect } from 'react';

const DISPLAY_MS = 4000;

// A short confirmation or error message. It dismisses itself; `onClose` must be
// stable (wrapped in useCallback) or the timer restarts on every render.
export default function Toast({ message, tone = 'success', onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, DISPLAY_MS);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast toast--${tone}`} role="status">
            {message}
        </div>
    );
}
