import { PosterButton, PosterThumb } from '../../components/FightPoster';
import { posterForHistory } from '../../../game/poster';
import { useState } from 'react';
import { History, Award, Medal, Lock, Milestone, Image as ImageIcon } from 'lucide-react';
import { Stat } from '../../components/common';
import { useGame } from '../../../game/store';
import { fmtDate, money } from '../../../game/core';
import { ORG } from '../../../data/world';
import { ACHIEVEMENTS } from '../../../game/achievements';
import { FighterModal } from './RankingsTab';

export function HistoryTab() {
  const st = useGame();
  const p = st.player;
  const r = p.record, am = p.amateurRecord;
  const [view, setView] = useState<string | null>(null);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>Fight History</h1><div className="sub">Every bout of your career, win or lose.</div></div></div>
      <div className="grid4">
        <div className="panel"><Stat v={`${r.w}-${r.l}${r.d ? '-' + r.d : ''}`} l="Professional record" /><div className="tiny muted" style={{ marginTop: 6 }}>Amateur {am.w}-{am.l}{am.d ? '-' + am.d : ''}</div></div>
        <div className="panel"><Stat v={`${r.ko + r.tko} / ${r.sub} / ${r.dec}`} l="Wins: KO-TKO / SUB / DEC" /><div className="tiny muted" style={{ marginTop: 6 }}>Losses: {r.lossKo} (T)KO · {r.lossSub} SUB · {r.lossDec} DEC</div></div>
        <div className="panel"><Stat v={p.titles.length} l="Titles won" cls="gold" /><div className="tiny muted" style={{ marginTop: 6 }}>{p.titleDefenses} defenses · {p.history.filter((h) => h.title).length} title fights</div></div>
        <div className="panel"><Stat v={p.bestStreak} l="Longest win streak" /><div className="tiny muted" style={{ marginTop: 6 }}>FOTN {p.fotn} · POTN {p.potn} · best rank {p.bestRank ? `#${p.bestRank}` : p.titles.length ? 'C' : '—'}</div></div>
      </div>
      <CareerTimeline onOpen={setView} />
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px 0' }}><div className="panel-title"><h3><History size={16} /> Bouts</h3></div></div>
        <table className="tbl">
          <thead><tr><th>Res</th><th>Opponent</th><th>Method</th><th>Rd / Time</th><th>Event</th><th>Date</th><th style={{ textAlign: 'right' }}>Earned</th><th></th></tr></thead>
          <tbody>
            {p.history.map((h) => (
              <tr key={h.id} className="click" onClick={() => setView(h.opponentId)}>
                <td><span className={`tag ${h.result === 'W' ? 'green' : h.result === 'L' ? 'red' : 'gold'}`}>{h.result}</span></td>
                <td><b>{h.opponentName}</b> <span className="tiny dim">{h.opponentRecord}</span>{h.title && <span className="tag gold" style={{ marginLeft: 6 }}>Title</span>}{h.amateur && <span className="tag" style={{ marginLeft: 6 }}>Am</span>}</td>
                <td className="small">{h.method}<div className="tiny dim">{h.notes}</div></td>
                <td className="num">R{h.round} {h.time}</td>
                <td className="small">{h.event}<div className="tiny dim">{ORG[h.orgId].short}{h.bonuses.length ? ' · ' + h.bonuses.join(', ') : ''}</div></td>
                <td className="small muted">{fmtDate(h.day)}</td>
                <td className="num green" style={{ textAlign: 'right' }}>{money(h.earnings)}</td>
                <td><PosterButton data={posterForHistory(st, h)} /></td>
              </tr>
            ))}
            {!p.history.length && <tr><td colSpan={8} className="muted small">No fights yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <PosterWall />
      <div className="panel">
        <div className="panel-title"><h3><Award size={16} /> Achievements ({st.achievements.length}/{ACHIEVEMENTS.length})</h3></div>
        <div className="grid4" style={{ gap: 8 }}>
          {ACHIEVEMENTS.map((a) => {
            const got = st.achievements.find((x) => x.id === a.id);
            return (
              <div key={a.id} className="row" style={{ gap: 10, padding: 10, borderRadius: 8, background: got ? 'var(--goldDim)' : 'var(--bg2)', border: `1px solid ${got ? 'rgba(250,204,21,.35)' : 'var(--line)'}`, opacity: got ? 1 : 0.6 }}>
                {got ? <Medal size={20} color="var(--gold)" /> : <Lock size={18} color="var(--dim)" />}
                <div><div className="small" style={{ fontWeight: 600 }}>{a.name}</div><div className="tiny muted">{a.desc}{got ? ` · ${fmtDate(got.day, { month: 'short', year: 'numeric' })}` : ''}</div></div>
              </div>
            );
          })}
        </div>
      </div>
      {view && <FighterModal id={view} onClose={() => setView(null)} />}
    </div>
  );
}

const TL_FILTERS: [string, string, string[]][] = [['all', 'Everything', []], ['fights', 'Fights & titles', ['fight', 'title']], ['career', 'Career moves', ['start', 'pro', 'contract', 'division', 'retire']], ['other', 'Rivalries, injuries & milestones', ['rival', 'injury', 'achievement', 'record', 'milestone']]];

function CareerTimeline({ onOpen }: { onOpen: (id: string) => void }) {
  const st = useGame();
  const [f, setF] = useState('all');
  const [all, setAll] = useState(false);
  const kinds = TL_FILTERS.find((x) => x[0] === f)![2];
  const items = [...st.timeline].filter((t) => !kinds.length || kinds.includes(t.kind)).reverse();
  return (
    <div className="panel">
      <div className="panel-title"><h3><Milestone size={16} /> Career timeline</h3>
        <div className="row wrap" style={{ gap: 4 }}>{TL_FILTERS.map(([id, l]) => <button key={id} className={`chip ${f === id ? 'on' : ''}`} onClick={() => setF(id)}>{l}</button>)}</div>
      </div>
      <div className="timeline">
        {items.slice(0, all ? undefined : 12).map((t, i) => (
          <div key={i} className={`ev ${t.kind}`}>
            <div className="tiny dim">{fmtDate(t.day, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div className="small">{t.ref && t.ref !== 'player' && st.world.fighters[t.ref] ? <button className="linkish" onClick={() => onOpen(t.ref!)}>{t.text}</button> : t.text}</div>
          </div>
        ))}
        {!items.length && <div className="small muted">Nothing here yet.</div>}
      </div>
      {items.length > 12 && <button className="chip" onClick={() => setAll((x) => !x)}>{all ? 'Show recent only' : `Show all ${items.length}`}</button>}
    </div>
  );
}

/** Every past fight's poster, newest first. */
function PosterWall() {
  const st = useGame();
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'title' | 'pro'>('all');
  const list = st.player.history.filter((h) => filter === 'all' || (filter === 'title' ? h.title : !h.amateur));
  if (!st.player.history.length) return null;
  return (
    <div className="panel">
      <div className="panel-title"><h3><ImageIcon size={16} /> Poster wall</h3>
        <div className="row wrap" style={{ gap: 4 }}>{([['all', 'All fights'], ['pro', 'Professional'], ['title', 'Title fights']] as const).map(([id, l]) => <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{l}</button>)}</div>
      </div>
      <div className="row wrap" style={{ gap: 12 }}>
        {list.slice(0, all ? undefined : 12).map((h) => <PosterThumb key={h.id} data={posterForHistory(st, h)} width={118} label={`${h.result} · ${fmtDate(h.day, { month: 'short', year: 'numeric' })}`} />)}
        {!list.length && <div className="small muted">No fights match.</div>}
      </div>
      {list.length > 12 && <button className="chip" style={{ marginTop: 10 }} onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
    </div>
  );
}
