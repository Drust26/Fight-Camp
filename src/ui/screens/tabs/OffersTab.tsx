import { PosterButton } from '../../components/FightPoster';
import { t, tp, tx } from '../../../i18n';
import { tn } from '../../../i18n/rich';
import { posterForScheduled } from '../../../game/poster';
import { statusName } from '../../../game/superfight';
import { useState } from 'react';
import { Swords, Check, X, Trophy, Flame, Clock, ShieldAlert } from 'lucide-react';
import { Btn, Confirm, Modal, Portrait, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { CAMP_FOCUS, acceptOffer, canAccept, declineOffer, playerOvr, scoutLevel, scoutRange, withdrawFromFight } from '../../../game/fights';
import { overallRating, unpackAttrs } from '../../../game/attributes';
import { fighterName, recStr, wfAppearance } from '../../../game/fighterGen';
import { fmtDate, money } from '../../../game/core';
import { ORG, STYLE, DIV } from '../../../data/world';
import { rankings } from '../../../game/world';
import type { CampFocus, FightOffer } from '../../../game/types';

export function difficultyLabel(diff: number) {
  return diff <= -6 ? { t: 'Favourable', c: 'green' } : diff <= -2 ? { t: 'Slight edge', c: 'green' } : diff <= 1 ? { t: 'Even fight', c: 'blue' } : diff <= 5 ? { t: 'Tough', c: 'gold' } : { t: 'Dangerous', c: 'red' };
}

export function OffersTab() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const [accepting, setAccepting] = useState<FightOffer | null>(null);
  const [camp, setCamp] = useState<CampFocus>('general');
  const [withdraw, setWithdraw] = useState(false);
  const myOvr = playerOvr(st);
  const sl = scoutLevel(st);
  const rng = scoutRange(sl);

  const card = (o: FightOffer, booked = false) => {
    const f = st.world.fighters[o.opponentId];
    if (!f) return null;
    const ovr = overallRating(unpackAttrs(f.a));
    const d = difficultyLabel(ovr - myOvr);
    const rows = o.amateur ? [] : rankings(st, o.orgId, o.div ?? p.divisionId);
    const oppRank = rows.find((r) => r.id === f.id);
    const err = booked ? null : canAccept(st, o);
    return (
      <div key={o.id} className={`panel ${o.title ? 'goldline' : ''}`}>
        <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
          <Portrait ap={wfAppearance(f)} size={92} accent="#60a5fa" mirror />
          <div className="grow col" style={{ gap: 6, minWidth: 260 }}>
            <div className="row wrap" style={{ gap: 6 }}>
              {o.title && <span className="tag gold"><Trophy size={12} /> {t('TITLE FIGHT · 5 rounds')}</span>}
              {o.superfight && o.div && <span className="tag accent">{t('SUPERFIGHT · {div} ({lb} lb)', { div: t(DIV[o.div].name), lb: DIV[o.div].lb })}</span>}
              {o.invader && <span className="tag accent">{t('CHAMPION VS CHAMPION · {div} champion', { div: t(DIV[o.invader].name) })}</span>}
              {o.rivalry && <span className="tag red"><Flame size={12} /> {t('Rivalry')}</span>}
              {o.shortNotice && <span className="tag accent"><Clock size={12} /> {t('Short notice')}</span>}
              {o.amateur && <span className="tag">{t('Amateur bout')}</span>}
              {o.note && <span className="tag blue">{tx(o.note)}</span>}
              <span className={`tag ${d.c}`}>{t(d.t)}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fighterName(f)} {f.nick && <span className="muted small">"{f.nick}"</span>}</div>
            <div className="small muted">{recStr(f.rec)} · {t(STYLE[f.style].name)} · {t(f.stance)} · {t(f.nat)} · {t('{n} yrs', { n: Math.floor((st.day - f.bornDay) / 365) })} · {t('{h} cm / reach {r} cm', { h: f.h, r: f.r })}</div>
            <div className="small">{t('Scouted rating')} <b>{Math.max(1, ovr - rng)}–{Math.min(99, ovr + rng)}</b> <span className="dim">{t('(you: {me}; scouting ±{r})', { me: myOvr, r: rng })}</span>{oppRank ? <> · {t('Ranked')} <b>{oppRank.champion ? t('Champion') : `#${oppRank.rank}`}</b></> : ''}</div>
            {o.invader && <div className="small gold">{t('The {div} champion is coming for your {mine} belt. Win and you beat a reigning champion; lose and he holds both belts.', { div: t(DIV[o.invader].name), mine: t(DIV[p.divisionId].name) })}</div>}
            {o.superfight && <div className="small gold">{t('Win: you become a {status} and choose which belt to keep. Lose: you return to {div} and keep your belt.', { status: t(statusName(Math.min(2, (p.champStatus ?? 0) + 1))).toLowerCase(), div: t(DIV[p.divisionId].name) })}</div>}
            <div className="small muted">{t(STYLE[f.style].desc)} {t('Recent:')} {f.recent.length ? f.recent.map((r) => t(r)).join(' ') : '—'}</div>
          </div>
          <div className="col" style={{ minWidth: 220, gap: 4 }}>
            <div className="small"><b>{o.eventName}</b></div>
            <div className="small muted">{ORG[o.orgId].name}</div>
            <div className="small">{fmtDate(o.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {tn(o.day - st.day === 1 ? '{n} day notice' : '{n} days notice', { n: <b>{o.day - st.day}</b> })} · {tp('{n} round', '{n} rounds', o.rounds)}</div>
            <div className="small">{t('Purse')} <b className="green">{o.amateur ? t('unpaid (travel $150)') : money(o.purse)}</b>{!o.amateur && <> + {t('win')} <b className="green">{money(o.winBonus)}</b></>}</div>
            {!o.amateur && <div className="tiny dim">{t('Performance/Fight-of-the-Night bonuses possible.')} {o.title ? t('Winning makes you champion.') : oppRank && oppRank.rank < (rows.find((r) => r.isPlayer)?.rank ?? 99) ? t('A win should move you up the rankings.') : t('A win builds your record.')}</div>}
            {!booked && <div className="tiny dim">{t('Offer expires {date}', { date: fmtDate(o.expiresDay, { day: 'numeric', month: 'short' }) })}</div>}
          </div>
        </div>
        {!booked && (
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            {err && <span className="small red grow">{tx(err)}</span>}
            <Btn onClick={() => { store.act((g) => declineOffer(g, o.id)); nav.toast(t('Offer declined.')); }}><X size={15} /> {t('Decline')}</Btn>
            <Btn variant="primary" disabled={!!err} onClick={() => { setAccepting(o); setCamp(o.shortNotice ? 'weight' : 'general'); }}><Check size={15} /> {t('Accept…')}</Btn>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Fight Offers')}</h1><div className="sub">{p.isPro ? `${ORG[p.orgId].name} · ${p.contract ? tp('{n} fight left on contract', '{n} fights left on contract', p.contract.fightsLeft) : t('no contract')}` : t('Amateur circuit — unpaid bouts that build experience')} · {t('Promoter relationship')} {st.promoterRelation >= 0 ? '+' : ''}{st.promoterRelation}</div></div></div>
      {st.scheduled && (
        <>
          <h3>{t('Booked')}</h3>
          {card(st.scheduled, true)}
          <div className="row">
            <Btn variant="primary" onClick={() => nav.go('prep')}><Swords size={15} /> {t('Fight preparation')}</Btn>
            <PosterButton data={posterForScheduled(st, st.scheduled)} label={t('Fight poster')} />
            <Btn variant="danger" onClick={() => setWithdraw(true)}><ShieldAlert size={15} /> {t('Withdraw…')}</Btn>
          </div>
        </>
      )}
      {!st.scheduled && (st.offers.length ? <>{st.offers.map((o) => card(o))}</> : (
        <div className="empty">
          {p.retired ? t('You are retired.') : p.isPro && (!p.contract || p.contract.fightsLeft === 0) ? t('You are a free agent — sign a contract in Contracts to receive fight offers.')
            : p.medicalSuspensionUntil > st.day ? t("Medically suspended until {date}. Offers will come once you're cleared.", { date: fmtDate(p.medicalSuspensionUntil) })
            : t('No offers right now. Promoters call every week or two — keep training and advance time. Declining many reasonable fights slows them down.')}
        </div>
      ))}
      {accepting && (
        <Modal title={t('Accept fight')} onClose={() => setAccepting(null)}>
          <p className="muted small">{t('Choose your camp focus for the next {n} days. You can also schedule Opponent-Specific Camp and Film Study sessions in Training to raise preparation.', { n: accepting.day - st.day })}</p>
          <div className="col" style={{ gap: 6 }}>
            {CAMP_FOCUS.map((c) => (
              <button key={c.id} className={`pick ${camp === c.id ? 'on' : ''}`} onClick={() => setCamp(c.id)}><b>{t(c.name)}</b><span className="small muted">{t(c.desc)}</span></button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setAccepting(null)}>{t('Cancel')}</Btn>
            <Btn variant="primary" onClick={() => {
              const err = store.act((g) => acceptOffer(g, accepting.id, camp));
              if (err) nav.toast(tx(err), 'err'); else { nav.toast(t('Fight booked!'), 'ok'); setAccepting(null); }
            }}>{t('Sign the bout agreement')}</Btn>
          </div>
        </Modal>
      )}
      {withdraw && <Confirm title={t('Withdraw from this fight?')} danger confirm={t('Withdraw')}
        body={p.injuries.length ? t('You are injured, so the promoter will mostly understand. Small popularity and relationship hit.') : t('Pulling out healthy damages your relationship with the promoter and your popularity.')}
        onNo={() => setWithdraw(false)} onYes={() => { store.act((g) => withdrawFromFight(g)); setWithdraw(false); }} />}
    </div>
  );
}
