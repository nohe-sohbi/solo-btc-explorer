import Icon from './Icon.jsx';
import Switch from './Switch.jsx';

// The page header: screen title and one-line explanation, mining status, and the
// primary action (start / stop). Both extras are optional so a screen can opt out
// (the first-visit page has its own call to action).
export default function TopBar({
    title,
    subtitle,
    status,
    action,
    advanced,
    t,
}) {
    return (
        <header className="topbar">
            <div className="topbar__heading">
                <div className="topbar__title-row">
                    <h1 className="topbar__title">{title}</h1>
                    <span className={`status-chip status-chip--${status.tone}`}>
                        <span className="dot" aria-hidden="true" />
                        {status.label}
                    </span>
                </div>
                <p className="topbar__subtitle">{subtitle}</p>
            </div>

            {(advanced || action) && (
                <div className="topbar__actions">
                    {advanced && <Switch checked={advanced.checked} onChange={advanced.onChange} label={t('advancedView')} />}
                    {action && (
                        <button
                            type="button"
                            className={`btn ${action.running ? 'btn--danger-soft' : 'btn--primary'}`}
                            onClick={action.onClick}
                            disabled={action.disabled}
                        >
                            <Icon name={action.running ? 'stop' : 'play'} size={12} />
                            {action.label}
                        </button>
                    )}
                </div>
            )}
        </header>
    );
}
