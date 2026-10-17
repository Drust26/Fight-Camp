import { it, expect } from 'vitest';
import { simFight, setup } from './simHelpers';
it('10-8 rounds are uncommon', () => {
  let rounds = 0, tenEight = 0;
  for (let i = 0; i < 40; i++) {
    const s = simFight(setup('A', 60, 'balanced', i), setup('B', 54, 'balanced', 100 + i), 40 + i);
    for (const rc of s.roundCards) for (const c of rc.cards) { rounds++; if (Math.min(c[0], c[1]) <= 8) tenEight++; }
  }
  console.log('10-8 share', (tenEight / rounds).toFixed(3));
  expect(tenEight / rounds).toBeLessThan(0.12);
}, 60000);
