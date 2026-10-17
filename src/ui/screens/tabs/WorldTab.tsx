import { Belt } from '../../components/Belt';
// The living world: league-wide news, pound-for-pound list, records book, current reigns and Hall of Fame.
// Everything shown here is read from the simulation's stored history — nothing is generated for display.
import { Fragment, useMemo, useState } from 'react';
import { Newspaper, Crown, BookOpen, Landmark, Medal, Info } from 'lucide-react';
import { NationBadge } from '../../components/common';
import { useGame } from '../../../game/store';
import { currentReigns, p4p, legacyBreakdown } from '../../../game/history';
import { fmtDate } from '../../../game/core';
import { DIV, DIVISIONS, ORG, ORGS } from '../../../data/world';
import { FighterModal } from './RankingsTab';
import type { NewsItem, RecordsBook, RecordEntry } from '../../../game/types';

type View = 'news' | 'p4p' | 'records' | 'hall';
const KIND_NAME: Record<NewsItem['kind'], string> = {
  title: 'Title change', defense: 'Title defense', upset: 'Upset', retire: 'Retirement', prospect: 'Prospect', streak: 'Streak', signing: 'Signing',
  injury: 'Injury', event: 'Event recap', record: 'Record', player: 'You', result: 'Result', move: 'Weight-class move', superfight: 'Superfight',
};
const RECORD_NAME: Record<keyof RecordsBook, string> = {
  mostWins: 'Most career wins', mostFinishes: 'Most finishes', mostDefenses: 'Most title defenses', longestReign: 'Longest completed title reign',
  longestStreak: 'Longest win streak', biggestUpset: 'Biggest upset (rating gap)', oldestChamp: 'Oldest to win a title', youngestChamp: 'Youngest to win a title', mostTitleWins: 'Most championship wins',
};

export function WorldTab() {
  const st = useGame();
  const [view, setView] = useState<View>('news');
  const [fighter, setFighter] = useState<string | null>(null);
  const open = (id: string | undefined) => { if (id && (id === 'player' || st.world.fighters[id])) setFighter(id); };
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>World</h1><div className="sub">What is happening across every promotion — built from real simulated results.</div></div></div>
      <div className="row wrap" style={{ gap: 6 }}>
        {([['news', 'News feed', Newspaper], ['p4p', 'Pound-for-pound', Medal], ['records', 'Records & reigns', BookOpen], ['hall', 'Hall of Fame', Landmark]] as const).map(([id, l, I]) => (
          <button key={id} className={`chip ${view === id ? 'on' : ''}`} onClick={() => setView(id)}><I size={13} style={{ verticalAlign: -2 }} /> {l}</button>
        ))}
      </div>
      {view === 'news' && <News open={open} />}
      {view === 'p4p' && <P4P open={open} />}
      {view === 'records' && <Records open={open} />}
      {view === 'hall' && <Hall open={open} />}
      {fighter && <FighterModal id={fighter} onClose={() => setFighter(null)} />}
    </div>
  );
}

function News({ open }: { open: (id?: string) => void }) {
  const st = useGame();
  const [org, setOrg] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  const [mine, setMine] = useState(false);
  const [headlines, setHeadlines] = useState(false);
  const [limit, setLimit] = useState(40);
  const items = useMemo(() => st.world.news.filter((n) =>
    (org === 'all' || n.org === org) && (kind === 'all' || n.kind === kind) && (!mine || n.div === st.player.divisionId || n.refs.includes('player')) && (!headlines || n.imp >= 2),
  ), [st.world.news, org, kind, mine, headlines, st.player.divisionId]);
  return (
    <div className="panel">
      <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
        <select className="input" style={{ width: 'auto' }} value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Promotion"><option value="all">All promotions</option>{ORGS.map((o) => <option key={o.id} value={o.id}>{o.short}</option>)}</select>
        <select className="input" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Story type"><option value="all">All stories</option>{Object.entries(KIND_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="row small"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My division</label>
        <label className="row small"><input type="checkbox" checked={headlines} onChange={(e) => setHeadlines(e.target.checked)} /> Headlines only</label>
        <span className="tiny dim" style={{ marginLeft: 'auto' }}>{items.length} stories</span>
      </div>
      <div className="col" style={{ gap: 6 }}>
        {items.slice(0, limit).map((n) => {
          const ref = n.refs.find((r) => r !== 'player' && st.world.fighters[r]) ?? (n.refs.includes('player') ? 'player' : undefined);
          return (
            <button key={n.id} className="news-item" onClick={() => open(ref)} disabled={!ref} style={{ cursor: ref ? 'pointer' : 'default' }}>
              <div className="row between">
                <span className="row" style={{ gap: 6 }}>
                  <span className={`tag ${n.imp >= 3 ? 'gold' : n.kind === 'player' ? 'accent' : ''}`}>{KIND_NAME[n.kind]}</span>
                  {n.org && <span className="tiny" style={{ color: ORG[n.org].color, fontWeight: 700 }}>{ORG[n.org].short}</span>}
                  {n.div && <span className="tiny dim">{DIV[n.div].name}</span>}
                </span>
                <span className="tiny dim">{fmtDate(n.day)}</span>
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{n.title}</div>
              <div className="small muted">{n.body}</div>
            </button>
          );
        })}
        {!items.length && <div className="muted small">No stories match. The world produces news as time passes.</div>}
        {items.length > limit && <button className="chip" onClick={() => setLimit((l) => l + 40)}>Show more</button>}
      </div>
    </div>
  );
}

function P4P({ open }: { open: (id?: string) => void }) {
  const st = useGame();
  const rows = useMemo(() => p4p(st, 15), [st.day, st.world.history.length]);
  const [why, setWhy] = useState<string | null>(null);
  return (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px 0' }} className="panel-title"><h3><Medal size={16} /> Pound-for-pound top 15</h3><span className="tiny dim">Ranking points weighted by promotion level, belts, defenses, streaks, recent losses and activity.</span></div>
      <table className="tbl">
        <thead><tr><th>#</th><th>Fighter</th><th>Division</th><th>Record</th><th>Score</th><th></th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <Fragment key={r.id}>
            <tr className={r.id === 'player' ? 'me click' : 'click'} onClick={() => open(r.id)}>
              <td className="num">{i + 1}</td>
              <td><b>{r.name}</b> {r.champion && <Crown size={12} className="gold" style={{ verticalAlign: -1 }} />}</td>
              <td className="small">{DIV[r.div].name} <span className="tiny" style={{ color: ORG[r.org].color }}>{ORG[r.org].short}</span></td>
              <td className="num">{r.rec}</td>
              <td className="num">{r.score}</td>
              <td><button className="chip" onClick={(e) => { e.stopPropagation(); setWhy(why === r.id ? null : r.id); }} aria-label="Why this ranking"><Info size={12} /> Why</button></td>
            </tr>
            {why === r.id && <tr><td /><td colSpan={5} className="tiny muted">{r.why.join(' · ')}</td></tr>}
          </Fragment>
        ))}</tbody>
      </table>
    </div>
  );
}

function Records({ open }: { open: (id?: string) => void }) {
  const st = useGame();
  const reigns = useMemo(() => currentReigns(st), [st.day, st.world.history.length]);
  const rec = st.world.records;
  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div className="panel">
        <div className="panel-title"><h3><BookOpen size={16} /> Records book</h3><span className="tiny dim">Since this world began</span></div>
        {(Object.keys(RECORD_NAME) as (keyof RecordsBook)[]).map((k) => {
          const e = rec[k] as RecordEntry | undefined;
          return (
            <div key={k} className="row between" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="small muted">{RECORD_NAME[k]}</span>
              {e ? <button className="linkish small" onClick={() => open(e.id)} style={{ textAlign: 'right' }}><b>{e.name}</b> — {e.detail}<div className="tiny dim">{fmtDate(e.day, { month: 'short', year: 'numeric' })}</div></button> : <span className="tiny dim">Not yet set</span>}
            </div>
          );
        })}
      </div>
      <div className="panel">
        <div className="panel-title"><h3><Crown size={16} /> Current champions</h3><span className="tiny dim">Longest reigns first</span></div>
        {reigns.map((r) => (
          <div key={r.org + r.div} className="row between click" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => open(r.id)}>
            <span className="small row" style={{ gap: 8 }}><Belt org={r.org} width={56} /><b className={r.id === 'player' ? 'accent' : ''}>{r.name}</b> <span className="tiny dim">{ORG[r.org].short} {DIV[r.div].name}</span></span>
            <span className="tiny">{r.days >= 60 ? `${Math.round(r.days / 30)} months` : `${r.days} days`} · {r.defenses} def.</span>
          </div>
        ))}
        {!reigns.length && <div className="small muted">Reign lengths are tracked for titles won after history tracking began.</div>}
        <div className="tiny dim" style={{ marginTop: 8 }}>Divisions: {DIVISIONS.length} · Promotions: {ORGS.length}</div>
      </div>
    </div>
  );
}

function Hall({ open }: { open: (id?: string) => void }) {
  const st = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const hall = st.world.hall;
  return (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px 0' }} className="panel-title"><h3><Landmark size={16} /> Hall of Fame</h3><span className="tiny dim">Retired fighters with a belt, 16+ wins or an 8-fight streak. Ranked by legacy.</span></div>
      <table className="tbl">
        <thead><tr><th>Legacy</th><th>Fighter</th><th>Record</th><th>Titles</th><th>Retired</th></tr></thead>
        <tbody>{hall.map((h) => {
          const lg = legacyBreakdown({ w: +h.rec.split('-')[0], l: +h.rec.split('-')[1], finishes: h.finishes, titles: h.titles, defenses: h.defenses, bestStreak: h.bestStreak, tierBonus: (ORG[h.org].tier - 1) * 3 });
          return (
            <Fragment key={h.id}>
              <tr className={h.isPlayer ? 'me' : 'click'} onClick={() => setSel(sel === h.id ? null : h.id)}>
                <td className="num"><b>{h.legacy}</b></td>
                <td><b>{h.name}</b> <NationBadge nation={h.nat} size={11} /> <span className="tiny dim">{DIV[h.div].name}</span></td>
                <td className="num">{h.rec}</td>
                <td className="small">{h.titles ? `${h.titles} (${h.defenses} def.)` : '—'}</td>
                <td className="tiny muted">{fmtDate(h.retiredDay, { month: 'short', year: 'numeric' })}</td>
              </tr>
              {sel === h.id && (
                <tr><td /><td colSpan={4}>
                  <div className="row wrap" style={{ gap: 10 }}>{(h.isPlayer ? [] : lg.factors).map((x) => <span key={x.label} className="tiny">{x.label}: <b className={x.value >= 0 ? 'green' : 'red'}>{x.value >= 0 ? '+' : ''}{x.value}</b></span>)}</div>
                  {h.isPlayer && <div className="tiny muted">Your legacy uses the full career formula shown on the retirement screen.</div>}
                  {(h.isPlayer || st.world.fighters[h.id]) && <button className="chip" style={{ marginTop: 6 }} onClick={() => open(h.isPlayer ? 'player' : h.id)}>Open profile</button>}
                </td></tr>
              )}
            </Fragment>
          );
        })}</tbody>
      </table>
      {!hall.length && <div className="small muted" style={{ padding: 16 }}>No inductees yet. Notable fighters enter when they retire — advance time to see the sport's history build up.</div>}
    </div>
  );
}
