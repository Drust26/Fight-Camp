import { PosterButton } from '../../components/FightPoster';
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
              {o.title && <span className="tag gold"><Trophy size={12} /> TITLE FIGHT · 5 rounds</span>}
              {o.superfight && o.div && <span className="tag accent">SUPERFIGHT · {DIV[o.div].name} ({DIV[o.div].lb} lb)</span>}
              {o.invader && <span className="tag accent">CHAMPION VS CHAMPION · {DIV[o.invader].name} champion</span>}
              {o.rivalry && <span className="tag red"><Flame size={12} /> Rivalry</span>}
              {o.shortNotice && <span className="tag accent"><Clock size={12} /> Short notice</span>}
              {o.amateur && <span className="tag">Amateur bout</span>}
              {o.note && <span className="tag blue">{o.note}</span>}
              <span className={`tag ${d.c}`}>{d.t}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fighterName(f)} {f.nick && <span className="muted small">"{f.nick}"</span>}</div>
            <div className="small muted">{recStr(f.rec)} · {STYLE[f.style].name} · {f.stance} · {f.nat} · {Math.floor((st.day - f.bornDay) / 365)} yrs · {f.h} cm / reach {f.r} cm</div>
            <div className="small">Scouted rating <b>{Math.max(1, ovr - rng)}–{Math.min(99, ovr + rng)}</b> <span className="dim">(you: {myOvr}; scouting ±{rng})</span>{oppRank ? <> · Ranked <b>{oppRank.champion ? 'Champion' : `#${oppRank.rank}`}</b></> : ''}</div>
            {o.invader && <div className="small gold">The {DIV[o.invader].name} champion is coming for your {DIV[p.divisionId].name} belt. Win and you beat a reigning champion; lose and he holds both belts.</div>}
            {o.superfight && <div className="small gold">Win: you become a {statusName(Math.min(2, (p.champStatus ?? 0) + 1))} and choose which belt to keep. Lose: you return to {DIV[p.divisionId].name} and keep your belt.</div>}
            <div className="small muted">{STYLE[f.style].desc} Recent: {f.recent.length ? f.recent.join(' ') : '—'}</div>
          </div>
          <div className="col" style={{ minWidth: 220, gap: 4 }}>
            <div className="small"><b>{o.eventName}</b></div>
            <div className="small muted">{ORG[o.orgId].name}</div>
            <div className="small">{fmtDate(o.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · <b>{o.day - st.day} days</b> notice · {o.rounds} rounds</div>
            <div className="small">Purse <b className="green">{o.amateur ? 'unpaid (travel $150)' : money(o.purse)}</b>{!o.amateur && <> + win <b className="green">{money(o.winBonus)}</b></>}</div>
            {!o.amateur && <div className="tiny dim">Performance/Fight-of-the-Night bonuses possible. {o.title ? 'Winning makes you champion.' : oppRank && oppRank.rank < (rows.find((r) => r.isPlayer)?.rank ?? 99) ? 'A win should move you up the rankings.' : 'A win builds your record.'}</div>}
            {!booked && <div className="tiny dim">Offer expires {fmtDate(o.expiresDay, { day: 'numeric', month: 'short' })}</div>}
          </div>
        </div>
        {!booked && (
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            {err && <span className="small red grow">{err}</span>}
            <Btn onClick={() => { store.act((g) => declineOffer(g, o.id)); nav.toast('Offer declined.'); }}><X size={15} /> Decline</Btn>
            <Btn variant="primary" disabled={!!err} onClick={() => { setAccepting(o); setCamp(o.shortNotice ? 'weight' : 'general'); }}><Check size={15} /> Accept…</Btn>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>Fight Offers</h1><div className="sub">{p.isPro ? `${ORG[p.orgId].name} · ${p.contract ? `${p.contract.fightsLeft} fight${p.contract.fightsLeft === 1 ? '' : 's'} left on contract` : 'no contract'}` : 'Amateur circuit — unpaid bouts that build experience'} · Promoter relationship {st.promoterRelation >= 0 ? '+' : ''}{st.promoterRelation}</div></div></div>
      {st.scheduled && (
        <>
          <h3>Booked</h3>
          {card(st.scheduled, true)}
          <div className="row">
            <Btn variant="primary" onClick={() => nav.go('prep')}><Swords size={15} /> Fight preparation</Btn>
            <PosterButton data={posterForScheduled(st, st.scheduled)} label="Fight poster" />
            <Btn variant="danger" onClick={() => setWithdraw(true)}><ShieldAlert size={15} /> Withdraw…</Btn>
          </div>
        </>
      )}
      {!st.scheduled && (st.offers.length ? <>{st.offers.map((o) => card(o))}</> : (
        <div className="empty">
          {p.retired ? 'You are retired.' : p.isPro && (!p.contract || p.contract.fightsLeft === 0) ? 'You are a free agent — sign a contract in Contracts to receive fight offers.'
            : p.medicalSuspensionUntil > st.day ? `Medically suspended until ${fmtDate(p.medicalSuspensionUntil)}. Offers will come once you're cleared.`
            : 'No offers right now. Promoters call every week or two — keep training and advance time. Declining many reasonable fights slows them down.'}
        </div>
      ))}
      {accepting && (
        <Modal title="Accept fight" onClose={() => setAccepting(null)}>
          <p className="muted small">Choose your camp focus for the next {accepting.day - st.day} days. You can also schedule Opponent-Specific Camp and Film Study sessions in Training to raise preparation.</p>
          <div className="col" style={{ gap: 6 }}>
            {CAMP_FOCUS.map((c) => (
              <button key={c.id} className={`pick ${camp === c.id ? 'on' : ''}`} onClick={() => setCamp(c.id)}><b>{c.name}</b><span className="small muted">{c.desc}</span></button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setAccepting(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={() => {
              const err = store.act((g) => acceptOffer(g, accepting.id, camp));
              if (err) nav.toast(err, 'err'); else { nav.toast('Fight booked!', 'ok'); setAccepting(null); }
            }}>Sign the bout agreement</Btn>
          </div>
        </Modal>
      )}
      {withdraw && <Confirm title="Withdraw from this fight?" danger confirm="Withdraw"
        body={p.injuries.length ? 'You are injured, so the promoter will mostly understand. Small popularity and relationship hit.' : 'Pulling out healthy damages your relationship with the promoter and your popularity.'}
        onNo={() => setWithdraw(false)} onYes={() => { store.act((g) => withdrawFromFight(g)); setWithdraw(false); }} />}
    </div>
  );
}
