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
import { t, tx } from '../../i18n';

export function FightPrep() {
  const st = useGame();
  const nav = useNav();
  const sc = st.scheduled;
  const [plan, setPlan] = useState<GamePlanId>(sc?.gamePlan ?? 'balanced');
  if (!sc) {
    return <div style={{ padding: 40 }}><div className="empty">{t('No fight booked.')} <Btn onClick={() => nav.go('hub')}>{t('Back to camp')}</Btn></div></div>;
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
    ['Stance', t(p.stance), t(opp.stance)],
    ['Ranking', myRank ? (myRank.champion ? t('Champion') : `#${myRank.rank}`) : '—', oRank ? (oRank.champion ? t('Champion') : `#${oRank.rank}`) : '—'],
    ['Style', t('You'), t(STYLE[opp.style].name)],
  ];

  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', background: 'radial-gradient(80% 60% at 50% 0%, rgba(255,90,54,.12), transparent 60%), var(--bg)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 26px 40px' }}>
        <div className="row between">
          <Btn variant="ghost" onClick={() => nav.go('hub')}><ArrowLeft size={16} /> {t('Back to camp')}</Btn>
          <div className="row wrap" style={{ gap: 6 }}>
            {sc.title && <span className="tag gold"><Trophy size={12} /> {t('{org} {div} Championship', { org: ORG[sc.orgId].short, div: t(DIV[sc.div ?? p.divisionId].name) })}</span>}
            {sc.superfight && <span className="tag accent">{t('SUPERFIGHT')} · {t(DIV[sc.div!].name)} ({DIV[sc.div!].lb} lb)</span>}
            {sc.invader && <span className="tag accent">{t('CHAMPION VS CHAMPION')} · {t('{div} champion', { div: t(DIV[sc.invader].name) })}</span>}
            <span className="tag">{tx(sc.eventName)}</span>
            <span className="tag">{fmtDate(sc.day)}</span>
            <span className="tag">{sc.rounds} × 5:00</span>
            <span className={`tag ${diff.c}`}>{t(diff.t)}</span>
            <PosterButton data={posterForScheduled(st, sc)} label={t('Fight poster')} />
          </div>
        </div>

        <div className="panel hero cut" style={{ marginTop: 16, padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'center' }}>
            <div className="row" style={{ gap: 16 }}>
              <Portrait ap={p.appearance} size={130} />
              <div>
                <div className="tiny accent" style={{ letterSpacing: '0.2em', fontWeight: 700 }}>{t('RED CORNER')}</div>
                <h1 style={{ fontSize: 30 }}>{p.firstName} {p.lastName}</h1>
                <div className="row" style={{ gap: 10, marginTop: 6 }}><OvrBadge v={overallRating(fa.attrs)} size={44} /><span className="small muted">{t('Fight-night rating')}<br />{t('(after condition)')}</span></div>
              </div>
            </div>
            <div className="vs" style={{ fontSize: 56 }}>VS</div>
            <div className="row" style={{ gap: 16, justifyContent: 'flex-end', textAlign: 'right' }}>
              <div>
                <div className="tiny blue" style={{ letterSpacing: '0.2em', fontWeight: 700 }}>{t('BLUE CORNER')}</div>
                <h1 style={{ fontSize: 30 }}>{fighterName(opp)}</h1>
                {opp.nick && <div className="muted" style={{ fontFamily: 'var(--head)', letterSpacing: '0.1em' }}>"{opp.nick.toUpperCase()}"</div>}
                <div className="small muted">{t('Scouted overall')} {Math.max(1, oOvr - rng)}–{Math.min(99, oOvr + rng)}</div>
              </div>
              <Portrait ap={wfAppearance(opp)} size={130} accent="#60a5fa" mirror />
            </div>
          </div>
          <table className="tbl" style={{ marginTop: 16 }}>
            <tbody>{tape.map(([l, a, b]) => <tr key={l}><td className="num" style={{ width: '40%', fontSize: 16 }}>{a}</td><td className="tiny dim" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t(l)}</td><td className="num" style={{ width: '40%', textAlign: 'right', fontSize: 16 }}>{b}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="grid3" style={{ marginTop: 16, alignItems: 'start' }}>
          <div className="panel">
            <div className="panel-title"><h3><Eye size={16} /> {t('Skill comparison')}</h3><span className="tiny dim">{t('Scouting {n}% (±{r})', { n: sl, r: rng })}</span></div>
            {CATEGORY_DEFS.map((c) => (
              <div key={c.id} style={{ marginBottom: 8 }}>
                <div className="row between tiny"><span className="accent num" style={{ fontSize: 14 }}>{Math.round(myCats[c.id])}</span><span className="muted">{t(c.name).toUpperCase()}</span><span className="blue num" style={{ fontSize: 14 }}>~{Math.round(opCats[c.id] / rng) * rng || Math.round(opCats[c.id])}</span></div>
                <div className="row" style={{ gap: 4 }}>
                  <div className="grow" style={{ transform: 'scaleX(-1)' }}><Bar value={myCats[c.id]} color="var(--accent)" /></div>
                  <div className="grow"><Bar value={opCats[c.id]} color="var(--blue)" /></div>
                </div>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-title"><h3><Crosshair size={16} /> {t('Scouting report')}</h3></div>
            <div className="col small" style={{ gap: 6 }}>{rep.lines.map((l, i) => <div key={i}>• {tx(l)}</div>)}</div>
            {sl >= 40 ? (
              <div className="grid2" style={{ marginTop: 10 }}>
                <div><h4>{t('Strengths')}</h4>{rep.strengths.map((k) => <div key={k} className="small green">{t(ATTR_BY_KEY[k as AttrKey].name)}</div>)}</div>
                <div><h4>{t('Weaknesses')}</h4>{rep.weaknesses.map((k) => <div key={k} className="small red">{t(ATTR_BY_KEY[k as AttrKey].name)}</div>)}</div>
              </div>
            ) : <div className="small muted" style={{ marginTop: 10 }}>{t('Detailed strengths and weaknesses need better scouting: hire a tactics coach, train at a gym with good partners, or do Film Study / Opponent-Specific Camp.')}</div>}
          </div>
          <div className="panel">
            <div className="panel-title"><h3><HeartPulse size={16} /> {t('Your condition')}</h3></div>
            <div className="col small" style={{ gap: 5 }}>
              {fa.notes.map((n, i) => <div key={i} className={/Injured|Fatigued|drained|Lacking/.test(n) ? 'red' : /\+/.test(n) ? 'green' : ''}>• {tx(n)}</div>)}
            </div>
            <div className="row between small" style={{ marginTop: 10 }}><span><Scale size={13} style={{ verticalAlign: -2 }} /> {t('Weight')}</span>
              {sc.weighIn ? <b className={sc.weighIn.madeWeight ? 'green' : 'red'}>{t(sc.weighIn.madeWeight ? 'Made weight ({kg} kg)' : 'MISSED ({kg} kg)', { kg: sc.weighIn.weightKg.toFixed(1) })}</b>
                : <b className={wc.pct > 0.08 ? 'red' : wc.pct > 0.06 ? 'gold' : 'green'}>{t('{label} cut ({pct}%)', { label: t(wc.label), pct: (wc.pct * 100).toFixed(1) })}{wc.missChance > 0 ? ' · ' + t('{n}% miss risk', { n: Math.round(wc.missChance * 100) }) : ''}</b>}
            </div>
            <div className="row between small" style={{ marginTop: 6 }}><span>{t('Purse')}</span><b>{sc.amateur ? t('Amateur (unpaid)') : t('{purse} + {win} to win', { purse: money(sc.purse), win: money(sc.winBonus) })}</b></div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-title"><h3><Brain size={16} /> {t('Game plan')}</h3><span className="tiny dim">{t("Shapes your fighter's tendencies and gives small situational bonuses. You still control every action.")}</span></div>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {GAME_PLANS.map((g) => (
              <button key={g.id} className={`pick ${plan === g.id ? 'on' : ''}`} onClick={() => setPlan(g.id)}>
                <b>{t(g.name)}</b><span className="small muted">{t(g.desc)}</span><span className="tiny accent">{t(g.bonus)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', marginTop: 22, gap: 12 }}>
          {fightNight ? (
            <Btn variant="primary" size="lg" className="pulse" onClick={walkOut}><Swords size={20} /> {t('Walk out to the cage')}</Btn>
          ) : (
            <>
              <Btn onClick={() => { store.act((g) => { if (g.scheduled) g.scheduled.gamePlan = plan; }); nav.toast(t('Game plan saved.'), 'ok'); }}>{t('Save game plan')}</Btn>
              <span className="muted">{t("Fight in {n} days — keep training. Fight night unlocks this screen's walk-out.", { n: sc.day - st.day })}</span>
            </>
          )}
        </div>
        <p className="tiny dim" style={{ textAlign: 'center', marginTop: 10 }}>{t(STYLE[opp.style].desc)} · {attrColor(0) && ''}{t('Tip: Tab pauses the fight for tactical analysis; Esc opens the pause menu.')}</p>
      </div>
    </div>
  );
}
