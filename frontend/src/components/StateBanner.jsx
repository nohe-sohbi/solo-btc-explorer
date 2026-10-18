import Icon from './Icon.jsx';
import Rich from './Rich.jsx';

const ICONS = { info: 'info', warn: 'warning', error: 'warning' };

// A banner for a situation the user should know about. Every banner follows the
// same three-part pattern: say what's happening (title), reassure and explain
// (body), offer at most one action (gold when it fixes things, outlined for errors).
// Banners without an action (the background-tab notice) close on their own.
//   tone: 'info' | 'warn' | 'error'
export default function StateBanner({ tone, title, body, action, spinning = false }) {
    return (
        <div className={`banner banner--${tone}`} role={tone === 'info' ? 'status' : 'alert'}>
            <Icon name={spinning ? 'retry' : ICONS[tone]} size={22} className={spinning ? 'banner__icon is-spinning' : 'banner__icon'} />
            <div className="banner__text">
                <div className="banner__title">{title}</div>
                <div className="banner__body">
                    <Rich text={body} />
                </div>
            </div>
            {action && (
                <button
                    type="button"
                    className={`btn banner__action ${tone === 'error' ? 'btn--outline' : 'btn--primary'}`}
                    onClick={action.onClick}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
