import { describe, it, expect } from 'vitest';
import { simFight, setup } from './simHelpers';
import { sumStats } from '../src/combat/engine';
import type { StyleId } from '../src/game/types';

const STYLES: StyleId[] = ['pressure', 'counter', 'kickboxer', 'wrestler', 'submission', 'clinch', 'balanced', 'power', 'point', 'gnp'];

describe('combat balance (AI vs AI, real engine)', () => {
  it('produces a plausible mix of outcomes and no dominant style', () => {
    const methods: Record<string, number> = {};
    const styleWins: Record<string, [number, number]> = {};
    let n = 0;
    let strikes = 0, tds = 0, subs = 0;
    let seed = 1000;
    for (const a of STYLES) for (const b of STYLES) {
      if (a === b) continue;
      for (let k = 0; k < 3; k++) {
        seed += 7;
        const s = simFight(setup('A', 60, a, seed), setup('B', 60, b, seed + 3), seed);
        const o = s.outcome!;
        methods[o.method] = (methods[o.method] ?? 0) + 1;
        styleWins[a] ??= [0, 0]; styleWins[b] ??= [0, 0];
        styleWins[a][1]++; styleWins[b][1]++;
        if (o.winner === 0) styleWins[a][0]++; else if (o.winner === 1) styleWins[b][0]++;
        const t0 = sumStats(s.f[0]), t1 = sumStats(s.f[1]);
        strikes += t0.sigLanded + t1.sigLanded; tds += t0.tdLanded + t1.tdLanded; subs += t0.subAttempts + t1.subAttempts;
        n++;
      }
    }
    const pct = (x: number) => Math.round((x / n) * 100) + '%';
    console.log('fights', n, 'methods', Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, pct(v)])));
    console.log('per fight: sig strikes', (strikes / n).toFixed(1), 'tds', (tds / n).toFixed(2), 'sub attempts', (subs / n).toFixed(2));
    console.log('style win%', Object.fromEntries(Object.entries(styleWins).map(([k, [w, t]]) => [k, Math.round((w / t) * 100)])));
    const finishes = (methods.KO ?? 0) + (methods.TKO ?? 0) + (methods.SUB ?? 0);
    expect(finishes / n).toBeGreaterThan(0.15);
    expect(finishes / n).toBeLessThan(0.8);
    for (const [, [w, t]] of Object.entries(styleWins)) expect(w / t).toBeLessThan(0.82);
  }, 120000);

  it('higher-rated fighters usually but not always win', () => {
    let wins = 0, n = 40;
    for (let i = 0; i < n; i++) {
      const s = simFight(setup('Good', 72, 'balanced', 50 + i), setup('Avg', 55, 'balanced', 900 + i), 300 + i);
      if (s.outcome!.winner === 0) wins++;
    }
    console.log('72 vs 55 win rate', wins / n);
    expect(wins / n).toBeGreaterThan(0.65);
    expect(wins / n).toBeLessThan(1.0001);
  }, 120000);
});
