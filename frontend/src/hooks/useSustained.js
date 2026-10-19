import { useState, useEffect } from 'react';

// useSustained is true only once `condition` has held continuously for `delayMs`.
// It filters out blips (e.g. the second a pool connection takes to establish right
// after starting) so a banner doesn't flash for a transient state.
export function useSustained(condition, delayMs) {
    const [sustained, setSustained] = useState(false);

    useEffect(() => {
        if (!condition) {
            setSustained(false);
            return undefined;
        }
        const timer = setTimeout(() => setSustained(true), delayMs);
        return () => clearTimeout(timer);
    }, [condition, delayMs]);

    return sustained;
}
