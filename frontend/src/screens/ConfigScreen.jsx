import { useState, useId } from 'react';
import Icon from '../components/Icon.jsx';
import Rich from '../components/Rich.jsx';
import WalletField from '../components/WalletField.jsx';
import { checkWallet } from '../lib/walletCheck.js';
import { computeOdds } from '../lib/odds.js';
import { formatOneIn } from '../lib/oddsFormat.js';
import { formatHashrateReadable } from '../lib/format.js';
import { exportEverything } from '../lib/exportData.js';
import { track } from '../lib/analytics.js';

const CPU_RANGE = { min: 10, max: 100, step: 5 };
const WORKERS_RANGE = { min: 1, max: 8, step: 1 };
const LOW_CPU_PERCENT = 40;
const MID_CPU_PERCENT = 80;

const SETTING_KEYS = ['wallet_address', 'pool_url', 'pool_port', 'max_cpu_percent', 'num_workers'];
const sameSettings = (a, b) => SETTING_KEYS.every((key) => a[key] === b[key]);

function cpuHelpKey(percent) {
    if (percent <= LOW_CPU_PERCENT) return 'cfgCpuHelpLow';
    if (percent <= MID_CPU_PERCENT) return 'cfgCpuHelpMid';
    return 'cfgCpuHelpHigh';
}

function LockedNote({ children }) {
    return (
        <p className="locked-note">
            <Icon name="lock" size={14} />
            {children}
        </p>
    );
}

// A labelled slider showing its current value.
function SliderField({ label, note, value, onChange, range, unit, disabled, help }) {
    const id = useId();
    return (
        <div className="field field--slider">
            <div className="field__row">
                <label className="field__label field__label--strong" htmlFor={id}>
                    {label} <span className="field__note">{note}</span>
                </label>
                <span className="field__value">{unit ? `${value} ${unit}` : value}</span>
            </div>
            <input
                id={id}
                type="range"
                className="slider"
                min={range.min}
                max={range.max}
                step={range.step}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(parseInt(event.target.value, 10))}
            />
            <p className="field__hint">{help}</p>
        </div>
    );
}

// Everything configurable, with an explicit save step. While mining, the address,
// pool and worker count are locked (the code can't change them on the fly); the
// processor limit stays adjustable live.
export default function ConfigScreen({ t, lang, session, onRequestReset, onNavigate }) {
    const { config, running, stats, network, history, sessions, actions } = session;
    const [draft, setDraft] = useState(null); // null = nothing edited yet
    const [saving, setSaving] = useState(false);

    const values = draft ?? config;
    const dirty = draft !== null && !sameSettings(draft, config);
    const walletStatus = checkWallet(values.wallet_address).status;

    const update = (key, value) => setDraft({ ...values, [key]: value });

    const save = async () => {
        setSaving(true);
        const ok = await actions.saveConfig(values);
        setSaving(false);
        if (ok) setDraft(null);
    };

    const exportAll = (format) => {
        exportEverything({ shares: history.shares, sessions, blocks: history.blocks }, format);
        track('export_data', { dataset: 'all', format });
    };

    const hashrate = stats?.hashrate || 0;
    const odds = computeOdds(hashrate, network.difficulty);

    return (
        <>
            <div className="split split--config">
                <div className="stack">
                    <section className="card panel">
                        <h2 className="panel__title">{t('cfgWalletTitle')}</h2>
                        <p className="panel__subtitle">{t('cfgWalletSub')}</p>
                        <WalletField
                            label={t('cfgWalletLabel')}
                            value={values.wallet_address || ''}
                            onChange={(value) => update('wallet_address', value)}
                            disabled={running}
                            t={t}
                        />
                        <p className="note">
                            <Rich text={t('cfgWalletOnlyPublic')} />
                        </p>
                        {running && <LockedNote>{t('cfgLockedWallet')}</LockedNote>}
                    </section>

                    <section className="card panel">
                        <h2 className="panel__title">{t('cfgPoolTitle')}</h2>
                        <p className="panel__subtitle">{t('cfgPoolSub')}</p>
                        <div className="field-grid">
                            <PoolField
                                label={t('cfgPoolUrl')}
                                value={values.pool_url || ''}
                                disabled={running}
                                onChange={(value) => update('pool_url', value)}
                            />
                            <PoolField
                                label={t('cfgPoolPort')}
                                type="number"
                                value={values.pool_port ?? ''}
                                disabled={running}
                                narrow
                                onChange={(value) => update('pool_port', parseInt(value, 10) || 0)}
                            />
                        </div>
                    </section>

                    <section className="card panel">
                        <h2 className="panel__title">{t('cfgPerfTitle')}</h2>
                        <p className="panel__subtitle">{t('cfgPerfSub')}</p>
                        <SliderField
                            label={t('cfgCpuLabel')}
                            note={t('cfgCpuLive')}
                            value={values.max_cpu_percent}
                            range={CPU_RANGE}
                            unit="%"
                            onChange={(value) => update('max_cpu_percent', value)}
                            help={t(cpuHelpKey(values.max_cpu_percent), { n: values.max_cpu_percent })}
                        />
                        <SliderField
                            label={t('cfgWorkersLabel')}
                            note={t('cfgWorkersAtStop')}
                            value={values.num_workers}
                            range={WORKERS_RANGE}
                            disabled={running}
                            onChange={(value) => update('num_workers', value)}
                            help={running ? t('cfgLockedWorkers') : t('cfgWorkersHelp')}
                        />
                    </section>
                </div>

                <div className="stack">
                    <section className="card panel panel--accent">
                        <h2 className="panel__title">{t('cfgSummaryTitle')}</h2>
                        <dl className="facts">
                            <div className="facts__row">
                                <dt>{t('cfgSumSpeed')}</dt>
                                <dd>{running && hashrate > 0 ? `≈ ${formatHashrateReadable(hashrate, lang)}` : t('cfgSumSpeedIdle')}</dd>
                            </div>
                            <div className="facts__row">
                                <dt>{t('cfgSumLoad')}</dt>
                                <dd>≈ {values.max_cpu_percent} %</dd>
                            </div>
                            {odds.hasData && (
                                <div className="facts__row">
                                    <dt>{t('cfgSumChance')}</dt>
                                    <dd>{formatOneIn(odds.probPerDay, lang, t)}</dd>
                                </div>
                            )}
                        </dl>
                        <button type="button" className="link-button link-button--block" onClick={() => onNavigate('chances')}>
                            {t('cfgExploreChances')}
                        </button>
                    </section>

                    <section className="card panel">
                        <h2 className="panel__title">{t('cfgDataTitle')}</h2>
                        <p className="panel__subtitle">{t('cfgDataSub')}</p>
                        <div className="button-row">
                            <button type="button" className="btn btn--outline btn--md" onClick={() => exportAll('csv')}>
                                {t('cfgExportCsv')}
                            </button>
                            <button type="button" className="btn btn--outline btn--md" onClick={() => exportAll('json')}>
                                {t('cfgExportJson')}
                            </button>
                        </div>
                        <div className="danger-zone">
                            <div className="danger-zone__title">{t('cfgDangerTitle')}</div>
                            <p className="danger-zone__text">{t('cfgDangerText')}</p>
                            <button type="button" className="btn btn--danger-soft btn--md" onClick={onRequestReset}>
                                {t('cfgReset')}
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            <div className="save-bar">
                <span className={`save-bar__status${dirty ? ' is-dirty' : ''}`}>
                    <span className="dot" aria-hidden="true" />
                    {t(dirty ? 'cfgDirty' : 'cfgClean')}
                </span>
                <div className="save-bar__actions">
                    <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)} disabled={!dirty || saving}>
                        {t('cfgCancel')}
                    </button>
                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={save}
                        disabled={!dirty || saving || walletStatus === 'invalid'}
                    >
                        {t(saving ? 'cfgSaving' : 'cfgSave')}
                    </button>
                </div>
            </div>
        </>
    );
}

// A text/number input for the pool settings.
function PoolField({ label, value, onChange, disabled, type = 'text', narrow = false }) {
    const id = useId();
    return (
        <div className={`field${narrow ? ' field--narrow' : ''}`}>
            <label className="field__label" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                type={type}
                className="input input--mono"
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}
