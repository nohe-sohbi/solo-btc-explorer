import StateBanner from './StateBanner.jsx';
import { SUGGESTED_CPU_PERCENT } from '../hooks/useMiningSession.js';

// The situations worth interrupting the user for, in order of severity. Each is
// rendered only while it holds; the session hook decides when that is.
export default function StateBanners({ t, session, backgroundNotice, advanced }) {
    const { config, actions, poolHealth } = session;

    return (
        <>
            {session.serverLost && (
                <StateBanner
                    tone="error"
                    spinning
                    title={t('bannerServerTitle')}
                    body={t('bannerServerBody')}
                    action={{ label: t('bannerRetry'), onClick: actions.reconnect }}
                />
            )}
            {session.poolLost && (
                <>
                    <StateBanner
                        tone="warn"
                        spinning
                        title={t('bannerPoolTitle')}
                        body={
                            poolHealth.retryInSeconds > 0
                                ? t('bannerPoolBodyRetry', { seconds: poolHealth.retryInSeconds })
                                : t('bannerPoolBody')
                        }
                        action={
                            poolHealth.retryInSeconds > 0
                                ? { label: t('bannerPoolRetry'), onClick: actions.retryPool }
                                : undefined
                        }
                    />
                    {advanced && poolHealth.lastError && (
                        <div className="banner-detail">
                            <div className="banner-detail__label">{t('bannerAdvancedOnly')}</div>
                            <code className="banner-detail__code">{t('bannerPoolDetail', { error: poolHealth.lastError })}</code>
                        </div>
                    )}
                </>
            )}
            {session.blockMissing && (
                <StateBanner
                    tone="error"
                    title={t('bannerBlockTitle')}
                    body={t('bannerBlockBody', { seconds: session.blockRetryInSeconds })}
                    action={{ label: t('bannerBlockRetry'), onClick: actions.retryNetworkBlock }}
                />
            )}
            {session.cpuHigh && (
                <StateBanner
                    tone="warn"
                    title={t('bannerCpuTitle')}
                    body={t('bannerCpuBody', { cpu: config.max_cpu_percent })}
                    action={{
                        label: t('bannerCpuAction', { target: SUGGESTED_CPU_PERCENT }),
                        onClick: () =>
                            actions.saveConfig({ ...config, max_cpu_percent: SUGGESTED_CPU_PERCENT }, { silent: true }),
                    }}
                />
            )}
            {backgroundNotice.visible && (
                <StateBanner
                    tone="info"
                    title={t('bannerTabTitle')}
                    body={t('bannerTabBody')}
                />
            )}
        </>
    );
}
