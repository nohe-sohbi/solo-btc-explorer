// Build-time runtime flags, read once so every module agrees on the mode.
//
// IS_DEMO is true when the app is built with VITE_DEMO_MODE=true: mining then runs
// inside the browser (src/demo) instead of talking to the Go backend.
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

// A real, valid mainnet address used as the demo's default payout address, so a
// visitor without a Bitcoin wallet can try the app (the demo pays nothing out).
export const EXAMPLE_WALLET_ADDRESS = '1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9';
