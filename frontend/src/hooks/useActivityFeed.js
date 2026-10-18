import { useState, useEffect, useRef, useCallback } from 'react';
import { IS_DEMO } from '../config/runtime.js';
import { makeEvent, pushEvent, deriveEvents } from '../lib/activity.js';

// useActivityFeed builds the "what's happening" stream from three sources:
//   1. changes between consecutive stats snapshots (connection, new block, proofs, records);
//   2. WebSocket events (a found block; the backend's own log lines);
//   3. user actions pushed explicitly through the returned `add` function.
// Returns [feed, add] where the feed is newest-first.
export function useActivityFeed({ stats, lastMessage, pool }) {
    const [feed, setFeed] = useState([]);
    const previousStats = useRef(null);

    const add = useCallback((kind, key, params = {}) => {
        setFeed((current) => pushEvent(current, makeEvent(kind, key, params)));
    }, []);

    useEffect(() => {
        if (!stats) return;
        const events = deriveEvents(previousStats.current, stats, { pool });
        previousStats.current = stats;
        if (events.length > 0) {
            setFeed((current) => events.reduce((acc, event) => pushEvent(acc, event), current));
        }
    }, [stats, pool]);

    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'block') {
            const worker = lastMessage.data?.worker_name;
            add('block', worker ? 'feedBlockFound' : 'feedBlockFoundAnon', { worker });
        } else if (!IS_DEMO && lastMessage.type === 'log' && lastMessage.data?.message) {
            // The backend writes its own (already human-readable) log lines.
            add('info', 'raw', { text: lastMessage.data.message });
        }
    }, [lastMessage, add]);

    return [feed, add];
}
