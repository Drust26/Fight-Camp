import { useState } from 'react';
import { ArrowLeft, Swords } from 'lucide-react';
import { Btn, useNav } from '../components/common';
import { STYLES, STYLE } from '../../data/world';
import { genAttrs } from '../../game/fighterGen';
import { RNG } from '../../game/rng';
import { quickFightSlot } from './FightScreen';
import { generateLook, loadPresets } from '../../game/look';
import type { Difficulty, StyleId } from '../../game/types';

export function QuickFightSetup() {
  const nav = useNav();
  const [me, setMe] = useState<StyleId>('balanced');
  const [op, setOp] = useState<StyleId>('wrestler');
  const [lvl, setLvl] = useState(65);
  const [olvl, setOlvl] = useState(65);
  const [rounds, setRounds] = useState(3);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const presets = loadPresets();
  const [redLook, setRedLook] = useState('');
  const [blueLook, setBlueLook] = useState('');
  const start = () => {
    const rng = new RNG(Date.now() & 0xffff);
    quickFightSlot.a = { name: 'Red Corner', short: 'Red', attrs: genAttrs(rng, lvl, me), heightCm: 180, reachCm: 184, stance: 'orthodox', style: me, plan: STYLE[me].plan, isPlayer: true, record: STYLE[me].name,
      appearance: { skin: 2, hair: 2, hairColor: 0, facialHair: 1, shorts: 0, gloves: 0, accessory: 0 } };
    quickFightSlot.b = { name: `${STYLE[op].name}`, short: 'Blue', attrs: genAttrs(rng, olvl, op), heightCm: 181, reachCm: 183, stance: rng.chance(0.3) ? 'southpaw' : 'orthodox', style: op, plan: STYLE[op].plan, isPlayer: false, record: `Level ${olvl}`,
      appearance: { skin: rng.int(0, 6), hair: rng.int(0, 5), hairColor: rng.int(0, 6), facialHair: rng.int(0, 3), shorts: 1, gloves: 2, accessory: rng.int(0, 3) } };
    // distinct, deterministic-per-bout looks for both corners (presentation only)
    const seed = rng.int(0, 1e9);
    quickFightSlot.a.appearance.look = presets.find((p) => p.name === redLook)?.look ?? generateLook(`qf-red-${seed}`, quickFightSlot.a.appearance, { div: 'welter' });
    quickFightSlot.b.appearance.look = presets.find((p) => p.name === blueLook)?.look ?? generateLook(`qf-blue-${seed}`, quickFightSlot.b.appearance, { div: 'welter' });
    quickFightSlot.rounds = rounds;
    quickFightSlot.difficulty = diff;
    nav.go('quickbout');
  };
  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', padding: '30px 40px' }}>
      <Btn variant="ghost" onClick={() => nav.go('title')}><ArrowLeft size={16} /> Title</Btn>
      <h1 style={{ margin: '14px 0 6px' }}>Quick Fight</h1>
      <p className="muted">A one-off exhibition. Nothing here affects your careers.</p>
      <div className="grid2" style={{ maxWidth: 1000 }}>
        <div className="panel">
          <h3>Your fighter</h3>
          <div className="row wrap" style={{ gap: 6, margin: '10px 0' }}>{STYLES.map((s) => <button key={s.id} className={`chip ${me === s.id ? 'on' : ''}`} onClick={() => setMe(s.id)}>{s.name}</button>)}</div>
          <div className="field"><label>Skill level: {lvl}</label><input type="range" min={35} max={90} value={lvl} onChange={(e) => setLvl(+e.target.value)} /></div>
          <div className="field"><label>Appearance</label><select className="input" value={redLook} onChange={(e) => setRedLook(e.target.value)}><option value="">Random look</option>{presets.map((p) => <option key={p.name} value={p.name}>Preset: {p.name}</option>)}</select></div>

        </div>
        <div className="panel">
          <h3>Opponent</h3>
          <div className="row wrap" style={{ gap: 6, margin: '10px 0' }}>{STYLES.map((s) => <button key={s.id} className={`chip ${op === s.id ? 'on' : ''}`} onClick={() => setOp(s.id)}>{s.name}</button>)}</div>
          <div className="field"><label>Skill level: {olvl}</label><input type="range" min={35} max={90} value={olvl} onChange={(e) => setOlvl(+e.target.value)} /></div>
          <div className="field"><label>Appearance</label><select className="input" value={blueLook} onChange={(e) => setBlueLook(e.target.value)}><option value="">Random look</option>{presets.map((p) => <option key={p.name} value={p.name}>Preset: {p.name}</option>)}</select></div>

        </div>
      </div>
      <div className="row wrap" style={{ marginTop: 14, gap: 16 }}>
        <div className="field"><label>Rounds</label><div className="row">{[1, 3, 5].map((n) => <button key={n} className={`chip ${rounds === n ? 'on' : ''}`} onClick={() => setRounds(n)}>{n}</button>)}</div></div>
        <div className="field"><label>AI difficulty</label><div className="row">{(['easy', 'normal', 'hard', 'simulation'] as Difficulty[]).map((d) => <button key={d} className={`chip ${diff === d ? 'on' : ''}`} onClick={() => setDiff(d)}>{d}</button>)}</div></div>
      </div>
      <Btn variant="primary" size="lg" style={{ marginTop: 20 }} onClick={start}><Swords size={18} /> Fight!</Btn>
    </div>
  );
}
