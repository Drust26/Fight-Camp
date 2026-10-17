// Living world (v1.2): AI fighters change weight class, HFC champions chase superfights and double belts, double
// champions eventually give one belt up, and promotions poach each other's contenders. Runs once a month from the
// career clock (career.ts → monthly). Fighters booked against the player are never touched.
import { DIV, DIVISIONS, ORG, ORGS } from '../data/world';
import { bout, orgLevelFor, rankings, rosterOf, vacateAllBelts } from './world';
import { addNews } from './history';
import { inbox } from './core';
import { fighterName, recStr } from './fighterGen';
import type { RNG } from './rng';
import type { DivisionId, GameState, OrgId, WorldFighter } from './types';

const ORDER = DIVISIONS.map((d) => d.id);
export const SUPER_ORG: OrgId = 'acl';
/** Consecutive defenses an AI HFC champion needs before he goes looking for a second belt. */
export const AI_SUPERFIGHT_DEFENSES = 3;
/** Weight-class moves across the whole world per month. */
const MAX_MOVES_PER_MONTH = 3;

export function neighbour(d: DivisionId, dir: 1 | -1): DivisionId | null {
  return ORDER[ORDER.indexOf(d) + dir] ?? null;
}
const heavier = (a: DivisionId, b: DivisionId) => ORDER.indexOf(a) > ORDER.indexOf(b);
const ageOf = (st: GameState, f: WorldFighter) => (st.day - f.bornDay) / 365;
const lastMove = (f: WorldFighter) => (f.mv?.length ? f.mv[f.mv.length - 1].d : -99999);

/** Fighters the player's offers, booking, card or pending events depend on. */
export function lockedIds(st: GameState): Set<string> {
  const s = new Set<string>();
  for (const o of st.offers) s.add(o.opponentId);
  if (st.scheduled) { s.add(st.scheduled.opponentId); for (const c of st.scheduled.card ?? []) { s.add(c.a); s.add(c.b); } }
  for (const e of st.pending) { const id = e.params?.opp ?? e.params?.offer?.opponentId; if (id) s.add(id); }
  return s;
}

/** Every belt a fighter holds (any promotion). */
export function beltsOf(st: GameState, id: string): { org: OrgId; div: DivisionId }[] {
  const out: { org: OrgId; div: DivisionId }[] = [];
  for (const o of ORGS) for (const d of ORDER) if (st.world.orgs[o.id]?.champions[d] === id) out.push({ org: o.id, div: d });
  return out;
}

function free(st: GameState, f: WorldFighter | undefined, locked: Set<string>): f is WorldFighter {
  return !!f && !f.retired && !f.am && !locked.has(f.id) && f.injuredUntil <= st.day && f.bookedUntil <= st.day;
}

/** Move a fighter to another weight class (news, ranking reset, notice to the player when it concerns them). */
export function moveFighter(st: GameState, f: WorldFighter, to: DivisionId, why: string, quiet = false) {
  const from = f.div;
  if (from === to) return;
  f.div = to;
  f.pts = Math.round(f.pts * 0.65) + 4;
  (f.mv ??= []).push({ d: st.day, f: from, t: to, why });
  if (f.mv.length > 6) f.mv.splice(0, f.mv.length - 6);
  if (quiet) return;
  const up = heavier(to, from);
  addNews(st, {
    kind: 'move', title: `${fighterName(f)} moves ${up ? 'up' : 'down'} to ${DIV[to].name}`,
    body: `The ${ORG[f.org].short} ${DIV[from].name} (${recStr(f.rec)}) changes weight class: ${why}.`,
    refs: [f.id], org: f.org, div: to, imp: ORG[f.org].tier >= 4 ? 2 : 1,
  });
  const p = st.player;
  if (p.isPro && !p.retired && p.orgId === f.org && p.divisionId === to)
    inbox(st, 'world', 'New arrival in your division', `${fighterName(f)} (${recStr(f.rec)}) moves ${up ? 'up' : 'down'} from ${DIV[from].name} to ${DIV[to].name}: ${why}.`);
}

/** Contenders stuck behind a champion, fighters on a slump, or fighters the wrong size for their class change weight. */
export function moveDivisions(st: GameState, rng: RNG): number {
  const locked = lockedIds(st);
  let moves = 0;
  for (const o of rng.shuffle([...ORGS])) {
    for (const d of rng.shuffle([...ORDER])) {
      const roster = rosterOf(st.world, o.id, d);
      if (roster.length < 6) continue; // never drain a division
      const champ = st.world.orgs[o.id].champions[d];
      const ranks = rankings(st, o.id, d);
      const rankOf = (id: string) => ranks.find((r) => r.id === id)?.rank ?? 99;
      for (const f of rng.shuffle([...roster])) {
        if (!free(st, f, locked) || f.id === champ || beltsOf(st, f.id).length) continue;
        if (lastMove(f) > st.day - 540) continue; // settle in for 18 months first
        const age = ageOf(st, f);
        const log = f.log ?? [];
        const recent = log.filter((e) => e[0] > st.day - 1100 && e[6] === o.id); // last ~3 years in this promotion
        const titleLosses = recent.filter((e) => e[7] && e[3] === 'L').length;
        const lostToChamp = champ ? recent.filter((e) => e[2] === champ && e[3] === 'L').length : 0;
        const slump = f.recent.length >= 3 && f.recent.slice(-3).every((r) => r === 'L');
        const size = f.h - DIV[d].avgHeight;
        let p = 0, dir: 1 | -1 = 1, why = '';
        if (titleLosses >= 2 && lostToChamp >= 1 && rankOf(f.id) <= 5) { p = 0.1; dir = size >= 0 || age > 30 ? 1 : -1; why = 'two title-fight losses left him stuck behind the champion'; }
        else if (slump && age < 32) { p = 0.04; dir = size > 3 ? 1 : -1; why = 'a fresh start after three straight losses'; }
        else if (size >= 7 && age >= 27) { p = 0.015; dir = 1; why = 'he has outgrown the weight cut'; }
        else if (size <= -7 && age <= 29) { p = 0.015; dir = -1; why = 'he is undersized and moves to a better fit'; }
        if (!p || !rng.chance(p)) continue;
        const to = neighbour(d, dir) ?? neighbour(d, dir === 1 ? -1 : 1);
        if (!to) continue;
        const p0 = st.player;
        const visible = o.tier >= 3 || (p0.orgId === o.id && (p0.divisionId === d || p0.divisionId === to));
        moveFighter(st, f, to, why, !visible);
        moves++;
        if (moves >= MAX_MOVES_PER_MONTH) return moves;
        break; // one move per promotion and division per month
      }
    }
  }
  return moves;
}

/** A dominant AI HFC champion challenges the champion of the next division (unless that champion is the player). */
export function aiSuperfights(st: GameState, rng: RNG): boolean {
  const os = st.world.orgs[SUPER_ORG];
  const locked = lockedIds(st);
  for (const d of rng.shuffle([...ORDER])) {
    const id = os.champions[d];
    if (!id || id === 'player') continue;
    const A = st.world.fighters[id];
    if (!free(st, A, locked) || A.div !== d || A.dbl != null || (A.rdf ?? 0) < AI_SUPERFIGHT_DEFENSES) continue;
    if (st.day - (A.sfx ?? -99999) < 365 || ageOf(st, A) > 37) continue;
    const dir: 1 | -1 = d === 'heavy' ? -1 : A.h - DIV[d].avgHeight >= -2 || rng.chance(0.6) ? 1 : -1;
    const t = neighbour(d, dir) ?? neighbour(d, dir === 1 ? -1 : 1);
    if (!t) continue;
    const holder = os.champions[t];
    if (holder === 'player') continue; // the player is challenged through a fight offer instead (fights.ts)
    if (!rng.chance(0.3)) continue;
    let B: WorldFighter | undefined;
    if (holder) B = st.world.fighters[holder];
    else B = rosterOf(st.world, SUPER_ORG, t).filter((f) => free(st, f, locked) && f.id !== A.id).sort((a, b) => b.pts - a.pts)[0];
    if (!free(st, B, locked) || B.id === A.id) continue;
    A.sfx = st.day;
    const res = bout(st, rng, SUPER_ORG, A, B, true, !holder, `${ORG[SUPER_ORG].short} Superfight`, t);
    const up = heavier(t, d);
    if (res.winner === 0) {
      A.dbl = st.day;
      addNews(st, { kind: 'superfight', title: `${fighterName(A)} becomes a double champion`, body: `The ${ORG[SUPER_ORG].short} ${DIV[d].name} champion moves ${up ? 'up' : 'down'} and takes the ${DIV[t].name} title from ${fighterName(B)} by ${res.method} (round ${res.round}).`, refs: [A.id, B.id], org: SUPER_ORG, div: t, imp: 3 });
    } else {
      addNews(st, { kind: 'superfight', title: res.winner === 1 ? `${fighterName(B)} turns back ${fighterName(A)}` : `Superfight ends in a draw`, body: `${fighterName(A)} moved ${up ? 'up' : 'down'} from ${DIV[d].name} for the ${DIV[t].name} title${res.winner === 1 ? ` and lost by ${res.method} in round ${res.round}` : ''}. He keeps his ${DIV[d].name} belt.`, refs: [A.id, B.id], org: SUPER_ORG, div: t, imp: 2 });
    }
    const p = st.player;
    if (p.isPro && p.orgId === SUPER_ORG && (p.divisionId === t || p.divisionId === d))
      inbox(st, 'world', 'Superfight in your division', `${fighterName(A)} (${DIV[d].name} champion) vs ${fighterName(B)} for the ${DIV[t].name} title: ${res.winner === 0 ? `${fighterName(A)} wins and holds two belts` : res.winner === 1 ? `${fighterName(B)} wins` : 'a draw'}.`);
    return true; // at most one superfight a month
  }
  return false;
}

/** Double champions hold both belts for a few months, then keep one and vacate the other. */
export function resolveDoubleChamps(st: GameState, rng: RNG) {
  for (const f of Object.values(st.world.fighters)) {
    if (f.retired || f.am) { if (beltsOf(st, f.id).length) vacateAllBelts(st, f, 'has retired'); else f.dbl = undefined; continue; }
    const belts = beltsOf(st, f.id);
    const byOrg = new Map<OrgId, DivisionId[]>();
    for (const b of belts) byOrg.set(b.org, [...(byOrg.get(b.org) ?? []), b.div]);
    let double = false;
    for (const [org, divs] of byOrg) {
      if (divs.length < 2) {
        // a single belt in another weight class: he now fights there
        if (divs[0] !== f.div && org === f.org) moveFighter(st, f, divs[0], 'he now competes where he holds the title', true);
        continue;
      }
      double = true;
      f.dbl ??= st.day;
      if (st.day - f.dbl < 120 || !rng.chance(0.5)) continue;
      const other = divs.find((x) => x !== f.div) ?? divs[1];
      const keep = rng.chance(0.55) ? other : divs.includes(f.div) ? f.div : divs[0];
      const os = st.world.orgs[org];
      for (const drop of divs.filter((x) => x !== keep)) {
        os.champions[drop] = null;
        addNews(st, { kind: 'title', title: `${fighterName(f)} vacates the ${ORG[org].short} ${DIV[drop].name} title`, body: `The double champion keeps the ${DIV[keep].name} belt and gives up ${DIV[drop].name}. That title is now vacant.`, refs: [f.id], org, div: drop, imp: ORG[org].tier >= 3 ? 2 : 1 });
        const p = st.player;
        if (p.isPro && p.orgId === org && p.divisionId === drop) inbox(st, 'world', `${ORG[org].short} ${DIV[drop].name} title vacated`, `${fighterName(f)} keeps his ${DIV[keep].name} belt. Your division's title is up for grabs.`);
      }
      if (keep !== f.div) moveFighter(st, f, keep, `he keeps the ${DIV[keep].name} belt as champion`, true);
      f.dbl = undefined;
      f.rdf = 0;
      double = false;
    }
    if (!double && f.dbl != null) f.dbl = undefined;
  }
}

/** Quarterly: rival promotions lure contenders and former champions away; now and then a champion jumps ship. */
export function poachStars(st: GameState, rng: RNG): number {
  const locked = lockedIds(st);
  let n = 0;
  for (const o of ORGS.filter((x) => x.tier >= 2).sort(() => rng.next() - 0.5)) {
    if (n >= 3) break;
    for (const d of rng.shuffle([...ORDER])) {
      const os = st.world.orgs[o.id];
      const champ = os.champions[d];
      const ranks = rankings(st, o.id, d).filter((r) => !r.isPlayer);
      // contenders (top 3) and former champions; a sitting champion only rarely
      const cands = ranks.filter((r) => (r.rank >= 1 && r.rank <= 3) || (r.champion && rng.chance(0.15))).map((r) => st.world.fighters[r.id])
        .filter((f) => free(st, f, locked) && ageOf(st, f) < 33 && st.day - lastMove(f) >= 180)
        .filter((f) => { const b = beltsOf(st, f.id); return b.length === 0 || (b.length === 1 && b[0].org === o.id && b[0].div === d && f.div === d); });
      const f = cands.find(() => rng.chance(0.07));
      if (!f) continue;
      const targets = ORGS.filter((x) => x.id !== o.id && x.tier >= o.tier && x.tier <= o.tier + 1 && x.tier >= 2);
      if (!targets.length) continue;
      const to = rng.pick(targets);
      const wasChamp = champ === f.id;
      if (wasChamp) {
        os.champions[d] = null;
        f.rgn = null; f.rdf = 0;
      }
      f.org = to.id;
      f.pts = Math.max(4, Math.round((orgLevelFor(to.id, 0.7) - to.level[0]) * 3));
      addNews(st, {
        kind: 'signing', title: `Bidding war: ${fighterName(f)} signs with the ${to.short}`,
        body: wasChamp
          ? `The ${o.short} ${DIV[d].name} champion vacates his belt and leaves for the ${to.name}.`
          : `The ${o.short} ${DIV[d].name} contender (${recStr(f.rec)}) leaves for the ${to.name}${to.tier > o.tier ? ', a step up' : ' after a rival offer'}.`,
        refs: [f.id], org: to.id, div: d, imp: wasChamp || to.tier >= 4 ? 2 : 1,
      });
      const p = st.player;
      if (p.isPro && p.divisionId === d && (p.orgId === to.id || (p.orgId === o.id && wasChamp)))
        inbox(st, 'world', wasChamp ? `${o.short} ${DIV[d].name} title vacated` : `New arrival in your division`, `${fighterName(f)} ${wasChamp ? `leaves the ${o.short} and vacates the belt` : `signs with the ${to.short}`}.`);
      n++;
      break;
    }
  }
  return n;
}

/** An AI HFC champion of a neighbouring division ready to come for the player's belt (see generateOffers). */
export function invaderFor(st: GameState): WorldFighter | null {
  const p = st.player;
  if (!p.isPro || p.orgId !== SUPER_ORG || st.world.orgs[SUPER_ORG].champions[p.divisionId] !== 'player') return null;
  const locked = lockedIds(st);
  const cands: WorldFighter[] = [];
  for (const dir of [1, -1] as const) {
    const nb = neighbour(p.divisionId, dir);
    if (!nb) continue;
    const id = st.world.orgs[SUPER_ORG].champions[nb];
    const f = id && id !== 'player' ? st.world.fighters[id] : undefined;
    if (!free(st, f, locked) || f.div !== nb || f.dbl != null || (f.rdf ?? 0) < AI_SUPERFIGHT_DEFENSES) continue;
    if (st.day - (f.sfx ?? -99999) < 365 || ageOf(st, f) > 37) continue;
    cands.push(f);
  }
  return cands.sort((a, b) => (b.rdf ?? 0) - (a.rdf ?? 0))[0] ?? null;
}

/** Monthly living-world tick. */
export function livingWorld(st: GameState, rng: RNG) {
  resolveDoubleChamps(st, rng);
  aiSuperfights(st, rng);
  moveDivisions(st, rng);
  if (Math.floor(st.day / 30) % 3 === 1) poachStars(st, rng);
}
