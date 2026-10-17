import { describe, expect, it } from 'vitest';
import { AIController, restoreAI, serializeAI } from '../src/combat/ai';
import { createFight, startNextRound, step, type FightState } from '../src/combat/engine';
import { DT, FightRecorder, replayStart, replayStep, replayTo, roundSummaries } from '../src/game/fightrec';
import { setup } from './simHelpers';

function liveFight(seed: number) {
  const s = createFight({ rounds: 3, roundSeconds: 60, seed, title: false }, setup('P', 60, 'balanced', seed + 3, true), setup('O', 60, 'wrestler', seed + 4));
  const pAI = new AIController(0, 'pressure', 'normal', seed + 5); // stands in for the human
  const ai = new AIController(1, 'wrestler', 'normal', seed + 6);
  return { s, pAI, ai };
}

/** Simulates the UI loop exactly: record intent → step → record events; keyframe at each round start. */
function play(seed: number, stopAt?: number) {
  const { s, pAI, ai } = liveFight(seed);
  const rec = new FightRecorder();
  rec.keyframe(s, ai);
  const ticksWithEvents: Record<number, string> = {};
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 60 * 60 * 20) {
    if (stopAt !== undefined && (s.tick ?? 0) >= stopAt) break;
    if (s.phase === 'roundOver') { ai.betweenRounds(s, false); startNextRound(s); rec.keyframe(s, ai); }
    const pi = s.phase === 'live' ? pAI.think(s, DT) : { fwd: 0, lat: 0, guard: 'none' as const, power: false, press: null };
    if (s.phase !== 'live') pAI.think(s, DT);
    rec.intent(s, pi);
    step(s, [pi, ai.think(s, DT)], DT);
    const evs = s.events.splice(0);
    if (evs.length) { rec.events(evs, s); ticksWithEvents[s.tick!] = evs.map((e) => e.type).join(','); }
    rec.sample(s);
  }
  return { s, ai, pAI, rec, ticksWithEvents };
}

describe('replay & checkpoints', () => {
  it('replay from keyframes reproduces the fight exactly', () => {
    for (const seed of [11, 202, 3030]) {
      const { s, rec, ticksWithEvents } = play(seed);
      const data = rec.replay(s);
      expect(data.keyframes.length).toBeGreaterThanOrEqual(1);
      // replay each round from its keyframe and check events land on identical ticks
      const r = replayStart(data, 0);
      const seen: Record<number, string> = {};
      let n = 0;
      for (;;) {
        if (!replayStep(r)) {
          if (r.fight.phase === 'roundOver') {
            // jump to next keyframe (the UI applies between-round logic there)
            const next = data.keyframes.find((k) => k.tick >= (r.fight.tick ?? 0) && k.round === r.fight.round + 1);
            if (!next) break;
            Object.assign(r, replayStart(data, next.tick));
            continue;
          }
          break;
        }
        const evs = r.fight.events;
        if (evs.length) seen[r.fight.tick!] = evs.map((e) => e.type).join(',');
        if (n++ > 60 * 60 * 20) break;
      }
      expect(seen).toEqual(ticksWithEvents);
      expect(r.fight.outcome).toEqual(s.outcome);
      expect(r.fight.tick).toBe(s.tick);
      expect(JSON.stringify(r.fight.f.map((f) => f.rounds))).toBe(JSON.stringify(s.f.map((f) => f.rounds)));
    }
  });

  it('a highlight can be re-simulated to its tick', () => {
    const { s, rec } = play(4242);
    const data = rec.replay(s);
    const m = data.moments[Math.floor(data.moments.length / 2)];
    expect(m).toBeTruthy();
    const r = replayStart(data, m.tick);
    replayTo(r, m.tick - 1);
    replayStep(r);
    expect(r.fight.tick).toBe(m.tick);
    expect(r.fight.events.map((e) => e.type)).toContain(m.kind);
  });

  it('mid-fight checkpoint resumes to an identical result', () => {
    const seed = 777;
    const full = play(seed);
    // stop mid-round, serialize, restore, continue
    const stop = Math.floor((full.s.tick ?? 0) * 0.45);
    const part = play(seed, stop);
    const fight = JSON.parse(JSON.stringify({ ...part.s, events: [] })) as FightState;
    const ai = restoreAI(JSON.parse(JSON.stringify(serializeAI(part.ai))));
    const pAI = restoreAI(serializeAI(part.pAI));
    let guard = 0;
    while (fight.phase !== 'over' && guard++ < 60 * 60 * 20) {
      if (fight.phase === 'roundOver') { ai.betweenRounds(fight, false); startNextRound(fight); }
      const pi = fight.phase === 'live' ? pAI.think(fight, DT) : { fwd: 0, lat: 0, guard: 'none' as const, power: false, press: null };
      if (fight.phase !== 'live') pAI.think(fight, DT);
      step(fight, [pi, ai.think(fight, DT)], DT);
      fight.events.length = 0;
    }
    expect(fight.outcome).toEqual(full.s.outcome);
    expect(fight.tick).toBe(full.s.tick);
  });

  it('recorder produces timeline, trends and round summaries; replay data stays small', () => {
    const { s, rec } = play(99);
    expect(rec.trends.length).toBeGreaterThan(3);
    expect(roundSummaries(s).length).toBe(s.outcome!.round);
    const size = JSON.stringify(rec.replay(s)).length;
    expect(size).toBeLessThan(400_000);
  });
});
