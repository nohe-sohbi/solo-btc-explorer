import { IS_DEMO } from '../config/runtime.js';

// Explains, in one line, that this build mines inside the browser. Only rendered in
// the backend-free demo build.
export default function DemoNote({ t }) {
    if (!IS_DEMO) return null;

    return (
        <div className="demo-note" role="note">
            <strong>{t('demoLabel')}</strong>
            <span>{t('demoText')}</span>
        </div>
    );
}
