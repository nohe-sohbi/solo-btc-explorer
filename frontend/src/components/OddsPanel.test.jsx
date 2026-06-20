// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import OddsPanel from './OddsPanel.jsx';

const t = (k) => k;

afterEach(cleanup);

describe('OddsPanel', () => {
    it('shows the waiting state before any hashrate', () => {
        render(<OddsPanel hashrate={0} networkDifficulty={1e12} t={t} />);
        expect(screen.getByText('oddsWaiting')).toBeTruthy();
    });

    it('renders the odds stats once data is available', () => {
        render(<OddsPanel hashrate={1e6} networkDifficulty={1e12} t={t} />);
        expect(screen.getByText('oddsExpectedTime')).toBeTruthy();
        expect(screen.getByText('oddsPerDay')).toBeTruthy();
        expect(screen.getByText('oddsPerYear')).toBeTruthy();
        // The waiting placeholder must be gone.
        expect(screen.queryByText('oddsWaiting')).toBeNull();
    });
});
