import { useEffect } from 'react';

const DISPLAY_MS = 4000;
const DISPLAY_WITH_ACTION_MS = 8000; // long enough to notice and use the action

// A short confirmation or error message, optionally with one action (e.g. "Undo").
// It dismisses itself; `onClose` must be stable (wrapped in useCallback) or the
// timer restarts on every render.
export default function Toast({ message, tone = 'success', action, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, action ? DISPLAY_WITH_ACTION_MS : DISPLAY_MS);
        return () => clearTimeout(timer);
    }, [onClose, action]);

    const runAction = () => {
        action.onClick();
        onClose();
    };

    return (
        <div className={`toast toast--${tone}`} role="status">
            <span>{message}</span>
            {action && (
                <button type="button" className="toast__action" onClick={runAction}>
                    {action.label}
                </button>
            )}
        </div>
    );
}
