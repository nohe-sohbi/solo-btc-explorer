import Art from './Art.jsx';
import { computeOdds } from '../lib/odds.js';
import { formatDuration, formatOneIn, formatUsdWhole } from '../lib/oddsFormat.js';
import { formatReward } from '../lib/format.js';

// The "why am I doing this" card: the prize, and — once mining — the honest odds of
// winning it. Links to the simulator for the full picture.
export default function JackpotCard({ t, lang, theme, running, hashrate, network, blocksFound, onExplore }) {
    const odds = computeOdds(hashrate, network.difficulty);
    const showOdds = running && odds.hasData;

    return (
        <section className="card jackpot-card">
            <Art name="hero-bg" theme={theme} fade="bottom" className="jackpot-card__art" position="50% 40%" />
            <div className="jackpot-card__body">
                <div className="jackpot-card__label">{t('jackpotLabel')}</div>
                <div className="jackpot-card__prize">
                    <span className="jackpot-card__reward">{t('jackpotReward', { reward: formatReward(network.rewardBTC, lang) })}</span>
                    {network.priceUSD > 0 && (
                        <span className="jackpot-card__usd">
                            {t('jackpotUsd', { usd: formatUsdWhole(network.rewardBTC * network.priceUSD, lang) })}
                        </span>
                    )}
                </div>

                {showOdds ? (
                    <dl className="facts">
                        <div className="facts__row facts__row--stacked">
                            <dt>{t('jackpotChanceDay')}</dt>
                            <dd>{formatOneIn(odds.probPerDay, lang, t)}</dd>
                        </div>
                        <div className="facts__row facts__row--stacked">
                            <dt>{t('jackpotTime')}</dt>
                            <dd>{formatDuration(odds.expectedSeconds, lang, t)}</dd>
                        </div>
                        <div className="facts__row">
                            <dt>{t('jackpotBlocks')}</dt>
                            <dd className={blocksFound > 0 ? 'text-accent' : 'text-muted'}>
                                {blocksFound === 0
                                    ? t('jackpotBlocksNone')
                                    : blocksFound === 1
                                      ? t('jackpotBlocksOne')
                                      : t('jackpotBlocksMany', { n: blocksFound })}
                            </dd>
                        </div>
                    </dl>
                ) : (
                    <p className="jackpot-card__idle">{t('jackpotIdle')}</p>
                )}

                <button type="button" className="btn btn--accent-soft btn--sm jackpot-card__explore" onClick={onExplore}>
                    {t('jackpotExplore')}
                </button>
            </div>
        </section>
    );
}
