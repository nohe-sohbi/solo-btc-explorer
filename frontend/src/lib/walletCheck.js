// UI-oriented wrapper around the address validator: turns its (English, backend-
// mirroring) error text into a small set of reasons the interface can translate.
import { validateBitcoinAddress } from './btcaddr.js';

// i18n key to show for each failure reason.
export const WALLET_ERROR_KEYS = {
    checksum: 'walletErrChecksum',
    testnet: 'walletErrTestnet',
    format: 'walletErrFormat',
    other: 'walletErrOther',
};

const REASON_PATTERNS = [
    [/testnet/i, 'testnet'],
    [/checksum/i, 'checksum'],
    [/unrecognized/i, 'format'],
];

function classifyError(message) {
    const match = REASON_PATTERNS.find(([pattern]) => pattern.test(message || ''));
    return match ? match[1] : 'other';
}

// checkWallet returns { status: 'empty' | 'valid' | 'invalid', reason? }.
export function checkWallet(address) {
    const value = (address || '').trim();
    if (!value) return { status: 'empty' };

    const result = validateBitcoinAddress(value);
    if (result.valid) return { status: 'valid' };
    return { status: 'invalid', reason: classifyError(result.error) };
}
