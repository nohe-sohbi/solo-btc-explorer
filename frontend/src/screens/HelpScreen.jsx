import Icon from '../components/Icon.jsx';
import { formatSi } from '../lib/format.js';

// Glossary entries: i18n keys for the term, an optional "also known as" and the
// definition. Listed as data so the markup below stays a single loop.
const GLOSSARY = [
    { term: 'glossHash', aka: 'glossHashAka', text: 'glossHashText' },
    { term: 'glossHashrate', aka: 'glossHashrateAka', text: 'glossHashrateText' },
    { term: 'glossShare', aka: 'glossShareAka', text: 'glossShareText' },
    { term: 'glossDifficulty', text: 'glossDifficultyText' },
    { term: 'glossWorker', text: 'glossWorkerText' },
    { term: 'glossSolo', text: 'glossSoloText' },
];

const SAFETY_DOS = ['safetyDo1', 'safetyDo2', 'safetyDo3'];
const SAFETY_DONTS = ['safetyDont1', 'safetyDont2'];

const FAQ = [
    { question: 'faqWinQ', answer: 'faqWinA' },
    { question: 'faqHeatQ', answer: 'faqHeatA' },
    { question: 'faqCloseQ', answer: 'faqCloseA' },
];

// Vocabulary, reassurance and answers to the usual questions, in plain language.
export default function HelpScreen({ t, lang, network }) {
    return (
        <>
            <section className="card panel">
                <h2 className="panel__title">{t('glossaryTitle')}</h2>
                <dl className="glossary">
                    {GLOSSARY.map((entry) => (
                        <div key={entry.term} className="glossary__entry">
                            <dt>
                                {t(entry.term)}
                                {entry.aka && <span className="glossary__aka"> · {t(entry.aka)}</span>}
                            </dt>
                            <dd>{t(entry.text, { difficulty: formatSi(network.difficulty, lang) })}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <div className="pair">
                <section className="card panel">
                    <h2 className="panel__title">{t('safetyTitle')}</h2>
                    <ul className="safety-list">
                        {SAFETY_DOS.map((key) => (
                            <li key={key}>
                                <Icon name="check" size={16} className="safety-list__yes" />
                                {t(key)}
                            </li>
                        ))}
                        {SAFETY_DONTS.map((key) => (
                            <li key={key}>
                                <Icon name="close" size={16} className="safety-list__no" />
                                {t(key)}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="card panel">
                    <h2 className="panel__title">{t('faqTitle')}</h2>
                    <dl className="faq">
                        {FAQ.map((item) => (
                            <div key={item.question}>
                                <dt>{t(item.question)}</dt>
                                <dd>{t(item.answer)}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </div>
        </>
    );
}
