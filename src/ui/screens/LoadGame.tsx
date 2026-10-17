import { native } from '../../game/storage';
import { useState } from 'react';
import { ArrowLeft, Download, Trash2, Upload, Play, RotateCcw, FolderOpen } from 'lucide-react';
import { Btn, Confirm, useNav } from '../components/common';
import { deleteSlot, exportSlot, importToSlot, readSlot, restoreBackup, slotInfos, storageUsedKB } from '../../game/save';
import { store } from '../../game/store';
import { fmtDate } from '../../game/core';

export function LoadScreen() {
  const nav = useNav();
  const [infos, setInfos] = useState(slotInfos());
  const [del, setDel] = useState<number | null>(null);
  const [imp, setImp] = useState<number | null>(null);
  const [text, setText] = useState('');
  const refresh = () => setInfos(slotInfos());

  const load = (slot: number) => {
    const r = readSlot(slot);
    if (!r.state) { nav.toast(`Could not load: ${r.info.error}`, 'err'); return; }
    store.set(r.state);
    nav.setTab('overview');
    nav.go(r.state.player.retired ? 'retired' : 'hub');
  };
  const doExport = (slot: number) => {
    const data = exportSlot(slot);
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fightcamp-slot${slot}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', padding: '30px 40px' }}>
      <Btn variant="ghost" onClick={() => nav.go('title')}><ArrowLeft size={16} /> Title</Btn>
      <h1 style={{ margin: '14px 0 6px' }}>Load Career</h1>
      {native ? (
        <div className="row wrap small muted" style={{ marginBottom: 18, gap: 10 }}>
          <span>Saves are files in <b className="mono">{native.savesDir()}</b> ({storageUsedKB()} KB, compressed). Back them up by copying that folder.</span>
          <Btn size="sm" onClick={() => native!.openSavesFolder()}><FolderOpen size={14} /> Open saves folder</Btn>
        </div>
      ) : <p className="small muted" style={{ marginBottom: 18 }}>Fight Camp is using about {storageUsedKB()} KB of this browser's ~5 MB storage (saves are compressed).</p>}
      <div className="col" style={{ maxWidth: 820 }}>
        {infos.map((s) => (
          <div key={s.slot} className={`slot ${s.status === 'empty' ? 'empty' : ''}`}>
            <span className="num" style={{ fontSize: 28, width: 32, color: 'var(--accent)' }}>{s.slot}</span>
            <div className="grow">
              {s.status === 'empty' && <span className="muted">Empty slot</span>}
              {s.status === 'ok' && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{s.name} {s.retired && <span className="tag gold">Retired</span>} {s.modified && <span className="tag" title="Admin tools were used in this career">Modified</span>}</div>
                  <div className="small muted">Record {s.record} · {fmtDate(s.day ?? 0)} · saved {s.savedAt ? new Date(s.savedAt).toLocaleString() : '—'}</div>
                </>
              )}
              {(s.status === 'corrupt' || s.status === 'newer') && (
                <>
                  <div className="red" style={{ fontWeight: 600 }}>Save can't be loaded</div>
                  <div className="small muted">{s.error}. The data has not been deleted — you can export it, or try the automatic backup.</div>
                </>
              )}
            </div>
            <div className="row">
              {s.status === 'ok' && <Btn variant="primary" onClick={() => load(s.slot)}><Play size={15} /> Load</Btn>}
              {s.status === 'corrupt' && <Btn onClick={() => { if (restoreBackup(s.slot)) { nav.toast('Backup restored.', 'ok'); refresh(); } else nav.toast('No usable backup.', 'err'); }}><RotateCcw size={15} /> Backup</Btn>}
              {s.status !== 'empty' && <Btn size="sm" onClick={() => doExport(s.slot)} aria-label="Export"><Download size={15} /></Btn>}
              <Btn size="sm" onClick={() => { setImp(s.slot); setText(''); }} aria-label="Import"><Upload size={15} /></Btn>
              {s.status !== 'empty' && <Btn size="sm" variant="danger" onClick={() => setDel(s.slot)} aria-label="Delete"><Trash2 size={15} /></Btn>}
            </div>
          </div>
        ))}
      </div>
      {del !== null && (
        <Confirm title={`Delete slot ${del}?`} body="This permanently deletes the career in this slot. This can't be undone." confirm="Delete forever" danger
          onNo={() => setDel(null)} onYes={() => { deleteSlot(del); if (store.state?.slot === del) store.set(null); setDel(null); refresh(); nav.toast('Slot deleted.'); }} />
      )}
      {imp !== null && (
        <div className="overlay">
          <div className="modal">
            <h2>Import into slot {imp}</h2>
            <p className="muted small">Paste exported save JSON. {infos.find((x) => x.slot === imp)?.status !== 'empty' && <b className="red">This will overwrite the career in this slot.</b>}</p>
            <textarea className="input" style={{ height: 160, fontFamily: 'monospace', fontSize: 11 }} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <Btn onClick={() => setImp(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={() => { const err = importToSlot(imp, text); if (err) nav.toast(`Import failed: ${err}`, 'err'); else { nav.toast('Imported.', 'ok'); setImp(null); refresh(); } }}>Import</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
