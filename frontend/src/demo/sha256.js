// SHA-256 (synchronous, byte-oriented) for the client-side mining demo.
//
// crypto.subtle.digest is async and far too slow for a tight mining loop, so we
// use a plain JS implementation. It exposes:
//   - sha256(bytes)        : generic, correct (used for the node correctness test + fallback)
//   - doubleSHA256(bytes)  : SHA256(SHA256(bytes))
//   - makeHeaderHasher(h80): optimized hasher for the 80-byte block header (only the
//                            4 nonce bytes change), reusing padded buffers + the W array
//   - difficultyFromState  : fast float approximation of mining difficulty from the
//                            final SHA-256 state words (no BigInt in the hot loop)
//
// This mirrors the real algorithm in backend/internal/miner/worker.go.

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const INIT = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

// Compress one 64-byte block of `buf` (starting at `off`) into state `h`, using scratch `w`.
function compress(h, buf, off, w) {
    for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        w[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
    }
    for (let i = 16; i < 64; i++) {
        const x = w[i - 15], y = w[i - 2];
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }

    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
}

// Generic SHA-256 over an arbitrary-length Uint8Array. Returns Uint8Array(32).
export function sha256(data) {
    const len = data.length;
    const totalLen = (((len + 8) >> 6) + 1) << 6; // padded to a multiple of 64
    const buf = new Uint8Array(totalLen);
    buf.set(data);
    buf[len] = 0x80;
    const bitLen = len * 8;
    const hi = Math.floor(bitLen / 0x100000000);
    const lo = bitLen >>> 0;
    buf[totalLen - 8] = (hi >>> 24) & 0xff;
    buf[totalLen - 7] = (hi >>> 16) & 0xff;
    buf[totalLen - 6] = (hi >>> 8) & 0xff;
    buf[totalLen - 5] = hi & 0xff;
    buf[totalLen - 4] = (lo >>> 24) & 0xff;
    buf[totalLen - 3] = (lo >>> 16) & 0xff;
    buf[totalLen - 2] = (lo >>> 8) & 0xff;
    buf[totalLen - 1] = lo & 0xff;

    const h = new Uint32Array(INIT);
    const w = new Uint32Array(64);
    for (let off = 0; off < totalLen; off += 64) compress(h, buf, off, w);

    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
        out[i * 4] = (h[i] >>> 24) & 0xff;
        out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
        out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
        out[i * 4 + 3] = h[i] & 0xff;
    }
    return out;
}

export function doubleSHA256(data) {
    return sha256(sha256(data));
}

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
