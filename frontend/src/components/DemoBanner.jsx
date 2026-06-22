// Demo banner ("banderolle") — shown only when the app is built with VITE_DEMO_MODE=true.
// Makes it unambiguous that mining runs client-side and is a demonstration.

const DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

export default function DemoBanner({ t }) {
    if (!DEMO) return null;

    return (
        <div
            role="status"
            style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--warning-bg)',
                borderBottom: '1px solid var(--warning)',
                backdropFilter: 'blur(var(--glass-blur))',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.4,
                textAlign: 'center',
            }}
        >
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <span>
                <strong style={{ color: 'var(--warning)' }}>{t('demoBannerLabel')}</strong>{' '}
                {t('demoBannerText')}
            </span>
        </div>
    );
}
