import { PosterButton } from '../components/FightPoster';
import { posterForScheduled } from '../../game/poster';
import { useState } from 'react';
import { ArrowLeft, Swords, Crosshair, HeartPulse, Scale, Brain, Trophy, Eye } from 'lucide-react';
import { Bar, Btn, Portrait, OvrBadge, useNav, attrColor } from '../components/common';
import { store, useGame } from '../../game/store';
import { opponentReport, playerFightAttrs, playerOvr, scoutLevel, scoutRange, weightCutInfo } from '../../game/fights';
import { CATEGORY_DEFS, categoryRatings, overallRating, ATTR_BY_KEY, type AttrKey } from '../../game/attributes';
import { fighterName, recStr, wfAppearance } from '../../game/fighterGen';
import { DIV, GAME_PLANS, ORG, STYLE } from '../../data/world';
import { ageOf, fmtDate, money } from '../../game/core';
import { rankings } from '../../game/world';
import { difficultyLabel } from './tabs/OffersTab';
import type { GamePlanId } from '../../game/types';

export function FightPrep() {
  const st = useGame();
  const nav = useNav();
  const sc = st.scheduled;
  const [plan, setPlan] = useState<GamePlanId>(sc?.gamePlan ?? 'balanced');
  if (!sc) {
    return <div style={{ padding: 40 }}><div className="empty">No fight booked. <Btn onClick={() => nav.go('hub')}>Back to camp</Btn></div></div>;
  }
  const p = st.player;
  const opp = st.world.fighters[sc.opponentId];
  const rep = opponentReport(st, opp.id);
  const sl = scoutLevel(st);
  const rng = scoutRange(sl);
  const fa = playerFightAttrs(st);
  const myCats = categoryRatings(fa.attrs);
  const opCats = categoryRatings(rep.attrs);
  const oOvr = overallRating(rep.attrs);
  const wc = weightCutInfo(st);
  const fightNight = sc.day <= st.day;
  const rows = sc.amateur ? [] : rankings(st, sc.orgId, sc.div ?? p.divisionId);
  const myRank = rows.find((r) => r.isPlayer);
  const oRank = rows.find((r) => r.id === opp.id);
  const diff = difficultyLabel(oOvr - playerOvr(st));

  const walkOut = () => {
    store.act((g) => { if (g.scheduled) g.scheduled.gamePlan = plan; if (g.fightInProgress?.offerId !== sc.id) g.fightInProgress = { offerId: sc.id, round: 1 }; });
    store.saveNow();
    nav.go('fightnight');
  };
  const tape: [string, string, string][] = [
    ['Record', recStr(p.isPro ? p.record : p.amateurRecord), recStr(opp.rec)],
    ['Age', `${Math.floor(ageOf(p.bornDay, st.day))}`, `${Math.floor(ageOf(opp.bornDay, st.day))}`],
    ['Height', `${p.heightCm} cm`, `${opp.h} cm`],
    ['Reach', `${p.reachCm} cm`, `${opp.r} cm`],
    ['Stance', p.stance, opp.stance],
    ['Ranking', myRank ? (myRank.champion ? 'Champion' : `#${myRank.rank}`) : '—', oRank ? (oRank.champion ? 'Champion' : `#${oRank.rank}`) : '—'],
    ['Style', 'You', STYLE[opp.style].name],
  ];

  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', background: 'radial-gradient(80% 60% at 50% 0%, rgba(255,90,54,.12), transparent 60%), var(--bg)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 26px 40px' }}>
        <div className="row between">
          <Btn variant="ghost" onClick={() => nav.go('hub')}><ArrowLeft size={16} /> Back to camp</Btn>
          <div className="row wrap" style={{ gap: 6 }}>
            {sc.title && <span className="tag gold"><Trophy size={12} /> {ORG[sc.orgId].short} {DIV[sc.div ?? p.divisionId].name} Championship</span>}
            {sc.superfight && <span className="tag accent">SUPERFIGHT · {DIV[sc.div!].name} ({DIV[sc.div!].lb} lb)</span>}
            {sc.invader && <span className="tag accent">CHAMPION VS CHAMPION · {DIV[sc.invader].name} champion</span>}
            <span className="tag">{sc.eventName}</span>
            <span className="tag">{fmtDate(sc.day)}</span>
            <span className="tag">{sc.rounds} × 5:00</span>
            <span className={`tag ${diff.c}`}>{diff.t}</span>
            <PosterButton data={posterForScheduled(st, sc)} label="Fight poster" />
          </div>
        </div>

        <div className="panel hero cut" style={{ marginTop: 16, padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'center' }}>
            <div className="row" style={{ gap: 16 }}>
              <Portrait ap={p.appearance} size={130} />
              <div>
                <div className="tiny accent" style={{ letterSpacing: '0.2em', fontWeight: 700 }}>RED CORNER</div>
                <h1 style={{ fontSize: 30 }}>{p.firstName} {p.lastName}</h1>
                <div className="row" style={{ gap: 10, marginTop: 6 }}><OvrBadge v={overallRating(fa.attrs)} size={44} /><span className="small muted">Fight-night rating<br />(after condition)</span></div>
              </div>
            </div>
            <div className="vs" style={{ fontSize: 56 }}>VS</div>
            <div className="row" style={{ gap: 16, justifyContent: 'flex-end', textAlign: 'right' }}>
              <div>
                <div className="tiny blue" style={{ letterSpacing: '0.2em', fontWeight: 700 }}>BLUE CORNER</div>
                <h1 style={{ fontSize: 30 }}>{fighterName(opp)}</h1>
                {opp.nick && <div className="muted" style={{ fontFamily: 'var(--head)', letterSpacing: '0.1em' }}>"{opp.nick.toUpperCase()}"</div>}
                <div className="small muted">Scouted overall {Math.max(1, oOvr - rng)}–{Math.min(99, oOvr + rng)}</div>
              </div>
              <Portrait ap={wfAppearance(opp)} size={130} accent="#60a5fa" mirror />
            </div>
          </div>
          <table className="tbl" style={{ marginTop: 16 }}>
            <tbody>{tape.map(([l, a, b]) => <tr key={l}><td className="num" style={{ width: '40%', fontSize: 16 }}>{a}</td><td className="tiny dim" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</td><td className="num" style={{ width: '40%', textAlign: 'right', fontSize: 16 }}>{b}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="grid3" style={{ marginTop: 16, alignItems: 'start' }}>
          <div className="panel">
            <div className="panel-title"><h3><Eye size={16} /> Skill comparison</h3><span className="tiny dim">Scouting {sl}% (±{rng})</span></div>
            {CATEGORY_DEFS.map((c) => (
              <div key={c.id} style={{ marginBottom: 8 }}>
                <div className="row between tiny"><span className="accent num" style={{ fontSize: 14 }}>{Math.round(myCats[c.id])}</span><span className="muted">{c.name.toUpperCase()}</span><span className="blue num" style={{ fontSize: 14 }}>~{Math.round(opCats[c.id] / rng) * rng || Math.round(opCats[c.id])}</span></div>
                <div className="row" style={{ gap: 4 }}>
                  <div className="grow" style={{ transform: 'scaleX(-1)' }}><Bar value={myCats[c.id]} color="var(--accent)" /></div>
                  <div className="grow"><Bar value={opCats[c.id]} color="var(--blue)" /></div>
                </div>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-title"><h3><Crosshair size={16} /> Scouting report</h3></div>
            <div className="col small" style={{ gap: 6 }}>{rep.lines.map((l, i) => <div key={i}>• {l}</div>)}</div>
            {sl >= 40 ? (
              <div className="grid2" style={{ marginTop: 10 }}>
                <div><h4>Strengths</h4>{rep.strengths.map((k) => <div key={k} className="small green">{ATTR_BY_KEY[k as AttrKey].name}</div>)}</div>
                <div><h4>Weaknesses</h4>{rep.weaknesses.map((k) => <div key={k} className="small red">{ATTR_BY_KEY[k as AttrKey].name}</div>)}</div>
              </div>
            ) : <div className="small muted" style={{ marginTop: 10 }}>Detailed strengths and weaknesses need better scouting: hire a tactics coach, train at a gym with good partners, or do Film Study / Opponent-Specific Camp.</div>}
          </div>
          <div className="panel">
            <div className="panel-title"><h3><HeartPulse size={16} /> Your condition</h3></div>
            <div className="col small" style={{ gap: 5 }}>
              {fa.notes.map((n, i) => <div key={i} className={/Injured|Fatigued|drained|Lacking/.test(n) ? 'red' : /\+/.test(n) ? 'green' : ''}>• {n}</div>)}
            </div>
            <div className="row between small" style={{ marginTop: 10 }}><span><Scale size={13} style={{ verticalAlign: -2 }} /> Weight</span>
              {sc.weighIn ? <b className={sc.weighIn.madeWeight ? 'green' : 'red'}>{sc.weighIn.madeWeight ? `Made weight (${sc.weighIn.weightKg.toFixed(1)} kg)` : `MISSED (${sc.weighIn.weightKg.toFixed(1)} kg)`}</b>
                : <b className={wc.pct > 0.08 ? 'red' : wc.pct > 0.06 ? 'gold' : 'green'}>{wc.label} cut ({(wc.pct * 100).toFixed(1)}%){wc.missChance > 0 ? ` · ${Math.round(wc.missChance * 100)}% miss risk` : ''}</b>}
            </div>
            <div className="row between small" style={{ marginTop: 6 }}><span>Purse</span><b>{sc.amateur ? 'Amateur (unpaid)' : `${money(sc.purse)} + ${money(sc.winBonus)} to win`}</b></div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-title"><h3><Brain size={16} /> Game plan</h3><span className="tiny dim">Shapes your fighter's tendencies and gives small situational bonuses. You still control every action.</span></div>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {GAME_PLANS.map((g) => (
              <button key={g.id} className={`pick ${plan === g.id ? 'on' : ''}`} onClick={() => setPlan(g.id)}>
                <b>{g.name}</b><span className="small muted">{g.desc}</span><span className="tiny accent">{g.bonus}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', marginTop: 22, gap: 12 }}>
          {fightNight ? (
            <Btn variant="primary" size="lg" className="pulse" onClick={walkOut}><Swords size={20} /> Walk out to the cage</Btn>
          ) : (
            <>
              <Btn onClick={() => { store.act((g) => { if (g.scheduled) g.scheduled.gamePlan = plan; }); nav.toast('Game plan saved.', 'ok'); }}>Save game plan</Btn>
              <span className="muted">Fight in {sc.day - st.day} days — keep training. Fight night unlocks this screen's walk-out.</span>
            </>
          )}
        </div>
        <p className="tiny dim" style={{ textAlign: 'center', marginTop: 10 }}>{STYLE[opp.style].desc} · {attrColor(0) && ''}Tip: Tab pauses the fight for tactical analysis; Esc opens the pause menu.</p>
      </div>
    </div>
  );
}
