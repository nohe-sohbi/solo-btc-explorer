import Icon from './Icon.jsx';
import Segmented from './Segmented.jsx';
import { assetUrl } from '../lib/assets.js';

// Navigation order and icons. Labels come from i18n (`labelKey`), screen ids from
// lib/preferences.js.
const NAV_ITEMS = [
    { route: 'dashboard', icon: 'dashboard', labelKey: 'navDashboard' },
    { route: 'chances', icon: 'target', labelKey: 'navChances' },
    { route: 'history', icon: 'history', labelKey: 'navHistory' },
    { route: 'config', icon: 'settings', labelKey: 'navConfig' },
    { route: 'help', icon: 'help', labelKey: 'navHelp' },
];

// The left menu: brand, screen navigation, pool connection status, and the
// theme / language preferences.
export default function Sidebar({
    route,
    onNavigate,
    theme,
    onThemeChange,
    onToggleLanguage,
    connection,
    pool,
    cpuPercent,
    t,
}) {
    return (
        <aside className="sidebar">
            <div className="sidebar__brand">
                <img className="sidebar__logo" src={assetUrl('icon-block', theme)} alt="" />
                <div>
                    <div className="sidebar__name">{t('appName')}</div>
                    <div className="sidebar__tagline">{t('appTagline')}</div>
                </div>
            </div>

            <nav className="sidebar__nav" aria-label={t('navLabel')}>
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.route}
                        type="button"
                        className={`nav-link${route === item.route ? ' is-active' : ''}`}
                        aria-current={route === item.route ? 'page' : undefined}
                        onClick={() => onNavigate(item.route)}
                    >
                        <Icon name={item.icon} />
                        {t(item.labelKey)}
                    </button>
                ))}
            </nav>

            <div className="sidebar__footer">
                <div className="pool-card">
                    <div className={`pool-card__status pool-card__status--${connection.tone}`}>
                        <span className="dot" aria-hidden="true" />
                        {t(connection.labelKey)}
                    </div>
                    <div className="pool-card__host">{pool}</div>
                    <div className="pool-card__note">{t('sidePoolNote', { cpu: cpuPercent })}</div>
                </div>

                <Segmented
                    label={t('themeLabel')}
                    value={theme}
                    onChange={onThemeChange}
                    options={[
                        { value: 'dark', label: t('themeDark'), icon: 'moon' },
                        { value: 'light', label: t('themeLight'), icon: 'sun' },
                    ]}
                />
                <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={onToggleLanguage}
                    aria-label={t('languageSwitchAria')}
                >
                    {t('languageSwitch', { name: t('languageName') })}
                </button>
            </div>
        </aside>
    );
}
