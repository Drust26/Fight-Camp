// Opponent AI. Decisions use only observable fight state (positions, visible attack startups,
// damage/stamina readouts, round time) plus the AI fighter's own attributes and style.
// It never sees the player's future inputs.
import { clamp, RNG } from '../game/rng';
import type { Difficulty, StyleId } from '../game/types';
import {
  atCage, cageProximity, dist, effRange, fm, groundSubFor, isGround, subZoneWidth, type Button, type CF, type FightState, type Intent,
} from './engine';
import { MOVES, STANDING_MOVES, type MoveId } from './moves';

interface StyleAI {
  range: number;
  weights: Partial<Record<MoveId, number>>;
  rate: number; // strikes per second baseline
  td: number;
  clinch: number;
  sub: number;
  guard: number;
  evade: number;
  counter: number;
  power: number;
  advance: number; // top-game positional ambition
  cardioDiscipline: number;
}

const S: Record<StyleId, StyleAI> = {
  pressure: { range: 84, rate: 1.3, td: 0.06, clinch: 0.12, sub: 0.1, guard: 0.45, evade: 0.25, counter: 0.3, power: 0.18, advance: 0.3, cardioDiscipline: 0.5,
    weights: { jab: 3, cross: 3, hook: 3, upper: 2, body: 2.5, lowkick: 0.8, bodykick: 0.4, headkick: 0.15, teep: 0.2, knee: 0.5, elbow: 0.6 } },
  counter: { range: 112, rate: 0.75, td: 0.05, clinch: 0.05, sub: 0.15, guard: 0.35, evade: 0.6, counter: 0.85, power: 0.12, advance: 0.3, cardioDiscipline: 0.8,
    weights: { jab: 4, cross: 3, hook: 1.5, upper: 0.8, body: 1, lowkick: 1.5, bodykick: 1, headkick: 0.6, teep: 1.2 } },
  kickboxer: { range: 116, rate: 1.0, td: 0.04, clinch: 0.05, sub: 0.1, guard: 0.4, evade: 0.35, counter: 0.45, power: 0.12, advance: 0.25, cardioDiscipline: 0.7,
    weights: { jab: 3, cross: 2.5, hook: 1, upper: 0.4, body: 0.8, lowkick: 3.5, bodykick: 2.5, headkick: 1.2, teep: 2, knee: 0.6 } },
  wrestler: { range: 98, rate: 0.75, td: 0.6, clinch: 0.3, sub: 0.2, guard: 0.5, evade: 0.2, counter: 0.2, power: 0.1, advance: 0.55, cardioDiscipline: 0.7,
    weights: { jab: 3, cross: 2, hook: 1.5, upper: 0.5, body: 1, lowkick: 0.6, teep: 0.4, knee: 0.4 } },
  submission: { range: 104, rate: 0.7, td: 0.38, clinch: 0.3, sub: 0.85, guard: 0.45, evade: 0.25, counter: 0.25, power: 0.08, advance: 0.6, cardioDiscipline: 0.7,
    weights: { jab: 2.5, cross: 1.5, hook: 0.8, teep: 1, lowkick: 1, body: 0.6 } },
  clinch: { range: 80, rate: 1.0, td: 0.18, clinch: 0.65, sub: 0.15, guard: 0.5, evade: 0.2, counter: 0.3, power: 0.15, advance: 0.35, cardioDiscipline: 0.6,
    weights: { jab: 2, cross: 2, hook: 2, upper: 1.2, knee: 2.5, elbow: 2, body: 1 } },
  balanced: { range: 100, rate: 0.95, td: 0.25, clinch: 0.18, sub: 0.35, guard: 0.45, evade: 0.35, counter: 0.45, power: 0.14, advance: 0.45, cardioDiscipline: 0.7,
    weights: { jab: 3, cross: 2.5, hook: 1.8, upper: 1, body: 1.5, lowkick: 1.8, bodykick: 1, headkick: 0.4, teep: 0.8, knee: 0.6, elbow: 0.4 } },
  power: { range: 90, rate: 0.85, td: 0.08, clinch: 0.1, sub: 0.05, guard: 0.4, evade: 0.2, counter: 0.4, power: 0.45, advance: 0.25, cardioDiscipline: 0.3,
    weights: { jab: 1.5, cross: 3, hook: 3.5, upper: 2, body: 1, headkick: 0.5, lowkick: 0.6 } },
  point: { range: 112, rate: 1.15, td: 0.08, clinch: 0.05, sub: 0.1, guard: 0.55, evade: 0.55, counter: 0.6, power: 0.05, advance: 0.2, cardioDiscipline: 0.9,
    weights: { jab: 4, cross: 2.5, teep: 1.5, lowkick: 2, body: 1, bodykick: 0.8 } },
  gnp: { range: 95, rate: 0.85, td: 0.5, clinch: 0.22, sub: 0.08, guard: 0.45, evade: 0.2, counter: 0.25, power: 0.3, advance: 0.5, cardioDiscipline: 0.5,
    weights: { jab: 2, cross: 2.5, hook: 2, upper: 0.8, body: 1 } },
};

const DIFF: Record<Difficulty, { react: number; reactChance: number; interval: number; mistake: number; aggr: number; subTiming: number }> = {
  easy: { react: 0.45, reactChance: 0.26, interval: 0.48, mistake: 0.3, aggr: 0.78, subTiming: 0.3 },
  normal: { react: 0.32, reactChance: 0.45, interval: 0.34, mistake: 0.15, aggr: 0.95, subTiming: 0.46 },
  hard: { react: 0.22, reactChance: 0.68, interval: 0.24, mistake: 0.05, aggr: 1.08, subTiming: 0.64 },
  simulation: { react: 0.2, reactChance: 0.72, interval: 0.22, mistake: 0.04, aggr: 1.0, subTiming: 0.7 },
};

export interface Adapt { head: number; body: number; legs: number; td: number; clinch: number; aggr: number }

export class AIController {
  idx: number;
  st: StyleAI;
  d: (typeof DIFF)['normal'];
  rng: RNG;
  passive: boolean;
  decisionT = 0;
  fwd = 0;
  lat = 0;
  latT = 0;
  guard: 'none' | 'high' | 'low' = 'none';
  guardT = 0;
  power = false;
  combo: MoveId[] = [];
  seenAttackT = -1;
  reaction: { at: number; kind: 'attack' | 'shoot' | 'attempt' | 'punish' } | null = null;
  adapt: Adapt;
  roundAggression = 1;
  subPassArmed = true;
  lastTdFail = 0;

  styleId: StyleId;
  difficulty: Difficulty;

  constructor(idx: number, style: StyleId, difficulty: Difficulty, seed: number, memory?: Partial<Adapt>, passive = false) {
    this.idx = idx;
    this.styleId = style;
    this.difficulty = difficulty;
    this.st = S[style];
    this.d = DIFF[difficulty];
    this.rng = new RNG(seed);
    this.passive = passive;
    this.adapt = { head: 0, body: 0, legs: 0, td: 0, clinch: 0, aggr: 0, ...(memory ?? {}) };
    this.lat = this.rng.chance(0.5) ? 1 : -1;
  }

  /** Called by the UI between rounds: adjust when losing. */
  betweenRounds(s: FightState, behind: boolean) {
    const me = s.f[this.idx];
    this.roundAggression = behind ? 1.25 + me.a.adaptability / 400 : 1;
    if (behind && s.round >= s.cfg.rounds - 1) this.roundAggression += 0.15;
  }

  private learn(k: keyof Adapt, amt = 1) {
    const me = (this as any)._me as CF;
    const rate = (0.03 + (me?.a.adaptability ?? 50) / 1500) * amt;
    this.adapt[k] = clamp(this.adapt[k] + (1 - this.adapt[k]) * rate, 0, 0.9);
  }

  think(s: FightState, dt: number): Intent {
    const me = s.f[this.idx];
    const o = s.f[1 - this.idx];
    (this as any)._me = me;
    const it: Intent = { fwd: this.fwd, lat: 0, guard: this.guard, power: this.power, press: null };
    if (s.phase !== 'live') return { fwd: 0, lat: 0, guard: 'none', power: false, press: null };
    if (this.passive) return this.passiveThink(s, me, o);
    // decay adaptation slowly
    for (const k of Object.keys(this.adapt) as (keyof Adapt)[]) this.adapt[k] *= 1 - 0.004 * dt;
    const iq = me.a.fightIQ;
    const reactTime = this.d.react * (1.3 - iq / 170) * (0.8 + this.rng.next() * 0.4) / (0.75 + 0.25 * fm(me));
    const reactChance = clamp(this.d.reactChance + (iq - 50) / 250, 0.1, 0.92);

    // ── observe opponent: new attacks, shots, attempts
    if (o.state === 'attack' && o.phase === 'startup' && o.stateT < 0.05 && this.seenAttackT !== Math.round(s.t * 1000 - o.stateT * 1000)) {
      this.seenAttackT = Math.round(s.t * 1000 - o.stateT * 1000);
      const m = MOVES[o.move!];
      this.learn(m.target as keyof Adapt, 0.6);
      this.learn('aggr', 0.4);
      const bonus = (this.adapt[m.target as keyof Adapt] ?? 0) * 0.3;
      if (this.rng.chance(reactChance + bonus)) this.reaction = { at: s.t + reactTime, kind: 'attack' };
    }
    // punish whiffs and long recoveries (observable)
    if (!this.reaction && s.pos === 'standing' && ((o.state === 'attack' && o.phase === 'recovery' && o.stateT - o.ms - o.ma < 0.03) || (o.state === 'whiff' && o.stateT < 0.03))) {
      if (this.rng.chance(reactChance * (0.3 + this.st.counter * 0.5) + this.adapt.aggr * 0.12)) this.reaction = { at: s.t + reactTime, kind: 'punish' };
    }
    if (o.state === 'shoot' && o.stateT < 0.05 && !this.reaction) {
      this.learn('td', 1.5);
      if (this.rng.chance(reactChance * (0.6 + me.a.tdDefense / 160) + this.adapt.td * 0.35)) this.reaction = { at: s.t + reactTime * 0.9, kind: 'shoot' };
    }
    if (o.state === 'grapple' && o.attempt && o.attempt.t < 0.05 && !this.reaction) {
      if (this.rng.chance(reactChance)) this.reaction = { at: s.t + reactTime, kind: 'attempt' };
    }

    // ── submission struggle: time presses in the zone
    if (s.sub) {
      const isA = s.sub.attacker === this.idx;
      const inZone = Math.abs(s.sub.marker - 0.5) < subZoneWidth(me, isA) / 2;
      if (inZone && this.subPassArmed) {
        this.subPassArmed = false;
        const skill = (isA ? me.a.subOffense : me.a.subDefense) / 100;
        if (this.rng.chance(this.d.subTiming * (0.6 + skill * 0.6))) it.press = isA ? 'sub' : 'evade';
      } else if (!inZone) {
        this.subPassArmed = true;
        if (this.rng.chance(0.02)) it.press = isA ? 'sub' : 'evade'; // panicked mistimed press
      }
      return it;
    }

    // ── fire scheduled reactions
    if (this.reaction && s.t >= this.reaction.at) {
      const r = this.reaction;
      this.reaction = null;
      const out = this.react(s, me, o, r.kind);
      if (out) return out;
    }

    if (s.pos === 'standing') return this.standing(s, me, o, it, dt);
    if (s.pos === 'clinch') return this.clinchThink(s, me, o, it, dt);
    return this.groundThink(s, me, o, it, dt);
  }

  private passiveThink(s: FightState, me: CF, o: CF): Intent {
    // practice partner: moves around, throws occasional light jabs, never grapples
    const d = dist(s);
    const it: Intent = { fwd: d > 120 ? 0.5 : d < 90 ? -0.4 : 0, lat: Math.sin(s.t * 0.6) > 0 ? 0.4 : -0.4, guard: 'high', power: false, press: null };
    if (s.pos !== 'standing') {
      if (this.rng.chance(0.004) && me.state === 'free') it.press = isGround(s.pos) ? 'advance' : 'clinch';
      it.guard = 'high';
      if (s.sub) it.press = null;
      return it;
    }
    if (me.state === 'free' && d < 115 && this.rng.chance(0.006)) { it.press = 'jab'; it.guard = 'none'; }
    return it;
  }

  private react(s: FightState, me: CF, o: CF, kind: 'attack' | 'shoot' | 'attempt' | 'punish'): Intent | null {
    const it: Intent = { fwd: this.fwd, lat: this.lat * 0.5, guard: 'none', power: false, press: null };
    if (kind === 'shoot') {
      if (o.state === 'shoot') { it.press = 'takedown'; return it; }
      return null;
    }
    if (kind === 'punish') {
      if (me.state !== 'free') return null;
      const d = dist(s);
      const opts = (['cross', 'hook', 'body', 'jab', 'lowkick'] as MoveId[]).filter((id) => this.st.weights[id] && d >= effRange(me, MOVES[id])[0] - 5 && d <= effRange(me, MOVES[id])[1]);
      if (!opts.length) return null;
      it.press = opts[0] as Button;
      it.power = o.stamina < 25 && me.stamina > 40;
      if (this.rng.chance(0.5)) this.combo = [opts[Math.min(1, opts.length - 1)]];
      return it;
    }
    if (kind === 'attempt') {
      if (o.state === 'grapple' && o.attempt) {
        it.guard = 'high';
        this.guard = 'high';
        this.guardT = 0.7;
        return it;
      }
      return null;
    }
    if (o.state !== 'attack' || o.phase !== 'startup' || !o.move) return null;
    if (s.pos !== 'standing') {
      it.guard = 'high';
      this.guard = 'high';
      this.guardT = 0.5;
      return it;
    }
    const m = MOVES[o.move];
    const d = dist(s);
    const roll = this.rng.next();
    const tCounter = this.st.counter * 0.5 + this.adapt.aggr * 0.25;
    const tEvade = this.st.evade * 0.5;
    if (m.target === 'legs') {
      if (roll < 0.35 + this.adapt.legs * 0.5) { this.guard = 'low'; this.guardT = 0.45; it.guard = 'low'; return it; }
    } else if (m.target === 'body') {
      if (roll < 0.4 + this.adapt.body * 0.4) { this.guard = 'low'; this.guardT = 0.45; it.guard = 'low'; return it; }
    } else {
      if (roll < tEvade && me.evadeCd <= 0 && me.state === 'free') { it.press = 'evade'; it.lat = this.lat; return it; }
      if (roll < tEvade + tCounter && me.state === 'free') {
        // intercept with the fastest in-range strike
        const opt = (['jab', 'cross', 'hook'] as MoveId[]).find((id) => { const [mn, mx] = effRange(me, MOVES[id]); return d >= mn && d <= mx; });
        if (opt) { it.press = opt as Button; return it; }
      }
      if (roll < 0.5 + this.st.guard * 0.5 + this.adapt.head * 0.3) { this.guard = 'high'; this.guardT = 0.45; it.guard = 'high'; return it; }
      if (d < 140) { it.fwd = -1; this.fwd = -1; return it; }
    }
    return null;
  }

  private standing(s: FightState, me: CF, o: CF, it: Intent, dt: number): Intent {
    const d = dist(s);
    this.guardT -= dt;
    if (this.guardT <= 0) this.guard = 'none';
    this.latT -= dt;
    if (this.latT <= 0) {
      this.latT = 1.2 + this.rng.next() * 2.2;
      this.lat = this.rng.chance(0.5) ? 1 : -1;
      if (this.rng.chance(0.3)) this.lat = 0;
    }
    // continue combos
    if (this.combo.length && (me.state === 'free' || (me.state === 'attack' && me.phase === 'recovery'))) {
      const nx = this.combo.shift()!;
      const isTd = (nx as string) === 'takedown';
      if (isTd ? d < 118 : d <= effRange(me, MOVES[nx])[1] + 8) {
        it.press = nx as Button;
        it.guard = 'none';
        return it;
      }
      this.combo = [];
    }
    // opportunism: downed opponent
    if (o.state === 'down') {
      const want = this.st.td + this.st.advance * 0.5 + me.a.aggression / 200 + o.head / 200;
      it.fwd = 1;
      if (d < 180 && me.state === 'free' && this.rng.chance(clamp(want, 0.15, 0.9) * dt * 6)) it.press = 'advance';
      return it;
    }
    this.decisionT -= dt;
    // movement towards preferred range
    const timeLeft = 1 - s.roundT / s.cfg.roundSeconds;
    let R = this.st.range;
    const oppStrikeEdge = (o.a.boxing + o.a.kickboxing + o.a.punchPower) / 3 - (me.a.boxing + me.a.kickboxing + me.a.punchPower) / 3;
    if (me.stamina < 30 && this.rng.chance(this.st.cardioDiscipline)) R += 22; // take a breather
    if (o.state === 'stun') R = 70;
    if (this.adapt.legs > 0.4 && this.st.range > 105) R -= 8; // closing to smother kicks
    const delta = d - R;
    this.fwd = Math.abs(delta) < 10 ? 0 : clamp(delta / 40, -1, 1);
    let lat = this.lat * 0.7;
    if (cageProximity(me) > -45 && this.st.range > 95) {
      // circle off the fence
      lat = this.lat || 1;
      this.fwd = Math.max(this.fwd, 0.2);
    }
    if (this.st.range < 95 && atCage(o)) lat = -o.velLat > 0 ? 0.6 : -0.6; // cut off escape
    it.fwd = this.fwd;
    it.lat = lat;
    const threatened = d < 125;
    const holdP = this.st.guard * (0.15 + this.adapt.aggr * 0.9) * (me.stamina > 15 ? 1 : 0.3);
    it.guard = this.guard !== 'none' ? this.guard : threatened && this.rng.chance(holdP * 0.12) ? 'high' : 'none';
    if (it.guard === 'high' && this.guard === 'none') { this.guard = 'high'; this.guardT = 0.35 + this.rng.next() * 0.4; }
    it.power = false;
    if (this.decisionT > 0 || me.state !== 'free') return it;
    this.decisionT = this.d.interval * (0.7 + this.rng.next() * 0.6);

    const staminaF = me.stamina < 25 ? 0.25 + this.st.cardioDiscipline * -0.1 + 0.25 : me.stamina < 45 ? 0.75 : 1;
    const urgency = this.roundAggression * (timeLeft < 0.2 ? 1.15 : 1);
    let rate = this.st.rate * (0.6 + me.a.aggression / 100) * this.d.aggr * staminaF * urgency;
    if (o.state === 'stun' || o.state === 'getup') rate *= 2.5;
    if (o.stamina < 22) rate *= 1.5; // tired opponent: go to work
    // counter openings
    const opening = o.state === 'whiff' || o.state === 'sprawled' || (o.state === 'attack' && o.phase === 'recovery');
    if (opening && this.rng.chance(this.st.counter * 0.8 + this.adapt.aggr * 0.2)) rate *= 3;

    // takedown decision
    const grapplingEdge = (me.a.tdOffense + me.a.wrestling) / 2 - (o.a.tdDefense + o.a.wrestling) / 2;
    let tdP = this.st.td * (oppStrikeEdge > 5 ? 1.5 : 1) * (o.stamina < 35 ? 1.3 : 1) * (this.roundAggression > 1 ? 1.25 : 1) * (grapplingEdge < -15 ? 0.5 : 1);
    if (s.t - this.lastTdFail < 6) tdP *= 0.5;
    if (o.state === 'attack' && o.phase !== 'recovery') tdP *= 2;
    if (d > 55 && d < 118 && me.stamina > 22 && this.rng.chance(tdP * this.d.interval * 0.9)) {
      it.press = 'takedown';
      it.guard = 'none';
      this.lastTdFail = s.t;
      return it;
    }
    if (d < 88 && this.rng.chance(this.st.clinch * this.d.interval * 0.9)) {
      it.press = 'clinch';
      return it;
    }
    if (!this.rng.chance(clamp(rate * this.d.interval, 0, 0.95))) return it;

    // choose a strike (mistakes: sometimes ignore range)
    const mistake = this.rng.chance(this.d.mistake);
    const options = STANDING_MOVES.filter((id) => {
      if (!this.st.weights[id]) return false;
      const [mn, mx] = effRange(me, MOVES[id]);
      return mistake || (d >= mn - 5 && d <= mx);
    });
    if (!options.length) {
      // not in range of anything: step in with a jab sometimes
      if (this.st.range < 100 || this.rng.chance(0.3)) it.fwd = 1;
      return it;
    }
    const pick = this.rng.weighted(options, (id) => {
      let w = this.st.weights[id] ?? 0;
      const m = MOVES[id];
      if (m.target === 'body' && o.guard === 'high') w *= 2;
      if (m.target === 'head' && o.head > 50) w *= 1.4;
      if (m.target === 'legs' && o.legs > 50) w *= 1.5;
      if (m.kind === 'kick' && this.adapt.legs > 0.5 && m.target === 'legs') w *= 0.7;
      if (me.stamina < 30 && MOVES[id].stamina > 6) w *= 0.4;
      return w;
    });
    it.press = pick as Button;
    it.guard = 'none';
    it.power = this.rng.chance(this.st.power * (o.state === 'stun' ? 2.5 : 1) * (me.stamina > 40 ? 1 : 0.3));
    // build a follow-up combination
    const comboChance = 0.25 + me.a.combos / 250;
    if (this.rng.chance(comboChance) && me.stamina > 30) {
      const followups: Record<string, MoveId[]> = {
        jab: ['cross', 'jab', 'lowkick', 'hook'], cross: ['hook', 'lowkick', 'body'], hook: ['cross', 'upper', 'body'],
        upper: ['hook', 'cross'], body: ['hook', 'upper'], lowkick: ['cross', 'jab'], teep: ['jab', 'cross'], knee: ['elbow', 'hook'],
      };
      const fu = (followups[pick] ?? []).filter((m) => this.st.weights[m]);
      if (fu.length) {
        this.combo = [this.rng.pick(fu)];
        if (this.rng.chance(0.3)) this.combo.push(this.rng.pick(fu));
      }
      if (this.st.td > 0.3 && this.rng.chance(0.25)) this.combo = ['takedown' as any];
    }
    return it;
  }

  private clinchThink(s: FightState, me: CF, o: CF, it: Intent, _dt: number): Intent {
    const ctrl = s.top === this.idx;
    it.fwd = ctrl ? 0.7 : this.st.clinch > 0.3 || this.st.td > 0.4 ? 0.6 : 0;
    it.lat = 0;
    it.guard = 'none';
    this.decisionT -= _dt;
    if (this.decisionT > 0 || me.state !== 'free') return it;
    this.decisionT = this.d.interval * (0.8 + this.rng.next() * 0.5);
    const wantsOut = this.st.clinch < 0.15 && this.st.td < 0.3;
    const r = this.rng.next();
    if (wantsOut && r < 0.45) { it.press = 'clinch'; return it; }
    if (this.st.td > 0.15 && r < 0.12 + this.st.td * 0.25) { it.press = 'takedown'; return it; }
    if (this.st.sub > 0.5 && r < 0.06) { it.press = 'sub'; return it; }
    if (r < 0.75 * this.d.aggr * (me.stamina > 25 ? 1 : 0.5)) {
      it.press = this.rng.weighted(['jab', 'knee', 'elbow'] as Button[], (b) => (b === 'knee' ? 1 + this.st.clinch * 2 : b === 'elbow' ? 0.6 + this.st.clinch : 1));
      return it;
    }
    if (!ctrl && r > 0.9) it.press = 'clinch';
    return it;
  }

  private groundThink(s: FightState, me: CF, o: CF, it: Intent, dt: number): Intent {
    const top = s.top === this.idx;
    it.fwd = 0; it.lat = 0; it.power = false;
    this.guardT -= dt;
    it.guard = this.guardT > 0 ? 'high' : 'none';
    this.decisionT -= dt;
    if (this.decisionT > 0 || me.state !== 'free') return it;
    this.decisionT = this.d.interval * (1.8 + this.rng.next() * 1.4);
    const r = this.rng.next();
    if (top) {
      const sub = groundSubFor(s, this.idx);
      if (sub && r < this.st.sub * 0.1 + (s.pos === 'back' ? 0.12 : 0)) { it.press = 'sub'; return it; }
      if (s.pos !== 'back' && r < 0.08 + this.st.advance * 0.16) { it.press = 'advance'; return it; }
      if (me.stamina < 18 && r < 0.5) return it; // ride it out
      if (this.st.range > 108 && this.st.td < 0.1 && (s.pos === 'guard' || s.pos === 'half') && r < 0.2) { it.press = 'clinch'; return it; }
      if (r < 0.7 * this.d.aggr) {
        it.press = this.rng.chance(0.25 + me.a.elbows / 400) ? 'elbow' : 'jab';
        it.power = this.rng.chance(this.st.power + (o.head > 60 ? 0.3 : 0));
      }
      return it;
    }
    // bottom
    const beingPounded = o.state === 'attack';
    if (beingPounded && this.rng.chance(0.4 + me.a.bottomDefense / 200)) { this.guardT = 0.6; it.guard = 'high'; return it; }
    const sub = groundSubFor(s, this.idx);
    if (sub && r < this.st.sub * 0.08) { it.press = 'sub'; return it; }
    if ((s.pos === 'guard' || s.pos === 'half') && r < 0.12 + this.st.sub * 0.15 + me.a.sweeps / 600) { it.press = 'evade'; return it; }
    const striker = this.st.range >= 104 || this.st.td < 0.1;
    if (striker && s.pos !== 'mount' && s.pos !== 'back' && r < 0.5) { it.press = 'clinch'; return it; }
    if (r < 0.45 + (this.st.td > 0.3 ? 0.1 : 0)) { it.press = s.pos === 'guard' ? 'advance' : this.rng.chance(0.5) ? 'advance' : 'clinch'; return it; }
    if (r < 0.6) { it.press = 'jab'; return it; }
    this.guardT = 0.5;
    it.guard = 'high';
    return it;
  }
}

const AI_SKIP = new Set(['st', 'd', 'rng', '_me']);

/** Serialize the controller's full decision state (for exact checkpoints and replays). */
export function serializeAI(ai: AIController): Record<string, any> {
  const o: Record<string, any> = { __style: ai.styleId, __diff: ai.difficulty, __rng: ai.rng.state };
  for (const [k, v] of Object.entries(ai)) if (!AI_SKIP.has(k)) o[k] = v === undefined ? null : JSON.parse(JSON.stringify(v));
  return o;
}
export function restoreAI(o: Record<string, any>): AIController {
  const ai = new AIController(o.idx, o.__style, o.__diff, 1);
  ai.rng.state = o.__rng;
  for (const [k, v] of Object.entries(o)) if (!k.startsWith('__')) (ai as any)[k] = v === null && k === 'reaction' ? null : JSON.parse(JSON.stringify(v));
  return ai;
}

export function adaptMemory(ai: AIController): Partial<Adapt> {
  const out: Partial<Adapt> = {};
  for (const [k, v] of Object.entries(ai.adapt)) out[k as keyof Adapt] = Math.round(v * 50) / 100; // remember about half
  return out;
}
