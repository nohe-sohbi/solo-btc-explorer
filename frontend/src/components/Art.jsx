import { assetUrl } from '../lib/assets.js';

// Decorative artwork. `fade` melts one edge into the surrounding card so the picture
// never shows a hard rectangle behind the text it sits next to.
//   fade: 'left' | 'bottom' | 'none'
export default function Art({ name, theme, fade = 'none', className = '', position }) {
    return (
        <div className={`art art--fade-${fade} ${className}`.trim()} aria-hidden="true">
            <img src={assetUrl(name, theme)} alt="" style={position ? { objectPosition: position } : undefined} />
        </div>
    );
}
