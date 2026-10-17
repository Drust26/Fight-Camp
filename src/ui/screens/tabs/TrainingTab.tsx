import { Fragment, useMemo, useState } from 'react';
import { Dumbbell, Trash2, Wand2, AlertTriangle, ScrollText, Info } from 'lucide-react';
import { Btn, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { SESSIONS, SESSION, GYM, type SessionCat } from '../../../data/training';
import { checkSession, expectedGains, injuryRisk, sessionQuality } from '../../../game/training';
import { ATTR_BY_KEY, type AttrKey } from '../../../game/attributes';
import { DAY_NAMES, weekday, fmtDate, gymCoachBonus } from '../../../game/core';
import { CAMP_FOCUS } from '../../../game/fights';
import type { WeekPlan } from '../../../game/types';

const CATS: { id: SessionCat; name: string }[] = [
  { id: 'striking', name: 'Striking' }, { id: 'grappling', name: 'Grappling' }, { id: 'conditioning', name: 'Conditioning' },
  { id: 'mma', name: 'MMA' }, { id: 'recovery', name: 'Recovery' }, { id: 'life', name: 'Life' },
];

const PRESETS: { name: string; desc: string; plan: (string | null)[][] }[] = [
  { name: 'Balanced', desc: 'All-round development', plan: [['boxing', 'aerobic'], ['wrestling', 'strength'], ['bjj', 'mobility'], ['kickboxing', 'hiit'], ['tactical', null], ['aerobic', null], [null, null]] },
  { name: 'Striking focus', desc: 'Hands and feet', plan: [['boxing', 'combos'], ['kickboxing', 'strength'], ['defstrike', 'mobility'], ['countering', 'hiit'], ['sparstrike', null], ['aerobic', null], [null, null]] },
  { name: 'Grappling focus', desc: 'Wrestling & BJJ', plan: [['wrestling', 'bjj'], ['tdchains', 'strength'], ['escapes', 'mobility'], ['topgame', 'subchains'], ['rolling', null], ['aerobic', null], [null, null]] },
  { name: 'Fight camp', desc: 'Peak for a booked fight', plan: [['oppprep', 'aerobic'], ['tactical', 'strength'], ['film', 'mobility'], ['oppprep', 'hiit'], ['fightsim', null], ['recover', null], [null, null]] },
  { name: 'Recovery week', desc: 'Heal up, stay sharp', plan: [['light', 'mobility'], ['recover', null], ['film', 'mobility'], ['rehab', null], ['light', 'recover'], [null, null], [null, null]] },
  { name: 'Broke & grinding', desc: 'Work shifts + basics', plan: [['work', 'boxing'], ['work', 'aerobic'], ['bjj', 'mobility'], ['work', 'wrestling'], ['tactical', null], ['work', null], [null, null]] },
];

export function TrainingTab() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const [sel, setSel] = useState<{ d: number; s: 0 | 1 } | null>({ d: weekday(st.day), s: 0 });
  const [cat, setCat] = useState<SessionCat>('striking');
  const [inspect, setInspect] = useState<string | null>(null);
  const today = weekday(st.day);
  const gym = GYM[p.gymId];

  const setSlot = (id: string | null) => {
    if (!sel) return;
    store.act((g) => { g.plan.days[sel.d][sel.s] = id; });
    // move selection forward for quick planning
    setSel(sel.s === 0 ? { d: sel.d, s: 1 } : { d: (sel.d + 1) % 7, s: 0 });
  };
  const applyPreset = (plan: (string | null)[][]) => store.act((g) => { g.plan = { days: plan.map((d) => [d[0], d[1]]) as WeekPlan['days'] }; });

  // simple fatigue projection over the planned week (same recovery formula as overnight processing, approximated)
  const projection = useMemo(() => {
    let f = p.fatigue;
    const out: { day: number; f: number; risk: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = (today + i) % 7;
      const ids = st.plan.days[d].filter(Boolean) as string[];
      let risk = 0;
      for (const id of ids) {
        const s = SESSION[id];
        risk += s.risk * Math.pow(1 + f / 45, 1.3);
        f = Math.max(0, Math.min(100, f + (s.intensity >= 0 ? s.intensity * (1.15 - p.attrs.cardio / 250) : s.intensity)));
      }
      out.push({ day: d, f, risk });
      f = Math.max(0, f - (13 + p.attrs.recovery / 7) * (ids.length ? 1 : 1.6) - (ids.length ? 0 : 6));
    }
    return out;
  }, [st.plan, p.fatigue, today]);

  const insp = inspect ? SESSION[inspect] : null;
  const exp = inspect ? expectedGains(st, inspect) : null;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head">
        <div><h1>Training</h1><div className="sub">Your plan repeats every week. Time only passes when you advance it from the top bar.</div></div>
        <div className="row wrap" style={{ gap: 6 }}>
          {PRESETS.map((pr) => <Btn key={pr.name} size="sm" title={pr.desc} onClick={() => { applyPreset(pr.plan); nav.toast(`Plan set: ${pr.name}`, 'ok'); }}><Wand2 size={13} /> {pr.name}</Btn>)}
        </div>
      </div>

      {st.scheduled && (
        <div className="panel goldline tight row between wrap">
          <span className="small">Fight camp: <b>{CAMP_FOCUS.find((c) => c.id === st.scheduled!.campFocus)?.name}</b> · Opponent preparation <b>{Math.round(st.scheduled.prep)}%</b> · {st.scheduled.day - st.day} days to fight. <span className="muted">Opponent-Specific Camp and Film Study raise preparation. Taper (lighter sessions) in the last days to arrive fresh.</span></span>
          <Btn size="sm" onClick={() => applyPreset(PRESETS[3].plan)}>Use fight-camp preset</Btn>
        </div>
      )}

      <div className="panel">
        <div className="panel-title"><h3><Dumbbell size={16} /> Weekly plan</h3><span className="tiny dim">Click a slot, then a session below. Empty slot = rest.</span></div>
        <div className="planner">
          <div />
          {DAY_NAMES.map((d, i) => <div key={d} className={`h ${i === today ? 'today' : ''}`}>{d}{i === today ? ' · today' : ''}</div>)}
          {[0, 1].map((slot) => (
            <Fragment key={slot}>
              <div className="rl">{slot === 0 ? 'Morning' : 'Evening'}</div>
              {DAY_NAMES.map((_, d) => {
                const id = st.plan.days[d][slot];
                const s = id ? SESSION[id] : null;
                const chk = id ? checkSession(st, id) : null;
                const isSel = sel?.d === d && sel?.s === slot;
                return (
                  <button key={`${slot}${d}`} className={`cell ${s ? `filled cat-${s.cat}` : ''} ${isSel ? 'sel' : ''} ${chk && !chk.ok ? 'bad' : ''}`} onClick={() => { setSel({ d, s: slot as 0 | 1 }); if (id) setInspect(id); }}>
                    {s ? <>
                      <span className="t">{s.name}</span>
                      <span className="tiny muted">{s.intensity > 0 ? `+${s.intensity} fatigue` : s.intensity < 0 ? `${s.intensity} fatigue` : 'no fatigue'}{s.cost ? ` · $${s.cost}` : ''}</span>
                      {chk && !chk.ok && <span className="tiny red">{chk.reason}</span>}
                    </> : <span className="dim small">Rest</span>}
                  </button>
                );
              })}
            </Fragment>
          ))}
          <div className="rl">Fatigue</div>
          {DAY_NAMES.map((_, d) => {
            const pr = projection.find((x) => x.day === d)!;
            return <div key={`f${d}`} className="tiny" style={{ textAlign: 'center' }}><div className={pr.f > 70 ? 'red' : pr.f > 45 ? 'gold' : 'green'}>{Math.round(pr.f)}%</div><div className={pr.risk > 0.04 ? 'red' : 'dim'}>{(pr.risk * 100).toFixed(1)}% inj.</div></div>;
          })}
        </div>
        {projection.some((x) => x.f > 75) && <div className="small red" style={{ marginTop: 10 }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> This plan pushes fatigue very high. Expect slower gains and a much higher injury risk. Add rest or recovery.</div>}
      </div>

      <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <div className="panel-title">
            <div className="row wrap" style={{ gap: 6 }}>{CATS.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
            <Btn size="sm" disabled={!sel} onClick={() => setSlot(null)}><Trash2 size={13} /> Set rest</Btn>
          </div>
          <div className="lib">
            {SESSIONS.filter((s) => s.cat === cat).map((s) => {
              const chk = checkSession(st, s.id);
              const risk = injuryRisk(st, s);
              return (
                <button key={s.id} className={`item cat-${s.cat}`} onMouseEnter={() => setInspect(s.id)} onFocus={() => setInspect(s.id)} onClick={() => { if (sel) setSlot(s.id); setInspect(s.id); }} title={chk.ok ? s.desc : chk.reason}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span className="tiny muted">{Object.keys(s.gains).slice(0, 3).map((k) => ATTR_BY_KEY[k as AttrKey].name).join(', ') || s.desc}</span>
                  <span className="tiny"><span className={s.intensity > 22 ? 'red' : s.intensity > 14 ? 'gold' : 'green'}>{s.intensity >= 0 ? '+' : ''}{s.intensity} fat</span> · <span className={risk > 0.02 ? 'red' : 'dim'}>{(risk * 100).toFixed(1)}% inj</span>{s.cost ? ` · $${s.cost}` : ''}</span>
                  {!chk.ok && <span className="tiny red">{chk.reason}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Info size={16} /> Session details</h3></div>
          {insp && exp ? (
            <div className="col" style={{ gap: 8 }}>
              <div><b>{insp.name}</b><div className="small muted">{insp.desc}</div></div>
              <div className="small">Quality ×{sessionQuality(st, insp).toFixed(2)} <span className="dim">({gym.name} {insp.facility} {gym.fac[insp.facility]}{gymCoachBonus(st, insp.coach) ? `, coach ${gymCoachBonus(st, insp.coach)}` : insp.coach ? ', no ' + insp.coach + ' coach' : ''})</span></div>
              <div className="col" style={{ gap: 3 }}>
                {Object.entries(exp).map(([k, v]) => (
                  <div key={k} className="row between small"><span>{ATTR_BY_KEY[k as AttrKey].name} <span className="dim">({Math.floor(p.attrs[k as AttrKey])})</span></span><span className="green">+{(v ?? 0).toFixed(2)}</span></div>
                ))}
                {!Object.keys(exp).length && <span className="small muted">No attribute gains — this session has a special effect.</span>}
              </div>
              <div className="tiny dim">Expected gain per session at your current fatigue. Gains shrink as attributes get high (diminishing returns) and when tired.</div>
              <div className="small">Fatigue {insp.intensity >= 0 ? '+' : ''}{insp.intensity} · Injury risk {(injuryRisk(st, insp) * 100).toFixed(2)}% · Contact: {insp.contact}</div>
            </div>
          ) : <div className="muted small">Hover a session to see its expected effect.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><h3><ScrollText size={16} /> Training log</h3></div>
        {st.dayLogs.length ? st.dayLogs.slice(0, 10).map((l) => (
          <div key={l.day} className="row small" style={{ padding: '5px 0', borderBottom: '1px solid rgba(38,43,56,.5)', alignItems: 'flex-start' }}>
            <span className="muted" style={{ width: 110, flexShrink: 0 }}>{fmtDate(l.day, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="grow">{l.lines.map((x, i) => <span key={i} className={/INJURY/.test(x) ? 'red' : ''}>{x} </span>)}</span>
            <span className="green tiny">{Object.entries(l.gains).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3).map(([k, v]) => `${ATTR_BY_KEY[k as AttrKey].name} +${(v ?? 0).toFixed(2)}`).join(', ')}</span>
          </div>
        )) : <div className="muted small">Advance time to start training.</div>}
      </div>
    </div>
  );
}
