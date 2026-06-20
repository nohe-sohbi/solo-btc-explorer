import { describe, it, expect } from 'vitest';
import { validateBitcoinAddress, isValidBitcoinAddress } from './btcaddr.js';

// Kept in sync with backend/internal/btcaddr/btcaddr_test.go so client- and
// server-side validation never disagree.

describe('validateBitcoinAddress — accepts mainnet addresses', () => {
    const valid = [
        ['default P2PKH', '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9'],
        ['genesis P2PKH', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
        ['P2SH', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'],
        ['bech32 P2WPKH', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
        ['bech32 P2WSH', 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3'],
        ['bech32m taproot', 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0'],
        ['bech32 uppercase', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'],
    ];

    it.each(valid)('%s', (_name, addr) => {
        const res = validateBitcoinAddress(addr);
        expect(res.valid, res.error).toBe(true);
        expect(isValidBitcoinAddress(addr)).toBe(true);
    });
});

describe('validateBitcoinAddress — rejects bad addresses', () => {
    const invalid = [
        ['empty', ''],
        ['too short', 'abc'],
        ['P2PKH bad checksum', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb'],
        ['P2PKH invalid char (0)', '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf0a'],
        ['bech32 bad checksum', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5'],
        ['bech32 wrong hrp', 'lc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
        ['bech32 mixed case', 'bc1Qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
        ['testnet P2PKH', 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'],
        ['testnet bech32', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'],
        ['random garbage', 'not-an-address'],
    ];

    it.each(invalid)('%s', (_name, addr) => {
        const res = validateBitcoinAddress(addr);
        expect(res.valid).toBe(false);
        expect(res.error).toBeTruthy();
        expect(isValidBitcoinAddress(addr)).toBe(false);
    });
});

describe('validateBitcoinAddress — error messages', () => {
    it('flags a testnet address specifically', () => {
        const res = validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/testnet/i);
    });
});
