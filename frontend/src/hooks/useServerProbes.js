import { useState, useEffect } from 'react';

const POLL_MS = 10000;

// Probe results: 'checking' until the first answer, then 'ok' / 'down'.
const INITIAL = { health: 'checking', ready: 'checking' };

async function probe(path) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        return response.ok ? 'ok' : 'down';
    } catch {
        return 'down';
    }
}

// useServerProbes polls the backend's liveness (/healthz) and readiness (/readyz)
// endpoints while `enabled`. The readiness probe answers non-200 until the pool
// connection is authorized, which is reported as 'down' here.
export function useServerProbes(enabled) {
    const [probes, setProbes] = useState(INITIAL);

    useEffect(() => {
        if (!enabled) return undefined;

        let cancelled = false;
        const poll = async () => {
            const [health, ready] = await Promise.all([probe('/healthz'), probe('/readyz')]);
            if (!cancelled) setProbes({ health, ready });
        };
        poll();
        const timer = setInterval(poll, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [enabled]);

    return probes;
}
