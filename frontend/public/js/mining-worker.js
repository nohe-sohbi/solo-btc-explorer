// Bitcoin Mining Web Worker
// Port of backend/internal/miner/worker.go to JavaScript
importScripts('sha256.js');

let running = false;
let extranonce1 = '';
let extranonce2Size = 4;
let currentJob = null;
let hashCount = 0;
let sessionHashes = 0;
let lastReportTime = 0;
let bestDifficulty = 0;
let batchSize = 5000;
let sleepMs = 1;

// difficulty1Target = 0x00000000FFFF0000...0 (256 bits)
const DIFF1_HEX = '00000000FFFF0000000000000000000000000000000000000000000000000000';
const DIFF1 = BigInt('0x' + DIFF1_HEX);

self.onmessage = function(e) {
    const msg = e.data;
    switch (msg.type) {
        case 'configure':
            extranonce1 = msg.extranonce1;
            extranonce2Size = msg.extranonce2Size;
            break;
        case 'newJob':
            currentJob = msg.job;
            break;
        case 'start':
            if (!running) {
                running = true;
                hashCount = 0;
                sessionHashes = 0;
                bestDifficulty = 0;
                lastReportTime = Date.now();
                self.postMessage({ type: 'status', running: true });
                mineLoop();
            }
            break;
        case 'stop':
            running = false;
            self.postMessage({ type: 'status', running: false });
            break;
        case 'setThrottle':
            batchSize = msg.batchSize || 5000;
            sleepMs = msg.sleepMs !== undefined ? msg.sleepMs : 1;
            break;
    }
};

function mineLoop() {
    if (!running) return;

    if (!currentJob) {
        setTimeout(mineLoop, 100);
        return;
    }

    const job = currentJob;

    // Generate random extranonce2
    const en2 = generateExtranonce2(extranonce2Size);

    // Build coinbase
    const coinbaseHex = job.coinbase1 + extranonce1 + en2 + job.coinbase2;
    const coinbaseBytes = hexToBytes(coinbaseHex);

    // Double SHA256 of coinbase
    let merkleRoot = doubleSHA256(coinbaseBytes);

    // Calculate merkle root through branches
    for (const branch of (job.merkleBranch || [])) {
        const branchBytes = hexToBytes(branch);
        const combined = new Uint8Array(merkleRoot.length + branchBytes.length);
        combined.set(merkleRoot);
        combined.set(branchBytes, merkleRoot.length);
        merkleRoot = doubleSHA256(combined);
    }

    // Reverse merkle root for block header (Bitcoin endianness)
    const merkleRootReversed = reverseBytes(merkleRoot);

    // Parse header components
    const version = hexToBytes(job.version);
    const prevHash = hexToBytes(job.prevHash);
    const ntime = hexToBytes(job.ntime);
    const nbits = hexToBytes(job.nbits);

    // Build 80-byte block header
    const header = new Uint8Array(80);
    header.set(version, 0);
    header.set(prevHash, 4);
    header.set(merkleRootReversed, 36);
    header.set(ntime, 68);
    header.set(nbits, 72);

    // Calculate target from nbits
    const target = calculateTarget(job.nbits);

    // Mine batch of random nonces
    for (let i = 0; i < batchSize; i++) {
        // Random nonce (32-bit)
        const nonce = (Math.random() * 0xFFFFFFFF) >>> 0;

        // Write nonce as little-endian at offset 76
        header[76] = nonce & 0xff;
        header[77] = (nonce >> 8) & 0xff;
        header[78] = (nonce >> 16) & 0xff;
        header[79] = (nonce >> 24) & 0xff;

        // Double SHA256
        const hash = doubleSHA256Header(header);
        hashCount++;
        sessionHashes++;

        // Convert reversed hash to BigInt for comparison
        const reversedHash = reverseBytes(hash);
        const hashInt = bytesToBigInt(reversedHash);

        // Calculate difficulty
        if (hashInt > 0n) {
            const diff = Number(DIFF1 / hashInt);
            if (diff > bestDifficulty) {
                bestDifficulty = diff;
                self.postMessage({ type: 'bestDifficulty', difficulty: bestDifficulty });
            }
        }

        // Check if hash meets target (share found)
        if (hashInt > 0n && hashInt <= target) {
            const nonceHex = nonce.toString(16).padStart(8, '0');
            self.postMessage({
                type: 'shareFound',
                jobId: job.id,
                extranonce2: en2,
                ntime: job.ntime,
                nonce: nonceHex,
                difficulty: bestDifficulty
            });
        }
    }

    // Report hashrate every ~1 second
    const now = Date.now();
    const elapsed = (now - lastReportTime) / 1000;
    if (elapsed >= 1) {
        const hashrate = sessionHashes / ((now - (lastReportTime - (elapsed - 1) * 1000)) / 1000);
        self.postMessage({
            type: 'hashrate',
            hashrate: sessionHashes / elapsed,
            hashCount: hashCount
        });
        sessionHashes = 0;
        lastReportTime = now;
    }

    // Yield to event loop for throttling
    setTimeout(mineLoop, sleepMs);
}

// --- Utility functions ---

function hexToBytes(hex) {
    if (!hex) return new Uint8Array(0);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

function reverseBytes(data) {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[data.length - 1 - i] = data[i];
    }
    return result;
}

function generateExtranonce2(size) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
}

function calculateTarget(nbitsHex) {
    const nbitsBytes = hexToBytes(nbitsHex);
    if (nbitsBytes.length !== 4) return 0n;

    const exp = nbitsBytes[0];
    const coeff = BigInt((nbitsBytes[1] << 16) | (nbitsBytes[2] << 8) | nbitsBytes[3]);

    // target = coeff * 2^(8*(exp-3))
    const shift = BigInt(8 * (exp - 3));
    return coeff << shift;
}

function bytesToBigInt(bytes) {
    let hex = '0x';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return BigInt(hex);
}
