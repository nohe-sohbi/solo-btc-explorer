// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import WelcomeScreen from './WelcomeScreen.jsx';
import { createTranslator } from '../i18n/index.js';

// The backend-free demo: the visitor needs no wallet, an example address is used.
vi.mock('../config/runtime.js', () => ({
    IS_DEMO: true,
    EXAMPLE_WALLET_ADDRESS: '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9',
}));

const t = createTranslator('fr');
const EXAMPLE = '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9';
const network = { difficulty: 1.21e14, rewardBTC: 3.125, priceUSD: 98400, height: 0, hashrate: 0 };

afterEach(cleanup);

const renderWelcome = (onStart = vi.fn().mockResolvedValue(true)) =>
    render(<WelcomeScreen t={t} lang="fr" theme="light" network={network} savedWallet="" onStart={onStart} onOpenHelp={() => {}} />);

describe('WelcomeScreen (demo)', () => {
    it('reassures a visitor without a wallet: the example address is enough', () => {
        renderWelcome();
        expect(screen.getByText(/Vous n'en avez pas \? Aucun souci/)).toBeTruthy();
        const field = screen.getByLabelText("Adresse d'exemple (démo)");
        expect(field.value).toBe(EXAMPLE);
        expect(field.readOnly).toBe(true);
    });

    it('starts in one click with the example address', async () => {
        const onStart = vi.fn().mockResolvedValue(true);
        renderWelcome(onStart);
        fireEvent.click(screen.getByRole('button', { name: "Démarrer avec l'adresse d'exemple" }));
        await waitFor(() => expect(onStart).toHaveBeenCalledWith(EXAMPLE));
    });

    it('shows the value of the reward in dollars', () => {
        renderWelcome();
        expect(screen.getByText(/≈ \$307\s?500/)).toBeTruthy();
    });

    it('lets the visitor switch to their own address and back', () => {
        renderWelcome();
        fireEvent.click(screen.getByRole('button', { name: /J'ai ma propre adresse/ }));

        const own = screen.getByLabelText('Votre adresse Bitcoin');
        expect(own.value).toBe('');
        expect(own.readOnly).toBe(false);
        expect(screen.getByRole('button', { name: 'Démarrer avec cette adresse' }).disabled).toBe(true);

        fireEvent.change(own, { target: { value: EXAMPLE } });
        expect(screen.getByRole('button', { name: 'Démarrer avec cette adresse' }).disabled).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: /Utiliser l'adresse d'exemple/ }));
        expect(screen.getByLabelText("Adresse d'exemple (démo)")).toBeTruthy();
    });
});
