import { it, expect } from 'vitest';
import { advanceDay, createCareer } from '../src/game/career';
import { activeEvents, resolveEvent } from '../src/game/events';
import { decodeSave, encodeSave, validate } from '../src/game/save';
it('compressed saves are small, fast and round-trip exactly', () => {
  const st = createCareer({ firstName: 'A', lastName: 'B', nickname: '', nationality: 'x', age: 21, heightCm: 180, reachCm: 183, hand: 'right', stance: 'orthodox', bodyType: 'lean', background: 'mma', startLevel: 'amateur', difficulty: 'normal', goals: [], divisionId: 'light', naturalKg: 74, appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 5 }, 1);
  for (let d = 0; d < 365; d++) { for (const e of activeEvents(st)) resolveEvent(st, e.id, 0); advanceDay(st); }
  const json = JSON.stringify(st);
  const t0 = performance.now(); const enc = encodeSave(json); const t1 = performance.now();
  const back = decodeSave(enc); const t2 = performance.now();
  console.log(`raw ${Math.round(json.length / 1024)}K chars → ${Math.round(enc.length / 1024)}K chars; encode ${Math.round(t1 - t0)}ms decode ${Math.round(t2 - t1)}ms`);
  expect(back).toBe(json);
  expect(validate(JSON.parse(back))).toBeNull();
  expect(enc.length).toBeLessThan(json.length / 4);
  expect(decodeSave(json)).toBe(json); // old uncompressed saves still readable
});
