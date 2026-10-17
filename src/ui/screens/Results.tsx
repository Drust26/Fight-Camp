import { PosterButton } from '../components/FightPoster';
import { posterForHistory } from '../../game/poster';
import { Belt, BELT_INFO } from '../components/Belt';
import { Trophy, TrendingUp, TrendingDown, Wallet, Stethoscope, Sparkles, ThumbsUp, ThumbsDown, Lightbulb } from 'lucide-react';
import { Btn, Portrait, useNav } from '../components/common';
import { useGame } from '../../game/store';
import { ATTR_BY_KEY, type AttrKey } from '../../game/attributes';
import { money } from '../../game/core';
import { INJURIES } from '../../data/training';
import { DIV, ORG } from '../../data/world';
import { statusName } from '../../game/superfight';
import { wfAppearance } from '../../game/fighterGen';
import { Announcement, CardResults, Highlights, Interview, RoundBreakdown } from './ResultsExtras';

const METHOD_NAME: Record<string, string> = { KO: 'Knockout', TKO: 'Technical Knockout', SUB: 'Submission', UD: 'Unanimous Decision', SD: 'Split Decision', MD: 'Majority Decision', DRAW: 'Draw', DQ: 'Disqualification' };

export function Results() {
  const st = useGame();
  const nav = useNav();
  const r = st.lastResult;
  if (!r) return <div style={{ padding: 40 }}><Btn onClick={() => nav.go('hub')}>Back to camp</Btn></div>;
  const p = st.player;
  const opp = st.world.fighters[r.opponentId];
  const rounds = [...new Set(r.roundScores.map((x) => x.round))];
  const S = r.stats;
  const lines: [string, string | number, string | number][] = [
    ['Significant strikes', `${S.player.sigLanded}/${S.player.sigThrown}`, `${S.opp.sigLanded}/${S.opp.sigThrown}`],
    ['Head', S.player.headLanded, S.opp.headLanded],
    ['Body', S.player.bodyLanded, S.opp.bodyLanded],
    ['Legs', S.player.legLanded, S.opp.legLanded],
    ['Knockdowns', S.player.knockdowns, S.opp.knockdowns],
    ['Takedowns', `${S.player.tdLanded}/${S.player.tdAttempts}`, `${S.opp.tdLanded}/${S.opp.tdAttempts}`],
    ['Submission attempts', S.player.subAttempts, S.opp.subAttempts],
    ['Control time', `${S.player.controlSec}s`, `${S.opp.controlSec}s`],
    ['Reversals', S.player.reversals, S.opp.reversals],
    ['Damage dealt', S.player.damageDealt, S.opp.damageDealt],
  ];
  const rankDelta = r.rankBefore !== null && r.rankAfter !== null ? r.rankBefore - r.rankAfter : 0;
  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', background: r.playerWon ? 'radial-gradient(70% 50% at 50% 0%, rgba(250,204,21,.16), transparent 60%), var(--bg)' : 'radial-gradient(70% 50% at 50% 0%, rgba(96,165,250,.10), transparent 60%), var(--bg)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 26px 50px' }}>
        <div style={{ textAlign: 'center' }}>
          {r.wonTitle && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Belt org={r.orgId} width={300} label={BELT_INFO[r.orgId].name} /></div>}
          {r.title && r.playerWon && !r.wonTitle && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Belt org={r.orgId} width={220} label="Title retained" /></div>}
          {r.wonTitle && !r.superfight && <div className="tag gold" style={{ fontSize: 14, padding: '6px 14px' }}><Trophy size={16} /> AND NEW {ORG[r.orgId].short} CHAMPION!</div>}
          {r.wonTitle && r.superfight && <div className="tag gold" style={{ fontSize: 14, padding: '6px 14px' }}><Trophy size={16} /> {ORG[r.orgId].short} {statusName(p.champStatus).toUpperCase()}! Choose which belt to keep when you return to camp.</div>}
          {r.superfight && !r.playerWon && <div className="tag" style={{ fontSize: 13 }}>Superfight lost — you return to {DIV[p.divisionId].name} as champion.</div>}
          {r.lostTitle && <div className="tag red" style={{ fontSize: 13 }}>Title lost</div>}
          <div className={`result-banner ${r.playerWon ? 'win' : 'loss'}`} style={{ marginTop: 10 }}>{r.playerWon ? 'Victory' : r.draw ? 'Draw' : 'Defeat'}</div>
          <div style={{ fontSize: 18, marginTop: 8 }}>{METHOD_NAME[r.method] ?? r.method} · Round {r.round} · {r.time}</div>
          <div className="muted">{r.eventName} · vs {r.opponentName} · record now <b className="num">{r.recordAfter}</b>{r.amateur ? ' (amateur)' : ''}</div>
        </div>

        <Announcement r={r} />
        <div style={{ marginTop: 16 }}><Interview st={st} r={r} /></div>

        <div className="grid3" style={{ marginTop: 16, alignItems: 'start' }}>
          <div className="panel" style={{ gridColumn: 'span 2' }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="row"><Portrait ap={p.appearance} size={56} /><b>{p.lastName}</b></div>
              <h3>Fight stats</h3>
              <div className="row"><b>{opp?.last ?? 'Opponent'}</b>{opp && <Portrait ap={wfAppearance(opp)} size={56} accent="#60a5fa" mirror />}</div>
            </div>
            {lines.map(([l, a, b]) => <div key={l} className="statline"><span className="a">{a}</span><span className="l">{l}</span><span className="b">{b}</span></div>)}
            {rounds.length > 0 && (
              <>
                <h4 style={{ marginTop: 16 }}>Scorecards</h4>
                <table className="tbl">
                  <thead><tr><th>Judge</th>{rounds.map((x) => <th key={x}>R{x}</th>)}<th>Total</th></tr></thead>
                  <tbody>{[0, 1, 2].map((j) => (
                    <tr key={j}><td className="small">Judge {['Ortiz', 'Lindgren', 'Abara'][j]}</td>
                      {rounds.map((x) => { const sc = r.roundScores.find((y) => y.judge === j && y.round === x)!; return <td key={x} className="num"><span className={sc.p > sc.o ? 'accent' : sc.p < sc.o ? 'blue' : ''}>{sc.p}-{sc.o}</span></td>; })}
                      <td className="num"><b>{r.scorecards[j]?.[0]}-{r.scorecards[j]?.[1]}</b></td></tr>
                  ))}</tbody>
                </table>
                {!['UD', 'SD', 'MD', 'DRAW'].includes(r.method) && <div className="tiny dim">Cards at the time of the stoppage.</div>}
              </>
            )}
          </div>
          <div className="col">
            <div className="panel">
              <div className="panel-title"><h3><Wallet size={16} /> Earnings</h3></div>
              <div className="row between small"><span>{r.amateur ? 'Travel stipend' : 'Show money'}</span><span className="green">+{money(r.purse)}</span></div>
              {r.winBonus > 0 && <div className="row between small"><span>Win bonus</span><span className="green">+{money(r.winBonus)}</span></div>}
              {r.bonuses.map((b) => <div key={b.label} className="row between small"><span className="gold">{b.label}</span><span className="green">+{money(b.amount)}</span></div>)}
              {r.fines.map((b) => <div key={b.label} className="row between small"><span>{b.label}</span><span className="red">−{money(b.amount)}</span></div>)}
              <div className="row between" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)' }}><b>Total</b><b className="green">{money(r.totalEarned)}</b></div>
            </div>
            <div className="panel">
              <div className="panel-title"><h3>{rankDelta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} Standing</h3></div>
              {!r.amateur && <div className="row between small"><span>Ranking</span><span>{r.rankBefore ?? '—'} → <b>{p.isChampion ? 'Champion' : r.rankAfter ?? '—'}</b> {rankDelta > 0 && <span className="green">▲{rankDelta}</span>}{rankDelta < 0 && <span className="red">▼{-rankDelta}</span>}</span></div>}
              <div className="row between small"><span>Popularity</span><span className={r.popularityDelta >= 0 ? 'green' : 'red'}>{r.popularityDelta >= 0 ? '+' : ''}{r.popularityDelta}</span></div>
              <div className="row between small"><span>Reputation</span><span className={r.reputationDelta >= 0 ? 'green' : 'red'}>{r.reputationDelta >= 0 ? '+' : ''}{r.reputationDelta}</span></div>
            </div>
            <div className="panel">
              <div className="panel-title"><h3><Sparkles size={16} /> What you learned</h3></div>
              {Object.entries(r.xpGains).filter(([, v]) => Math.abs(v ?? 0) >= 0.05).map(([k, v]) => <div key={k} className="row between small"><span>{ATTR_BY_KEY[k as AttrKey].name}</span><span className={(v ?? 0) >= 0 ? 'green' : 'red'}>{(v ?? 0) >= 0 ? '+' : ''}{(v ?? 0).toFixed(1)}</span></div>)}
              <div className="tiny dim" style={{ marginTop: 6 }}>Fights teach experience and specific lessons; skills still grow mainly through training.</div>
            </div>
            <div className="panel">
              <div className="panel-title"><h3><Stethoscope size={16} /> Medical</h3></div>
              {r.injuries.length ? r.injuries.map((i, k) => <div key={k} className="small red">{INJURIES[i].name}</div>) : <div className="small green">No significant injuries.</div>}
              {p.medicalSuspensionUntil > st.day && <div className="small muted">Medical suspension: {p.medicalSuspensionUntil - st.day} days.</div>}
            </div>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 16, alignItems: 'start' }}>
          <RoundBreakdown r={r} />
          <Highlights st={st} r={r} />
        </div>
        {r.cardResults && <div style={{ marginTop: 16 }}><CardResults st={st} r={r} /></div>}
        <div className="grid3" style={{ marginTop: 16 }}>
          <div className="panel"><div className="panel-title"><h3><ThumbsUp size={16} /> What went well</h3></div>{r.feedback.good.map((x, i) => <div key={i} className="small" style={{ marginBottom: 4 }}>• {x}</div>)}</div>
          <div className="panel"><div className="panel-title"><h3><ThumbsDown size={16} /> What went wrong</h3></div>{r.feedback.bad.length ? r.feedback.bad.map((x, i) => <div key={i} className="small" style={{ marginBottom: 4 }}>• {x}</div>) : <div className="small muted">Nothing major.</div>}</div>
          <div className="panel"><div className="panel-title"><h3><Lightbulb size={16} /> Coach's notes</h3></div>{r.feedback.tips.map((x, i) => <div key={i} className="small" style={{ marginBottom: 4 }}>• {x}</div>)}</div>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 24, gap: 10 }}>
          {(() => { const h = st.player.history.find((x) => x.id === r.id); return h ? <PosterButton data={posterForHistory(st, h)} label="Fight poster" /> : null; })()}
          <Btn variant="primary" size="lg" onClick={() => { nav.setTab('overview'); nav.go('hub'); }}>Back to camp</Btn>
        </div>
      </div>
    </div>
  );
}
