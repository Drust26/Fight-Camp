import { native } from '../../game/storage';
// Appearance editor: hair, facial hair, tattoos, face, body and fight attire with a live animated preview,
// undo/redo, per-category reset and presets. Used by the new-career wizard and from the Fighter tab.
// Cosmetic only — attributes, height, reach and weight class are never touched here.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Undo2, Redo2, RotateCcw, Shuffle, Save, Trash2, Plus, Download } from 'lucide-react';
import { Btn } from '../components/common';
import { drawFighterArt, type Joints } from '../../combat/fighterArt';
import { POSES, lerpPose, ease, type Pose } from '../../combat/poses';
import {
  BEARDS, EYES, GLOVE_COLORS, HAIR, HEAD_SHAPES, INK_COLORS, MAX_TATTOOS, MOUSTACHES, SHORTS_STYLES, TATTOO_DESIGNS, TATTOO_REGIONS, TORSOS, TRIM_COLORS, WALKOUT_TOPS,
  deletePreset, generateLook, loadPresets, resetCategory, sanitizeLook, savePreset, type Look, type LookCategory, type Tattoo,
} from '../../game/look';
import { HAIR_COLORS, SHORTS_COLORS, SKIN_TONES } from '../../data/world';
import { t, tx } from '../../i18n';

const CATS: { id: LookCategory; label: string }[] = [
  { id: 'hair', label: 'Hair' }, { id: 'facial', label: 'Facial hair' }, { id: 'tattoos', label: 'Tattoos' },
  { id: 'face', label: 'Face' }, { id: 'body', label: 'Body' }, { id: 'attire', label: 'Fight attire' },
];
const EXTRA_SKIN = ['#fbe3cf', '#d9a77f', '#b98560', '#8d5b3b', '#4a2f20'];
const EXTRA_HAIR = ['#0f0d0c', '#5a3a22', '#c9a063', '#e8dcc8', '#7d2b1f', '#2f3d5c', '#8a2b6e'];
const PREVIEW_POSES: { id: string; label: string }[] = [{ id: 'stance', label: 'Stance' }, { id: 'jab', label: 'Jab' }, { id: 'cross', label: 'Cross' }, { id: 'headkick', label: 'Head kick' }, { id: 'victory', label: 'Victory' }];

// ───────────────────────────── live preview
export function FighterPreview({ look, height = 420, pose = 'stance', facing = 1, showTop = false }: { look: Look; height?: number; pose?: string; facing?: 1 | -1; showTop?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef(look); lookRef.current = look;
  const poseRef = useRef(pose); poseRef.current = pose;
  const facingRef = useRef(facing); facingRef.current = facing;
  const topRef = useRef(showTop); topRef.current = showTop;
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const w = Math.round(height * 0.75), h = height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    const t0 = performance.now();
    let cur: Pose = POSES.stance;
    let last = t0;
    const frame = (now: number) => {
      const t = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#11141b'); g.addColorStop(1, '#1c2029');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const sp = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h * 0.5, h * 0.6); sp.addColorStop(0, 'rgba(255,240,210,0.12)'); sp.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sp; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#262b36'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.93, w * 0.42, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      // target pose: attacks loop (wind-up → extend → return), stance breathes
      const key = poseRef.current;
      let target = POSES[key] ?? POSES.stance;
      if (key !== 'stance' && key !== 'victory') { const cyc = (t % 1.6) / 1.6; const k = cyc < 0.35 ? ease(cyc / 0.35) : cyc < 0.55 ? 1 : 1 - ease((cyc - 0.55) / 0.45); target = lerpPose(POSES.guardHigh, target, k); }
      const br = Math.sin(t * 2.6) * 1.2, sh = Math.sin(t * 1.25) * 1.6;
      target = { ...target, head: [target.head[0] + sh, target.head[1] - br], neck: [target.neck[0] + sh * 0.8, target.neck[1] - br * 0.8], hip: [target.hip[0] + sh * 0.5, target.hip[1]] };
      cur = lerpPose(cur, target, 1 - Math.exp(-dt * 14));
      const sc = (h * 0.82) / 200;
      const fac = facingRef.current;
      const ox = w / 2 - fac * 6 * sc, oy = h * 0.93;
      const J = Object.fromEntries(Object.entries(cur).map(([k, p]) => [k, [ox + p[0] * sc * fac, oy + p[1] * sc]])) as unknown as Joints;
      try { drawFighterArt(ctx, J, { sc, facing: fac, look: lookRef.current, standing: true, top: topRef.current ? lookRef.current.attire.walkout : 'none' }); } catch { /* keep the editor alive */ }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [height]);
  return <canvas ref={ref} style={{ width: Math.round(height * 0.75), height, borderRadius: 12, display: 'block' }} aria-label={t('Fighter preview')} />;
}

// ───────────────────────────── small controls
function Swatches({ colors, value, onPick, label, custom = true }: { colors: string[]; value: string; onPick: (c: string) => void; label: string; custom?: boolean }) {
  return (
    <div className="field" style={{ marginBottom: 10 }}>
      <label>{t(label)}</label>
      <div className="swatches" style={{ alignItems: 'center' }}>
        {colors.map((c, i) => <button key={c + i} aria-label={`${t(label)} ${i + 1}`} className={`sw ${value.toLowerCase() === c.toLowerCase() ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} />)}
        {custom && <input type="color" aria-label={`${t(label)} — ${t('custom')}`} value={value} onChange={(e) => onPick(e.target.value)} style={{ width: 30, height: 26, border: 0, background: 'none', padding: 0, cursor: 'pointer' }} />}
      </div>
    </div>
  );
}
function Chips<T extends string>({ list, value, onPick, label }: { list: readonly { id: T; name: string }[]; value: T; onPick: (v: T) => void; label: string }) {
  return (
    <div className="field" style={{ marginBottom: 10 }}>
      <label>{t(label)}</label>
      <div className="row wrap" style={{ gap: 6 }}>{list.map((x) => <button key={x.id} className={`chip ${value === x.id ? 'on' : ''}`} onClick={() => onPick(x.id)}>{t(x.name)}</button>)}</div>
    </div>
  );
}
function Slider({ label, value, onSet, min = 0, max = 1, step = 0.01, fmt }: { label: string; value: number; onSet: (v: number) => void; min?: number; max?: number; step?: number; fmt?: (v: number) => string }) {
  return (
    <div className="field" style={{ marginBottom: 10 }}>
      <label>{t(label)}: <span className="dim">{fmt ? fmt(value) : Math.round(value * 100) + '%'}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onSet(+e.target.value)} />
    </div>
  );
}

// ───────────────────────────── editor
export interface EditorProps {
  initial: Look;
  onChange?: (l: Look) => void; // live updates (wizard)
  compact?: boolean;
  costNote?: (draft: Look) => string | null; // career: explain any cost of applying
  footer?: (draft: Look, dirty: boolean) => React.ReactNode;
  seedName?: string;
}

export function AppearanceEditor({ initial, onChange, compact, costNote, footer, seedName = 'fighter' }: EditorProps) {
  const [hist, setHist] = useState<Look[]>([sanitizeLook(initial)]);
  const [pos, setPos] = useState(0);
  const [cat, setCat] = useState<LookCategory>('hair');
  const [pose, setPose] = useState('stance');
  const [facing, setFacing] = useState<1 | -1>(1);
  const [showTop, setShowTop] = useState(false);
  const [presets, setPresets] = useState(loadPresets());
  const [pname, setPname] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const baseline = useMemo(() => sanitizeLook(initial), []);
  const look = hist[pos];
  const commit = (next: Look) => {
    const clean = sanitizeLook(next);
    const h = [...hist.slice(0, pos + 1), clean].slice(-60);
    setHist(h); setPos(h.length - 1);
    onChange?.(clean);
  };
  const set = (fn: (l: Look) => void) => { const n: Look = JSON.parse(JSON.stringify(look)); fn(n); commit(n); };
  const go = (p: number) => { setPos(p); onChange?.(hist[p]); };
  const dirty = JSON.stringify(look) !== JSON.stringify(baseline);
  const note = costNote?.(look) ?? null;

  const addTattoo = () => set((l) => {
    if (l.tattoos.length >= MAX_TATTOOS) return;
    const used = new Set(l.tattoos.map((t) => t.region));
    const region = TATTOO_REGIONS.find((r) => !used.has(r.id))?.id ?? 'leadForearm';
    l.tattoos.push({ id: `t${Date.now().toString(36)}${l.tattoos.length}`, design: 'tribal', region, size: 1, rot: 0, pos: 0.5, ink: INK_COLORS[0] });
  });
  const editTat = (id: string, patch: Partial<Tattoo>) => set((l) => { const t = l.tattoos.find((x) => x.id === id); if (t) Object.assign(t, patch); });

  return (
    <div className="appearance-editor" style={{ display: 'grid', gridTemplateColumns: compact ? '260px 1fr' : '330px 1fr', gap: 18, alignItems: 'start' }}>
      <div className="col" style={{ gap: 8, position: 'sticky', top: 0 }}>
        <FighterPreview look={look} height={compact ? 340 : 440} pose={pose} facing={facing} showTop={showTop} />
        <div className="row wrap" style={{ gap: 4 }}>{PREVIEW_POSES.map((p) => <button key={p.id} className={`chip ${pose === p.id ? 'on' : ''}`} onClick={() => setPose(p.id)}>{t(p.label)}</button>)}</div>
        <div className="row wrap" style={{ gap: 4 }}>
          <button className="chip" onClick={() => setFacing((f) => (f === 1 ? -1 : 1))}>{t('Turn around')}</button>
          <button className={`chip ${showTop ? 'on' : ''}`} onClick={() => setShowTop((x) => !x)}>{t('Walkout top')}</button>
        </div>
        <div className="tiny dim">{t('Cosmetic only: attributes, height, reach and weight class are not changed by anything here.')}</div>
      </div>
      <div className="col" style={{ gap: 12, minWidth: 0 }}>
        <div className="row wrap between" style={{ gap: 6 }}>
          <div className="row wrap" style={{ gap: 4 }} role="tablist">{CATS.map((c) => <button key={c.id} role="tab" aria-selected={cat === c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{t(c.label)}</button>)}</div>
          <div className="row" style={{ gap: 4 }}>
            <Btn size="sm" disabled={pos === 0} onClick={() => go(pos - 1)} title={t('Undo')}><Undo2 size={13} /></Btn>
            <Btn size="sm" disabled={pos >= hist.length - 1} onClick={() => go(pos + 1)} title={t('Redo')}><Redo2 size={13} /></Btn>
            <Btn size="sm" onClick={() => commit(resetCategory(look, baseline, cat))} title={t('Reset this category')}><RotateCcw size={13} /> {t('Reset {what}', { what: t(CATS.find((c) => c.id === cat)!.label).toLowerCase() })}</Btn>
            <Btn size="sm" onClick={() => { const r = generateLook(`${seedName}-${Date.now()}`, { skin: 2, hair: 2, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }); commit({ ...r, skin: look.skin, body: look.body }); }} title={t('Randomise hair, face, tattoos and attire')}><Shuffle size={13} /> {t('Randomise')}</Btn>
          </div>
        </div>

        <div className="panel">
          {cat === 'hair' && (<>
            <Chips label="Hairstyle" list={HAIR} value={look.hair} onPick={(v) => set((l) => { l.hair = v; })} />
            <Swatches label="Hair colour" colors={[...HAIR_COLORS, ...EXTRA_HAIR]} value={look.hairColor} onPick={(c) => set((l) => { l.hairColor = c; })} />
            <label className="row small"><input type="checkbox" checked={look.facialColor === look.hairColor} onChange={(e) => e.target.checked && set((l) => { l.facialColor = l.hairColor; })} /> {t('Facial hair & brows match hair colour')}</label>
          </>)}
          {cat === 'facial' && (<>
            <Chips label="Beard" list={BEARDS} value={look.beard} onPick={(v) => set((l) => { l.beard = v; })} />
            <Chips label="Moustache" list={MOUSTACHES} value={look.moustache} onPick={(v) => set((l) => { l.moustache = v; })} />
            <Swatches label="Facial hair & brow colour" colors={[...HAIR_COLORS, ...EXTRA_HAIR]} value={look.facialColor} onPick={(c) => set((l) => { l.facialColor = c; })} />
          </>)}
          {cat === 'tattoos' && (<>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="small muted">{t('{n}/{max} tattoos · each stays on its body part when you move', { n: look.tattoos.length, max: MAX_TATTOOS })}</span>
              <div className="row" style={{ gap: 4 }}>
                <Btn size="sm" disabled={look.tattoos.length >= MAX_TATTOOS} onClick={addTattoo}><Plus size={13} /> {t('Add tattoo')}</Btn>
                {look.tattoos.length > 0 && <Btn size="sm" onClick={() => set((l) => { l.tattoos = []; })}><Trash2 size={13} /> {t('Remove all')}</Btn>}
              </div>
            </div>
            {!look.tattoos.length && <div className="small muted">{t('No tattoos yet.')}</div>}
            <div className="col" style={{ gap: 10 }}>
              {look.tattoos.map((tat, i) => (
                <div key={tat.id} className="panel tight" style={{ background: 'var(--bg2)' }}>
                  <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
                    <b className="small" style={{ minWidth: 20 }}>#{i + 1}</b>
                    <div className="field"><label>{t('Design')}</label><select className="input" value={tat.design} onChange={(e) => editTat(tat.id, { design: e.target.value as Tattoo['design'], text: e.target.value === 'script' ? tat.text ?? 'FIGHT' : tat.text })}>{TATTOO_DESIGNS.map((d) => <option key={d.id} value={d.id}>{t(d.name)}</option>)}</select></div>
                    <div className="field"><label>{t('Placement')}</label><select className="input" value={tat.region} onChange={(e) => editTat(tat.id, { region: e.target.value as Tattoo['region'] })}>{TATTOO_REGIONS.map((r) => <option key={r.id} value={r.id}>{t(r.name)}</option>)}</select></div>
                    {tat.design === 'script' && <div className="field"><label>{t('Text')}</label><input className="input" maxLength={12} value={tat.text ?? ''} onChange={(e) => editTat(tat.id, { text: e.target.value.slice(0, 12) })} style={{ width: 120 }} /></div>}
                    <Btn size="sm" onClick={() => set((l) => { l.tattoos = l.tattoos.filter((x) => x.id !== tat.id); })} title={t('Remove this tattoo')}><Trash2 size={13} /></Btn>
                  </div>
                  <div className="grid3" style={{ marginTop: 6 }}>
                    <Slider label="Size" value={tat.size} min={0.6} max={1.4} onSet={(v) => editTat(tat.id, { size: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
                    <Slider label="Rotation" value={tat.rot} min={-60} max={60} step={1} onSet={(v) => editTat(tat.id, { rot: v })} fmt={(v) => `${Math.round(v)}°`} />
                    <Slider label="Position" value={tat.pos} onSet={(v) => editTat(tat.id, { pos: v })} />
                  </div>
                  <Swatches label="Ink" colors={INK_COLORS} value={tat.ink} onPick={(c) => editTat(tat.id, { ink: c })} />
                </div>
              ))}
            </div>
          </>)}
          {cat === 'face' && (<>
            <Swatches label="Skin tone" colors={[...SKIN_TONES, ...EXTRA_SKIN]} value={look.skin} onPick={(c) => set((l) => { l.skin = c; })} />
            <Chips label="Head shape" list={HEAD_SHAPES} value={look.face.shape} onPick={(v) => set((l) => { l.face.shape = v; })} />
            <Chips label="Eyes" list={EYES} value={look.face.eyes} onPick={(v) => set((l) => { l.face.eyes = v; })} />
            <div className="grid3">
              <Slider label="Jaw width" value={look.face.jaw} onSet={(v) => set((l) => { l.face.jaw = v; })} />
              <Slider label="Brow ridge" value={look.face.brow} onSet={(v) => set((l) => { l.face.brow = v; })} />
              <Slider label="Nose size" value={look.face.nose} onSet={(v) => set((l) => { l.face.nose = v; })} />
            </div>
            <label className="row small"><input type="checkbox" checked={look.face.cauliflower} onChange={(e) => set((l) => { l.face.cauliflower = e.target.checked; })} /> {t('Cauliflower ear')}</label>
          </>)}
          {cat === 'body' && (<>
            <div className="grid2">
              <Slider label="Build (lean → heavy)" value={look.body.build} onSet={(v) => set((l) => { l.body.build = v; })} />
              <Slider label="Muscle definition" value={look.body.muscle} onSet={(v) => set((l) => { l.body.muscle = v; })} />
              <Slider label="Shoulder width" value={look.body.shoulders} onSet={(v) => set((l) => { l.body.shoulders = v; })} />
              <Slider label="Limb thickness" value={look.body.limbs} onSet={(v) => set((l) => { l.body.limbs = v; })} />
            </div>
            <Chips label="Torso shape" list={TORSOS} value={look.body.torso} onPick={(v) => set((l) => { l.body.torso = v; })} />
            <div className="tiny dim">{t('Height, reach and body type that affect gameplay are set when the fighter is created; arm length on screen already follows your real reach.')}</div>
          </>)}
          {cat === 'attire' && (<>
            <Swatches label="Shorts colour" colors={SHORTS_COLORS} value={look.attire.shorts} onPick={(c) => set((l) => { l.attire.shorts = c; })} />
            <Chips label="Shorts design" list={SHORTS_STYLES} value={look.attire.style} onPick={(v) => set((l) => { l.attire.style = v; })} />
            <div className="grid3">
              <Swatches label="Design accent" colors={TRIM_COLORS} value={look.attire.accent} onPick={(c) => set((l) => { l.attire.accent = c; })} />
              <Swatches label="Hem trim" colors={TRIM_COLORS} value={look.attire.trim} onPick={(c) => set((l) => { l.attire.trim = c; })} />
              <Swatches label="Waistband" colors={TRIM_COLORS} value={look.attire.waistband} onPick={(c) => set((l) => { l.attire.waistband = c; })} />
            </div>
            <div className="grid2">
              <Swatches label="Gloves" colors={GLOVE_COLORS} value={look.attire.gloves} onPick={(c) => set((l) => { l.attire.gloves = c; })} />
              <Swatches label="Glove wrist strap" colors={TRIM_COLORS} value={look.attire.gloveTrim} onPick={(c) => set((l) => { l.attire.gloveTrim = c; })} />
            </div>
            <label className="row small" style={{ marginBottom: 10 }}><input type="checkbox" checked={look.attire.headband} onChange={(e) => set((l) => { l.attire.headband = e.target.checked; })} /> {t('Headband (uses the accent colour)')}</label>
            <Chips label="Walkout top" list={WALKOUT_TOPS} value={look.attire.walkout} onPick={(v) => { set((l) => { l.attire.walkout = v; }); setShowTop(v !== 'none'); }} />
            <Swatches label="Walkout colour" colors={['#111111', '#1f2937', '#f5f5f5', ...SHORTS_COLORS.slice(0, 6)]} value={look.attire.walkoutColor} onPick={(c) => set((l) => { l.attire.walkoutColor = c; })} />
          </>)}
        </div>

        <div className="panel">
          <div className="panel-title"><h3><Save size={15} /> {t('Presets')}</h3><span className="tiny dim">{native ? t('Saved in your FightCamp folder and available to every career and Quick Fight.') : t('Saved in this browser and available to every career and Quick Fight.')}</span></div>
          <div className="row wrap" style={{ gap: 6 }}>
            <input className="input" placeholder={t('Preset name')} value={pname} maxLength={30} onChange={(e) => setPname(e.target.value)} style={{ maxWidth: 220 }} />
            <Btn size="sm" onClick={() => { const err = savePreset(pname, look); setMsg(err ? tx(err) : t('Saved “{name}”.', { name: pname.trim() })); if (!err) { setPresets(loadPresets()); setPname(''); } }}><Save size={13} /> {t('Save preset')}</Btn>
          </div>
          {msg && <div className="tiny" style={{ marginTop: 6 }}>{msg}</div>}
          <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
            {presets.map((p) => (
              <span key={p.name} className="row" style={{ gap: 2, background: 'var(--bg2)', borderRadius: 8, padding: '2px 4px' }}>
                <button className="chip" onClick={() => commit(p.look)} title={t('Load this preset')}><Download size={12} /> {p.name}</button>
                <button className="chip" aria-label={t('Delete preset {name}', { name: p.name })} onClick={() => { deletePreset(p.name); setPresets(loadPresets()); }}><Trash2 size={12} /></button>
              </span>
            ))}
            {!presets.length && <span className="tiny dim">{t('No presets yet.')}</span>}
          </div>
        </div>
        {note && <div className="small gold">{note}</div>}
        {footer?.(look, dirty)}
      </div>
    </div>
  );
}
