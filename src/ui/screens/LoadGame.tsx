import { native } from '../../game/storage';
import { useState } from 'react';
import { ArrowLeft, Download, Trash2, Upload, Play, RotateCcw, FolderOpen } from 'lucide-react';
import { Btn, Confirm, useNav } from '../components/common';
import { deleteSlot, exportSlot, importToSlot, readSlot, restoreBackup, slotInfos, storageUsedKB } from '../../game/save';
import { store } from '../../game/store';
import { fmtDate } from '../../game/core';
import { locale, t, tx } from '../../i18n';

export function LoadScreen() {
  const nav = useNav();
  const [infos, setInfos] = useState(slotInfos());
  const [del, setDel] = useState<number | null>(null);
  const [imp, setImp] = useState<number | null>(null);
  const [text, setText] = useState('');
  const refresh = () => setInfos(slotInfos());

  const load = (slot: number) => {
    const r = readSlot(slot);
    if (!r.state) { nav.toast(t('Could not load: {err}', { err: tx(r.info.error) }), 'err'); return; }
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
      <Btn variant="ghost" onClick={() => nav.go('title')}><ArrowLeft size={16} /> {t('Title screen')}</Btn>
      <h1 style={{ margin: '14px 0 6px' }}>{t('Load Career')}</h1>
      {native ? (
        <div className="row wrap small muted" style={{ marginBottom: 18, gap: 10 }}>
          <span>{t('Saves are files in {dir} ({n} KB, compressed). Back them up by copying that folder.', { dir: native.savesDir(), n: storageUsedKB() })}</span>
          <Btn size="sm" onClick={() => native!.openSavesFolder()}><FolderOpen size={14} /> {t('Open saves folder')}</Btn>
        </div>
      ) : <p className="small muted" style={{ marginBottom: 18 }}>{t("Fight Camp is using about {n} KB of this browser's ~5 MB storage (saves are compressed).", { n: storageUsedKB() })}</p>}
      <div className="col" style={{ maxWidth: 820 }}>
        {infos.map((s) => (
          <div key={s.slot} className={`slot ${s.status === 'empty' ? 'empty' : ''}`}>
            <span className="num" style={{ fontSize: 28, width: 32, color: 'var(--accent)' }}>{s.slot}</span>
            <div className="grow">
              {s.status === 'empty' && <span className="muted">{t('Empty slot')}</span>}
              {s.status === 'ok' && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{s.name} {s.retired && <span className="tag gold">{t('Retired')}</span>} {s.modified && <span className="tag" title={t('Admin tools were used in this career')}>{t('Modified')}</span>}</div>
                  <div className="small muted">{t('Record {rec}', { rec: s.record ?? '' })} · {fmtDate(s.day ?? 0)} · {t('saved {when}', { when: s.savedAt ? new Date(s.savedAt).toLocaleString(locale()) : '—' })}</div>
                </>
              )}
              {(s.status === 'corrupt' || s.status === 'newer') && (
                <>
                  <div className="red" style={{ fontWeight: 600 }}>{t("Save can't be loaded")}</div>
                  <div className="small muted">{tx(s.error)}. {t('The data has not been deleted — you can export it, or try the automatic backup.')}</div>
                </>
              )}
            </div>
            <div className="row">
              {s.status === 'ok' && <Btn variant="primary" onClick={() => load(s.slot)}><Play size={15} /> {t('Load')}</Btn>}
              {s.status === 'corrupt' && <Btn onClick={() => { if (restoreBackup(s.slot)) { nav.toast(t('Backup restored.'), 'ok'); refresh(); } else nav.toast(t('No usable backup.'), 'err'); }}><RotateCcw size={15} /> {t('Backup')}</Btn>}
              {s.status !== 'empty' && <Btn size="sm" onClick={() => doExport(s.slot)} aria-label={t('Export')}><Download size={15} /></Btn>}
              <Btn size="sm" onClick={() => { setImp(s.slot); setText(''); }} aria-label={t('Import')}><Upload size={15} /></Btn>
              {s.status !== 'empty' && <Btn size="sm" variant="danger" onClick={() => setDel(s.slot)} aria-label={t('Delete')}><Trash2 size={15} /></Btn>}
            </div>
          </div>
        ))}
      </div>
      {del !== null && (
        <Confirm title={t('Delete slot {n}?', { n: del })} body={t("This permanently deletes the career in this slot. This can't be undone.")} confirm={t('Delete forever')} danger
          onNo={() => setDel(null)} onYes={() => { deleteSlot(del); if (store.state?.slot === del) store.set(null); setDel(null); refresh(); nav.toast(t('Slot deleted.')); }} />
      )}
      {imp !== null && (
        <div className="overlay">
          <div className="modal">
            <h2>{t('Import into slot {n}', { n: imp })}</h2>
            <p className="muted small">{t('Paste exported save JSON.')} {infos.find((x) => x.slot === imp)?.status !== 'empty' && <b className="red">{t('This will overwrite the career in this slot.')}</b>}</p>
            <textarea className="input" style={{ height: 160, fontFamily: 'monospace', fontSize: 11 }} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <Btn onClick={() => setImp(null)}>{t('Cancel')}</Btn>
              <Btn variant="primary" onClick={() => { const err = importToSlot(imp, text); if (err) nav.toast(t('Import failed: {err}', { err: tx(err) }), 'err'); else { nav.toast(t('Imported.'), 'ok'); setImp(null); refresh(); } }}>{t('Import')}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
