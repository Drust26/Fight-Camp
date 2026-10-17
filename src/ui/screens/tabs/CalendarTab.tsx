import { useState } from 'react';
import { locale, t, weekdayShort } from '../../../i18n';
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import { Btn } from '../../components/common';
import { useGame } from '../../../game/store';
import { DAY_NAMES, dateOf, fmtDate, money, monthlyTotal, weekday } from '../../../game/core';
import { SESSION, INJURIES } from '../../../data/training';
import { ORG } from '../../../data/world';
import { fighterName } from '../../../game/fighterGen';

export function CalendarTab() {
  const st = useGame();
  const p = st.player;
  const [offset, setOffset] = useState(0);
  const now = dateOf(st.day);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const dayOfDate = (d: Date) => Math.round((d.getTime() - Date.UTC(2027, 0, 4)) / 86400000);
  const first = dayOfDate(month);
  const startPad = weekday(first);
  const daysIn = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const orgEvents = new Set<number>();
  if (p.isPro) {
    const o = st.world.orgs[p.orgId];
    for (let d = o.nextEventDay; d < first + 40; d += ORG[p.orgId].eventEveryDays) orgEvents.add(d);
  }
  const cells: JSX.Element[] = [];
  for (let i = 0; i < startPad; i++) cells.push(<div key={`p${i}`} />);
  for (let i = 0; i < daysIn; i++) {
    const day = first + i;
    const items: { t: string; c: string }[] = [];
    if (st.scheduled?.day === day) items.push({ t: t('FIGHT: {name}', { name: st.world.fighters[st.scheduled.opponentId] ? st.world.fighters[st.scheduled.opponentId].last : '' }), c: 'f' });
    if (st.scheduled && st.scheduled.day - 1 === day) items.push({ t: t('Weigh-ins / media'), c: 'w' });
    for (const o of st.offers) if (o.day === day) items.push({ t: t('Offer: {name}?', { name: st.world.fighters[o.opponentId]?.last ?? '' }), c: '' });
    if (dateOf(day).getUTCDate() === 1) items.push({ t: t('Bills {amount}', { amount: money(monthlyTotal(st)) }), c: '' });
    if (orgEvents.has(day) && day >= st.day) items.push({ t: t('{org} event', { org: ORG[p.orgId].short }), c: '' });
    if (p.medicalSuspensionUntil === day) items.push({ t: t('Cleared to fight'), c: 'w' });
    for (const inj of p.injuries) if (Math.round(st.day + inj.daysLeft) === day) items.push({ t: t('{injury} healed', { injury: t(INJURIES[inj.type].name) }), c: 'w' });
    if (day >= st.day && !items.length) {
      const plan = st.plan.days[weekday(day)].filter(Boolean) as string[];
      if (plan.length) items.push({ t: plan.map((x) => t(SESSION[x]?.name ?? x).split(' ')[0]).join(' + '), c: '' });
    }
    cells.push(
      <div key={day} className={`d ${day < st.day ? 'past' : ''} ${day === st.day ? 'today' : ''} ${st.scheduled?.day === day ? 'fight' : ''}`}>
        <span className="n">{i + 1}</span>
        {items.slice(0, 3).map((x, k) => <span key={k} className={`ev ${x.c}`} title={x.t}>{x.t}</span>)}
      </div>,
    );
  }
  const obligations: { day: number; t: string }[] = [];
  if (st.scheduled) {
    const o = st.world.fighters[st.scheduled.opponentId];
    obligations.push({ day: st.scheduled.day - 1, t: t('Weigh-ins (automatic at fight morning)') });
    obligations.push({ day: st.scheduled.day, t: t('Fight vs {name} — {event}', { name: o ? fighterName(o) : '?', event: st.scheduled.eventName }) });
  }
  for (let d = st.day + 1; d < st.day + 60; d++) if (dateOf(d).getUTCDate() === 1) { obligations.push({ day: d, t: t('Monthly bills: {amount}', { amount: money(monthlyTotal(st)) }) }); break; }
  for (const o of st.offers) obligations.push({ day: o.expiresDay, t: t('Offer expires: vs {name}', { name: st.world.fighters[o.opponentId] ? fighterName(st.world.fighters[o.opponentId]) : '?' }) });
  for (const c of st.contractOffers) obligations.push({ day: c.expiresDay, t: t('{org} contract offer expires', { org: ORG[c.orgId].short }) });
  if (p.medicalSuspensionUntil > st.day) obligations.push({ day: p.medicalSuspensionUntil, t: t('Medical suspension ends') });
  obligations.sort((a, b) => a.day - b.day);

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Calendar')}</h1><div className="sub">{t('Today is {date}.', { date: fmtDate(st.day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) })}</div></div></div>
      <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <div className="panel-title">
            <h3><CalendarDays size={16} /> {month.toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
            <div className="row"><Btn size="sm" onClick={() => setOffset(offset - 1)} aria-label={t('Previous month')}><ChevronLeft size={14} /></Btn><Btn size="sm" onClick={() => setOffset(0)}>{t('Today')}</Btn><Btn size="sm" onClick={() => setOffset(offset + 1)} aria-label={t('Next month')}><ChevronRight size={14} /></Btn></div>
          </div>
          <div className="cal">
            {DAY_NAMES.map((d, i) => <div key={d} className="tiny dim" style={{ textAlign: 'center', fontWeight: 600 }}>{weekdayShort(i)}</div>)}
            {cells}
          </div>
        </div>
        <div className="panel">
          <div className="panel-title"><h3><ListChecks size={16} /> {t('Upcoming')}</h3></div>
          {obligations.length ? obligations.map((o, i) => (
            <div key={i} className="row small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
              <span className="muted" style={{ width: 70, flexShrink: 0 }}>{fmtDate(o.day, { day: 'numeric', month: 'short' })}</span>
              <span>{o.t} <span className="dim">({t('{n}d', { n: o.day - st.day })})</span></span>
            </div>
          )) : <div className="muted small">{t('Nothing scheduled.')}</div>}
        </div>
      </div>
    </div>
  );
}
