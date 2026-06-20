import { useState, useEffect, useCallback, useRef } from 'react';
import { demoEngine } from '../demo/engine.js';

// Build-time switch: when VITE_DEMO_MODE=true the hooks talk to the in-browser mining
// engine instead of the Go backend (/ws, /api). When false, behaviour is unchanged.
const DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Custom hook for WebSocket connection to the backend
 * Handles real-time mining statistics updates
 */
export function useWebSocket(url = '/ws') {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const [stats, setStats] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    const handleMessage = useCallback((data) => {
        setLastMessage(data);
        switch (data.type) {
            case 'stats':
                setStats(data.data);
                break;
            case 'share':
                // Could dispatch to a notification system
                break;
            case 'block':
                // New block detected
                break;
            default:
                break;
        }
    }, []);

    const connect = useCallback(() => {
        // Build absolute WebSocket URL
        const wsUrl = url.startsWith('/')
            ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${url}`
            : url;

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);

                // Attempt reconnection after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 3000);
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    handleMessage(JSON.parse(event.data));
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };
        } catch (err) {
            console.error('Failed to create WebSocket:', err);
        }
    }, [url, handleMessage]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
        }
    }, []);

    useEffect(() => {
        if (DEMO) {
            // No socket — subscribe to the local engine's event stream.
            setIsConnected(true);
            const unsubscribe = demoEngine.subscribe(handleMessage);
            return () => unsubscribe();
        }
        connect();
        return () => disconnect();
    }, [connect, disconnect, handleMessage]);

    return {
        isConnected,
        lastMessage,
        stats,
        reconnect: connect,
        disconnect
    };
}

// Parse a ?limit=N query into a number (with a default).
function parseLimit(endpoint, fallback) {
    const match = /[?&]limit=(\d+)/.exec(endpoint);
    return match ? parseInt(match[1], 10) : fallback;
}

// Route a backend-style request to the in-browser demo engine.
async function demoRequest(endpoint, options) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : undefined;
    const path = endpoint.split('?')[0];

    if (path === '/config') {
        return method === 'PUT' ? demoEngine.putConfig(body) : demoEngine.getConfig();
    }
    if (path === '/status') return demoEngine.getStatus();
    if (path === '/stats/reset') return demoEngine.resetStats();
    if (path === '/stats') return demoEngine.buildStatsPayload();
    if (path === '/history') return demoEngine.getHistory(parseLimit(endpoint, 100));
    if (path === '/sessions') return demoEngine.getSessions(parseLimit(endpoint, 50));
    if (path === '/mining/start') return demoEngine.startMining();
    if (path === '/mining/stop') return demoEngine.stopMining();
    if (path === '/workers') {
        if (method === 'POST') return demoEngine.addWorker(body?.name || '');
        return demoEngine.buildStatsPayload().workers;
    }
    if (path.startsWith('/workers/') && method === 'DELETE') {
        const id = parseInt(path.split('/')[2], 10);
        demoEngine.removeWorker(id);
        return { status: 'deleted' };
    }
    throw new Error(`demo: unhandled ${method} ${endpoint}`);
}

/**
 * Custom hook for API calls to the backend
 */
export function useAPI() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const request = useCallback(async (endpoint, options = {}) => {
        setLoading(true);
        setError(null);

        try {
            if (DEMO) {
                const data = await demoRequest(endpoint, options);
                setLoading(false);
                return data;
            }

            const response = await fetch(`/api${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, []);

    const get = useCallback((endpoint) => request(endpoint), [request]);

    const post = useCallback((endpoint, data) =>
        request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        }), [request]);

    const put = useCallback((endpoint, data) =>
        request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        }), [request]);

    const del = useCallback((endpoint) =>
        request(endpoint, {
            method: 'DELETE'
        }), [request]);

    return {
        loading,
        error,
        get,
        post,
        put,
        delete: del
    };
}
