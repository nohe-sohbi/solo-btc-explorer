// Demo-only SHA-256 helpers layered on the shared primitives in lib/sha256.js.
//
// The generic sha256/doubleSHA256 live in lib/ (and are unit-tested there).
// This module keeps the demo's performance-critical extras:
//   - makeHeaderHasher(h80): allocation-free hasher for the 80-byte block header
//                            (only the 4 nonce bytes change), reusing buffers + W
//   - difficultyFromState  : fast float approximation of mining difficulty from the
//                            final SHA-256 state words (no BigInt in the hot loop)
//
// This mirrors the real algorithm in backend/internal/miner/worker.go.

import { INIT, compress, sha256, doubleSHA256 } from '../lib/sha256.js';

// Re-exported so existing demo importers (header.js) keep their import path.
export { sha256, doubleSHA256 };

// Byte-swap a uint32 (little<->big endian on 32 bits).
function bswap32(x) {
    return (((x & 0xff) << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | ((x >>> 24) & 0xff)) >>> 0;
}

const DIFF1_NUM = 0xffff; // 0x00000000FFFF0000... / 2^208 == 0xFFFF

// Approximate the Bitcoin difficulty of a hash from the final SHA-256 state words.
// The block hash is displayed in reversed byte order, so the most-significant 32 bits
// of the numeric hash are bswap32(h[7]), then bswap32(h[6]). difficulty = diff1 / hashInt
// is dominated by those leading bits, which is all the demo (difficulty << 1) ever needs.
// Exact difficulty for high (network) targets is handled separately via BigInt in header.js.
export function difficultyFromState(h) {
    const top = bswap32(h[7]);      // bits 224..255 of the display-order hash integer
    const second = bswap32(h[6]);   // bits 192..223
    const denom = top * 65536 + second / 65536;
    if (denom <= 0) return Infinity;
    return DIFF1_NUM / denom;
}

// Build an optimized hasher bound to a fixed 80-byte header where only the nonce
// (bytes 76..79, little-endian) changes between calls. Returns a function
// hash(nonce) -> Uint32Array(8) holding the final SHA-256 state (reused across calls).
export function makeHeaderHasher(header80) {
    // First hash: 80 bytes -> padded to 128 bytes (two 64-byte blocks).
    const pad1 = new Uint8Array(128);
    pad1.set(header80.subarray(0, 80));
    pad1[80] = 0x80;
    // bit length = 640 = 0x0280, big-endian in the last 8 bytes
    pad1[126] = 0x02;
    pad1[127] = 0x80;

    // Second hash: 32-byte digest -> padded to 64 bytes (one block).
    const pad2 = new Uint8Array(64);
    pad2[32] = 0x80;
    // bit length = 256 = 0x0100
    pad2[62] = 0x01;
    pad2[63] = 0x00;

    const w = new Uint32Array(64);
    const h = new Uint32Array(8);
    const mid = new Uint32Array(8); // first-hash state, written into pad2 as bytes

    return function hash(nonce) {
        pad1[76] = nonce & 0xff;
        pad1[77] = (nonce >>> 8) & 0xff;
        pad1[78] = (nonce >>> 16) & 0xff;
        pad1[79] = (nonce >>> 24) & 0xff;

        // First SHA-256 (two blocks)
        mid.set(INIT);
        compress(mid, pad1, 0, w);
        compress(mid, pad1, 64, w);

        // Write first digest (big-endian words) into pad2[0..31]
        for (let i = 0; i < 8; i++) {
            const v = mid[i];
            pad2[i * 4] = (v >>> 24) & 0xff;
            pad2[i * 4 + 1] = (v >>> 16) & 0xff;
            pad2[i * 4 + 2] = (v >>> 8) & 0xff;
            pad2[i * 4 + 3] = v & 0xff;
        }

        // Second SHA-256 (one block)
        h.set(INIT);
        compress(h, pad2, 0, w);
        return h;
    };
}
