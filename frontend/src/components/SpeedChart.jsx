import { useMemo } from 'react';
import { windowSeries, slotsFor, chartRange, buildPaths } from '../lib/series.js';
import { hashrateScale } from '../lib/format.js';

const WIDTH = 600;
const HEIGHT = 170;

// Axis labels are rounded to keep them short: one decimal below 10, whole above.
function formatTick(value) {
    return String(Number(value.toFixed(value < 10 ? 1 : 0)));
}

// The live computing-speed curve for the chosen period. A dependency-free SVG:
// the geometry comes from lib/series.js, the colours from CSS classes.
export default function SpeedChart({ samples, period, t }) {
    const { paths, ticks } = useMemo(() => {
        const series = windowSeries(samples, period.samples);
        const range = chartRange(series);
        const { divisor } = hashrateScale(range.max);
        const middle = (range.max + range.min) / 2;
        return {
            paths: buildPaths(series, { width: WIDTH, height: HEIGHT, ...range, slots: slotsFor(period.samples) }),
            ticks: [range.max, middle, range.min].map((value) => formatTick(value / divisor)),
        };
    }, [samples, period]);

    return (
        <div className="speed-chart">
            <div className="speed-chart__axis" aria-hidden="true">
                {ticks.map((tick, index) => (
                    <span key={index}>{tick}</span>
                ))}
            </div>
            <div className="speed-chart__plot">
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={t('chartAria')}
                >
                    {[0, HEIGHT / 2, HEIGHT - 1].map((y) => (
                        <line key={y} className="speed-chart__grid" x1="0" x2={WIDTH} y1={y} y2={y} />
                    ))}
                    <path className="speed-chart__area" d={paths.area} />
                    <path className="speed-chart__line" d={paths.line} />
                </svg>
                <div className="speed-chart__labels" aria-hidden="true">
                    <span>{t('chartAgo', { span: t(period.startKey) })}</span>
                    <span>{t('chartAgo', { span: t(period.midKey) })}</span>
                    <span>{t('chartNow')}</span>
                </div>
            </div>
        </div>
    );
}
