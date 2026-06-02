// Block-header construction + real-data source for the client-side mining demo.
// Ported from backend/internal/miner/worker.go (mineBatch / calculateTarget).

import { doubleSHA256 } from './sha256.js';

const MEMPOOL_BLOCKS_URL = 'https://mempool.space/api/v1/blocks';

// A real recent block, used as a fallback when the public API is unreachable so the
// demo always works (even offline). Fields match the mempool.space /api/v1/blocks shape.
export const FALLBACK_BLOCK = {
    id: '0000000000000000000101d2b92629239ca44b1adf001c8c09ce90b8db3c81d6',
    height: 952139,
    version: 537919488,
    timestamp: 1780425483,
    bits: 386008719,
    nonce: 1495947851,
    merkle_root: '3203c93c0ea202e2629420ffa647b577e6c3798ca8d57330da62ef7527ec0a19',
    previousblockhash: '000000000000000000018806025f5d31a7b02df72582b8fe808a8100db9f9eea',
    difficulty: 138955357012247.3,
};

export function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
}

export function bytesToHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
}

export function reverseBytes(bytes) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[bytes.length - 1 - i] = bytes[i];
    return out;
}

function writeUint32LE(arr, off, value) {
    arr[off] = value & 0xff;
    arr[off + 1] = (value >>> 8) & 0xff;
    arr[off + 2] = (value >>> 16) & 0xff;
    arr[off + 3] = (value >>> 24) & 0xff;
}

// Build the 80-byte Bitcoin block header from a block's fields.
// Hashes (prevhash, merkle_root) are given in display (big-endian) order by the API and
// must be byte-reversed for the internal header layout.
export function buildBlockHeader(block) {
    const header = new Uint8Array(80);
    writeUint32LE(header, 0, block.version >>> 0);
    header.set(reverseBytes(hexToBytes(block.previousblockhash)), 4);
    header.set(reverseBytes(hexToBytes(block.merkle_root)), 36);
    writeUint32LE(header, 68, block.timestamp >>> 0);
    writeUint32LE(header, 72, block.bits >>> 0);
    writeUint32LE(header, 76, (block.nonce || 0) >>> 0); // reference nonce; demo varies it
    return header;
}

// target = coeff * 2^(8*(exp-3)) from the compact "bits" representation (BigInt).
export function bitsToTarget(bits) {
    const exp = bits >>> 24;
    const coeff = BigInt(bits & 0x00ffffff);
    const shift = BigInt(8 * (exp - 3));
    return coeff << shift;
}

const DIFF1_TARGET = 0x00000000ffff0000000000000000000000000000000000000000000000000000n;

// Exact difficulty of a block-header hash (BigInt), used for verification / sanity checks.
export function difficultyExact(header) {
    const hash = doubleSHA256(header);                 // internal byte order
    const hashInt = BigInt('0x' + bytesToHex(reverseBytes(hash))); // display order integer
    if (hashInt === 0n) return Infinity;
    // float ratio of two BigInts
    return Number(DIFF1_TARGET * 1000000n / hashInt) / 1000000;
}

// Display (big-endian) hex of a header's double-SHA256 — i.e. the block hash as shown by explorers.
export function blockHashHex(header) {
    return bytesToHex(reverseBytes(doubleSHA256(header)));
}

function normalize(b) {
    return {
        id: b.id,
        height: b.height,
        version: b.version,
        timestamp: b.timestamp,
        bits: b.bits,
        nonce: b.nonce,
        merkle_root: b.merkle_root,
        previousblockhash: b.previousblockhash,
        difficulty: b.difficulty,
    };
}

// Fetch the current tip block from mempool.space (CORS-enabled public API, no backend).
export async function fetchLatestBlock() {
    const res = await fetch(MEMPOOL_BLOCKS_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`mempool.space HTTP ${res.status}`);
    const blocks = await res.json();
    if (!Array.isArray(blocks) || blocks.length === 0) throw new Error('empty block list');
    return normalize(blocks[0]);
}
