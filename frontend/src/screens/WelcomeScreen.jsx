import { useState } from 'react';
import Art from '../components/Art.jsx';
import Icon from '../components/Icon.jsx';
import Rich from '../components/Rich.jsx';
import WalletField from '../components/WalletField.jsx';
import { LedgerIllustration, PuzzleIllustration, RewardIllustration } from '../components/Illustrations.jsx';
import { IS_DEMO, EXAMPLE_WALLET_ADDRESS } from '../config/runtime.js';
import { checkWallet } from '../lib/walletCheck.js';
import { formatInteger } from '../lib/bigNumbers.js';
import { formatUsdWhole } from '../lib/oddsFormat.js';
import { TYPICAL_BROWSER_HASHRATE } from '../lib/simulator.js';
import { formatReward } from '../lib/format.js';

const SAMPLE_FINGERPRINTS = ['9c4e1b7a…b21f', '07af52c9…3d9a', 'e12b90d4…77ac'];

// The first screen a newcomer sees. It explains what Bitcoin mining is before asking
// for anything, then makes starting a one-click affair: in the demo, no wallet is
// needed (an example address is used); on a real install the visitor enters theirs.
export default function WelcomeScreen({ t, lang, theme, network, savedWallet, onStart, onOpenHelp }) {
    // `draft` is what the visitor typed; null means "haven't touched the field".
    const [draft, setDraft] = useState(null);
    const [useOwn, setUseOwn] = useState(!IS_DEMO);
    const [starting, setStarting] = useState(false);

    const exampleMode = IS_DEMO && !useOwn;
    const wallet = exampleMode ? EXAMPLE_WALLET_ADDRESS : (draft ?? savedWallet ?? '');
    const check = checkWallet(wallet);
    const canStart = check.status === 'valid' && !starting;

    const start = async () => {
        if (!canStart) return;
        setStarting(true);
        await onStart(wallet);
        setStarting(false);
    };

    const reward = formatReward(network.rewardBTC, lang);
    const idea3 =
        network.priceUSD > 0
            ? t('idea3Body', { reward, usd: `≈ ${formatUsdWhole(network.rewardBTC * network.priceUSD, lang)}` })
            : t('idea3BodyNoPrice', { reward });

    const scrollToIdeas = () => document.getElementById('comprendre')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <>
            <section className="card hero">
                <div className="hero__content">
                    <span className="badge badge--accent">{t('welcomeBadge')}</span>
                    <h2 className="hero__title">
                        <Rich text={t('welcomeTitle')} />
                    </h2>
                    <p className="hero__lead">
                        <Rich text={t('welcomeLead')} />
                    </p>
                    <ul className="check-list">
                        {['welcomeReassure1', 'welcomeReassure2', 'welcomeReassure3'].map((key) => (
                            <li key={key}>
                                <Icon name="check" size={16} strokeWidth={2.4} className="check-list__icon" />
                                {t(key)}
                            </li>
                        ))}
                    </ul>
                    <div className="hero__actions">
                        <button type="button" className="btn btn--primary btn--lg" onClick={start} disabled={!canStart}>
                            {t('welcomeStartNow')}
                        </button>
                        <button type="button" className="link-button" onClick={scrollToIdeas}>
                            {t('welcomeUnderstand')}
                        </button>
                    </div>
                </div>
                <Art name="hero-bg" theme={theme} fade="left" className="hero__art" position="50% 42%" />
            </section>

            <section id="comprendre" className="section">
                <h2 className="section__title">{t('welcomeIdeasTitle')}</h2>
                <p className="section__subtitle">{t('welcomeIdeasSub')}</p>
                <div className="idea-grid">
                    {[
                        { n: 1, Drawing: LedgerIllustration, title: t('idea1Title'), body: t('idea1Body') },
                        { n: 2, Drawing: PuzzleIllustration, title: t('idea2Title'), body: t('idea2Body') },
                        { n: 3, Drawing: RewardIllustration, title: t('idea3Title'), body: idea3 },
                    ].map(({ n, Drawing, title, body }) => (
                        <article key={n} className="card idea">
                            <div className="idea__drawing">
                                <Drawing />
                            </div>
                            <h3 className="idea__title">
                                <span className="step-number">{n}</span>
                                {title}
                            </h3>
                            <p className="idea__body">
                                <Rich text={body} />
                            </p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="card concrete">
                <div className="concrete__text">
                    <h2 className="section__title">{t('welcomeConcreteTitle')}</h2>
                    <ul className="bullet-list">
                        {['welcomeConcrete1', 'welcomeConcrete2', 'welcomeConcrete3'].map((key) => (
                            <li key={key}>
                                <span>
                                    <Rich text={t(key)} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="attempts" aria-hidden="true">
                    {SAMPLE_FINGERPRINTS.map((fingerprint, index) => (
                        <div key={fingerprint} className="attempts__row">
                            <span className="attempts__label">{t('sampleTry', { n: index + 1 })}</span>
                            <span>{fingerprint}</span>
                            <span className="attempts__miss">{t('sampleMiss')}</span>
                        </div>
                    ))}
                    <div className="attempts__label">
                        {t('sampleRate', { rate: formatInteger(TYPICAL_BROWSER_HASHRATE, lang) })}
                    </div>
                    <div className="attempts__goal">
                        {t('sampleGoal')}
                        <div className="attempts__goal-note">{t('sampleGoalNote')}</div>
                    </div>
                </div>
            </section>

            <section className="card ready">
                <div className="ready__text">
                    <span className="badge badge--accent">{t('welcomeLastStep')}</span>
                    <h2 className="section__title">{t('walletExplainTitle')}</h2>
                    <p className="ready__body">
                        <Rich text={t(IS_DEMO ? 'walletExplainDemo' : 'walletExplainReal')} />
                    </p>
                    <p className="note">
                        <Rich text={t('walletNeverKey')} />
                    </p>
                </div>
                <div className="ready__action">
                    <WalletField
                        label={t(exampleMode ? 'walletLabelExample' : 'walletLabelOwn')}
                        value={wallet}
                        onChange={setDraft}
                        readOnly={exampleMode}
                        confirmValid={!exampleMode}
                        placeholder={t('walletPlaceholder')}
                        t={t}
                    />
                    {check.status === 'empty' && <p className="field__hint">{t('walletRequired')}</p>}
                    {check.status === 'invalid' && <p className="field__hint">{t('walletBlocked')}</p>}
                    <div className="ready__buttons">
                        <button type="button" className="btn btn--primary btn--lg" onClick={start} disabled={!canStart}>
                            {t(exampleMode ? 'startWithExample' : 'startWithOwn')}
                        </button>
                        {IS_DEMO && (
                            <button type="button" className="link-button" onClick={() => setUseOwn(!useOwn)}>
                                {t(exampleMode ? 'walletUseOwn' : 'walletUseExample')}
                            </button>
                        )}
                    </div>
                    <p className="ready__footnote">
                        {t('welcomeFootnote')}{' '}
                        <button type="button" className="link-button link-button--inline" onClick={onOpenHelp}>
                            {t('navHelp')}
                        </button>
                    </p>
                </div>
            </section>
        </>
    );
}
