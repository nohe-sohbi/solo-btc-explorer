import Segmented from '../components/Segmented.jsx';
import { IS_DEMO } from '../config/runtime.js';
import { exportDataset, SHARE_COLUMNS, SESSION_COLUMNS, BLOCK_COLUMNS } from '../lib/exportData.js';
import { formatInteger, LOCALES } from '../lib/bigNumbers.js';
import { formatNumber, formatSi } from '../lib/format.js';
import { track } from '../lib/analytics.js';

// How many of the most recent proofs the table shows (the export holds more).
const SHARES_SHOWN = 20;

function SummaryTile({ label, value }) {
    return (
        <div className="card tile">
            <div className="tile__label">{label}</div>
            <div className="tile__value">{value}</div>
        </div>
    );
}

function EmptyState({ title, body }) {
    return (
        <div className="empty-state empty-state--dashed">
            <div className="empty-state__title">{title}</div>
            <div className="empty-state__body">{body}</div>
        </div>
    );
}

// Everything the computer has accomplished: proofs of work, finished sessions and
// found blocks, each exportable as CSV or JSON.
export default function HistoryScreen({ t, lang, stats, history, sessions, tab, onTabChange }) {
    const locale = LOCALES[lang] || LOCALES.en;
    const best = stats?.best_difficulty || 0;

    // Tab id -> what its export contains.
    const datasets = {
        shares: { rows: history.shares, columns: SHARE_COLUMNS },
        sessions: { rows: sessions, columns: SESSION_COLUMNS },
        blocks: { rows: history.blocks, columns: BLOCK_COLUMNS },
    };
    const active = datasets[tab];

    const handleExport = (format) => {
        exportDataset(tab, active.rows, active.columns, format);
        track('export_data', { dataset: tab, format });
    };

    const time = (timestamp) => new Date(timestamp).toLocaleTimeString(locale);

    return (
        <>
            <div className="tile-row">
                <SummaryTile label={t('histProofs')} value={formatInteger(stats?.total_shares || 0, lang)} />
                <SummaryTile label={t('histSessions')} value={formatInteger(sessions.length, lang)} />
                <SummaryTile label={t('histBest')} value={best > 0 ? best.toFixed(4) : '—'} />
                <SummaryTile label={t('histBlocks')} value={formatInteger(history.blocks.length, lang)} />
            </div>

            <section className="card panel">
                <div className="panel__header panel__header--center">
                    <Segmented
                        variant="tabs"
                        label={t('histTabsLabel')}
                        value={tab}
                        onChange={onTabChange}
                        options={[
                            { value: 'shares', label: t('tabShares') },
                            { value: 'sessions', label: t('tabSessions') },
                            { value: 'blocks', label: t('tabBlocks') },
                        ]}
                    />
                    <div className="panel__tools">
                        <span className="panel__tools-label">{t('exportThisTab')}</span>
                        {['csv', 'json'].map((format) => (
                            <button
                                key={format}
                                type="button"
                                className="btn btn--outline btn--sm"
                                disabled={active.rows.length === 0}
                                onClick={() => handleExport(format)}
                            >
                                {t(format === 'csv' ? 'exportCsv' : 'exportJson')}
                            </button>
                        ))}
                    </div>
                </div>

                {tab === 'shares' &&
                    (history.shares.length === 0 ? (
                        <EmptyState title={t('sharesEmptyTitle')} body={t('sharesEmptyBody')} />
                    ) : (
                        <>
                            <div className="table-wrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>{t('colTime')}</th>
                                            <th>{t('colWorker')}</th>
                                            <th>{t('colDifficulty')}</th>
                                            <th>{t('colStatus')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.shares.slice(0, SHARES_SHOWN).map((share, index) => (
                                            <tr key={`${share.timestamp}-${share.nonce}-${index}`}>
                                                <td className="mono text-muted">{time(share.timestamp)}</td>
                                                <td className="mono">{share.worker_name}</td>
                                                <td className="mono text-accent">
                                                    {share.difficulty.toFixed(4)}
                                                    {best > 0 && share.difficulty >= best && (
                                                        <span className="badge badge--accent badge--sm">{t('badgeRecord')}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`status-pill status-pill--${share.accepted ? 'ok' : 'danger'}`}>
                                                        {t(share.accepted ? 'statusAccepted' : 'statusRejected')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="panel__footnote">
                                {t('sharesFootnote', { shown: Math.min(SHARES_SHOWN, history.shares.length) })}
                            </p>
                        </>
                    ))}

                {tab === 'sessions' &&
                    (sessions.length === 0 ? (
                        <EmptyState title={t('sessionsEmptyTitle')} body={t('sessionsEmptyBody')} />
                    ) : (
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{t('colStart')}</th>
                                        <th>{t('colDuration')}</th>
                                        <th>{t('colHashes')}</th>
                                        <th>{t('colBest')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((session) => (
                                        <tr key={session.id}>
                                            <td>{new Date(session.start_time).toLocaleString(locale)}</td>
                                            <td className="mono">{session.duration}</td>
                                            <td className="mono">{formatNumber(session.total_hashes)}</td>
                                            <td className="mono text-accent">{session.best_difficulty.toFixed(4)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}

                {tab === 'blocks' &&
                    (history.blocks.length === 0 ? (
                        <EmptyState title={t('blocksEmptyTitle')} body={t('blocksEmptyBody')} />
                    ) : (
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{t('colTime')}</th>
                                        <th>{t('colBlock')}</th>
                                        <th>{t('colReached')}</th>
                                        <th>{t('colNonce')}</th>
                                        <th>{t('colStatus')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.blocks.map((block, index) => (
                                        <tr key={`${block.timestamp}-${index}`}>
                                            <td className="mono text-muted">{time(block.timestamp)}</td>
                                            <td className="mono">{block.height ? `#${formatInteger(block.height, lang)}` : '—'}</td>
                                            <td className="mono text-accent">{block.difficulty ? formatSi(block.difficulty, lang) : '—'}</td>
                                            <td className="mono">{block.nonce ? `0x${block.nonce}` : '—'}</td>
                                            <td>
                                                <span className="status-pill status-pill--accent">
                                                    {t(IS_DEMO ? 'statusCandidateDemo' : 'statusCandidate')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
            </section>

            <p className="page-note">{t(IS_DEMO ? 'historyStorageDemo' : 'historyStorageServer')}</p>
        </>
    );
}
