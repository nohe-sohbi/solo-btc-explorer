import { useState } from 'react';
import Dialog from './Dialog.jsx';
import Rich from './Rich.jsx';
import { formatInteger } from '../lib/bigNumbers.js';

// Confirmation before erasing the statistics. It says exactly what will go, offers
// to export a copy first, and makes the safe choice ("Cancel") the easy one.
export default function ResetDialog({ t, lang, counts, onCancel, onConfirm, onExport }) {
    const [busy, setBusy] = useState(false);

    const confirm = async () => {
        setBusy(true);
        await onConfirm();
        setBusy(false);
    };

    return (
        <Dialog role="alertdialog" title={t('resetTitle')} onClose={onCancel}>
            <p className="dialog__lead">
                <Rich
                    text={t('resetBody', {
                        shares: formatInteger(counts.shares, lang),
                        sessions: formatInteger(counts.sessions, lang),
                        best: counts.best > 0 ? counts.best.toFixed(4) : '—',
                    })}
                />
            </p>
            <button type="button" className="link-button" onClick={onExport}>
                {t('resetExport')}
            </button>
            <div className="dialog__actions dialog__actions--end">
                <button type="button" className="btn btn--outline" onClick={onCancel} autoFocus>
                    {t('resetCancel')}
                </button>
                <button type="button" className="btn btn--danger" onClick={confirm} disabled={busy}>
                    {t('resetConfirm')}
                </button>
            </div>
        </Dialog>
    );
}
