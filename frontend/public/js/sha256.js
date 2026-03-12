// Pure synchronous SHA-256 implementation for Web Workers.
// Uses pre-computed constants for performance in tight mining loops.

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

// Pre-allocated working arrays (reused across calls)
const W = new Uint32Array(64);

function sha256(data) {
    // Pre-processing: padding
    const bitLen = data.length * 8;
    // message + 1 byte (0x80) + padding + 8 bytes (length)
    const totalLen = Math.ceil((data.length + 9) / 64) * 64;
    const padded = new Uint8Array(totalLen);
    padded.set(data);
    padded[data.length] = 0x80;

    // Append bit length as big-endian 64-bit
    const view = new DataView(padded.buffer);
    view.setUint32(totalLen - 4, bitLen, false);

    // Initialize hash values
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    // Process each 64-byte block
    for (let offset = 0; offset < totalLen; offset += 64) {
        // Prepare message schedule
        for (let i = 0; i < 16; i++) {
            W[i] = view.getUint32(offset + i * 4, false);
        }
        for (let i = 16; i < 64; i++) {
            const s0 = (rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3)) >>> 0;
            const s1 = (rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10)) >>> 0;
            W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
        }

        let a = h0, b = h1, c = h2, d = h3;
        let e = h4, f = h5, g = h6, h = h7;

        for (let i = 0; i < 64; i++) {
            const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
            const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const temp2 = (S0 + maj) >>> 0;

            h = g; g = f; f = e;
            e = (d + temp1) >>> 0;
            d = c; c = b; b = a;
            a = (temp1 + temp2) >>> 0;
        }

        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
        h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    const result = new Uint8Array(32);
    const rv = new DataView(result.buffer);
    rv.setUint32(0, h0, false);  rv.setUint32(4, h1, false);
    rv.setUint32(8, h2, false);  rv.setUint32(12, h3, false);
    rv.setUint32(16, h4, false); rv.setUint32(20, h5, false);
    rv.setUint32(24, h6, false); rv.setUint32(28, h7, false);
    return result;
}

function rotr(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
}

// Optimized double SHA-256 for 80-byte block headers (fixed size).
// Avoids allocations by reusing buffers.
const HEADER_PADDED = new Uint8Array(128); // 80 bytes + padding fits in 2 blocks
HEADER_PADDED[80] = 0x80;
// Length in bits = 80 * 8 = 640 = 0x280
HEADER_PADDED[126] = 0x02;
HEADER_PADDED[127] = 0x80;

const HASH_PADDED = new Uint8Array(64); // 32 bytes + padding fits in 1 block
HASH_PADDED[32] = 0x80;
// Length in bits = 32 * 8 = 256 = 0x100
HASH_PADDED[62] = 0x01;
HASH_PADDED[63] = 0x00;

function doubleSHA256Header(header) {
    // Copy header into pre-padded buffer
    HEADER_PADDED.set(header);
    const first = sha256Raw(HEADER_PADDED, 128);

    // Copy first hash into pre-padded buffer
    const fv = new DataView(new ArrayBuffer(32));
    fv.setUint32(0, first[0], false); fv.setUint32(4, first[1], false);
    fv.setUint32(8, first[2], false); fv.setUint32(12, first[3], false);
    fv.setUint32(16, first[4], false); fv.setUint32(20, first[5], false);
    fv.setUint32(24, first[6], false); fv.setUint32(28, first[7], false);
    HASH_PADDED.set(new Uint8Array(fv.buffer), 0);

    const second = sha256Raw(HASH_PADDED, 64);

    const result = new Uint8Array(32);
    const rv = new DataView(result.buffer);
    rv.setUint32(0, second[0], false); rv.setUint32(4, second[1], false);
    rv.setUint32(8, second[2], false); rv.setUint32(12, second[3], false);
    rv.setUint32(16, second[4], false); rv.setUint32(20, second[5], false);
    rv.setUint32(24, second[6], false); rv.setUint32(28, second[7], false);
    return result;
}

// sha256Raw processes already-padded data and returns [h0..h7] as Uint32Array
function sha256Raw(padded, totalLen) {
    const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (let offset = 0; offset < totalLen; offset += 64) {
        for (let i = 0; i < 16; i++) {
            W[i] = view.getUint32(offset + i * 4, false);
        }
        for (let i = 16; i < 64; i++) {
            const s0 = (rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3)) >>> 0;
            const s1 = (rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10)) >>> 0;
            W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
        }

        let a = h0, b = h1, c = h2, d = h3;
        let e = h4, f = h5, g = h6, h = h7;

        for (let i = 0; i < 64; i++) {
            const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
            const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const temp2 = (S0 + maj) >>> 0;

            h = g; g = f; f = e;
            e = (d + temp1) >>> 0;
            d = c; c = b; b = a;
            a = (temp1 + temp2) >>> 0;
        }

        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
        h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    return new Uint32Array([h0, h1, h2, h3, h4, h5, h6, h7]);
}

// General-purpose doubleSHA256 for arbitrary data (coinbase, merkle)
function doubleSHA256(data) {
    return sha256(sha256(data));
}
