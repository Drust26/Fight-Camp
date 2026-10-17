// Fight offers, booking, weigh-ins, fight setup (effective attributes), and post-fight consequences.
import { ATTR_KEYS, overallRating, unpackAttrs, type AttrKey, type Attributes } from './attributes';
import { RNG, clamp, uid } from './rng';
import { DIV, ORG, STYLE } from '../data/world';
import { GYM, INJURIES, LIFESTYLE, SPONSOR } from '../data/training';
import { fighterName, genFighter, recStr, wfAppearance } from './fighterGen';
import { CITIES, playerRank, pointsFor, rankings, recordResult } from './world';
import { divLimitKg, fmtDate, fmtDateEn, gymCoachBonus, inbox, ledger, moneyEn, withRng } from './core';
import { addInjury, injuredAttrs } from './training';
import type { FighterSetup, FightState, RoundStats } from '../combat/engine';
import { sumStats } from '../combat/engine';
import type { CampFocus, FightOffer, FightResultSummary, FightStatsTotals, GameState, GamePlanId, Method, OrgId, DivisionId, ScheduledFight, WorldFighter } from './types';
import { checkAchievements } from './achievements';
import { addNews, addTimeline, recordBout } from './history';
import { buildCard, eventRecap, releaseCard, resolveCard } from './eventcard';
import { roundSummaries } from './fightrec';
import { pruneEvents } from './events';
import { currentReign, endReign, recordDefense, startReign } from './reigns';
import { posterMetaFor } from './poster';
import { defensesUntilSuperfight, markOffered, onSuperfightWin, superfightDate, superfightDivision, superfightOpponent, superfightPitch } from './superfight';
import { postFightLines } from './announcer';
import { beltsOf, invaderFor } from './living';

export const CAMP_FOCUS: { id: CampFocus; name: string; desc: string }[] = [
  { id: 'general', name: 'General Camp', desc: 'Balanced preparation. Small sharpness bonus.' },
  { id: 'opponent', name: 'Opponent-Specific', desc: 'Prep points count 50% more toward fight-night bonuses.' },
  { id: 'wrestling_def', name: 'Defensive Wrestling', desc: '+5 takedown defense & balance on fight night vs grapplers.' },
  { id: 'striking_def', name: 'Striking Defense', desc: '+4 head movement & blocking on fight night vs strikers.' },
  { id: 'southpaw', name: 'Southpaw Preparation', desc: '+4 accuracy & distance vs a southpaw.' },
  { id: 'cardio', name: 'Gas-Tank Camp', desc: '+4 endurance & cardio on fight night.' },
  { id: 'weight', name: 'Weight-Management Camp', desc: 'Easier weight cut: cut stress reduced by a third.' },
];

const GRAPPLER_STYLES = ['wrestler', 'submission', 'gnp', 'clinch'];

export function eventName(rng: RNG, org: OrgId, eventNo: number) {
  const o = ORG[org];
  const kinds = o.tier >= 4 ? [`${o.short} ${eventNo}`, `${o.short} Fight Night: ${rng.pick(CITIES)}`] : [`${o.short} ${eventNo}: ${rng.pick(CITIES)}`, `${o.short} Fight Night ${eventNo}`];
  return rng.pick(kinds);
}

export function playerOvr(st: GameState) {
  return overallRating(st.player.attrs);
}

/** Choose an opponent from the organisation roster near the player's standing. */
function pickOpponent(st: GameState, rng: RNG, org: OrgId, opts: { stronger?: boolean } = {}): WorldFighter | null {
  const p = st.player;
  const ranks = rankings(st, org, p.divisionId);
  const myRow = ranks.find((r) => r.isPlayer);
  const myOvr = playerOvr(st);
  const champId = st.world.orgs[org].champions[p.divisionId];
  const cand = Object.values(st.world.fighters).filter((f) => f.org === org && f.div === p.divisionId && !f.retired && !f.am && f.id !== champId
    && f.injuredUntil < st.day + 20 && f.bookedUntil <= st.day && st.day - f.lastFight > 21);
  if (!cand.length) return null;
  return rng.weighted(cand, (f) => {
    const r = ranks.find((x) => x.id === f.id)?.rank ?? 30;
    const rankGap = myRow ? Math.abs(r - (myRow.rank - (opts.stronger ? 2 : 0))) : r < 6 ? 6 : 1;
    const ovr = overallRating(unpackAttrs(f.a));
    const target = myOvr + (opts.stronger ? 4 : 0) - (p.record.w + p.record.l < 3 ? 2 : 0);
    const gapPen = Math.max(0, ovr - target) * 0.55 + Math.max(0, target - ovr) * 0.18;
    const rival = (st.rivalries[f.id] ?? 0) > 30 ? 3 : 1;
    if (st.callout === f.id) return 400; // the player publicly called this fighter out
    return (rival * 10) / (1 + rankGap * 0.4 + gapPen * gapPen * 0.35);
  });
}

function amateurOpponent(st: GameState, rng: RNG): WorldFighter {
  const p = st.player;
  const lvl = clamp(playerOvr(st) + rng.int(-5, 3), 25, 55);
  const f = genFighter(rng, { org: 'ifc', div: p.divisionId, level: lvl, day: st.day, tier: 0, ageRange: [18, 26] });
  f.am = true;
  f.rec = { w: rng.int(0, 4), l: rng.int(0, 3), d: 0, ko: 0, tko: 0, sub: 0, dec: 0, lossKo: 0, lossSub: 0, lossDec: 0 };
  f.rec.dec = f.rec.w;
  st.world.fighters[f.id] = f;
  return f;
}

export function makeOffer(st: GameState, rng: RNG, opts: { shortNotice?: boolean; title?: boolean; opponentId?: string; note?: string; org?: OrgId; div?: DivisionId; superfight?: boolean } = {}): FightOffer | null {
  const p = st.player;
  if (p.retired || st.scheduled) return null;
  const amateur = !p.isPro;
  const org: OrgId = opts.org ?? p.orgId;
  let opp: WorldFighter | null;
  if (opts.opponentId) opp = st.world.fighters[opts.opponentId] ?? null;
  else if (amateur) opp = amateurOpponent(st, rng);
  else opp = pickOpponent(st, rng, org);
  if (!opp) return null;
  const notice = opts.shortNotice ? rng.int(8, 13) : rng.int(24, 46);
  let day = st.day + notice;
  if (p.medicalSuspensionUntil > day) day = p.medicalSuspensionUntil + 7;
  const c = p.contract;
  const base = amateur ? 0 : c && c.orgId === org ? c.purse : ORG[org].purse;
  const winB = amateur ? 0 : c && c.orgId === org ? c.winBonus : ORG[org].winBonus;
  const rivalry = (st.rivalries[opp.id] ?? 0) >= 30;
  const mult = (opts.shortNotice ? 1.4 : 1) * (rivalry ? 1.25 : 1) * (opts.title ? 2 : 1) * (opts.superfight ? 1.6 : 1);
  const os = st.world.orgs[org];
  const offer: FightOffer = {
    id: uid(rng, 'o'),
    orgId: org,
    opponentId: opp.id,
    eventName: amateur ? `IFC Amateur Showcase ${os.eventNo}` : eventName(rng, org, os.eventNo + Math.floor((day - st.day) / ORG[org].eventEveryDays)),
    day,
    rounds: opts.title ? 5 : 3,
    purse: Math.round(base * mult),
    winBonus: Math.round(winB * mult),
    title: !!opts.title,
    shortNotice: !!opts.shortNotice,
    expiresDay: st.day + (opts.shortNotice ? 3 : 7),
    amateur,
    rivalry,
    note: opts.note,
  };
  if (opts.div && opts.div !== p.divisionId) offer.div = opts.div;
  if (opts.superfight) { offer.superfight = true; offer.expiresDay = st.day + 10; }
  return offer;
}

/** Natural flow of offers from the player's promotion. */
export function generateOffers(st: GameState, rng: RNG) {
  const p = st.player;
  if (p.retired || st.scheduled || p.pendingBeltChoice || st.pending.some((e) => e.templateId === 'shortnotice')) return;
  st.offers = st.offers.filter((o) => {
    const f = st.world.fighters[o.opponentId];
    if (o.superfight) { const ch = st.world.orgs[o.orgId].champions[o.div ?? p.divisionId]; if (ch && ch !== o.opponentId) return false; }
    return o.expiresDay >= st.day && !!f && !f.retired && (o.superfight || f.bookedUntil <= st.day); });
  // HFC superfight: once the required consecutive defenses are reached it is ALWAYS on the table — no rest period,
  // no random chance, no limit on open offers. A regular defense offer is still generated alongside it as usual.
  if (p.isPro && !p.retired && st.world.orgs[p.orgId]?.champions[p.divisionId] === 'player' && !st.offers.some((o) => o.superfight)) {
    const sf = superfightDivision(st);
    if (sf && defensesUntilSuperfight(st) === 0) {
      const oppId = superfightOpponent(st, sf.div);
      const so = oppId ? makeOffer(st, rng, { title: true, opponentId: oppId, div: sf.div, superfight: true, note: `Superfight — ${DIV[sf.div].name} title` }) : null;
      if (so) {
        so.day = superfightDate(st, so.opponentId, so.day);
        so.expiresDay = st.day + 14;
        st.offers.unshift(so);
        inbox(st, 'offer', 'SUPERFIGHT OFFER', superfightPitch(st, sf.div, sf.level, so.opponentId));
      }
    }
  }
  if (st.offers.filter((o) => !o.superfight).length >= 2) return;
  if (p.isPro && !p.contract) return; // free agents must sign first
  const gap = 6 + Math.max(0, -st.promoterRelation) / 4;
  if (st.day - st.lastOfferDay < gap) return;
  // fighters need time between bouts: bigger promotions book less often
  const lastFight = p.history[0] && p.history[0].id !== st.restWaivedFor ? p.history[0].day : -999;
  const rest = p.isPro ? 24 + ORG[p.orgId].tier * 8 : 20;
  if (st.day - lastFight < rest) return;
  if (!rng.chance(st.offers.length ? 0.25 : 0.55)) return;
  // title shot / defense logic
  if (p.isPro) {
    const champId = st.world.orgs[p.orgId].champions[p.divisionId];
    const rank = playerRank(st);
    if (champId === 'player') {
      // living world: a dominant champion from the next division comes for the player's belt
      const inv = invaderFor(st);
      if (inv && !st.offers.some((o) => o.invader) && rng.chance(0.4)) {
        const io = makeOffer(st, rng, { title: true, opponentId: inv.id, note: `Champion vs champion: the ${DIV[inv.div].name} champion wants your belt` });
        if (io) {
          io.invader = inv.div;
          io.purse = Math.round(io.purse * 1.3); io.winBonus = Math.round(io.winBonus * 1.3);
          inv.sfx = st.day;
          st.offers.push(io); st.lastOfferDay = st.day;
          const up = Object.keys(DIV).indexOf(p.divisionId) > Object.keys(DIV).indexOf(inv.div);
          inbox(st, 'offer', 'CHAMPION VS CHAMPION', `${fighterName(inv)} (${recStr(inv.rec)}), the ${ORG[p.orgId].short} ${DIV[inv.div].name} champion with ${inv.rdf ?? 0} straight defenses, is moving ${up ? 'up' : 'down'} to challenge you for your ${DIV[p.divisionId].name} title on ${fmtDateEn(io.day)}. If he wins, he holds two belts.`);
          addNews(st, { kind: 'superfight', title: `${fighterName(inv)} calls out ${p.firstName} ${p.lastName}`, body: `The ${ORG[p.orgId].short} ${DIV[inv.div].name} champion wants a champion-vs-champion fight for the ${DIV[p.divisionId].name} title.`, refs: [inv.id, 'player'], org: p.orgId, div: p.divisionId, imp: 2 });
          return;
        }
      }
      const top = rankings(st, p.orgId, p.divisionId).filter((r) => !r.isPlayer && !r.injured).slice(0, 3);
      const o = top.length ? makeOffer(st, rng, { title: true, opponentId: rng.pick(top).id, note: 'Mandatory title defense' }) : null;
      if (o) { st.offers.push(o); st.lastOfferDay = st.day; inbox(st, 'offer', 'Title defense offer', `${ORG[o.orgId].short} wants you to defend your belt on ${fmtDateEn(o.day)}.`); }
      return;
    }
    if (champId && rank !== null && ((rank <= 2 && p.streak >= 2) || (st.titlePush && rank <= 3 && p.streak >= 1))) {
      const champ = st.world.fighters[champId];
      if (champ && champ.injuredUntil < st.day + 30 && champ.bookedUntil <= st.day) {
        const o = makeOffer(st, rng, { title: true, opponentId: champId, note: 'Championship opportunity!' });
        if (o) { st.offers.push(o); st.lastOfferDay = st.day; inbox(st, 'offer', 'TITLE SHOT OFFER', `The ${ORG[o.orgId].name} is offering you a shot at ${fighterName(champ)}'s belt on ${fmtDateEn(o.day)}.`); }
        return;
      }
    }
    if (!champId && rank !== null && rank <= 2) {
      const top = rankings(st, p.orgId, p.divisionId).filter((r) => !r.isPlayer && !r.injured && !r.champion)[0];
      if (top) {
        const o = makeOffer(st, rng, { title: true, opponentId: top.id, note: 'For the vacant title' });
        if (o) { st.offers.push(o); st.lastOfferDay = st.day; inbox(st, 'offer', 'Vacant title fight', `Fight ${top.name} for the vacant ${ORG[o.orgId].short} belt.`); }
        return;
      }
    }
  }
  const o = makeOffer(st, rng);
  if (o) {
    st.offers.push(o);
    st.lastOfferDay = st.day;
    const opp = st.world.fighters[o.opponentId];
    inbox(st, 'offer', 'New fight offer', `${fighterName(opp)} (${recStr(opp.rec)}) at ${o.eventName}, ${fmtDateEn(o.day)}.`);
  }
}

export function canAccept(st: GameState, o: FightOffer): string | null {
  const p = st.player;
  if (p.retired) return 'You are retired.';
  if (st.scheduled) return 'You already have a fight booked.';
  if (o.expiresDay < st.day) return 'This offer has expired.';
  if (p.medicalSuspensionUntil > o.day) return `Medically suspended until ${fmtDateEn(p.medicalSuspensionUntil)}.`;
  if (o.day <= st.day) return 'The fight date has passed.';
  const opp = st.world.fighters[o.opponentId];
  if (!opp || opp.retired) return 'Opponent no longer available.';
  if (o.superfight) {
    const champ = st.world.orgs[o.orgId].champions[o.div ?? st.player.divisionId];
    if (champ && champ !== o.opponentId && champ !== 'player') return 'That division has a new champion — a new superfight offer will follow.';
    if (opp.bookedUntil > o.day - 7) return 'Opponent has taken another fight.';
  } else if (opp.bookedUntil > st.day) return 'Opponent has taken another fight.';
  return null;
}

export function acceptOffer(st: GameState, offerId: string, camp: CampFocus): string | null {
  const o = st.offers.find((x) => x.id === offerId);
  if (!o) return 'Offer not found.';
  const err = canAccept(st, o);
  if (err) return err;
  const opp = st.world.fighters[o.opponentId];
  st.scheduled = { ...o, acceptedDay: st.day, campFocus: camp, prep: 0, gamePlan: defaultPlan(st), mediaDone: false };
  opp.bookedUntil = o.day + 1;
  st.scheduled.card = withRng(st, (rng) => buildCard(st, rng, o));
  if (st.callout === o.opponentId) st.callout = null;
  if (o.title) st.titlePush = false;
  st.offers = [];
  st.promoterRelation = clamp(st.promoterRelation + 2, -50, 50);
  inbox(st, 'offer', 'Fight booked', `You will face ${fighterName(opp)} at ${o.eventName} on ${fmtDateEn(o.day)}. Camp focus: ${CAMP_FOCUS.find((c) => c.id === camp)!.name}.`);
  return null;
}

export function declineOffer(st: GameState, offerId: string) {
  const o = st.offers.find((x) => x.id === offerId);
  if (!o) return;
  st.offers = st.offers.filter((x) => x.id !== offerId);
  if (o.superfight) markOffered(st); // turned down: offered again after two more defenses
  const opp = st.world.fighters[o.opponentId];
  const reasonable = opp && overallRating(unpackAttrs(opp.a)) <= playerOvr(st) + 6;
  if (reasonable && !o.shortNotice && !o.superfight) {
    st.declinedOffers++;
    st.promoterRelation = clamp(st.promoterRelation - 3 - Math.max(0, st.declinedOffers - 2), -50, 50);
  }
}

export function withdrawFromFight(st: GameState) {
  const sc = st.scheduled;
  if (!sc) return;
  const opp = st.world.fighters[sc.opponentId];
  if (opp) opp.bookedUntil = st.day;
  releaseCard(st);
  const injured = st.player.injuries.length > 0;
  st.promoterRelation = clamp(st.promoterRelation - (injured ? 4 : 12), -50, 50);
  st.player.popularity = clamp(st.player.popularity - (injured ? 1 : 3), 0, 100);
  st.scheduled = null;
  pruneEvents(st);
  st.fightInProgress = null;
  inbox(st, 'news', 'Withdrew from fight', injured ? 'You pulled out injured. The promoter understands, mostly.' : 'You withdrew without a medical reason. The promoter is not happy.');
}

export function defaultPlan(st: GameState): GamePlanId {
  const bg = st.player.background;
  return bg === 'wrestling' ? 'wrestling' : bg === 'bjj' ? 'submission' : bg === 'boxing' ? 'pressure' : bg === 'kickboxing' ? 'distance' : bg === 'muaythai' || bg === 'judo' ? 'clinch' : 'balanced';
}

// ─────────────────────────────────────── weigh-in
export function weightCutInfo(st: GameState) {
  const p = st.player;
  const limit = (st.scheduled?.div ? DIV[st.scheduled.div].kg : divLimitKg(st)) + (st.scheduled?.title ? 0 : 0.45);
  const need = Math.max(0, p.weightKg - limit);
  let pct = need / p.weightKg;
  if (st.scheduled?.campFocus === 'weight') pct *= 0.67;
  const nut = LIFESTYLE.nutrition[p.lifestyle.nutrition].weight;
  const missChance = pct <= 0.06 ? 0 : clamp(((pct - 0.06) / 0.05) * (1.2 - p.attrs.discipline / 200 - nut * 0.3), 0, 0.97);
  const penalty = Math.max(0, pct - 0.045) * 3.2;
  const label = pct <= 0.03 ? 'Easy' : pct <= 0.06 ? 'Manageable' : pct <= 0.09 ? 'Hard' : 'Dangerous';
  return { limit, need, pct, missChance, penalty, label };
}

export function doWeighIn(st: GameState, rng: RNG) {
  const sc = st.scheduled;
  if (!sc || sc.weighIn) return;
  const w = weightCutInfo(st);
  const made = !rng.chance(w.missChance);
  sc.weighIn = { madeWeight: made, weightKg: made ? Math.min(st.player.weightKg, w.limit) : w.limit + w.need * 0.35, limitKg: w.limit, cutPct: w.pct };
  inbox(st, 'news', made ? 'Weigh-in: on weight' : 'Weigh-in: MISSED WEIGHT', made
    ? `You made weight (${sc.weighIn.weightKg.toFixed(1)} kg). Cut difficulty: ${w.label}.`
    : `You came in at ${sc.weighIn.weightKg.toFixed(1)} kg — over the ${w.limit.toFixed(1)} kg limit. 20% of your purse goes to your opponent and you'll be drained on fight night.`);
}

// ─────────────────────────────────────── fight setup
export function opponentSetup(st: GameState, oppId: string, title: boolean): FighterSetup {
  const f = st.world.fighters[oppId];
  const a = unpackAttrs(f.a);
  if (f.injuredUntil > st.day) for (const k of ['speed', 'explosiveness', 'endurance'] as AttrKey[]) a[k] -= 4;
  return {
    name: fighterName(f), short: f.last, attrs: a, heightCm: f.h, reachCm: f.r, stance: f.stance, style: f.style,
    plan: STYLE[f.style].plan, appearance: wfAppearance(f), isPlayer: false, record: recStr(f.rec),
    staminaMult: 1, regenMult: 1,
  };
}

/** Player's fight-night attributes: injuries, fatigue, sharpness, preparation, camp focus and the weight cut. */
export function playerFightAttrs(st: GameState): { attrs: Attributes; staminaMult: number; regenMult: number; notes: string[] } {
  const p = st.player;
  const sc = st.scheduled;
  const a = injuredAttrs(p);
  const notes: string[] = [];
  const add = (keys: AttrKey[], v: number) => keys.forEach((k) => (a[k] = clamp(a[k] + v, 1, 99)));
  for (const inj of p.injuries) notes.push(`Injured: ${INJURIES[inj.type].name}`);
  if (p.fatigue > 35) {
    const pen = (p.fatigue - 35) / 7;
    add(['speed', 'explosiveness', 'endurance', 'cardio', 'agility', 'strength'], -pen);
    notes.push(`Fatigued (−${pen.toFixed(1)} physical)`);
  }
  const sharp = (p.sharpness - 40) / 20; // −2..+3
  add(['fightIQ', 'composure', 'combos', 'counter', 'distance'], sharp);
  notes.push(`Sharpness ${Math.round(p.sharpness)}% (${sharp >= 0 ? '+' : ''}${sharp.toFixed(1)} timing)`);
  let staminaMult = 1, regenMult = 1;
  if (sc) {
    const opp = st.world.fighters[sc.opponentId];
    const prepEff = sc.prep * (sc.campFocus === 'opponent' ? 1.5 : 1);
    const pb = Math.min(6, prepEff / 18);
    if (pb > 0.2) {
      add(['fightIQ', 'adaptability'], pb);
      if (opp && GRAPPLER_STYLES.includes(opp.style)) add(['tdDefense', 'subDefense', 'bottomDefense'], pb * 0.7);
      else add(['headMovement', 'blocking', 'distance'], pb * 0.7);
      notes.push(`Opponent preparation ${Math.round(sc.prep)}% (+${pb.toFixed(1)} reads)`);
    }
    if (sc.campFocus === 'wrestling_def' && opp && GRAPPLER_STYLES.includes(opp.style)) { add(['tdDefense', 'balance'], 5); notes.push('Defensive wrestling camp: +5 TDD'); }
    if (sc.campFocus === 'striking_def' && opp && !GRAPPLER_STYLES.includes(opp.style)) { add(['headMovement', 'blocking'], 4); notes.push('Striking defense camp: +4'); }
    if (sc.campFocus === 'southpaw' && opp?.stance === 'southpaw') { add(['punchAccuracy', 'kickAccuracy', 'distance'], 4); notes.push('Southpaw prep pays off: +4 accuracy'); }
    if (sc.campFocus === 'cardio') { add(['endurance', 'cardio'], 4); notes.push('Gas-tank camp: +4 conditioning'); }
    if (sc.campFocus === 'general') { add(['composure'], 1.5); }
    const w = sc.weighIn ?? { madeWeight: true, cutPct: weightCutInfo(st).pct };
    const cut = weightCutInfo(st);
    let pen = Math.max(0, (sc.weighIn ? w.cutPct * (sc.campFocus === 'weight' ? 0.67 : 1) : cut.pct) - 0.045) * 3.2;
    if (!w.madeWeight) pen += 0.12;
    if (pen > 0.01) {
      staminaMult = 1 - pen * 0.9;
      regenMult = 1 - pen;
      add(['durability'], -pen * 30);
      notes.push(`Weight cut drained you (−${Math.round(pen * 90)}% gas tank, −${(pen * 30).toFixed(0)} durability)`);
    }
  }
  return { attrs: a, staminaMult, regenMult, notes };
}

export function playerSetup(st: GameState, plan: GamePlanId): FighterSetup {
  const p = st.player;
  const fa = playerFightAttrs(st);
  return {
    name: `${p.firstName} ${p.lastName}`, short: p.lastName, attrs: fa.attrs, heightCm: p.heightCm, reachCm: p.reachCm, stance: p.stance,
    style: 'balanced', plan, appearance: p.appearance, isPlayer: true, bodyType: p.bodyType, staminaMult: fa.staminaMult, regenMult: fa.regenMult,
    record: recStr(p.isPro ? p.record : p.amateurRecord),
  };
}

// ─────────────────────────────────────── results
function toTotals(r: RoundStats): FightStatsTotals {
  return {
    sigLanded: r.sigLanded, sigThrown: r.sigThrown, headLanded: r.headLanded, bodyLanded: r.bodyLanded, legLanded: r.legLanded,
    knockdowns: r.knockdowns, tdLanded: r.tdLanded, tdAttempts: r.tdAttempts, subAttempts: r.subAttempts, controlSec: Math.round(r.controlSec),
    damageDealt: Math.round(r.damageDealt), reversals: r.reversals,
  };
}

const isFinish = (m: Method) => m === 'KO' || m === 'TKO' || m === 'SUB';

export function feedbackFor(fs: FightState, won: boolean): { good: string[]; bad: string[]; tips: string[] } {
  const me = sumStats(fs.f[0]), op = sumStats(fs.f[1]);
  const good: string[] = [], bad: string[] = [], tips: string[] = [];
  const acc = me.sigThrown ? me.sigLanded / me.sigThrown : 0;
  if (acc > 0.45) good.push(`Sharp accuracy: ${Math.round(acc * 100)}% of strikes landed.`);
  else if (me.sigThrown > 15 && acc < 0.3) { bad.push(`Only ${Math.round(acc * 100)}% of strikes landed.`); tips.push('Throw from the right range — watch the range ring — and punish recoveries instead of swinging first.'); }
  if (me.tdLanded >= 2) good.push(`${me.tdLanded} takedowns landed.`);
  if (me.tdAttempts >= 3 && me.tdLanded / me.tdAttempts < 0.34) { bad.push(`${me.tdAttempts - me.tdLanded} failed takedowns.`); tips.push('Set up shots behind strikes or shoot when the opponent is mid-strike.'); }
  if (op.tdLanded >= 2) { bad.push(`Taken down ${op.tdLanded} times.`); tips.push('Press R or Space during their shot to sprawl. Train Takedown Defense.'); }
  if (op.knockdowns) { bad.push(`Knocked down ${op.knockdowns} time${op.knockdowns > 1 ? 's' : ''}.`); tips.push('Keep the high guard up (Q) at close range and avoid trading when hurt.'); }
  if (me.knockdowns) good.push(`Scored ${me.knockdowns} knockdown${me.knockdowns > 1 ? 's' : ''}.`);
  if (me.evaded >= 4) good.push(`Slipped ${me.evaded} strikes.`);
  if (me.controlSec > 60) good.push(`Controlled ${Math.round(me.controlSec)}s on the mat/clinch.`);
  if (op.controlSec > 60) { bad.push(`Spent ${Math.round(op.controlSec)}s controlled by your opponent.`); tips.push('On the bottom, cover up (Q) when they strike, then escape (F) or wall-walk (E).'); }
  if (fs.f[0].stamina < 25) { bad.push('You were gassed by the end.'); tips.push('Manage pace: fewer power shots, rest at range. Train Aerobic Conditioning.'); }
  if (fs.f[0].legs > 60) { bad.push('Your lead leg took heavy damage.'); tips.push('Check low kicks with C (body guard / check).'); }
  if (op.subAttempts && !won) tips.push('In a submission, press your defend key only while the marker is inside the zone.');
  if (!good.length) good.push('You made it to fight night — that experience counts.');
  if (!tips.length) tips.push(won ? 'Keep building: higher-ranked opponents are coming.' : 'Review the stats and adjust your training focus.');
  return { good, bad, tips };
}

export function applyFightResult(st: GameState, fs: FightState, adaptMemory?: Record<string, number>, extras?: Pick<FightResultSummary, 'timeline' | 'trends' | 'commentary'>): FightResultSummary | null {
  const sc = st.scheduled;
  if (!sc || st.lastResultId === sc.id || !fs.outcome) return null; // exactly-once guard
  return withRng(st, (rng) => {
    const p = st.player;
    const out = fs.outcome!;
    const opp = st.world.fighters[sc.opponentId];
    const won = out.winner === 0, draw = out.winner === -1;
    const res: 'W' | 'L' | 'D' = draw ? 'D' : won ? 'W' : 'L';
    const finish = isFinish(out.method);
    const rankBefore = playerRank(st);
    const ovrBefore = playerOvr(st);
    const oppOvr = overallRating(unpackAttrs(opp.a));
    // poster snapshot (billing as it was on fight night, so the poster can be redrawn later)
    const posterMeta = posterMetaFor(st, sc);
    // record
    const rec = sc.amateur ? p.amateurRecord : p.record;
    if (draw) rec.d++;
    else if (won) {
      rec.w++;
      if (out.method === 'KO') rec.ko++; else if (out.method === 'TKO') rec.tko++; else if (out.method === 'SUB') rec.sub++; else rec.dec++;
    } else {
      rec.l++;
      if (out.method === 'KO' || out.method === 'TKO') rec.lossKo++; else if (out.method === 'SUB') rec.lossSub++; else rec.lossDec++;
    }
    p.streak = draw ? 0 : won ? Math.max(1, p.streak + 1) : Math.min(-1, p.streak - 1);
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    recordResult(opp, draw ? 'D' : won ? 'L' : 'W', out.method);
    opp.lastFight = st.day;
    opp.bookedUntil = st.day;
    // money
    const meS = sumStats(fs.f[0]), opS = sumStats(fs.f[1]);
    const bonuses: { label: string; amount: number }[] = [];
    const fines: { label: string; amount: number }[] = [];
    const tier = ORG[sc.orgId].tier;
    const purse = sc.amateur ? 150 : sc.purse;
    ledger(st, purse, sc.amateur ? 'Amateur travel stipend' : `Show money — ${sc.eventName}`, 'purse');
    const winBonus = won ? sc.winBonus : 0;
    if (winBonus) ledger(st, winBonus, 'Win bonus', 'bonus');
    const bonusAmt = sc.amateur ? 0 : [0, 2500, 5000, 15000, 30000, 50000][tier];
    const potn = won && finish && !sc.amateur && (out.round <= 2 || meS.knockdowns >= 2 || out.method === 'SUB');
    const fotn = !sc.amateur && meS.sigLanded + opS.sigLanded > 70 && (meS.knockdowns > 0 && opS.knockdowns > 0 || out.method.endsWith('D') && Math.abs(meS.damageDealt - opS.damageDealt) < 25);
    if (potn) { bonuses.push({ label: 'Performance of the Night', amount: bonusAmt }); p.potn++; }
    if (fotn) { bonuses.push({ label: 'Fight of the Night', amount: bonusAmt }); p.fotn++; }
    for (const d of st.sponsors) {
      if (won && d.winBonus) bonuses.push({ label: `${SPONSOR[d.sponsorId].name} win bonus`, amount: d.winBonus });
      if (won && finish && d.finishBonus) bonuses.push({ label: `${SPONSOR[d.sponsorId].name} finish bonus`, amount: d.finishBonus });
    }
    for (const b of bonuses) ledger(st, b.amount, b.label, 'bonus');
    if (sc.weighIn && !sc.weighIn.madeWeight && purse > 0) {
      const fine = Math.round(purse * 0.2);
      fines.push({ label: 'Missed weight (20% of purse)', amount: fine });
      ledger(st, -fine, 'Missed weight fine', 'other');
    }
    const medical = sc.amateur ? 0 : Math.round(150 + (fs.f[0].head + fs.f[0].body) * 4);
    if (medical) { fines.push({ label: 'Post-fight medicals', amount: medical }); ledger(st, -medical, 'Post-fight medicals', 'medical'); }
    // contract
    if (p.contract && !sc.amateur) {
      p.contract.fightsLeft = Math.max(0, p.contract.fightsLeft - 1);
      if (p.contract.fightsLeft === 0) inbox(st, 'offer', 'Contract fulfilled', `Your ${ORG[p.contract.orgId].short} contract is complete. Check Contracts for new deals.`);
    }
    // ranking points & titles
    const fdiv: DivisionId = sc.div ?? p.divisionId; // division the bout was contested in (differs for superfights)
    const homeReignStart = p.reignStart ?? null;
    const champBefore = sc.amateur ? null : st.world.orgs[sc.orgId].champions[fdiv] ?? null;
    let wonTitle = false, lostTitle = false;
    if (!sc.amateur) {
      if (!draw) {
        const { gain, loss } = pointsFor(won ? p.rankPoints : opp.pts, won ? opp.pts : p.rankPoints, finish, sc.title);
        if (won) { p.rankPoints = Math.round(p.rankPoints + gain); opp.pts = Math.max(0, Math.round(opp.pts - loss)); }
        else { opp.pts = Math.round(opp.pts + gain); p.rankPoints = Math.max(0, Math.round(p.rankPoints - loss)); }
      }
      const os = st.world.orgs[sc.orgId];
      if (sc.title) {
        const champBefore = os.champions[fdiv];
        if (won) {
          if (champBefore === 'player') { p.titleDefenses++; p.reignDefenses = (p.reignDefenses ?? 0) + 1; recordDefense(st, sc.orgId, fdiv, sc.id); }
          else {
            wonTitle = true;
            startReign(st, sc.orgId, fdiv, sc.id, sc.superfight ? 'superfight' : champBefore ? 'won' : 'vacant');
            os.champions[fdiv] = 'player';
            p.titles.push({ orgId: sc.orgId, divisionId: fdiv, day: st.day });
            os.titleHistory.push({ day: st.day, div: fdiv, champ: 'player', name: `${p.firstName} ${p.lastName}` });
            if (!sc.superfight) { p.reignDefenses = 0; p.superNextAt = undefined; }
          }
          p.isChampion = true;
        } else if (!draw && champBefore === 'player') {
          lostTitle = true;
          endReign(st, sc.orgId, fdiv, { kind: 'lost', reason: `Lost to ${fighterName(opp)} by ${out.method} (round ${out.round})`, fightId: sc.id });
          os.champions[fdiv] = opp.id;
          os.titleHistory.push({ day: st.day, div: fdiv, champ: opp.id, name: fighterName(opp) });
          if (beltsOf(st, opp.id).filter((b) => b.org === sc.orgId).length >= 2) {
            opp.dbl = st.day; // a champion from another division took the player's belt: he holds two
            addNews(st, { kind: 'superfight', title: `${fighterName(opp)} becomes a double champion`, body: `The ${ORG[sc.orgId].short} ${DIV[opp.div].name} champion takes the ${DIV[fdiv].name} title from ${p.firstName} ${p.lastName} by ${out.method} (round ${out.round}).`, refs: [opp.id, 'player'], org: sc.orgId, div: fdiv, imp: 3 });
          }
          p.isChampion = false;
          p.reignDefenses = 0;
          p.superNextAt = undefined;
        } else if (!draw && !champBefore) {
          os.champions[fdiv] = opp.id;
        } else if (draw && champBefore === 'player') {
          const r = currentReign(st, sc.orgId, fdiv);
          if (r) (r.draws ??= []).push(sc.id); // drawn defense: belt retained
        }
        // a lost superfight leaves the home belt untouched: the player returns as champion of their own division
      }
    }
    // shared result path: history, logs, records, news, timeline
    if (!sc.amateur) {
      recordBout(st, { org: sc.orgId, div: fdiv, a: 'player', b: opp.id, winner: out.winner as 0 | 1 | -1, method: out.method, round: out.round, title: sc.title, vacant: sc.title && !champBefore, event: sc.eventName, champBefore, aOvr: ovrBefore, bOvr: oppOvr });
      addNews(st, {
        kind: 'player', title: wonTitle ? `${p.firstName} ${p.lastName} is the new ${ORG[sc.orgId].short} champion` : `${sc.eventName}: ${won ? `${p.lastName} def. ${opp.last}` : draw ? `${p.lastName} and ${opp.last} draw` : `${opp.last} def. ${p.lastName}`}`,
        body: `${won ? 'Won' : draw ? 'Drew' : 'Lost'} by ${out.method} in round ${out.round} (${out.time})${sc.title ? ' in a title fight' : ''}.`, refs: ['player', opp.id], org: sc.orgId, div: fdiv, imp: sc.title ? 3 : 2,
      });
    }
    if (!sc.amateur && sc.superfight && wonTitle) onSuperfightWin(st, fdiv, homeReignStart);
    if (!sc.amateur && sc.superfight && !won) markOffered(st); // lost or drew: next chance after two more defenses
    const rivalNow = (st.rivalries[opp.id] ?? 0);
    const firstProWin = !sc.amateur && won && p.record.w === 1;
    const tlText = `${won ? 'Beat' : draw ? 'Drew with' : 'Lost to'} ${fighterName(opp)} by ${out.method} (R${out.round}) at ${sc.eventName}${sc.amateur ? ' (amateur)' : ''}.`;
    addTimeline(st, wonTitle ? 'title' : 'fight', wonTitle ? `Won the ${ORG[sc.orgId].short} ${DIV[fdiv].name} championship${sc.superfight ? ' (superfight)' : ''} — ${tlText}` : lostTitle ? `Lost the ${ORG[sc.orgId].short} title — ${tlText}` : sc.title && won ? `Defended the ${ORG[sc.orgId].short} title — ${tlText}` : firstProWin ? `First professional win — ${tlText}` : tlText, opp.id);
    if (p.streak === 5 || p.streak === 10) addTimeline(st, 'milestone', `${p.streak}-fight win streak.`);
    void rivalNow;
    // popularity & reputation
    let pop = 0, rep = 0;
    if (won) {
      pop += 1.2 + (finish ? 2.2 : 0) + (out.method === 'KO' && out.round === 1 ? 1.5 : 0) + (sc.title ? 6 : 0);
      rep += 2 + clamp((oppOvr - ovrBefore) / 3, -1, 6) + (sc.title ? 6 : 0) + tier * 0.5;
    } else if (!draw) {
      pop += fotn ? 1 : -2;
      rep += -3 + clamp((oppOvr - ovrBefore) / 4, 0, 2);
    }
    if (fotn) pop += 3;
    if (sc.rivalry) pop += 2;
    pop *= 1 + tier * 0.12;
    p.popularity = clamp(p.popularity + (pop > 0 ? pop * Math.pow(Math.max(0, 1 - p.popularity / 100), 1.4) : pop), 0, 100);
    p.reputation = clamp(p.reputation + rep * (1 - p.reputation / 140), 0, 100);
    st.promoterRelation = clamp(st.promoterRelation + (finish && won ? 3 : 0) + (fotn ? 3 : 0), -50, 50);
    // learning from the fight (experience, confidence, specific lessons)
    const xp: Partial<Record<AttrKey, number>> = {};
    const learn = (k: AttrKey, v: number) => {
      const before = p.attrs[k];
      p.attrs[k] = clamp(p.attrs[k] + v * (1.1 - before / 120), 1, 99);
      xp[k] = (xp[k] ?? 0) + (p.attrs[k] - before);
    };
    learn('experience', 1.6 + Math.max(0, oppOvr - ovrBefore) / 8 + (fs.round >= 3 ? 0.6 : 0));
    learn('confidence', won ? 2 : draw ? 0 : -2.5);
    if (meS.tdLanded >= 2) learn('tdOffense', 0.4);
    if (meS.sigLanded >= 30) learn('boxing', 0.3);
    if (meS.subAttempts >= 1) learn('subOffense', 0.3);
    if (meS.evaded >= 4) learn('headMovement', 0.3);
    if (opS.tdLanded >= 2) learn('tdDefense', 0.4);
    if (opS.subAttempts >= 1 && !(out.method === 'SUB' && !won)) learn('subDefense', 0.4);
    if (fs.f[0].kdRound || opS.knockdowns) learn('composure', 0.5);
    learn('fightIQ', 0.3);
    // injuries & suspension
    const injuries: string[] = [];
    const me = fs.f[0];
    const lostByKo = !won && (out.method === 'KO' || out.method === 'TKO');
    if ((!won && out.method === 'KO') || (lostByKo && me.head > 60) || me.head >= 85) injuries.push(addInjury(st, rng, 'concussion', me.head > 70 ? 2 : 1, 'Fight damage').type);
    else if (me.head > 45 && rng.chance(0.5)) injuries.push(addInjury(st, rng, 'cut', 1, 'Fight damage').type);
    if (me.body > 55 && rng.chance(0.5)) injuries.push(addInjury(st, rng, 'ribs', me.body > 80 ? 2 : 1, 'Fight damage').type);
    if (me.legs > 60 && rng.chance(0.45)) injuries.push(addInjury(st, rng, rng.chance(0.75) ? 'ankle' : 'knee', 1, 'Fight damage').type);
    if (meS.sigLanded > 35 && rng.chance(0.15)) injuries.push(addInjury(st, rng, 'hand', 1, 'Fight damage').type);
    if (!injuries.length && (me.head + me.body > 30)) injuries.push(addInjury(st, rng, 'swelling', 1, 'Fight damage').type);
    if (injuries.some((i) => i === 'concussion' || i === 'knee')) addTimeline(st, 'injury', `Left the cage with: ${injuries.map((i) => INJURIES[i].name).join(', ')}.`);
    const susp = lostByKo ? 45 : 10;
    p.medicalSuspensionUntil = Math.max(p.medicalSuspensionUntil, st.day + susp);
    p.wear = clamp(p.wear + me.head / 14 + me.body / 30 + (lostByKo ? 4 : 0), 0, 100);
    p.fatigue = clamp(70 + (me.head + me.body) / 8, 0, 100);
    p.sharpness = 45;
    // rivalry & memory
    const close = out.method === 'SD' || out.method === 'MD' || draw || (meS.knockdowns > 0 && opS.knockdowns > 0);
    const already = opp.vsPlayer.length > 0;
    const rivBefore = st.rivalries[opp.id] ?? 0;
    st.rivalries[opp.id] = clamp(rivBefore + (close ? 25 : 0) + (already ? 15 : 5) + (sc.title ? 10 : 0), 0, 100);
    if (rivBefore < 30 && st.rivalries[opp.id] >= 30) addTimeline(st, 'rival', `A rivalry with ${fighterName(opp)} is born.`, opp.id);
    opp.vsPlayer.push({ day: st.day, result: won ? 'L' : draw ? 'D' : 'W', method: out.method, close });
    if (adaptMemory) opp.adapt = adaptMemory;
    // history
    const earned = purse + winBonus + bonuses.reduce((s, b) => s + b.amount, 0) - fines.reduce((s, b) => s + b.amount, 0);
    p.history.unshift({
      id: sc.id, day: st.day, orgId: sc.orgId, event: sc.eventName, opponentId: opp.id, opponentName: fighterName(opp), opponentRecord: recStr(opp.rec),
      result: res, method: out.method, round: out.round, time: out.time, title: sc.title, amateur: sc.amateur, earnings: earned,
      bonuses: bonuses.map((b) => b.label), notes: out.detail, div: fdiv, poster: posterMeta,
    });
    p.attrHistory.push({ day: st.day, ovr: playerOvr(st) });
    p.recentGains = {};
    const rankAfter = playerRank(st);
    if (rankAfter !== null) p.bestRank = p.bestRank ? Math.min(p.bestRank, rankAfter || 0) : rankAfter;
    if (p.isChampion) p.bestRank = 0;
    const summary: FightResultSummary = {
      id: sc.id, day: st.day, playerWon: won, draw, method: out.method, round: out.round, time: out.time, opponentId: opp.id, opponentName: fighterName(opp),
      scorecards: out.cards, roundScores: fs.roundCards.flatMap((rc) => rc.cards.map((c, j) => ({ judge: j, round: rc.round, p: c[0], o: c[1] }))),
      stats: { player: toTotals(meS), opp: toTotals(opS) }, purse, winBonus, bonuses, fines, totalEarned: earned, rankBefore, rankAfter,
      popularityDelta: Math.round(pop * 10) / 10, reputationDelta: Math.round(rep * 10) / 10, injuries, xpGains: xp, feedback: feedbackFor(fs, won),
      title: sc.title, wonTitle, lostTitle, amateur: sc.amateur, recordAfter: recStr(sc.amateur ? p.amateurRecord : p.record), eventName: sc.eventName, orgId: sc.orgId,
      superfight: sc.superfight, fightDiv: fdiv,
    };
    // the rest of the event card happens around the player's bout
    summary.rounds = roundSummaries(fs);
    if (extras) Object.assign(summary, extras);
    summary.announce = postFightLines(st, sc, summary);
    const pb = sc.card?.find((c) => c.player);
    if (pb) pb.result = { w: draw ? -1 : won ? 0 : 1, m: out.method, r: out.round };
    resolveCard(st, rng, 'before');
    resolveCard(st, rng, 'after');
    summary.cardResults = sc.card ? JSON.parse(JSON.stringify(sc.card)) : undefined;
    eventRecap(st);
    st.lastResultId = sc.id;
    st.lastResult = summary;
    st.scheduled = null;
    st.fightInProgress = null;
    pruneEvents(st); // pre-fight media/intel events are over
    // major promotions cut fighters on losing streaks
    if (!sc.amateur && p.contract && ORG[p.orgId].tier >= 2 && p.streak <= -3 && !p.isChampion) {
      inbox(st, 'offer', 'Released', `After ${-p.streak} straight losses, the ${ORG[p.orgId].name} has released you from your contract. You are a free agent.`);
      p.contract = null;
      st.contractOffers = [];
    }
    // sponsors may walk after losing streaks
    st.sponsors = st.sponsors.filter((d) => {
      if (d.dropOnLosses && -p.streak >= d.dropOnLosses) {
        inbox(st, 'finance', 'Sponsor ended deal', `${SPONSOR[d.sponsorId].name} terminated your deal after ${-p.streak} straight losses.`);
        return false;
      }
      return true;
    });
    inbox(st, 'result', `${won ? 'VICTORY' : draw ? 'DRAW' : 'DEFEAT'} — ${out.method}`, `${won ? 'You beat' : draw ? 'You drew with' : 'You lost to'} ${fighterName(opp)} by ${out.method} in round ${out.round} (${out.time}). Earned ${moneyEn(earned)}.`);
    if (!p.isPro && p.amateurRecord.w >= 3 && !st.pending.some((e) => e.templateId === 'turnpro'))
      st.pending.push({ id: uid(rng, 'e'), templateId: 'turnpro', day: st.day, params: {} });
    checkAchievements(st, summary);
    return summary;
  });
}

/** Scouting quality determines how precisely opponent attributes are shown. */
export function scoutLevel(st: GameState) {
  const q = 25 + gymCoachBonus(st, 'tactics') * 0.5 + (st.scheduled?.prep ?? 0) * 0.3 + GYM[st.player.gymId].fac.partners * 0.15;
  return clamp(Math.round(q), 0, 100);
}
export function scoutRange(level: number) {
  return Math.max(1, Math.round(10 - level / 10));
}

export function opponentReport(st: GameState, oppId: string) {
  const f = st.world.fighters[oppId];
  const a = unpackAttrs(f.a);
  const lines: string[] = [];
  const sorted = ATTR_KEYS.map((k) => [k, a[k]] as const).sort((x, y) => y[1] - x[1]);
  const strengths = sorted.slice(0, 4).map(([k]) => k);
  const weaknesses = sorted.slice(-4).map(([k]) => k);
  const st0 = STYLE[f.style];
  lines.push(`${st0.name}: ${st0.desc}`);
  if (f.stance === 'southpaw') lines.push('Southpaw — open stance; consider Southpaw Preparation.');
  if (GRAPPLER_STYLES.includes(f.style)) lines.push('Expect takedown attempts. Sprawl (R/Space) during the shot.');
  if (a.punchPower > 70) lines.push('Real knockout power: don\'t trade carelessly.');
  if (a.cardio < 45) lines.push('Questionable cardio — push the pace late.');
  if (a.tdDefense < 45) lines.push('Weak takedown defense — wrestling could be the path.');
  if (a.subDefense < 45) lines.push('Vulnerable to submissions.');
  if (f.vsPlayer.length) lines.push(`You've fought before: ${f.vsPlayer.map((v) => `${v.result === 'W' ? 'he won' : v.result === 'L' ? 'you won' : 'draw'} (${v.method})`).join(', ')}. He'll remember your tendencies.`);
  return { strengths, weaknesses, lines, attrs: a };
}

export function fightDayToday(st: GameState) {
  return !!st.scheduled && st.scheduled.day <= st.day;
}

export type { ScheduledFight };
void DIV;
