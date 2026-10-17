import { useState } from 'react';
import { Trophy, Crown, ScrollText } from 'lucide-react';
import { Modal, Portrait, Bar, attrColor, useNav } from '../../components/common';
import { PosterButton } from '../../components/FightPoster';
import { posterForHistory } from '../../../game/poster';
import { useGame } from '../../../game/store';
import { rankings } from '../../../game/world';
import { DIVISIONS, ORGS, ORG, STYLE, DIV } from '../../../data/world';
import { fighterName, recStr, wfAppearance } from '../../../game/fighterGen';
import { CATEGORY_DEFS, categoryRatings, overallRating, unpackAttrs } from '../../../game/attributes';
import { ageOf, fmtDate } from '../../../game/core';
import { scoutLevel, scoutRange } from '../../../game/fights';
import type { DivisionId, OrgId, WorldFighter } from '../../../game/types';
import { worldLegacy } from '../../../game/history';
import { Belt, BELT_INFO } from '../../components/Belt';
import { SUPERFIGHT_RULES, statusName } from '../../../game/superfight';
import { beltsOf } from '../../../game/living';
import { t, tp, tx } from '../../../i18n';

export function FighterModal({ id, onClose }: { id: string; onClose: () => void }) {
  const st = useGame();
  const f = st.world.fighters[id];
  if (id === 'player') return <PlayerModal onClose={onClose} />;
  if (!f) return null;
  const a = unpackAttrs(f.a);
  const cats = categoryRatings(a);
  const r = scoutRange(scoutLevel(st));
  return (
    <Modal title={fighterName(f)} onClose={onClose}>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <Portrait ap={wfAppearance(f)} size={110} accent="#60a5fa" />
        <div className="col grow" style={{ gap: 4 }}>
          {f.nick && <div className="accent" style={{ fontFamily: 'var(--head)', letterSpacing: '0.1em' }}>"{f.nick.toUpperCase()}"</div>}
          <div className="small">{t('{rec} · {ko} KO/TKO · {sub} SUB · {dec} DEC', { rec: recStr(f.rec), ko: f.rec.ko + f.rec.tko, sub: f.rec.sub, dec: f.rec.dec })}</div>
          <div className="small muted">{t(STYLE[f.style].name)} · {t(f.stance)} · {t(f.nat)} · {t('age {n}', { n: Math.floor((st.day - f.bornDay) / 365) })} · {t('{h} cm / {r} cm reach', { h: f.h, r: f.r })}</div>
          <div className="small muted">{ORG[f.org].name} · {t(DIV[f.div].name)} · {t('popularity {n}', { n: f.pop })}</div>
          <div className="small">{t('Scouted overall:')} <b>{overallRating(a) - r}–{overallRating(a) + r}</b></div>
          {f.injuredUntil > st.day && <div className="small red">{t('Injured until {date}', { date: fmtDate(f.injuredUntil) })}</div>}
          {st.rivalries[f.id] ? <div className="small red">{t('Rivalry heat: {n}', { n: Math.round(st.rivalries[f.id]) })}</div> : null}
        </div>
      </div>
      <div className="col" style={{ gap: 6, marginTop: 14 }}>
        {CATEGORY_DEFS.map((c) => (
          <div key={c.id} className="row" style={{ gap: 8 }}><span className="small muted" style={{ width: 96 }}>{t(c.name)}</span><div className="grow"><Bar value={cats[c.id]} color={attrColor(cats[c.id])} /></div><span className="num small">~{Math.round(cats[c.id] / 5) * 5}</span></div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>{t(STYLE[f.style].desc)} {t('Recent form:')} {f.recent.map((x) => t(x)).join(' ') || '—'}</p>
      <CareerDetails f={f} />
      {f.vsPlayer.length > 0 && <p className="small">{t('History with you:')} {f.vsPlayer.map((v) => t(v.result === 'W' ? 'He won by {method} ({date})' : v.result === 'L' ? 'You won by {method} ({date})' : 'Draw by {method} ({date})', { method: t(v.method), date: fmtDate(v.day, { month: 'short', year: 'numeric' }) })).join('; ')}</p>}
    </Modal>
  );
}

function CareerDetails({ f }: { f: WorldFighter }) {
  const st = useGame();
  const [showLegacy, setShowLegacy] = useState(false);
  const lg = worldLegacy(f);
  const belts = beltsOf(st, f.id);
  const log = f.log ?? [];
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row wrap" style={{ gap: 6 }}>
        {f.retired && <span className="tag">{t('Retired')}{f.rd ? ` ${fmtDate(f.rd, { month: 'short', year: 'numeric' })}` : ''}</span>}
        {belts.map((b) => <span key={b.org + b.div} className="tag gold"><Crown size={11} /> {t('{org} {div} champion', { org: ORG[b.org].short, div: t(DIV[b.div].name) })}</span>)}
        {belts.length >= 2 && <span className="tag accent">{t('Double champion')}</span>}
        {belts.length > 0 && f.rgn != null && <span className="tag">{t('{n} mo reign', { n: Math.round((st.day - f.rgn) / 30) })}{f.rdf ? ' · ' + tp('{n} straight defense', '{n} straight defenses', f.rdf) : ''}</span>}
        {(f.ttl ?? 0) > 0 && <span className="tag gold">{tp('{n} title win', '{n} title wins', f.ttl ?? 0)}</span>}
        {(f.dfn ?? 0) > 0 && <span className="tag gold">{tp('{n} defense', '{n} defenses', f.dfn ?? 0)}</span>}
        {(f.stk ?? 0) >= 2 && <span className="tag green">{t('{n}-fight win streak', { n: f.stk ?? 0 })}</span>}
        {(f.mstk ?? 0) >= 3 && <span className="tag">{t('Best streak {n}', { n: f.mstk ?? 0 })}</span>}
        {f.deb != null && <span className="tag">{t('Debut {date}', { date: fmtDate(f.deb, { month: 'short', year: 'numeric' }) })}</span>}
        <button className="chip" onClick={() => setShowLegacy((x) => !x)}>{t('Legacy {n}', { n: lg.total })}</button>
      </div>
      {(f.mv ?? []).length > 0 && (
        <div className="tiny muted" style={{ marginTop: 6 }}>
          {[...(f.mv ?? [])].reverse().map((m, i) => <div key={i}>{t(Object.keys(DIV).indexOf(m.t) > Object.keys(DIV).indexOf(m.f) ? 'Moved up from {from} to {to}' : 'Moved down from {from} to {to}', { from: t(DIV[m.f].name), to: t(DIV[m.t].name) })} · {fmtDate(m.d, { month: 'short', year: 'numeric' })}: {tx(m.why)}</div>)}
        </div>
      )}
      {showLegacy && (
        <div className="panel tight" style={{ marginTop: 8 }}>
          {lg.factors.map((x) => <div key={x.label} className="row between tiny"><span>{tx(x.label)}</span><span className={x.value >= 0 ? 'green' : 'red'}>{x.value >= 0 ? '+' : ''}{x.value}</span></div>)}
          <div className="tiny dim" style={{ marginTop: 4 }}>{t('Legacy is capped at 100. Notable careers enter the Hall of Fame on retirement.')}</div>
        </div>
      )}
      {log.length > 0 && (
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead><tr><th>{t('Res')}</th><th>{t('Opponent')}</th><th>{t('Method')}</th><th>{t('Date')}</th></tr></thead>
          <tbody>{log.map((e, i) => (
            <tr key={i}><td><span className={`tag ${e[3] === 'W' ? 'green' : e[3] === 'L' ? 'red' : 'gold'}`}>{t(e[3])}</span></td>
              <td className="small">{e[1]}{e[7] ? <span className="tag gold" style={{ marginLeft: 6 }}>{t('Title')}</span> : null}</td>
              <td className="small">{t(e[4])} R{e[5]} <span className="tiny dim">{ORG[e[6]].short}</span></td>
              <td className="tiny muted">{fmtDate(e[0], { month: 'short', year: 'numeric' })}</td></tr>
          ))}</tbody>
        </table>
      )}
      {!log.length && <div className="tiny dim" style={{ marginTop: 6 }}>{t('No bouts recorded since this career save began tracking history.')}</div>}
    </div>
  );
}

/** The same fighter page, for yourself: exact ratings (no scouting range), belts and your full fight log. */
function PlayerModal({ onClose }: { onClose: () => void }) {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const cats = categoryRatings(p.attrs);
  const rec = p.isPro ? p.record : p.amateurRecord;
  const belts = Object.values(st.world.orgs).flatMap((o) => (Object.entries(o.champions) as [DivisionId, string | null][]).filter(([, c]) => c === 'player').map(([d]) => ({ org: o.id as OrgId, div: d })));
  const [all, setAll] = useState(false);
  const log = p.history.slice(0, all ? undefined : 12);
  return (
    <Modal title={`${p.firstName} ${p.lastName}`} onClose={onClose} wide>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Portrait ap={p.appearance} size={110} />
        <div className="col grow" style={{ gap: 4, minWidth: 220 }}>
          {p.nickname && <div className="accent" style={{ fontFamily: 'var(--head)', letterSpacing: '0.1em' }}>"{p.nickname.toUpperCase()}"</div>}
          <div className="small">{t('{rec} · {ko} KO/TKO · {sub} SUB · {dec} DEC', { rec: recStr(rec), ko: rec.ko + rec.tko, sub: rec.sub, dec: rec.dec })}{p.isPro ? ' · ' + t('amateur {rec}', { rec: recStr(p.amateurRecord) }) : ''}</div>
          <div className="small muted">{t(p.stance)} · {t(p.nationality)} · {t('age {n}', { n: Math.floor(ageOf(p.bornDay, st.day)) })} · {t('{h} cm / {r} cm reach', { h: p.heightCm, r: p.reachCm })}</div>
          <div className="small muted">{p.isPro ? ORG[p.orgId].name : t('Amateur circuit')} · {t(DIV[p.divisionId].name)} · {t('popularity {n}', { n: Math.round(p.popularity) })}</div>
          <div className="small">{t('Overall:')} <b>{overallRating(p.attrs)}</b></div>
          {p.retired && <div className="small muted">{t('Retired')}</div>}
        </div>
        {belts.length > 0 && <div className="col" style={{ gap: 4, alignItems: 'center' }}>{belts.map((b) => <Belt key={b.org + b.div} org={b.org} width={150} label={t(DIV[b.div].name)} />)}</div>}
      </div>
      <div className="col" style={{ gap: 6, marginTop: 14 }}>
        {CATEGORY_DEFS.map((c) => (
          <div key={c.id} className="row" style={{ gap: 8 }}><span className="small muted" style={{ width: 96 }}>{t(c.name)}</span><div className="grow"><Bar value={cats[c.id]} color={attrColor(cats[c.id])} /></div><span className="num small">{Math.round(cats[c.id])}</span></div>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
        {belts.map((b) => <span key={b.org + b.div} className="tag gold"><Crown size={11} /> {t('{org} {div} champion', { org: ORG[b.org].short, div: t(DIV[b.div].name) })}</span>)}
        {(p.champStatus ?? 0) > 0 && <span className="tag gold">HFC {t(statusName(p.champStatus)).toLowerCase()}</span>}
        {p.titles.length > 0 && <span className="tag gold">{tp('{n} title win', '{n} title wins', p.titles.length)}</span>}
        {p.titleDefenses > 0 && <span className="tag gold">{tp('{n} defense', '{n} defenses', p.titleDefenses)}</span>}
        {p.streak >= 2 && <span className="tag green">{t('{n}-fight win streak', { n: p.streak })}</span>}
        {p.bestStreak >= 3 && <span className="tag">{t('Best streak {n}', { n: p.bestStreak })}</span>}
        {(p.fotn > 0 || p.potn > 0) && <span className="tag">FOTN {p.fotn} · POTN {p.potn}</span>}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>{t('Recent form:')} {p.history.slice(0, 5).map((h) => t(h.result)).reverse().join(' ') || '—'}</p>
      {log.length > 0 ? (
        <table className="tbl" style={{ marginTop: 4 }}>
          <thead><tr><th>{t('Res')}</th><th>{t('Opponent')}</th><th>{t('Method')}</th><th>{t('Date')}</th><th></th></tr></thead>
          <tbody>{log.map((h) => (
            <tr key={h.id}><td><span className={`tag ${h.result === 'W' ? 'green' : h.result === 'L' ? 'red' : 'gold'}`}>{t(h.result)}</span></td>
              <td className="small">{h.opponentName}{h.title ? <span className="tag gold" style={{ marginLeft: 6 }}>{t('Title')}</span> : null}{h.amateur ? <span className="tag" style={{ marginLeft: 6 }}>{t('Am')}</span> : null}</td>
              <td className="small">{t(h.method)} R{h.round} <span className="tiny dim">{ORG[h.orgId].short}</span></td>
              <td className="tiny muted">{fmtDate(h.day, { month: 'short', year: 'numeric' })}</td>
              <td><PosterButton data={posterForHistory(st, h)} /></td></tr>
          ))}</tbody>
        </table>
      ) : <div className="tiny dim" style={{ marginTop: 6 }}>{t('No fights yet.')}</div>}
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {p.history.length > 12 && <button className="chip" onClick={() => setAll(!all)}>{all ? t('Show fewer') : t('Show all {n} fights', { n: p.history.length })}</button>}
        <button className="chip" onClick={() => { onClose(); nav.setTab('fighter'); }}>{t('Open fighter profile')}</button>
        <button className="chip" onClick={() => { onClose(); nav.setTab('history'); }}>{t('Fight history')}</button>
      </div>
    </Modal>
  );
}

export function RankingsTab() {
  const st = useGame();
  const p = st.player;
  const [org, setOrg] = useState<OrgId>(p.orgId);
  const [div, setDiv] = useState<DivisionId>(p.divisionId);
  const [view, setView] = useState<string | null>(null);
  const rows = rankings(st, org, div);
  const hist = st.world.orgs[org].titleHistory.filter((h) => h.div === div).slice(-8).reverse();

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Rankings')}</h1><div className="sub">{t('Points come from wins (worth more against higher-ranked opponents), finishes and titles, and fade with inactivity.')}</div></div></div>
      <div className="row wrap" style={{ gap: 6 }}>{ORGS.map((o) => <button key={o.id} className={`chip ${org === o.id ? 'on' : ''}`} onClick={() => setOrg(o.id)} style={{ borderLeft: `3px solid ${o.color}` }}>{o.short} <span className="dim tiny">T{o.tier}</span></button>)}</div>
      <div className="row wrap" style={{ gap: 6 }}>{DIVISIONS.map((d) => <button key={d.id} className={`chip ${div === d.id ? 'on' : ''}`} onClick={() => setDiv(d.id)}>{t(d.name)}</button>)}</div>
      <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="panel" style={{ gridColumn: 'span 2', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 4px' }}><div className="panel-title"><h3><Trophy size={16} /> {ORG[org].name} — {t(DIV[div].name)}</h3><span className="tiny dim">{t(ORG[org].desc)}</span></div></div>
          <table className="tbl">
            <thead><tr><th style={{ width: 54 }}>{t('Rank')}</th><th>{t('Fighter')}</th><th>{t('Record')}</th><th>{t('Style')}</th><th>{t('Points')}</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`${r.isPlayer ? 'me' : ''} ${r.champion ? 'champ' : ''} click`} onClick={() => setView(r.isPlayer ? 'player' : r.id)}>
                  <td className="num" style={{ fontSize: 16 }}>{r.champion ? <Crown size={16} color="var(--gold)" /> : r.rank}</td>
                  <td><b>{r.name}</b>{r.isPlayer && <span className="tag accent" style={{ marginLeft: 6 }}>{t('YOU')}</span>}{r.champion && <span className="tag gold" style={{ marginLeft: 6 }}>{t('Champion')}</span>}<div className="tiny dim">{t(r.nat)}</div></td>
                  <td className="num">{r.rec}</td>
                  <td className="small muted">{t(r.style)}</td>
                  <td className="num">{r.pts}</td>
                  <td className="tiny">{r.injured ? <span className="red">{t('injured')}</span> : ''}{st.rivalries[r.id] >= 30 ? <span className="red"> {t('rival')}</span> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="col">
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="panel-title"><h3><Crown size={16} /> {t(BELT_INFO[org].name)}</h3></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Belt org={org} width={280} label={t('{div} division', { div: t(DIV[div].name) })} /></div>
            <div className="small" style={{ marginTop: 6 }}>{t('Held by')} <b className={rows.find((r) => r.champion)?.isPlayer ? 'accent' : 'gold'}>{rows.find((r) => r.champion)?.name ?? t('nobody — vacant')}</b></div>
            <div className="tiny dim" style={{ marginTop: 4 }}>{t(BELT_INFO[org].desc)}</div>
          </div>
          <div className="panel">
            <div className="panel-title"><h3><ScrollText size={16} /> {t('Title history')}</h3></div>
            {hist.length ? hist.map((h, i) => <div key={i} className="row between small" style={{ padding: '4px 0' }}><span className={h.champ === 'player' ? 'accent' : ''}>{h.name}</span><span className="muted">{fmtDate(h.day, { month: 'short', year: 'numeric' })}</span></div>) : <div className="small muted">{t('No title changes since your career began.')}</div>}
          </div>
          <div className="panel small muted">
            <b className="gold">{t('How to get a title shot:')}</b> {t('break into the top two of your promotion and put together a win streak. Champions defend every few months; bigger promotions come calling for contenders and champions.')}
          </div>
          {org === 'acl' && (
            <div className="panel small">
              <b className="gold">{t('HFC superfights')}</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }} className="muted">{SUPERFIGHT_RULES.map((r) => <li key={r} style={{ marginBottom: 3 }}>{tx(r)}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
      {view && <FighterModal id={view} onClose={() => setView(null)} />}
    </div>
  );
}
