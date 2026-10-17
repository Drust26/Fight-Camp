// Desktop auto-update UI: a small progress pill while an update downloads, then a prompt to restart and update.
// The prompt waits while a fight is running, so an update never interrupts a bout.
import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { Btn, useNav } from './common';
import { native, type UpdateState } from '../../game/storage';
import { store } from '../../game/store';

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

const mb = (n?: number) => `${((n ?? 0) / 1048576).toFixed(1)} MB`;

export function UpdateNotice() {
  const nav = useNav();
  const st = useUpdateState();
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!st || !native?.updates) return null;
  const inFight = BUSY.has(nav.screen);

  if (st.status === 'downloading') {
    return (
      <div className="upd-pill" role="status">
        <Download size={14} /> Downloading update {st.version} · {Math.round((st.progress ?? 0) * 100)}%
        <div className="upd-bar"><div style={{ width: `${Math.round((st.progress ?? 0) * 100)}%` }} /></div>
      </div>
    );
  }
  if (st.status !== 'ready') return null;
  if (later || inFight) {
    return (
      <div className="upd-pill ready" role="status">
        <RefreshCw size={14} /> Update {st.version} ready{later ? ' · installs when you quit' : ''}
        {!inFight && <button className="chip" onClick={() => { setBusy(true); restartAndUpdate(); }} disabled={busy}>Restart now</button>}
      </div>
    );
  }
  return (
    <div className="overlay" style={{ zIndex: 120 }}>
      <div className="modal" style={{ maxWidth: 520 }} role="dialog" aria-label="Update ready">
        <div className="row between"><h2>Update ready: version {st.version}</h2><button className="chip" aria-label="Close (update later)" onClick={() => { setLater(true); native!.updates!.later(); }}><X size={14} /></button></div>
        <p className="small muted" style={{ marginTop: 8 }}>You have v{st.current}. Fight Camp will save your career, close, install the update and reopen by itself. Your careers in {native.savesDir()} are not touched.</p>
        {st.notes && <pre className="upd-notes">{st.notes}</pre>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Btn onClick={() => { setLater(true); native!.updates!.later(); }}>Later</Btn>
          <Btn variant="primary" disabled={busy} onClick={() => { setBusy(true); restartAndUpdate(); }}><RefreshCw size={15} /> {busy ? 'Restarting…' : 'Restart and update'}</Btn>
        </div>
        <div className="tiny dim" style={{ marginTop: 8 }}>Later installs it silently the next time you quit the game. Downloaded {mb(st.total)}, verified.</div>
      </div>
    </div>
  );
}

/** Settings panel: version, status and a manual check. */
export function UpdatePanel() {
  const st = useUpdateState();
  const [checking, setChecking] = useState(false);
  if (!native?.updates) return null;
  const line = !st ? 'Checking…'
    : st.status === 'none' ? `You have the latest version (v${st.current}).`
    : st.status === 'checking' ? 'Checking GitHub for updates…'
    : st.status === 'downloading' ? `Downloading v${st.version}: ${Math.round((st.progress ?? 0) * 100)}% (${mb(st.received)} of ${mb(st.total)})`
    : st.status === 'ready' ? `v${st.version} is downloaded and ready to install.`
    : st.status === 'error' ? `Could not check for updates: ${st.error}`
    : st.status === 'disabled' ? 'Automatic updates run in the installed Windows game.'
    : `Version ${st.current}`;
  return (
    <div className="panel">
      <div className="panel-title"><h3><RefreshCw size={16} /> Updates</h3>
        <div className="row" style={{ gap: 6 }}>
          {st?.status === 'ready' && <Btn size="sm" variant="primary" onClick={() => restartAndUpdate()}>Restart and update</Btn>}
          <Btn size="sm" disabled={checking || st?.status === 'downloading' || st?.status === 'checking'} onClick={async () => { setChecking(true); try { await native!.updates!.check(); } finally { setChecking(false); } }}>Check now</Btn>
        </div>
      </div>
      <div className="small muted">Installed version: <b>v{st?.current ?? __APP_VERSION__}</b>. {line}</div>
      <div className="tiny dim" style={{ marginTop: 4 }}>The game checks GitHub for a new version every time it starts and downloads it in the background.</div>
    </div>
  );
}
