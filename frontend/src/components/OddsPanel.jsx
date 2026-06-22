import { useMemo } from 'react';
import { computeOdds, computeExpectedValue, formatTimespan, formatOdds, formatUSD } from '../lib/odds.js';

// =============================================================================
// COMPONENT: OddsPanel
// Educational "what are my real chances?" widget. From the current hashrate and
// the network difficulty it derives the expected time to solve a block and the
// probability of doing so over common horizons (see lib/odds.js for the math).
// When the BTC price is known it also shows the long-run *expected value* of the
// mined reward, turning the abstract odds into concrete economics.
// Works identically in backend and demo mode — it only consumes plain numbers.
// =============================================================================

export default function OddsPanel({ hashrate, networkDifficulty, btcPrice = 0, blockReward = 0, t }) {
    const { expectedSeconds, probPerDay, probPerYear, hasData } = useMemo(
        () => computeOdds(hashrate, networkDifficulty),
        [hashrate, networkDifficulty]
    );

    const ev = useMemo(
        () => computeExpectedValue({ probPerDay, probPerYear, blockRewardBTC: blockReward, priceUSD: btcPrice }),
        [probPerDay, probPerYear, blockReward, btcPrice]
    );

    return (
        <div className="glass-card panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 className="panel__title" style={{ marginBottom: 0 }}>{t('oddsTitle')}</h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('oddsSubtitle')}</span>
            </div>

            {!hasData ? (
                <div style={{
                    padding: 'var(--space-5)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)'
                }}>
                    {t('oddsWaiting')}
                </div>
            ) : (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-3)'
                    }}>
                        <OddsStat label={t('oddsExpectedTime')} value={formatTimespan(expectedSeconds, t)} accent />
                        <OddsStat label={t('oddsPerDay')} value={formatOdds(probPerDay, t)} />
                        <OddsStat label={t('oddsPerYear')} value={formatOdds(probPerYear, t)} />
                    </div>
                    {ev.hasPrice && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: 'var(--space-3)',
                            marginBottom: 'var(--space-3)',
                            paddingTop: 'var(--space-3)',
                            borderTop: '1px solid var(--glass-border)'
                        }}>
                            <OddsStat label={t('oddsEvPerDay')} value={formatUSD(ev.usdPerDay)} />
                            <OddsStat label={t('oddsEvPerYear')} value={formatUSD(ev.usdPerYear)} />
                        </div>
                    )}
                    <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-tertiary)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        💡 {t('oddsExplanation')}
                    </div>
                </>
            )}
        </div>
    );
}

function OddsStat({ label, value, accent }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
            <div
                className="font-mono"
                style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--text-primary)' }}
            >
                {value}
            </div>
        </div>
    );
}
