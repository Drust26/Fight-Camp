import { endReign, VACATE } from './reigns';
import { SHORTS_COLORS } from '../data/world';
// Contracts & negotiation, sponsors, gyms/coaches and lifestyle spending.
import { RNG, clamp, uid } from './rng';
import { ORG, ORGS } from '../data/world';
import { GYM, LIFESTYLE, SPONSOR, SPONSORS } from '../data/training';
import { overallRating } from './attributes';
import { inbox, ledger, withRng } from './core';
import { playerRank } from './world';
import { addNews, addTimeline } from './history';
import type { Coach, ContractOffer, GameState, OrgId } from './types';

export function leverage(st: GameState, org: OrgId) {
  const p = st.player;
  const ovr = overallRating(p.attrs);
  const lvl = ORG[org].level;
  const fit = clamp((ovr - lvl[0]) / (lvl[1] - lvl[0]), -0.3, 1.3) * 25;
  const rank = playerRank(st);
  const rankB = p.orgId === org && rank !== null ? Math.max(0, 16 - rank) : 0;
  return clamp(p.reputation * 0.35 + p.popularity * 0.3 + fit + rankB + Math.max(0, p.streak) * 3 + (p.isChampion ? 15 : 0) + st.promoterRelation / 5, 0, 100);
}

export function makeContractOffer(st: GameState, rng: RNG, org: OrgId, note: string): ContractOffer {
  const o = ORG[org];
  const lev = leverage(st, org);
  const mult = 0.85 + lev / 220 + (st.player.isChampion ? 0.5 : 0) + st.player.titleDefenses * 0.12;
  const purse = Math.round((o.purse * mult) / 100) * 100;
  return {
    id: uid(rng, 'c'), orgId: org, fights: rng.pick([3, 4, 4, 5]), purse, winBonus: purse, signingBonus: Math.round((purse * (o.tier >= 3 ? 0.5 : 0.25)) / 100) * 100,
    exclusive: o.tier >= 2, champClause: o.tier >= 3, patience: 3, expiresDay: st.day + 14, note,
  };
}

// ───────────────────────────── free-agency bidding war (v1.2)
export const BID_ROUNDS = 3;
const r100 = (n: number) => Math.round(n / 100) * 100;

/** A free agent promotions fight over: champion, top-5 contender, popular, or high leverage. */
export function inDemand(st: GameState) {
  const p = st.player;
  const rank = playerRank(st);
  return p.isChampion || (rank !== null && rank <= 5) || p.popularity >= 45 || leverage(st, p.orgId) >= 60;
}

/** Your promotion and up to two rivals send offers at once, each with a hidden ceiling it can raise to. */
export function startBiddingWar(st: GameState, rng: RNG): boolean {
  const p = st.player;
  const ovr = overallRating(p.attrs);
  const cur = ORG[p.orgId];
  const rivals = ORGS.filter((o) => o.id !== p.orgId && o.tier >= Math.max(2, cur.tier - 1) && o.tier <= cur.tier + 1 && ovr >= o.level[0] - 3)
    .sort((a, b) => b.tier - a.tier).slice(0, 2);
  if (!rivals.length) return false;
  const orgs: OrgId[] = [p.orgId, ...rivals.map((o) => o.id)];
  st.contractOffers = st.contractOffers.filter((c) => !orgs.includes(c.orgId));
  for (const org of orgs) {
    const o = makeContractOffer(st, rng, org, org === p.orgId ? 'Your promotion wants to keep you' : `The ${ORG[org].short} wants to sign you away`);
    if (ORG[org].tier < cur.tier) { o.purse = r100(o.purse * 1.25); o.winBonus = r100(o.winBonus * 1.25); o.signingBonus = r100(o.signingBonus * 1.5); } // paying a premium to lure a star down
    o.expiresDay = st.day + 21;
    o.bid = { max: r100(o.purse * (1.15 + leverage(st, org) / 300 + rng.range(0, 0.15))) };
    st.contractOffers.push(o);
  }
  st.bidRounds = 0;
  inbox(st, 'offer', 'BIDDING WAR', `${orgs.length} promotions want you: ${orgs.map((x) => ORG[x].short).join(', ')}. Sign now, or let them bid for up to ${BID_ROUNDS} rounds: each round they try to outbid each other until they reach their limit.`);
  addNews(st, { kind: 'signing', title: `Bidding war for ${p.firstName} ${p.lastName}`, body: `The free agent is courted by the ${orgs.map((x) => ORG[x].short).join(', ')}.`, refs: ['player'], org: p.orgId, div: p.divisionId, imp: 2 });
  return true;
}

/** One bidding round: every promotion that still can tries to top the best offer; a promotion far behind walks away. */
export function letThemBid(st: GameState, rng: RNG): { ok: boolean; message: string } {
  const bids = st.contractOffers.filter((c) => c.bid);
  if (!bids.length) return { ok: false, message: 'There is no bidding war right now.' };
  if ((st.bidRounds ?? 0) >= BID_ROUNDS || bids.every((c) => c.bid!.final)) return { ok: false, message: 'Every promotion has made its final offer.' };
  st.bidRounds = (st.bidRounds ?? 0) + 1;
  const best = Math.max(...bids.map((c) => c.purse));
  const lines: string[] = [];
  for (const c of bids) {
    const b = c.bid!;
    b.raised = 0;
    if (b.final) { lines.push(`${ORG[c.orgId].short} holds at ${c.purse.toLocaleString()}`); continue; }
    const target = Math.max(c.purse * rng.range(1.04, 1.1), best * rng.range(1.02, 1.08));
    const next = Math.min(b.max, target);
    if (next <= c.purse) { b.final = true; lines.push(`${ORG[c.orgId].short} cannot go higher`); continue; }
    const k = next / c.purse;
    c.purse = r100(next); c.winBonus = r100(c.winBonus * k); c.signingBonus = r100(c.signingBonus * k);
    b.raised = Math.round((k - 1) * 100);
    if (c.purse >= b.max * 0.99) b.final = true;
    c.expiresDay = Math.max(c.expiresDay, st.day + 7);
    lines.push(`${ORG[c.orgId].short} raises to ${c.purse.toLocaleString()}${b.final ? ' (final offer)' : ''}`);
  }
  const top = Math.max(...bids.map((c) => c.purse));
  for (const c of bids) if (bids.length > 2 && c.bid!.final && c.purse < top * 0.8) {
    st.contractOffers = st.contractOffers.filter((x) => x.id !== c.id);
    lines.push(`${ORG[c.orgId].short} drops out`);
    break;
  }
  if (st.bidRounds >= BID_ROUNDS) for (const c of st.contractOffers) if (c.bid) c.bid.final = true;
  return { ok: true, message: lines.join(' · ') };
}

/** Called periodically: contract offers from current promotion (renewal) and from bigger promotions when deserved. */
export function generateContractOffers(st: GameState, rng: RNG) {
  const p = st.player;
  st.contractOffers = st.contractOffers.filter((c) => c.expiresDay >= st.day && c.patience > 0);
  if (!p.isPro || p.retired) return;
  const have = (org: OrgId) => st.contractOffers.some((c) => c.orgId === org);
  const curTier = ORG[p.orgId].tier;
  if (!p.contract && curTier > 1 && p.streak <= -3) {
    const lower = ORGS.find((o) => o.tier === curTier - 1)!;
    if (!have(lower.id) && rng.chance(0.6)) {
      st.contractOffers.push(makeContractOffer(st, rng, lower.id, `${lower.name} will give you a chance to rebuild`));
      inbox(st, 'offer', `${lower.short} contract offer`, `After your release, the ${lower.name} offers you a deal to rebuild.`);
    }
    return;
  }
  const freeAgent = !p.contract || p.contract.fightsLeft === 0;
  if (st.contractOffers.some((c) => c.bid)) return; // a bidding war is running: no side offers
  if (freeAgent && st.bidRounds === undefined && inDemand(st) && rng.chance(0.6) && startBiddingWar(st, rng)) return;
  if ((!p.contract || p.contract.fightsLeft === 0) && !have(p.orgId) && rng.chance(0.5)) {
    st.contractOffers.push(makeContractOffer(st, rng, p.orgId, 'Renewal offer from your current promotion'));
    inbox(st, 'offer', 'Contract renewal offer', `The ${ORG[p.orgId].name} wants to re-sign you.`);
  }
  // step-up interest
  const rank = playerRank(st);
  const nextOrg = ORGS.find((o) => o.tier === curTier + 1);
  const ready = !!nextOrg && overallRating(p.attrs) >= nextOrg.level[0] - 1;
  const deserving = ready && (p.isChampion || (rank !== null && rank <= 3 && p.streak >= 3) || (rank !== null && rank <= 6 && p.streak >= 5));
  if (deserving && curTier < 5) {
    const target = nextOrg!;
    if (!have(target.id) && rng.chance(0.35)) {
      st.contractOffers.push(makeContractOffer(st, rng, target.id, `${target.name} scouts want you on their roster`));
      inbox(st, 'offer', `${target.short} contract offer`, `The ${target.name} has sent you a contract offer. ${target.desc}`);
    }
  }
  // rival promotion poaching for stars
  if (p.isChampion && curTier === 4 && !have('acl') && rng.chance(0.3)) {
    st.contractOffers.push(makeContractOffer(st, rng, 'acl', 'The Hexagon Fighting Championship wants the best in the world'));
  }
}

export function buyoutCost(st: GameState) {
  const c = st.player.contract;
  if (!c || c.amateur || c.fightsLeft <= 1) return 0;
  return Math.round(c.fightsLeft * c.purse * 0.5);
}

export function signContract(st: GameState, offerId: string): string | null {
  const off = st.contractOffers.find((c) => c.id === offerId);
  if (!off) return 'Offer not found.';
  const p = st.player;
  if (st.scheduled) return 'Finish your booked fight first.';
  const buy = p.contract && p.contract.orgId !== off.orgId ? buyoutCost(st) : 0;
  if (buy > 0 && p.money < buy) return `You need ${buy.toLocaleString()} to buy out your current contract.`;
  if (buy > 0) ledger(st, -buy, 'Contract buyout', 'other');
  const moving = p.orgId !== off.orgId;
  if (moving && p.isChampion) {
    endReign(st, p.orgId, p.divisionId, VACATE.leftOrg(p.orgId, off.orgId));
    const os = st.world.orgs[p.orgId];
    os.champions[p.divisionId] = null;
    p.isChampion = false;
    inbox(st, 'news', 'Belt vacated', `You left the ${ORG[p.orgId].short} — your title is vacated.`);
  }
  p.contract = { orgId: off.orgId, fightsTotal: off.fights, fightsLeft: off.fights, purse: off.purse, winBonus: off.winBonus, signingBonus: off.signingBonus, exclusive: off.exclusive, champClause: off.champClause, amateur: false, signedDay: st.day };
  if (off.signingBonus) ledger(st, off.signingBonus, `Signing bonus — ${ORG[off.orgId].short}`, 'bonus');
  if (moving) {
    p.orgId = off.orgId;
    const lvl = ORG[off.orgId].level;
    p.rankPoints = Math.max(2, Math.round((overallRating(p.attrs) - lvl[0]) * 2));
    st.offers = [];
    st.promoterRelation = 5;
    st.declinedOffers = 0;
  }
  st.contractOffers = st.contractOffers.filter((c) => c.id !== offerId && !(off.bid && c.bid)); // the other bidders withdraw
  if (off.bid) addNews(st, { kind: 'signing', title: `${p.firstName} ${p.lastName} signs with the ${ORG[off.orgId].short} after a bidding war`, body: `${off.fights} fights at ${off.purse.toLocaleString()} + ${off.winBonus.toLocaleString()} per win.`, refs: ['player'], org: off.orgId, div: p.divisionId, imp: 2 });
  st.bidRounds = undefined;
  inbox(st, 'offer', `Signed with ${ORG[off.orgId].short}`, `${off.fights} fights at ${off.purse.toLocaleString()} + ${off.winBonus.toLocaleString()} win bonus.`);
  addTimeline(st, 'contract', `${moving ? 'Signed with' : 'Re-signed with'} the ${ORG[off.orgId].name}: ${off.fights} fights at ${off.purse.toLocaleString()}/${off.winBonus.toLocaleString()}.`);
  if (moving && ORG[off.orgId].tier >= 3) addNews(st, { kind: 'signing', title: `${p.firstName} ${p.lastName} signs with the ${ORG[off.orgId].short}`, body: `${p.record.w}-${p.record.l} ${p.divisionId} fighter inks a ${off.fights}-fight deal.`, refs: ['player'], org: off.orgId, div: p.divisionId, imp: 2 });
  return null;
}

export interface Ask { purse: number; winBonus: number; signingBonus: number; fights: number }

/** Negotiation: promoter tolerance grows with leverage. Pushing too hard burns patience. */
export function negotiate(st: GameState, offerId: string, ask: Ask): { result: 'accepted' | 'countered' | 'rejected' | 'walked'; message: string } {
  const off = st.contractOffers.find((c) => c.id === offerId);
  if (!off) return { result: 'walked', message: 'Offer no longer available.' };
  return withRng(st, (rng) => {
    const lev = leverage(st, off.orgId);
    const demand = ((ask.purse / off.purse - 1) * 0.55 + (ask.winBonus / Math.max(1, off.winBonus) - 1) * 0.3 + ((ask.signingBonus - off.signingBonus) / Math.max(1, off.purse)) * 0.3) * 100
      + (off.fights - ask.fights) * 4;
    const tol = 4 + lev * 0.32 + rng.range(-3, 3);
    if (demand <= tol) {
      Object.assign(off, ask);
      off.lastResponse = 'Deal. Sign whenever you\'re ready.';
      off.patience = 99;
      return { result: 'accepted' as const, message: off.lastResponse };
    }
    if (demand <= tol * 2.1 + 6) {
      off.patience -= 1;
      const k = 0.5;
      off.purse = Math.round((off.purse + (ask.purse - off.purse) * k * (tol / demand)) / 100) * 100;
      off.winBonus = Math.round((off.winBonus + (ask.winBonus - off.winBonus) * k * (tol / demand)) / 100) * 100;
      off.signingBonus = Math.round((off.signingBonus + (ask.signingBonus - off.signingBonus) * 0.4 * (tol / demand)) / 100) * 100;
      off.lastResponse = off.patience > 0 ? `We can't do that. Best we can do is ${off.purse.toLocaleString()} + ${off.winBonus.toLocaleString()}.` : 'We\'re done here.';
      if (off.patience <= 0) {
        st.contractOffers = st.contractOffers.filter((c) => c.id !== offerId);
        return { result: 'walked' as const, message: 'The promoter walked away from the table.' };
      }
      return { result: 'countered' as const, message: off.lastResponse };
    }
    off.patience -= 2;
    if (off.patience <= 0) {
      st.contractOffers = st.contractOffers.filter((c) => c.id !== offerId);
      st.promoterRelation = clamp(st.promoterRelation - 4, -50, 50);
      return { result: 'walked' as const, message: '"A fighter with your résumé asking for that? Goodbye."' };
    }
    off.lastResponse = 'That\'s not a serious number for a fighter at your level.';
    return { result: 'rejected' as const, message: off.lastResponse };
  });
}

export function turnPro(st: GameState): string | null {
  const p = st.player;
  if (p.isPro) return 'Already professional.';
  if (st.scheduled) return 'Finish your booked amateur bout first.';
  if (p.amateurRecord.w + p.amateurRecord.l < 2) return 'Get at least two amateur fights first.';
  p.isPro = true;
  p.orgId = 'ifc';
  p.contract = { orgId: 'ifc', fightsTotal: 3, fightsLeft: 3, purse: ORG.ifc.purse, winBonus: ORG.ifc.winBonus, signingBonus: 0, exclusive: false, champClause: false, amateur: false, signedDay: st.day };
  p.rankPoints = 4 + p.amateurRecord.w * 2;
  st.offers = [];
  addTimeline(st, 'pro', `Turned professional with an amateur record of ${p.amateurRecord.w}-${p.amateurRecord.l}.`);
  inbox(st, 'news', 'You turned professional!', `Amateur record ${p.amateurRecord.w}-${p.amateurRecord.l}. Your first pro deal with the IFC: 3 fights, ${ORG.ifc.purse}/${ORG.ifc.winBonus}.`);
  return null;
}

// ───────────────────────────── sponsors
export function generateSponsorOffers(st: GameState, rng: RNG) {
  const p = st.player;
  st.sponsorOffers = st.sponsorOffers.filter((o) => o.expiresDay >= st.day);
  if (st.sponsors.length + st.sponsorOffers.length >= 3) return;
  const eligible = SPONSORS.filter((s) => p.popularity >= s.minPop && !st.sponsors.some((d) => d.sponsorId === s.id) && !st.sponsorOffers.some((o) => o.sponsorId === s.id));
  if (!eligible.length || !rng.chance(0.3 + st.sponsorBuzz * 0.12)) return;
  st.sponsorBuzz = Math.max(0, st.sponsorBuzz - 1);
  const s = eligible[eligible.length - 1 - Math.min(eligible.length - 1, rng.int(0, 1))];
  const monthly = Math.round((s.base * (0.85 + p.popularity / 160)) / 10) * 10;
  const premium = s.minPop >= 50;
  st.sponsorOffers.push({
    id: uid(rng, 's'), sponsorId: s.id, monthly, winBonus: Math.round(monthly * 0.5), finishBonus: s.id === 'pulse' ? monthly : premium ? Math.round(monthly * 0.4) : 0,
    months: rng.pick([6, 12]), dropOnLosses: premium ? 2 : 0, expiresDay: st.day + 21,
  });
  inbox(st, 'finance', 'Sponsorship offer', `${s.name} (${s.kind}) wants to sponsor you: ${monthly.toLocaleString()}/month.`);
}

export function acceptSponsor(st: GameState, id: string): string | null {
  const o = st.sponsorOffers.find((x) => x.id === id);
  if (!o) return 'Offer not found.';
  if (st.sponsors.length >= 3) return 'You can carry at most three sponsors.';
  st.sponsors.push({ id: o.id, sponsorId: o.sponsorId, monthly: o.monthly, winBonus: o.winBonus, finishBonus: o.finishBonus, monthsLeft: o.months, dropOnLosses: o.dropOnLosses });
  st.sponsorOffers = st.sponsorOffers.filter((x) => x.id !== id);
  inbox(st, 'finance', 'Sponsor signed', `${SPONSOR[o.sponsorId].name} is now on your banner.`);
  return null;
}
export function declineSponsor(st: GameState, id: string) {
  st.sponsorOffers = st.sponsorOffers.filter((x) => x.id !== id);
}
export function dropSponsor(st: GameState, id: string) {
  st.sponsors = st.sponsors.filter((x) => x.id !== id);
}

// ───────────────────────────── gyms & coaches & lifestyle
export function canJoinGym(st: GameState, gymId: string): string | null {
  const g = GYM[gymId];
  const p = st.player;
  if (p.gymId === gymId) return 'You already train here.';
  if (p.reputation < g.minReputation) return `They only take fighters with ${g.minReputation}+ reputation.`;
  if (p.money < g.fee) return `You need ${g.fee.toLocaleString()} for the first month.`;
  if (st.scheduled && st.scheduled.day - st.day <= 10) return 'Too close to fight night to switch camps.';
  return null;
}
export function joinGym(st: GameState, gymId: string): string | null {
  const err = canJoinGym(st, gymId);
  if (err) return err;
  const g = GYM[gymId];
  st.player.gymId = gymId;
  if (st.player.coaches.length) inbox(st, 'training', 'Coaches stayed behind', 'Your personal coaches were tied to your old gym.');
  st.player.coaches = [];
  ledger(st, -g.fee, `Joining fee — ${g.name}`, 'gym');
  inbox(st, 'training', `Joined ${g.name}`, `${g.specialty}. Monthly fee ${g.fee.toLocaleString()}.`);
  return null;
}
export function hireCoach(st: GameState, coachId: string): string | null {
  const g = GYM[st.player.gymId];
  const c = g.coaches.find((x) => x.id === coachId);
  if (!c) return 'Coach not available at your gym.';
  const p = st.player;
  if (p.coaches.some((x) => x.id === c.id)) return 'Already hired.';
  if (p.coaches.some((x) => x.specialty === c.specialty)) return `You already have a ${c.specialty} coach.`;
  if (p.money < c.fee) return `Need ${c.fee.toLocaleString()} for the first month.`;
  const coach: Coach = { ...c };
  p.coaches.push(coach);
  ledger(st, -c.fee, `First month — ${c.name}`, 'coach');
  return null;
}
export function fireCoach(st: GameState, coachId: string) {
  st.player.coaches = st.player.coaches.filter((c) => c.id !== coachId);
}
export function setLifestyle(st: GameState, key: 'housing' | 'nutrition', level: 0 | 1 | 2) {
  st.player.lifestyle[key] = level;
}
export function togglePhysio(st: GameState) {
  st.player.lifestyle.physio = !st.player.lifestyle.physio;
}
export function buyHomeGym(st: GameState): string | null {
  if (st.player.lifestyle.homeGym) return 'Already owned.';
  if (st.player.money < LIFESTYLE.homeGym.cost) return 'Not enough money.';
  st.player.lifestyle.homeGym = true;
  ledger(st, -LIFESTYLE.homeGym.cost, 'Home gym equipment', 'equipment');
  return null;
}
export function treatInjury(st: GameState, injId: string): string | null {
  const inj = st.player.injuries.find((i) => i.id === injId);
  if (!inj) return 'No such injury.';
  if (inj.treated) return 'Already treated.';
  const cost = treatmentCost(st, injId);
  if (st.player.money < cost) return 'Not enough money for treatment.';
  inj.treated = true;
  inj.daysLeft = Math.ceil(inj.daysLeft * 0.75);
  ledger(st, -cost, 'Medical treatment', 'medical');
  return null;
}
export function treatmentCost(st: GameState, injId: string) {
  const inj = st.player.injuries.find((i) => i.id === injId);
  if (!inj) return 0;
  const base: Record<string, number> = { ribs: 250, hand: 600, ankle: 300, knee: 2500, cut: 150, shoulder: 450, concussion: 800, swelling: 60 };
  return Math.round((base[inj.type] ?? 300) * (0.7 + inj.severity * 0.3));
}

export const SHORTS_PRICE = 200;
export function buyShorts(st: GameState, color: number): string | null {
  if (st.player.money < SHORTS_PRICE) return 'Not enough money.';
  st.player.appearance.shorts = color;
  if (st.player.appearance.look) st.player.appearance.look.attire.shorts = SHORTS_COLORS[color] ?? st.player.appearance.look.attire.shorts;
  ledger(st, -SHORTS_PRICE, 'New fight shorts', 'lifestyle');
  return null;
}
void GYM;
