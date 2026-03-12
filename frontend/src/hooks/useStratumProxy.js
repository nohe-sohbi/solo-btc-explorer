import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook to communicate with the Stratum pool through the backend WebSocket proxy.
 * Speaks raw Stratum JSON-RPC — the proxy simply relays bytes.
 */
export function useStratumProxy() {
    const [connected, setConnected] = useState(false);
    const [poolConnected, setPoolConnected] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [extranonce1, setExtranonce1] = useState('');
    const [extranonce2Size, setExtranonce2Size] = useState(4);
    const [currentJob, setCurrentJob] = useState(null);
    const [difficulty, setDifficulty] = useState(1);

    const wsRef = useRef(null);
    const requestIdRef = useRef(0);
    const callbacksRef = useRef({});

    // Callbacks that the consumer can set
    const onJobRef = useRef(null);
    const onLogRef = useRef(null);

    const setOnJob = useCallback((cb) => { onJobRef.current = cb; }, []);
    const setOnLog = useCallback((cb) => { onLogRef.current = cb; }, []);

    const nextId = useCallback(() => {
        requestIdRef.current++;
        return requestIdRef.current;
    }, []);

    const sendStratum = useCallback((method, params) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return null;
        const id = nextId();
        const msg = JSON.stringify({ id, method, params });
        wsRef.current.send(msg);
        return id;
    }, [nextId]);

    const handleMessage = useCallback((data) => {
        // Proxy status message (not Stratum)
        if (data.type === 'proxy_status') {
            setPoolConnected(data.connected);
            if (!data.connected && data.error) {
                if (onLogRef.current) onLogRef.current(`Pool connection failed: ${data.error}`, 'var(--error)');
            } else if (data.connected) {
                if (onLogRef.current) onLogRef.current('Connected to pool via proxy', 'var(--success)');
            }
            return;
        }

        // Stratum response (has id)
        if (data.id !== undefined && data.id !== null) {
            // Subscribe response (id=1): result = [[...], extranonce1, extranonce2_size]
            if (data.id === 1 && data.result && !data.error) {
                const result = data.result;
                if (Array.isArray(result) && result.length >= 3) {
                    setExtranonce1(result[1]);
                    setExtranonce2Size(result[2]);
                    if (onLogRef.current) onLogRef.current(`Subscribed (extranonce1: ${result[1]}, size: ${result[2]})`, 'var(--info)');
                }
            }

            // Authorize response (id=2)
            if (data.id === 2 && !data.error) {
                setAuthorized(data.result === true);
                if (data.result === true) {
                    if (onLogRef.current) onLogRef.current('Authorized with pool', 'var(--success)');
                } else {
                    if (onLogRef.current) onLogRef.current('Authorization rejected by pool', 'var(--error)');
                }
            }

            // Submit response
            if (data.id >= 3 && !data.error) {
                if (data.result === true) {
                    if (onLogRef.current) onLogRef.current('Share accepted by pool!', 'var(--success)');
                }
            }
            return;
        }

        // Stratum notification (has method)
        if (data.method) {
            if (data.method === 'mining.notify') {
                const p = data.params;
                if (Array.isArray(p) && p.length >= 9) {
                    const job = {
                        id: p[0],
                        prevHash: p[1],
                        coinbase1: p[2],
                        coinbase2: p[3],
                        merkleBranch: p[4],
                        version: p[5],
                        nbits: p[6],
                        ntime: p[7],
                        cleanJobs: p[8]
                    };
                    setCurrentJob(job);
                    if (onJobRef.current) onJobRef.current(job);
                    if (onLogRef.current) onLogRef.current(`New job: ${job.id.substring(0, 16)}...`, 'var(--info)');
                }
            }

            if (data.method === 'mining.set_difficulty') {
                if (Array.isArray(data.params) && data.params.length > 0) {
                    setDifficulty(data.params[0]);
                    if (onLogRef.current) onLogRef.current(`Pool difficulty set to ${data.params[0]}`, 'var(--warning)');
                }
            }
        }
    }, []);

    const connect = useCallback(() => {
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/stratum`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setConnected(true);
            requestIdRef.current = 0;
        };

        ws.onclose = () => {
            setConnected(false);
            setPoolConnected(false);
            setAuthorized(false);
            setCurrentJob(null);
        };

        ws.onerror = (err) => {
            console.error('Stratum proxy WebSocket error:', err);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (err) {
                console.error('Failed to parse stratum message:', err);
            }
        };

        wsRef.current = ws;
    }, [handleMessage]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
        setPoolConnected(false);
        setAuthorized(false);
        setCurrentJob(null);
        requestIdRef.current = 0;
    }, []);

    const subscribe = useCallback(() => {
        sendStratum('mining.subscribe', []);
    }, [sendStratum]);

    const authorize = useCallback((wallet) => {
        sendStratum('mining.authorize', [wallet, 'x']);
    }, [sendStratum]);

    const submitShare = useCallback((wallet, jobId, extranonce2, ntime, nonce) => {
        sendStratum('mining.submit', [wallet, jobId, extranonce2, ntime, nonce]);
    }, [sendStratum]);

    // Cleanup on unmount
    useEffect(() => {
        return () => disconnect();
    }, [disconnect]);

    return {
        connected,
        poolConnected,
        authorized,
        extranonce1,
        extranonce2Size,
        currentJob,
        difficulty,
        connect,
        disconnect,
        subscribe,
        authorize,
        submitShare,
        setOnJob,
        setOnLog
    };
}
