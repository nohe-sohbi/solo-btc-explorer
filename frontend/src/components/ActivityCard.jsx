import { describeEvent } from '../lib/activity.js';
import { LOCALES } from '../lib/bigNumbers.js';

const VISIBLE_EVENTS = 6;

// Colour of the bullet in front of each event, by event kind.
const TONES = {
    info: 'info',
    shares: 'ok',
    success: 'ok',
    record: 'accent',
    block: 'accent',
    warning: 'danger',
};

// The recent-events stream: validated proofs, records, connection changes…
export default function ActivityCard({ t, lang, feed, onOpenHistory }) {
    const locale = LOCALES[lang] || LOCALES.en;

    return (
        <section className="card panel">
            <div className="panel__header">
                <h2 className="panel__title">{t('activityTitle')}</h2>
                <button type="button" className="link-button" onClick={onOpenHistory}>
                    {t('activityAll')}
                </button>
            </div>

            {feed.length === 0 ? (
                <p className="panel__empty">{t('activityEmpty')}</p>
            ) : (
                <ul className="rows">
                    {feed.slice(0, VISIBLE_EVENTS).map((event) => (
                        <li key={event.id} className="activity-row">
                            <span className={`dot dot--${TONES[event.kind] || 'info'}`} aria-hidden="true" />
                            <span className="activity-row__text">{describeEvent(event, t, lang)}</span>
                            <time className="activity-row__time" dateTime={new Date(event.ts).toISOString()}>
                                {new Date(event.ts).toLocaleTimeString(locale)}
                            </time>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
