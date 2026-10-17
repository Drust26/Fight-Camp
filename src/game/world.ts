// World simulation: rosters, quick-resolved AI-vs-AI bouts, rankings, champions, development, retirement.
import { ATTR_KEYS, overallRating, packAttrs, unpackAttrs } from './attributes';
import { RNG, clamp, sigmoid } from './rng';
import { DIVISIONS, ORG, ORGS, STYLE } from '../data/world';
import { fighterName, genFighter } from './fighterGen';
import { addNews, isNotable, onRetire, ovrOf, recordBout } from './history';
import { inbox } from './core';
import type { DivisionId, GameState, Method, OrgId, World, WorldFighter } from './types';

export const CITIES = ['Las Vegas', 'São Paulo', 'London', 'Dublin', 'Toronto', 'Sydney', 'Abu Dhabi', 'Tokyo', 'Paris', 'Warsaw', 'Mexico City',
  'Newark', 'Houston', 'Manchester', 'Stockholm', 'Seoul', 'Auckland', 'Chicago', 'Miami', 'Denver', 'Montreal', 'Perth', 'Lisbon', 'Prague'];

export function orgLevelFor(org: OrgId, rank01: number) {
  const [lo, hi] = ORG[org].level;
  return Math.round(lo + (hi - lo) * Math.pow(rank01, 1.3));
}

export function createWorld(rng: RNG, day: number): World {
  const world: World = { fighters: {}, orgs: {} as World['orgs'], lastSimDay: day, history: [], news: [], records: {}, hall: [] };
  for (const o of ORGS) {
    world.orgs[o.id] = { id: o.id, champions: {}, nextEventDay: day + rng.int(3, o.eventEveryDays), eventNo: rng.int(12, 180), titleHistory: [] };
    for (const d of DIVISIONS) {
      const ids: string[] = [];
      for (let i = 0; i < o.rosterPerDiv; i++) {
        const lvl = orgLevelFor(o.id, 1 - i / o.rosterPerDiv) + rng.int(-2, 2);
        const f = genFighter(rng, { org: o.id, div: d.id, level: lvl, day, tier: o.tier });
        f.pts = Math.max(1, Math.round((lvl - o.level[0]) * 3 + f.rec.w * 1.5 - f.rec.l + rng.range(0, 6)));
        world.fighters[f.id] = f;
        ids.push(f.id);
      }
      // champion = best of the division
      const champ = ids.map((id) => world.fighters[id]).sort((a, b) => b.pts - a.pts)[0];
      world.orgs[o.id].champions[d.id] = champ.id;
      champ.rec.w += rng.int(2, 6);
    }
  }
  return world;
}

export function rosterOf(world: World, org: OrgId, div: DivisionId) {
  return Object.values(world.fighters).filter((f) => f.org === org && f.div === div && !f.retired && !f.am);
}

export interface RankRow { id: string; name: string; pts: number; rank: number; champion: boolean; isPlayer: boolean; rec: string; style: string; ovr: number; injured: boolean; nick: string; nat: string }

/** Rankings for an org/division, including the player where relevant. Rank 0 = champion. */
export function rankings(st: GameState, org: OrgId, div: DivisionId): RankRow[] {
  const champId = st.world.orgs[org].champions[div];
  const rows: RankRow[] = rosterOf(st.world, org, div).map((f) => ({
    id: f.id, name: fighterName(f), pts: f.pts, rank: 0, champion: f.id === champId, isPlayer: false, rec: `${f.rec.w}-${f.rec.l}${f.rec.d ? '-' + f.rec.d : ''}`,
    style: STYLE[f.style].name, ovr: overallRating(unpackAttrs(f.a)), injured: f.injuredUntil > st.day, nick: f.nick, nat: f.nat,
  }));
  const p = st.player;
  // the player appears in their own division, and as champion of any other division they hold (superfights)
  if (p.isPro && p.orgId === org && (p.divisionId === div || champId === 'player') && !p.retired) {
    rows.push({
      id: 'player', name: `${p.firstName} ${p.lastName}`, pts: p.rankPoints, rank: 0, champion: champId === 'player', isPlayer: true,
      rec: `${p.record.w}-${p.record.l}${p.record.d ? '-' + p.record.d : ''}`, style: 'You', ovr: overallRating(p.attrs), injured: false, nick: p.nickname, nat: p.nationality,
    });
  }
  // a double champion fights out of his other division: he still heads this one
  if (champId && champId !== 'player' && !rows.some((r) => r.id === champId)) {
    const f = st.world.fighters[champId];
    if (f && !f.retired) rows.push({
      id: f.id, name: fighterName(f), pts: f.pts, rank: 0, champion: true, isPlayer: false, rec: `${f.rec.w}-${f.rec.l}${f.rec.d ? '-' + f.rec.d : ''}`,
      style: STYLE[f.style].name, ovr: overallRating(unpackAttrs(f.a)), injured: f.injuredUntil > st.day, nick: f.nick, nat: f.nat,
    });
  }
  const champ = rows.find((r) => r.champion);
  const rest = rows.filter((r) => !r.champion).sort((a, b) => b.pts - a.pts);
  rest.forEach((r, i) => (r.rank = i + 1));
  return champ ? [champ, ...rest] : rest;
}

export function playerRank(st: GameState): number | null {
  const p = st.player;
  if (!p.isPro) return null;
  const r = rankings(st, p.orgId, p.divisionId).find((x) => x.isPlayer);
  return r ? r.rank : null;
}

/** Fast statistical resolution for AI-vs-AI bouts that the player doesn't watch. */
export function quickFight(rng: RNG, a: WorldFighter, b: WorldFighter, rounds: number): { winner: 0 | 1 | -1; method: Method; round: number } {
  const A = unpackAttrs(a.a), B = unpackAttrs(b.a);
  const ovA = overallRating(A), ovB = overallRating(B);
  const grap = (x: typeof A) => (x.tdOffense + x.wrestling + x.topControl) / 3;
  const grapD = (x: typeof A) => (x.tdDefense + x.bottomDefense) / 2;
  let edge = (ovA - ovB) / 6;
  if (['wrestler', 'gnp', 'submission'].includes(a.style)) edge += (grap(A) - grapD(B)) / 60;
  if (['wrestler', 'gnp', 'submission'].includes(b.style)) edge -= (grap(B) - grapD(A)) / 60;
  const age = (f: WorldFighter, now: number) => 0;
  void age;
  if (rng.chance(0.012)) return { winner: -1, method: 'DRAW', round: rounds };
  const winner: 0 | 1 = rng.chance(sigmoid(edge + rng.gauss() * 0.25)) ? 0 : 1;
  const W = winner === 0 ? A : B, L = winner === 0 ? B : A;
  const wStyle = winner === 0 ? a.style : b.style;
  const koP = 0.18 + (W.punchPower + W.kickPower - L.durability * 1.2) / 300 + (['power', 'pressure', 'kickboxer'].includes(wStyle) ? 0.1 : 0);
  const subP = 0.1 + (W.subOffense - L.subDefense) / 250 + (wStyle === 'submission' ? 0.2 : 0);
  const tkoP = 0.12 + (W.gnp - L.bottomDefense) / 300 + (wStyle === 'gnp' ? 0.12 : 0);
  const r = rng.next();
  let method: Method;
  if (r < koP) method = 'KO';
  else if (r < koP + tkoP) method = 'TKO';
  else if (r < koP + tkoP + subP) method = 'SUB';
  else method = rng.chance(0.75) ? 'UD' : rng.chance(0.6) ? 'SD' : 'MD';
  const finishRound = method === 'UD' || method === 'SD' || method === 'MD' ? rounds : rng.int(1, rounds);
  return { winner, method, round: finishRound };
}

export function recordResult(f: WorldFighter, result: 'W' | 'L' | 'D', method: Method) {
  const r = f.rec;
  if (result === 'D') r.d++;
  else if (result === 'W') {
    r.w++;
    if (method === 'KO') r.ko++; else if (method === 'TKO') r.tko++; else if (method === 'SUB') r.sub++; else r.dec++;
  } else {
    r.l++;
    if (method === 'KO' || method === 'TKO') r.lossKo++; else if (method === 'SUB') r.lossSub++; else r.lossDec++;
  }
  f.recent = [...f.recent.slice(-4), result];
}

export function pointsFor(winPts: number, losePts: number, finish: boolean, title: boolean) {
  const gain = 10 + losePts * 0.15 + (finish ? 3 : 0) + (title ? 8 : 0);
  const loss = 5 + Math.max(0, (winPts - losePts) * -0.05) + (finish ? 1 : 0);
  return { gain, loss };
}

/** Personal inbox notice for world events that matter to the player's own division. */
function notify(st: GameState, title: string, body: string) {
  inbox(st, 'world', title, body);
}

/** Run all world events that are due up to the current day. */
export function simulateWorld(st: GameState, rng: RNG) {
  const w = st.world;
  for (const o of ORGS) {
    const os = w.orgs[o.id];
    while (os.nextEventDay <= st.day) {
      runOrgEvent(st, rng, o.id);
      os.eventNo++;
      os.nextEventDay += o.eventEveryDays + rng.int(-2, 3);
    }
  }
  // monthly development
  while (w.lastSimDay + 30 <= st.day) {
    w.lastSimDay += 30;
    developWorld(st, rng, w.lastSimDay);
  }
}

function available(st: GameState, f: WorldFighter) {
  return !f.retired && !f.am && f.injuredUntil <= st.day && f.bookedUntil <= st.day && st.day - f.lastFight > 35;
}

function runOrgEvent(st: GameState, rng: RNG, org: OrgId) {
  const os = st.world.orgs[org];
  const pDiv = st.player.divisionId;
  for (const d of DIVISIONS) {
    if (!rng.chance(d.id === pDiv ? 0.85 : 0.55)) continue;
    const roster = rosterOf(st.world, org, d.id).filter((f) => available(st, f)).sort((a, b) => b.pts - a.pts);
    const champId = os.champions[d.id];
    // title fight roughly every few months if champion is AI and available
    const champ = champId && champId !== 'player' ? st.world.fighters[champId] : null;
    const playerContender = st.player.orgId === org && st.player.divisionId === d.id && st.player.isPro && !st.player.retired;
    const titleDue = champ && available(st, champ) && st.day - champ.lastFight > 100 && rng.chance(0.5);
    if (titleDue && champ) {
      const contenders = roster.filter((f) => f.id !== champ.id);
      // the player keeps a claim to a shot if they are the #1 contender (handled by offers)
      const ranks = rankings(st, org, d.id);
      const playerIsTop = playerContender && ranks.find((r) => r.isPlayer)?.rank === 1;
      if (contenders.length && !(playerIsTop && rng.chance(0.75))) {
        const c = contenders[0];
        bout(st, rng, org, champ, c, true, false, undefined, d.id);
        continue;
      }
    }
    const pool = roster.filter((f) => f.id !== champId);
    if (pool.length < 2) continue;
    const i = rng.int(0, pool.length - 2);
    const a = pool[i];
    const cand = pool.filter((f) => f.id !== a.id).sort((x, y) => Math.abs(x.pts - a.pts) - Math.abs(y.pts - a.pts));
    const b = cand[Math.min(cand.length - 1, rng.int(0, 2))];
    bout(st, rng, org, a, b, false);
  }
  // vacant titles get filled
  for (const d of DIVISIONS) {
    if (!os.champions[d.id]) {
      const top = rosterOf(st.world, org, d.id).filter((f) => available(st, f)).sort((a, b) => b.pts - a.pts);
      if (top.length >= 2 && rng.chance(0.5)) bout(st, rng, org, top[0], top[1], true, true, undefined, d.id);
    }
  }
}

export interface WorldBoutResult { winner: 0 | 1 | -1; method: Method; round: number }

/** Resolve an AI-vs-AI bout through the world simulation and record it everywhere (shared path). */
export function bout(st: GameState, rng: RNG, org: OrgId, a: WorldFighter, b: WorldFighter, title: boolean, vacant = false, event?: string, div: DivisionId = a.div): WorldBoutResult {
  const aOvr = ovrOf(st, a.id), bOvr = ovrOf(st, b.id);
  const res = quickFight(rng, a, b, title ? 5 : 3);
  const os = st.world.orgs[org];
  const champBefore = os.champions[div] ?? null;
  a.lastFight = b.lastFight = st.day;
  if (res.winner === -1) {
    recordResult(a, 'D', 'DRAW');
    recordResult(b, 'D', 'DRAW');
    recordBout(st, { org, div, a: a.id, b: b.id, winner: -1, method: 'DRAW', round: res.round, title, vacant, event, champBefore, aOvr, bOvr });
    return res;
  }
  const W = res.winner === 0 ? a : b;
  const L = res.winner === 0 ? b : a;
  const finish = ['KO', 'TKO', 'SUB'].includes(res.method);
  recordResult(W, 'W', res.method);
  recordResult(L, 'L', res.method);
  const { gain, loss } = pointsFor(W.pts, L.pts, finish, title);
  W.pts = Math.round(W.pts + gain);
  L.pts = Math.max(0, Math.round(L.pts - loss));
  W.pop = clamp(W.pop + (finish ? 3 : 1) + (title ? 5 : 0), 0, 100);
  L.pop = clamp(L.pop - 1, 0, 100);
  if (finish && rng.chance(0.35)) L.injuredUntil = st.day + rng.int(30, 110);
  else if (rng.chance(0.1)) W.injuredUntil = st.day + rng.int(20, 60);
  // small experience effect
  const wa = unpackAttrs(W.a);
  wa.experience = Math.min(99, wa.experience + 1);
  wa.confidence = Math.min(99, wa.confidence + 1);
  W.a = packAttrs(wa);
  const relevant = st.player.divisionId === div && st.player.orgId === org;
  if (title && (vacant || champBefore !== W.id)) {
    os.champions[div] = W.id;
    os.titleHistory.push({ day: st.day, div, champ: W.id, name: fighterName(W) });
    if (relevant) notify(st, `${ORG[org].short} — new ${DIVISIONS.find((d) => d.id === div)!.name} champion`, `${fighterName(W)} ${vacant ? 'claims the vacant belt' : 'dethrones ' + fighterName(L)} by ${res.method} in round ${res.round}.`);
  }
  recordBout(st, { org, div, a: a.id, b: b.id, winner: res.winner, method: res.method, round: res.round, title, vacant, event, champBefore, aOvr, bOvr });
  // a champion leaving the fight injured is news
  const champNow = os.champions[div];
  for (const f of [W, L]) if (f.id === champNow && f.injuredUntil > st.day + 45)
    addNews(st, { kind: 'injury', title: `${ORG[org].short} champion sidelined`, body: `${fighterName(f)} is expected to be out until around ${Math.round((f.injuredUntil - st.day) / 30)} months from now.`, refs: [f.id], org, div, imp: ORG[org].tier >= 3 ? 2 : 1 });
  return res;
}

function developWorld(st: GameState, rng: RNG, day: number) {
  const w = st.world;
  for (const f of Object.values(w.fighters)) {
    if (f.retired) continue;
    const age = (day - f.bornDay) / 365;
    const a = unpackAttrs(f.a);
    const ovr = overallRating(a);
    let delta = 0;
    if (age < 28) delta = clamp((f.peak - ovr) * 0.06, -0.2, 0.8);
    else if (age < 32) delta = clamp((f.peak - ovr) * 0.03, -0.1, 0.3);
    else delta = -(age - 31) * 0.12;
    if (delta !== 0) {
      for (const k of ATTR_KEYS) {
        const phys = ['speed', 'explosiveness', 'agility', 'recovery', 'durability', 'endurance', 'cardio'].includes(k);
        const mult = delta < 0 ? (phys ? 1.6 : 0.3) : 1;
        a[k] = clamp(a[k] + delta * mult * (0.6 + rng.next() * 0.8), 10, 98);
      }
      f.a = packAttrs(a);
    }
    // ranking points decay with inactivity
    f.pts = Math.round(f.pts * 0.985);
  }
  st.player.rankPoints = Math.round(st.player.rankPoints * 0.985);
  // yearly-ish retirement & replacement + movement between promotions (quarterly)
  if (Math.floor(day / 30) % 3 === 0) movePromotions(st, rng, day);
}

/** A fighter leaving the sport gives up every belt he holds (a double champion holds two). */
export function vacateAllBelts(st: GameState, f: WorldFighter, why: string) {
  for (const o of ORGS) for (const d of DIVISIONS) {
    if (st.world.orgs[o.id].champions[d.id] !== f.id) continue;
    st.world.orgs[o.id].champions[d.id] = null;
    addNews(st, { kind: 'title', title: `${o.short} ${d.name} title vacated`, body: `${fighterName(f)} ${why}. The belt is vacant.`, refs: [f.id], org: o.id, div: d.id, imp: o.tier >= 3 ? 2 : 1 });
    if (st.player.divisionId === d.id && st.player.orgId === o.id) notify(st, `${o.short} title vacated`, `${fighterName(f)} ${why}. The belt is vacant.`);
  }
  f.dbl = undefined;
}

function movePromotions(st: GameState, rng: RNG, day: number) {
  const w = st.world;
  for (const o of ORGS) {
    for (const d of DIVISIONS) {
      const roster = rosterOf(w, o.id, d.id);
      const champId = w.orgs[o.id].champions[d.id];
      // retirements
      for (const f of roster) {
        const age = (day - f.bornDay) / 365;
        const losing = f.recent.slice(-3).filter((r) => r === 'L').length >= 3;
        if ((age > 35 && rng.chance((age - 34) * 0.06)) || (losing && age > 31 && rng.chance(0.25))) {
          f.retired = true;
          onRetire(st, f);
          vacateAllBelts(st, f, 'retires as champion');
        }
      }
      // promotions up a tier
      if (o.tier < 5) {
        const up = rosterOf(w, o.id, d.id).filter((f) => f.id !== champId && f.recent.slice(-3).filter((r) => r === 'W').length >= 3).sort((a, b) => b.pts - a.pts)[0];
        const target = ORGS.find((x) => x.tier === o.tier + 1)!;
        if (up && rng.chance(0.6)) {
          up.org = target.id;
          up.pts = Math.round(orgLevelFor(target.id, 0.4) - target.level[0]) * 3;
          addNews(st, { kind: 'signing', title: `${fighterName(up)} signs with the ${target.short}`, body: `After ${up.stk ?? 3} straight wins in the ${o.short}, the ${STYLE[up.style].name.toLowerCase()} moves up to the ${target.name} (${d.name}).`, refs: [up.id], org: target.id, div: d.id, imp: target.tier >= 4 ? 2 : 1 });
          if (st.player.divisionId === d.id && st.player.orgId === target.id) notify(st, `New arrival in the ${target.short}`, `${fighterName(up)} signs with ${target.name} after a dominant run.`);
        }
      }
      // refill rosters with fresh prospects
      const now = rosterOf(w, o.id, d.id);
      for (let i = now.length; i < o.rosterPerDiv; i++) {
        const nf = genFighter(rng, { org: o.id, div: d.id, level: orgLevelFor(o.id, rng.range(0.1, 0.5)), day, tier: o.tier, ageRange: [21, 27] });
        nf.pts = rng.int(2, 12);
        w.fighters[nf.id] = nf;
        nf.deb = day;
        if (o.id === st.player.orgId && d.id === st.player.divisionId && rng.chance(0.5))
          notify(st, 'Prospect watch', `${fighterName(nf)}, a ${STYLE[nf.style].name.toLowerCase()} (${nf.rec.w}-${nf.rec.l}), joins the ${o.short} ${d.name} roster.`);
      }
    }
  }
  // prune long-retired fighters who never fought the player to keep saves small
  const referenced = new Set([...st.offers.map((o) => o.opponentId), st.scheduled?.opponentId ?? '', ...st.pending.map((e) => e.params?.opp ?? e.params?.offer?.opponentId ?? '')]);
  for (const [id, f] of Object.entries(w.fighters)) {
    if (referenced.has(id) || f.vsPlayer.length) continue;
    if (f.retired && isNotable(f)) continue; // Hall of Fame material stays in the record
    if ((f.retired && day - f.lastFight > 400) || (f.am && f.bookedUntil < day)) delete w.fighters[id];
  }
}
