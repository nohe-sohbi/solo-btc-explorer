import { useMemo } from 'react';

// =============================================================================
// COMPONENT: OddsPanel
// Educational "what are my real chances?" widget. From the current hashrate and
// the network difficulty it derives the expected time to solve a block and the
// probability of doing so over common horizons, using the standard Bitcoin
// proof-of-work model: a block needs, on average, difficulty * 2^32 hashes.
// Works identically in backend and demo mode — it only consumes plain numbers.
// =============================================================================

const HASHES_PER_DIFFICULTY = 2 ** 32; // expected hashes per unit of difficulty
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

// Format a (potentially astronomically large) duration in seconds into a short,
// human-readable string. Solo CPU mining lands in the "billions of years" range,
// so we fall back to scientific notation once years get unwieldy.
function formatTimespan(seconds, t) {
    if (!isFinite(seconds) || seconds <= 0) return '—';
    if (seconds < 60) return `${seconds.toFixed(0)} s`;
    if (seconds < SECONDS_PER_DAY) {
        const h = seconds / 3600;
        return `${h.toFixed(1)} h`;
    }
    if (seconds < SECONDS_PER_YEAR) {
        const d = seconds / SECONDS_PER_DAY;
        return `${d.toFixed(1)} ${t('oddsDays')}`;
    }
    const years = seconds / SECONDS_PER_YEAR;
    if (years < 1e6) return `${Math.round(years).toLocaleString()} ${t('oddsYears')}`;
    // e.g. "3.2e+12 years" — keeps absurd scales readable.
    return `${years.toExponential(2)} ${t('oddsYears')}`;
}

// "1 in N" odds from a probability, rendered compactly.
function formatOdds(probability, t) {
    if (!isFinite(probability) || probability <= 0) return '—';
    if (probability >= 1) return t('oddsCertain');
    const n = 1 / probability;
    if (n < 1e6) return `1 ${t('oddsIn')} ${Math.round(n).toLocaleString()}`;
    return `1 ${t('oddsIn')} ${n.toExponential(2)}`;
}

export default function OddsPanel({ hashrate, networkDifficulty, t }) {
    const { expectedSeconds, probPerDay, probPerYear, hasData } = useMemo(() => {
        const diff = networkDifficulty > 0 ? networkDifficulty : 0;
        const rate = hashrate > 0 ? hashrate : 0;

        if (diff <= 0 || rate <= 0) {
            return { expectedSeconds: Infinity, probPerDay: 0, probPerYear: 0, hasData: false };
        }

        const expectedHashes = diff * HASHES_PER_DIFFICULTY;
        const expectedSeconds = expectedHashes / rate;

        // Block discovery is a Poisson process: P(at least one in T) = 1 - e^(-T/λ),
        // where λ is the expected time to a single block.
        const probPerDay = 1 - Math.exp(-SECONDS_PER_DAY / expectedSeconds);
        const probPerYear = 1 - Math.exp(-SECONDS_PER_YEAR / expectedSeconds);

        return { expectedSeconds, probPerDay, probPerYear, hasData: true };
    }, [hashrate, networkDifficulty]);

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
