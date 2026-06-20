import { describe, it, expect } from 'vitest';
import { sha256, doubleSHA256 } from './sha256.js';

function toHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytes(str) {
    return new TextEncoder().encode(str);
}

describe('sha256', () => {
    it('matches known NIST vectors', () => {
        // Empty input
        expect(toHex(sha256(new Uint8Array(0)))).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        );
        // "abc"
        expect(toHex(sha256(bytes('abc')))).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        );
    });

    it('handles input that spans multiple blocks', () => {
        const msg = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
        expect(toHex(sha256(bytes(msg)))).toBe(
            '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
        );
    });
});

describe('doubleSHA256', () => {
    it('computes SHA256(SHA256(x)) for "abc"', () => {
        // Well-known Bitcoin double-SHA256 of "abc".
        expect(toHex(doubleSHA256(bytes('abc')))).toBe(
            '4f8b42c22dd3729b519ba6f68d2da7cc5b2d606d05daed5ad5128cc03e6c6358'
        );
    });
});
