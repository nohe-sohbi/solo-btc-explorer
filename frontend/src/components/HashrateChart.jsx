import { useMemo } from 'react';

// =============================================================================
// COMPONENT: HashrateChart
// A dependency-free SVG sparkline of recent hashrate samples. Renders an area +
// line chart and surfaces current / peak / average figures. Works identically in
// backend and demo mode since it only consumes the sampled `data` array.
// =============================================================================
const VIEW_W = 100;
const VIEW_H = 32;
const PAD_TOP = 3; // leave headroom so the peak isn't clipped

export default function HashrateChart({ data, formatHashrate, t }) {
    const { linePath, areaPath, current, peak, average } = useMemo(() => {
        if (!data || data.length === 0) {
            return { linePath: '', areaPath: '', current: 0, peak: 0, average: 0 };
        }

        const peak = Math.max(...data);
        const average = data.reduce((a, b) => a + b, 0) / data.length;
        const current = data[data.length - 1];
        const max = peak > 0 ? peak : 1;

        // A single sample can't draw a line; render a flat baseline instead.
        const denom = data.length > 1 ? data.length - 1 : 1;
        const points = data.map((v, i) => {
            const x = (i / denom) * VIEW_W;
            const y = VIEW_H - (v / max) * (VIEW_H - PAD_TOP);
            return [x, y];
        });

        const linePath = points
            .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
            .join(' ');

        const areaPath =
            `M0,${VIEW_H} ` +
            points.map(([x, y]) => `L${x.toFixed(2)},${y.toFixed(2)}`).join(' ') +
            ` L${VIEW_W},${VIEW_H} Z`;

        return { linePath, areaPath, current, peak, average };
    }, [data]);

    const hasData = data && data.length > 1;

    return (
        <div className="glass-card panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 className="panel__title" style={{ marginBottom: 0 }}>{t('hashrateChartTitle')}</h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('lastSamples')}</span>
            </div>

            {hasData ? (
                <svg
                    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                    preserveAspectRatio="none"
                    style={{ width: '100%', height: '120px', display: 'block' }}
                >
                    <defs>
                        <linearGradient id="hashrateFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#hashrateFill)" />
                    <path
                        d={linePath}
                        fill="none"
                        stroke="var(--gold)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                </svg>
            ) : (
                <div style={{
                    height: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)'
                }}>
                    {t('chartWaiting')}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 'var(--space-3)' }}>
                <ChartStat label={t('chartCurrent')} value={formatHashrate(current)} accent />
                <ChartStat label={t('chartPeak')} value={formatHashrate(peak)} />
                <ChartStat label={t('chartAverage')} value={formatHashrate(average)} />
            </div>
        </div>
    );
}

function ChartStat({ label, value, accent }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
            <div
                className="font-mono"
                style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--text-primary)' }}
            >
                {value}
            </div>
        </div>
    );
}
