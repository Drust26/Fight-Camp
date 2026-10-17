// Regression: a pre-fight event (media request / training-partner intel) still pending after the fight made the
// hub crash with "Cannot read properties of null (reading 'opponentId')" on every load.
import { describe, it, expect } from 'vitest';
import { advanceDay, advanceDays, createCareer } from '../src/game/career';
import { acceptOffer, applyFightResult, opponentSetup, playerSetup } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { activeEvents, EVENT, expireEvents, resolveEvent } from '../src/game/events';
import { migrate, validate } from '../src/game/save';
import type { GameState } from '../src/game/types';
import type { NewCareerOpts } from '../src/game/career';

const baseOpts: NewCareerOpts = {
  firstName: 'Ev', lastName: 'Regress', nickname: '', nationality: 'Brazil', age: 22, heightCm: 180, reachCm: 183, hand: 'right', stance: 'orthodox',
  bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: [], divisionId: 'light', naturalKg: 74,
  appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 4242,
};

function toFight(st: GameState) {
  const o = st.offers.find((x) => !x.amateur) ?? st.offers[0];
  expect(acceptOffer(st, o.id, 'general')).toBeNull();
  let g = 0;
  while (st.scheduled && st.day < st.scheduled.day && g++ < 80) { for (const e of activeEvents(st)) resolveEvent(st, e.id, 0); advanceDays(st, 7); }
  advanceDay(st);
}
function fightAndApply(st: GameState) {
  const sc = st.scheduled!;
  const s = createFight({ rounds: sc.rounds, roundSeconds: 60, seed: 3 + st.day, title: sc.title }, playerSetup(st, sc.gamePlan), opponentSetup(st, sc.opponentId, sc.title));
  const a = new AIController(0, 'pressure', 'normal', 1), b = new AIController(1, 'balanced', 'easy', 2);
  let n = 0;
  while (s.phase !== 'over' && n++ < 200000) { if (s.phase === 'roundOver') startNextRound(s); step(s, [a.think(s, 1 / 60), b.think(s, 1 / 60)], 1 / 60); }
  return applyFightResult(st, s);
}

describe('fight-linked events (crash regression)', () => {
  it('stale pre-fight events never reach the hub, never crash on expiry, and are repaired on load', () => {
    const st = createCareer({ ...baseOpts, seed: 2468 }, 1);
    toFight(st);
    // old-format events (params {} like saves made before the fix) plus new-format ones
    st.pending.push({ id: 'e_old_j', templateId: 'journalist', day: st.day, params: {} });
    st.pending.push({ id: 'e_old_p', templateId: 'partner_intel', day: st.day, params: {} });
    // while the fight is booked they are valid and render
    for (const ev of activeEvents(st)) { EVENT[ev.templateId].title(st, ev); EVENT[ev.templateId].body(st, ev); }
    expect(fightAndApply(st)).not.toBeNull();
    expect(st.scheduled).toBeNull();
    expect(st.pending.some((e) => e.templateId === 'journalist' || e.templateId === 'partner_intel')).toBe(false);
    // a save written by the buggy version: the stale events are still in the data
    const broken = JSON.parse(JSON.stringify(st)) as GameState;
    broken.pending.push({ id: 'e_stale', templateId: 'journalist', day: broken.day - 1, params: {} });
    broken.pending.push({ id: 'e_stale2', templateId: 'partner_intel', day: broken.day - 5, params: {} });
    expect(activeEvents(broken).length).toBe(0); // the hub would no longer show them
    expect(() => expireEvents(broken)).not.toThrow(); // auto-resolution used to call scheduled!.prep
    broken.pending.push({ id: 'e_stale3', templateId: 'journalist', day: broken.day - 1, params: {} });
    const repaired = migrate(JSON.parse(JSON.stringify(broken)));
    expect(validate(repaired)).toBeNull();
    expect(repaired.pending.some((e) => e.id === 'e_stale3')).toBe(false);
    // and the career carries on
    for (let i = 0; i < 40; i++) { for (const e of activeEvents(repaired)) { const t = EVENT[e.templateId]; t.title(repaired, e); t.body(repaired, e); resolveEvent(repaired, e.id, 0); } advanceDay(repaired); }
    expect(repaired.day).toBeGreaterThan(broken.day + 30);
  });

  it('events from one booking do not leak into the next booking', () => {
    const st = createCareer({ ...baseOpts, seed: 1357 }, 1);
    toFight(st);
    const fightId = st.scheduled!.id;
    st.pending.push({ id: 'e1', templateId: 'journalist', day: st.day, params: { opp: st.scheduled!.opponentId, fight: fightId } });
    fightAndApply(st);
    // pretend a new fight got booked later
    st.scheduled = { ...(JSON.parse(JSON.stringify(st.lastResult)) as any), id: 'other', opponentId: st.lastResult!.opponentId, day: st.day + 30 } as any;
    st.pending.push({ id: 'e2', templateId: 'journalist', day: st.day, params: { opp: 'x', fight: fightId } });
    expect(activeEvents(st).some((e) => e.id === 'e2')).toBe(false);
  });
});

describe('v5: top promotion renamed to the Hexagon Fighting Championship', () => {
  it('migrates stored text but keeps ids, titles and contracts', () => {
    const st = createCareer({ ...baseOpts, seed: 999 }, 1) as any;
    st.version = 4;
    st.world.news.unshift({ id: 'n1', day: 1, kind: 'title', title: 'APEX: new Lightweight champion', body: 'The Apex Combat League crowns a new king.', refs: [], org: 'acl', imp: 2 });
    st.timeline.push({ day: 2, kind: 'achievement', text: 'Achievement unlocked: Apex Predator — Become Apex Combat League champion.' });
    st.player.titles.push({ orgId: 'acl', divisionId: 'light', day: 3 });
    const m = migrate(JSON.parse(JSON.stringify(st)));
    expect(m.version).toBe(10);
    expect(m.world.news[0].title).toBe('HFC: new Lightweight champion');
    expect(m.world.news[0].body).toContain('Hexagon Fighting Championship');
    expect(m.timeline[m.timeline.length - 1].text).toContain('King of the Hexagon');
    expect(m.player.titles.some((t) => t.orgId === 'acl')).toBe(true);
    expect(JSON.stringify(m)).not.toMatch(/APEX|Apex Combat/);
    expect(validate(m)).toBeNull();
  });
});
