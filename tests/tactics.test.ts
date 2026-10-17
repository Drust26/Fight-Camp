import { it, expect } from 'vitest';
import { createFight, startNextRound, step, dist, effRange, NO_INTENT, sumStats, type FightState, type Intent } from '../src/combat/engine';
import { AIController } from '../src/combat/ai';
import { MOVES } from '../src/combat/moves';
import { setup } from './simHelpers';
import { RNG } from '../src/game/rng';

type Ctl = (s: FightState, rng: RNG) => Intent;
const masher: Ctl = (s, rng) => ({ ...NO_INTENT, fwd: 1, press: rng.chance(0.25) ? rng.pick(['jab', 'cross', 'hook', 'headkick', 'bodykick'] as const) : null, power: rng.chance(0.5) });
const tactical: Ctl = (s, rng) => {
  const me = s.f[0], o = s.f[1];
  const d = dist(s);
  const it: Intent = { ...NO_INTENT };
  if (s.sub) { it.press = Math.abs(s.sub.marker - 0.5) < 0.07 ? (s.sub.attacker === 0 ? 'sub' : 'evade') : null; return it; }
  if (s.pos !== 'standing') {
    if (s.top === 0 && s.pos !== 'clinch') it.press = rng.chance(0.06) ? 'jab' : rng.chance(0.02) ? 'advance' : null;
    else if (s.pos === 'clinch') it.press = rng.chance(0.06) ? rng.pick(['knee', 'clinch'] as const) : null;
    else if (o.state === 'attack' || o.state === 'grapple') it.guard = 'high';
    else it.press = rng.chance(0.06) ? (s.pos === 'guard' ? 'advance' : rng.pick(['clinch', 'advance'] as const)) : null;
    return it;
  }
  if (o.state === 'shoot') { it.press = 'takedown'; return it; }
  if (o.state === 'down') { return it; }
  // read tells: defend what's coming
  if (o.state === 'attack' && o.phase === 'startup' && o.move) {
    const t = MOVES[o.move].target;
    it.guard = t === 'head' ? 'high' : 'low';
    return it;
  }
  const jabR = effRange(me, MOVES.jab)[1];
  it.fwd = d > jabR - 22 ? 1 : d < 70 ? -1 : 0;
  it.lat = Math.sin(s.t * 0.7) > 0 ? 0.6 : -0.6;
  if (me.stamina < 42 && !(o.state === 'stun')) { it.fwd = d < 140 ? -1 : 0; return it; }
  const opening = o.state === 'whiff' || o.state === 'stun' || (o.state === 'attack' && o.phase === 'recovery');
  if (me.state === 'free' && d <= jabR && (opening || rng.chance(0.09))) it.press = rng.pick(opening ? (['cross', 'hook', 'body'] as const) : (['jab', 'jab', 'cross', 'lowkick', 'body'] as const));
  else if (me.state === 'free' && d > jabR && d < 125 && rng.chance(0.04)) it.press = rng.pick(['lowkick', 'teep'] as const);
  if (o.stamina < 25 && me.stamina > 40 && it.press) it.power = true;
  return it;
};

function play(ctl: Ctl, n: number) {
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const s = createFight({ rounds: 3, roundSeconds: 60, seed: 500 + i, title: false }, setup('P', 60, 'balanced', 10 + i, true), setup('O', 60, (['pressure', 'wrestler', 'counter', 'kickboxer'] as const)[i % 4], 900 + i));
    const ai = new AIController(1, s.f[1].setup.style, 'normal', 33 + i);
    const rng = new RNG(i + 1);
    let g = 0;
    while (s.phase !== 'over' && g++ < 300000) { if (s.phase === 'roundOver') startNextRound(s); step(s, [ctl(s, rng), ai.think(s, 1 / 60)], 1 / 60); }
    if (s.outcome!.winner === 0) wins++;
    if ((globalThis as any).process?.env?.DIAG) { const a = sumStats(s.f[0]), b = sumStats(s.f[1]); console.log(s.f[1].setup.style.padEnd(10), s.outcome!.winner, s.outcome!.method.padEnd(4), 'R' + s.outcome!.round, 'sig', a.sigLanded + '/' + a.sigThrown, b.sigLanded + '/' + b.sigThrown, 'td', a.tdLanded, b.tdLanded, 'ctrl', Math.round(a.controlSec), Math.round(b.controlSec), 'dmg', Math.round(a.damageDealt), Math.round(b.damageDealt), 'blk', a.blocked, 'ev', a.evaded, 'stam', Math.round(s.f[0].stamina), Math.round(s.f[1].stamina), 'head', Math.round(s.f[0].head), Math.round(s.f[1].head)); }
  }
  return wins / n;
}

it('player decisions matter: tactical play beats button mashing', () => {
  const m = play(masher, 32), t = play(tactical, 32);
  console.log('win rate — masher', m.toFixed(2), 'tactical', t.toFixed(2));
  expect(t).toBeGreaterThan(m + 0.1);
}, 120000);
