import { it, expect } from 'vitest';
import { advanceDay, createCareer } from '../src/game/career';
import { overallRating } from '../src/game/attributes';
import { activeEvents, resolveEvent } from '../src/game/events';
import { withdrawFromFight } from '../src/game/fights';

it('training progression over years is meaningful but not instant', () => {
  const st = createCareer({ firstName: 'P', lastName: 'Q', nickname: '', nationality: 'x', age: 20, heightCm: 180, reachCm: 183, hand: 'right', stance: 'orthodox',
    bodyType: 'lean', background: 'mma', startLevel: 'amateur', difficulty: 'normal', goals: [], divisionId: 'light', naturalKg: 72,
    appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 3 }, 1);
  st.player.money = 1e7; // isolate training from finances
  const out: number[] = [overallRating(st.player.attrs)];
  for (let d = 1; d <= 365 * 4; d++) {
    for (const e of activeEvents(st)) resolveEvent(st, e.id, 0);
    if (st.scheduled) withdrawFromFight(st);
    st.offers = [];
    advanceDay(st);
    if (d % 365 === 0) out.push(overallRating(st.player.attrs));
  }
  console.log('OVR by year', out, 'injuries now', st.player.injuries.length);
  expect(out[1] - out[0]).toBeGreaterThan(5);
  expect(out[4]).toBeLessThan(85);
}, 60000);
