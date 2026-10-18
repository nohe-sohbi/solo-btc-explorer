import { formatHashrate } from '../lib/format.js';

// The mining threads. Each row's bar is relative to the fastest worker, so uneven
// workers are visible at a glance.
export default function WorkersCard({ t, workers, running, defaultCount, onAdd, onRemove }) {
    const fastest = Math.max(0, ...workers.map((worker) => worker.hashrate || 0));
    const activeCount = workers.filter((worker) => worker.running).length;

    return (
        <section className="card panel">
            <div className="panel__header">
                <div>
                    <h2 className="panel__title">
                        {t('workersTitle')} <span className="panel__count">{t('workersActive', { n: activeCount })}</span>
                    </h2>
                    <p className="panel__subtitle">{t('workersHelp')}</p>
                </div>
                <button type="button" className="btn btn--accent-soft btn--sm" onClick={onAdd} disabled={!running}>
                    {t('workersAdd')}
                </button>
            </div>

            {workers.length === 0 ? (
                <p className="panel__empty">{t('workersEmpty', { n: defaultCount })}</p>
            ) : (
                <ul className="rows">
                    {workers.map((worker) => (
                        <li key={worker.id} className="worker-row">
                            <span className="worker-row__name">
                                <span className={`dot dot--${worker.running ? 'ok' : 'idle'}`} aria-hidden="true" />
                                {worker.name}
                            </span>
                            <span className="meter" aria-hidden="true">
                                <span
                                    className="meter__fill"
                                    style={{ width: `${fastest > 0 ? ((worker.hashrate || 0) / fastest) * 100 : 0}%` }}
                                />
                            </span>
                            <span className="worker-row__rate">{formatHashrate(worker.hashrate || 0)}</span>
                            <button
                                type="button"
                                className="icon-button"
                                aria-label={t('workerRemove', { name: worker.name })}
                                onClick={() => onRemove(worker.id)}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
