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
import { formatOneIn } from './lib/oddsFormat.js';
import { formatInteger } from './lib/bigNumbers.js';
import { approximateCount, formatUptime } from './lib/format.js';
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
                    rate: formatInteger(approximateCount(hashrate), lang),
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
                    oddsPerDay={formatOneIn(odds.probPerDay, lang, t)}
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
