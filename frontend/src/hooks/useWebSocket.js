import { useState, useEffect, useCallback, useRef } from 'react';

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
                    const data = JSON.parse(event.data);
                    setLastMessage(data);

                    // Handle different event types
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
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };
        } catch (err) {
            console.error('Failed to create WebSocket:', err);
        }
    }, [url]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
        }
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        isConnected,
        lastMessage,
        stats,
        reconnect: connect,
        disconnect
    };
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
