// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import WelcomeScreen from './WelcomeScreen.jsx';
import ConfigScreen from './ConfigScreen.jsx';
import ChancesScreen from './ChancesScreen.jsx';
import HistoryScreen from './HistoryScreen.jsx';
import HelpScreen from './HelpScreen.jsx';
import { createTranslator } from '../i18n/index.js';

const t = createTranslator('fr');
const VALID_ADDRESS = '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9';
const network = { difficulty: 1.21e14, rewardBTC: 3.125, priceUSD: 98400, height: 952143, hashrate: 0 };

afterEach(cleanup);

// ---------------------------------------------------------------- Welcome (server build)
describe('WelcomeScreen (own-address mode)', () => {
    const renderWelcome = (props = {}) =>
        render(<WelcomeScreen t={t} lang="fr" theme="light" network={network} savedWallet="" onStart={vi.fn()} onOpenHelp={() => {}} {...props} />);

    it('explains Bitcoin in three ideas before asking for anything', () => {
        renderWelcome();
        expect(screen.getByRole('heading', { name: /loterie Bitcoin/ })).toBeTruthy();
        expect(screen.getByText('Bitcoin en 3 idées')).toBeTruthy();
        expect(screen.getByText(/Un grand cahier de comptes partagé/)).toBeTruthy();
        expect(screen.getByText(/3,125 bitcoins/)).toBeTruthy();
    });

    it('cannot start without a valid address, and says why', () => {
        renderWelcome();
        for (const button of screen.getAllByRole('button', { name: /Démarrer/ })) {
            expect(button.disabled).toBe(true);
        }
        expect(screen.getByText('Saisissez une adresse Bitcoin pour démarrer.')).toBeTruthy();
    });

    it('blocks a mistyped address with an explanation', () => {
        renderWelcome();
        fireEvent.change(screen.getByLabelText('Votre adresse Bitcoin'), { target: { value: VALID_ADDRESS.slice(0, -1) + '8' } });
        expect(screen.getByRole('alert').textContent).toContain("n'est pas valide");
        expect(screen.getByText(/Corrigez l'adresse/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Démarrer avec cette adresse' }).disabled).toBe(true);
    });

    it('starts with the typed valid address', async () => {
        const onStart = vi.fn().mockResolvedValue(true);
        renderWelcome({ onStart });
        fireEvent.change(screen.getByLabelText('Votre adresse Bitcoin'), { target: { value: VALID_ADDRESS } });
        fireEvent.click(screen.getByRole('button', { name: 'Démarrer avec cette adresse' }));
        await waitFor(() => expect(onStart).toHaveBeenCalledWith(VALID_ADDRESS));
    });

    it('pre-fills the saved address', () => {
        renderWelcome({ savedWallet: VALID_ADDRESS });
        expect(screen.getByLabelText('Votre adresse Bitcoin').value).toBe(VALID_ADDRESS);
        expect(screen.getByRole('button', { name: 'Démarrer avec cette adresse' }).disabled).toBe(false);
    });

    it('sends the visitor to the glossary', () => {
        const onOpenHelp = vi.fn();
        renderWelcome({ onOpenHelp });
        fireEvent.click(screen.getByRole('button', { name: 'Aide et vocabulaire' }));
        expect(onOpenHelp).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------- Config
function makeSession(overrides = {}) {
    return {
        running: false,
        stats: { hashrate: 0 },
        network,
        history: { shares: [], blocks: [] },
        sessions: [],
        config: { wallet_address: VALID_ADDRESS, pool_url: 'solo.ckpool.org', pool_port: 3333, max_cpu_percent: 80, num_workers: 4 },
        actions: { saveConfig: vi.fn().mockResolvedValue(true) },
        ...overrides,
    };
}

describe('ConfigScreen', () => {
    const renderConfig = (session, onRequestReset = vi.fn(), onNavigate = vi.fn()) =>
        render(<ConfigScreen t={t} lang="fr" session={session} onRequestReset={onRequestReset} onNavigate={onNavigate} />);

    it('starts clean: nothing to save', () => {
        renderConfig(makeSession());
        expect(screen.getByText('Tout est enregistré')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(true);
    });

    it('tracks unsaved edits and saves the whole configuration', async () => {
        const session = makeSession();
        renderConfig(session);
        fireEvent.change(screen.getByLabelText(/Limite de charge du processeur/), { target: { value: '60' } });

        expect(screen.getByText('Modifications non enregistrées')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() =>
            expect(session.actions.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ max_cpu_percent: 60, num_workers: 4 }))
        );
        await waitFor(() => expect(screen.getByText('Tout est enregistré')).toBeTruthy());
    });

    it('cancels edits', () => {
        renderConfig(makeSession());
        fireEvent.change(screen.getByLabelText(/Limite de charge du processeur/), { target: { value: '30' } });
        fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
        expect(screen.getByLabelText(/Limite de charge du processeur/).value).toBe('80');
        expect(screen.getByText('Tout est enregistré')).toBeTruthy();
    });

    it('describes the CPU limit in words', () => {
        renderConfig(makeSession());
        expect(screen.getByText(/À 80 %, votre ordinateur reste réactif/)).toBeTruthy();
        fireEvent.change(screen.getByLabelText(/Limite de charge du processeur/), { target: { value: '100' } });
        expect(screen.getByText(/À 100 %, votre ordinateur va chauffer/)).toBeTruthy();
        fireEvent.change(screen.getByLabelText(/Limite de charge du processeur/), { target: { value: '30' } });
        expect(screen.getByText(/À 30 %, discret/)).toBeTruthy();
    });

    it('locks the address, pool and worker count while mining, but not the CPU limit', () => {
        renderConfig(makeSession({ running: true, stats: { hashrate: 475260 } }));
        expect(screen.getByLabelText('Adresse de réception').disabled).toBe(true);
        expect(screen.getByLabelText('Adresse du pool').disabled).toBe(true);
        expect(screen.getByLabelText('Port').disabled).toBe(true);
        expect(screen.getByLabelText(/Nombre de workers/).disabled).toBe(true);
        expect(screen.getByLabelText(/Limite de charge du processeur/).disabled).toBe(false);
        expect(screen.getByText(/Verrouillé pendant le mining. Arrêtez-le pour modifier l'adresse/)).toBeTruthy();
    });

    it('unlocks everything when stopped', () => {
        renderConfig(makeSession());
        expect(screen.getByLabelText('Adresse de réception').disabled).toBe(false);
        expect(screen.getByLabelText(/Nombre de workers/).disabled).toBe(false);
        expect(screen.queryByText(/Verrouillé/)).toBeNull();
    });

    it('refuses to save a mistyped address', () => {
        renderConfig(makeSession());
        fireEvent.change(screen.getByLabelText('Adresse de réception'), { target: { value: VALID_ADDRESS.slice(0, -1) + '8' } });
        expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(true);
    });

    it('summarises the live settings and the odds', () => {
        renderConfig(makeSession({ running: true, stats: { hashrate: 475260 } }));
        const summary = screen.getByRole('heading', { name: 'Avec ces réglages' }).closest('section');
        expect(within(summary).getByText('≈ 475.26 KH/s')).toBeTruthy();
        expect(within(summary).getByText('≈ 80 %')).toBeTruthy();
        expect(within(summary).getByText(/1 sur 12,\d billions/)).toBeTruthy();
    });

    it('offers to explore the odds from the summary', () => {
        const onNavigate = vi.fn();
        renderConfig(makeSession(), vi.fn(), onNavigate);
        fireEvent.click(screen.getByRole('button', { name: /Explorer mes chances/ }));
        expect(onNavigate).toHaveBeenCalledWith('chances');
    });

    it('offers to export everything as CSV or JSON', () => {
        renderConfig(makeSession());
        expect(screen.getByRole('button', { name: 'Tout exporter (CSV)' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'JSON' })).toBeTruthy();
    });

    it('hands the reset request to the app', () => {
        const onRequestReset = vi.fn();
        renderConfig(makeSession(), onRequestReset);
        fireEvent.click(screen.getByRole('button', { name: /Réinitialiser les statistiques/ }));
        expect(onRequestReset).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------- Chances
describe('ChancesScreen', () => {
    const renderChances = (hashrate = 475260) => render(<ChancesScreen t={t} lang="fr" hashrate={hashrate} network={network} />);

    it('starts from the visitor\'s measured speed and shows the odds', () => {
        renderChances();
        expect(screen.getByText('475.26 KH/s', { selector: 'output' })).toBeTruthy();
        expect(screen.getByText(/34,\d milliards d'années/)).toBeTruthy();
        expect(screen.getByText(/2,5 fois l'âge de l'univers/)).toBeTruthy();
        expect(screen.getByText(/fois moins probable que de gagner à l'EuroMillions/)).toBeTruthy();
    });

    it('uses a typical figure when nothing was measured yet', () => {
        renderChances(0);
        expect(screen.getByText('475.00 KH/s', { selector: 'output' })).toBeTruthy();
        expect(screen.getByText(/Valeur typique/)).toBeTruthy();
    });

    it('recomputes everything when an example machine is picked', () => {
        renderChances();
        fireEvent.click(screen.getByRole('button', { name: /Un mineur ASIC récent/ }));
        expect(screen.getByText('200.00 TH/s', { selector: 'output' })).toBeTruthy();
        expect(screen.getByText(/2[34] ans|jours|mois/)).toBeTruthy();
        expect(screen.getByRole('button', { name: /Un mineur ASIC récent/ }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: /Votre navigateur/ }).getAttribute('aria-pressed')).toBe('false');
    });

    it('follows the slider', () => {
        renderChances();
        const slider = screen.getByLabelText('Vitesse de calcul simulée');
        fireEvent.change(slider, { target: { value: '9' } });
        expect(screen.getByText('1.00 GH/s', { selector: 'output' })).toBeTruthy();
    });

    it('lists the chance over four horizons', () => {
        renderChances();
        for (const label of ['1 jour', '1 mois', '1 an', '10 ans']) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it('explains the maths with the live difficulty', () => {
        renderChances();
        expect(screen.getByText(/aujourd'hui 121 T/)).toBeTruthy();
    });
});

// ---------------------------------------------------------------- History
describe('HistoryScreen', () => {
    const share = (i, diff, accepted = true) => ({ timestamp: 1_700_000_000_000 + i * 1000, worker_name: `cpu-worker-${i}`, difficulty: diff, accepted, nonce: `n${i}` });
    const baseProps = {
        t, lang: 'fr',
        stats: { total_shares: 3, best_difficulty: 0.0129 },
        history: { shares: [share(1, 0.0001), share(2, 0.0129), share(3, 0.0002, false)], blocks: [] },
        sessions: [{ id: 's1', start_time: 1_700_000_000_000, duration: '42m0s', total_hashes: 1.2e9, best_difficulty: 0.0412 }],
        tab: 'shares',
        onTabChange: () => {},
    };

    it('summarises the totals', () => {
        render(<HistoryScreen {...baseProps} />);
        expect(screen.getByText('Preuves de travail', { selector: '.tile__label' }).nextSibling.textContent).toBe('3');
        expect(screen.getByText('Meilleur essai de tous les temps').nextSibling.textContent).toBe('0.0129');
    });

    it('lists proofs with status and flags the record', () => {
        render(<HistoryScreen {...baseProps} />);
        expect(screen.getAllByText('Acceptée')).toHaveLength(2);
        expect(screen.getByText('Rejetée')).toBeTruthy();
        expect(screen.getAllByText('Record')).toHaveLength(1);
    });

    it('switches tabs through onTabChange', () => {
        const onTabChange = vi.fn();
        render(<HistoryScreen {...baseProps} onTabChange={onTabChange} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));
        expect(onTabChange).toHaveBeenCalledWith('sessions');
    });

    it('shows finished sessions', () => {
        render(<HistoryScreen {...baseProps} tab="sessions" />);
        expect(screen.getByText('42m0s')).toBeTruthy();
        expect(screen.getByText('1.20B')).toBeTruthy();
        expect(screen.getByText('0.0412')).toBeTruthy();
    });

    it('explains an empty blocks tab and disables its export', () => {
        render(<HistoryScreen {...baseProps} tab="blocks" />);
        expect(screen.getByText(/Aucun bloc trouvé… pour l'instant/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'CSV' }).disabled).toBe(true);
    });

    it('lists a found block with its details', () => {
        const blocks = [{ timestamp: 1_700_000_000_000, height: 952143, worker_name: 'cpu-worker-2', nonce: '3fa91c07', difficulty: 1.214e14 }];
        render(<HistoryScreen {...baseProps} tab="blocks" history={{ shares: [], blocks }} />);
        expect(screen.getByText('0x3fa91c07')).toBeTruthy();
        expect(screen.getByText('121 T')).toBeTruthy();
        expect(screen.getByText('Candidat')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'JSON' }).disabled).toBe(false);
    });

    it('invites the visitor to start when there are no proofs yet', () => {
        render(<HistoryScreen {...baseProps} history={{ shares: [], blocks: [] }} />);
        expect(screen.getByText("Aucune preuve pour l'instant")).toBeTruthy();
    });

    it('says how many proofs are shown versus exported', () => {
        const shares = Array.from({ length: 50 }, (_, i) => share(i, 0.0001));
        render(<HistoryScreen {...baseProps} history={{ shares, blocks: [] }} />);
        expect(screen.getByText(/Les 20 dernières preuves sont affichées ; l'export contient les 50 dernières/)).toBeTruthy();
    });
});

// ---------------------------------------------------------------- Help
describe('HelpScreen', () => {
    it('defines the vocabulary, reassures and answers the usual questions', () => {
        render(<HelpScreen t={t} lang="fr" network={network} />);
        expect(screen.getByText('Le vocabulaire en 30 secondes')).toBeTruthy();
        for (const term of ['Hash', 'Hashrate', 'Share', 'Difficulté', 'Worker']) {
            expect(screen.getAllByText(new RegExp(`^${term}`)).length).toBeGreaterThan(0);
        }
        expect(screen.getByText(/autour de 121 T/)).toBeTruthy();
        expect(screen.getByText(/jamais de clé privée/)).toBeTruthy();
        expect(screen.getByText('Puis-je vraiment gagner ?')).toBeTruthy();
    });

    it('tells a server install that closing the tab does not stop the mining', () => {
        render(<HelpScreen t={t} lang="fr" network={network} />);
        expect(screen.getByText(/le mining continue sur le serveur/)).toBeTruthy();
        expect(screen.queryByText(/Le mining s'arrête/)).toBeNull();
    });
});
