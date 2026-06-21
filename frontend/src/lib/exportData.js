// Client-side export helpers. The dashboard already holds the share/session
// history in memory (fetched from the backend, or produced by the in-browser
// demo engine), so we can turn it into a downloadable CSV/JSON file without a
// round-trip. This keeps the Export feature working identically in the hosted
// backend build and the backend-free demo build.

// csvEscape quotes a value when it contains a comma, quote or newline, doubling
// any embedded quotes per RFC 4180.
function csvEscape(value) {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

// toCSV renders an array of row objects to a CSV string. `columns` is an array
// of { key, label } pairs that fixes the column order and header names.
export function toCSV(rows, columns) {
    const header = columns.map((c) => csvEscape(c.label)).join(',');
    const body = (rows || []).map((row) =>
        columns.map((c) => csvEscape(row[c.key])).join(',')
    );
    return [header, ...body].join('\n');
}

// triggerDownload saves `content` to the user's machine as `filename`. It is a
// no-op in non-browser environments (e.g. unit tests without a DOM).
export function triggerDownload(filename, content, mimeType = 'text/plain') {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
        return;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// timestampedName builds a filename like "soloforge-shares-20260621-143000.csv".
export function timestampedName(dataset, ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `soloforge-${dataset}-${stamp}.${ext}`;
}

// Column layouts mirror the backend CSV export so the two stay consistent.
export const SHARE_COLUMNS = [
    { key: 'timestamp', label: 'timestamp' },
    { key: 'worker_id', label: 'worker_id' },
    { key: 'worker_name', label: 'worker_name' },
    { key: 'job_id', label: 'job_id' },
    { key: 'nonce', label: 'nonce' },
    { key: 'difficulty', label: 'difficulty' },
    { key: 'accepted', label: 'accepted' },
];

export const SESSION_COLUMNS = [
    { key: 'id', label: 'id' },
    { key: 'start_time', label: 'start_time' },
    { key: 'end_time', label: 'end_time' },
    { key: 'duration', label: 'duration' },
    { key: 'total_hashes', label: 'total_hashes' },
    { key: 'best_difficulty', label: 'best_difficulty' },
];

// exportDataset downloads `rows` as CSV or JSON. `format` is 'csv' | 'json'.
export function exportDataset(dataset, rows, columns, format) {
    if (format === 'json') {
        triggerDownload(
            timestampedName(dataset, 'json'),
            JSON.stringify(rows || [], null, 2),
            'application/json'
        );
        return;
    }
    triggerDownload(
        timestampedName(dataset, 'csv'),
        toCSV(rows, columns),
        'text/csv;charset=utf-8'
    );
}
