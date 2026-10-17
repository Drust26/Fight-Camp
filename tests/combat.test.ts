import { describe, it, expect } from 'vitest';
import { createFight, step, NO_INTENT, startNextRound, dist, type Intent, type FightState } from '../src/combat/engine';
import { setup, simFight } from './simHelpers';
import { validate } from '../src/game/save';

const press = (b: Intent['press'], extra: Partial<Intent> = {}): Intent => ({ ...NO_INTENT, press: b, ...extra });
function run(s: FightState, secs: number, a: (s: FightState) => Intent = () => NO_INTENT, b: (s: FightState) => Intent = () => NO_INTENT) {
  for (let i = 0; i < secs * 60; i++) step(s, [a(s), b(s)], 1 / 60);
}
function fresh(seed = 1) {
  const s = createFight({ rounds: 3, roundSeconds: 30, seed, title: false }, setup('A', 60, 'balanced', 1), setup('B', 60, 'balanced', 2));
  run(s, 1.7); // intro
  return s;
}

describe('combat rules', () => {
  it('both fighters can move', () => {
    const s = fresh();
    const d0 = dist(s);
    run(s, 0.5, () => ({ ...NO_INTENT, fwd: 1 }), () => ({ ...NO_INTENT, fwd: 1 }));
    expect(dist(s)).toBeLessThan(d0 - 50);
    const z0 = s.f[0].z;
    run(s, 0.5, () => ({ ...NO_INTENT, lat: 1 }));
    expect(Math.abs(s.f[0].z - z0) + Math.abs(s.f[0].x)).toBeGreaterThan(0);
  });

  it('strikes out of range always miss and cost stamina', () => {
    const s = fresh();
    expect(dist(s)).toBeGreaterThan(200);
    const st0 = s.f[0].stamina;
    for (let k = 0; k < 6; k++) { step(s, [press('cross'), NO_INTENT], 1 / 60); run(s, 0.7); }
    expect(s.f[1].head).toBe(0);
    expect(s.f[0].stamina).toBeLessThan(st0);
    expect(s.f[0].whiffs).toBeGreaterThanOrEqual(5);
  });

  it('in range strikes can land; high guard reduces head damage', () => {
    const land = (guard: boolean) => {
      let total = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const s = fresh(seed);
        s.f[0].x = -45; s.f[1].x = 45; // 90cm apart: punching range
        for (let k = 0; k < 8; k++) { step(s, [press('cross'), guard ? { ...NO_INTENT, guard: 'high' } : NO_INTENT], 1 / 60); run(s, 0.7, () => NO_INTENT, () => (guard ? { ...NO_INTENT, guard: 'high' } : NO_INTENT)); s.f[0].stamina = 100; }
        total += s.f[1].head;
      }
      return total;
    };
    const open = land(false), guarded = land(true);
    expect(open).toBeGreaterThan(0);
    expect(guarded).toBeLessThan(open * 0.6);
    expect(guarded).toBeGreaterThan(0); // guard is not invulnerable
  });

  it('fatigue lowers performance (stamina affects multipliers)', () => {
    const s = fresh();
    s.f[0].stamina = 5;
    const slow = s.f[0];
    step(s, [press('jab'), NO_INTENT], 1 / 60);
    const s2 = fresh();
    step(s2, [press('jab'), NO_INTENT], 1 / 60);
    expect(slow.ms).toBeGreaterThan(s2.f[0].ms);
  });

  it('rounds end on time and the clock advances', () => {
    const s = fresh();
    run(s, 29.9);
    expect(s.phase).toBe('live');
    run(s, 0.2);
    expect(s.phase).toBe('roundOver');
    expect(s.roundCards.length).toBe(1);
    startNextRound(s);
    expect(s.round).toBe(2);
    run(s, 1.7 + 30.1);
    startNextRound(s);
    run(s, 1.7 + 30.1);
    expect(s.phase).toBe('over');
    expect(['UD', 'SD', 'MD', 'DRAW']).toContain(s.outcome!.method);
  });

  it('a finished fight cannot keep dealing damage', () => {
    const s = fresh();
    s.f[1].head = 99.5;
    s.f[0].x = -45; s.f[1].x = 45;
    for (let k = 0; k < 40 && s.phase !== 'over'; k++) { step(s, [press('cross'), NO_INTENT], 1 / 60); run(s, 0.6); s.f[0].stamina = 100; s.f[0].x = -45; s.f[1].x = 45; }
    expect(s.phase).toBe('over');
    const head = s.f[1].head, t = s.t;
    run(s, 2, () => press('cross'));
    expect(s.f[1].head).toBe(head);
    expect(s.t).toBe(t);
  });

  it('every win method is reachable for either corner', () => {
    const seen = { 0: new Set<string>(), 1: new Set<string>() } as Record<number, Set<string>>;
    for (let i = 0; i < 70; i++) {
      const s = simFight(setup('A', 62, (['power', 'submission', 'wrestler', 'kickboxer', 'gnp'] as const)[i % 5], i), setup('B', 62, (['submission', 'power', 'gnp', 'counter', 'wrestler'] as const)[i % 5], 500 + i), 77 + i);
      if (s.outcome!.winner >= 0) seen[s.outcome!.winner].add(['UD', 'SD', 'MD'].includes(s.outcome!.method) ? 'DEC' : s.outcome!.method === 'TKO' ? 'KO' : s.outcome!.method);
    }
    for (const w of [0, 1]) for (const m of ['KO', 'SUB', 'DEC']) expect(seen[w].has(m)).toBe(true);
  }, 60000);

  it('save validation rejects corrupt data', () => {
    expect(validate(null)).not.toBeNull();
    expect(validate({ version: 3, player: { attrs: {}, record: { w: 0 }, money: 0 } })).not.toBeNull();
  });
});
