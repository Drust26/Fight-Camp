// "What's new" after an update (shown once on the title screen), and the full changelog from Settings.
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Btn, Modal } from './common';
import { localChangelog, notesSince, type ReleaseNotes } from '../../game/changelog';
import { seenVersion, setSeenVersion } from '../../game/save';
import { t } from '../../i18n';

function Notes({ list }: { list: ReleaseNotes[] }) {
  return (
    <div className="col" style={{ gap: 14, maxHeight: '60vh', overflow: 'auto' }}>
      {list.map((r) => (
        <div key={r.version}>
          <div className="small" style={{ fontWeight: 700, color: 'var(--accent)', letterSpacing: '.06em' }}>{t('VERSION {v}', { v: r.version })}</div>
          <ul className="wn-list">{r.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

/** Shown once after the game was updated. A first run records the version silently. */
export function WhatsNewOnUpdate() {
  const [list] = useState<ReleaseNotes[]>(() => {
    const { seen, played } = seenVersion();
    if (seen === __APP_VERSION__) return [];
    if (!seen && !played) { setSeenVersion(__APP_VERSION__); return []; }
    return notesSince(seen, __APP_VERSION__).slice(0, 6);
  });
  const [open, setOpen] = useState(list.length > 0);
  if (!open) return null;
  const close = () => { setSeenVersion(__APP_VERSION__); setOpen(false); };
  return (
    <Modal title={t("What's new in {v}", { v: __APP_VERSION__ })} onClose={close}>
      <Notes list={list} />
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><Btn variant="primary" onClick={close}>{t("Let's fight")}</Btn></div>
    </Modal>
  );
}

export function ChangelogButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn size="sm" onClick={() => setOpen(true)}><Sparkles size={14} /> {t("What's new")}</Btn>
      {open && <Modal title={t('Changelog')} onClose={() => setOpen(false)}><Notes list={localChangelog()} /></Modal>}
    </>
  );
}
