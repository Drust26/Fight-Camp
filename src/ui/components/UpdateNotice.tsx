// Desktop auto-update UI: a small progress pill while an update downloads, then a prompt to restart and update.
// The prompt waits while a fight is running, so an update never interrupts a bout.
import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { Btn, useNav } from './common';
import { native, type UpdateState } from '../../game/storage';
import { store } from '../../game/store';
import { ChangelogButton } from './WhatsNew';
import { getLang, t } from '../../i18n';

const BUSY = new Set(['fight', 'practice', 'quickbout', 'fightnight']);

export function useUpdateState(): UpdateState | null {
  const [st, setSt] = useState<UpdateState | null>(null);
  useEffect(() => {
    const u = native?.updates;
    if (!u) return;
    let live = true;
    u.get().then((s) => live && setSt(s)).catch(() => {});
    const off = u.onState((s) => setSt(s));
    return () => { live = false; off(); };
  }, []);
  return st;
}

/** Saves the career, then hands over to the installer (the game closes, updates and reopens). */
export function restartAndUpdate() {
  try { if (store.state) store.saveNow(); } catch { /* the career autosaves anyway */ }
  return native?.updates?.install();
}

/** Release notes are markdown bullets that may wrap over several lines: one item per bullet. */
function noteItems(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const b = /^\s*[-*]\s+(.*)$/.exec(line);
    if (b) out.push(b[1].trim());
    else if (line.trim()) { if (out.length) out[out.length - 1] += ' ' + line.trim(); else out.push(line.trim()); }
  }
  return out;
}

const mb = (n?: number) => `${((n ?? 0) / 1048576).toFixed(1)} MB`;

export function UpdateNotice() {
  const nav = useNav();
  const st = useUpdateState();
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!st || !native?.updates) return null;
  const inFight = BUSY.has(nav.screen);
  const notes = (getLang() === 'fr' && st.notesFr) || st.notes;

  if (st.status === 'downloading') {
    return (
      <div className="upd-pill" role="status">
        <Download size={14} /> {t('Downloading update {v} · {n}%', { v: st.version ?? '', n: Math.round((st.progress ?? 0) * 100) })}
        <div className="upd-bar"><div style={{ width: `${Math.round((st.progress ?? 0) * 100)}%` }} /></div>
      </div>
    );
  }
  if (st.status !== 'ready') return null;
  if (later || inFight) {
    return (
      <div className="upd-pill ready" role="status">
        <RefreshCw size={14} /> {t('Update {v} ready', { v: st.version ?? '' })}{later ? ' · ' + t('installs when you quit') : ''}
        {!inFight && <button className="chip" onClick={() => { setBusy(true); restartAndUpdate(); }} disabled={busy}>{t('Restart now')}</button>}
      </div>
    );
  }
  return (
    <div className="overlay" style={{ zIndex: 120 }}>
      <div className="modal" style={{ maxWidth: 520 }} role="dialog" aria-label={t('Update ready')}>
        <div className="row between"><h2>{t('Update ready: version {v}', { v: st.version ?? '' })}</h2><button className="chip" aria-label={t('Close (update later)')} onClick={() => { setLater(true); native!.updates!.later(); }}><X size={14} /></button></div>
        <p className="small muted" style={{ marginTop: 8 }}>{t('You have v{v}. Fight Camp will save your career, close, install the update and reopen by itself. Your careers in {dir} are not touched.', { v: st.current ?? '', dir: native.savesDir() })}</p>
        {(notes) && <ul className="upd-notes wn-list">{noteItems(notes).map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Btn onClick={() => { setLater(true); native!.updates!.later(); }}>{t('Later')}</Btn>
          <Btn variant="primary" disabled={busy} onClick={() => { setBusy(true); restartAndUpdate(); }}><RefreshCw size={15} /> {busy ? t('Restarting…') : t('Restart and update')}</Btn>
        </div>
        <div className="tiny dim" style={{ marginTop: 8 }}>{t('Later installs it silently the next time you quit the game. Downloaded {size}, verified.', { size: mb(st.total) })}</div>
      </div>
    </div>
  );
}

/** Settings panel: version, status and a manual check. */
export function UpdatePanel() {
  const st = useUpdateState();
  const [checking, setChecking] = useState(false);
  if (!native?.updates) {
    return (
      <div className="panel">
        <div className="panel-title"><h3><RefreshCw size={16} /> {t('Version')}</h3><ChangelogButton /></div>
        <div className="small muted">{t('Fight Camp v{v}. The browser version is always the latest; the Windows game updates itself.', { v: __APP_VERSION__ })}</div>
      </div>
    );
  }
  const line = !st ? t('Checking…')
    : st.status === 'none' ? t('You have the latest version (v{v}).', { v: st.current ?? '' })
    : st.status === 'checking' ? t('Checking GitHub for updates…')
    : st.status === 'downloading' ? t('Downloading v{v}: {n}% ({got} of {total})', { v: st.version ?? '', n: Math.round((st.progress ?? 0) * 100), got: mb(st.received), total: mb(st.total) })
    : st.status === 'ready' ? t('v{v} is downloaded and ready to install.', { v: st.version ?? '' })
    : st.status === 'error' ? t('Could not check for updates: {err}', { err: st.error ?? '' })
    : st.status === 'disabled' ? t('Automatic updates run in the installed Windows game.')
    : t('Version {v}', { v: st.current ?? '' });
  return (
    <div className="panel">
      <div className="panel-title"><h3><RefreshCw size={16} /> {t('Updates')}</h3>
        <div className="row" style={{ gap: 6 }}>
          {st?.status === 'ready' && <Btn size="sm" variant="primary" onClick={() => restartAndUpdate()}>{t('Restart and update')}</Btn>}
          <ChangelogButton />
          <Btn size="sm" disabled={checking || st?.status === 'downloading' || st?.status === 'checking'} onClick={async () => { setChecking(true); try { await native!.updates!.check(); } finally { setChecking(false); } }}>{t('Check now')}</Btn>
        </div>
      </div>
      <div className="small muted">{t('Installed version:')} <b>v{st?.current ?? __APP_VERSION__}</b>. {line}</div>
      <div className="tiny dim" style={{ marginTop: 4 }}>{t('The game checks GitHub for a new version every time it starts and downloads it in the background.')}</div>
    </div>
  );
}
