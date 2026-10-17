import { UpdatePanel } from '../components/UpdateNotice';
import { native } from '../../game/storage';
import { useEffect, useState } from 'react';
import { ArrowLeft, Keyboard, Volume2, Gauge, GraduationCap, Flag, Save, Tv, FolderOpen } from 'lucide-react';
import { Btn, Confirm, useNav } from '../components/common';
import { store, useSettings } from '../../game/store';
import { DEFAULT_BINDINGS } from '../../game/save';
import { audio } from '../../game/audio';
import { retire, changeDivision } from '../../game/career';
import { DIVISIONS } from '../../data/world';
import type { Difficulty, DivisionId } from '../../game/types';

export const ACTION_LABELS: Record<string, string> = {
  fwd: 'Move toward', back: 'Move away', left: 'Circle left', right: 'Circle right',
  jab: 'Jab', cross: 'Cross', hook: 'Lead hook', upper: 'Uppercut', body: 'Body hook', elbow: 'Elbow',
  lowkick: 'Low kick', bodykick: 'Body kick', headkick: 'Head kick', teep: 'Front kick', knee: 'Knee',
  guard: 'High guard / defend', low: 'Body guard / check kick', evade: 'Slip / sweep / sub defense', power: 'Power modifier / burst',
  clinch: 'Clinch / break / stand up', takedown: 'Takedown / sprawl', sub: 'Submission', advance: 'Advance / escape / pounce',
};
export const keyLabel = (k: string) => (k === ' ' ? 'Space' : k === 'shift' ? 'Shift' : k.length === 1 ? k.toUpperCase() : k);

export function SettingsScreen({ standalone }: { standalone?: boolean }) {
  const nav = useNav();
  const s = useSettings();
  const [binding, setBinding] = useState<string | null>(null);
  const [retireAsk, setRetireAsk] = useState(false);
  const st = store.state;

  useEffect(() => {
    if (!binding) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape') { setBinding(null); return; }
      const k = e.key === 'Shift' ? 'shift' : e.key.toLowerCase();
      if (['tab', 'escape', 'enter'].includes(k)) return;
      const b = { ...s.bindings };
      for (const [a, v] of Object.entries(b)) if (v === k && a !== binding) b[a] = s.bindings[binding]; // swap conflicts
      b[binding] = k;
      store.updateSettings({ bindings: b });
      setBinding(null);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [binding, s.bindings]);

  const body = (
    <div className="col" style={{ gap: 16, maxWidth: 980 }}>
      <UpdatePanel />
      {native && (
        <div className="panel">
          <div className="panel-title"><h3><FolderOpen size={16} /> Saves</h3><Btn size="sm" onClick={() => native!.openSavesFolder()}><FolderOpen size={14} /> Open saves folder</Btn></div>
          <div className="small muted">Your careers are saved as files in <b>{native.savesDir()}</b>. Settings and look presets are in <b>{native.dataDir()}</b>. Copy the folder to back up or move your careers.</div>
        </div>
      )}
      <div className="grid2">
        <div className="panel">
          <div className="panel-title"><h3><Volume2 size={16} /> Audio</h3></div>
          {(['master', 'sfx', 'crowd', 'music'] as const).map((k) => (
            <div className="field" key={k} style={{ marginBottom: 10 }}>
              <label>{k === 'master' ? 'Master volume' : k === 'sfx' ? 'Effects' : k === 'crowd' ? 'Crowd ambience' : 'Walkout music'}: {Math.round((s[k] ?? 0.6) * 100)}%</label>
              <input type="range" min={0} max={1} step={0.05} value={s[k] ?? 0.6} onChange={(e) => { store.updateSettings({ [k]: +e.target.value }); audio.applyVolume(); }} onMouseUp={() => audio.punch()} />
            </div>
          ))}
          <label className="row"><input type="checkbox" checked={s.muted} onChange={(e) => { store.updateSettings({ muted: e.target.checked }); audio.applyVolume(); }} /> Mute all audio</label>
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Gauge size={16} /> Gameplay</h3></div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Real-time round length: {s.roundSeconds}s per 5:00 round</label>
            <div className="row wrap">{[60, 90, 120, 180, 300].map((v) => <button key={v} className={`chip ${s.roundSeconds === v ? 'on' : ''}`} onClick={() => store.updateSettings({ roundSeconds: v })}>{v === 300 ? '5:00 (real)' : `${v}s`}</button>)}</div>
            <span className="tiny dim">The fight clock always displays 5:00 rounds; this sets how long they take to play.</span>
          </div>
          <label className="row" style={{ marginBottom: 8 }}><input type="checkbox" checked={s.reducedMotion} onChange={(e) => store.updateSettings({ reducedMotion: e.target.checked })} /> Reduced motion (no screen shake/flash)</label>
          <label className="row" style={{ marginBottom: 8 }}><input type="checkbox" checked={s.hints} onChange={(e) => store.updateSettings({ hints: e.target.checked })} /> Show contextual control hints in fights</label>
          {st && !st.player.retired && (
            <div className="field" style={{ marginTop: 10 }}>
              <label>Difficulty (this career)</label>
              <div className="row wrap">
                {(['easy', 'normal', 'hard', 'simulation'] as Difficulty[]).map((d) => (
                  <button key={d} className={`chip ${st.difficulty === d ? 'on' : ''}`} disabled={st.difficulty === 'simulation' && d !== 'simulation'}
                    onClick={() => store.act((g) => { g.difficulty = d; })}>{d}</button>
                ))}
              </div>
              {st.difficulty === 'simulation' && <span className="tiny dim">Simulation careers are locked to Simulation.</span>}
            </div>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title"><h3><Tv size={16} /> Fight-night presentation</h3></div>
        <div className="grid2">
          <div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Walkouts, introductions & faceoff</label>
              <div className="row wrap">{([['full', 'Full'], ['short', 'Short'], ['off', 'Skip (straight to the cage)']] as const).map(([v, l]) => <button key={v} className={`chip ${(s.presentation ?? 'full') === v ? 'on' : ''}`} onClick={() => store.updateSettings({ presentation: v })}>{l}</button>)}</div>
              <span className="tiny dim">Any part can also be skipped with Space/Enter during the sequence.</span>
            </div>
            <label className="row" style={{ marginBottom: 8 }}><input type="checkbox" checked={s.commentary ?? true} onChange={(e) => store.updateSettings({ commentary: e.target.checked })} /> Live commentary ticker during fights</label>
            <label className="row" style={{ marginBottom: 8 }}><input type="checkbox" checked={!!s.announcerVoice} onChange={(e) => store.updateSettings({ announcerVoice: e.target.checked })} /> Spoken announcer (uses your browser's speech voice)</label>
          </div>
          <div className="field">
            <label>Interface size: {Math.round((s.uiScale ?? 1) * 100)}%</label>
            <div className="row wrap">{[0.9, 1, 1.1, 1.2].map((v) => <button key={v} className={`chip ${(s.uiScale ?? 1) === v ? 'on' : ''}`} onClick={() => store.updateSettings({ uiScale: v })}>{Math.round(v * 100)}%</button>)}</div>
            <span className="tiny dim">Scales menus and text. The fight canvas always fills the screen.</span>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title"><h3><Keyboard size={16} /> Controls</h3><Btn size="sm" onClick={() => store.updateSettings({ bindings: { ...DEFAULT_BINDINGS } })}>Reset defaults</Btn></div>
        <div className="grid3" style={{ gap: 6 }}>
          {Object.keys(DEFAULT_BINDINGS).map((a) => (
            <div key={a} className="row between" style={{ padding: '5px 8px', background: 'var(--bg2)', borderRadius: 8 }}>
              <span className="small">{ACTION_LABELS[a]}</span>
              <button className={`chip ${binding === a ? 'on pulse' : ''}`} style={{ minWidth: 70 }} onClick={() => setBinding(a)}>{binding === a ? 'Press key…' : keyLabel(s.bindings[a])}</button>
            </div>
          ))}
        </div>
        <p className="tiny dim" style={{ marginTop: 10 }}>Also: Tab = tactical pause · Esc = pause menu · Left/right mouse = jab/cross · Arrow keys also move. Conflicting keys are swapped automatically.</p>
      </div>
      {st && (
        <div className="grid2">
          <div className="panel">
            <div className="panel-title"><h3><GraduationCap size={16} /> Tutorials</h3></div>
            <div className="row wrap">
              <Btn onClick={() => { store.act((g) => { g.tutorialStep = 0; }); nav.toast('Career tutorial restarted.', 'ok'); if (!standalone) nav.setTab('overview'); }}>Replay career tour</Btn>
              <Btn onClick={() => nav.go('practice')}>Practice arena (combat tutorial)</Btn>
            </div>
          </div>
          <div className="panel">
            <div className="panel-title"><h3><Flag size={16} /> Career</h3></div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Change weight division</label>
              <select className="input" value={st.player.divisionId} disabled={!!st.scheduled || st.player.retired} onChange={(e) => {
                const err = store.act((g) => changeDivision(g, e.target.value as DivisionId));
                nav.toast(err ?? 'Division changed.', err ? 'err' : 'ok');
              }}>{DIVISIONS.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.lb} lb)</option>)}</select>
            </div>
            <div className="row wrap">
              <Btn onClick={() => { const r = store.saveNow(); nav.toast(r.ok ? 'Saved.' : `Save failed: ${r.error}`, r.ok ? 'ok' : 'err'); }}><Save size={15} /> Save now</Btn>
              {!st.player.retired && <Btn variant="danger" onClick={() => setRetireAsk(true)}>Retire from MMA…</Btn>}
            </div>
          </div>
        </div>
      )}
      {retireAsk && <Confirm title="Retire?" body="Your fighter will hang up the gloves for good. You'll see your legacy screen and can still browse the career, but can't fight again in this save." confirm="Retire" danger
        onNo={() => setRetireAsk(false)} onYes={() => { store.act((g) => retire(g)); store.saveNow(); setRetireAsk(false); nav.go('retired'); }} />}
    </div>
  );
  if (!standalone) return body;
  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', padding: '30px 40px' }}>
      <Btn variant="ghost" onClick={() => nav.go(store.state ? 'hub' : 'title')}><ArrowLeft size={16} /> Back</Btn>
      <h1 style={{ margin: '14px 0 20px' }}>Settings</h1>
      {body}
    </div>
  );
}
