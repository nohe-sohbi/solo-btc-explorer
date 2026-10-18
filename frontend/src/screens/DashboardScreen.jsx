import HashrateCard from '../components/HashrateCard.jsx';
import JackpotCard from '../components/JackpotCard.jsx';
import WorkersCard from '../components/WorkersCard.jsx';
import ActivityCard from '../components/ActivityCard.jsx';
import DemoNote from '../components/DemoNote.jsx';
import { PoolPanel, SupervisionPanel } from '../components/AdvancedPanels.jsx';

// The live dashboard: speed and counters, the jackpot, the workers and what's
// happening — plus, for whoever runs the app, the advanced cards.
export default function DashboardScreen({ t, lang, theme, session, advanced, onNavigate }) {
    const { stats, running, network, workers, samples, hiddenFlags, feed, history, actions } = session;

    return (
        <>
            <DemoNote t={t} />

            <div className="split">
                <HashrateCard
                    t={t}
                    lang={lang}
                    running={running}
                    stats={stats}
                    samples={samples}
                    hiddenFlags={hiddenFlags}
                    networkDifficulty={network.difficulty}
                />
                <JackpotCard
                    t={t}
                    lang={lang}
                    theme={theme}
                    running={running}
                    hashrate={stats?.hashrate || 0}
                    network={network}
                    blocksFound={history.blocks.length}
                    onExplore={() => onNavigate('chances')}
                />
            </div>

            {advanced && (
                <div className="pair">
                    <PoolPanel t={t} lang={lang} stats={stats} pool={session.pool} running={running} />
                    <SupervisionPanel t={t} />
                </div>
            )}

            <div className="duo">
                <WorkersCard
                    t={t}
                    workers={workers}
                    running={running}
                    defaultCount={session.config.num_workers}
                    onAdd={actions.addWorker}
                    onRemove={actions.removeWorker}
                />
                <ActivityCard t={t} lang={lang} feed={feed} onOpenHistory={() => onNavigate('history')} />
            </div>
        </>
    );
}
