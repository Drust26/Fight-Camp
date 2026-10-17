import { PosterThumb } from '../../components/FightPoster';
import { t, tp, tx } from '../../../i18n';
import { tn } from '../../../i18n/rich';
import { posterForScheduled } from '../../../game/poster';
import { statusName, superfightProgress, SUPERFIGHT_RULES } from '../../../game/superfight';
import { Belt, BELT_INFO } from '../../components/Belt';
import { Activity, Bell, Crosshair, Flame, HeartPulse, Scale, Swords, Target, Trophy, Wallet, Mail, Newspaper, AlertTriangle, BriefcaseMedical, GraduationCap } from 'lucide-react';
import { Bar, Btn, OvrBadge, Portrait, Stat, useNav, attrColor } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { CATEGORY_DEFS, categoryRatings, overallRating } from '../../../game/attributes';
import { ageOf, fmtDate, money, monthlyTotal, kgToLb } from '../../../game/core';
import { locale } from '../../../i18n';
import { DIV, ORG, STYLE } from '../../../data/world';
import { INJURIES } from '../../../data/training';
import { readiness } from '../../../game/training';
import { weightCutInfo } from '../../../game/fights';
import { playerRank } from '../../../game/world';
import { GOALS } from '../../../game/achievements';
import { fighterName, recStr, wfAppearance } from '../../../game/fighterGen';

const KIND_ICON: Record<string, any> = { news: Newspaper, offer: Mail, injury: BriefcaseMedical, finance: Wallet, event: Bell, training: Activity, result: Trophy, world: Newspaper };

export function Overview({ onAdvance }: { onAdvance: (n: number) => void }) {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const ovr = overallRating(p.attrs);
  const cats = categoryRatings(p.attrs);
  const rank = playerRank(st);
  const champ = p.isPro && st.world.orgs[p.orgId].champions[p.divisionId] === 'player';
  const sfLine = superfightProgress(st);
  const rd = readiness(st);
  const sc = st.scheduled;
  const opp = sc ? st.world.fighters[sc.opponentId] : null;
  const wc = sc ? weightCutInfo(st) : null;
  const limit = DIV[p.divisionId].kg;
  const rec = p.isPro ? p.record : p.amateurRecord;
  const nextBills = (() => { const d = new Date(Date.UTC(2027, 0, 4) + st.day * 86400000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); })();

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="panel hero cut" style={{ padding: 20 }}>
        <div className="row" style={{ gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <Portrait ap={p.appearance} size={128} />
          <div className="grow col" style={{ gap: 6, minWidth: 240 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              {champ && <span className="tag gold"><Trophy size={12} /> {t('{org} CHAMPION', { org: ORG[p.orgId].short })}</span>}
              {(p.champStatus ?? 0) > 0 && <span className="tag gold"><Trophy size={12} /> HFC {t(statusName(p.champStatus)).toUpperCase()}</span>}
              <span className="tag">{p.isPro ? ORG[p.orgId].name : t('Amateur')}</span>
              <span className="tag">{t(DIV[p.divisionId].name)}</span>
              {p.streak >= 2 && <span className="tag green"><Flame size={12} /> {tp('{n} win streak', '{n} win streak', p.streak)}</span>}
              {p.streak <= -2 && <span className="tag red">{tp('{n} straight loss', '{n} straight losses', -p.streak)}</span>}
            </div>
            <h1 style={{ fontSize: 40, lineHeight: 1 }}>{p.firstName} <span className="accent">{p.lastName}</span></h1>
            {p.nickname && <div style={{ fontFamily: 'var(--head)', letterSpacing: '0.12em', color: 'var(--muted)' }}>"{p.nickname.toUpperCase()}"</div>}
            {sfLine && <div className="small gold" title={SUPERFIGHT_RULES.map(tx).join('\n')}>{tx(sfLine)}{champ && (p.reignDefenses ?? 0) > 0 ? ' ' + t('({n} so far)', { n: p.reignDefenses ?? 0 }) : ''}</div>}
            <div className="row wrap" style={{ gap: 28, marginTop: 8 }}>
              <Stat v={`${rec.w}-${rec.l}${rec.d ? '-' + rec.d : ''}`} l={p.isPro ? t('Pro record') : t('Amateur record')} />
              <Stat v={champ ? 'C' : rank ? `#${rank}` : '—'} l={t('Ranking')} cls={champ ? 'gold' : ''} />
              <Stat v={Math.floor(ageOf(p.bornDay, st.day))} l={t('Age')} />
              <Stat v={Math.round(p.popularity)} l={t('Popularity')} />
              <Stat v={Math.round(p.reputation)} l={t('Reputation')} />
            </div>
          </div>
          {champ && <div style={{ alignSelf: 'center' }} title={t(BELT_INFO[p.orgId].name)}><Belt org={p.orgId} width={210} label={t('{div} champion', { div: t(DIV[p.divisionId].name) })} /></div>}
          <div className="col" style={{ minWidth: 230, gap: 6 }}>
            <div className="row" style={{ gap: 12 }}><OvrBadge v={ovr} size={60} /><div className="small muted">{t('Overall is derived from your category ratings. Train to raise it.')}</div></div>
            {CATEGORY_DEFS.map((c) => (
              <div key={c.id} className="row" style={{ gap: 8 }}>
                <span className="tiny muted" style={{ width: 82 }}>{t(c.name)}</span>
                <div className="grow"><Bar value={cats[c.id]} color={attrColor(cats[c.id])} /></div>
                <span className="num small" style={{ width: 22, textAlign: 'right' }}>{Math.round(cats[c.id])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid3">
        {/* NEXT ACTION */}
        <div className={`panel ${sc ? 'goldline' : ''}`} style={{ gridColumn: 'span 2' }}>
          <div className="panel-title"><h3><Swords size={16} /> {sc ? t('Next fight') : t('Next step')}</h3>{sc && <span className="tag accent">{sc.day - st.day <= 0 ? t('TONIGHT') : tp('{n} day', '{n} days', sc.day - st.day)}</span>}</div>
          {sc && opp ? (
            <div className="row wrap" style={{ gap: 18 }}>
              <Portrait ap={p.appearance} size={72} />
              <div className="vs">VS</div>
              <Portrait ap={wfAppearance(opp)} size={72} accent="#60a5fa" mirror />
              <div className="grow col" style={{ gap: 4, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{fighterName(opp)} <span className="muted small">({recStr(opp.rec)})</span></div>
                <div className="small muted">{t(STYLE[opp.style].name)} · {t(opp.stance)} · {sc.eventName} · {fmtDate(sc.day)}{sc.title ? ' · ' : ''}{sc.title && <b className="gold">{t('TITLE FIGHT')}</b>}</div>
                <div className="row wrap small" style={{ gap: 14, marginTop: 4 }}>
                  <span>{t('Prep')} <b>{Math.round(sc.prep)}%</b></span>
                  <span>{t('Weight cut')} <b className={wc!.pct > 0.08 ? 'red' : wc!.pct > 0.06 ? 'gold' : 'green'}>{tx(wc!.label)}</b></span>
                  <span>{t('Purse')} <b>{money(sc.purse)}</b> + {money(sc.winBonus)}</span>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  {sc.day <= st.day ? <Btn variant="primary" onClick={() => nav.go('prep')}><Swords size={15} /> {t('Fight night')}</Btn> : <Btn onClick={() => nav.go('prep')}><Crosshair size={15} /> {t('Scout opponent & game plan')}</Btn>}
                  <Btn onClick={() => nav.setTab('training')}>{t('Adjust camp')}</Btn>
                </div>
              </div>
              <PosterThumb data={posterForScheduled(st, sc)} width={104} label={t('Fight poster')} />
            </div>
          ) : (
            <div className="col">
              {p.retired ? <span className="muted">{t('You are retired.')}</span> : st.offers.length ? (
                <div className="row between wrap"><span>{tn(st.offers.length > 1 ? '{n} fight offers are waiting for your answer.' : '{n} fight offer is waiting for your answer.', { n: <b>{st.offers.length}</b> })}</span><Btn variant="primary" onClick={() => nav.setTab('offers')}>{t('Review offers')}</Btn></div>
              ) : p.isPro && (!p.contract || p.contract.fightsLeft === 0) ? (
                <div className="row between wrap"><span>{tn('You are a {fa}. Sign a contract to get fights.', { fa: <b>{t('free agent')}</b> })}</span><Btn variant="primary" onClick={() => nav.setTab('contracts')}>{t('Contracts')}</Btn></div>
              ) : (
                <div className="row between wrap"><span className="muted">{t('No fight booked. Keep training — promoters will call.')} {p.medicalSuspensionUntil > st.day && <b className="red">{t('Medically suspended until {date}.', { date: fmtDate(p.medicalSuspensionUntil) })}</b>}</span><Btn onClick={() => onAdvance(7)}>{t('Advance a week')}</Btn></div>
              )}
              {!st.practiceDone && <div className="row between wrap" style={{ marginTop: 6, padding: 10, borderRadius: 8, background: 'var(--accentDim)' }}><span className="small"><GraduationCap size={14} style={{ verticalAlign: -2 }} /> {t('New to the cage? Learn the controls in the Practice Arena first.')}</span><Btn size="sm" onClick={() => nav.go('practice')}>{t('Practice Arena')}</Btn></div>}
            </div>
          )}
        </div>

        {/* CONDITION */}
        <div className="panel">
          <div className="panel-title"><h3><HeartPulse size={16} /> {t('Condition')}</h3><span className={`tag ${rd.score > 75 ? 'green' : rd.score > 50 ? 'gold' : 'red'}`}>{t('Ready {n}%', { n: rd.score })}</span></div>
          <div className="col" style={{ gap: 8 }}>
            <div><div className="row between small"><span>{t('Fatigue')}</span><span>{Math.round(p.fatigue)}%</span></div><Bar value={p.fatigue} color={p.fatigue > 60 ? 'var(--red)' : p.fatigue > 35 ? 'var(--gold)' : 'var(--green)'} /></div>
            <div><div className="row between small"><span>{t('Sharpness')}</span><span>{Math.round(p.sharpness)}%</span></div><Bar value={p.sharpness} color="var(--blue)" /></div>
            <div><div className="row between small"><span>{t('Career wear')}</span><span>{Math.round(p.wear)}%</span></div><Bar value={p.wear} color="var(--purple)" /></div>
            <div className="row between small"><span><Scale size={13} style={{ verticalAlign: -2 }} /> {t('Weight')}</span><span>{t('{kg} kg / limit {limit} kg ({lb} lb)', { kg: p.weightKg.toFixed(1), limit, lb: Math.round(kgToLb(limit)) })}</span></div>
            {p.injuries.length ? p.injuries.map((i) => (
              <div key={i.id} className="row between small red"><span><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {t(INJURIES[i.type].name)} {t('(sev {n})', { n: i.severity })}</span><span>{t('{n}d', { n: Math.ceil(i.daysLeft) })}</span></div>
            )) : <div className="small green">{t('No injuries')}</div>}
          </div>
        </div>
      </div>

      <div className="grid3">
        <div className="panel">
          <div className="panel-title"><h3><Target size={16} /> {t('Objectives')}</h3></div>
          {st.goals.length ? st.goals.map((g) => {
            const def = GOALS.find((x) => x.id === g)!;
            const pr = def.progress(st);
            return <div key={g} style={{ marginBottom: 10 }}><div className="row between small"><b>{t(def.name)}</b><span className="muted">{tx(pr.label)}</span></div><Bar value={pr.value * 100} color={pr.value >= 1 ? 'var(--gold)' : undefined} /></div>;
          }) : <div className="muted small">{t('No ambitions selected.')}</div>}
          <div className="tiny dim">{t('Achievements unlocked: {n}', { n: st.achievements.length })}</div>
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Wallet size={16} /> {t('Finances')}</h3><Btn size="sm" variant="ghost" onClick={() => nav.setTab('finances')}>{t('Details')}</Btn></div>
          <div className="grid2">
            <Stat v={money(p.money)} l={t('Balance')} cls={p.money < 0 ? 'red' : ''} />
            <Stat v={money(monthlyTotal(st))} l={t('Monthly costs')} />
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>{t('Next bills: {date}', { date: nextBills.toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }) })}{st.sponsors.length ? ' · ' + tp('{n} sponsor paying {amount}/mo', '{n} sponsors paying {amount}/mo', st.sponsors.length, { amount: money(st.sponsors.reduce((s, d) => s + d.monthly, 0)) }) : ''}</div>
          {p.money < monthlyTotal(st) && <div className="small red" style={{ marginTop: 6 }}>{t("You can't cover next month's bills. Consider cheaper living, a part-time job, or a fight.")}</div>}
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Trophy size={16} /> {t('Recent fights')}</h3></div>
          {p.history.length ? p.history.slice(0, 5).map((h) => (
            <div key={h.id} className="row between small" style={{ padding: '4px 0' }}>
              <span><b className={h.result === 'W' ? 'green' : h.result === 'L' ? 'red' : 'gold'}>{t(h.result)}</b> {h.opponentName}</span>
              <span className="muted">{t(h.method)} {t('R{n}', { n: h.round })}</span>
            </div>
          )) : <div className="muted small">{t('No fights yet.')}</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Bell size={16} /> {t('News & messages')}</h3><Btn size="sm" variant="ghost" onClick={() => store.act((g) => g.inbox.forEach((m) => (m.read = true)))}>{t('Mark all read')}</Btn></div>
        <div className="feed">
          {st.inbox.slice(0, 14).map((m) => {
            const I = KIND_ICON[m.kind] ?? Newspaper;
            return (
              <div key={m.id} className={`it ${m.read ? '' : 'unread'}`} onClick={() => !m.read && store.act((g) => { const x = g.inbox.find((y) => y.id === m.id); if (x) x.read = true; }, { save: false })}>
                <I size={16} color={m.read ? 'var(--dim)' : 'var(--accent)'} />
                <div><div className="t">{tx(m.title)}</div><div className="b">{tx(m.body)}</div></div>
                <span className="tiny dim">{fmtDate(m.day, { day: 'numeric', month: 'short' })}</span>
              </div>
            );
          })}
          {!st.inbox.length && <div className="muted small">{t('Nothing yet.')}</div>}
        </div>
      </div>
    </div>
  );
}
