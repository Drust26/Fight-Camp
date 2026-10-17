// Walkout customization: original synthesized tracks or the player's own audio file (kept in IndexedDB),
// walkout lighting colour and entrance style. Presentation only.
import { useEffect, useRef, useState } from 'react';
import { Music, Play, Square, Upload, Trash2 } from 'lucide-react';
import { Btn, WALKOUT_COLORS, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { audio, TRACKS } from '../../../game/audio';
import { clearWalkoutFile, loadWalkout, saveWalkoutFile } from '../../../game/media';
import type { WalkoutStyle } from '../../../game/types';

const ENTRANCES: [WalkoutStyle['entrance'], string][] = [['hype', 'Hype — bouncing, crowd up'], ['calm', 'Calm — steady and focused'], ['stare', 'Stare-down — slow, menacing']];

export function WalkoutPanel() {
  const st = useGame();
  const nav = useNav();
  const w: WalkoutStyle = st.player.walkout ?? { track: 'iron', color: 0, entrance: 'hype' };
  const [custom, setCustom] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { loadWalkout().then((x) => setCustom(x?.name ?? null)); return () => audio.stopMusic(); }, []);
  const set = (patch: Partial<WalkoutStyle>) => store.act((g) => { g.player.walkout = { ...w, ...patch }; });
  const preview = async () => {
    if (playing) { audio.stopMusic(); setPlaying(false); return; }
    audio.resume();
    if (w.track === 'custom') { const x = await loadWalkout(); if (!x) { nav.toast('Your track could not be loaded in this browser.', 'err'); return; } audio.playUrl(x.url); }
    else audio.playTrack(w.track, 10);
    setPlaying(true);
    window.setTimeout(() => setPlaying(false), 10000);
  };
  return (
    <div className="panel">
      <div className="panel-title"><h3><Music size={16} /> Walkout</h3><span className="tiny dim">Played on fight night.</span></div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Track</label>
        <div className="row wrap" style={{ gap: 6 }}>
          {TRACKS.map((t) => <button key={t.id} className={`chip ${w.track === t.id ? 'on' : ''}`} title={t.mood} onClick={() => set({ track: t.id })}>{t.name}</button>)}
          <button className={`chip ${w.track === 'custom' ? 'on' : ''}`} disabled={!custom} title={custom ? custom : 'Upload a file first'} onClick={() => set({ track: 'custom' })}>Your track{custom ? `: ${custom.slice(0, 22)}` : ''}</button>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
        <Btn size="sm" onClick={preview}>{playing ? <><Square size={12} /> Stop</> : <><Play size={12} /> Preview</>}</Btn>
        <Btn size="sm" onClick={() => file.current?.click()}><Upload size={12} /> Upload audio…</Btn>
        {custom && <Btn size="sm" onClick={async () => { await clearWalkoutFile(); setCustom(null); if (w.track === 'custom') set({ track: 'iron' }); }}><Trash2 size={12} /> Remove upload</Btn>}
        <input ref={file} type="file" accept="audio/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const err = await saveWalkoutFile(f);
          if (err) { nav.toast(err, 'err'); return; }
          setCustom(f.name); set({ track: 'custom' }); nav.toast('Walkout track saved in this browser.', 'ok');
        }} />
      </div>
      <div className="tiny dim" style={{ marginBottom: 10 }}>Uploaded music stays on this device only (not in save exports). Use music you have the right to play.</div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Lighting colour</label>
        <div className="row" style={{ gap: 6 }}>{WALKOUT_COLORS.map((c, i) => <button key={c} aria-label={`Walkout colour ${i + 1}`} onClick={() => set({ color: i })} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: w.color === i ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />)}</div>
      </div>
      <div className="field">
        <label>Entrance</label>
        <select className="input" value={w.entrance} onChange={(e) => set({ entrance: e.target.value as WalkoutStyle['entrance'] })}>{ENTRANCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
    </div>
  );
}
