import { useState } from 'react';
import { FileSignature, Handshake, BadgeDollarSign, Star, ArrowUpRight } from 'lucide-react';
import { Btn, Modal, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { ORG } from '../../../data/world';
import { SPONSOR } from '../../../data/training';
import { acceptSponsor, buyoutCost, declineSponsor, dropSponsor, leverage, negotiate, signContract, turnPro, type Ask } from '../../../game/economy';
import { fmtDate, money } from '../../../game/core';
import type { ContractOffer } from '../../../game/types';

export function ContractsTab() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const c = p.contract;
  const [neg, setNeg] = useState<ContractOffer | null>(null);
  const [ask, setAsk] = useState<Ask>({ purse: 0, winBonus: 0, signingBonus: 0, fights: 4 });
  const [reply, setReply] = useState<string>('');

  const openNeg = (o: ContractOffer) => { setNeg(o); setAsk({ purse: o.purse, winBonus: o.winBonus, signingBonus: o.signingBonus, fights: o.fights }); setReply(o.lastResponse ?? ''); };
  const liveNeg = neg ? st.contractOffers.find((x) => x.id === neg.id) : null;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>Contracts & Sponsors</h1><div className="sub">Leverage comes from reputation, popularity, ranking, streaks and titles.</div></div></div>
      <div className="grid2">
        <div className="panel">
          <div className="panel-title"><h3><FileSignature size={16} /> Current deal</h3></div>
          {!p.isPro ? (
            <div className="col">
              <div className="small">Amateur status · record {p.amateurRecord.w}-{p.amateurRecord.l}. Amateur bouts are unpaid but safer ways to gain experience.</div>
              <div className="row"><Btn variant="primary" disabled={p.amateurRecord.w + p.amateurRecord.l < 2 || !!st.scheduled} onClick={() => { const e = store.act((g) => turnPro(g)); nav.toast(e ?? 'You are now a professional fighter!', e ? 'err' : 'ok'); }}><ArrowUpRight size={15} /> Turn professional</Btn>
                <span className="tiny dim">{p.amateurRecord.w + p.amateurRecord.l < 2 ? 'Requires at least two amateur fights.' : 'IFC pro deal: 3 fights.'}</span></div>
            </div>
          ) : c && c.fightsLeft > 0 ? (
            <div className="col" style={{ gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{ORG[c.orgId].name}</div>
              <div className="grid2 small">
                <span>Fights remaining: <b>{c.fightsLeft}/{c.fightsTotal}</b></span>
                <span>Show money: <b>{money(c.purse)}</b></span>
                <span>Win bonus: <b>{money(c.winBonus)}</b></span>
                <span>Exclusive: <b>{c.exclusive ? 'yes' : 'no'}</b></span>
                <span>Champion clause: <b>{c.champClause ? 'yes' : 'no'}</b></span>
                <span>Signed: {fmtDate(c.signedDay)}</span>
              </div>
              <div className="tiny dim">Leaving early for another promotion costs a buyout of {money(buyoutCost(st))} (free with one fight or fewer left).{p.isChampion ? ' Leaving vacates your title.' : ''}</div>
            </div>
          ) : <div className="small">You are a <b className="gold">free agent</b>. Sign one of the offers to resume fighting.</div>}
          <div className="tiny muted" style={{ marginTop: 10 }}>Your leverage with {ORG[p.orgId].short}: <b>{Math.round(leverage(st, p.orgId))}</b>/100 · Promoter relationship {st.promoterRelation}</div>
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Star size={16} /> Sponsors ({st.sponsors.length}/3)</h3><span className="tiny dim">Popularity {Math.round(p.popularity)}</span></div>
          {st.sponsors.map((d) => (
            <div key={d.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <div><b>{SPONSOR[d.sponsorId].name}</b> <span className="tag">{SPONSOR[d.sponsorId].kind}</span><div className="tiny muted">{money(d.monthly)}/mo · {d.monthsLeft} months left{d.winBonus ? ` · win +${money(d.winBonus)}` : ''}{d.finishBonus ? ` · finish +${money(d.finishBonus)}` : ''}{d.dropOnLosses ? ` · drops you after ${d.dropOnLosses} straight losses` : ''}</div></div>
              <Btn size="sm" variant="ghost" onClick={() => store.act((g) => dropSponsor(g, d.id))}>End</Btn>
            </div>
          ))}
          {st.sponsorOffers.map((o) => (
            <div key={o.id} className="row between wrap" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="grow"><span className="tag accent">Offer</span> <b>{SPONSOR[o.sponsorId].name}</b><div className="tiny muted">{SPONSOR[o.sponsorId].desc} {money(o.monthly)}/mo for {o.months} months{o.winBonus ? ` · win +${money(o.winBonus)}` : ''}{o.finishBonus ? ` · finish +${money(o.finishBonus)}` : ''}{o.dropOnLosses ? ` · ends after ${o.dropOnLosses} straight losses` : ''}</div></div>
              <div className="row"><Btn size="sm" onClick={() => store.act((g) => declineSponsor(g, o.id))}>Decline</Btn><Btn size="sm" variant="primary" onClick={() => { const e = store.act((g) => acceptSponsor(g, o.id)); nav.toast(e ?? 'Sponsor signed.', e ? 'err' : 'ok'); }}>Sign</Btn></div>
            </div>
          ))}
          {!st.sponsors.length && !st.sponsorOffers.length && <div className="small muted">No sponsors yet. Brands notice popular fighters: finishes, win streaks, media work and rivalries all raise popularity.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Handshake size={16} /> Contract offers</h3></div>
        {st.contractOffers.length ? st.contractOffers.map((o) => (
          <div key={o.id} className="row between wrap" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="grow">
              <div><b style={{ color: ORG[o.orgId].color }}>{ORG[o.orgId].name}</b> <span className="tag">Tier {ORG[o.orgId].tier}</span> <span className="tiny dim">{o.note}</span></div>
              <div className="small">{o.fights} fights · {money(o.purse)} + {money(o.winBonus)} win · signing {money(o.signingBonus)}{o.champClause ? ' · champion clause' : ''}{o.exclusive ? ' · exclusive' : ''}</div>
              <div className="tiny muted">{ORG[o.orgId].expectations} Expires {fmtDate(o.expiresDay, { day: 'numeric', month: 'short' })}.{o.lastResponse ? ` Last word: "${o.lastResponse}"` : ''}</div>
            </div>
            <div className="row">
              <Btn size="sm" onClick={() => openNeg(o)}><BadgeDollarSign size={14} /> Negotiate</Btn>
              <Btn size="sm" variant="primary" disabled={!!st.scheduled} title={st.scheduled ? 'Finish your booked fight first' : ''} onClick={() => { const e = store.act((g) => signContract(g, o.id)); nav.toast(e ?? `Signed with ${ORG[o.orgId].short}!`, e ? 'err' : 'ok'); }}>Sign</Btn>
            </div>
          </div>
        )) : <div className="small muted">No contract offers. Renewal offers arrive when your deal runs out; bigger promotions approach contenders with momentum.</div>}
      </div>

      {neg && liveNeg && (
        <Modal title={`Negotiate with ${ORG[liveNeg.orgId].short}`} onClose={() => setNeg(null)}>
          <p className="small muted">Current offer: {liveNeg.fights} fights · {money(liveNeg.purse)} + {money(liveNeg.winBonus)} · signing {money(liveNeg.signingBonus)}. Patience: {'●'.repeat(Math.max(0, Math.min(3, liveNeg.patience)))}{'○'.repeat(Math.max(0, 3 - Math.min(3, liveNeg.patience)))}</p>
          {([['purse', 'Show money', liveNeg.purse], ['winBonus', 'Win bonus', liveNeg.winBonus], ['signingBonus', 'Signing bonus', Math.max(500, liveNeg.signingBonus)]] as const).map(([k, l, base]) => (
            <div className="field" key={k} style={{ marginBottom: 10 }}>
              <label>{l}: {money(ask[k])} <span className="dim">({Math.round((ask[k] / Math.max(1, base) - 1) * 100)}% vs offer)</span></label>
              <input type="range" min={Math.round(base * 0.8)} max={Math.round(base * 2.2)} step={100} value={ask[k]} onChange={(e) => setAsk({ ...ask, [k]: +e.target.value })} />
            </div>
          ))}
          <div className="field"><label>Number of fights: {ask.fights}</label><div className="row">{[2, 3, 4, 5, 6].map((n) => <button key={n} className={`chip ${ask.fights === n ? 'on' : ''}`} onClick={() => setAsk({ ...ask, fights: n })}>{n}</button>)}</div>
            <span className="tiny dim">Fewer fights = more freedom but the promoter values longer deals.</span></div>
          {reply && <div className="panel tight" style={{ marginTop: 12 }}><b>Promoter:</b> <span className="muted">"{reply}"</span></div>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setNeg(null)}>Close</Btn>
            <Btn variant="primary" onClick={() => {
              const r = store.act((g) => negotiate(g, liveNeg.id, ask));
              if (!r) return;
              setReply(r.message);
              if (r.result === 'walked') { nav.toast(r.message, 'err'); setNeg(null); }
              if (r.result === 'accepted') nav.toast('They accepted your terms. Sign to lock it in.', 'ok');
              const updated = store.state!.contractOffers.find((x) => x.id === liveNeg.id);
              if (updated && r.result === 'countered') setAsk({ purse: updated.purse, winBonus: updated.winBonus, signingBonus: updated.signingBonus, fights: updated.fights });
            }}>Propose terms</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
