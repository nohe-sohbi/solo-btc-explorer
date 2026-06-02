// Mining WebWorker for the client-side demo.
// Runs a real double-SHA256 proof-of-work loop over a fixed block header, varying the
// nonce, and reports progress/shares/blocks back to the engine. CPU throttling is done
// by sleeping proportionally between batches (mirrors backend/internal/miner/worker.go).

import { makeHeaderHasher, difficultyFromState } from './sha256.js';

const BATCH = 20000; // hashes per tick — small enough to stay responsive to stop/config

let running = false;
let workerId = 0;
let cpuPercent = 100;
let shareDifficulty = 0.00005; // share-level difficulty (a real pool sets one far below the network)
let networkDifficulty = Infinity;

let hashFn = null;
let nonce = 0;
let hashCount = 0;     // cumulative, like worker.go
let bestDifficulty = 0;

function rebuild(headerBytes) {
    hashFn = makeHeaderHasher(new Uint8Array(headerBytes));
    nonce = (Math.floor(Math.random() * 0x100000000)) >>> 0;
}

function mineTick() {
    if (!running || !hashFn) return;

    const start = performance.now();
    const shares = [];
    let blockFound = null;

    for (let i = 0; i < BATCH; i++) {
        const state = hashFn(nonce);
        const diff = difficultyFromState(state);
        if (diff > bestDifficulty) bestDifficulty = diff;

        if (diff >= shareDifficulty) {
            const nonceHex = (nonce >>> 0).toString(16).padStart(8, '0');
            if (diff >= networkDifficulty) {
                blockFound = { difficulty: diff, nonce: nonceHex };
            } else {
                shares.push({ difficulty: diff, nonce: nonceHex });
            }
        }
        nonce = (nonce + 1) >>> 0;
    }
    hashCount += BATCH;

    postMessage({ type: 'progress', workerId, hashCount, bestDifficulty });
    for (const s of shares) {
        postMessage({ type: 'share', workerId, difficulty: s.difficulty, nonce: s.nonce });
    }
    if (blockFound) {
        postMessage({ type: 'block', workerId, difficulty: blockFound.difficulty, nonce: blockFound.nonce });
    }

    // CPU throttle: keep a duty cycle of cpuPercent by sleeping after each batch.
    const elapsed = performance.now() - start;
    const cpu = Math.max(1, Math.min(100, cpuPercent));
    const delay = cpu < 100 ? elapsed * (100 - cpu) / cpu : 0;
    setTimeout(mineTick, delay);
}

onmessage = (e) => {
    const msg = e.data;
    switch (msg.cmd) {
        case 'start':
            workerId = msg.workerId;
            cpuPercent = msg.cpuPercent;
            shareDifficulty = msg.shareDifficulty;
            networkDifficulty = msg.networkDifficulty;
            hashCount = 0;
            bestDifficulty = 0;
            rebuild(msg.header);
            if (!running) {
                running = true;
                mineTick();
            }
            break;
        case 'stop':
            running = false;
            break;
        case 'setCpu':
            cpuPercent = msg.cpuPercent;
            break;
        case 'setHeader':
            rebuild(msg.header);
            break;
        default:
            break;
    }
};
