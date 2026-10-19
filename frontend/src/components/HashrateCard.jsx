import { useState } from 'react';
import HelpTip from './HelpTip.jsx';
import Segmented from './Segmented.jsx';
import SpeedChart from './SpeedChart.jsx';
import { PERIODS } from '../lib/series.js';
import { splitHashrate, formatNumber, approximateCount, formatSi } from '../lib/format.js';
import { formatBigNumber, formatInteger } from '../lib/bigNumbers.js';

const MILLION = 1e6;

// The mockup spells this count with a regular-width space; a no-break one keeps it
// the same width without letting the number wrap in the middle.
const spacedCount = (n, lang) => formatInteger(n, lang).replace(/\u202f/g, '\u00a0');

// One of the three counters under the chart: a plain-language name, the technical
// term next to it, a "?" explanation, the value and a one-line caption.
function StatCell({ title, tech, help, value, caption, children, t }) {
    return (
        <div className="stat-cell">
            <div className="stat-cell__label">
                <span className="stat-cell__title">{title}</span>
                <span className="stat-cell__tech">{tech}</span>
                <HelpTip term={tech} text={help} t={t} />
            </div>
            <div className="stat-cell__value">{value}</div>
            {children}
            <div className="stat-cell__caption">{caption}</div>
        </div>
    );
}

// The main card of the dashboard: the live computing speed (number + curve over a
// selectable period) and the three counters that matter to a newcomer.
export default function HashrateCard({ t, lang, running, stats, samples, hiddenFlags, networkDifficulty }) {
    const [periodId, setPeriodId] = useState(PERIODS[0].id);
    const period = PERIODS.find((p) => p.id === periodId);

    const hashrate = stats?.hashrate || 0;
    const { value, unit } = splitHashrate(hashrate);
    const totalHashes = stats?.total_hashes || 0;
    const best = stats?.best_difficulty || 0;

    const hashesCaption =
        totalHashes <= 0
            ? t('hashesCaptionIdle')
            : totalHashes >= MILLION
              ? t('hashesCaptionBig', { n: formatBigNumber(totalHashes, lang) })
              : t('hashesCaptionSmall', { n: formatInteger(totalHashes, lang) });

    // How close the best attempt is to the network's difficulty, on a log scale
    // (the gap spans many orders of magnitude, so a linear bar would never move).
    const progress = best > 0 ? (Math.log10(best + 1) / Math.log10(networkDifficulty)) * 100 : 0;

    return (
        <section className="card speed-card">
            <div className="speed-card__top">
                <div>
                    <div className="stat-cell__label">
                        <span className="stat-cell__title">{t('speedTitle')}</span>
                        <span className="stat-cell__tech">{t('speedTech')}</span>
                        <HelpTip term={t('speedTech')} text={t('speedHelp')} t={t} />
                    </div>
                    <div className="speed-card__value">
                        <span className="speed-card__number">{value.toFixed(2)}</span>
                        <span className="speed-card__unit">{unit}</span>
                    </div>
                    <div className="speed-card__caption">
                        {running && hashrate > 0
                            ? t('speedCaption', { rate: spacedCount(approximateCount(hashrate), lang) })
                            : t('speedCaptionIdle')}
                    </div>
                </div>
                <Segmented
                    label={t('periodLabel')}
                    value={periodId}
                    onChange={setPeriodId}
                    size="sm"
                    options={PERIODS.map((p) => ({ value: p.id, label: t(p.labelKey) }))}
                />
            </div>

            {running ? (
                <SpeedChart samples={samples} hiddenFlags={hiddenFlags} period={period} t={t} />
            ) : (
                <div className="empty-state empty-state--dashed speed-card__empty">
                    <div className="empty-state__title">{t('chartEmptyTitle')}</div>
                    <div className="empty-state__body">{t('chartEmptyBody', { action: t('actionStart') })}</div>
                </div>
            )}

            <div className="stat-row">
                <StatCell
                    t={t}
                    title={t('hashesTitle')}
                    tech={t('hashesTech')}
                    help={t('hashesHelp')}
                    value={formatNumber(totalHashes)}
                    caption={hashesCaption}
                />
                <StatCell
                    t={t}
                    title={t('sharesTitle')}
                    tech={t('sharesTech')}
                    help={t('sharesHelp')}
                    value={stats?.total_shares || 0}
                    caption={t('sharesCaption')}
                />
                <StatCell
                    t={t}
                    title={t('bestTitle')}
                    tech={t('bestTech')}
                    help={t('bestHelp')}
                    value={best > 0 ? best.toFixed(4) : '—'}
                    caption={t('bestGoal', { target: formatSi(networkDifficulty, lang) })}
                >
                    <div className="progress" aria-hidden="true">
                        <span className="progress__fill" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                </StatCell>
            </div>
        </section>
    );
}
