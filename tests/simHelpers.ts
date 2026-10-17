import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step, type FighterSetup, type FightState } from '../src/combat/engine';
import { genAttrs } from '../src/game/fighterGen';
import { RNG } from '../src/game/rng';
import type { Difficulty, StyleId } from '../src/game/types';
import { STYLE } from '../src/data/world';

export function setup(name: string, level: number, style: StyleId, seed: number, isPlayer = false): FighterSetup {
  const rng = new RNG(seed);
  return {
    name, short: name, attrs: genAttrs(rng, level, style), heightCm: 180, reachCm: 182, stance: 'orthodox', style, plan: STYLE[style].plan,
    appearance: { skin: 0, hair: 0, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, isPlayer,
  };
}

/** Run a full AI-vs-AI fight with the real engine. */
export function simFight(a: FighterSetup, b: FighterSetup, seed: number, opts: { rounds?: number; roundSeconds?: number; diff?: Difficulty } = {}): FightState {
  const s = createFight({ rounds: opts.rounds ?? 3, roundSeconds: opts.roundSeconds ?? 90, seed, title: false }, a, b);
  const ai0 = new AIController(0, a.style, opts.diff ?? 'normal', seed + 1);
  const ai1 = new AIController(1, b.style, opts.diff ?? 'normal', seed + 2);
  const dt = 1 / 60;
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 60 * 60 * 40) {
    if (s.phase === 'roundOver') startNextRound(s);
    step(s, [ai0.think(s, dt), ai1.think(s, dt)], dt);
  }
  return s;
}
