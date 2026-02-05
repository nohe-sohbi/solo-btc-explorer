import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket, useAPI } from './hooks/useWebSocket';
import { translations } from './translations';

// =============================================================================
// HOOK: useTranslation
// =============================================================================
function useTranslation(lang) {
    const t = useCallback((key) => {
        return translations[lang]?.[key] || translations.en[key] || key;
    }, [lang]);
    return t;
}

// =============================================================================
// COMPONENT: ThemeToggle
// =============================================================================
function ThemeToggle({ theme, onToggle }) {
    return (
        <button
            className="btn btn--secondary btn--icon"
            onClick={onToggle}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            style={{ fontSize: '1.2rem' }}
        >
            {theme === 'dark' ? '☀️' : '🌙'}
        </button>
    );
}

// =============================================================================
// COMPONENT: LanguageToggle (shows current language)
// =============================================================================
function LanguageToggle({ lang, onToggle }) {
    return (
        <button
            className="btn btn--secondary"
            onClick={onToggle}
            style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: 'var(--space-2) var(--space-3)',
                minWidth: '60px'
            }}
        >
            {lang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </button>
    );
}

// =============================================================================
// COMPONENT: Toast notification
// =============================================================================
function Toast({ message, type, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success' ? 'var(--success)' :
        type === 'error' ? 'var(--error)' : 'var(--info)';

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: 'var(--space-3) var(--space-5)',
            background: bgColor,
            color: 'white',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease',
            fontWeight: 500
        }}>
            {message}
        </div>
    );
}

// =============================================================================
// COMPONENT: StatCard with animation
// =============================================================================
function StatCard({ icon, label, value, unit, variant = 'default', subtitle, tooltip }) {
    const [displayValue, setDisplayValue] = useState(value);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (value !== displayValue) {
            setIsAnimating(true);
            setDisplayValue(value);
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
    }, [value, displayValue]);

    return (
        <div
            className={`glass-card stat-card ${variant === 'gold' ? 'glass-card--gold' : ''}`}
            title={tooltip}
        >
            <div className="stat-card__header">
                <div className="stat-card__icon">
                    <img src={icon} alt={label} />
                </div>
                <span className="stat-card__label">{label}</span>
            </div>
            <div className="stat-card__value-wrapper">
                <span
                    className={`stat-card__value ${variant === 'gold' ? 'stat-card__value--gold' : ''}`}
                    style={{
                        transition: 'transform 0.2s ease',
                        transform: isAnimating ? 'scale(1.05)' : 'scale(1)'
                    }}
                >
                    {displayValue}
                </span>
                {unit && <span className="stat-card__unit">{unit}</span>}
            </div>
            {subtitle && (
                <div className="stat-card__subtitle" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'calc(-1 * var(--space-2))' }}>
                    {subtitle}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// COMPONENT: LiveLog
// =============================================================================
function LiveLog({ logs, t }) {
    const logRef = useRef(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="glass-card panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 className="panel__title">{t('liveActivity')}</h3>
            <div
                ref={logRef}
                style={{
                    flex: 1,
                    minHeight: '250px',
                    maxHeight: '350px',
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    padding: 'var(--space-2)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)'
                }}
            >
                {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                        {t('startMiningToSee')}
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div
                            key={index}
                            style={{
                                padding: 'var(--space-1) 0',
                                borderBottom: '1px solid var(--glass-border)',
                                animation: index === logs.length - 1 ? 'fadeIn 0.3s ease' : 'none'
                            }}
                        >
                            <span style={{ color: 'var(--text-muted)' }}>[{log.time}]</span>{' '}
                            <span style={{ color: log.color || 'var(--text-secondary)' }}>{log.message}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// =============================================================================
// COMPONENT: WorkerCard
// =============================================================================
function WorkerCard({ worker, onRemove, t }) {
    const formatHashrate = (hash) => {
        if (hash >= 1e9) return `${(hash / 1e9).toFixed(2)} GH/s`;
        if (hash >= 1e6) return `${(hash / 1e6).toFixed(2)} MH/s`;
        if (hash >= 1e3) return `${(hash / 1e3).toFixed(2)} KH/s`;
        return `${hash.toFixed(2)} H/s`;
    };

    return (
        <div className="worker-card">
            <div className="worker-card__info">
                <span className={`status ${worker.running ? 'status--online' : 'status--offline'}`}>
                    <span className="status__dot"></span>
                    {worker.running ? t('active') : t('stopped')}
                </span>
                <span className="worker-card__name">{worker.name}</span>
                <span className="worker-card__hashrate font-mono">
                    {formatHashrate(worker.hashrate || 0)}
                </span>
            </div>
            <div className="worker-card__actions">
                <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => onRemove(worker.id)}
                    title="Remove"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// COMPONENT: SettingsPanel with save feedback
// =============================================================================
function SettingsPanel({ config, onSave, isMining, t, showToast }) {
    const [localConfig, setLocalConfig] = useState(config);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleChange = (key, value) => {
        setLocalConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(localConfig);
        setIsSaving(false);
    };

    return (
        <div className="glass-card panel">
            <h3 className="panel__title">{t('configTitle')}</h3>

            <div className="panel__row">
                <div className="input-group">
                    <label className="input-group__label">{t('walletAddress')}</label>
                    <input
                        type="text"
                        className="input"
                        placeholder={t('walletPlaceholder')}
                        value={localConfig.wallet_address || ''}
                        onChange={(e) => handleChange('wallet_address', e.target.value)}
                        disabled={isMining}
                    />
                </div>
            </div>

            <div className="panel__row">
                <div className="input-group">
                    <label className="input-group__label">{t('poolUrl')}</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="solo.ckpool.org"
                        value={localConfig.pool_url || ''}
                        onChange={(e) => handleChange('pool_url', e.target.value)}
                        disabled={isMining}
                    />
                </div>
            </div>

            <div className="panel__row">
                <div className="input-group">
                    <label className="input-group__label">{t('poolPort')}</label>
                    <input
                        type="number"
                        className="input"
                        placeholder="3333"
                        value={localConfig.pool_port || 3333}
                        onChange={(e) => handleChange('pool_port', parseInt(e.target.value))}
                        disabled={isMining}
                    />
                </div>
            </div>

            <div className="panel__row">
                <div className="slider-group">
                    <div className="slider-group__header">
                        <label className="slider-group__label">{t('cpuLimit')}</label>
                        <span className="slider-group__value">{localConfig.max_cpu_percent || 80}%</span>
                    </div>
                    <input
                        type="range"
                        className="slider"
                        min="10"
                        max="100"
                        step="5"
                        value={localConfig.max_cpu_percent || 80}
                        onChange={(e) => handleChange('max_cpu_percent', parseInt(e.target.value))}
                    />
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                        {t('cpuLimitHelp')}
                    </div>
                </div>
            </div>

            <div className="panel__row">
                <div className="slider-group">
                    <div className="slider-group__header">
                        <label className="slider-group__label">{t('initialWorkers')}</label>
                        <span className="slider-group__value">{localConfig.num_workers || 1}</span>
                    </div>
                    <input
                        type="range"
                        className="slider"
                        min="1"
                        max="8"
                        step="1"
                        value={localConfig.num_workers || 1}
                        onChange={(e) => handleChange('num_workers', parseInt(e.target.value))}
                        disabled={isMining}
                    />
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                        {t('initialWorkersHelp')}
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <button
                    className="btn btn--primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ minWidth: '150px' }}
                >
                    {isSaving ? '⏳' : '💾'} {t('saveSettings')}
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// COMPONENT: HistoryPanel
// =============================================================================
function HistoryPanel({ history, sessions, t }) {
    const [activeTab, setActiveTab] = useState('shares');

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="glass-card panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 className="panel__title" style={{ marginBottom: 0 }}>{t('historyTitle')}</h3>
                <div className="tabs">
                    <button
                        className={`btn btn--sm ${activeTab === 'shares' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setActiveTab('shares')}
                    >
                        {t('sharesFound')}
                    </button>
                    <button
                        className={`btn btn--sm ${activeTab === 'sessions' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setActiveTab('sessions')}
                        style={{ marginLeft: 'var(--space-2)' }}
                    >
                        {t('sessions')}
                    </button>
                </div>
            </div>

            {activeTab === 'shares' && (
                (!history?.shares || history.shares.length === 0) ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <p className="text-muted" style={{ marginBottom: 'var(--space-2)' }}>
                            {t('noSharesYet')}
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {t('noSharesExplanation')}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('time')}</th>
                                    <th>{t('worker')}</th>
                                    <th>{t('difficulty')}</th>
                                    <th>{t('status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.shares.slice(0, 20).map((share, index) => (
                                    <tr key={index}>
                                        <td className="mono">{formatTime(share.timestamp)}</td>
                                        <td>{share.worker_name}</td>
                                        <td className="mono text-gold">{share.difficulty.toFixed(4)}</td>
                                        <td>
                                            <span className={`status ${share.accepted ? 'status--online' : 'status--offline'}`}>
                                                {share.accepted ? 'OK' : 'Rejected'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {activeTab === 'sessions' && (
                (!sessions || sessions.length === 0) ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <p className="text-muted">{t('noSharesYet')}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('startTime')}</th>
                                    <th>{t('duration')}</th>
                                    <th>{t('totalHashes')}</th>
                                    <th>{t('bestDifficulty')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((session, index) => (
                                    <tr key={index}>
                                        <td className="mono">{formatDate(session.start_time)}</td>
                                        <td>{session.duration}</td>
                                        <td className="mono">{session.total_hashes.toLocaleString()}</td>
                                        <td className="mono text-gold">{session.best_difficulty.toFixed(6)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </div>
    );
}

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================
function App() {
    const { isConnected, stats, lastMessage } = useWebSocket();
    const api = useAPI();

    const [theme, setTheme] = useState(() => localStorage.getItem('soloforge-theme') || 'dark');
    const [lang, setLang] = useState(() => localStorage.getItem('soloforge-lang') || 'fr');
    const t = useTranslation(lang);

    const [config, setConfig] = useState({
        pool_url: 'solo.ckpool.org',
        pool_port: 3333,
        wallet_address: '',
        max_cpu_percent: 80,
        num_workers: 1
    });
    const [isMining, setIsMining] = useState(false);
    const [history, setHistory] = useState({ shares: [], blocks: [] });
    const [sessions, setSessions] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [toast, setToast] = useState(null);
    const lastJobRef = useRef(null);

    // Theme effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('soloforge-theme', theme);
    }, [theme]);

    // Language effect
    useEffect(() => {
        localStorage.setItem('soloforge-lang', lang);
    }, [lang]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    const toggleLang = () => setLang(prev => prev === 'en' ? 'fr' : 'en');

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    const hideToast = useCallback(() => {
        setToast(null);
    }, []);

    // Load initial config and status
    useEffect(() => {
        api.get('/config').then(setConfig).catch(console.error);
        api.get('/status').then(status => {
            if (status && status.running) {
                setIsMining(true);
            }
        }).catch(console.error);
    }, []);

    // Update workers from stats
    useEffect(() => {
        if (stats?.workers) {
            // Sort workers by ID to prevent jumping
            const sorted = [...stats.workers].sort((a, b) => a.id - b.id);
            setWorkers(sorted);
        }
        if (stats?.connected !== undefined) setIsMining(stats.connected);
    }, [stats]);

    // Add log entry
    const addLog = useCallback((message, color = 'var(--text-secondary)') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-100), { time, message, color }]);
    }, []);

    // Listen to WebSocket events for log notifications from backend
    useEffect(() => {
        if (!lastMessage) return;

        // Handle log events from backend (job, connect, disconnect, share)
        if (lastMessage.type === 'log' && lastMessage.data?.message) {
            addLog(lastMessage.data.message, lastMessage.data.color || 'var(--text-secondary)');
        }

        // Handle legacy job events (if still used)
        if (lastMessage.type === 'job' && lastMessage.data?.job_id) {
            const jobId = lastMessage.data.job_id;
            if (jobId !== lastJobRef.current) {
                lastJobRef.current = jobId;
                addLog(`📦 ${t('logNewJob')} ${jobId.substring(0, 16)}...`, 'var(--info)');
            }
        }

        // Handle block events
        if (lastMessage.type === 'block') {
            addLog(`🆕 ${t('logNewBlock')}`, 'var(--warning)');
        }
    }, [lastMessage, t, addLog]);

    // Format functions
    const formatHashrate = (hash) => {
        if (!hash) return '0 H/s';
        if (hash >= 1e9) return `${(hash / 1e9).toFixed(2)} GH/s`;
        if (hash >= 1e6) return `${(hash / 1e6).toFixed(2)} MH/s`;
        if (hash >= 1e3) return `${(hash / 1e3).toFixed(2)} KH/s`;
        return `${hash.toFixed(2)} H/s`;
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
        return num.toLocaleString();
    };

    const formatUptime = (seconds) => {
        if (!seconds) return '0s';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    // Periodic log entries with more variety
    useEffect(() => {
        if (!isMining || !stats) return;
        const interval = setInterval(() => {
            if (stats.hashrate > 0) {
                const messages = [
                    { msg: `${t('logMining')} ${formatHashrate(stats.hashrate)}`, color: 'var(--text-secondary)' },
                    { msg: t('logSearching'), color: 'var(--text-muted)' },
                    { msg: `${t('logHashes')} ${formatNumber(stats.total_hashes)}`, color: 'var(--text-secondary)' },
                    { msg: `${t('logBestDiff')} ${(stats.best_difficulty || 0).toFixed(6)}`, color: 'var(--gold)' },
                    { msg: `👷 ${workers.length} ${t('workersActive')}`, color: 'var(--text-secondary)' },
                ];
                const selected = messages[Math.floor(Math.random() * messages.length)];
                addLog(selected.msg, selected.color);
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [isMining, stats, t, addLog, workers.length]);

    // Fetch history
    useEffect(() => {
        const fetchHistory = () => {
            api.get('/history?limit=50').then(data => {
                if (history.shares.length > 0 && data.shares.length > history.shares.length) {
                    addLog(t('logNewShare'), 'var(--success)');
                }
                setHistory(data);
            }).catch(console.error);

            api.get('/sessions?limit=50').then(setSessions).catch(console.error);
        };
        fetchHistory();
        const interval = setInterval(fetchHistory, 10000);
        return () => clearInterval(interval);
    }, [history.shares.length, t, addLog]);

    const handleSaveConfig = async (newConfig) => {
        try {
            await api.put('/config', newConfig);
            setConfig(newConfig);
            showToast(t('logConfigSaved'), 'success');
            addLog(t('logConfigSaved'), 'var(--success)');
        } catch (err) {
            showToast(t('logConfigFailed'), 'error');
            addLog(t('logConfigFailed'), 'var(--error)');
        }
    };

    const handleStartMining = async () => {
        if (!config.wallet_address) {
            alert(t('enterWalletFirst'));
            return;
        }
        try {
            addLog(t('logStarting'), 'var(--warning)');
            await api.post('/mining/start', {});
            setIsMining(true);
            addLog(t('logStarted'), 'var(--success)');
            addLog(`${t('logConnectedTo')} ${config.pool_url}:${config.pool_port}`, 'var(--info)');
            showToast(t('logStarted'), 'success');
        } catch (err) {
            addLog(t('logStartFailed'), 'var(--error)');
            showToast(t('logStartFailed'), 'error');
        }
    };

    const handleStopMining = async () => {
        try {
            addLog(t('logStopping'), 'var(--warning)');
            await api.post('/mining/stop', {});
            setIsMining(false);
            addLog(t('logStopped'), 'var(--text-muted)');
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddWorker = async () => {
        try {
            await api.post('/workers', { name: '' });
            addLog(t('logWorkerAdded'), 'var(--success)');
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemoveWorker = async (id) => {
        try {
            await api.delete(`/workers/${id}`);
            addLog(`${t('logWorkerRemoved')} #${id}`, 'var(--warning)');
        } catch (err) {
            console.error(err);
        }
    };

    const bestDiff = stats?.best_difficulty || 0;
    const networkDifficulty = 75e12;
    const diffProgress = bestDiff > 0 ? Math.log10(bestDiff + 1) / Math.log10(networkDifficulty) * 100 : 0;

    // Helper to get theme-specific asset
    const getAsset = (name) => {
        const suffix = theme === 'light' ? '-light' : '';
        return `/assets/${name}${suffix}.png`;
    };

    return (
        <div className="app-layout">
            {/* Toast notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}

            {/* Header */}
            <header className="app-header">
                <div className="app-header__inner">
                    <div className="app-header__brand">
                        <img src={getAsset('icon-block')} alt="SoloForge" className="app-header__logo" />
                        <div>
                            <div className="app-header__title">{t('title')}</div>
                            <div className="app-header__subtitle">{t('subtitle')}</div>
                        </div>
                    </div>
                    <div className="app-header__status">
                        <LanguageToggle lang={lang} onToggle={toggleLang} />
                        <ThemeToggle theme={theme} onToggle={toggleTheme} />
                        <span className={`status ${isConnected ? 'status--online' : 'status--offline'}`}>
                            <span className="status__dot"></span>
                            {isConnected ? t('connected') : t('disconnected')}
                        </span>
                        {isMining ? (
                            <button className="btn btn--danger" onClick={handleStopMining}>{t('stopMining')}</button>
                        ) : (
                            <button className="btn btn--primary" onClick={handleStartMining}>{t('startMining')}</button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                <div className="app-main__inner">
                    {/* Hero Section */}
                    <section className="hero">
                        <div className="hero__bg">
                            <img src={getAsset('hero-bg')} alt="" />
                        </div>
                        <div className="hero__content">
                            <h1 className="hero__title">
                                {t('heroTitle')} <span>{t('heroTitleHighlight')}</span>
                            </h1>
                            <p className="hero__description">{t('heroDescription')}</p>
                        </div>
                    </section>

                    {/* Stats Grid */}
                    <section className="section">
                        <div className="dashboard-grid">
                            <StatCard
                                icon={getAsset('icon-hash')}
                                label={t('hashrate')}
                                value={formatHashrate(stats?.hashrate)}
                                variant="gold"
                                subtitle={t('updatesEverySecond')}
                            />
                            <StatCard
                                icon={getAsset('icon-block')}
                                label={t('totalHashes')}
                                value={formatNumber(stats?.total_hashes)}
                                subtitle={isMining ? t('computing') : t('startMiningPrompt')}
                            />
                            <StatCard
                                icon={getAsset('icon-wallet')}
                                label={t('sharesFound')}
                                value={stats?.total_shares || 0}
                                subtitle={t('sharesExplanation')}
                                tooltip={t('sharesTooltip')}
                            />
                            <StatCard
                                icon={getAsset('icon-cpu')}
                                label={t('bestDifficulty')}
                                value={(stats?.best_difficulty || 0).toFixed(4)}
                                subtitle={bestDiff > 0 ? `${diffProgress.toFixed(8)}${t('ofNetwork')}` : t('searching')}
                                tooltip={t('difficultyTooltip')}
                            />
                        </div>
                    </section>

                    {/* Workers Section */}
                    <section className="section">
                        <div className="section__header">
                            <h2 className="section__title">{t('workersTitle')}</h2>
                            <div className="section__actions">
                                <button className="btn btn--secondary btn--sm" onClick={handleAddWorker} disabled={!isMining}>
                                    {t('addWorker')}
                                </button>
                            </div>
                        </div>

                        <div style={{
                            marginBottom: 'var(--space-4)',
                            padding: 'var(--space-3)',
                            background: 'var(--info-bg)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--info)'
                        }}>
                            💡 <strong>{t('workers')}</strong> {t('workersExplanation')}
                        </div>

                        <div className="flex flex-col gap-2">
                            {workers.length === 0 ? (
                                <div className="glass-card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                                    <p className="text-muted">{t('noActiveWorkers')}</p>
                                </div>
                            ) : (
                                workers.map(worker => (
                                    <WorkerCard key={worker.id} worker={worker} onRemove={handleRemoveWorker} t={t} />
                                ))
                            )}
                        </div>
                    </section>

                    {/* Settings & Logs */}
                    <section className="section">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                            <SettingsPanel config={config} onSave={handleSaveConfig} isMining={isMining} t={t} showToast={showToast} />
                            <LiveLog logs={logs} t={t} />
                        </div>
                    </section>

                    {/* History */}
                    <section className="section">
                        <HistoryPanel history={history} sessions={sessions} t={t} />
                    </section>

                    {/* Footer Stats */}
                    <section className="section">
                        <div className="glass-card" style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                            <div className="flex items-center gap-4">
                                <span className="text-muted">{t('pool')}:</span>
                                <span className="font-mono">{config.pool_url}:{config.pool_port}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-muted">{t('uptime')}:</span>
                                <span className="font-mono">{formatUptime(stats?.uptime_seconds)}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-muted">{t('workers')}:</span>
                                <span className="font-mono">{workers.length}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-muted">{t('cpuLimit')}:</span>
                                <span className="font-mono">{config.max_cpu_percent}%</span>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default App;
