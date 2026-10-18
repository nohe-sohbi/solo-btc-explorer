import { IS_DEMO } from '../config/runtime.js';
import { useServerProbes } from '../hooks/useServerProbes.js';
import { formatUptime } from '../lib/format.js';
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

export function PoolPanel({ t, lang, stats, pool, running }) {
    let statusKey = 'advStatusOff';
    if (running && stats?.connected) statusKey = stats.authorized ? 'advStatusOk' : 'advStatusWaiting';

    const accepted = stats?.accepted_shares || 0;
    const rejected = stats?.rejected_shares || 0;
    const total = accepted + rejected;
    const shares = `${formatInteger(accepted, lang)} / ${formatInteger(rejected, lang)}`;
    const acceptedRate = total > 0 ? ` · ${formatInteger(Math.round((accepted / total) * 100), lang)} %` : '';

    return (
        <section className="card panel">
            <PanelHeader title={t('advPoolTitle')} t={t} />
            <dl className="facts">
                <Fact label={t('advPool')}>{pool}</Fact>
                <Fact label={t('advStatus')}>
                    <span className={statusKey === 'advStatusOk' ? 'text-success' : 'text-muted'}>{t(statusKey)}</span>
                </Fact>
                <Fact label={t('advShares')}>{shares + acceptedRate}</Fact>
                <Fact label={t('advMiningTime')}>{formatUptime(stats?.uptime_seconds)}</Fact>
            </dl>
        </section>
    );
}

const PROBE_LABEL_KEYS = {
    health: { ok: 'advProbeOk', down: 'advProbeDown', checking: 'advProbeChecking' },
    ready: { ok: 'advProbeReady', down: 'advProbeNotReady', checking: 'advProbeChecking' },
};

function ProbeChip({ kind, state, t }) {
    return (
        <span className={`status-pill status-pill--${state === 'ok' ? 'ok' : state === 'down' ? 'danger' : 'idle'}`}>
            {t(PROBE_LABEL_KEYS[kind][state])}
        </span>
    );
}

function ServerProbes({ t }) {
    const probes = useServerProbes(true);
    return (
        <dl className="facts">
            <Fact label={<code>/healthz</code>}>
                <ProbeChip kind="health" state={probes.health} t={t} />
            </Fact>
            <Fact label={<code>/readyz</code>}>
                <ProbeChip kind="ready" state={probes.ready} t={t} />
            </Fact>
            <Fact label={<a href="/metrics" target="_blank" rel="noreferrer"><code>/metrics</code></a>}>
                {t('advEndpointMetrics')}
            </Fact>
            <Fact label={<a href="/api/export?format=json" target="_blank" rel="noreferrer"><code>/api/export</code></a>}>
                {t('advEndpointExport')}
            </Fact>
            <Fact label={<a href="/api/network" target="_blank" rel="noreferrer"><code>/api/network</code></a>}>
                {t('advEndpointNetwork')}
            </Fact>
        </dl>
    );
}

export function SupervisionPanel({ t }) {
    return (
        <section className="card panel">
            <PanelHeader title={t('advSupervisionTitle')} t={t} />
            {IS_DEMO ? <p className="panel__empty">{t('advSupervisionDemo')}</p> : <ServerProbes t={t} />}
        </section>
    );
}
