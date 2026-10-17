import { AppearanceEditor, FighterPreview } from './AppearanceEditor';
import { lookFromLegacy } from '../../game/look';
import { Palette } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Dices, Flag } from 'lucide-react';
import { Btn, Confirm, Modal, OvrBadge, Portrait, useNav, Bar, attrColor } from '../components/common';
import { ACCESSORIES, BACKGROUNDS, BODY_TYPES, DIVISIONS, FACIAL_HAIR, FIRST_NAMES, HAIR_COLORS, HAIR_STYLES, LAST_NAMES, NATIONS, NICKNAMES, SHORTS_COLORS, SKIN_TONES, LB } from '../../data/world';
import { START_LEVELS, createCareer, previewAttrs, type NewCareerOpts } from '../../game/career';
import { ATTRS, CATEGORY_DEFS, categoryRatings, overallRating } from '../../game/attributes';
import { GOALS } from '../../game/achievements';
import { slotInfos } from '../../game/save';
import { store } from '../../game/store';
import { money } from '../../game/core';
import type { Difficulty, DivisionId, GoalId } from '../../game/types';
import { t } from '../../i18n';

const STEPS = ['Identity', 'Physique', 'Background', 'Start', 'Difficulty', 'Goals'];
const DIFFS: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'easy', name: 'Easy', desc: 'Slower AI reactions, more opponent mistakes, generous training gains, cheaper bills, fewer training injuries.' },
  { id: 'normal', name: 'Normal', desc: 'The intended experience. Fair AI, real financial pressure, normal progression.' },
  { id: 'hard', name: 'Hard', desc: 'Sharper AI that reads you sooner and blunders less. Slower gains, pricier life, more injuries.' },
  { id: 'simulation', name: 'Simulation', desc: 'Near-perfect AI timing, tight finances, slow development and real injury risk. Every decision counts.' },
];

function eligibility(kg: number, div: DivisionId) {
  const d = DIVISIONS.find((x) => x.id === div)!;
  const idx = DIVISIONS.indexOf(d);
  const lower = idx > 0 ? DIVISIONS[idx - 1].kg : 0;
  const cut = Math.max(0, kg - d.kg) / kg;
  if (kg > d.kg * 1.16) return { ok: false, cut, label: 'Too heavy' };
  if (kg < lower * 0.95) return { ok: false, cut, label: 'Undersized' };
  return { ok: true, cut, label: cut <= 0.03 ? 'Easy cut' : cut <= 0.06 ? 'Normal cut' : cut <= 0.09 ? 'Hard cut' : 'Brutal cut' };
}

export function NewCareer() {
  const nav = useNav();
  const [step, setStep] = useState(0);
  const [lookOpen, setLookOpen] = useState(false);
  const [o, setO] = useState<NewCareerOpts>({
    firstName: 'Alex', lastName: 'Moreno', nickname: 'The Spark', nationality: 'United States', age: 21, heightCm: 178, reachCm: 182, hand: 'right', stance: 'orthodox',
    bodyType: 'lean', background: 'mma', startLevel: 'amateur', difficulty: 'normal', goals: ['champion'], divisionId: 'light', naturalKg: 75,
    appearance: { skin: 2, hair: 2, hairColor: 0, facialHair: 1, shorts: 0, gloves: 0, accessory: 0 },
  });
  const slots = useMemo(() => slotInfos(), []);
  const [slot, setSlot] = useState(() => (slots.find((s) => s.status === 'empty')?.slot ?? 1));
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<NewCareerOpts>) => setO((x) => ({ ...x, ...p }));
  const ap = (p: Partial<NewCareerOpts['appearance']>) => setO((x) => ({ ...x, appearance: { ...x.appearance, ...p } }));
  const attrs = useMemo(() => previewAttrs(o), [o.background, o.bodyType, o.startLevel, o.heightCm, o.reachCm]);
  const cats = categoryRatings(attrs);
  const ovr = overallRating(attrs);
  const elig = eligibility(o.naturalKg, o.divisionId);
  const sorted = ATTRS.map((a) => ({ ...a, v: attrs[a.key] })).sort((a, b) => b.v - a.v);

  const randomName = () => set({ firstName: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)], lastName: LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)], nickname: NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)] });
  const begin = () => {
    const occupied = slots.find((s) => s.slot === slot)?.status !== 'empty';
    if (occupied && !confirm) { setConfirm(true); return; }
    const st = createCareer(o, slot);
    store.set(st);
    const r = store.saveNow();
    if (!r.ok) nav.toast(t('Career started but could not be saved: {err}', { err: r.error ?? '' }), 'err');
    else nav.toast(t('Career created and saved.'), 'ok');
    nav.setTab('overview');
    nav.go('hub');
  };
  const canNext = step !== 1 || elig.ok;
  const wizardLook = o.appearance.look ?? lookFromLegacy(o.appearance, o.bodyType);

  return (
    <div className="wizard">
      <div className="wizard-main">
        <div className="row between">
          <Btn variant="ghost" onClick={() => nav.go('title')}><ArrowLeft size={16} /> {t('Title screen')}</Btn>
          <span className="tiny dim">{t('Step {n} of {m}', { n: step + 1, m: STEPS.length })}</span>
        </div>
        <h1 style={{ marginTop: 12 }}>{t('Create your fighter')}</h1>
        <div className="steps">
          {STEPS.map((s, i) => (
            <button key={s} className={`s ${i === step ? 'on' : i < step ? 'done' : ''}`} onClick={() => (i <= step || canNext) && setStep(i)}>{i + 1}. {t(s)}</button>
          ))}
        </div>

        {step === 0 && (
          <div className="col" style={{ gap: 18 }}>
            <div className="grid3">
              <div className="field"><label>{t('First name')}</label><input className="input" maxLength={18} value={o.firstName} onChange={(e) => set({ firstName: e.target.value })} /></div>
              <div className="field"><label>{t('Last name')}</label><input className="input" maxLength={20} value={o.lastName} onChange={(e) => set({ lastName: e.target.value })} /></div>
              <div className="field"><label>{t('Nickname')}</label><input className="input" maxLength={20} value={o.nickname} onChange={(e) => set({ nickname: e.target.value })} /></div>
            </div>
            <div><Btn size="sm" onClick={randomName}><Dices size={14} /> {t('Random name')}</Btn></div>
            <div className="grid3">
              <div className="field"><label>{t('Nationality')}</label>
                <select className="input" value={o.nationality} onChange={(e) => set({ nationality: e.target.value })}>{NATIONS.map((n) => <option key={n} value={n}>{t(n)}</option>)}</select>
              </div>
              <div className="field"><label>{t('Age: {n}', { n: o.age })}</label><input type="range" min={18} max={34} value={o.age} onChange={(e) => set({ age: +e.target.value })} />
                <span className="tiny dim">{t(o.age < 23 ? 'Young: learns fast, raw.' : o.age > 29 ? 'Veteran: slower gains, earlier decline.' : 'Prime development years.')}</span></div>
              <div className="field"><label>{t('Dominant hand / stance')}</label>
                <div className="row">
                  {(['right', 'left'] as const).map((h) => <button key={h} className={`chip ${o.hand === h ? 'on' : ''}`} onClick={() => set({ hand: h, stance: h === 'right' ? 'orthodox' : 'southpaw' })}>{h === 'right' ? t('Right') : t('Left')}</button>)}
                  {(['orthodox', 'southpaw'] as const).map((s) => <button key={s} className={`chip ${o.stance === s ? 'on' : ''}`} onClick={() => set({ stance: s })}>{t(s)}</button>)}
                </div>
              </div>
            </div>
            <h3>{t('Appearance')}</h3>
            <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
              <Btn variant="primary" onClick={() => setLookOpen(true)}><Palette size={15} /> {t('Customise look…')}</Btn>
              <span className="small muted">{t('Hair, facial hair, tattoos, face, body shape and fight attire — with presets. Purely cosmetic.')}</span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="col" style={{ gap: 18 }}>
            <div className="cards">
              {BODY_TYPES.map((b) => (
                <button key={b.id} className={`pick ${o.bodyType === b.id ? 'on' : ''}`} onClick={() => set({ bodyType: b.id, reachCm: o.heightCm + b.reachAdj })}>
                  <h3>{t(b.name)}</h3>
                  <span className="small muted">{t(b.desc)}</span>
                  <span className="tiny accent">{t('Suits: {list}', { list: t(b.suggest) })}</span>
                </button>
              ))}
            </div>
            <div className="grid3">
              <div className="field"><label>{t('Height: {n} cm', { n: o.heightCm })} ({Math.floor(o.heightCm / 30.48)}'{Math.round((o.heightCm / 2.54) % 12)}")</label>
                <input type="range" min={158} max={203} value={o.heightCm} onChange={(e) => { const h = +e.target.value; set({ heightCm: h, reachCm: Math.max(h - 6, Math.min(h + 14, o.reachCm + (h - o.heightCm))) }); }} /></div>
              <div className="field"><label>{t('Reach: {n} cm', { n: o.reachCm })} ({t('{n} ape index', { n: `${o.reachCm - o.heightCm >= 0 ? '+' : ''}${o.reachCm - o.heightCm}` })})</label>
                <input type="range" min={o.heightCm - 6} max={o.heightCm + 14} value={o.reachCm} onChange={(e) => set({ reachCm: +e.target.value })} />
                <span className="tiny dim">{t('Longer reach extends strike range and Distance Management.')}</span></div>
              <div className="field"><label>{t('Walking weight: {kg} kg ({lb} lb)', { kg: o.naturalKg, lb: Math.round(o.naturalKg / LB) })}</label>
                <input type="range" min={52} max={128} value={o.naturalKg} onChange={(e) => set({ naturalKg: +e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Weight division')}</label>
              <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                {DIVISIONS.map((d) => {
                  const e = eligibility(o.naturalKg, d.id);
                  return (
                    <button key={d.id} disabled={!e.ok} className={`pick ${o.divisionId === d.id ? 'on' : ''}`} style={{ opacity: e.ok ? 1 : 0.4 }} onClick={() => set({ divisionId: d.id })}>
                      <h3>{t(d.name)}</h3>
                      <span className="small muted">{d.lb} lb · {d.kg} kg</span>
                      <span className={`tiny ${e.ok ? (e.cut > 0.08 ? 'red' : e.cut > 0.05 ? 'gold' : 'green') : 'dim'}`}>{t(e.label)}{e.ok && e.cut > 0 ? ` (${(e.cut * 100).toFixed(1)}%)` : ''}</span>
                    </button>
                  );
                })}
              </div>
              {!elig.ok && <span className="red small">{t("Choose a division you can make: your walking weight doesn't fit {div}.", { div: t(DIVISIONS.find((d) => d.id === o.divisionId)!.name) })}</span>}
              <span className="tiny dim">{t('Cutting more weight means fighting bigger-framed against smaller men — but a cut over ~6% drains your gas tank and durability on fight night. You can change division later.')}</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="cards">
            {BACKGROUNDS.map((b) => (
              <button key={b.id} className={`pick ${o.background === b.id ? 'on' : ''}`} onClick={() => set({ background: b.id })}>
                <h3>{t(b.name)}</h3>
                <span className="small muted">{t(b.desc)}</span>
                <span className="tiny green">+ {Object.entries(b.bias).filter(([, v]) => v! > 0).sort((a, c) => c[1]! - a[1]!).slice(0, 3).map(([k]) => t(ATTRS.find((a) => a.key === k)!.name)).join(', ')}</span>
                <span className="tiny red">− {Object.entries(b.bias).filter(([, v]) => v! < 0).sort((a, c) => a[1]! - c[1]!).slice(0, 3).map(([k]) => t(ATTRS.find((a) => a.key === k)!.name)).join(', ') || t('none')}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="cards">
            {START_LEVELS.map((s) => (
              <button key={s.id} className={`pick ${o.startLevel === s.id ? 'on' : ''}`} onClick={() => set({ startLevel: s.id })}>
                <h3>{t(s.name)}</h3>
                <span className="small muted">{t(s.desc)}</span>
                <span className="tiny accent">{t('Starting skill ~{n} · {amount} savings', { n: s.level, amount: money(s.money) })}</span>
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="cards">
            {DIFFS.map((d) => (
              <button key={d.id} className={`pick ${o.difficulty === d.id ? 'on' : ''}`} onClick={() => set({ difficulty: d.id })}>
                <h3>{t(d.name)}</h3><span className="small muted">{t(d.desc)}</span>
              </button>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="col" style={{ gap: 18 }}>
            <span className="muted">{t("Pick any ambitions you want to track. They're objectives, not classes.")}</span>
            <div className="cards">
              {GOALS.map((g) => {
                const on = o.goals.includes(g.id);
                return (
                  <button key={g.id} className={`pick ${on ? 'on' : ''}`} onClick={() => set({ goals: on ? o.goals.filter((x) => x !== g.id) : [...o.goals, g.id as GoalId] })}>
                    <h3>{t(g.name)}</h3><span className="small muted">{t(g.desc)}</span>
                  </button>
                );
              })}
            </div>
            <h3>{t('Save slot')}</h3>
            <div className="col">
              {slots.map((s) => (
                <button key={s.slot} className={`slot ${s.status === 'empty' ? 'empty' : ''} pick ${slot === s.slot ? 'on' : ''}`} style={{ flexDirection: 'row' }} onClick={() => setSlot(s.slot)}>
                  <span className="num" style={{ fontSize: 22, width: 28 }}>{s.slot}</span>
                  <span className="grow">{s.status === 'empty' ? <span className="muted">{t('Empty slot')}</span> : s.status === 'ok' ? <><b>{s.name}</b> <span className="muted small">· {s.record}</span> <span className="tag red" style={{ marginLeft: 6 }}>{t('Will be overwritten')}</span></> : <span className="red">{t('Damaged save ({err})', { err: s.error ?? '' })}</span>}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 28, gap: 10 }}>
          {step > 0 && <Btn onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> {t('Back')}</Btn>}
          {step < STEPS.length - 1 && <Btn variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{t('Next')} <ArrowRight size={16} /></Btn>}
          {step === STEPS.length - 1 && <Btn variant="primary" size="lg" onClick={begin} disabled={!elig.ok}><Flag size={18} /> {t('Begin Career')}</Btn>}
        </div>
      </div>

      <aside className="wizard-side">
        <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <FighterPreview look={wizardLook} height={240} />
          <div>
            <h2 style={{ fontSize: 24 }}>{o.firstName} {o.lastName}</h2>
            {o.nickname && <div className="accent" style={{ fontFamily: 'var(--head)', letterSpacing: '0.08em' }}>"{o.nickname.toUpperCase()}"</div>}
            <div className="small muted">{t(o.nationality)} · {t('{n} yrs', { n: o.age })} · {o.heightCm} cm · {t(DIVISIONS.find((d) => d.id === o.divisionId)!.name)}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 18, gap: 14 }}>
          <OvrBadge v={ovr} />
          <div className="small muted">{t(BACKGROUNDS.find((b) => b.id === o.background)!.name)} · {t(BODY_TYPES.find((b) => b.id === o.bodyType)!.name)} · {t(START_LEVELS.find((s) => s.id === o.startLevel)!.name)}</div>
        </div>
        <div className="col" style={{ marginTop: 16, gap: 8 }}>
          {CATEGORY_DEFS.map((c) => (
            <div key={c.id}>
              <div className="row between small"><span>{t(c.name)}</span><span className="num" style={{ color: attrColor(cats[c.id]) }}>{Math.round(cats[c.id])}</span></div>
              <Bar value={cats[c.id]} color={attrColor(cats[c.id])} />
            </div>
          ))}
        </div>
        <div className="grid2" style={{ marginTop: 16, gap: 8 }}>
          <div><h4>{t('Strengths')}</h4>{sorted.slice(0, 4).map((a) => <div key={a.key} className="small green">{t(a.name)} {Math.round(a.v)}</div>)}</div>
          <div><h4>{t('Weaknesses')}</h4>{sorted.slice(-4).reverse().map((a) => <div key={a.key} className="small red">{t(a.name)} {Math.round(a.v)}</div>)}</div>
        </div>
      </aside>
      {lookOpen && (
        <Modal title={t('Fighter appearance')} xl onClose={() => setLookOpen(false)}>
          <AppearanceEditor initial={wizardLook} onChange={(l) => ap({ look: l })} compact seedName={`${o.firstName}${o.lastName}`}
            footer={() => <div className="row" style={{ justifyContent: 'flex-end' }}><Btn variant="primary" onClick={() => setLookOpen(false)}>{t('Done')}</Btn></div>} />
        </Modal>
      )}
      {confirm && <Confirm title={t('Overwrite save?')} body={t('Slot {n} already holds a career. Starting here will permanently replace it.', { n: slot })} confirm={t('Overwrite')} danger onNo={() => setConfirm(false)} onYes={() => { setConfirm(false); const st = createCareer(o, slot); store.set(st); store.saveNow(); nav.setTab('overview'); nav.go('hub'); }} />}
    </div>
  );
}
