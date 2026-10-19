import { describe, it, expect } from 'vitest';
import { buildBlockHeader, candidateHashHex } from './header.js';

// Bitcoin's genesis block: a header whose hash anyone can check.
const GENESIS = {
    version: 1,
    previousblockhash: '0'.repeat(64),
    merkle_root: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
    timestamp: 1231006505,
    bits: 0x1d00ffff,
};
const GENESIS_NONCE = '7c2bac1d'; // 2083236893
const GENESIS_HASH = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';

describe('candidateHashHex', () => {
    it('hashes the header with the given nonce, in explorer (big-endian) order', () => {
        const header = buildBlockHeader(GENESIS);
        expect(candidateHashHex(header, GENESIS_NONCE)).toBe(GENESIS_HASH);
    });

    it('does not modify the header it was given', () => {
        const header = buildBlockHeader(GENESIS);
        const before = [...header];
        candidateHashHex(header, GENESIS_NONCE);
        expect([...header]).toEqual(before);
    });

    it('gives another hash for another nonce', () => {
        const header = buildBlockHeader(GENESIS);
        expect(candidateHashHex(header, '00000000')).not.toBe(GENESIS_HASH);
    });
});
