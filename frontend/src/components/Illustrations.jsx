// The three small drawings of the "Bitcoin in 3 ideas" section. Plain SVG that
// inherits the accent colour from CSS (`currentColor`) so it follows the theme.

const SVG_PROPS = {
    width: 150,
    height: 80,
    viewBox: '0 0 120 80',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
};

// A chain of blocks, the last one still being written (dashed).
export function LedgerIllustration() {
    return (
        <svg {...SVG_PROPS}>
            <rect x="6" y="26" width="26" height="28" rx="6" />
            <rect x="47" y="26" width="26" height="28" rx="6" />
            <rect x="88" y="26" width="26" height="28" rx="6" strokeDasharray="4 4" />
            <path d="M32 40h15M73 40h15" />
        </svg>
    );
}

// A padlock surrounded by guesses.
export function PuzzleIllustration() {
    return (
        <svg {...SVG_PROPS}>
            <rect x="38" y="36" width="44" height="34" rx="7" />
            <path d="M48 36v-9a12 12 0 0 1 24 0v9" />
            <circle cx="60" cy="52" r="4" />
            <g className="illustration__guess" stroke="none" fill="currentColor">
                <text x="4" y="20">9c4e</text>
                <text x="90" y="24">07af</text>
                <text x="6" y="70">e12b</text>
                <text x="92" y="68">3d9a</text>
            </g>
        </svg>
    );
}

// A coin carrying the bitcoin sign.
export function RewardIllustration() {
    return (
        <svg {...SVG_PROPS}>
            <circle cx="60" cy="40" r="26" />
            <circle cx="60" cy="40" r="20" strokeOpacity="0.35" />
            <text x="60" y="50" textAnchor="middle" stroke="none" fill="currentColor" className="illustration__coin">
                ₿
            </text>
            <path d="M20 14l4 4M100 14l-4 4M16 40h5M104 40h-5" />
        </svg>
    );
}
