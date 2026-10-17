import { useState } from 'react';
import { Building2, UserCheck, Home, Stethoscope, Check } from 'lucide-react';
import { Bar, Btn, Confirm, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { GYMS, GYM, INJURIES, LIFESTYLE, type Facility } from '../../../data/training';
import { canJoinGym, fireCoach, hireCoach, joinGym, setLifestyle, togglePhysio, buyHomeGym, treatInjury, treatmentCost } from '../../../game/economy';
import { money } from '../../../game/core';
import type { GameState } from '../../../game/types';

const FACS: Facility[] = ['striking', 'wrestling', 'grappling', 'conditioning', 'recovery', 'partners'];

export function GymTab() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const cur = GYM[p.gymId];
  const [join, setJoin] = useState<string | null>(null);
  const run = (fn: (g: GameState) => string | null | undefined, ok: string) => {
    const err = store.act((g) => fn(g));
    nav.toast(err ? err : ok, err ? 'err' : 'ok');
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>Gym & Life</h1><div className="sub">Where and how you live shapes how fast you improve and recover.</div></div></div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-title"><h3><UserCheck size={16} /> Coaches at {cur.name}</h3></div>
          <p className="tiny dim" style={{ marginTop: -6 }}>A coach boosts the quality of sessions in their specialty (and some unlock advanced sessions). Tactics coaches improve scouting and preparation; recovery coaches cut fatigue and injury risk. One coach per specialty.</p>
          {cur.coaches.map((c) => {
            const hired = p.coaches.some((x) => x.id === c.id);
            return (
              <div key={c.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div><b>{c.name}</b> <span className="tag">{c.specialty}</span><div className="small muted">Quality {c.quality} · {money(c.fee)}/month</div></div>
                {hired ? <Btn size="sm" variant="danger" onClick={() => store.act((g) => fireCoach(g, c.id))}>Release</Btn>
                  : <Btn size="sm" variant="primary" onClick={() => run((g) => hireCoach(g, c.id), `${c.name} hired.`)}>Hire</Btn>}
              </div>
            );
          })}
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Home size={16} /> Lifestyle</h3></div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Housing</label>
            <div className="col" style={{ gap: 6 }}>
              {LIFESTYLE.housing.map((h, i) => (
                <button key={h.name} className={`chip ${p.lifestyle.housing === i ? 'on' : ''}`} style={{ textAlign: 'left' }} onClick={() => store.act((g) => setLifestyle(g, 'housing', i as 0 | 1 | 2))}>
                  <b>{h.name}</b> — {money(h.cost)}/mo <span className="muted small">· {h.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Nutrition</label>
            <div className="col" style={{ gap: 6 }}>
              {LIFESTYLE.nutrition.map((h, i) => (
                <button key={h.name} className={`chip ${p.lifestyle.nutrition === i ? 'on' : ''}`} style={{ textAlign: 'left' }} onClick={() => store.act((g) => setLifestyle(g, 'nutrition', i as 0 | 1 | 2))}>
                  <b>{h.name}</b> — {money(h.cost)}/mo <span className="muted small">· {h.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="row wrap">
            <button className={`chip ${p.lifestyle.physio ? 'on' : ''}`} onClick={() => store.act((g) => togglePhysio(g))}>{p.lifestyle.physio && <Check size={13} />} {LIFESTYLE.physio.name} ({money(LIFESTYLE.physio.cost)}/mo)</button>
            <button className={`chip ${p.lifestyle.homeGym ? 'on' : ''}`} disabled={p.lifestyle.homeGym} onClick={() => run((g) => buyHomeGym(g), 'Home gym installed.')}>{p.lifestyle.homeGym ? 'Home gym owned' : `Buy home gym (${money(LIFESTYLE.homeGym.cost)})`}</button>
          </div>
          <p className="tiny dim">{LIFESTYLE.physio.desc} {LIFESTYLE.homeGym.desc} Monthly costs are charged on the 1st.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Stethoscope size={16} /> Medical</h3></div>
        {p.injuries.length ? p.injuries.map((i) => (
          <div key={i.id} className="row between wrap" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="grow">
              <b className="red">{INJURIES[i.type].name}</b> <span className="tag">severity {i.severity}</span> {i.treated && <span className="tag green">treated</span>}
              <div className="small muted">{INJURIES[i.type].desc} Blocks: {INJURIES[i.type].blocks.join(', ') || 'nothing'}. Source: {i.source}.</div>
              <div style={{ maxWidth: 300, marginTop: 4 }}><Bar value={i.totalDays - i.daysLeft} max={i.totalDays} color="var(--green)" /></div>
            </div>
            <span className="small">{Math.ceil(i.daysLeft)} days left</span>
            <Btn size="sm" disabled={i.treated} onClick={() => run((g) => treatInjury(g, i.id), 'Treatment booked: recovery sped up 25%.')}>Treat ({money(treatmentCost(st, i.id))})</Btn>
          </div>
        )) : <div className="small green">Fully healthy. Rest days, Active Recovery and Rehab sessions speed up healing when you do get hurt.</div>}
        {p.medicalSuspensionUntil > st.day && <div className="small red" style={{ marginTop: 8 }}>Medical suspension: you can't be booked to fight for {p.medicalSuspensionUntil - st.day} more days.</div>}
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Building2 size={16} /> Gyms</h3><span className="tiny dim">Switching gyms ends contracts with your current coaches.</span></div>
        <div className="grid3">
          {GYMS.map((g) => {
            const err = canJoinGym(st, g.id);
            const mine = p.gymId === g.id;
            return (
              <div key={g.id} className={`panel tight ${mine ? 'goldline' : ''}`}>
                <div className="row between"><b>{g.name}</b>{mine && <span className="tag gold">Your gym</span>}</div>
                <div className="small muted">{g.location} · {g.specialty} · {money(g.fee)}/mo</div>
                <div className="col" style={{ gap: 4, margin: '10px 0' }}>
                  {FACS.map((f) => (
                    <div key={f} className="row" style={{ gap: 8 }}><span className="tiny muted" style={{ width: 80 }}>{f}</span><div className="grow"><Bar value={g.fac[f]} color={g.fac[f] > 75 ? 'var(--gold)' : g.fac[f] > 55 ? 'var(--green)' : 'var(--blue)'} /></div><span className="tiny num">{g.fac[f]}</span></div>
                  ))}
                </div>
                <div className="tiny dim" style={{ marginBottom: 8 }}>Coaches: {g.coaches.map((c) => `${c.specialty} ${c.quality}`).join(', ')}{g.minReputation ? ` · requires reputation ${g.minReputation}` : ''}</div>
                {!mine && <Btn size="sm" className="block" disabled={!!err} title={err ?? ''} onClick={() => setJoin(g.id)}>{err ?? 'Join gym'}</Btn>}
              </div>
            );
          })}
        </div>
      </div>
      {join && <Confirm title={`Join ${GYM[join].name}?`} body={`You'll pay ${money(GYM[join].fee)} now and monthly after that. Your current coaches (${p.coaches.length}) stay behind.`} confirm="Join" onNo={() => setJoin(null)} onYes={() => { run((g) => joinGym(g, join), `Welcome to ${GYM[join].name}.`); setJoin(null); }} />}
    </div>
  );
}
