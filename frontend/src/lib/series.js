// Hashrate time series for the live chart: a rolling one-sample-per-second buffer,
// windowed to the selected period, downsampled, and turned into SVG paths.
// Pure functions only, so the chart component stays a thin renderer.

// One hour of per-second samples is the longest period the chart offers.
export const SAMPLE_CAPACITY = 3600;

// Downsampling target: more points than this adds no visible detail.
export const CHART_POINTS = 120;

// The selectable chart periods. `samples` is the window length in seconds; the
// *Key fields name the i18n entries for the tab and the axis labels.
export const PERIODS = [
    { id: '1m', samples: 60, labelKey: 'period1m', startKey: 'chartSpan1mFull', midKey: 'chartSpan1mHalf' },
    { id: '5m', samples: 300, labelKey: 'period5m', startKey: 'chartSpan5mFull', midKey: 'chartSpan5mHalf' },
    { id: '1h', samples: 3600, labelKey: 'period1h', startKey: 'chartSpan1hFull', midKey: 'chartSpan1hHalf' },
];

// appendSample returns the buffer with `value` added, dropping the oldest samples
// beyond `capacity`. It serves the hashrate buffer and the parallel "was the tab
// hidden" buffer alike.
export function appendSample(samples, value, capacity = SAMPLE_CAPACITY) {
    const next = [...samples, value];
    return next.length > capacity ? next.slice(next.length - capacity) : next;
}

// bucketSizeFor returns how many one-second samples are averaged into each chart
// point so a window never needs more than `maxPoints` points.
export function bucketSizeFor(windowSize, maxPoints = CHART_POINTS) {
    return Math.max(1, Math.ceil(windowSize / maxPoints));
}

// slotsFor returns how many points a *full* window holds, i.e. the width of the
// time axis in points. A series with fewer points occupies the right-hand part.
export function slotsFor(windowSize, maxPoints = CHART_POINTS) {
    return Math.ceil(windowSize / bucketSizeFor(windowSize, maxPoints));
}

// windowSeries takes the most recent `windowSize` samples and averages them into
// buckets (aligned on the newest sample) so long periods stay cheap to draw while
// keeping the time scale honest.
export function windowSeries(samples, windowSize, maxPoints = CHART_POINTS) {
    const recent = samples.slice(-windowSize);
    const bucketSize = bucketSizeFor(windowSize, maxPoints);

    const series = [];
    for (let end = recent.length; end > 0; end -= bucketSize) {
        const bucket = recent.slice(Math.max(0, end - bucketSize), end);
        series.unshift(bucket.reduce((sum, value) => sum + value, 0) / bucket.length);
    }
    return series;
}

// slowSpans locates the stretches where the tab was hidden (flags[i] is true), as
// fractions of the chart width, using the same bucketing and alignment as
// windowSeries so the bands line up with the curve. Each band is widened by half
// a step so even a single hidden sample stays visible.
export function slowSpans(flags, windowSize, maxPoints = CHART_POINTS) {
    const recent = flags.slice(-windowSize);
    const bucketSize = bucketSizeFor(windowSize, maxPoints);
    const slots = slotsFor(windowSize, maxPoints);

    const buckets = [];
    for (let end = recent.length; end > 0; end -= bucketSize) {
        buckets.unshift(recent.slice(Math.max(0, end - bucketSize), end).some(Boolean));
    }

    const lastSlot = Math.max(1, slots - 1);
    const offset = Math.max(0, slots - buckets.length);
    const half = 0.5 / lastSlot;
    const spans = [];
    let start = null;
    buckets.forEach((slow, index) => {
        if (slow && start === null) start = index;
        const closes = start !== null && (!slow || index === buckets.length - 1);
        if (!closes) return;
        const last = slow ? index : index - 1;
        spans.push({
            from: Math.max(0, (offset + start) / lastSlot - half),
            to: Math.min(1, (offset + last) / lastSlot + half),
        });
        start = null;
    });
    return spans;
}

// chartRange picks the vertical range with a little headroom, so the line never
// touches the frame. A flat or empty series still gets a usable, non-zero range.
export function chartRange(series) {
    if (series.length === 0) return { min: 0, max: 1 };
    const low = Math.min(...series);
    const high = Math.max(...series);
    if (high === low) {
        const pad = high === 0 ? 1 : Math.abs(high) * 0.1;
        return { min: Math.max(0, low - pad), max: high + pad };
    }
    const pad = (high - low) * 0.15;
    return { min: Math.max(0, low - pad), max: high + pad };
}

// buildPaths maps a series onto a width x height box and returns the stroke path
// and the closed path used for the area fill. `slots` is the number of points a
// full window holds: a shorter series (a session that just started) is
// right-aligned instead of being stretched across the whole time axis.
export function buildPaths(series, { width, height, min, max, slots = series.length }) {
    if (series.length === 0) return { line: '', area: '' };

    const span = max - min || 1;
    const lastSlot = Math.max(1, slots - 1);
    const offset = Math.max(0, slots - series.length);
    const points = series.map((value, i) => [
        ((offset + i) / lastSlot) * width,
        height - ((value - min) / span) * height,
    ]);

    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z`;
    return { line, area };
}
