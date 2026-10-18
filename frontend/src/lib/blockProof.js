// A found block candidate is the rarest event the app can produce, so the user can
// export it as a small JSON "proof" to keep. This module shapes that document.

export const PROOF_TYPE = 'soloforge-block-candidate';

// buildBlockProof assembles the exportable proof from a block history entry.
// Fields the entry doesn't carry (the Go backend records fewer details than the
// in-browser demo) are exported as null rather than guessed.
export function buildBlockProof(block, { wallet = '', rewardBTC = 0, networkDifficulty = 0, isDemo = false } = {}) {
    return {
        type: PROOF_TYPE,
        mode: isDemo ? 'demo' : 'server',
        found_at: new Date(block.timestamp).toISOString(),
        block_height: block.height ?? null,
        worker: block.worker_name ?? null,
        nonce: block.nonce ?? null,
        block_hash: block.hash || null,
        difficulty_reached: block.difficulty ?? null,
        network_difficulty: networkDifficulty > 0 ? networkDifficulty : null,
        wallet_address: wallet || null,
        reward_btc: rewardBTC > 0 ? rewardBTC : null,
        note: isDemo
            ? 'Demo mode: this candidate was not submitted to the Bitcoin network, so no reward is owed.'
            : 'Candidate submitted to the configured pool.',
    };
}
