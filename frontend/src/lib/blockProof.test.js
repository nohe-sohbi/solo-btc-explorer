import { describe, it, expect } from 'vitest';
import { buildBlockProof, PROOF_TYPE } from './blockProof.js';

const block = {
    timestamp: Date.UTC(2026, 9, 18, 21, 41, 7),
    height: 952143,
    worker_name: 'cpu-worker-2',
    nonce: '0x3fa91c07',
    hash: '00000000000000000002a8c1d7e4a91c',
    difficulty: 1.214e14,
};

describe('buildBlockProof', () => {
    it('exports every detail the block entry carries', () => {
        const proof = buildBlockProof(block, {
            wallet: '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9',
            rewardBTC: 3.125,
            networkDifficulty: 1.21e14,
            isDemo: true,
        });
        expect(proof).toMatchObject({
            type: PROOF_TYPE,
            mode: 'demo',
            found_at: '2026-10-18T21:41:07.000Z',
            block_height: 952143,
            worker: 'cpu-worker-2',
            nonce: '0x3fa91c07',
            block_hash: '00000000000000000002a8c1d7e4a91c',
            difficulty_reached: 1.214e14,
            network_difficulty: 1.21e14,
            wallet_address: '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9',
            reward_btc: 3.125,
        });
        expect(proof.note).toMatch(/not submitted/i);
    });

    it('exports unknown details as null instead of guessing', () => {
        const proof = buildBlockProof({ timestamp: block.timestamp });
        expect(proof.mode).toBe('server');
        expect(proof.block_height).toBeNull();
        expect(proof.worker).toBeNull();
        expect(proof.nonce).toBeNull();
        expect(proof.block_hash).toBeNull();
        expect(proof.difficulty_reached).toBeNull();
        expect(proof.network_difficulty).toBeNull();
        expect(proof.wallet_address).toBeNull();
        expect(proof.reward_btc).toBeNull();
    });
});
