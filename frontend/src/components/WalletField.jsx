import { useId } from 'react';
import Icon from './Icon.jsx';
import { checkWallet, WALLET_ERROR_KEYS } from '../lib/walletCheck.js';

// A Bitcoin address input with live validation feedback. Validation is purely
// informative here: callers decide what to block, using checkWallet themselves.
export default function WalletField({ label, value, onChange, t, disabled = false, readOnly = false, placeholder }) {
    const inputId = useId();
    const messageId = useId();
    const check = checkWallet(value);

    return (
        <div className="field">
            <label className="field__label" htmlFor={inputId}>
                {label}
            </label>
            <input
                id={inputId}
                type="text"
                className={`input input--mono${check.status === 'invalid' ? ' is-invalid' : ''}`}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                readOnly={readOnly}
                placeholder={placeholder}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={check.status === 'invalid'}
                aria-describedby={check.status === 'empty' ? undefined : messageId}
            />
            {check.status === 'valid' && (
                <p id={messageId} className="field__message field__message--ok">
                    <Icon name="check" size={14} />
                    {t('walletValid')}
                </p>
            )}
            {check.status === 'invalid' && (
                <p id={messageId} className="field__message field__message--error" role="alert">
                    <Icon name="alert" size={16} />
                    <span>
                        <strong>{t('walletInvalidTitle')}</strong> {t(WALLET_ERROR_KEYS[check.reason])}
                    </span>
                </p>
            )}
        </div>
    );
}
