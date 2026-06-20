// Mainnet Bitcoin address validation, mirroring backend/internal/btcaddr.
//
// This powers live feedback in the settings form so a user catches a mistyped
// payout address *before* mining — the backend re-validates on save, but the
// instant client-side check is what stops the typo in the first place.
//
// Supported: P2PKH ("1.."), P2SH ("3.."), and native SegWit Bech32/Bech32m
// ("bc1.."). Testnet addresses are rejected on purpose (this app is mainnet).

import { doubleSHA256 } from './sha256.js';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

// validateBitcoinAddress returns { valid: boolean, error?: string }.
export function validateBitcoinAddress(addr) {
    if (!addr) return { valid: false, error: 'address is empty' };

    const lower = addr.toLowerCase();
    if (lower.startsWith('bc1')) return validateBech32(addr);
    if (addr.startsWith('1') || addr.startsWith('3')) return validateBase58Check(addr);

    if (lower.startsWith('tb1') || addr.startsWith('m') || addr.startsWith('n') || addr.startsWith('2')) {
        return { valid: false, error: 'looks like a testnet address; a mainnet address (1.., 3.. or bc1..) is required' };
    }
    return { valid: false, error: 'unrecognized address format (expected 1.., 3.. or bc1..)' };
}

// isValidBitcoinAddress is a thin boolean wrapper.
export function isValidBitcoinAddress(addr) {
    return validateBitcoinAddress(addr).valid;
}

// ---------------------------------------------------------------------------
// Base58Check (P2PKH / P2SH)
// ---------------------------------------------------------------------------

function validateBase58Check(addr) {
    if (addr.length < 26 || addr.length > 35) {
        return { valid: false, error: 'invalid length for a legacy (base58) address' };
    }

    const decoded = base58Decode(addr);
    if (!decoded) return { valid: false, error: 'invalid base58 character' };
    if (decoded.length !== 25) return { valid: false, error: 'invalid base58 address payload length' };

    const body = decoded.slice(0, 21);
    const checksum = decoded.slice(21);
    const want = doubleSHA256(body);
    for (let i = 0; i < 4; i++) {
        if (checksum[i] !== want[i]) {
            return { valid: false, error: 'invalid address checksum (likely a typo)' };
        }
    }

    if (decoded[0] !== 0x00 && decoded[0] !== 0x05) {
        return { valid: false, error: 'unsupported address version (not mainnet)' };
    }
    return { valid: true };
}

// base58Decode returns a Uint8Array, or null on an invalid character.
function base58Decode(s) {
    let result = [0];
    for (const ch of s) {
        const idx = BASE58_ALPHABET.indexOf(ch);
        if (idx < 0) return null;

        let carry = idx;
        for (let i = result.length - 1; i >= 0; i--) {
            carry += 58 * result[i];
            result[i] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            result.unshift(carry & 0xff);
            carry >>= 8;
        }
    }

    let leadingZeros = 0;
    for (const ch of s) {
        if (ch !== '1') break;
        leadingZeros++;
    }
    while (result.length > 1 && result[0] === 0) result = result.slice(1);

    const out = new Uint8Array(leadingZeros + result.length);
    out.set(result, leadingZeros);
    return out;
}

// ---------------------------------------------------------------------------
// Bech32 / Bech32m (native SegWit)
// ---------------------------------------------------------------------------

function validateBech32(addr) {
    if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) {
        return { valid: false, error: 'bech32 address must not mix upper and lower case' };
    }
    addr = addr.toLowerCase();

    if (addr.length < 8 || addr.length > 90) {
        return { valid: false, error: 'invalid length for a bech32 address' };
    }

    const pos = addr.lastIndexOf('1');
    if (pos < 1) return { valid: false, error: 'malformed bech32 address (missing separator)' };

    const hrp = addr.slice(0, pos);
    if (hrp !== 'bc') return { valid: false, error: 'not a mainnet bech32 address' };

    const dataPart = addr.slice(pos + 1);
    if (dataPart.length < 6) return { valid: false, error: 'bech32 data too short' };

    const data = [];
    for (const ch of dataPart) {
        const idx = BECH32_CHARSET.indexOf(ch);
        if (idx < 0) return { valid: false, error: 'invalid bech32 character' };
        data.push(idx);
    }

    const witnessVersion = data[0];
    if (witnessVersion > 16) return { valid: false, error: 'invalid witness version' };

    const expectedConst = witnessVersion >= 1 ? BECH32M_CONST : BECH32_CONST;
    if (bech32Polymod(hrpExpand(hrp).concat(data)) !== expectedConst) {
        return { valid: false, error: 'invalid bech32 checksum (likely a typo)' };
    }

    const program = convertBits(data.slice(1, data.length - 6), 5, 8, false);
    if (!program || program.length < 2 || program.length > 40) {
        return { valid: false, error: 'witness program must be 2-40 bytes' };
    }
    if (witnessVersion === 0 && program.length !== 20 && program.length !== 32) {
        return { valid: false, error: 'witness v0 program must be 20 or 32 bytes' };
    }
    return { valid: true };
}

function hrpExpand(hrp) {
    const out = [];
    for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
    out.push(0);
    for (const c of hrp) out.push(c.charCodeAt(0) & 31);
    return out;
}

function bech32Polymod(values) {
    const gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const v of values) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        for (let i = 0; i < 5; i++) {
            if ((top >> i) & 1) chk ^= gen[i];
        }
    }
    return chk >>> 0;
}

// convertBits regroups 5-bit symbols into 8-bit bytes; returns null on bad padding.
function convertBits(data, from, to, pad) {
    let acc = 0;
    let bits = 0;
    const out = [];
    const maxv = (1 << to) - 1;
    for (const value of data) {
        if (value < 0 || value >> from !== 0) return null;
        acc = (acc << from) | value;
        bits += from;
        while (bits >= to) {
            bits -= to;
            out.push((acc >> bits) & maxv);
        }
    }
    if (pad) {
        if (bits > 0) out.push((acc << (to - bits)) & maxv);
    } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
        return null;
    }
    return out;
}
