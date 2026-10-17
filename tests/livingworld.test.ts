import { describe, it, expect } from 'vitest';
import { advanceDay, advanceDays, createCareer, type NewCareerOpts } from '../src/game/career';
import { acceptOffer, applyFightResult, generateOffers, opponentSetup, playerSetup } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { activeEvents, resolveEvent } from '../src/game/events';
import { withRng } from '../src/game/core';
import { aiSuperfights, beltsOf, lockedIds, moveDivisions, resolveDoubleChamps } from '../src/game/living';
import { rankings, rosterOf, vacateAllBelts } from '../src/game/world';
import { BID_ROUNDS, generateContractOffers, letThemBid, signContract } from '../src/game/economy';
import { posterForScheduled } from '../src/game/poster';
import { startReign } from '../src/game/reigns';
import { ATTRS, packAttrs, unpackAttrs } from '../src/game/attributes';
import { migrate, validate } from '../src/game/save';
import { DIV } from '../src/data/world';
import { runDays, baseOpts } from './worldHelpers';
import type { DivisionId, GameState, WorldFighter } from '../src/game/types';

const base: NewCareerOpts = { ...baseOpts, seed: 2026 };

function set(f: WorldFighter, v: number) { const a = unpackAttrs(f.a); for (const k of Object.keys(a)) (a as any)[k] = v; f.a = packAttrs(a); }
function freeUp(st: GameState, f: WorldFighter) { f.injuredUntil = 0; f.bookedUntil = 0; f.retired = false; }

function hfcPlayerChamp(div: DivisionId, seed = 2026): GameState {
  const st = createCareer({ ...base, divisionId: div, naturalKg: DIV[div].kg + 3, seed }, 1);
  const p = st.player;
  p.orgId = 'acl';
  p.contract = { orgId: 'acl', fightsTotal: 8, fightsLeft: 8, purse: 20000, winBonus: 20000, signingBonus: 0, exclusive: true, champClause: true, amateur: false, signedDay: 0 } as any;
  st.world.orgs.acl.champions[div] = 'player';
  p.isChampion = true; p.titles.push({ orgId: 'acl', divisionId: div, day: 0 }); p.reigns = []; startReign(st, 'acl', div, null, 'admin');
  p.weightKg = DIV[div].kg + 2;
  st.offers = [];
  return st;
}

function fightTo(st: GameState, playerShouldWin: boolean) {
  const sc = st.scheduled!;
  for (let seed = 1; seed < 12; seed++) {
    const me = playerSetup(st, sc.gamePlan), op = opponentSetup(st, sc.opponentId, sc.title);
    const strong = playerShouldWin ? me : op, weak = playerShouldWin ? op : me;
    for (const a of ATTRS) { (strong.attrs as any)[a.key] = 95; (weak.attrs as any)[a.key] = 20; }
    const s = createFight({ rounds: 5, roundSeconds: 60, seed, title: true }, me, op);
    const A = new AIController(0, 'pressure', 'hard', seed), B = new AIController(1, 'balanced', 'hard', seed + 1);
    let n = 0;
    while (s.phase !== 'over' && n++ < 400000) { if (s.phase === 'roundOver') startNextRound(s); step(s, [A.think(s, 1 / 60), B.think(s, 1 / 60)], 1 / 60); }
    if ((s.outcome!.winner === 0) === playerShouldWin && s.outcome!.winner !== -1) return s;
  }
  throw new Error('could not produce the required result');
}

describe('living world (v1.2)', () => {
  it('fighters change weight class over the years and the world stays consistent', { timeout: 120000 }, () => {
    const st = createCareer({ ...base, seed: 777 }, 1);
    runDays(st, 365 * 4);
    const movers = Object.values(st.world.fighters).filter((f) => f.mv?.length);
    expect(movers.length).toBeGreaterThan(10);
    expect(movers.length).toBeLessThan(260); // a living world, not a shuffle
    for (const f of movers) for (const m of f.mv!) { expect(m.f).not.toBe(m.t); expect(m.why.length).toBeGreaterThan(5); }
    expect(st.world.news.some((n) => n.kind === 'move')).toBe(true);
    resolveDoubleChamps(st, { chance: () => false, next: () => 0.99 } as any); // settle anyone mid-transition, never drop a belt
    for (const o of Object.values(st.world.orgs)) for (const [div, id] of Object.entries(o.champions)) {
      if (!id || id === 'player') continue;
      const f = st.world.fighters[id];
      expect(f && !f.retired).toBe(true); // no retired champions
      const belts = beltsOf(st, id);
      if (belts.length === 1) expect(f.div).toBe(div); // a single belt is held in his own weight class
      expect(rankings(st, o.id, div as DivisionId)[0].id).toBe(id); // the champion heads that division's rankings
    }
    expect(validate(migrate(JSON.parse(JSON.stringify(st))))).toBeNull();
  });

  it('a dominant AI champion wins a superfight, holds two belts, then vacates one', () => {
    const st = createCareer({ ...base, seed: 99 }, 1);
    st.player.orgId = 'ifc'; // keep the player out of the HFC
    const os = st.world.orgs.acl;
    const A = st.world.fighters[os.champions.light!]; const B = st.world.fighters[os.champions.welter!];
    freeUp(st, A); freeUp(st, B); set(A, 97); set(B, 25);
    A.rdf = 5; A.bornDay = st.day - 28 * 365; A.h = DIV.light.avgHeight + 3;
    for (let i = 0; i < 80 && A.sfx === undefined; i++) withRng(st, (rng) => aiSuperfights(st, rng));
    expect(A.sfx).toBe(st.day);
    const belts = beltsOf(st, A.id).filter((b) => b.org === 'acl').map((b) => b.div).sort();
    expect(belts.length).toBe(2); // 97 vs 25: the challenger wins (the run is deterministic)
    if (belts.length === 2) {
      expect(belts).toEqual(['light', 'welter']);
      expect(A.dbl).toBe(st.day);
      expect(rankings(st, 'acl', 'welter')[0].id).toBe(A.id); // heads both divisions
      expect(st.world.news.some((n) => n.kind === 'superfight' && n.title.includes('double champion'))).toBe(true);
      st.day += 130;
      for (let i = 0; i < 40 && A.dbl != null; i++) withRng(st, (rng) => resolveDoubleChamps(st, rng));
      const left = beltsOf(st, A.id).filter((b) => b.org === 'acl');
      expect(left).toHaveLength(1);
      expect(A.div).toBe(left[0].div);
      const dropped = belts.find((d) => d !== left[0].div) as DivisionId;
      expect(os.champions[dropped]).toBeNull();
    } else {
      expect(beltsOf(st, A.id).length).toBe(1); // he lost or drew: keeps his own belt
    }
  });

  it('weight-class moves never touch fighters booked against the player, and never drain a division', () => {
    const st = createCareer({ ...base, seed: 5 }, 1);
    runDays(st, 200);
    withRng(st, (rng) => generateOffers(st, rng));
    const locked = lockedIds(st);
    const before = Object.fromEntries(Object.values(st.world.fighters).map((f) => [f.id, f.div]));
    for (let i = 0; i < 40; i++) { st.day += 30; withRng(st, (rng) => moveDivisions(st, rng)); }
    for (const id of locked) if (st.world.fighters[id]) expect(st.world.fighters[id].div).toBe(before[id]);
    for (const o of Object.keys(st.world.orgs)) for (const d of Object.keys(DIV)) expect(rosterOf(st.world, o as any, d as DivisionId).length).toBeGreaterThanOrEqual(4);
  });

  it('a neighbouring HFC champion challenges the player; losing makes him a double champion', { timeout: 60000 }, () => {
    const st = hfcPlayerChamp('light');
    const inv = st.world.fighters[st.world.orgs.acl.champions.welter!];
    freeUp(st, inv); inv.rdf = 4; inv.bornDay = st.day - 29 * 365; inv.div = 'welter';
    let o;
    for (let i = 0; i < 200 && !(o = st.offers.find((x) => x.invader)); i++) { st.offers = []; st.lastOfferDay = -999; st.day++; inv.bookedUntil = 0; withRng(st, (rng) => generateOffers(st, rng)); }
    expect(o).toBeTruthy();
    expect(o!).toMatchObject({ invader: 'welter', title: true, opponentId: inv.id });
    expect(o!.div).toBeUndefined(); // fought for the player's lightweight belt
    expect(acceptOffer(st, o!.id, 'general')).toBeNull();
    const poster = posterForScheduled(st, st.scheduled!);
    expect(poster.tier).toBe('superfight');
    expect(poster.invader).toBe('welter');
    expect(poster.red.champion && poster.blue.champion).toBe(true);
    let g = 0;
    while (st.scheduled && st.day < st.scheduled.day && g++ < 40) { for (const e of activeEvents(st)) resolveEvent(st, e.id, 0); advanceDays(st, 7); }
    for (const e of activeEvents(st)) resolveEvent(st, e.id, 0);
    advanceDay(st);
    const r = applyFightResult(st, fightTo(st, false))!;
    expect(r.lostTitle).toBe(true);
    expect(beltsOf(st, inv.id).map((b) => b.div).sort()).toEqual(['light', 'welter']);
    expect(inv.dbl).toBe(st.day);
    expect(st.player.reigns![0].end?.kind).toBe('lost');
  });

  it('an in-demand free agent sets off a bidding war', () => {
    const st = hfcPlayerChamp('middle', 31);
    const p = st.player;
    // a GFC champion whose contract has run out
    st.world.orgs.acl.champions.middle = null; p.orgId = 'gfc'; st.world.orgs.gfc.champions.middle = 'player';
    p.contract!.orgId = 'gfc'; p.contract!.fightsLeft = 0; p.attrs = Object.fromEntries(Object.keys(p.attrs).map((k) => [k, 80])) as any;
    st.contractOffers = [];
    for (let i = 0; i < 30 && !st.contractOffers.some((c) => c.bid); i++) { st.day += 7; withRng(st, (rng) => generateContractOffers(st, rng)); }
    const bids = st.contractOffers.filter((c) => c.bid);
    expect(bids.length).toBeGreaterThanOrEqual(2);
    expect(bids.map((c) => c.orgId)).toContain('gfc');
    expect(st.bidRounds).toBe(0);
    const best0 = Math.max(...bids.map((c) => c.purse));
    for (let i = 0; i < BID_ROUNDS; i++) expect(withRng(st, (rng) => letThemBid(st, rng)).ok).toBe(true);
    const after = st.contractOffers.filter((c) => c.bid);
    expect(Math.max(...after.map((c) => c.purse))).toBeGreaterThan(best0);
    for (const c of after) { expect(c.purse).toBeLessThanOrEqual(c.bid!.max); expect(c.bid!.final).toBe(true); }
    expect(withRng(st, (rng) => letThemBid(st, rng)).ok).toBe(false); // no more rounds
    // no side offers while the war is on
    withRng(st, (rng) => generateContractOffers(st, rng));
    expect(st.contractOffers.every((c) => c.bid)).toBe(true);
    const pick = after.sort((a, b) => b.purse - a.purse)[0];
    expect(signContract(st, pick.id)).toBeNull();
    expect(st.contractOffers.some((c) => c.bid)).toBe(false); // the other bidders withdraw
    expect(st.bidRounds).toBeUndefined();
    expect(p.contract!.purse).toBe(pick.purse);
  });

  it('a retiring double champion gives up both belts', () => {
    const st = createCareer({ ...base, seed: 7 }, 1);
    const os = st.world.orgs.acl;
    const f = st.world.fighters[os.champions.middle!];
    os.champions.lhw = f.id; f.dbl = st.day;
    f.retired = true;
    vacateAllBelts(st, f, 'retires');
    expect(beltsOf(st, f.id)).toEqual([]);
    expect(os.champions.middle).toBeNull();
    expect(os.champions.lhw).toBeNull();
  });
});
