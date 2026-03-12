import { useState, useCallback, useRef } from 'react';

/**
 * Manages Web Worker mining instances.
 * Replaces the Go miner.Manager — all mining computation happens in the browser.
 */
export function useMiningManager() {
    const [workers, setWorkers] = useState([]);
    const [totalHashrate, setTotalHashrate] = useState(0);
    const [totalHashes, setTotalHashes] = useState(0);
    const [bestDifficulty, setBestDifficulty] = useState(0);
    const [shares, setShares] = useState([]);

    const workersRef = useRef(new Map()); // id -> { worker, hashrate, hashCount, name, running }
    const nextIdRef = useRef(1);
    const onShareFoundRef = useRef(null);

    const setOnShareFound = useCallback((cb) => { onShareFoundRef.current = cb; }, []);

    const updateWorkerState = useCallback(() => {
        const list = [];
        let rate = 0;
        let hashes = 0;
        for (const [id, w] of workersRef.current) {
            list.push({
                id,
                name: w.name,
                running: w.running,
                hashrate: w.hashrate,
                hashCount: w.hashCount
            });
            rate += w.hashrate;
            hashes += w.hashCount;
        }
        list.sort((a, b) => a.id - b.id);
        setWorkers(list);
        setTotalHashrate(rate);
        setTotalHashes(hashes);
    }, []);

    const addWorker = useCallback((extranonce1, extranonce2Size, currentJob, throttle) => {
        const id = nextIdRef.current++;
        const name = `Worker ${String.fromCharCode(64 + id)}`;
        const worker = new Worker('/js/mining-worker.js');

        const wData = {
            worker,
            name,
            running: false,
            hashrate: 0,
            hashCount: 0
        };

        worker.onmessage = (e) => {
            const msg = e.data;
            switch (msg.type) {
                case 'hashrate':
                    wData.hashrate = msg.hashrate;
                    wData.hashCount = msg.hashCount;
                    updateWorkerState();
                    break;
                case 'shareFound':
                    setShares(prev => [...prev, {
                        timestamp: new Date().toISOString(),
                        workerId: id,
                        workerName: name,
                        ...msg
                    }]);
                    if (onShareFoundRef.current) {
                        onShareFoundRef.current(msg);
                    }
                    break;
                case 'bestDifficulty':
                    setBestDifficulty(prev => Math.max(prev, msg.difficulty));
                    break;
                case 'status':
                    wData.running = msg.running;
                    updateWorkerState();
                    break;
            }
        };

        workersRef.current.set(id, wData);

        // Configure and start
        worker.postMessage({ type: 'configure', extranonce1, extranonce2Size });
        if (throttle) {
            worker.postMessage({ type: 'setThrottle', ...throttle });
        }
        if (currentJob) {
            worker.postMessage({ type: 'newJob', job: currentJob });
        }
        worker.postMessage({ type: 'start' });

        updateWorkerState();
        return id;
    }, [updateWorkerState]);

    const removeWorker = useCallback((id) => {
        const w = workersRef.current.get(id);
        if (w) {
            w.worker.postMessage({ type: 'stop' });
            w.worker.terminate();
            workersRef.current.delete(id);
            updateWorkerState();
        }
    }, [updateWorkerState]);

    const startAll = useCallback((extranonce1, extranonce2Size, numWorkers, currentJob, throttle) => {
        // Create initial workers
        for (let i = 0; i < numWorkers; i++) {
            addWorker(extranonce1, extranonce2Size, currentJob, throttle);
        }
    }, [addWorker]);

    const stopAll = useCallback(() => {
        for (const [id, w] of workersRef.current) {
            w.worker.postMessage({ type: 'stop' });
            w.worker.terminate();
        }
        workersRef.current.clear();
        nextIdRef.current = 1;
        setWorkers([]);
        setTotalHashrate(0);
        setTotalHashes(0);
    }, []);

    const broadcastJob = useCallback((job) => {
        for (const [, w] of workersRef.current) {
            w.worker.postMessage({ type: 'newJob', job });
        }
    }, []);

    const setThrottle = useCallback((batchSize, sleepMs) => {
        for (const [, w] of workersRef.current) {
            w.worker.postMessage({ type: 'setThrottle', batchSize, sleepMs });
        }
    }, []);

    return {
        workers,
        totalHashrate,
        totalHashes,
        bestDifficulty,
        shares,
        addWorker,
        removeWorker,
        startAll,
        stopAll,
        broadcastJob,
        setThrottle,
        setOnShareFound
    };
}

/**
 * Maps CPU percentage to Web Worker throttle parameters.
 */
export function cpuToThrottle(cpuPercent) {
    if (cpuPercent >= 100) return { batchSize: 10000, sleepMs: 0 };
    if (cpuPercent >= 80) return { batchSize: 5000, sleepMs: 1 };
    if (cpuPercent >= 60) return { batchSize: 3000, sleepMs: 3 };
    if (cpuPercent >= 40) return { batchSize: 2000, sleepMs: 5 };
    if (cpuPercent >= 20) return { batchSize: 1000, sleepMs: 10 };
    return { batchSize: 500, sleepMs: 20 };
}
