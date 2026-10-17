import { describe, it, expect } from 'vitest';
import { advanceDay, advanceDays, createCareer, previewAttrs, type NewCareerOpts } from '../src/game/career';
import { acceptOffer, applyFightResult, opponentSetup, playerSetup, doWeighIn } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { overallRating } from '../src/game/attributes';
import { playerRank, rankings } from '../src/game/world';
import { validate, migrate } from '../src/game/save';
import { negotiate, signContract, turnPro } from '../src/game/economy';
import { resolveEvent, activeEvents, EVENT } from '../src/game/events';
import { withRng } from '../src/game/core';
import type { GameState } from '../src/game/types';

const base: NewCareerOpts = {
  firstName: 'Test', lastName: 'Fighter', nickname: 'QA', nationality: 'Ireland', age: 22, heightCm: 180, reachCm: 183, hand: 'right', stance: 'orthodox',
  bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: ['champion'], divisionId: 'light', naturalKg: 76,
  appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 12345,
};

function resolveAllEvents(st: GameState) {
  for (const ev of activeEvents(st)) resolveEvent(st, ev.id, 0);
}

function fightIt(st: GameState) {
  const sc = st.scheduled!;
  const s = createFight({ rounds: sc.rounds, roundSeconds: 60, seed: 99 + st.day, title: sc.title }, playerSetup(st, sc.gamePlan), opponentSetup(st, sc.opponentId, sc.title));
  const me = new AIController(0, 'balanced', 'normal', 5);
  const op = new AIController(1, st.world.fighters[sc.opponentId].style, 'normal', 6);
  let n = 0;
  while (s.phase !== 'over' && n++ < 200000) {
    if (s.phase === 'roundOver') startNextRound(s);
    step(s, [me.think(s, 1 / 60), op.think(s, 1 / 60)], 1 / 60);
  }
  return s;
}

describe('career systems', () => {
  it('backgrounds create different starting profiles', () => {
    const w = previewAttrs({ ...base, background: 'wrestling' });
    const b = previewAttrs({ ...base, background: 'boxing' });
    expect(w.tdOffense).toBeGreaterThan(b.tdOffense + 15);
    expect(b.boxing).toBeGreaterThan(w.boxing + 15);
  });

  it('creates a valid career with offers, world and rankings', () => {
    const st = createCareer(base, 1);
    expect(validate(st)).toBeNull();
    expect(st.player.firstName).toBe('Test');
    expect(Object.keys(st.world.fighters).length).toBeGreaterThan(300);
    expect(st.offers.length).toBeGreaterThan(0);
    const r = rankings(st, 'ifc', 'light');
    expect(r[0].champion).toBe(true);
    expect(playerRank(st)).not.toBeNull();
    // survives JSON round trip (persistence)
    const back = migrate(JSON.parse(JSON.stringify(st)));
    expect(validate(back)).toBeNull();
  });

  it('training changes attributes, fatigue and money over time', () => {
    const st = createCareer(base, 1);
    const before = { ...st.player.attrs };
    const money0 = st.player.money;
    for (let i = 0; i < 14; i++) { resolveAllEvents(st); advanceDay(st); }
    const gained = Object.keys(before).filter((k) => (st.player.attrs as any)[k] > (before as any)[k] + 0.05);
    expect(gained.length).toBeGreaterThan(8);
    // no attribute jumps absurdly in two weeks
    for (const k of Object.keys(before)) expect((st.player.attrs as any)[k] - (before as any)[k]).toBeLessThan(4);
    expect(st.day).toBe(14);
    expect(st.player.money).not.toBe(money0);
  });

  it('full loop: accept offer → fight → result applied exactly once → continue career', () => {
    const st = createCareer(base, 1);
    const offer = st.offers[0];
    expect(acceptOffer(st, offer.id, 'general')).toBeNull();
    expect(st.scheduled).not.toBeNull();
    // advancing stops on fight day
    let guard = 0;
    while (st.scheduled && st.day < st.scheduled.day && guard++ < 80) { resolveAllEvents(st); advanceDays(st, 7); }
    expect(st.day).toBe(offer.day);
    const blocked = advanceDay(st);
    expect(blocked.stopped).toBe(true);
    expect(st.scheduled!.weighIn).toBeDefined();
    const recBefore = st.player.record.w + st.player.record.l + st.player.record.d;
    const moneyBefore = st.player.money;
    const fs = fightIt(st);
    expect(fs.outcome).not.toBeNull();
    const sum = applyFightResult(st, fs);
    expect(sum).not.toBeNull();
    const again = applyFightResult(st, fs);
    expect(again).toBeNull(); // exactly once
    expect(st.player.record.w + st.player.record.l + st.player.record.d).toBe(recBefore + 1);
    expect(st.player.money).toBeGreaterThan(moneyBefore - 5000);
    expect(st.player.history.length).toBe(1);
    expect(st.scheduled).toBeNull();
    // career continues: time advances and new offers arrive after suspension
    for (let i = 0; i < 60; i++) { resolveAllEvents(st); advanceDay(st); }
    expect(st.day).toBeGreaterThan(offer.day + 50);
    expect(st.offers.length + st.contractOffers.length).toBeGreaterThan(0);
  });

  it('a multi-fight career progresses rankings and world', { timeout: 120000 }, () => {
    const st = createCareer({ ...base, seed: 777 }, 1);
    let fights = 0;
    for (let t = 0; t < 900 && fights < 6; t++) {
      resolveAllEvents(st);
      if (!st.player.contract || st.player.contract.fightsLeft === 0) {
        const c = st.contractOffers[0];
        if (c) signContract(st, c.id);
      }
      if (!st.scheduled && st.offers.length) acceptOffer(st, st.offers[0].id, 'general');
      if (st.scheduled && st.scheduled.day <= st.day) {
        const fs = fightIt(st);
        applyFightResult(st, fs);
        fights++;
        continue;
      }
      advanceDay(st);
    }
    console.log('after', fights, 'fights: record', st.player.record, 'rank', playerRank(st), 'ovr', overallRating(st.player.attrs), 'money', Math.round(st.player.money), 'day', st.day, 'org', st.player.orgId);
    expect(fights).toBeGreaterThanOrEqual(4);
    expect(validate(st)).toBeNull();
    // ranking points respond to results
    expect(st.player.rankPoints).not.toBe(10);
  });

  it('negotiation responds to demands; amateurs can turn pro', () => {
    const st = createCareer({ ...base, startLevel: 'amateur' }, 2);
    expect(st.player.isPro).toBe(false);
    expect(turnPro(st)).not.toBeNull(); // needs fights first
    st.player.amateurRecord.w = 3;
    expect(turnPro(st)).toBeNull();
    expect(st.player.isPro).toBe(true);
    const st2 = createCareer(base, 3);
    withRng(st2, (rng) => st2.contractOffers.push({ id: 'x', orgId: 'rfl', fights: 4, purse: 3000, winBonus: 3000, signingBonus: 500, exclusive: true, champClause: false, patience: 3, expiresDay: 99, note: '' }));
    const r = negotiate(st2, 'x', { purse: 30000, winBonus: 30000, signingBonus: 50000, fights: 1 });
    expect(['rejected', 'walked']).toContain(r.result);
    void EVENT;
  });
});
