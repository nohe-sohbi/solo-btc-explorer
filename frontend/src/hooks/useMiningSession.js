import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebSocket, useAPI } from './useWebSocket.js';
import { useActivityFeed } from './useActivityFeed.js';
import { useSustained } from './useSustained.js';
import { IS_DEMO } from '../config/runtime.js';
import { checkWallet } from '../lib/walletCheck.js';
import { appendSample } from '../lib/series.js';
import { track } from '../lib/analytics.js';
import { FALLBACK_NETWORK_DIFFICULTY, DEFAULT_BLOCK_REWARD_BTC } from '../lib/odds.js';

const POLL_MS = 5000;
const HISTORY_LIMIT = 50;
// A pool or server connection must stay down this long before we warn about it:
// right after starting, the pool legitimately needs a moment to connect.
const OUTAGE_DELAY_MS = 4000;
// From this CPU limit up, suggest backing off.
export const HIGH_CPU_PERCENT = 90;
export const SUGGESTED_CPU_PERCENT = 60;

const DEFAULT_CONFIG = {
    pool_url: 'solo.ckpool.org',
    pool_port: 3333,
    wallet_address: '',
    max_cpu_percent: 80,
    num_workers: 1,
};

// useMiningSession is the single owner of everything the screens need to know about
// the mining session — live stats, configuration, history, derived connection state
// — and of every action that changes it. It talks to the Go backend, or to the
// in-browser demo engine, through the same hooks.
//
// `notify(message, tone)` shows a toast; `t` is the translator (used for messages).
export function useMiningSession({ notify, t }) {
    const { isConnected: socketOpen, stats, lastMessage, reconnect } = useWebSocket();
    const { get, post, put, delete: remove } = useAPI();

    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [running, setRunning] = useState(false);
    const [history, setHistory] = useState({ shares: [], blocks: [] });
    const [sessions, setSessions] = useState([]);
    const [samples, setSamples] = useState([]);
    const [foundBlock, setFoundBlock] = useState(null);
    const [loaded, setLoaded] = useState(false); // first status answer received (or failed)

    const pool = `${config.pool_url}:${config.pool_port}`;
    const [feed, addFeedEvent] = useActivityFeed({ stats, lastMessage, pool });

    // ----- Loading and polling -----
    useEffect(() => {
        get('/config').then(setConfig).catch(() => {
            // Keep the defaults; the connection banners explain an unreachable server.
        });
    }, [get]);

    const refresh = useCallback(async () => {
        try {
            const [status, data, sessionList] = await Promise.all([
                get('/status'),
                get(`/history?limit=${HISTORY_LIMIT}`),
                get(`/sessions?limit=${HISTORY_LIMIT}`),
            ]);
            setRunning(Boolean(status?.running));
            setHistory({ shares: data?.shares || [], blocks: data?.blocks || [] });
            setSessions(sessionList || []);
        } catch {
            // The next poll retries.
        } finally {
            setLoaded(true);
        }
    }, [get]);

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        return () => clearInterval(timer);
    }, [refresh]);

    // ----- Live samples for the speed chart -----
    useEffect(() => {
        if (running && stats && typeof stats.hashrate === 'number') {
            setSamples((current) => appendSample(current, stats.hashrate));
        }
    }, [stats, running]);

    // ----- A block candidate was found -----
    useEffect(() => {
        if (lastMessage?.type !== 'block') return;
        setFoundBlock({
            timestamp: lastMessage.timestamp || Date.now(),
            height: stats?.block_height,
            ...lastMessage.data,
        });
        // Only the arrival of a new message should open the dialog, not later stats.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastMessage]);

    // ----- Session length (stats.uptime_seconds is cumulative across sessions) -----
    const uptimeAtStart = useRef(0);
    const wasRunning = useRef(false);
    useEffect(() => {
        if (running && !wasRunning.current) uptimeAtStart.current = stats?.uptime_seconds || 0;
        wasRunning.current = running;
        // Capture the baseline only when `running` flips on.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running]);
    const sessionSeconds = Math.max(0, (stats?.uptime_seconds || 0) - uptimeAtStart.current);

    // ----- Actions -----
    const saveConfig = useCallback(
        async (next, { silent = false } = {}) => {
            try {
                await put('/config', next);
                setConfig(next);
                track('save_config');
                if (!silent) {
                    notify(t('toastConfigSaved'), 'success');
                    addFeedEvent('success', 'feedConfigSaved');
                }
                return true;
            } catch {
                notify(t('toastConfigFailed'), 'error');
                return false;
            }
        },
        [put, notify, t, addFeedEvent]
    );

    // start begins mining with `wallet` (or the saved address). The address is
    // validated first and saved if it changed; returns whether mining started.
    const start = useCallback(
        async (wallet) => {
            const address = (wallet ?? config.wallet_address ?? '').trim();
            if (checkWallet(address).status !== 'valid') return false;

            try {
                if (address !== config.wallet_address) {
                    await put('/config', { ...config, wallet_address: address });
                    setConfig((current) => ({ ...current, wallet_address: address }));
                }
                setSamples([]);
                await post('/mining/start', {});
                setRunning(true);
                addFeedEvent('success', 'feedMiningStarted');
                track('start_mining', { workers: config.num_workers, cpu: config.max_cpu_percent });
                return true;
            } catch {
                notify(t('toastStartFailed'), 'error');
                return false;
            }
        },
        [config, put, post, notify, t, addFeedEvent]
    );

    const stop = useCallback(async () => {
        try {
            await post('/mining/stop', {});
            setRunning(false);
            addFeedEvent('info', 'feedMiningStopped');
            track('stop_mining');
            refresh(); // pick up the session that was just recorded
        } catch {
            notify(t('toastStartFailed'), 'error');
        }
    }, [post, notify, t, addFeedEvent, refresh]);

    const addWorker = useCallback(async () => {
        try {
            await post('/workers', { name: '' });
            addFeedEvent('info', 'feedWorkerAdded');
            track('add_worker');
        } catch {
            notify(t('toastWorkerFailed'), 'error');
        }
    }, [post, notify, t, addFeedEvent]);

    const removeWorker = useCallback(
        async (id) => {
            try {
                await remove(`/workers/${id}`);
                addFeedEvent('info', 'feedWorkerRemoved');
            } catch {
                notify(t('toastWorkerFailed'), 'error');
            }
        },
        [remove, notify, t, addFeedEvent]
    );

    const resetStats = useCallback(async () => {
        try {
            await post('/stats/reset', {});
            setHistory({ shares: [], blocks: [] });
            setSessions([]);
            setSamples([]);
            addFeedEvent('info', 'feedStatsReset');
            notify(t('toastResetDone'), 'success');
            track('reset_stats');
            return true;
        } catch {
            notify(t('toastResetFailed'), 'error');
            return false;
        }
    }, [post, notify, t, addFeedEvent]);

    // Asks the demo engine to fetch the current Bitcoin block again.
    const retryNetworkBlock = useCallback(() => post('/network/refresh', {}).catch(() => {}), [post]);

    const dismissFoundBlock = useCallback(() => setFoundBlock(null), []);

    // ----- Derived state -----
    const workers = useMemo(() => [...(stats?.workers || [])].sort((a, b) => a.id - b.id), [stats]);

    const serverReachable = IS_DEMO || socketOpen;
    const poolConnected = Boolean(stats?.connected);
    const poolLost = useSustained(serverReachable && running && stats != null && !poolConnected, OUTAGE_DELAY_MS);
    const serverLost = useSustained(!serverReachable, OUTAGE_DELAY_MS);

    const connection = useMemo(() => {
        if (!serverReachable) return { tone: 'error', labelKey: 'sideServerLost' };
        if (running && poolConnected) return { tone: 'ok', labelKey: 'sideConnected' };
        if (running) return { tone: 'warn', labelKey: 'statusReconnecting' };
        return { tone: 'idle', labelKey: 'sideIdle' };
    }, [serverReachable, running, poolConnected]);

    const network = useMemo(
        () => ({
            difficulty: stats?.network_difficulty > 0 ? stats.network_difficulty : FALLBACK_NETWORK_DIFFICULTY,
            difficultyKnown: stats?.network_difficulty > 0,
            rewardBTC: stats?.block_reward_btc > 0 ? stats.block_reward_btc : DEFAULT_BLOCK_REWARD_BTC,
            priceUSD: stats?.btc_price_usd > 0 ? stats.btc_price_usd : 0,
            height: stats?.block_height || 0,
            hashrate: stats?.network_hashrate || 0,
        }),
        [stats]
    );

    return {
        loaded,
        stats,
        config,
        running,
        workers,
        history,
        sessions,
        samples,
        feed,
        foundBlock,
        network,
        pool,
        sessionSeconds,
        connection,
        poolLost,
        serverLost,
        blockFallback: IS_DEMO && stats?.block_source === 'fallback',
        cpuHigh: running && config.max_cpu_percent >= HIGH_CPU_PERCENT,
        actions: {
            start,
            stop,
            saveConfig,
            addWorker,
            removeWorker,
            resetStats,
            retryNetworkBlock,
            reconnect,
            dismissFoundBlock,
        },
    };
}
