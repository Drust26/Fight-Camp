import { describe, it, expect } from 'vitest';
import { advanceDay, advanceDays, createCareer, type NewCareerOpts } from '../src/game/career';
import { acceptOffer, applyFightResult, opponentSetup, playerSetup, withdrawFromFight } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { activeEvents, resolveEvent } from '../src/game/events';
import { withRng } from '../src/game/core';
import { resolveCard } from '../src/game/eventcard';
import { introLines, postFightLines } from '../src/game/announcer';
import { applyInterview, interviewOptions } from '../src/game/interview';
import { Commentator, careerCommentaryContext } from '../src/game/commentary';
import { validate, migrate } from '../src/game/save';
import type { GameState } from '../src/game/types';

const base: NewCareerOpts = {
  firstName: 'Card', lastName: 'Tester', nickname: 'QA', nationality: 'Ireland', age: 23, heightCm: 180, reachCm: 183, hand: 'right', stance: 'orthodox',
  bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: ['champion'], divisionId: 'light', naturalKg: 76,
  appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 777,
};
const events = (st: GameState) => { for (const e of activeEvents(st)) resolveEvent(st, e.id, 0); };

function toFightNight(st: GameState) {
  const offer = st.offers.find((o) => !o.amateur) ?? st.offers[0];
  expect(acceptOffer(st, offer.id, 'general')).toBeNull();
  let g = 0;
  while (st.scheduled && st.day < st.scheduled.day && g++ < 80) { events(st); advanceDays(st, 7); }
  advanceDay(st); // weigh-in
  return st.scheduled!;
}
function fight(st: GameState) {
  const sc = st.scheduled!;
  const s = createFight({ rounds: sc.rounds, roundSeconds: 60, seed: 5 + st.day, title: sc.title }, playerSetup(st, sc.gamePlan), opponentSetup(st, sc.opponentId, sc.title));
  const me = new AIController(0, 'pressure', 'normal', 3), op = new AIController(1, st.world.fighters[sc.opponentId].style, 'normal', 4);
  const com = new Commentator(careerCommentaryContext(st)!);
  com.opening(s);
  let n = 0;
  while (s.phase !== 'over' && n++ < 200000) {
    if (s.phase === 'roundOver') { startNextRound(s); com.roundStart(s); }
    step(s, [me.think(s, 1 / 60), op.think(s, 1 / 60)], 1 / 60);
    for (const e of s.events.splice(0)) com.onEvent(e, s);
    if (n % 30 === 0) com.tick(s);
  }
  com.closing(s);
  return { s, com };
}

describe('fight night (Stage A)', () => {
  it('event card is booked with real fighters and resolved through the world simulation exactly once', () => {
    const st = createCareer(base, 1);
    const sc = toFightNight(st);
    expect(sc.card && sc.card.length).toBeGreaterThan(1);
    expect(sc.card!.filter((c) => c.player).length).toBe(1);
    // nobody appears twice on the card
    const ids = sc.card!.flatMap((c) => [c.a, c.b]);
    expect(new Set(ids).size).toBe(ids.length);
    const hist0 = st.world.history.length;
    const before = withRng(st, (rng) => resolveCard(st, rng, 'before'));
    const again = withRng(st, (rng) => resolveCard(st, rng, 'before'));
    expect(again.length).toBe(0); // idempotent
    const me = sc.card!.find((c) => c.player)!;
    expect(before.every((c) => c.order < me.order)).toBe(true);
    const recorded = before.filter((c) => c.result && c.result.r > 0).length;
    expect(st.world.history.length - hist0).toBe(recorded);
    // presentation data is consistent with the booking
    const intro = introLines(st, sc);
    expect(intro.lines.join(' ')).toContain(sc.eventName);
    expect([...intro.blue, ...intro.red].join(' ')).toContain(st.player.lastName.toUpperCase());
    // fight and apply: whole card resolved, player result on the card, recap news
    const { s, com } = fight(st);
    const r = applyFightResult(st, s, undefined, { commentary: com.lines })!;
    expect(r.cardResults!.every((c) => c.result)).toBe(true);
    const mine = r.cardResults!.find((c) => c.player)!;
    expect(mine.result!.w).toBe(r.draw ? -1 : r.playerWon ? 0 : 1);
    expect(r.rounds!.length).toBe(s.outcome!.round);
    expect(r.announce!.length).toBeGreaterThan(1);
    expect(r.announce![r.announce!.length - 1]).toContain(r.draw ? '' : (r.playerWon ? st.player.lastName.toUpperCase() : r.opponentName.toUpperCase()));
    expect(st.world.news.some((n) => n.kind === 'event' && n.title.includes(r.eventName))).toBe(true);
    // the commentary never contradicts the outcome
    const last = com.lines[com.lines.length - 1];
    if (s.outcome!.winner >= 0) expect(last).toContain(s.outcome!.winner === 0 ? st.player.lastName : st.world.fighters[r.opponentId].last);
    expect(validate(migrate(JSON.parse(JSON.stringify(st))))).toBeNull();
  });

  it('withdrawing releases every card fighter', () => {
    const st = createCareer({ ...base, seed: 991 }, 1);
    const offer = st.offers.find((o) => !o.amateur) ?? st.offers[0];
    acceptOffer(st, offer.id, 'general');
    const ids = st.scheduled!.card!.filter((c) => !c.player).flatMap((c) => [c.a, c.b]);
    withdrawFromFight(st);
    for (const id of ids) expect(st.world.fighters[id].bookedUntil).toBeLessThanOrEqual(st.day);
  });

  it('interviews apply once and feed matchmaking / sponsors', () => {
    const st = createCareer({ ...base, seed: 4321 }, 1);
    toFightNight(st);
    const { s } = fight(st);
    const r = applyFightResult(st, s)!;
    const opts = interviewOptions(st, r);
    expect(opts.map((o) => o.id)).toEqual(expect.arrayContaining(['respect', 'confident', 'humor', 'confront']));
    const buzz = st.sponsorBuzz, pop = st.player.popularity;
    const msg = applyInterview(st, st.lastResult!, 'humor');
    expect(msg).toMatch(/viral/);
    expect(st.sponsorBuzz).toBe(Math.min(3, buzz + 1));
    expect(st.player.popularity).toBeGreaterThan(pop);
    expect(applyInterview(st, st.lastResult!, 'confront')).toBe('Already interviewed.');
    expect(st.lastResult!.interview).toBe('humor');
    // a callout steers the next opponent selection
    if (r.playerWon && opts.find((o) => o.id === 'callout')) {
      const st2 = JSON.parse(JSON.stringify(st)) as GameState;
      st2.lastResult!.interview = undefined;
      const co = interviewOptions(st2, st2.lastResult!).find((o) => o.id === 'callout')!;
      applyInterview(st2, st2.lastResult!, 'callout');
      expect(st2.callout).toBe(co.target);
      expect(st2.rivalries[co.target!]).toBeGreaterThanOrEqual(30);
    }
  });

  it('post-fight announcement matches the scorecards', () => {
    const st = createCareer({ ...base, seed: 55 }, 1);
    toFightNight(st);
    const { s } = fight(st);
    const sc = { ...st.scheduled! };
    const r = applyFightResult(st, s)!;
    const lines = postFightLines(st, sc, r);
    if (['UD', 'SD', 'MD', 'DRAW'].includes(r.method)) expect(lines.filter((l) => l.startsWith('Judge')).length).toBe(3);
    else expect(lines.join(' ')).toContain(`round ${r.round}`);
  });
});
