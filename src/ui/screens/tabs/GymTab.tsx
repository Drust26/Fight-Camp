import { useState } from 'react';
import { t, tp, tx } from '../../../i18n';
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
    nav.toast(err ? tx(err) : ok, err ? 'err' : 'ok');
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Gym & Life')}</h1><div className="sub">{t('Where and how you live shapes how fast you improve and recover.')}</div></div></div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-title"><h3><UserCheck size={16} /> {t('Coaches at {gym}', { gym: cur.name })}</h3></div>
          <p className="tiny dim" style={{ marginTop: -6 }}>{t('A coach boosts the quality of sessions in their specialty (and some unlock advanced sessions). Tactics coaches improve scouting and preparation; recovery coaches cut fatigue and injury risk. One coach per specialty.')}</p>
          {cur.coaches.map((c) => {
            const hired = p.coaches.some((x) => x.id === c.id);
            return (
              <div key={c.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div><b>{c.name}</b> <span className="tag">{t(c.specialty)}</span><div className="small muted">{t('Quality {q} · {fee}/month', { q: c.quality, fee: money(c.fee) })}</div></div>
                {hired ? <Btn size="sm" variant="danger" onClick={() => store.act((g) => fireCoach(g, c.id))}>{t('Release')}</Btn>
                  : <Btn size="sm" variant="primary" onClick={() => run((g) => hireCoach(g, c.id), t('{name} hired.', { name: c.name }))}>{t('Hire')}</Btn>}
              </div>
            );
          })}
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Home size={16} /> {t('Lifestyle')}</h3></div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>{t('Housing')}</label>
            <div className="col" style={{ gap: 6 }}>
              {LIFESTYLE.housing.map((h, i) => (
                <button key={h.name} className={`chip ${p.lifestyle.housing === i ? 'on' : ''}`} style={{ textAlign: 'left' }} onClick={() => store.act((g) => setLifestyle(g, 'housing', i as 0 | 1 | 2))}>
                  <b>{t(h.name)}</b> — {t('{amount}/mo', { amount: money(h.cost) })} <span className="muted small">· {t(h.desc)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>{t('Nutrition')}</label>
            <div className="col" style={{ gap: 6 }}>
              {LIFESTYLE.nutrition.map((h, i) => (
                <button key={h.name} className={`chip ${p.lifestyle.nutrition === i ? 'on' : ''}`} style={{ textAlign: 'left' }} onClick={() => store.act((g) => setLifestyle(g, 'nutrition', i as 0 | 1 | 2))}>
                  <b>{t(h.name)}</b> — {t('{amount}/mo', { amount: money(h.cost) })} <span className="muted small">· {t(h.desc)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="row wrap">
            <button className={`chip ${p.lifestyle.physio ? 'on' : ''}`} onClick={() => store.act((g) => togglePhysio(g))}>{p.lifestyle.physio && <Check size={13} />} {t(LIFESTYLE.physio.name)} ({t('{amount}/mo', { amount: money(LIFESTYLE.physio.cost) })})</button>
            <button className={`chip ${p.lifestyle.homeGym ? 'on' : ''}`} disabled={p.lifestyle.homeGym} onClick={() => run((g) => buyHomeGym(g), t('Home gym installed.'))}>{p.lifestyle.homeGym ? t('Home gym owned') : t('Buy home gym ({amount})', { amount: money(LIFESTYLE.homeGym.cost) })}</button>
          </div>
          <p className="tiny dim">{t(LIFESTYLE.physio.desc)} {t(LIFESTYLE.homeGym.desc)} {t('Monthly costs are charged on the 1st.')}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Stethoscope size={16} /> {t('Medical')}</h3></div>
        {p.injuries.length ? p.injuries.map((i) => (
          <div key={i.id} className="row between wrap" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="grow">
              <b className="red">{t(INJURIES[i.type].name)}</b> <span className="tag">{t('severity {n}', { n: i.severity })}</span> {i.treated && <span className="tag green">{t('treated')}</span>}
              <div className="small muted">{t(INJURIES[i.type].desc)} {t('Blocks: {list}. Source: {src}.', { list: INJURIES[i.type].blocks.map((b) => t(b)).join(', ') || t('nothing'), src: tx(i.source) })}</div>
              <div style={{ maxWidth: 300, marginTop: 4 }}><Bar value={i.totalDays - i.daysLeft} max={i.totalDays} color="var(--green)" /></div>
            </div>
            <span className="small">{tp('{n} day left', '{n} days left', Math.ceil(i.daysLeft))}</span>
            <Btn size="sm" disabled={i.treated} onClick={() => run((g) => treatInjury(g, i.id), t('Treatment booked: recovery sped up 25%.'))}>{t('Treat ({amount})', { amount: money(treatmentCost(st, i.id)) })}</Btn>
          </div>
        )) : <div className="small green">{t('Fully healthy. Rest days, Active Recovery and Rehab sessions speed up healing when you do get hurt.')}</div>}
        {p.medicalSuspensionUntil > st.day && <div className="small red" style={{ marginTop: 8 }}>{t("Medical suspension: you can't be booked to fight for {n} more days.", { n: p.medicalSuspensionUntil - st.day })}</div>}
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Building2 size={16} /> {t('Gyms')}</h3><span className="tiny dim">{t('Switching gyms ends contracts with your current coaches.')}</span></div>
        <div className="grid3">
          {GYMS.map((g) => {
            const err = canJoinGym(st, g.id);
            const mine = p.gymId === g.id;
            return (
              <div key={g.id} className={`panel tight ${mine ? 'goldline' : ''}`}>
                <div className="row between"><b>{g.name}</b>{mine && <span className="tag gold">{t('Your gym')}</span>}</div>
                <div className="small muted">{t(g.location)} · {t(g.specialty)} · {t('{amount}/mo', { amount: money(g.fee) })}</div>
                <div className="col" style={{ gap: 4, margin: '10px 0' }}>
                  {FACS.map((f) => (
                    <div key={f} className="row" style={{ gap: 8 }}><span className="tiny muted" style={{ width: 80 }}>{t(f)}</span><div className="grow"><Bar value={g.fac[f]} color={g.fac[f] > 75 ? 'var(--gold)' : g.fac[f] > 55 ? 'var(--green)' : 'var(--blue)'} /></div><span className="tiny num">{g.fac[f]}</span></div>
                  ))}
                </div>
                <div className="tiny dim" style={{ marginBottom: 8 }}>{t('Coaches: {list}', { list: g.coaches.map((c) => `${t(c.specialty)} ${c.quality}`).join(', ') })}{g.minReputation ? ' · ' + t('requires reputation {n}', { n: g.minReputation }) : ''}</div>
                {!mine && <Btn size="sm" className="block" disabled={!!err} title={err ? tx(err) : ''} onClick={() => setJoin(g.id)}>{err ? tx(err) : t('Join gym')}</Btn>}
              </div>
            );
          })}
        </div>
      </div>
      {join && <Confirm title={t('Join {gym}?', { gym: GYM[join].name })} body={t("You'll pay {fee} now and monthly after that. Your current coaches ({n}) stay behind.", { fee: money(GYM[join].fee), n: p.coaches.length })} confirm={t('Join')} onNo={() => setJoin(null)} onYes={() => { run((g) => joinGym(g, join), t('Welcome to {gym}.', { gym: GYM[join].name })); setJoin(null); }} />}
    </div>
  );
}
