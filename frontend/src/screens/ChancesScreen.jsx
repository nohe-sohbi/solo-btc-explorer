import { useState, useId } from 'react';
import Rich from '../components/Rich.jsx';
import {
    HASHRATE_PRESETS,
    MIN_LOG_HASHRATE,
    MAX_LOG_HASHRATE,
    TYPICAL_BROWSER_HASHRATE,
    hashrateToSlider,
    sliderToHashrate,
    simulate,
} from '../lib/simulator.js';
import { formatDuration, formatChance, formatOneIn, formatUsd, formatUsdWhole } from '../lib/oddsFormat.js';
import { formatBigNumber, formatDecimal } from '../lib/bigNumbers.js';
import { formatHashrate, formatReward, formatSi } from '../lib/format.js';

// Texts of the fixed example machines (the browser preset is handled separately).
const PRESET_TEXT = {
    gpu: { name: 'presetGpuName', note: 'presetGpuNote' },
    asic: { name: 'presetAsicName', note: 'presetAsicNote' },
    farm: { name: 'presetFarmName', note: 'presetFarmNote' },
};

const HORIZON_LABEL_KEYS = {
    day: 'horizonDay',
    month: 'horizonMonth',
    year: 'horizonYear',
    decade: 'horizonDecade',
};

// "that is about as likely as…" sentence for the lottery comparison.
function describeLottery(lottery, lang, t) {
    if (lottery.kind === 'less') return t('lotteryLess', { n: formatBigNumber(lottery.factor, lang) });
    if (lottery.kind === 'more') return t('lotteryMore', { n: formatBigNumber(lottery.factor, lang) });
    return t('lotterySimilar');
}

// Sentence placing the waiting time on a familiar scale (age of the universe, …).
function describeTimescale(timescale, lang, t) {
    const n = formatDecimal(timescale.value, lang, 1);
    switch (timescale.kind) {
        case 'universeMultiple':
            return t('scaleUniverseMultiple', { n });
        case 'universePercent':
            return t('scaleUniversePercent', { n });
        case 'history':
            return t('scaleHistory', { n: formatBigNumber(timescale.value, lang) });
        case 'lifetimes':
            return t('scaleLifetimes');
        case 'underLifetime':
            return t('scaleUnderLifetime');
        default:
            return t('scaleWithinReach');
    }
}

// "What if my computer were faster?": a logarithmic speed slider with example
// machines, and the odds recomputed live for whatever speed is chosen.
export default function ChancesScreen({ t, lang, hashrate, network }) {
    const measured = hashrate > 0 ? hashrate : TYPICAL_BROWSER_HASHRATE;
    const [simulated, setSimulated] = useState(measured);
    const sliderId = useId();

    const sim = simulate({
        hashrate: simulated,
        networkDifficulty: network.difficulty,
        rewardBTC: network.rewardBTC,
        priceUSD: network.priceUSD,
    });

    const presets = HASHRATE_PRESETS.map((preset) => {
        const isBrowser = preset.id === 'browser';
        return {
            id: preset.id,
            hashrate: isBrowser ? measured : preset.hashrate,
            name: isBrowser ? t('presetBrowserName') : t(PRESET_TEXT[preset.id].name),
            note: isBrowser
                ? t(hashrate > 0 ? 'presetBrowserNote' : 'presetBrowserNoteIdle')
                : t(PRESET_TEXT[preset.id].note),
        };
    });

    const reward = formatReward(network.rewardBTC, lang);

    return (
        <>
            <div className="split split--even">
                <section className="card panel simulator">
                    <h2 className="panel__title">{t('simTitle')}</h2>
                    <p className="panel__subtitle">{t('simSub')}</p>

                    <div className="simulator__readout">
                        <label htmlFor={sliderId}>{t('simSpeedLabel')}</label>
                        <output htmlFor={sliderId} className="simulator__speed">
                            {formatHashrate(simulated)}
                        </output>
                    </div>
                    <input
                        id={sliderId}
                        type="range"
                        className="slider"
                        min={MIN_LOG_HASHRATE}
                        max={MAX_LOG_HASHRATE}
                        step="0.01"
                        value={hashrateToSlider(simulated)}
                        onChange={(event) => setSimulated(sliderToHashrate(parseFloat(event.target.value)))}
                    />
                    <div className="simulator__scale" aria-hidden="true">
                        <span>1 KH/s</span>
                        <span>1 MH/s</span>
                        <span>1 GH/s</span>
                        <span>1 TH/s</span>
                        <span>1 PH/s</span>
                        <span>1 EH/s</span>
                    </div>

                    <h3 className="simulator__examples-title">{t('simExamples')}</h3>
                    <div className="preset-list">
                        {presets.map((preset) => {
                            const selected = Math.abs(hashrateToSlider(simulated) - hashrateToSlider(preset.hashrate)) < 0.05;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className={`preset${selected ? ' is-selected' : ''}`}
                                    aria-pressed={selected}
                                    onClick={() => setSimulated(preset.hashrate)}
                                >
                                    <span className="preset__text">
                                        <span className="preset__name">{preset.name}</span>
                                        <span className="preset__note">{preset.note}</span>
                                    </span>
                                    <span className="preset__rate">{formatHashrate(preset.hashrate)}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="card panel result" aria-live="polite">
                    {sim.hasData ? (
                        <>
                            <div className="result__label">{t('simTimeLabel')}</div>
                            <div className="result__time">{formatDuration(sim.expectedSeconds, lang, t)}</div>
                            {sim.timescale && <div className="result__compare">{describeTimescale(sim.timescale, lang, t)}</div>}

                            <dl className="result__pair">
                                <div>
                                    <dt>{t('simDayLabel')}</dt>
                                    <dd>{formatOneIn(sim.probPerDay, lang, t)}</dd>
                                </div>
                                <div>
                                    <dt>{t('simEvLabel')}</dt>
                                    <dd>{network.priceUSD > 0 ? t('simEvValue', { usd: formatUsd(sim.usdPerDay, lang) }) : '—'}</dd>
                                </div>
                            </dl>

                            <h3 className="result__horizons-title">{t('simHorizonsTitle')}</h3>
                            <dl className="facts">
                                {sim.horizons.map((horizon) => (
                                    <div key={horizon.id} className="facts__row">
                                        <dt>{t(HORIZON_LABEL_KEYS[horizon.id])}</dt>
                                        <dd>{formatChance(horizon.probability, lang, t)}</dd>
                                    </div>
                                ))}
                            </dl>

                            {sim.lottery && (
                                <p className="note">
                                    <strong>{t('simLandmark')}</strong> {describeLottery(sim.lottery, lang, t)}.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="panel__empty">{t('simNoData')}</p>
                    )}
                </section>
            </div>

            <section className="card panel how">
                <h2 className="panel__title">{t('howTitle')}</h2>
                <div className="how__columns">
                    <p>
                        <Rich text={t('howP1', { difficulty: formatSi(network.difficulty, lang) })} />
                    </p>
                    <p>
                        <Rich text={t('howP2')} />
                    </p>
                    <p>
                        <Rich
                            text={
                                network.priceUSD > 0
                                    ? t('howP3', { reward, price: formatUsdWhole(network.priceUSD, lang) })
                                    : t('howP3NoPrice', { reward })
                            }
                        />
                    </p>
                </div>
            </section>
        </>
    );
}
