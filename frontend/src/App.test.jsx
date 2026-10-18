// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor, within } from '@testing-library/react';

// ---- A controllable stand-in for the backend: stats stream + REST API ----------
const backend = vi.hoisted(() => {
    const state = {
        listeners: new Set(),
        stats: null,
        lastMessage: null,
        socketOpen: true,
        running: false,
        config: { wallet_address: '', pool_url: 'solo.ckpool.org', pool_port: 3333, max_cpu_percent: 80, num_workers: 4 },
        history: { shares: [], blocks: [] },
        sessions: [],
        reconnect: null,
        api: null,
    };
    state.api = {
        get: vi.fn(async (endpoint) => {
            const path = endpoint.split('?')[0];
            if (path === '/config') return { ...state.config };
            if (path === '/status') return { running: state.running };
            if (path === '/history') return state.history;
            if (path === '/sessions') return state.sessions;
            throw new Error(`unexpected GET ${endpoint}`);
        }),
        post: vi.fn(async (endpoint) => {
            if (endpoint === '/mining/start') state.running = true;
            if (endpoint === '/mining/stop') state.running = false;
            return {};
        }),
        put: vi.fn(async (endpoint, body) => {
            if (endpoint === '/config') state.config = { ...body };
            return {};
        }),
        delete: vi.fn(async () => ({})),
    };
    state.reconnect = vi.fn();
    return state;
});

vi.mock('./hooks/useWebSocket.js', async () => {
    const { useReducer, useEffect } = await import('react');
    return {
        useWebSocket: () => {
            const [, rerender] = useReducer((n) => n + 1, 0);
            useEffect(() => {
                backend.listeners.add(rerender);
                return () => backend.listeners.delete(rerender);
            }, []);
            return {
                isConnected: backend.socketOpen,
                stats: backend.stats,
                lastMessage: backend.lastMessage,
                reconnect: backend.reconnect,
            };
        },
        useAPI: () => backend.api,
    };
});

const { default: App } = await import('./App.jsx');

const VALID_ADDRESS = '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9';
const runningStats = (overrides = {}) => ({
    hashrate: 475260,
    total_hashes: 8_040_000,
    total_shares: 113,
    accepted_shares: 113,
    rejected_shares: 0,
    best_difficulty: 0.0129,
    uptime_seconds: 16,
    network_difficulty: 1.21e14,
    block_height: 952143,
    block_reward_btc: 3.125,
    btc_price_usd: 98400,
    connected: true,
    authorized: true,
    workers: [
        { id: 1, name: 'cpu-worker-1', running: true, hashrate: 114680 },
        { id: 2, name: 'cpu-worker-2', running: true, hashrate: 121770 },
    ],
    ...overrides,
});

// Pushes new stats / a WebSocket message to every subscribed component.
function emit({ stats, message } = {}) {
    act(() => {
        if (stats !== undefined) backend.stats = stats;
        if (message !== undefined) backend.lastMessage = message;
        backend.listeners.forEach((rerender) => rerender());
    });
}

const settle = () => act(async () => { await Promise.resolve(); });

function resetBackend() {
    backend.listeners.clear();
    backend.stats = null;
    backend.lastMessage = null;
    backend.socketOpen = true;
    backend.running = false;
    backend.config = { wallet_address: '', pool_url: 'solo.ckpool.org', pool_port: 3333, max_cpu_percent: 80, num_workers: 4 };
    backend.history = { shares: [], blocks: [] };
    backend.sessions = [];
    for (const fn of [backend.reconnect, ...Object.values(backend.api)]) fn.mockClear();
}

beforeEach(() => {
    resetBackend();
    window.localStorage.clear();
    window.localStorage.setItem('soloforge-lang', 'fr'); // jsdom reports an English browser
    window.location.hash = '';
    window.scrollTo = vi.fn();
    document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

async function renderApp() {
    render(<App />);
    await settle();
    await settle();
}

async function startFromWelcome() {
    fireEvent.change(screen.getByLabelText('Votre adresse Bitcoin'), { target: { value: VALID_ADDRESS } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Démarrer avec cette adresse' })[0]);
    await settle();
    await settle();
}

describe('first visit', () => {
    it('welcomes a newcomer and hides the dashboard controls', async () => {
        await renderApp();
        expect(screen.getByRole('heading', { level: 1, name: 'Bienvenue sur SoloForge' })).toBeTruthy();
        expect(screen.getByText('Prêt à démarrer')).toBeTruthy();
        expect(screen.queryByRole('switch', { name: 'Vue avancée' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Démarrer le mining' })).toBeNull();
    });

    it('saves the address, starts mining and lands on the dashboard', async () => {
        await renderApp();
        await startFromWelcome();

        expect(backend.api.put).toHaveBeenCalledWith('/config', expect.objectContaining({ wallet_address: VALID_ADDRESS }));
        expect(backend.api.post).toHaveBeenCalledWith('/mining/start', {});
        expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeTruthy();
        expect(window.localStorage.getItem('soloforge-welcomed')).toBe('true');
    });

    it('is skipped for a returning visitor', async () => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
        await renderApp();
        expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Démarrer le mining' })).toBeTruthy();
    });

    it('is skipped when mining is already running on the server', async () => {
        backend.running = true;
        await renderApp();
        expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeTruthy();
    });
});

describe('dashboard', () => {
    beforeEach(() => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
        backend.running = true;
        backend.config.wallet_address = VALID_ADDRESS;
    });

    it('shows the live numbers in plain language', async () => {
        await renderApp();
        emit({ stats: runningStats() });

        expect(screen.getByText('475.26')).toBeTruthy();
        expect(screen.getByText('KH/s')).toBeTruthy();
        expect(screen.getByText(/environ 475\s?000 essais par seconde/)).toBeTruthy();
        expect(screen.getByText('8.04M')).toBeTruthy();
        expect(screen.getByText('113')).toBeTruthy();
        expect(screen.getByText('0.0129')).toBeTruthy();
        expect(screen.getByText('cpu-worker-1')).toBeTruthy();
        expect(screen.getByText('2 actifs')).toBeTruthy();
        expect(screen.getByText('3,125 BTC')).toBeTruthy();
        expect(screen.getByText(/Mining en cours/)).toBeTruthy();
    });

    it('narrates what happens in the activity feed', async () => {
        await renderApp();
        emit({ stats: runningStats({ accepted_shares: 0, best_difficulty: 0, connected: false }) });
        emit({ stats: runningStats({ accepted_shares: 12, best_difficulty: 0.002 }) });

        const feed = screen.getByRole('heading', { name: 'Ce qui se passe' }).closest('section');
        expect(within(feed).getByText(/12 preuves de travail validées par le pool/)).toBeTruthy();
        expect(within(feed).getByText(/Nouveau record : votre meilleur essai monte à 0.0020/)).toBeTruthy();
        expect(within(feed).getByText(/Connecté au pool solo.ckpool.org/)).toBeTruthy();
    });

    it('stops mining from the top bar', async () => {
        await renderApp();
        emit({ stats: runningStats() });
        fireEvent.click(screen.getByRole('button', { name: 'Arrêter le mining' }));
        await settle();
        expect(backend.api.post).toHaveBeenCalledWith('/mining/stop', {});
        expect(screen.getByRole('button', { name: 'Démarrer le mining' })).toBeTruthy();
    });

    it('reveals the advanced cards and remembers the choice', async () => {
        await renderApp();
        emit({ stats: runningStats() });
        expect(screen.queryByText('Connexion au pool')).toBeNull();

        fireEvent.click(screen.getByRole('switch', { name: 'Vue avancée' }));
        expect(screen.getByText('Connexion au pool')).toBeTruthy();
        expect(screen.getByText('Supervision')).toBeTruthy();
        expect(screen.getByText('113 / 0 · 100 %')).toBeTruthy();
        expect(screen.getByText('Reconnexions')).toBeTruthy();
        expect(window.localStorage.getItem('soloforge-advanced')).toBe('true');
    });

    it('shows the last job the pool sent and how long ago', async () => {
        window.localStorage.setItem('soloforge-advanced', 'true');
        await renderApp();
        emit({ stats: runningStats({ pool_last_job_age_seconds: 12, pool_last_job_id: '4f2a9c', pool_reconnects: 2 }) });
        expect(screen.getByText('il y a 12 s · 4f2a9c…')).toBeTruthy();
    });

    it('lets the user add and remove workers', async () => {
        await renderApp();
        emit({ stats: runningStats() });
        fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }));
        await settle();
        expect(backend.api.post).toHaveBeenCalledWith('/workers', { name: '' });

        fireEvent.click(screen.getByRole('button', { name: 'Retirer cpu-worker-2' }));
        await settle();
        expect(backend.api.delete).toHaveBeenCalledWith('/workers/2');
    });
});

describe('starting from the top bar', () => {
    it('sends the user to Settings when the saved address is unusable', async () => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
        await renderApp();
        fireEvent.click(screen.getByRole('button', { name: 'Démarrer le mining' }));
        await settle();

        expect(backend.api.post).not.toHaveBeenCalledWith('/mining/start', {});
        expect(screen.getByRole('heading', { level: 1, name: 'Configuration' })).toBeTruthy();
        expect(screen.getByText('Saisissez une adresse Bitcoin pour démarrer.')).toBeTruthy();
    });

    it('starts with the saved address when it is valid', async () => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
        backend.config.wallet_address = VALID_ADDRESS;
        await renderApp();
        fireEvent.click(screen.getByRole('button', { name: 'Démarrer le mining' }));
        await settle();
        expect(backend.api.post).toHaveBeenCalledWith('/mining/start', {});
    });
});

describe('state banners', () => {
    beforeEach(() => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
        backend.running = true;
        backend.config.wallet_address = VALID_ADDRESS;
    });

    it('warns about a lost pool connection only once it has lasted', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        await renderApp();
        emit({ stats: runningStats({ connected: false }) });
        expect(screen.queryByText('Connexion au pool interrompue')).toBeNull();

        await act(async () => { vi.advanceTimersByTime(4100); });
        expect(screen.getByText('Connexion au pool interrompue')).toBeTruthy();

        emit({ stats: runningStats({ connected: true }) });
        expect(screen.queryByText('Connexion au pool interrompue')).toBeNull();
    });

    it('tells how long until the next pool attempt and lets the user retry right now', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        await renderApp();
        emit({ stats: runningStats({ connected: false, pool_retry_in_seconds: 8, pool_last_error: 'dial tcp: i/o timeout' }) });
        await act(async () => { vi.advanceTimersByTime(4100); });

        expect(screen.getByText(/Nouvelle tentative dans 8 s/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Réessayer maintenant' }));
        expect(backend.api.post).toHaveBeenCalledWith('/pool/retry', {});
    });

    it('keeps the technical error for the advanced view', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        await renderApp();
        emit({ stats: runningStats({ connected: false, pool_retry_in_seconds: 8, pool_last_error: 'dial tcp: i/o timeout' }) });
        await act(async () => { vi.advanceTimersByTime(4100); });
        expect(screen.queryByText(/dial tcp: i\/o timeout/)).toBeNull();

        fireEvent.click(screen.getByRole('switch', { name: 'Vue avancée' }));
        expect(screen.getByText(/dernière erreur : dial tcp: i\/o timeout/)).toBeTruthy();
    });

    it('offers no retry button when no reconnection is scheduled', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        await renderApp();
        emit({ stats: runningStats({ connected: false }) });
        await act(async () => { vi.advanceTimersByTime(4100); });
        expect(screen.getByText('Connexion au pool interrompue')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Réessayer maintenant' })).toBeNull();
    });

    it('warns when the server is unreachable and offers a retry', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        backend.socketOpen = false;
        await renderApp();
        await act(async () => { vi.advanceTimersByTime(4100); });

        expect(screen.getByText('Serveur injoignable', { selector: '.banner__title' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Réessayer maintenant' }));
        expect(backend.reconnect).toHaveBeenCalled();
    });

    it('suggests backing off a very high CPU limit with one click', async () => {
        backend.config.max_cpu_percent = 100;
        await renderApp();
        emit({ stats: runningStats() });
        expect(screen.getByText('Votre ordinateur travaille à fond')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Passer à 60 %' }));
        await settle();
        expect(backend.api.put).toHaveBeenCalledWith('/config', expect.objectContaining({ max_cpu_percent: 60 }));
    });

    it('does not warn at a sensible CPU limit', async () => {
        await renderApp();
        emit({ stats: runningStats() });
        expect(screen.queryByText('Votre ordinateur travaille à fond')).toBeNull();
    });
});

describe('a block candidate', () => {
    const blockMessage = { type: 'block', timestamp: Date.now(), data: { difficulty: 1.214e14 } };

    beforeEach(() => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
        backend.running = true;
    });

    it('opens the celebration dialog and closes it with Escape', async () => {
        await renderApp();
        emit({ stats: runningStats() });
        emit({ message: blockMessage });

        const dialog = screen.getByRole('dialog', { name: /bloc candidat/i });
        expect(dialog.textContent).toContain('121,4 T');
        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('records the event in the activity feed', async () => {
        await renderApp();
        emit({ stats: runningStats() });
        emit({ message: blockMessage });
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.getByText('Bloc candidat trouvé !')).toBeTruthy();
    });

    it('takes the user to the Blocks tab of the history', async () => {
        backend.history = { shares: [], blocks: [{ timestamp: Date.now(), height: 952143, difficulty: 1.214e14 }] };
        await renderApp();
        emit({ stats: runningStats() });
        emit({ message: blockMessage });

        fireEvent.click(screen.getByRole('button', { name: "Voir dans l'historique" }));
        await settle();
        expect(screen.getByRole('heading', { level: 1, name: 'Historique' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Blocs' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByText('Candidat')).toBeTruthy();
    });
});

describe('navigation and preferences', () => {
    beforeEach(() => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
    });

    it('moves between screens from the sidebar and keeps the URL in sync', async () => {
        await renderApp();
        const nav = screen.getByRole('navigation', { name: 'Navigation principale' });

        // The route follows the hash, and jsdom reports hash changes asynchronously.
        fireEvent.click(within(nav).getByRole('button', { name: 'Mes chances' }));
        await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Mes chances de gagner' })).toBeTruthy());
        expect(window.location.hash).toBe('#/chances');
        expect(within(nav).getByRole('button', { name: 'Mes chances' }).getAttribute('aria-current')).toBe('page');

        fireEvent.click(within(nav).getByRole('button', { name: 'Aide et vocabulaire' }));
        await waitFor(() => expect(screen.getByText('Le vocabulaire en 30 secondes')).toBeTruthy());
    });

    it('opens the screen named in the URL', async () => {
        window.location.hash = '#/history';
        await renderApp();
        expect(screen.getByRole('heading', { level: 1, name: 'Historique' })).toBeTruthy();
    });

    it('switches the whole interface to English and remembers it', async () => {
        await renderApp();
        fireEvent.click(screen.getByRole('button', { name: 'Changer de langue' }));
        expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
        expect(document.documentElement.lang).toBe('en');
        expect(window.localStorage.getItem('soloforge-lang')).toBe('en');
    });

    it('switches the theme and remembers it', async () => {
        await renderApp();
        fireEvent.click(screen.getByRole('button', { name: /Sombre/ }));
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(window.localStorage.getItem('soloforge-theme')).toBe('dark');
        fireEvent.click(screen.getByRole('button', { name: /Clair/ }));
        expect(document.documentElement.dataset.theme).toBe('light');
    });
});

describe('resetting the statistics', () => {
    beforeEach(() => {
        window.localStorage.setItem('soloforge-welcomed', 'true');
        window.location.hash = '#/config';
    });

    it('asks for confirmation, then erases and says so', async () => {
        await renderApp();
        fireEvent.click(screen.getByRole('button', { name: /Réinitialiser les statistiques/ }));
        expect(screen.getByRole('alertdialog')).toBeTruthy();
        expect(backend.api.post).not.toHaveBeenCalledWith('/stats/reset', {});

        fireEvent.click(screen.getByRole('button', { name: 'Effacer définitivement' }));
        await waitFor(() => expect(backend.api.post).toHaveBeenCalledWith('/stats/reset', {}));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
        expect(screen.getByText('Statistiques effacées.')).toBeTruthy();
    });

    it('does nothing when the user cancels', async () => {
        await renderApp();
        fireEvent.click(screen.getByRole('button', { name: /Réinitialiser les statistiques/ }));
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Annuler' }));
        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(backend.api.post).not.toHaveBeenCalledWith('/stats/reset', {});
    });
});
