import Icon from './Icon.jsx';

const ICONS = { info: 'info', warn: 'warning', error: 'warning' };

// A banner for a situation the user should know about. Every banner follows the
// same three-part pattern: say what's happening (title), reassure and explain
// (body), offer at most one action.
//   tone: 'info' | 'warn' | 'error'
export default function StateBanner({ tone, title, body, action, onDismiss, dismissLabel, spinning = false }) {
    return (
        <div className={`banner banner--${tone}`} role={tone === 'info' ? 'status' : 'alert'}>
            <Icon name={spinning ? 'retry' : ICONS[tone]} size={22} className={spinning ? 'banner__icon is-spinning' : 'banner__icon'} />
            <div className="banner__text">
                <div className="banner__title">{title}</div>
                <div className="banner__body">{body}</div>
            </div>
            {action && (
                <button type="button" className="btn btn--primary btn--sm" onClick={action.onClick}>
                    {action.label}
                </button>
            )}
            {onDismiss && (
                <button type="button" className="icon-button" aria-label={dismissLabel} onClick={onDismiss}>
                    <Icon name="close" size={16} />
                </button>
            )}
        </div>
    );
}
