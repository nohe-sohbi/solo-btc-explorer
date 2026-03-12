import { useState, useCallback } from 'react';

const STORAGE_KEY = 'soloforge-stats';

function loadStats() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load stats from localStorage:', e);
    }
    return {
        totalShares: 0,
        acceptedShares: 0,
        bestDifficulty: 0,
        shareHistory: [],
        sessionHistory: []
    };
}

function saveStats(stats) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('Failed to save stats to localStorage:', e);
    }
}

/**
 * Persists mining statistics in localStorage.
 * Replaces the Go stats.Collector.
 */
export function useLocalStats() {
    const [stats, setStats] = useState(loadStats);

    const addShare = useCallback((share) => {
        setStats(prev => {
            const entry = {
                timestamp: new Date().toISOString(),
                worker_id: share.workerId || 0,
                worker_name: share.workerName || 'Worker',
                job_id: share.jobId || '',
                nonce: share.nonce || '',
                difficulty: share.difficulty || 0,
                accepted: true
            };

            const newHistory = [...prev.shareHistory, entry];
            if (newHistory.length > 200) newHistory.splice(0, newHistory.length - 200);

            const newStats = {
                ...prev,
                totalShares: prev.totalShares + 1,
                acceptedShares: prev.acceptedShares + 1,
                bestDifficulty: Math.max(prev.bestDifficulty, entry.difficulty),
                shareHistory: newHistory
            };
            saveStats(newStats);
            return newStats;
        });
    }, []);

    const startSession = useCallback(() => {
        // Session start is tracked locally (no-op for storage)
        return { startTime: new Date().toISOString() };
    }, []);

    const endSession = useCallback((session, totalHashes, bestDiff) => {
        if (!session) return;
        setStats(prev => {
            const endTime = new Date();
            const startTime = new Date(session.startTime);
            const durationMs = endTime - startTime;
            const durationStr = formatDuration(durationMs);

            const entry = {
                id: endTime.toISOString(),
                start_time: session.startTime,
                end_time: endTime.toISOString(),
                duration: durationStr,
                total_hashes: totalHashes || 0,
                best_difficulty: bestDiff || 0
            };

            const newSessions = [...prev.sessionHistory, entry];
            if (newSessions.length > 50) newSessions.splice(0, newSessions.length - 50);

            const newStats = {
                ...prev,
                sessionHistory: newSessions
            };
            saveStats(newStats);
            return newStats;
        });
    }, []);

    const getShareHistory = useCallback(() => {
        return [...stats.shareHistory].reverse();
    }, [stats.shareHistory]);

    const getSessionHistory = useCallback(() => {
        return [...stats.sessionHistory].reverse();
    }, [stats.sessionHistory]);

    return {
        stats,
        addShare,
        startSession,
        endSession,
        getShareHistory,
        getSessionHistory
    };
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h${m}m${s}s`;
    if (m > 0) return `${m}m${s}s`;
    return `${s}s`;
}
