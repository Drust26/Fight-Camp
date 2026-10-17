// Career creation, time advancement, monthly processing, aging and retirement.
import { lookFromLegacy, sanitizeLook } from './look';
import { currentReign, endReign, VACATE } from './reigns';
import { ATTR_KEYS, blankAttrs, overallRating, type AttrKey, type Attributes } from './attributes';
import { RNG, clamp } from './rng';
import { BACKGROUND, BODY_TYPE, DIV, ORG } from '../data/world';
import { SESSION, SPONSOR } from '../data/training';
import { createWorld } from './world';
import { emptyRecord } from './fighterGen';
import { SAVE_VERSION, ageOf, dateOf, fmtDate, inbox, ledger, monthlyExpenses, monthlyTotal, weekday, withRng } from './core';
import { overnight, runSession } from './training';
import { doWeighIn, generateOffers, withdrawFromFight } from './fights';
import { generateContractOffers, generateSponsorOffers } from './economy';
import { expireEvents, rollEvents, activeEvents, EVENT } from './events';
import { simulateWorld } from './world';
import { checkAchievements } from './achievements';
import { addPlayerToHall, addTimeline } from './history';
import type {
  Appearance, BackgroundId, BodyType, DivisionId, Difficulty, GameState, GoalId, PlayerFighter, StartLevel, Stance, WeekPlan,
} from './types';

export interface NewCareerOpts {
  firstName: string;
  lastName: string;
  nickname: string;
  nationality: string;
  age: number;
  heightCm: number;
  reachCm: number;
  hand: 'right' | 'left';
  stance: Stance;
  bodyType: BodyType;
  background: BackgroundId;
  startLevel: StartLevel;
  difficulty: Difficulty;
  goals: GoalId[];
  divisionId: DivisionId;
  naturalKg: number;
  appearance: Appearance;
  seed?: number;
}

export const START_LEVELS: { id: StartLevel; name: string; desc: string; level: number; money: number }[] = [
  { id: 'amateur', name: 'Amateur Prospect', desc: 'Unpaid amateur bouts to learn the craft. Lowest skills, longest runway.', level: 37, money: 2500 },
  { id: 'pro', name: 'New Professional', desc: 'A short amateur career behind you. First pro deal on the local circuit.', level: 43, money: 4000 },
  { id: 'regional', name: 'Experienced Regional Fighter', desc: 'A winning pro record and a Continental MMA Series contract. Older, polished, less upside.', level: 52, money: 12000 },
];

export function previewAttrs(o: Pick<NewCareerOpts, 'background' | 'bodyType' | 'startLevel' | 'heightCm' | 'reachCm'>, seed = 7): Attributes {
  const rng = new RNG(seed);
  const lvl = START_LEVELS.find((s) => s.id === o.startLevel)!.level;
  const a = blankAttrs(lvl);
  const bg = BACKGROUND[o.background].bias, bt = BODY_TYPE[o.bodyType].bias;
  for (const k of ATTR_KEYS) a[k] = clamp(Math.round(lvl + (bg[k] ?? 0) + (bt[k] ?? 0) + rng.gauss() * 2.2), 15, 80);
  // reach advantage feeds distance management
  a.distance = clamp(a.distance + (o.reachCm - o.heightCm) * 0.5, 15, 80);
  a.confidence = clamp(45 + (lvl - 40) * 0.5, 30, 70);
  a.aggression = clamp(a.aggression, 25, 75);
  return a;
}

export function defaultPlan(bg: BackgroundId): WeekPlan {
  const primary: Record<BackgroundId, [string, string]> = {
    wrestling: ['wrestling', 'boxing'], boxing: ['boxing', 'wrestling'], kickboxing: ['kickboxing', 'tddef'], bjj: ['bjj', 'boxing'],
    muaythai: ['muaythai', 'tddef'], judo: ['cagewrestle', 'boxing'], mma: ['boxing', 'wrestling'],
  };
  const [a, b] = primary[bg];
  const plan: [string | null, string | null][] = [
    [a, 'aerobic'],
    [b, 'strength'],
    ['bjj', 'mobility'],
    [a, 'hiit'],
    ['tactical', null],
    ['aerobic', null],
    [null, null],
  ];
  if (bg === 'muaythai') plan[0][0] = 'kickboxing'; // muay thai session needs better facilities at the starting gym
  return { days: plan };
}

export function createCareer(o: NewCareerOpts, slot: number): GameState {
  const seed = o.seed ?? (Date.now() & 0xffffffff) >>> 0;
  const rng = new RNG(seed);
  const day = 0;
  const start = START_LEVELS.find((s) => s.id === o.startLevel)!;
  const attrs = previewAttrs(o); // identical to the creation-screen preview
  const diffMoney = o.difficulty === 'easy' ? 1.5 : o.difficulty === 'hard' ? 0.8 : o.difficulty === 'simulation' ? 0.65 : 1;
  const talent = clamp(1 + (o.age < 23 ? 0.08 : o.age > 30 ? -0.08 : 0) + rng.range(-0.05, 0.05), 0.82, 1.15);
  const p: PlayerFighter = {
    id: 'player', firstName: o.firstName.trim() || 'Alex', lastName: o.lastName.trim() || 'Reyes', nickname: o.nickname.trim(), nationality: o.nationality,
    bornDay: Math.round(day - o.age * 365 - rng.int(0, 300)), heightCm: o.heightCm, reachCm: o.reachCm, hand: o.hand, stance: o.stance, bodyType: o.bodyType,
    background: o.background, appearance: { ...o.appearance, look: o.appearance.look ? sanitizeLook(o.appearance.look) : lookFromLegacy(o.appearance, o.bodyType) }, attrs, talent,
    fatigue: 10, sharpness: 40, wear: o.startLevel === 'regional' ? 12 : 0, injuries: [], medicalSuspensionUntil: 0,
    naturalKg: o.naturalKg, weightKg: o.naturalKg, divisionId: o.divisionId, diet: 'maintain',
    record: emptyRecord(), amateurRecord: emptyRecord(), isPro: o.startLevel !== 'amateur', money: Math.round(start.money * diffMoney), contract: null,
    orgId: o.startLevel === 'regional' ? 'cms' : 'ifc', rankPoints: 0, popularity: o.startLevel === 'regional' ? 18 : o.startLevel === 'pro' ? 6 : 2,
    reputation: o.startLevel === 'regional' ? 30 : o.startLevel === 'pro' ? 10 : 3, streak: 0, bestStreak: 0, titles: [], isChampion: false, titleDefenses: 0,
    bestRank: 0, earningsTotal: 0, history: [], gymId: 'ironside', coaches: [], lifestyle: { housing: 0, nutrition: 0, physio: false, homeGym: false },
    attrHistory: [], recentGains: {}, trainingStreakDays: 0, sessionsDone: 0, fotn: 0, potn: 0, retired: false,
  };
  if (o.startLevel === 'pro') {
    p.amateurRecord = { ...emptyRecord(), w: 4, l: 1, ko: 1, sub: 1, dec: 2, lossDec: 1 };
    p.contract = { orgId: 'ifc', fightsTotal: 3, fightsLeft: 3, purse: ORG.ifc.purse, winBonus: ORG.ifc.winBonus, signingBonus: 0, exclusive: false, champClause: false, amateur: false, signedDay: 0 };
    p.rankPoints = 10;
  } else if (o.startLevel === 'regional') {
    const w = rng.int(6, 8), l = rng.int(1, 3);
    p.record = { ...emptyRecord(), w, l, ko: rng.int(1, 3), sub: rng.int(0, 2), dec: 0, lossDec: l };
    p.record.dec = Math.max(0, w - p.record.ko - p.record.sub);
    p.amateurRecord = { ...emptyRecord(), w: 6, l: 2, dec: 6, lossDec: 2 };
    p.contract = { orgId: 'cms', fightsTotal: 4, fightsLeft: 4, purse: ORG.cms.purse, winBonus: ORG.cms.winBonus, signingBonus: 0, exclusive: true, champClause: true, amateur: false, signedDay: 0 };
    p.rankPoints = 16;
    p.attrs.experience = clamp(p.attrs.experience + 8, 1, 80);
  } else {
    p.contract = { orgId: 'ifc', fightsTotal: 99, fightsLeft: 99, purse: 0, winBonus: 0, signingBonus: 0, exclusive: false, champClause: false, amateur: true, signedDay: 0 };
  }
  p.attrHistory.push({ day, ovr: overallRating(p.attrs) });
  const st: GameState = {
    version: SAVE_VERSION, slot, rng: rng.state, createdAt: Date.now(), savedAt: Date.now(), day, difficulty: o.difficulty, goals: o.goals, player: p,
    world: createWorld(rng, day), plan: defaultPlan(o.background), offers: [], contractOffers: [], scheduled: null, sponsors: [], sponsorOffers: [],
    ledger: [], inbox: [], pending: [], eventCooldowns: {}, rivalries: {}, achievements: [], promoterRelation: 0, declinedOffers: 0, lastOfferDay: -30,
    dayLogs: [], lastResultId: null, lastResult: null, tutorialStep: 0, practiceDone: false, seenHelp: {}, fightInProgress: null,
    timeline: [], lastReplay: null, callout: null, titlePush: false, sponsorBuzz: 0,
  };
  // initial opportunities
  withRng(st, (r) => {
    for (let i = 0; i < 4 && st.offers.length < 2; i++) generateOffers(st, r);
    st.lastOfferDay = st.day - 30;
    if (!st.offers.length) generateOffers(st, r);
  });
  st.timeline.push({ day: 0, kind: 'start', text: `Career began: ${o.age}-year-old ${o.background} background, ${START_LEVELS.find((x) => x.id === o.startLevel)!.name.toLowerCase()}.` });
  inbox(st, 'news', `Welcome to Fight Camp, ${p.firstName}`, `You start at ${'Ironside Community Gym'} with ${p.money.toLocaleString()} in the bank and ${monthlyTotal(st).toLocaleString()} in monthly costs. Plan your week in Training, check Fight Offers, and advance time from the top bar.`);
  return st;
}

export interface AdvanceResult { stopped: boolean; reasons: string[]; days: number }

/** Advance one day. Returns reasons that should interrupt multi-day advancement. */
export function advanceDay(st: GameState): AdvanceResult {
  const reasons: string[] = [];
  const p = st.player;
  if (p.retired) return { stopped: true, reasons: ['Retired'], days: 0 };
  if (st.scheduled && st.scheduled.day <= st.day) return { stopped: true, reasons: ['Fight night! Head to the arena.'], days: 0 };
  if (activeEvents(st).some((e) => EVENT[e.templateId].urgent)) return { stopped: true, reasons: ['A decision needs your answer first.'], days: 0 };
  return withRng(st, (rng) => {
    const lines: string[] = [];
    const gains: Partial<Record<AttrKey, number>> = {};
    const today = st.plan.days[weekday(st.day)];
    let trained = false;
    const offersBefore = st.offers.length, injBefore = p.injuries.length, pendingBefore = st.pending.length, cBefore = st.contractOffers.length;
    for (const sid of today) {
      if (!sid || !SESSION[sid]) continue;
      lines.push(...runSession(st, rng, sid, gains));
      trained = true;
    }
    if (!trained) lines.push('Rest day.');
    overnight(st, trained, lines);
    st.day++;
    // month boundary
    if (dateOf(st.day).getUTCDate() === 1) monthly(st, rng, lines);
    simulateWorld(st, rng);
    generateOffers(st, rng);
    if (st.day % 7 === 0) generateContractOffers(st, rng);
    if (st.day % 10 === 0) generateSponsorOffers(st, rng);
    rollEvents(st, rng);
    expireEvents(st);
    st.contractOffers = st.contractOffers.filter((c) => c.expiresDay >= st.day);
    if (st.scheduled && p.medicalSuspensionUntil > st.scheduled.day) {
      withdrawFromFight(st); // can't be cleared in time
      lines.push('Medical suspension: you were forced to withdraw from your booked fight.');
      reasons.push('Withdrawn: medical suspension');
    }
    if (st.scheduled && st.scheduled.day === st.day) doWeighIn(st, rng);
    st.dayLogs.unshift({ day: st.day - 1, lines, gains });
    if (st.dayLogs.length > 28) st.dayLogs.length = 28;
    checkAchievements(st);
    if (st.scheduled && st.scheduled.day <= st.day) reasons.push('Fight night!');
    if (st.offers.length > offersBefore) reasons.push('New fight offer');
    if (p.injuries.length > injBefore) reasons.push('Injury');
    if (st.pending.length > pendingBefore && activeEvents(st).length) reasons.push('New event');
    if (st.contractOffers.length > cBefore) reasons.push('Contract offer');
    return { stopped: reasons.length > 0, reasons, days: 1 };
  });
}

export function advanceDays(st: GameState, n: number): AdvanceResult {
  let days = 0;
  const reasons: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = advanceDay(st);
    days += r.days;
    if (r.stopped) { reasons.push(...r.reasons); break; }
  }
  return { stopped: reasons.length > 0, reasons, days };
}

function monthly(st: GameState, rng: RNG, lines: string[]) {
  const p = st.player;
  // champions who cannot or do not defend are eventually stripped (vacancy recorded in the trophy case)
  if (p.isPro && !p.retired && !st.scheduled && !p.pendingBeltChoice && st.world.orgs[p.orgId]?.champions[p.divisionId] === 'player') {
    const lastFight = p.history[0]?.day ?? 0;
    const reign = currentReign(st, p.orgId, p.divisionId);
    const idle = st.day - Math.max(lastFight, reign?.start ?? 0);
    const hurt = p.injuries.some((i) => i.daysLeft > 30) || p.medicalSuspensionUntil > st.day + 30;
    const why = idle > 300 && hurt ? VACATE.injury() : idle > 450 ? VACATE.inactive() : null;
    if (why) {
      endReign(st, p.orgId, p.divisionId, why);
      st.world.orgs[p.orgId].champions[p.divisionId] = null;
      p.isChampion = false; p.reignDefenses = 0; p.superNextAt = undefined;
      inbox(st, 'news', 'Title stripped', `${ORG[p.orgId].short} has stripped you of the ${DIV[p.divisionId].name} title: ${why.reason.replace('Stripped — ', '').replace('Stripped ', '').toLowerCase()}.`);
      addTimeline(st, 'title', `${why.reason} (${ORG[p.orgId].short} ${DIV[p.divisionId].name}).`);
      lines.push('Your title was stripped.');
    }
  }
  for (const e of monthlyExpenses(st)) ledger(st, -e.amount, e.label, e.cat);
  lines.push(`Monthly bills paid: ${monthlyTotal(st).toLocaleString()}.`);
  for (const d of st.sponsors) {
    ledger(st, d.monthly, `Sponsor: ${SPONSOR[d.sponsorId].name}`, 'sponsor');
    d.monthsLeft--;
    if (d.monthsLeft <= 0) inbox(st, 'finance', 'Sponsorship ended', `Your deal with ${SPONSOR[d.sponsorId].name} has run its course.`);
  }
  st.sponsors = st.sponsors.filter((d) => d.monthsLeft > 0);
  if (p.lifestyle.housing === 2) p.popularity = clamp(p.popularity + 0.3, 0, 100);
  // popularity drifts down when inactive
  const lastFight = p.history[0]?.day ?? 0;
  if (st.day - lastFight > 120) p.popularity = clamp(p.popularity - 1, 0, 100);
  if (p.popularity > 40) p.popularity = clamp(p.popularity - (p.popularity - 40) * 0.015, 0, 100); // fans are fickle
  // aging
  const age = ageOf(p.bornDay, st.day);
  const phys: AttrKey[] = ['speed', 'explosiveness', 'agility', 'recovery', 'durability', 'endurance', 'cardio', 'balance'];
  if (age > 30) {
    const rate = (age - 30) * 0.045 + p.wear / 700;
    for (const k of phys) p.attrs[k] = clamp(p.attrs[k] - rate * rng.range(0.6, 1.3), 10, 99);
    if (age > 33 && rng.chance(0.3)) lines.push('Your body is starting to feel the miles.');
  } else if (age < 24) {
    for (const k of ['strength', 'endurance', 'explosiveness'] as AttrKey[]) p.attrs[k] = clamp(p.attrs[k] + 0.12, 1, 99);
  }
  // money warnings
  const next = monthlyTotal(st);
  if (p.money < next) inbox(st, 'finance', 'Money is tight', `You have ${Math.round(p.money).toLocaleString()} but next month's bills are ${next.toLocaleString()}. Consider cheaper housing, a part-time job, or taking a fight.`);
  if (p.money < -3000) {
    // financial stress: forced downgrade, never bankruptcy
    if (p.lifestyle.housing > 0 || p.lifestyle.nutrition > 0 || p.coaches.length) {
      p.lifestyle.housing = 0; p.lifestyle.nutrition = 0; p.coaches = []; p.lifestyle.physio = false;
      inbox(st, 'finance', 'Financial crisis', 'Deep in debt, you moved back to a shared room, cancelled the meal plan and let your coaches go.');
    }
    p.attrs.composure = clamp(p.attrs.composure - 0.5, 1, 99);
  }
  p.attrHistory.push({ day: st.day, ovr: overallRating(p.attrs) });
  if (p.attrHistory.length > 200) p.attrHistory.splice(0, p.attrHistory.length - 200);
}

export function legacyRating(st: GameState) {
  const p = st.player;
  const r = p.record;
  const v = r.w * 2.2 - r.l * 1.2 + (r.ko + r.tko + r.sub) * 1.2 + p.titles.length * 14 + p.titles.filter((t) => t.orgId === 'acl').length * 16
    + p.titleDefenses * 6 + (p.champStatus === 2 ? 18 : p.champStatus === 1 ? 9 : 0) + p.earningsTotal / 120000 + p.popularity / 4 + p.fotn * 2 + (p.bestRank > 0 && p.bestRank <= 5 ? 6 : 0);
  return clamp(Math.round(v), 0, 100);
}
export function legacyTier(v: number) {
  return v >= 90 ? 'All-Time Great' : v >= 70 ? 'Hall of Famer' : v >= 50 ? 'Elite Veteran' : v >= 30 ? 'Respected Pro' : v >= 15 ? 'Journeyman' : 'Local Legend';
}

export function retire(st: GameState) {
  const p = st.player;
  if (p.retired) return;
  if (st.scheduled) {
    const o = st.world.fighters[st.scheduled.opponentId];
    if (o) o.bookedUntil = st.day;
    st.scheduled = null;
  }
  p.retired = true;
  if (p.isChampion) {
    endReign(st, p.orgId, p.divisionId, VACATE.retired());
    st.world.orgs[p.orgId].champions[p.divisionId] = null;
    p.isChampion = false;
    p.reignDefenses = 0;
    p.superNextAt = undefined;
  }
  st.offers = [];
  st.contractOffers = [];
  addTimeline(st, 'retire', `Retired with a ${p.record.w}-${p.record.l}${p.record.d ? '-' + p.record.d : ''} professional record.`);
  addPlayerToHall(st, legacyRating(st));
  inbox(st, 'news', 'Retirement', `${p.firstName} ${p.lastName} retires with a ${p.record.w}-${p.record.l}${p.record.d ? '-' + p.record.d : ''} professional record.`);
}

export function changeDivision(st: GameState, div: DivisionId): string | null {
  const p = st.player;
  if (st.scheduled) return 'Not while a fight is booked.';
  if (p.pendingBeltChoice) return 'Choose which belt to keep first.';
  const lim = DIV[div].kg;
  if (p.naturalKg > lim * 1.16) return 'You walk around far too heavy for that division.';
  const idx = Object.keys(DIV).indexOf(div);
  const lower = idx > 0 ? DIV[Object.keys(DIV)[idx - 1] as DivisionId].kg : 0;
  if (p.naturalKg < lower * 0.95) return 'You would be badly undersized in that division.';
  if (p.isChampion) {
    endReign(st, p.orgId, p.divisionId, VACATE.division(div));
    st.world.orgs[p.orgId].champions[p.divisionId] = null;
    p.isChampion = false;
    p.reignDefenses = 0;
    p.superNextAt = undefined;
  }
  p.divisionId = div;
  p.rankPoints = Math.round(p.rankPoints * 0.5);
  st.offers = [];
  inbox(st, 'news', `Moved to ${DIV[div].name}`, 'Your ranking points carry over at half value.');
  addTimeline(st, 'division', `Moved to ${DIV[div].name}.`);
  return null;
}

export function setPlanSlot(st: GameState, dayIdx: number, slot: 0 | 1, sessionId: string | null) {
  st.plan.days[dayIdx][slot] = sessionId;
}

export function nextFightCountdown(st: GameState) {
  return st.scheduled ? st.scheduled.day - st.day : null;
}

export { fmtDate };
void DIV;
