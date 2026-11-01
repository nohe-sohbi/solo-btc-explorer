import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import StateBanners from './components/StateBanners.jsx';
import Toast from './components/Toast.jsx';
import WinDialog from './components/WinDialog.jsx';
import ResetDialog from './components/ResetDialog.jsx';
import WelcomeScreen from './screens/WelcomeScreen.jsx';
import DashboardScreen from './screens/DashboardScreen.jsx';
import ChancesScreen from './screens/ChancesScreen.jsx';
import HistoryScreen from './screens/HistoryScreen.jsx';
import ConfigScreen from './screens/ConfigScreen.jsx';
import HelpScreen from './screens/HelpScreen.jsx';
import { useTheme, useLanguage, useRoute, useStoredFlag } from './hooks/usePreferences.js';
import { useMiningSession } from './hooks/useMiningSession.js';
import { useBackgroundNotice } from './hooks/useBackgroundNotice.js';
import { IS_DEMO } from './config/runtime.js';
import { checkWallet } from './lib/walletCheck.js';
import { computeOdds } from './lib/odds.js';
import { formatBigNumber } from './lib/bigNumbers.js';
import { approximateCount, formatUptime, formatSpacedInteger } from './lib/format.js';
import { buildBlockProof } from './lib/blockProof.js';
import { exportEverything, triggerDownload, timestampedName } from './lib/exportData.js';
import { track } from './lib/analytics.js';

const ADVANCED_KEY = 'soloforge-advanced';
const WELCOMED_KEY = 'soloforge-welcomed';

// Title and subtitle i18n keys for the screens that have a fixed subtitle.
const SCREEN_TEXT = {
    chances: { title: 'titleChances', subtitle: 'subChances' },
    history: { title: 'titleHistory', subtitle: 'subHistory' },
    config: { title: 'titleConfig', subtitle: 'subConfig' },
    help: { title: 'titleHelp', subtitle: 'subHelp' },
};

export default function App() {
    const { lang, setLang, t } = useLanguage();
    const [theme, setTheme] = useTheme();
    const [route, navigate] = useRoute();
    const [advanced, setAdvanced] = useStoredFlag(ADVANCED_KEY);
    const [welcomed, setWelcomed] = useStoredFlag(WELCOMED_KEY);

// ======================================================================// COMPONENT: LanguageToggle (shows current language)
// ======================================================================function LanguageToggle({ lang, onToggle }) {
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

// ======================================================================// COMPONENT: Toast notification
// ======================================================================function Toast({ message, type, onClose }) {
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

// ======================================================================// COMPONENT: StatCard with animation
// ======================================================================function StatCard({ icon, label, value, unit, variant = 'default', subtitle, tooltip }) {
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

// ======================================================================// COMPONENT: LiveLog
// ======================================================================function LiveLog({ logs, t }) {
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

// ======================================================================// COMPONENT: WorkerCard
// ======================================================================function WorkerCard({ worker, onRemove, t }) {
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

// ======================================================================// COMPONENT: SettingsPanel with save feedback
// ======================================================================function SettingsPanel({ config, onSave, isMining, t, showToast }) {
    const [localConfig, setLocalConfig] = useState(config);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleChange = (key, value) => {
        setLocalConfig(prev => ({ ...prev, [key]: value }));
    };

    // Live wallet check so a typo is caught before saving (the backend
    // re-validates on PUT). An empty field is "neutral" — it just can't mine yet.
    const wallet = (localConfig.wallet_address || '').trim();
    const walletCheck = wallet ? validateBitcoinAddress(wallet) : null;

    const handleSave = async () => {
        if (walletCheck && !walletCheck.valid) {
            showToast(t('walletInvalid'), 'error');
            return;
        }
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
                        style={walletCheck && !walletCheck.valid
                            ? { borderColor: 'var(--error)' }
                            : walletCheck && walletCheck.valid
                                ? { borderColor: 'var(--success)' }
                                : undefined}
                    />
                    {walletCheck && (
                        <div style={{
                            fontSize: 'var(--text-xs)',
                            marginTop: 'var(--space-1)',
                            color: walletCheck.valid ? 'var(--success)' : 'var(--error)'
                        }}>
                            {walletCheck.valid
                                ? `✓ ${t('walletValid')}`
                                : `✕ ${t('walletInvalid')} — ${walletCheck.error}`}
                        </div>
                    )}
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
                    <label className="input-group__label">{t('workerName')}</label>
                    <input
                        type="text"
                        className="input"
                        placeholder={t('workerPlaceholder')}
                        value={localConfig.worker_name || ''}
                        onChange={(e) => handleChange('worker_name', e.target.value)}
                        disabled={isMining}
                        maxLength={64}
                        pattern="[A-Za-z0-9_]*"
                    />
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                        {t('workerHelp')}
                    </div>
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
                    disabled={isSaving || (walletCheck && !walletCheck.valid)}
                    style={{ minWidth: '150px' }}
                >
                    {isSaving ? '⏳' : '💾'} {t('saveSettings')}
                </button>
            </div>
        </div>
    );
}

// ======================================================================// COMPONENT: HistoryPanel
// ======================================================================function HistoryPanel({ history, sessions, t }) {
    const [activeTab, setActiveTab] = useState('shares');

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    // Export whichever dataset the active tab is showing, in the chosen format.
    const handleExport = (format) => {
        if (activeTab === 'sessions') {
            exportDataset('sessions', sessions, SESSION_COLUMNS, format);
        } else {
            exportDataset('shares', history?.shares, SHARE_COLUMNS, format);
        }
        window.umami?.track('export_data', { dataset: activeTab, format });
    };

    const exportDisabled = activeTab === 'sessions'
        ? !sessions || sessions.length === 0
        : !history?.shares || history.shares.length === 0;

    return (
        <div className="glass-card panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h3 className="panel__title" style={{ marginBottom: 0 }}>{t('historyTitle')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
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
                    <span style={{ width: '1px', height: '20px', background: 'var(--glass-border)' }} />
                    <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => handleExport('csv')}
                        disabled={exportDisabled}
                        title={t('exportTitle')}
                    >
                        {t('exportCSV')}
                    </button>
                    <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => handleExport('json')}
                        disabled={exportDisabled}
                        title={t('exportTitle')}
                    >
                        {t('exportJSON')}
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

// ======================================================================// MAIN APP COMPONENT
// ======================================================================function App() {
    const { isConnected, stats, lastMessage } = useWebSocket();
    const api = useAPI();

    const [theme, setTheme] = useState(() => localStorage.getItem('soloforge-theme') || 'dark');
    const [lang, setLang] = useState(() => localStorage.getItem('soloforge-lang') || 'fr');
    const t = useTranslation(lang);

    const [config, setConfig] = useState({
        pool_url: 'solo.ckpool.org',
        pool_port: 3333,
        wallet_address: '',
        worker_name: '',
        max_cpu_percent: 80,
        num_workers: 1
    });
    const [isMining, setIsMining] = useState(false);
    const [history, setHistory] = useState({ shares: [], blocks: [] });
    const [sessions, setSessions] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [logs, setLogs] = useState([]);
>>>>>>> fork/support-worker-labels
    const [toast, setToast] = useState(null);
    const notify = useCallback((message, tone = 'success', action) => setToast({ message, tone, action }), []);
    const hideToast = useCallback(() => setToast(null), []);

    const session = useMiningSession({ notify, t });
    const { stats, config, running, network, history, sessions, actions } = session;
    const backgroundNotice = useBackgroundNotice(IS_DEMO && running);

    const [historyTab, setHistoryTab] = useState('shares');
    const [resetOpen, setResetOpen] = useState(false);

    const hashrate = stats?.hashrate || 0;
    // Newcomers get the explanatory first screen until they have started once (or
    // clearly aren't newcomers: mining is already running or they have history).
    const showWelcome =
        route === 'dashboard' && session.loaded && !welcomed && !running && !(stats?.total_shares > 0);

    // ----- Handlers -----
    const toggleLanguage = () => {
        const next = lang === 'fr' ? 'en' : 'fr';
        track('lang_toggle', { lang: next });
        setLang(next);
    };

    const changeTheme = (next) => {
        track('theme_toggle', { theme: next });
        setTheme(next);
    };

    const startFromWelcome = async (wallet) => {
        const started = await actions.start(wallet);
        if (started) setWelcomed(true);
        return started;
    };

    // The top-bar button starts with the saved address; if that address isn't
    // usable, send the user to where they can fix it.
    const toggleMining = async () => {
        if (running) {
            actions.stop();
            return;
        }
        const started = await actions.start();
        if (!started && checkWallet(config.wallet_address).status !== 'valid') {
            notify(t('walletRequired'), 'error');
            navigate('config');
        }
    };

    const exportBlockProof = () => {
        const proof = buildBlockProof(session.foundBlock, {
            wallet: config.wallet_address,
            rewardBTC: network.rewardBTC,
            networkDifficulty: network.difficulty,
            isDemo: IS_DEMO,
        });
        triggerDownload(timestampedName('block', 'json'), JSON.stringify(proof, null, 2), 'application/json');
        track('export_data', { dataset: 'block-proof', format: 'json' });
    };

    const openFoundBlockInHistory = () => {
        actions.dismissFoundBlock();
        setHistoryTab('blocks');
        navigate('history');
    };

    const confirmReset = async () => {
        if (await actions.resetStats()) setResetOpen(false);
    };

    const exportBeforeReset = () => exportEverything({ shares: history.shares, sessions, blocks: history.blocks });

    // ----- Header content -----
    let title;
    let subtitle;
    if (showWelcome) {
        title = t('titleWelcome');
        subtitle = t('subWelcome');
    } else if (route === 'dashboard') {
        title = t('titleDashboard');
        subtitle = !running
            ? t('subDashboardStopped')
            : hashrate > 0
              ? t(IS_DEMO ? 'subDashboardRunningDemo' : 'subDashboardRunning', {
                    rate: formatSpacedInteger(approximateCount(hashrate), lang),
                })
              : t('subDashboardStarting');
    } else {
        title = t(SCREEN_TEXT[route].title);
        subtitle = t(SCREEN_TEXT[route].subtitle);
    }

    const status = showWelcome
        ? { tone: 'idle', label: t('statusReady') }
        : running
          ? { tone: 'ok', label: t('statusRunning', { time: formatUptime(session.sessionSeconds) }) }
          : { tone: 'idle', label: t('statusStopped') };

    const topBarAction = showWelcome
        ? null
        : {
              running,
              label: t(running ? 'actionStop' : 'actionStart'),
              onClick: toggleMining,
              disabled: session.serverLost,
          };

    const odds = computeOdds(hashrate, network.difficulty);

    return (
        <div className="app">
            <Sidebar
                route={route}
                onNavigate={navigate}
                theme={theme}
                onThemeChange={changeTheme}
                onToggleLanguage={toggleLanguage}
                connection={session.connection}
                pool={session.pool}
                cpuPercent={config.max_cpu_percent}
                t={t}
            />

            <main className="main">
                <div className="page">
                    <TopBar
                        title={title}
                        subtitle={subtitle}
                        status={status}
                        action={topBarAction}
                        advanced={route === 'dashboard' && !showWelcome ? { checked: advanced, onChange: setAdvanced } : null}
                        t={t}
                    />

                    {!showWelcome && (
                        <StateBanners t={t} session={session} backgroundNotice={backgroundNotice} advanced={advanced} />
                    )}

                    {showWelcome && (
                        <WelcomeScreen
                            t={t}
                            lang={lang}
                            theme={theme}
                            network={network}
                            savedWallet={config.wallet_address}
                            onStart={startFromWelcome}
                            onOpenHelp={() => navigate('help')}
                        />
                    )}
                    {route === 'dashboard' && !showWelcome && (
                        <DashboardScreen
                            t={t}
                            lang={lang}
                            theme={theme}
                            session={session}
                            advanced={advanced}
                            onNavigate={navigate}
                        />
                    )}
                    {route === 'chances' && <ChancesScreen t={t} lang={lang} hashrate={hashrate} network={network} />}
                    {route === 'history' && (
                        <HistoryScreen
                            t={t}
                            lang={lang}
                            stats={stats}
                            history={history}
                            sessions={sessions}
                            tab={historyTab}
                            onTabChange={setHistoryTab}
                        />
                    )}
                    {route === 'config' && (
                        <ConfigScreen
                            t={t}
                            lang={lang}
                            session={session}
                            onRequestReset={() => setResetOpen(true)}
                            onNavigate={navigate}
                        />
                    )}
                    {route === 'help' && <HelpScreen t={t} lang={lang} network={network} />}
                </div>
            </main>

            {toast && <Toast message={toast.message} tone={toast.tone} action={toast.action} onClose={hideToast} />}

            {session.foundBlock && (
                <WinDialog
                    t={t}
                    lang={lang}
                    theme={theme}
                    block={session.foundBlock}
                    network={network}
                    oddsPerDay={odds.probPerDay > 0 ? formatBigNumber(1 / odds.probPerDay, lang) : '—'}
                    onClose={actions.dismissFoundBlock}
                    onExport={exportBlockProof}
                    onOpenHistory={openFoundBlockInHistory}
                />
            )}

            {resetOpen && (
                <ResetDialog
                    t={t}
                    lang={lang}
                    counts={{
                        shares: stats?.total_shares || 0,
                        sessions: sessions.length,
                        best: stats?.best_difficulty || 0,
                    }}
                    onCancel={() => setResetOpen(false)}
                    onConfirm={confirmReset}
                    onExport={exportBeforeReset}
                />
            )}
        </div>
    );
}
