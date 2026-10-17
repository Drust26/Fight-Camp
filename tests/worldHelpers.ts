// Shared helpers for world-simulation tests.
import { advanceDay, type NewCareerOpts } from '../src/game/career';
import { activeEvents, resolveEvent } from '../src/game/events';
import type { GameState } from '../src/game/types';

export const baseOpts: NewCareerOpts = {
  firstName: 'H', lastName: 'Ist', nickname: '', nationality: 'Brazil', age: 22, heightCm: 180, reachCm: 183, hand: 'right', stance: 'orthodox',
  bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: [], divisionId: 'light', naturalKg: 74,
  appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 4242,
};
export function runDays(st: GameState, n: number) {
  for (let d = 0; d < n; d++) { for (const e of activeEvents(st)) resolveEvent(st, e.id, 0); if (st.scheduled && st.scheduled.day <= st.day) { st.world.fighters[st.scheduled.opponentId].bookedUntil = st.day; st.scheduled = null; } st.offers = []; advanceDay(st); }
}

