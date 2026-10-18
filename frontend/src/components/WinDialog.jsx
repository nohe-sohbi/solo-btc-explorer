import Dialog from './Dialog.jsx';
import Art from './Art.jsx';
import Rich from './Rich.jsx';
import { IS_DEMO } from '../config/runtime.js';
import { formatInteger, LOCALES } from '../lib/bigNumbers.js';
import { formatSi, formatReward, shortHash } from '../lib/format.js';

function Detail({ label, children }) {
    return (
        <div className="facts__row">
            <dt>{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

// The big moment: a block candidate was found. States plainly what that means (in
// the demo: nothing is paid), shows the details and offers to keep the proof.
// Details the source didn't report (the backend sends fewer than the demo) are
// simply left out.
export default function WinDialog({ t, lang, theme, block, network, oddsPerDay, onClose, onExport, onOpenHistory }) {
    const locale = LOCALES[lang] || LOCALES.en;
    const reward = formatReward(network.rewardBTC, lang);

    return (
        <Dialog
            title={t(IS_DEMO ? 'winTitleDemo' : 'winTitle')}
            eyebrow={<span className="badge badge--accent">{t('winBadge')}</span>}
            closeLabel={t('dialogClose')}
            onClose={onClose}
            art={<Art name="hero-bg" theme={theme} className="dialog__art" position="50% 38%" />}
        >
            <p className="dialog__lead">{t('winBody', { odds: oddsPerDay })}</p>

            <dl className="facts facts--boxed">
                {block.height > 0 && <Detail label={t('winBlock')}>#{formatInteger(block.height, lang)}</Detail>}
                <Detail label={t('winFoundBy')}>
                    {[block.worker_name, new Date(block.timestamp).toLocaleTimeString(locale)].filter(Boolean).join(' · ')}
                </Detail>
                {block.difficulty > 0 && (
                    <Detail label={t('winDifficulty')}>
                        <span className="text-accent">
                            {formatSi(block.difficulty, lang, 1)} ({t('winThreshold', { value: formatSi(network.difficulty, lang, 1) })})
                        </span>
                    </Detail>
                )}
                {block.nonce && <Detail label={t('winNonce')}>0x{block.nonce}</Detail>}
                {block.hash && (
                    <div className="facts__row facts__row--stacked">
                        <dt>{t('winHash')}</dt>
                        <dd className="facts__hash">{shortHash(block.hash)}</dd>
                    </div>
                )}
            </dl>

            <p className="note note--accent">
                <Rich text={t(IS_DEMO ? 'winDemoNote' : 'winServerNote', { reward })} />
            </p>

            <div className="dialog__actions">
                <button type="button" className="btn btn--primary" onClick={onExport}>
                    {t('winExport')}
                </button>
                <button type="button" className="btn btn--outline" onClick={onOpenHistory}>
                    {t('winHistory')}
                </button>
                <button type="button" className="btn btn--ghost" onClick={onClose}>
                    {t('winContinue')}
                </button>
            </div>
        </Dialog>
    );
}
