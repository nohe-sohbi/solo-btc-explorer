// =============================================================================
// COMPONENT: NetworkStats
// Surfaces the live Bitcoin network context that the backend now polls from
// mempool.space (difficulty, chain tip height, total network hashrate, BTC
// price). It renders only the fields that are actually present, so it degrades
// gracefully: the backend build shows the full row, while the demo build (which
// only knows the network difficulty) shows just that. The whole panel hides when
// no context is available yet.
// =============================================================================

import { formatHashrate, formatNumber } from '../lib/format';

function NetworkStat({ label, value }) {
    return (
        <div style={{ textAlign: 'center', minWidth: '110px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
            <div className="font-mono" style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{value}</div>
        </div>
    );
}

export default function NetworkStats({ stats, t }) {
    const difficulty = stats?.network_difficulty;
    const height = stats?.block_height;
    const netHashrate = stats?.network_hashrate;
    const price = stats?.btc_price_usd;

    const items = [];
    if (height > 0) {
        items.push({ label: t('blockHeight'), value: `#${height.toLocaleString()}` });
    }
    if (difficulty > 0) {
        items.push({ label: t('networkDifficulty'), value: formatNumber(difficulty) });
    }
    if (netHashrate > 0) {
        items.push({ label: t('networkHashrate'), value: formatHashrate(netHashrate) });
    }
    if (price > 0) {
        items.push({ label: t('btcPrice'), value: `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` });
    }

    if (items.length === 0) return null;

    return (
        <div
            className="glass-card"
            style={{
                padding: 'var(--space-4) var(--space-6)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-4)'
            }}
        >
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {t('networkTitle')}
            </div>
            {items.map((it) => (
                <NetworkStat key={it.label} label={it.label} value={it.value} />
            ))}
        </div>
    );
}
