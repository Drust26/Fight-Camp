// Full event cards around the player's bout. Undercard bouts use real roster fighters, are booked
// (so the world sim can't double-book them) and are resolved through world.bout() — the same shared
// path as every other world result — so records, rankings, belts and news all update consistently.
import { RNG, uid } from './rng';
import { ORG, DIVISIONS } from '../data/world';
import { bout, rankings, rosterOf, quickFight, recordResult } from './world';
import { genFighter } from './fighterGen';
import { addNews, nameOf, ovrOf } from './history';
import type { CardBout, DivisionId, FightOffer, GameState, WorldFighter } from './types';

const CARD_SIZE = [4, 6, 7, 9, 11, 11]; // by tier (0 = amateur)
export const SLOT_NAME: Record<CardBout['slot'], string> = { prelim: 'Preliminary card', main: 'Main card', comain: 'Co-main event', mainevent: 'Main event' };

function freeFor(st: GameState, f: WorldFighter, day: number) {
  return !f.retired && !f.am && f.injuredUntil <= day && f.bookedUntil <= st.day && day - f.lastFight > 35;
}

export function buildCard(st: GameState, rng: RNG, o: FightOffer): CardBout[] {
  const p = st.player;
  const card: CardBout[] = [];
  const used = new Set<string>([o.opponentId]);
  const tier = o.amateur ? 0 : ORG[o.orgId].tier;
  const size = CARD_SIZE[tier];
  const playerBout: CardBout = { id: uid(rng, 'cb'), a: 'player', b: o.opponentId, div: o.div ?? p.divisionId, title: o.title, slot: 'prelim', order: 0, player: true };
  card.push(playerBout);

  if (o.amateur) {
    // amateur showcase: fresh amateur-pool pairs
    for (let i = 1; i < size; i++) {
      const div = rng.chance(0.5) ? p.divisionId : rng.pick(DIVISIONS).id;
      const lvl = rng.int(28, 46);
      const a = genFighter(rng, { org: 'ifc', div, level: lvl, day: st.day, tier: 0, ageRange: [18, 25] });
      const b = genFighter(rng, { org: 'ifc', div, level: lvl + rng.int(-4, 4), day: st.day, tier: 0, ageRange: [18, 25] });
      for (const f of [a, b]) { f.am = true; f.rec = { w: rng.int(0, 4), l: rng.int(0, 3), d: 0, ko: 0, tko: 0, sub: 0, dec: 0, lossKo: 0, lossSub: 0, lossDec: 0 }; f.rec.dec = f.rec.w; f.bookedUntil = o.day + 1; st.world.fighters[f.id] = f; }
      card.push({ id: uid(rng, 'cb'), a: a.id, b: b.id, div, title: false, slot: 'prelim', order: 0 });
    }
  } else {
    // one AI title fight when a champion is due, unless the player is fighting for that belt
    const os = st.world.orgs[o.orgId];
    const divs = DIVISIONS.map((d) => d.id).filter((d) => !(o.title && d === (o.div ?? p.divisionId)));
    for (const d of rng.shuffle([...divs])) {
      const champId = os.champions[d];
      const champ = champId && champId !== 'player' ? st.world.fighters[champId] : null;
      if (!champ || !freeFor(st, champ, o.day) || o.day - champ.lastFight < 90 || used.has(champ.id) || !rng.chance(0.5)) continue;
      const contender = rankings(st, o.orgId, d).find((r) => !r.isPlayer && !r.champion && !r.injured && !used.has(r.id) && freeFor(st, st.world.fighters[r.id], o.day));
      if (!contender) continue;
      card.push({ id: uid(rng, 'cb'), a: champ.id, b: contender.id, div: d, title: true, slot: 'prelim', order: 0 });
      used.add(champ.id); used.add(contender.id);
      break;
    }
    // regular bouts: matched on ranking points, player's division favoured
    let guard = 0;
    while (card.length < size && guard++ < 60) {
      const div: DivisionId = rng.chance(0.3) ? p.divisionId : rng.pick(DIVISIONS).id;
      const champId = os.champions[div];
      const pool = rosterOf(st.world, o.orgId, div).filter((f) => f.id !== champId && !used.has(f.id) && freeFor(st, f, o.day));
      if (pool.length < 2) continue;
      const a = rng.pick(pool);
      const b = pool.filter((f) => f.id !== a.id).sort((x, y) => Math.abs(x.pts - a.pts) - Math.abs(y.pts - a.pts))[Math.min(pool.length - 2, rng.int(0, 1))];
      card.push({ id: uid(rng, 'cb'), a: a.id, b: b.id, div, title: false, slot: 'prelim', order: 0 });
      used.add(a.id); used.add(b.id);
    }
    for (const c of card) for (const id of [c.a, c.b]) if (id !== 'player' && st.world.fighters[id]) st.world.fighters[id].bookedUntil = Math.max(st.world.fighters[id].bookedUntil, o.day + 1);
  }

  // billing: titles headline, then the player's standing, then the fighters' points
  const billing = (c: CardBout) => {
    if (c.title) return 1000 + (c.player ? 5 : 0);
    if (c.player) {
      const r = o.amateur ? 99 : (o.superfight ? 0 : rankings(st, o.orgId, p.divisionId).find((x) => x.isPlayer)?.rank ?? 99);
      return Math.max(0, 300 - r * 22) + p.popularity * 2 + (o.rivalry ? 60 : 0);
    }
    const fa = st.world.fighters[c.a], fb = st.world.fighters[c.b];
    return ((fa?.pts ?? 0) + (fb?.pts ?? 0)) / 2 + ((fa?.pop ?? 0) + (fb?.pop ?? 0)) / 2;
  };
  card.sort((x, y) => billing(y) - billing(x));
  card.forEach((c, i) => (c.slot = i === 0 ? 'mainevent' : i === 1 ? 'comain' : i <= 4 ? 'main' : 'prelim'));
  if (o.amateur) card.forEach((c) => (c.slot = 'prelim'));
  // running order: last on the card fights last
  card.reverse().forEach((c, i) => (c.order = i));
  return card;
}

/** Resolve undercard bouts before (or after) the player's bout. Idempotent per bout. */
export function resolveCard(st: GameState, rng: RNG, phase: 'before' | 'after'): CardBout[] {
  const sc = st.scheduled;
  if (!sc?.card) return [];
  const me = sc.card.find((c) => c.player);
  const out: CardBout[] = [];
  for (const c of [...sc.card].sort((x, y) => x.order - y.order)) {
    if (c.player || c.result) continue;
    if (phase === 'before' && me && c.order > me.order) continue;
    const a = st.world.fighters[c.a], b = st.world.fighters[c.b];
    if (!a || !b || a.retired || b.retired || a.injuredUntil > st.day || b.injuredUntil > st.day) {
      const who = !a || a.retired || a.injuredUntil > st.day ? c.a : c.b;
      c.result = { w: -1, m: 'DRAW', r: 0, note: `Cancelled — ${nameOf(st, who)} withdrew` };
      for (const f of [a, b]) if (f) f.bookedUntil = st.day;
      out.push(c);
      continue;
    }
    a.bookedUntil = b.bookedUntil = st.day; // free them so the bout itself can be recorded
    if (a.am || b.am) {
      const r = quickFight(rng, a, b, 3);
      if (r.winner === -1) { recordResult(a, 'D', 'DRAW'); recordResult(b, 'D', 'DRAW'); }
      else { recordResult(r.winner === 0 ? a : b, 'W', r.method); recordResult(r.winner === 0 ? b : a, 'L', r.method); }
      a.lastFight = b.lastFight = st.day;
      c.result = { w: r.winner, m: r.method, r: r.round };
    } else {
      // title still valid? (the champion may have changed through other events)
      const champ = st.world.orgs[sc.orgId].champions[c.div];
      const title = c.title && (champ === c.a || champ === c.b);
      const before = { a: ovrOf(st, c.a), b: ovrOf(st, c.b) };
      const r = bout(st, rng, sc.orgId, a, b, title, false, sc.eventName);
      const gap = r.winner === 0 ? before.b - before.a : r.winner === 1 ? before.a - before.b : 0;
      c.result = { w: r.winner, m: r.method, r: r.round, note: gap >= 6 ? 'Upset!' : undefined };
      c.title = title;
    }
    out.push(c);
  }
  return out;
}

/** After the whole event: one recap story in the world feed. */
export function eventRecap(st: GameState) {
  const sc = st.scheduled;
  if (!sc?.card || sc.amateur) return;
  const done = sc.card.filter((c) => c.result && c.result.r > 0);
  const finishes = done.filter((c) => ['KO', 'TKO', 'SUB'].includes(c.result!.m)).length;
  const main = [...sc.card].sort((a, b) => b.order - a.order)[0];
  const mainTxt = main.result && main.result.r > 0
    ? `${nameOf(st, main.result.w === 1 ? main.b : main.a)} ${main.result.w === -1 ? 'drew with' : 'def.'} ${nameOf(st, main.result.w === 1 ? main.a : main.b)} (${main.result.m}) in the main event`
    : 'The main event delivered';
  addNews(st, { kind: 'event', title: `${sc.eventName} recap`, body: `${mainTxt}. ${done.length} bouts, ${finishes} finish${finishes === 1 ? '' : 'es'}${done.some((c) => c.result?.note === 'Upset!') ? ', and at least one upset' : ''}.`, refs: [main.a, main.b], org: sc.orgId, imp: ORG[sc.orgId].tier >= 3 ? 2 : 1 });
}

export function releaseCard(st: GameState) {
  const sc = st.scheduled;
  if (!sc?.card) return;
  for (const c of sc.card) for (const id of [c.a, c.b]) {
    const f = st.world.fighters[id];
    if (f && !c.result) f.bookedUntil = st.day;
  }
}

export type EventKind = 'amateur' | 'regional' | 'standard' | 'major' | 'title';
export function eventKind(o: { amateur: boolean; orgId: string; title: boolean; card?: CardBout[] }): EventKind {
  if (o.amateur) return 'amateur';
  const tier = ORG[o.orgId as keyof typeof ORG].tier;
  if (o.title) return 'title';
  if (tier >= 4 || (tier >= 3 && o.card?.some((c) => c.title))) return 'major';
  return tier <= 2 ? 'regional' : 'standard';
}
