import Icon from './Icon.jsx';

// A pill-shaped single-choice control. `variant="tabs"` exposes tab semantics (the
// choice switches a panel), `variant="toggle"` exposes pressed-button semantics
// (the choice is a setting, such as the theme).
export default function Segmented({ options, value, onChange, label, variant = 'toggle', size = 'md' }) {
    const isTabs = variant === 'tabs';
    return (
        <div
            className={`segmented segmented--${size}`}
            role={isTabs ? 'tablist' : 'group'}
            aria-label={label}
        >
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        className={`segmented__option${selected ? ' is-selected' : ''}`}
                        onClick={() => onChange(option.value)}
                        {...(isTabs ? { role: 'tab', 'aria-selected': selected } : { 'aria-pressed': selected })}
                    >
                        {option.icon && <Icon name={option.icon} size={14} />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
