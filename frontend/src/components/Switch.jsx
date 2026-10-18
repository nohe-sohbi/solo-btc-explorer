// An on/off setting with a visible label (e.g. "Advanced view").
export default function Switch({ checked, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className="switch"
            onClick={() => onChange(!checked)}
        >
            <span className="switch__track" aria-hidden="true">
                <span className="switch__thumb" />
            </span>
            {label}
        </button>
    );
}
