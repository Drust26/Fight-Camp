import { describe, it, expect } from 'vitest';
import { advanceDay, advanceDays, createCareer, type NewCareerOpts } from '../src/game/career';
import { acceptOffer, applyFightResult, declineOffer, generateOffers, opponentSetup, playerSetup, weightCutInfo } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { activeEvents, resolveEvent } from '../src/game/events';
import { withRng } from '../src/game/core';
import { rankings } from '../src/game/world';
import { chooseBelt, defensesUntilSuperfight, superfightDivision, BOOST } from '../src/game/superfight';
import { migrate, validate } from '../src/game/save';
import { ATTRS } from '../src/game/attributes';
import { DIV } from '../src/data/world';
import type { DivisionId, GameState } from '../src/game/types';

const base: NewCareerOpts = {
  firstName: 'Champ', lastName: 'Champ', nickname: '', nationality: 'Ireland', age: 26, heightCm: 180, reachCm: 185, hand: 'right', stance: 'orthodox',
  bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: [], divisionId: 'light', naturalKg: 74,
  appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 8080,
};

/** An HFC champion of `div` with `defenses` consecutive defenses (set up directly, like the admin tools do). */
function hfcChamp(div: DivisionId, defenses: number, seed = 8080): GameState {
  const st = createCareer({ ...base, divisionId: div, naturalKg: DIV[div].kg + 3, seed }, 1);
  const p = st.player;
  p.orgId = 'acl';
  p.contract = { orgId: 'acl', fightsTotal: 8, fightsLeft: 8, purse: 20000, winBonus: 20000, signingBonus: 0, exclusive: true, champClause: true, amateur: false, signedDay: 0 } as any;
  p.divisionId = div;
  st.world.orgs.acl.champions[div] = 'player';
  p.isChampion = true;
  p.titles.push({ orgId: 'acl', divisionId: div, day: 0 });
  p.reignDefenses = defenses;
  p.titleDefenses = defenses;
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
    const a = new AIController(0, 'pressure', 'hard', seed), b = new AIController(1, 'balanced', 'hard', seed + 1);
    let n = 0;
    while (s.phase !== 'over' && n++ < 400000) { if (s.phase === 'roundOver') startNextRound(s); step(s, [a.think(s, 1 / 60), b.think(s, 1 / 60)], 1 / 60); }
    if ((s.outcome!.winner === 0) === playerShouldWin && s.outcome!.winner !== -1) return s;
  }
  throw new Error('could not produce the required result');
}

function offerSuperfight(st: GameState) {
  for (let i = 0; i < 400 && !st.offers.some((o) => o.superfight); i++) { st.lastOfferDay = -999; st.day++; withRng(st, (rng) => generateOffers(st, rng)); }
  return st.offers.find((o) => o.superfight)!;
}
function bookAndReach(st: GameState, offerId: string) {
  expect(acceptOffer(st, offerId, 'general')).toBeNull();
  let g = 0;
  while (st.scheduled && st.day < st.scheduled.day && g++ < 40) { for (const e of activeEvents(st)) resolveEvent(st, e.id, 0); advanceDays(st, 7); }
  for (const e of activeEvents(st)) resolveEvent(st, e.id, 0);
  advanceDay(st); // weigh-in
}

describe('HFC superfights', () => {
  it('follows the division rules for double and triple champion paths', () => {
    const t = (div: DivisionId, L: 0 | 1 | 2, origin: DivisionId | null = null) => { const st = hfcChamp(div, 10); st.player.champStatus = L; st.player.superOrigin = origin; return superfightDivision(st); };
    expect(t('light', 0)).toEqual({ div: 'welter', level: 1 });
    expect(t('heavy', 0)).toEqual({ div: 'lhw', level: 1 }); // heavyweights go down
    expect(t('lhw', 0)).toEqual({ div: 'heavy', level: 1 });
    expect(t('lhw', 1, 'middle')).toEqual({ div: 'heavy', level: 2 }); // a middleweight who moved up keeps going up
    expect(t('middle', 1, 'middle')).toBeNull(); // kept the original belt: no triple path
    expect(t('lhw', 1, 'heavy')).toBeNull(); // started at heavyweight: double only
    expect(t('heavy', 1, 'heavy')).toBeNull();
    expect(t('lhw', 1, 'lhw')).toEqual({ div: 'middle', level: 2 }); // LHW who did not move up → down to MW
    expect(t('heavy', 1, 'lhw')).toBeNull(); // LHW who moved up to HW: no triple
    expect(t('welter', 2, 'light')).toBeNull(); // triple is the top
    const other = hfcChamp('light', 10); other.player.orgId = 'gfc'; other.world.orgs.gfc.champions.light = 'player';
    expect(superfightDivision(other)).toBeNull(); // HFC only
    expect(defensesUntilSuperfight(hfcChamp('light', 3))).toBe(1);
    expect(defensesUntilSuperfight(hfcChamp('light', 4))).toBe(0);
    const tr = hfcChamp('welter', 5); tr.player.champStatus = 1; tr.player.superOrigin = 'light';
    expect(defensesUntilSuperfight(tr)).toBe(1); // triple needs 6
  });

  it('no offer before 4 defenses; at 4 the HFC offers the division above (plus a normal defense)', () => {
    const early = hfcChamp('light', 3);
    for (let i = 0; i < 60; i++) { early.lastOfferDay = -999; early.day++; withRng(early, (rng) => generateOffers(early, rng)); }
    expect(early.offers.some((o) => o.superfight)).toBe(false);
    const st = hfcChamp('light', 4);
    const o = offerSuperfight(st);
    expect(o).toBeTruthy();
    expect(o.div).toBe('welter');
    expect(o.title).toBe(true);
    expect(o.opponentId).toBe(st.world.orgs.acl.champions.welter);
    // still on the table (and never duplicated) while unanswered
    for (let i = 0; i < 10; i++) { st.day++; st.lastOfferDay = -999; withRng(st, (rng) => generateOffers(st, rng)); }
    expect(st.offers.filter((x) => x.superfight).length).toBe(1);
    expect(defensesUntilSuperfight(st)).toBe(0);
    // turning it down → offered again after two more defenses
    declineOffer(st, st.offers.find((x) => x.superfight)!.id);
    expect(defensesUntilSuperfight(st)).toBe(2);
  });

  it('is always proposed at 4 defenses: busy/injured champion, full offer list, no rest, expired offer', () => {
    const st = hfcChamp('light', 4, 4242);
    const champ = st.world.fighters[st.world.orgs.acl.champions.welter as string];
    champ.injuredUntil = st.day + 50; champ.bookedUntil = st.day + 20;
    // two regular offers already open and the player just fought
    st.player.history.unshift({ id: 'h', day: st.day - 1, orgId: 'acl', event: 'HFC', opponentId: 'x', opponentName: 'X', opponentRecord: '1-0', result: 'W', method: 'UD', round: 5, time: '5:00', title: true, amateur: false, earnings: 0, bonuses: [], notes: '' } as any);
    st.offers = [{ id: 'r1', orgId: 'acl', opponentId: Object.keys(st.world.fighters)[0], eventName: 'X', day: st.day + 30, rounds: 5, purse: 1, winBonus: 1, title: true, shortNotice: false, expiresDay: st.day + 9, amateur: false, rivalry: false },
      { id: 'r2', orgId: 'acl', opponentId: Object.keys(st.world.fighters)[1], eventName: 'Y', day: st.day + 30, rounds: 5, purse: 1, winBonus: 1, title: true, shortNotice: false, expiresDay: st.day + 9, amateur: false, rivalry: false }];
    withRng(st, (rng) => generateOffers(st, rng)); // a single call is enough — no chance roll, no rest period
    const sf = st.offers.find((o) => o.superfight)!;
    expect(sf).toBeTruthy();
    expect(sf.opponentId).toBe(champ.id); // still the champion
    expect(sf.day).toBeGreaterThanOrEqual(champ.injuredUntil + 14); // scheduled after he is healthy
    // the offer lapses without an answer → it comes straight back
    st.day = sf.expiresDay + 1; champ.injuredUntil = 0; champ.bookedUntil = 0;
    withRng(st, (rng) => generateOffers(st, rng));
    expect(st.offers.filter((o) => o.superfight).length).toBe(1);
    expect(st.offers.find((o) => o.superfight)!.id).not.toBe(sf.id);
  });

  it('winning makes a double champion who chooses a belt; triple path follows after 6 defenses', () => {
    const st = hfcChamp('light', 4, 777);
    const o = offerSuperfight(st);
    const welterChamp = o.opponentId;
    bookAndReach(st, o.id);
    expect(st.scheduled!.weighIn!.limitKg).toBeCloseTo(DIV.welter.kg, 1); // fought at welterweight limits
    expect(weightCutInfo(st).limit).toBeCloseTo(DIV.welter.kg, 1);
    const r = applyFightResult(st, fightTo(st, true))!;
    expect(r.playerWon && r.wonTitle && r.superfight).toBe(true);
    expect(st.world.orgs.acl.champions.light).toBe('player');
    expect(st.world.orgs.acl.champions.welter).toBe('player');
    expect(st.player.champStatus).toBe(1);
    expect(st.player.pendingBeltChoice).toMatchObject({ home: 'light', won: 'welter', level: 1 });
    expect(st.world.fighters[welterChamp].rgn ?? null).toBeNull();
    expect(r.announce!.join(' ')).toContain('DOUBLE CHAMPION');
    expect(rankings(st, 'acl', 'welter')[0].isPlayer).toBe(true);
    // no new offers until the belt decision is made
    st.day += 60; st.lastOfferDay = -999; withRng(st, (rng) => generateOffers(st, rng));
    expect(st.offers.length).toBe(0);
    const before = st.player.attrs.boxing;
    expect(chooseBelt(st, 'welter', 'boxing')).toBeNull();
    expect(st.player.divisionId).toBe('welter');
    expect(st.world.orgs.acl.champions.light).toBeNull(); // the other belt is vacated
    expect(st.world.orgs.acl.champions.welter).toBe('player');
    expect(st.player.attrs.boxing).toBeCloseTo(Math.min(99, before + BOOST[1]), 5);
    expect(st.player.reignDefenses).toBe(0);
    expect(st.player.superOrigin).toBe('light');
    expect(superfightDivision(st)).toEqual({ div: 'middle', level: 2 });
    expect(defensesUntilSuperfight(st)).toBe(6);
    st.player.reignDefenses = 6;
    expect(defensesUntilSuperfight(st)).toBe(0);
    expect(st.achievements.length >= 0).toBe(true);
    expect(validate(migrate(JSON.parse(JSON.stringify(st))))).toBeNull();
  });

  it('losing a superfight sends the champion home with the belt', () => {
    const st = hfcChamp('light', 4, 991);
    const o = offerSuperfight(st);
    bookAndReach(st, o.id);
    const r = applyFightResult(st, fightTo(st, false))!;
    expect(r.playerWon).toBe(false);
    expect(r.lostTitle).toBe(false);
    expect(st.player.divisionId).toBe('light');
    expect(st.world.orgs.acl.champions.light).toBe('player');
    expect(st.world.orgs.acl.champions.welter).toBe(o.opponentId);
    expect(st.player.champStatus ?? 0).toBe(0);
    expect(st.player.pendingBeltChoice ?? null).toBeNull();
    expect(st.player.reignDefenses).toBe(4);
    expect(defensesUntilSuperfight(st)).toBe(2);
  });

  it('saves from the earlier build that blocked the re-offer get the superfight straight away', () => {
    const st = hfcChamp('light', 4, 515) as any;
    st.player.superNextAt = 6; st.version = 7; // what the old build stored after showing one offer
    const m = migrate(JSON.parse(JSON.stringify(st)));
    expect(defensesUntilSuperfight(m)).toBe(0);
    withRng(m, (rng) => generateOffers(m, rng));
    expect(m.offers.some((o) => o.superfight)).toBe(true);
  });

  it('v6 migration counts the current reign\'s consecutive defenses from fight history', () => {
    const st = hfcChamp('light', 0) as any;
    st.version = 5; delete st.player.reignDefenses; delete st.player.champStatus;
    st.player.reignStart = 100;
    const h = (day: number, title: boolean, result: string) => ({ id: `h${day}`, day, orgId: 'acl', event: 'HFC', opponentId: 'x', opponentName: 'X', opponentRecord: '1-0', result, method: 'UD', round: 5, time: '5:00', title, amateur: false, earnings: 0, bonuses: [], notes: '' });
    st.player.history = [h(400, true, 'W'), h(300, true, 'W'), h(200, true, 'W'), h(100, true, 'W'), h(50, false, 'W')];
    st.player.titleDefenses = 3;
    const m = migrate(JSON.parse(JSON.stringify(st)));
    expect(m.player.reignDefenses).toBe(3);
    expect(m.player.champStatus).toBe(0);
  });
});
