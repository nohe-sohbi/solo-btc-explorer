import { describe, it, expect } from 'vitest';
import { checkWallet, WALLET_ERROR_KEYS } from './walletCheck.js';
import { DICTIONARIES } from '../i18n/index.js';

const VALID_LEGACY = '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9';

describe('checkWallet', () => {
    it('treats blank input as empty rather than invalid', () => {
        expect(checkWallet('')).toEqual({ status: 'empty' });
        expect(checkWallet('   ')).toEqual({ status: 'empty' });
        expect(checkWallet(undefined)).toEqual({ status: 'empty' });
    });

    it('accepts a valid mainnet address, ignoring surrounding whitespace', () => {
        expect(checkWallet(VALID_LEGACY)).toEqual({ status: 'valid' });
        expect(checkWallet(`  ${VALID_LEGACY}  `)).toEqual({ status: 'valid' });
    });

    it('reports a typo as a checksum problem', () => {
        const typo = VALID_LEGACY.slice(0, -1) + '8';
        expect(checkWallet(typo)).toEqual({ status: 'invalid', reason: 'checksum' });
    });

    it('recognises testnet addresses', () => {
        expect(checkWallet('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toEqual({ status: 'invalid', reason: 'testnet' });
    });

    it('recognises unknown formats', () => {
        expect(checkWallet('hello world')).toEqual({ status: 'invalid', reason: 'format' });
    });

    it('falls back to a generic reason for other failures', () => {
        expect(checkWallet('1abc')).toEqual({ status: 'invalid', reason: 'other' });
    });
});

describe('WALLET_ERROR_KEYS', () => {
    it('map every reason to an existing translation', () => {
        for (const key of Object.values(WALLET_ERROR_KEYS)) {
            expect(DICTIONARIES.fr[key], key).toBeTruthy();
            expect(DICTIONARIES.en[key], key).toBeTruthy();
        }
    });
});
