import { useState } from 'react';
import { FileSignature, Handshake, BadgeDollarSign, Star, ArrowUpRight, Gavel } from 'lucide-react';
import { Btn, Modal, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { ORG } from '../../../data/world';
import { SPONSOR } from '../../../data/training';
import { acceptSponsor, BID_ROUNDS, buyoutCost, declineSponsor, dropSponsor, letThemBid, leverage, negotiate, signContract, turnPro, type Ask } from '../../../game/economy';
import { fmtDate, money, withRng } from '../../../game/core';
import type { ContractOffer } from '../../../game/types';
import { t, tp, tx } from '../../../i18n';

export function ContractsTab() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const c = p.contract;
  const [neg, setNeg] = useState<ContractOffer | null>(null);
  const [ask, setAsk] = useState<Ask>({ purse: 0, winBonus: 0, signingBonus: 0, fights: 4 });
  const [reply, setReply] = useState<string>('');
  const [bidMsg, setBidMsg] = useState<string>('');

  const openNeg = (o: ContractOffer) => { setNeg(o); setAsk({ purse: o.purse, winBonus: o.winBonus, signingBonus: o.signingBonus, fights: o.fights }); setReply(o.lastResponse ?? ''); };
  const liveNeg = neg ? st.contractOffers.find((x) => x.id === neg.id) : null;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Contracts & Sponsors')}</h1><div className="sub">{t('Leverage comes from reputation, popularity, ranking, streaks and titles.')}</div></div></div>
      <div className="grid2">
        <div className="panel">
          <div className="panel-title"><h3><FileSignature size={16} /> {t('Current deal')}</h3></div>
          {!p.isPro ? (
            <div className="col">
              <div className="small">{t('Amateur status · record {w}-{l}. Amateur bouts are unpaid but safer ways to gain experience.', { w: p.amateurRecord.w, l: p.amateurRecord.l })}</div>
              <div className="row"><Btn variant="primary" disabled={p.amateurRecord.w + p.amateurRecord.l < 2 || !!st.scheduled} onClick={() => { const e = store.act((g) => turnPro(g)); nav.toast(e ? tx(e) : t('You are now a professional fighter!'), e ? 'err' : 'ok'); }}><ArrowUpRight size={15} /> {t('Turn professional')}</Btn>
                <span className="tiny dim">{p.amateurRecord.w + p.amateurRecord.l < 2 ? t('Requires at least two amateur fights.') : t('IFC pro deal: 3 fights.')}</span></div>
            </div>
          ) : c && c.fightsLeft > 0 ? (
            <div className="col" style={{ gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{ORG[c.orgId].name}</div>
              <div className="grid2 small">
                <span>{t('Fights remaining:')} <b>{c.fightsLeft}/{c.fightsTotal}</b></span>
                <span>{t('Show money:')} <b>{money(c.purse)}</b></span>
                <span>{t('Win bonus:')} <b>{money(c.winBonus)}</b></span>
                <span>{t('Exclusive:')} <b>{c.exclusive ? t('yes') : t('no')}</b></span>
                <span>{t('Champion clause:')} <b>{c.champClause ? t('yes') : t('no')}</b></span>
                <span>{t('Signed: {date}', { date: fmtDate(c.signedDay) })}</span>
              </div>
              <div className="tiny dim">{t('Leaving early for another promotion costs a buyout of {amount} (free with one fight or fewer left).', { amount: money(buyoutCost(st)) })}{p.isChampion ? ' ' + t('Leaving vacates your title.') : ''}</div>
            </div>
          ) : <div className="small">{t('You are a free agent. Sign one of the offers to resume fighting.')}</div>}
          <div className="tiny muted" style={{ marginTop: 10 }}>{t('Your leverage with {org}:', { org: ORG[p.orgId].short })} <b>{Math.round(leverage(st, p.orgId))}</b>/100 · {t('Promoter relationship {n}', { n: st.promoterRelation })}</div>
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Star size={16} /> {t('Sponsors')} ({st.sponsors.length}/3)</h3><span className="tiny dim">{t('Popularity {n}', { n: Math.round(p.popularity) })}</span></div>
          {st.sponsors.map((d) => (
            <div key={d.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <div><b>{SPONSOR[d.sponsorId].name}</b> <span className="tag">{t(SPONSOR[d.sponsorId].kind)}</span><div className="tiny muted">{t('{amount}/mo', { amount: money(d.monthly) })} · {tp('{n} month left', '{n} months left', d.monthsLeft)}{d.winBonus ? ' · ' + t('win +{amount}', { amount: money(d.winBonus) }) : ''}{d.finishBonus ? ' · ' + t('finish +{amount}', { amount: money(d.finishBonus) }) : ''}{d.dropOnLosses ? ' · ' + t('drops you after {n} straight losses', { n: d.dropOnLosses }) : ''}</div></div>
              <Btn size="sm" variant="ghost" onClick={() => store.act((g) => dropSponsor(g, d.id))}>{t('End')}</Btn>
            </div>
          ))}
          {st.sponsorOffers.map((o) => (
            <div key={o.id} className="row between wrap" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="grow"><span className="tag accent">{t('Offer')}</span> <b>{SPONSOR[o.sponsorId].name}</b><div className="tiny muted">{t(SPONSOR[o.sponsorId].desc)} {t('{amount}/mo for {n} months', { amount: money(o.monthly), n: o.months })}{o.winBonus ? ' · ' + t('win +{amount}', { amount: money(o.winBonus) }) : ''}{o.finishBonus ? ' · ' + t('finish +{amount}', { amount: money(o.finishBonus) }) : ''}{o.dropOnLosses ? ' · ' + t('ends after {n} straight losses', { n: o.dropOnLosses }) : ''}</div></div>
              <div className="row"><Btn size="sm" onClick={() => store.act((g) => declineSponsor(g, o.id))}>{t('Decline')}</Btn><Btn size="sm" variant="primary" onClick={() => { const e = store.act((g) => acceptSponsor(g, o.id)); nav.toast(e ? tx(e) : t('Sponsor signed.'), e ? 'err' : 'ok'); }}>{t('Sign')}</Btn></div>
            </div>
          ))}
          {!st.sponsors.length && !st.sponsorOffers.length && <div className="small muted">{t('No sponsors yet. Brands notice popular fighters: finishes, win streaks, media work and rivalries all raise popularity.')}</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Handshake size={16} /> {t('Contract offers')}</h3></div>
        {st.contractOffers.some((c) => c.bid) && (() => {
          const used = st.bidRounds ?? 0;
          const done = used >= BID_ROUNDS || st.contractOffers.filter((c) => c.bid).every((c) => c.bid!.final);
          return (
            <div className="bid-banner">
              <div className="grow">
                <b className="gold"><Gavel size={15} style={{ verticalAlign: -2 }} /> {t('Bidding war')}</b> <span className="tiny dim">{t('round {n}/{max}', { n: used, max: BID_ROUNDS })}</span>
                <div className="small muted">{done ? t('Every promotion has made its final offer. Sign the one you want.') : t('Promotions are competing for you. Let them bid to push the offers up, until each reaches its limit. Signing ends the war.')}</div>
                {bidMsg && <div className="small" style={{ marginTop: 4 }}>{tx(bidMsg)}</div>}
              </div>
              <Btn variant="primary" disabled={done} onClick={() => { const r = store.act((g) => withRng(g, (rng) => letThemBid(g, rng))); if (r) { setBidMsg(r.message); nav.toast(r.ok ? t('New bids are in.') : tx(r.message), r.ok ? 'ok' : 'err'); } }}><Gavel size={15} /> {t('Let them bid')}</Btn>
            </div>
          );
        })()}
        {st.contractOffers.length ? st.contractOffers.map((o) => (
          <div key={o.id} className="row between wrap" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="grow">
              <div><b style={{ color: ORG[o.orgId].color }}>{ORG[o.orgId].name}</b> <span className="tag">{t('Tier {n}', { n: ORG[o.orgId].tier })}</span>{o.bid?.final && <span className="tag gold" style={{ marginLeft: 6 }}>{t('Final offer')}</span>}{!!o.bid?.raised && <span className="tag green" style={{ marginLeft: 6 }}>{t('+{n}% this round', { n: o.bid.raised })}</span>} <span className="tiny dim">{o.note ? tx(o.note) : ''}</span></div>
              <div className="small">{t('{n} fights · {purse} + {win} win · signing {sign}', { n: o.fights, purse: money(o.purse), win: money(o.winBonus), sign: money(o.signingBonus) })}{o.champClause ? ' · ' + t('champion clause') : ''}{o.exclusive ? ' · ' + t('exclusive') : ''}</div>
              <div className="tiny muted">{t(ORG[o.orgId].expectations)} {t('Expires {date}.', { date: fmtDate(o.expiresDay, { day: 'numeric', month: 'short' }) })}{o.lastResponse ? ' ' + t('Last word: "{msg}"', { msg: tx(o.lastResponse) }) : ''}</div>
            </div>
            <div className="row">
              <Btn size="sm" onClick={() => openNeg(o)}><BadgeDollarSign size={14} /> {t('Negotiate')}</Btn>
              <Btn size="sm" variant="primary" disabled={!!st.scheduled} title={st.scheduled ? t('Finish your booked fight first') : ''} onClick={() => { const e = store.act((g) => signContract(g, o.id)); nav.toast(e ? tx(e) : t('Signed with {org}!', { org: ORG[o.orgId].short }), e ? 'err' : 'ok'); }}>{t('Sign')}</Btn>
            </div>
          </div>
        )) : <div className="small muted">{t('No contract offers. Renewal offers arrive when your deal runs out; bigger promotions approach contenders with momentum.')}</div>}
      </div>

      {neg && liveNeg && (
        <Modal title={t('Negotiate with {org}', { org: ORG[liveNeg.orgId].short })} onClose={() => setNeg(null)}>
          <p className="small muted">{t('Current offer: {n} fights · {purse} + {win} · signing {sign}.', { n: liveNeg.fights, purse: money(liveNeg.purse), win: money(liveNeg.winBonus), sign: money(liveNeg.signingBonus) })} {t('Patience:')} {'●'.repeat(Math.max(0, Math.min(3, liveNeg.patience)))}{'○'.repeat(Math.max(0, 3 - Math.min(3, liveNeg.patience)))}</p>
          {([['purse', 'Show money', liveNeg.purse], ['winBonus', 'Win bonus', liveNeg.winBonus], ['signingBonus', 'Signing bonus', Math.max(500, liveNeg.signingBonus)]] as const).map(([k, l, base]) => (
            <div className="field" key={k} style={{ marginBottom: 10 }}>
              <label>{t(l)}: {money(ask[k])} <span className="dim">({t('{n}% vs offer', { n: Math.round((ask[k] / Math.max(1, base) - 1) * 100) })})</span></label>
              <input type="range" min={Math.round(base * 0.8)} max={Math.round(base * 2.2)} step={100} value={ask[k]} onChange={(e) => setAsk({ ...ask, [k]: +e.target.value })} />
            </div>
          ))}
          <div className="field"><label>{t('Number of fights: {n}', { n: ask.fights })}</label><div className="row">{[2, 3, 4, 5, 6].map((n) => <button key={n} className={`chip ${ask.fights === n ? 'on' : ''}`} onClick={() => setAsk({ ...ask, fights: n })}>{n}</button>)}</div>
            <span className="tiny dim">{t('Fewer fights = more freedom but the promoter values longer deals.')}</span></div>
          {reply && <div className="panel tight" style={{ marginTop: 12 }}><b>{t('Promoter:')}</b> <span className="muted">"{tx(reply)}"</span></div>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setNeg(null)}>{t('Close')}</Btn>
            <Btn variant="primary" onClick={() => {
              const r = store.act((g) => negotiate(g, liveNeg.id, ask));
              if (!r) return;
              setReply(r.message);
              if (r.result === 'walked') { nav.toast(tx(r.message), 'err'); setNeg(null); }
              if (r.result === 'accepted') nav.toast(t('They accepted your terms. Sign to lock it in.'), 'ok');
              const updated = store.state!.contractOffers.find((x) => x.id === liveNeg.id);
              if (updated && r.result === 'countered') setAsk({ purse: updated.purse, winBonus: updated.winBonus, signingBonus: updated.signingBonus, fights: updated.fights });
            }}>{t('Propose terms')}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
