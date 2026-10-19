import { useState, useEffect } from 'react';

// Browsers throttle timers (and the demo's compute loops) in background tabs. If
// the tab was hidden for at least this long while mining, the speed curve shows a
// dip, so we explain it once the user is back.
const MIN_HIDDEN_MS = 3000;
const AUTO_DISMISS_MS = 12000;

// useBackgroundNotice reports whether to show the "computation was slowed down"
// notice. `active` should be true only while mining runs in this tab.
export function useBackgroundNotice(active) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!active) return undefined;

        let hiddenAt = null;
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now();
            } else if (hiddenAt !== null) {
                if (Date.now() - hiddenAt >= MIN_HIDDEN_MS) setVisible(true);
                hiddenAt = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [active]);

    useEffect(() => {
        if (!visible) return undefined;
        const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [visible]);

    return { visible: visible && active };
}
