// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Rich from './Rich.jsx';
import HelpTip from './HelpTip.jsx';
import Segmented from './Segmented.jsx';
import Switch from './Switch.jsx';
import Dialog from './Dialog.jsx';
import WalletField from './WalletField.jsx';
import StateBanner from './StateBanner.jsx';
import ResetDialog from './ResetDialog.jsx';
import WinDialog from './WinDialog.jsx';
import SpeedChart from './SpeedChart.jsx';
import Toast from './Toast.jsx';
import StateBanners from './StateBanners.jsx';
import { PERIODS } from '../lib/series.js';
import { createTranslator } from '../i18n/index.js';

const t = createTranslator('fr');
const VALID_ADDRESS = '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9';

afterEach(cleanup);

describe('Rich', () => {
    it('renders **marked** parts as emphasis and the rest as plain text', () => {
        const { container } = render(<p><Rich text="a **b** c **d**" /></p>);
        expect(container.querySelectorAll('strong')).toHaveLength(2);
        expect(container.textContent).toBe('a b c d');
    });

    it('never interprets HTML in the text', () => {
        const { container } = render(<p><Rich text="<img src=x onerror=alert(1)> **ok**" /></p>);
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain('<img');
    });
});

describe('HelpTip', () => {
    it('discloses the explanation on click and hides it on Escape', () => {
        render(<HelpTip term="hashrate" text="Une explication" t={t} />);
        const button = screen.getByRole('button', { name: /hashrate/ });
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('Une explication')).toBeNull();

        fireEvent.click(button);
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Une explication')).toBeTruthy();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByText('Une explication')).toBeNull();
    });

    it('closes when clicking elsewhere', () => {
        render(<div><HelpTip term="x" text="Texte" t={t} /><span>ailleurs</span></div>);
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText('Texte')).toBeTruthy();
        fireEvent.mouseDown(screen.getByText('ailleurs'));
        expect(screen.queryByText('Texte')).toBeNull();
    });
});

describe('Segmented', () => {
    const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

    it('exposes pressed-button semantics by default', () => {
        const onChange = vi.fn();
        render(<Segmented options={options} value="a" onChange={onChange} label="Thème" />);
        expect(screen.getByRole('group', { name: 'Thème' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: 'B' }));
        expect(onChange).toHaveBeenCalledWith('b');
    });

    it('exposes tab semantics for panels', () => {
        render(<Segmented variant="tabs" options={options} value="b" onChange={() => {}} label="Onglets" />);
        expect(screen.getByRole('tablist', { name: 'Onglets' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'B' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe('false');
    });
});

describe('Switch', () => {
    it('toggles through onChange with the opposite value', () => {
        const onChange = vi.fn();
        render(<Switch checked={false} onChange={onChange} label="Vue avancée" />);
        const toggle = screen.getByRole('switch', { name: 'Vue avancée' });
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        fireEvent.click(toggle);
        expect(onChange).toHaveBeenCalledWith(true);
    });
});

describe('Dialog', () => {
    it('is a labelled modal that closes on Escape and on the close button', () => {
        const onClose = vi.fn();
        render(<Dialog title="Mon titre" closeLabel="Fermer" onClose={onClose}><button>Action</button></Dialog>);
        const dialog = screen.getByRole('dialog', { name: 'Mon titre' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');

        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('takes focus when opened, locks scroll, and restores both when closed', () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();

        const { unmount } = render(<Dialog title="T" closeLabel="Fermer" onClose={() => {}}>x</Dialog>);
        expect(document.activeElement).toBe(screen.getByRole('dialog'));
        expect(document.body.style.overflow).toBe('hidden');

        unmount();
        expect(document.body.style.overflow).toBe('');
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it('keeps Tab inside the dialog', () => {
        render(<Dialog title="T" closeLabel="Fermer" onClose={() => {}}><button>Dernier</button></Dialog>);
        const last = screen.getByRole('button', { name: 'Dernier' });
        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }));
    });

    it('closes on a click on the backdrop but not inside the dialog', () => {
        const onClose = vi.fn();
        const { container } = render(<Dialog title="T" closeLabel="Fermer" onClose={onClose}>x</Dialog>);
        fireEvent.mouseDown(screen.getByRole('dialog'));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.mouseDown(container.querySelector('.dialog-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('WalletField', () => {
    const renderField = (value) => render(<WalletField label="Adresse" value={value} onChange={() => {}} t={t} />);

    it('stays quiet while empty', () => {
        renderField('');
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByLabelText('Adresse').getAttribute('aria-invalid')).toBe('false');
    });

    it('confirms a valid address', () => {
        renderField(VALID_ADDRESS);
        expect(screen.getByText(/Adresse valide/)).toBeTruthy();
    });

    it('explains a typo and marks the field invalid', () => {
        renderField(VALID_ADDRESS.slice(0, -1) + '8');
        expect(screen.getByRole('alert').textContent).toMatch(/pas valide.*somme de contrôle/);
        expect(screen.getByLabelText('Adresse').getAttribute('aria-invalid')).toBe('true');
    });

    it('reports edits through onChange', () => {
        const onChange = vi.fn();
        render(<WalletField label="Adresse" value="" onChange={onChange} t={t} />);
        fireEvent.change(screen.getByLabelText('Adresse'), { target: { value: 'bc1' } });
        expect(onChange).toHaveBeenCalledWith('bc1');
    });
});

describe('StateBanner', () => {
    it('shows what happens, reassures, and offers one action', () => {
        const onClick = vi.fn();
        render(<StateBanner tone="warn" title="Titre" body="Corps" action={{ label: 'Réessayer', onClick }} />);
        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText('Corps')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
        expect(onClick).toHaveBeenCalled();
    });

    it('is a polite status for information and can be dismissed', () => {
        const onDismiss = vi.fn();
        render(<StateBanner tone="info" title="Info" body="Détail" onDismiss={onDismiss} dismissLabel="Fermer" />);
        expect(screen.getByRole('status')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
        expect(onDismiss).toHaveBeenCalled();
    });
});

describe('ResetDialog', () => {
    const counts = { shares: 1234, sessions: 3, best: 0.0412 };

    it('spells out exactly what will be erased', () => {
        render(<ResetDialog t={t} lang="fr" counts={counts} onCancel={() => {}} onConfirm={() => {}} onExport={() => {}} />);
        const dialog = screen.getByRole('alertdialog');
        expect(dialog.textContent).toMatch(/1\s?234 preuves de travail/);
        expect(dialog.textContent).toContain('3 sessions');
        expect(dialog.textContent).toContain('0.0412');
    });

    it('makes the safe choice the default and wires every action', async () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn().mockResolvedValue();
        const onExport = vi.fn();
        render(<ResetDialog t={t} lang="fr" counts={counts} onCancel={onCancel} onConfirm={onConfirm} onExport={onExport} />);

        fireEvent.click(screen.getByRole('button', { name: /Exporter une copie/ }));
        expect(onExport).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
        expect(onCancel).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Effacer définitivement' }));
        expect(onConfirm).toHaveBeenCalled();
    });
});

describe('WinDialog', () => {
    const network = { difficulty: 1.21e14, rewardBTC: 3.125, priceUSD: 98400 };
    const block = { timestamp: Date.UTC(2026, 9, 18, 21, 41, 7), height: 952143, worker_name: 'cpu-worker-2', nonce: '3fa91c07', hash: '00000000000000000002a8c1d7e4a91c00000000000000000000000000e7d4a91c', difficulty: 1.214e14 };
    const renderWin = (b) => render(
        <WinDialog t={t} lang="fr" theme="light" block={b} network={network} oddsPerDay="1 sur 12,7 billions"
            onClose={() => {}} onExport={() => {}} onOpenHistory={() => {}} />
    );

    it('announces the candidate block with its details and the odds', () => {
        renderWin(block);
        const dialog = screen.getByRole('dialog', { name: /bloc candidat/i });
        expect(dialog.textContent).toContain('1 sur 12,7 billions');
        expect(dialog.textContent).toContain('#952');
        expect(dialog.textContent).toContain('cpu-worker-2');
        expect(dialog.textContent).toContain('0x3fa91c07');
        expect(dialog.textContent).toContain('121,4 T (seuil : 121,0 T)');
        expect(dialog.textContent).toContain('00000000000000000002a8c1…e7d4a91c');
    });

    it('leaves out details the source did not report', () => {
        renderWin({ timestamp: block.timestamp, difficulty: 1.3e14 });
        const dialog = screen.getByRole('dialog');
        expect(dialog.textContent).not.toContain('Nonce');
        expect(dialog.textContent).not.toContain('Empreinte');
        expect(dialog.textContent).not.toContain('Bloc visé');
    });

    it('offers to export the proof, open the history or keep mining', () => {
        const onExport = vi.fn();
        const onOpenHistory = vi.fn();
        const onClose = vi.fn();
        render(<WinDialog t={t} lang="fr" theme="light" block={block} network={network} oddsPerDay="x"
            onClose={onClose} onExport={onExport} onOpenHistory={onOpenHistory} />);
        fireEvent.click(screen.getByRole('button', { name: /Exporter la preuve/ }));
        fireEvent.click(screen.getByRole('button', { name: /Voir dans l'historique/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Continuer à miner' }));
        expect(onExport).toHaveBeenCalled();
        expect(onOpenHistory).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});

describe('SpeedChart', () => {
    const samples = [1000, 1100, 200, 150, 1000, 1050];

    it('draws the curve without any band when the tab stayed visible', () => {
        const { container } = render(<SpeedChart samples={samples} hiddenFlags={samples.map(() => false)} period={PERIODS[0]} t={t} />);
        expect(container.querySelector('.speed-chart__line').getAttribute('d')).toMatch(/^M/);
        expect(container.querySelector('.speed-chart__slow')).toBeNull();
        expect(screen.queryByText(/Zone grisée/)).toBeNull();
    });

    it('marks the time spent in a background tab and explains it', () => {
        const hidden = [false, false, true, true, false, false];
        const { container } = render(<SpeedChart samples={samples} hiddenFlags={hidden} period={PERIODS[0]} t={t} />);
        expect(container.querySelectorAll('.speed-chart__slow')).toHaveLength(1);
        expect(screen.getByText(/Zone grisée/)).toBeTruthy();
    });
});

describe('Toast', () => {
    it('shows a message and closes itself', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(<Toast message="Enregistré" onClose={onClose} />);
        expect(screen.getByRole('status').textContent).toBe('Enregistré');
        vi.advanceTimersByTime(4100);
        expect(onClose).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('offers an action, runs it once and then closes', () => {
        const onClick = vi.fn();
        const onClose = vi.fn();
        render(<Toast message="Effacé" action={{ label: 'Annuler', onClick }} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays longer when it carries an action, so there is time to use it', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(<Toast message="Effacé" action={{ label: 'Annuler', onClick: () => {} }} onClose={onClose} />);
        vi.advanceTimersByTime(4100);
        expect(onClose).not.toHaveBeenCalled();
        vi.advanceTimersByTime(4000);
        expect(onClose).toHaveBeenCalled();
        vi.useRealTimers();
    });
});

describe('StateBanners: the Bitcoin block cannot be fetched (demo)', () => {
    const session = (overrides = {}) => ({
        config: { max_cpu_percent: 80 },
        poolHealth: { retryInSeconds: 0, lastError: '' },
        blockMissing: true,
        blockRetryInSeconds: 15,
        actions: { retryNetworkBlock: vi.fn() },
        ...overrides,
    });
    const noNotice = { visible: false, dismiss: () => {} };

    it('says mining starts as soon as the block is received, with the countdown', () => {
        render(<StateBanners t={t} session={session()} backgroundNotice={noNotice} />);
        expect(screen.getByText('Impossible de récupérer le bloc actuel')).toBeTruthy();
        expect(screen.getByText(/démarre dès que le bloc est reçu\. Nouvelle tentative dans 15 s/)).toBeTruthy();
    });

    it('lets the user retry right away', () => {
        const current = session();
        render(<StateBanners t={t} session={current} backgroundNotice={noNotice} />);
        fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
        expect(current.actions.retryNetworkBlock).toHaveBeenCalled();
    });

    it('is silent once the block is there', () => {
        render(<StateBanners t={t} session={session({ blockMissing: false })} backgroundNotice={noNotice} />);
        expect(screen.queryByText('Impossible de récupérer le bloc actuel')).toBeNull();
    });
});
