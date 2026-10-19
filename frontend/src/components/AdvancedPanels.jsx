import { IS_DEMO } from '../config/runtime.js';
import { useServerProbes } from '../hooks/useServerProbes.js';
import { formatInteger } from '../lib/bigNumbers.js';

// The "advanced view" cards for whoever runs the app: pool connection details
// and the monitoring endpoints.

function PanelHeader({ title, t }) {
    return (
        <div className="panel__header">
            <h2 className="panel__title">{title}</h2>
            <span className="badge badge--accent badge--sm">{t('advBadge')}</span>
        </div>
    );
}

function Fact({ label, children }) {
    return (
        <div className="facts__row">
            <dt>{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

// "12 s ago" / "3 min ago", from a whole number of seconds.
function formatAgo(seconds, t) {
    return seconds < 120 ? t('advAgoSeconds', { n: seconds }) : t('advAgoMinutes', { n: Math.floor(seconds / 60) });
}

export function PoolPanel({ t, lang, stats, pool, running, health }) {
    let statusKey = running ? 'advStatusReconnecting' : 'advStatusOff';
    if (running && stats?.connected) statusKey = stats.authorized ? 'advStatusOk' : 'advStatusWaiting';

    const accepted = stats?.accepted_shares || 0;
    const rejected = stats?.rejected_shares || 0;
    const total = accepted + rejected;
    const shares = `${formatInteger(accepted, lang)} / ${formatInteger(rejected, lang)}`;
    const lastJob =
        health.lastJobAgeSeconds === null
            ? '—'
            : [formatAgo(health.lastJobAgeSeconds, t), health.lastJobId && `${health.lastJobId}…`].filter(Boolean).join(' · ');
    const acceptedRate = total > 0 ? ` · ${formatInteger(Math.round((accepted / total) * 100), lang)} %` : '';

    return (
        <section className="card panel panel--compact">
            <PanelHeader title={t('advPoolTitle')} t={t} />
            <dl className="facts">
                <Fact label={t('advPool')}>{pool}</Fact>
                <Fact label={t('advStatus')}>
                    <span className={`facts__status ${statusKey === 'advStatusOk' ? 'text-success' : 'text-muted'}`}>{t(statusKey)}</span>
                </Fact>
                <Fact label={t('advLastJob')}>{lastJob}</Fact>
                <Fact label={t('advReconnects')}>{formatInteger(health.reconnects, lang)}</Fact>
                <Fact label={t('advShares')}>{shares + acceptedRate}</Fact>
            </dl>
        </section>
    );
}

const PROBE_LABEL_KEYS = {
    health: { ok: 'advProbeOk', down: 'advProbeDown', checking: 'advProbeChecking', demo: 'advProbeDemo' },
    ready: { ok: 'advProbeReady', down: 'advProbeNotReady', checking: 'advProbeChecking', demo: 'advProbeDemo' },
};

const PROBE_TONES = { ok: 'ok', down: 'danger', checking: 'idle', demo: 'idle' };

function ProbeChip({ kind, state, t }) {
    // In the demo the chip says "Demo"; the tooltip explains why there is no probe.
    const title = state === 'demo' ? t('advSupervisionDemo') : undefined;
    return (
        <span className={`status-pill status-pill--${PROBE_TONES[state]}`} title={title}>
            {t(PROBE_LABEL_KEYS[kind][state])}
        </span>
    );
}

// The monitoring endpoints, with the live state of the two probes. In the demo
// there is no server behind them, so the probes are marked as not applicable.
function MonitoringRows({ t, health, ready, linked }) {
    // The endpoints only exist next to a server: in the demo they are plain text.
    const endpoint = (path, href) =>
        linked ? (
            <a href={href} target="_blank" rel="noreferrer">
                <code>{path}</code>
            </a>
        ) : (
            <code>{path}</code>
        );
    return (
        <dl className="facts">
            <Fact label={<code>/healthz</code>}>
                <ProbeChip kind="health" state={health} t={t} />
            </Fact>
            <Fact label={<code>/readyz</code>}>
                <ProbeChip kind="ready" state={ready} t={t} />
            </Fact>
            <Fact label={endpoint('/metrics', '/metrics')}>
                <span className="facts__note">{t('advEndpointMetrics')}</span>
            </Fact>
            <Fact label={endpoint('/api/export', '/api/export?format=json')}>
                <span className="facts__note">{t('advEndpointExport')}</span>
            </Fact>
            <Fact label={endpoint('/api/network', '/api/network')}>
                <span className="facts__note">{t('advEndpointNetwork')}</span>
            </Fact>
        </dl>
    );
}

function LiveMonitoring({ t }) {
    const probes = useServerProbes(true);
    return <MonitoringRows t={t} health={probes.health} ready={probes.ready} linked />;
}

export function SupervisionPanel({ t }) {
    return (
        <section className="card panel panel--compact">
            <PanelHeader title={t('advSupervisionTitle')} t={t} />
            {IS_DEMO ? (
                <MonitoringRows t={t} health="demo" ready="demo" />
            ) : (
                <LiveMonitoring t={t} />
            )}
        </section>
    );
}
