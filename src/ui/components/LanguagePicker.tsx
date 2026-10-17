// Language choice: stored in settings; the app remounts in the new language straight away.
import { Languages } from 'lucide-react';
import { store, useSettings } from '../../game/store';
import { detectLang, LANGS, t } from '../../i18n';

export function LanguagePicker({ compact }: { compact?: boolean }) {
  const s = useSettings();
  const cur = s.lang ?? detectLang();
  return (
    <div className="row wrap" style={{ gap: 6, alignItems: 'center' }} role="group" aria-label={t('Language')}>
      {compact && <Languages size={14} className="dim" aria-hidden />}
      {LANGS.map((l) => (
        <button key={l.id} className={`chip ${cur === l.id ? 'on' : ''}`} lang={l.id} aria-pressed={cur === l.id} onClick={() => store.updateSettings({ lang: l.id })}>{l.name}</button>
      ))}
    </div>
  );
}
