import { describe, it, expect } from 'vitest';
import { toCSV, timestampedName, SHARE_COLUMNS } from './exportData.js';

describe('toCSV', () => {
    it('renders a header row from the column labels', () => {
        const csv = toCSV([], SHARE_COLUMNS);
        expect(csv).toBe('timestamp,worker_id,worker_name,job_id,nonce,difficulty,accepted');
    });

    it('renders one line per row in column order', () => {
        const rows = [
            { timestamp: '2026-06-21T00:00:00Z', worker_id: 1, worker_name: 'w-a', job_id: 'j1', nonce: 'abc', difficulty: 1.5, accepted: true },
        ];
        const csv = toCSV(rows, SHARE_COLUMNS);
        const lines = csv.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[1]).toBe('2026-06-21T00:00:00Z,1,w-a,j1,abc,1.5,true');
    });

    it('escapes values containing commas, quotes or newlines', () => {
        const rows = [{ worker_name: 'a,b' }, { worker_name: 'quote"d' }];
        const cols = [{ key: 'worker_name', label: 'worker_name' }];
        const csv = toCSV(rows, cols);
        const lines = csv.split('\n');
        expect(lines[1]).toBe('"a,b"');
        expect(lines[2]).toBe('"quote""d"');
    });

    it('tolerates a null/undefined row list', () => {
        expect(toCSV(null, SHARE_COLUMNS).split('\n')).toHaveLength(1);
    });
});

describe('timestampedName', () => {
    it('builds a dataset- and extension-aware filename', () => {
        const name = timestampedName('shares', 'csv');
        expect(name).toMatch(/^soloforge-shares-\d{8}-\d{6}\.csv$/);
    });
});
