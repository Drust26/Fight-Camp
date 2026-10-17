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
import { t, tp, tx } from '../../../i18n';

export function HistoryTab() {
  const st = useGame();
  const p = st.player;
  const r = p.record, am = p.amateurRecord;
  const [view, setView] = useState<string | null>(null);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Fight History')}</h1><div className="sub">{t('Every bout of your career, win or lose.')}</div></div></div>
      <div className="grid4">
        <div className="panel"><Stat v={`${r.w}-${r.l}${r.d ? '-' + r.d : ''}`} l={t('Professional record')} /><div className="tiny muted" style={{ marginTop: 6 }}>{t('Amateur')} {am.w}-{am.l}{am.d ? '-' + am.d : ''}</div></div>
        <div className="panel"><Stat v={`${r.ko + r.tko} / ${r.sub} / ${r.dec}`} l={t('Wins: KO-TKO / SUB / DEC')} /><div className="tiny muted" style={{ marginTop: 6 }}>{t('Losses: {ko} (T)KO · {sub} SUB · {dec} DEC', { ko: r.lossKo, sub: r.lossSub, dec: r.lossDec })}</div></div>
        <div className="panel"><Stat v={p.titles.length} l={t('Titles won')} cls="gold" /><div className="tiny muted" style={{ marginTop: 6 }}>{tp('{n} defense', '{n} defenses', p.titleDefenses)} · {tp('{n} title fight', '{n} title fights', p.history.filter((h) => h.title).length)}</div></div>
        <div className="panel"><Stat v={p.bestStreak} l={t('Longest win streak')} /><div className="tiny muted" style={{ marginTop: 6 }}>FOTN {p.fotn} · POTN {p.potn} · {t('best rank')} {p.bestRank ? `#${p.bestRank}` : p.titles.length ? 'C' : '—'}</div></div>
      </div>
      <CareerTimeline onOpen={setView} />
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px 0' }}><div className="panel-title"><h3><History size={16} /> {t('Bouts')}</h3></div></div>
        <table className="tbl">
          <thead><tr><th>{t('Res')}</th><th>{t('Opponent')}</th><th>{t('Method')}</th><th>{t('Rd / Time')}</th><th>{t('Event')}</th><th>{t('Date')}</th><th style={{ textAlign: 'right' }}>{t('Earned')}</th><th></th></tr></thead>
          <tbody>
            {p.history.map((h) => (
              <tr key={h.id} className="click" onClick={() => setView(h.opponentId)}>
                <td><span className={`tag ${h.result === 'W' ? 'green' : h.result === 'L' ? 'red' : 'gold'}`}>{t(h.result)}</span></td>
                <td><b>{h.opponentName}</b> <span className="tiny dim">{h.opponentRecord}</span>{h.title && <span className="tag gold" style={{ marginLeft: 6 }}>{t('Title')}</span>}{h.amateur && <span className="tag" style={{ marginLeft: 6 }}>{t('Am')}</span>}</td>
                <td className="small">{t(h.method)}<div className="tiny dim">{h.notes ? tx(h.notes) : ''}</div></td>
                <td className="num">R{h.round} {h.time}</td>
                <td className="small">{tx(h.event)}<div className="tiny dim">{ORG[h.orgId].short}{h.bonuses.length ? ' · ' + h.bonuses.map((b) => tx(b)).join(', ') : ''}</div></td>
                <td className="small muted">{fmtDate(h.day)}</td>
                <td className="num green" style={{ textAlign: 'right' }}>{money(h.earnings)}</td>
                <td><PosterButton data={posterForHistory(st, h)} /></td>
              </tr>
            ))}
            {!p.history.length && <tr><td colSpan={8} className="muted small">{t('No fights yet.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <PosterWall />
      <div className="panel">
        <div className="panel-title"><h3><Award size={16} /> {t('Achievements')} ({st.achievements.length}/{ACHIEVEMENTS.length})</h3></div>
        <div className="grid4" style={{ gap: 8 }}>
          {ACHIEVEMENTS.map((a) => {
            const got = st.achievements.find((x) => x.id === a.id);
            return (
              <div key={a.id} className="row" style={{ gap: 10, padding: 10, borderRadius: 8, background: got ? 'var(--goldDim)' : 'var(--bg2)', border: `1px solid ${got ? 'rgba(250,204,21,.35)' : 'var(--line)'}`, opacity: got ? 1 : 0.6 }}>
                {got ? <Medal size={20} color="var(--gold)" /> : <Lock size={18} color="var(--dim)" />}
                <div><div className="small" style={{ fontWeight: 600 }}>{t(a.name)}</div><div className="tiny muted">{t(a.desc)}{got ? ` · ${fmtDate(got.day, { month: 'short', year: 'numeric' })}` : ''}</div></div>
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
  const items = [...st.timeline].filter((ev) => !kinds.length || kinds.includes(ev.kind)).reverse();
  return (
    <div className="panel">
      <div className="panel-title"><h3><Milestone size={16} /> {t('Career timeline')}</h3>
        <div className="row wrap" style={{ gap: 4 }}>{TL_FILTERS.map(([id, l]) => <button key={id} className={`chip ${f === id ? 'on' : ''}`} onClick={() => setF(id)}>{t(l)}</button>)}</div>
      </div>
      <div className="timeline">
        {items.slice(0, all ? undefined : 12).map((ev, i) => (
          <div key={i} className={`ev ${ev.kind}`}>
            <div className="tiny dim">{fmtDate(ev.day, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div className="small">{ev.ref && ev.ref !== 'player' && st.world.fighters[ev.ref] ? <button className="linkish" onClick={() => onOpen(ev.ref!)}>{tx(ev.text)}</button> : tx(ev.text)}</div>
          </div>
        ))}
        {!items.length && <div className="small muted">{t('Nothing here yet.')}</div>}
      </div>
      {items.length > 12 && <button className="chip" onClick={() => setAll((x) => !x)}>{all ? t('Show recent only') : t('Show all {n}', { n: items.length })}</button>}
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
      <div className="panel-title"><h3><ImageIcon size={16} /> {t('Poster wall')}</h3>
        <div className="row wrap" style={{ gap: 4 }}>{([['all', 'All fights'], ['pro', 'Professional'], ['title', 'Title fights']] as const).map(([id, l]) => <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{t(l)}</button>)}</div>
      </div>
      <div className="row wrap" style={{ gap: 12 }}>
        {list.slice(0, all ? undefined : 12).map((h) => <PosterThumb key={h.id} data={posterForHistory(st, h)} width={118} label={`${t(h.result)} · ${fmtDate(h.day, { month: 'short', year: 'numeric' })}`} />)}
        {!list.length && <div className="small muted">{t('No fights match.')}</div>}
      </div>
      {list.length > 12 && <button className="chip" style={{ marginTop: 10 }} onClick={() => setAll(!all)}>{all ? t('Show fewer') : t('Show all {n}', { n: list.length })}</button>}
    </div>
  );
}
