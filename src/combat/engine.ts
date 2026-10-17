// Real-time MMA combat simulation. Pure data + functions: no DOM, no rendering.
// Both fighters are driven by `Intent`s (player input or AI) so the same rules apply to everyone.
import type { Attributes } from '../game/attributes';
import { RNG, clamp } from '../game/rng';
import type { Appearance, GamePlanId, Method, Stance, StyleId } from '../game/types';
import { MOVES, attackRatings, type MoveDef, type MoveId, type Target } from './moves';

export type Pos = 'standing' | 'clinch' | 'guard' | 'half' | 'side' | 'mount' | 'back';
export const GROUND: Pos[] = ['guard', 'half', 'side', 'mount', 'back'];
export const isGround = (p: Pos) => p !== 'standing' && p !== 'clinch';
export const POS_NAME: Record<Pos, string> = {
  standing: 'Standing', clinch: 'Clinch', guard: 'Full Guard', half: 'Half Guard', side: 'Side Control', mount: 'Mount', back: 'Back Control',
};

export type Button =
  | 'jab' | 'cross' | 'hook' | 'upper' | 'body' | 'lowkick' | 'bodykick' | 'headkick' | 'teep' | 'knee' | 'elbow'
  | 'evade' | 'clinch' | 'takedown' | 'sub' | 'advance';

export interface Intent {
  fwd: number; // -1..1 toward / away from opponent
  lat: number; // -1..1 circle left / right
  guard: 'none' | 'high' | 'low';
  power: boolean;
  press: Button | null; // edge-triggered this tick
}
export const NO_INTENT: Intent = { fwd: 0, lat: 0, guard: 'none', power: false, press: null };

export type FState = 'free' | 'attack' | 'evade' | 'stun' | 'down' | 'getup' | 'shoot' | 'sprawled' | 'clinchEntry' | 'whiff' | 'grapple';
export type SubKind = 'rnc' | 'armbar' | 'guillotine' | 'triangle';
export const SUB_NAME: Record<SubKind, string> = { rnc: 'Rear-Naked Choke', armbar: 'Armbar', guillotine: 'Guillotine', triangle: 'Triangle Choke' };

export interface RoundStats {
  sigLanded: number; sigThrown: number; headLanded: number; bodyLanded: number; legLanded: number;
  knockdowns: number; tdLanded: number; tdAttempts: number; subAttempts: number; subThreat: number;
  controlSec: number; damageDealt: number; reversals: number; pressure: number; blocked: number; evaded: number;
}
const newRoundStats = (): RoundStats => ({
  sigLanded: 0, sigThrown: 0, headLanded: 0, bodyLanded: 0, legLanded: 0, knockdowns: 0, tdLanded: 0, tdAttempts: 0,
  subAttempts: 0, subThreat: 0, controlSec: 0, damageDealt: 0, reversals: 0, pressure: 0, blocked: 0, evaded: 0,
});

export interface FighterSetup {
  name: string;
  short: string;
  attrs: Attributes;
  heightCm: number;
  reachCm: number;
  stance: Stance;
  style: StyleId;
  plan: GamePlanId;
  appearance: Appearance;
  isPlayer: boolean;
  staminaMult?: number; // weight-cut / condition effects on the gas tank
  regenMult?: number;
  record?: string;
  bodyType?: string;
}

export interface Attempt { kind: 'advance' | 'escape' | 'sweep' | 'getup' | 'standup' | 'sub' | 'break' | 'ctd'; t: number; dur: number; defended: boolean; sub?: SubKind }

export interface CF {
  idx: number;
  setup: FighterSetup;
  a: Attributes;
  x: number; z: number;
  velFwd: number; velLat: number;
  stamina: number; deep: number;
  head: number; body: number; legs: number;
  state: FState; stateT: number; stateDur: number;
  move: MoveId | null; phase: 'startup' | 'active' | 'recovery' | null;
  ms: number; ma: number; mr: number; movePower: boolean; moveResolved: boolean;
  guard: 'none' | 'high' | 'low'; guardLevel: number;
  evadeCd: number; evadeDir: number; counterWindow: number;
  lastAttackEnd: number; lastMove: MoveId | null; chain: number;
  buffer: { b: Button; t: number; power: boolean } | null;
  attempt: Attempt | null;
  hitFlash: number; hitTarget: Target | null;
  kdRound: number; bodyKd: number; legKd: number;
  unanswered: number[];
  sprawlBonus: number;
  rounds: RoundStats[];
  whiffs: number;
  lastPress: Button | null;
  subPressCd: number;
  lastHitT: number;
  form: number;
  armPunch: boolean;
}

export interface SubState { attacker: number; kind: SubKind; lock: number; escape: number; t: number; marker: number; from: Pos }

export interface FightEvent {
  t: number;
  type: 'hit' | 'block' | 'miss' | 'evade' | 'kd' | 'ko' | 'stun' | 'td' | 'tdfail' | 'sprawl' | 'clinch' | 'break' | 'pos' | 'sub' | 'subescape' | 'tap'
    | 'bell' | 'text' | 'counter' | 'standup' | 'whiff' | 'check';
  i: number; // actor
  text?: string;
  dmg?: number;
  target?: Target;
  big?: boolean;
}

export interface FightConfig {
  rounds: number;
  roundSeconds: number;
  seed: number;
  title: boolean;
  practice?: boolean;
}

export interface FightOutcome {
  winner: number; // -1 draw
  method: Method;
  round: number;
  time: string;
  detail: string;
  cards: [number, number][];
}

export interface FightState {
  cfg: FightConfig;
  t: number;
  round: number;
  roundT: number;
  phase: 'intro' | 'live' | 'roundOver' | 'over';
  phaseT: number;
  pos: Pos;
  top: number;
  clinchSwapT: number;
  sub: SubState | null;
  lastActivity: number;
  f: [CF, CF];
  events: FightEvent[];
  outcome: FightOutcome | null;
  rng: number;
  judges: { ws: number; wg: number }[];
  roundCards: { round: number; cards: [number, number][] }[];
  stoppageNote: string;
  tick?: number; // simulation steps taken (intro + live); used for replays and checkpoints
}

export const CAGE_R = 340;
const APOTHEM = CAGE_R * Math.cos(Math.PI / 8);
const NORMALS = Array.from({ length: 8 }, (_, k) => {
  const ang = (k * Math.PI) / 4 + Math.PI / 8;
  return [Math.cos(ang), Math.sin(ang)];
});

export function clockString(s: FightState): string {
  const display = Math.max(0, 300 - (s.roundT * 300) / s.cfg.roundSeconds);
  const m = Math.floor(display / 60);
  const sec = Math.floor(display % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
export function elapsedString(s: FightState): string {
  const e = Math.min(300, (s.roundT * 300) / s.cfg.roundSeconds);
  const m = Math.floor(e / 60);
  const sec = Math.floor(e % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function makeCF(idx: number, setup: FighterSetup, x: number): CF {
  return {
    idx, setup, a: setup.attrs, x, z: 0, velFwd: 0, velLat: 0,
    stamina: 100, deep: 0, head: 0, body: 0, legs: 0,
    state: 'free', stateT: 0, stateDur: 0,
    move: null, phase: null, ms: 0, ma: 0, mr: 0, movePower: false, moveResolved: false,
    guard: 'none', guardLevel: 0, evadeCd: 0, evadeDir: 0, counterWindow: 0,
    lastAttackEnd: -9, lastMove: null, chain: 0, buffer: null, attempt: null,
    hitFlash: 0, hitTarget: null, kdRound: 0, bodyKd: 0, legKd: 0, unanswered: [], sprawlBonus: 0,
    rounds: [newRoundStats()], whiffs: 0, lastPress: null, subPressCd: 0, lastHitT: -10, form: 0, armPunch: false,
  };
}

export function createFight(cfg: FightConfig, a: FighterSetup, b: FighterSetup): FightState {
  const rng = new RNG(cfg.seed);
  const judges = [
    { ws: 1.12, wg: 0.88 },
    { ws: 1.0, wg: 1.0 },
    { ws: 0.88, wg: 1.12 },
  ];
  const s: FightState = {
    cfg, t: 0, round: 1, roundT: 0, phase: 'intro', phaseT: 0, pos: 'standing', top: -1, clinchSwapT: 0, sub: null,
    lastActivity: 0, f: [makeCF(0, a, -130), makeCF(1, b, 130)], events: [], outcome: null, rng: rng.state, judges,
    roundCards: [], stoppageNote: '',
  };
  // fight-night form: everyone has good and bad nights (seeded, ~±2.5 rating points)
  for (const f of s.f) {
    const form = rng.gauss() * 2.5;
    f.a = { ...f.a };
    for (const k of Object.keys(f.a) as (keyof Attributes)[]) f.a[k] = clamp(f.a[k] + form, 1, 99);
    f.form = form;
    f.stamina = maxStamina(f);
  }
  s.rng = rng.state;
  return s;
}

// ───────────────────────────── derived values
export function maxStamina(f: CF) {
  const base = 58 + f.a.endurance * 0.42;
  return clamp((base - f.body * 0.16 - f.deep) * (f.setup.staminaMult ?? 1), 20, 100);
}
/** Performance multiplier from fatigue: 1 when fresh, drops sharply below 35 stamina. */
export function fm(f: CF) {
  return f.stamina >= 35 ? 1 : 0.3 + (0.7 * f.stamina) / 35;
}
/** Performance multiplier from accumulated head damage, softened by composure. */
export function hurt(f: CF) {
  return 1 - (f.head / 100) * 0.32 * (1.2 - f.a.composure / 120);
}
function planMod(f: CF, k: string): number {
  const p = f.setup.plan;
  switch (k) {
    case 'fwd': return p === 'pressure' ? 1.12 : 1;
    case 'regen': return p === 'pressure' ? 0.94 : p === 'defensive' ? 1.08 : 1;
    case 'counter': return p === 'counter' ? 0.15 : 0;
    case 'range': return p === 'distance' ? 8 : 0;
    case 'kickAcc': return p === 'distance' ? 0.04 : 0;
    case 'td': return p === 'wrestling' ? 0.07 : p === 'balanced' ? 0.02 : 0;
    case 'grappleCost': return p === 'wrestling' ? 0.85 : 1;
    case 'clinch': return p === 'clinch' ? 0.1 : p === 'balanced' ? 0.02 : 0;
    case 'knee': return p === 'clinch' ? 1.12 : 1;
    case 'sub': return p === 'submission' ? 1 : 0;
    case 'sweep': return p === 'submission' ? 0.05 : 0;
    case 'acc': return p === 'balanced' ? 0.02 : 0;
    case 'mit': return p === 'defensive' ? 0.06 : 0;
    case 'evade': return p === 'defensive' ? 0.06 : p === 'counter' ? 0.04 : 0;
    case 'dmg': return p === 'defensive' ? 0.95 : 1;
  }
  return 0;
}

export function dist(s: FightState) {
  const [a, b] = s.f;
  return Math.hypot(b.x - a.x, b.z - a.z);
}
export function cageProximity(f: CF) {
  let m = -Infinity;
  for (const [nx, nz] of NORMALS) m = Math.max(m, f.x * nx + f.z * nz);
  return m - (APOTHEM - 30); // > -15 means pressed against the fence
}
export const atCage = (f: CF) => cageProximity(f) > -18;

function clampToCage(f: CF) {
  for (const [nx, nz] of NORMALS) {
    const d = f.x * nx + f.z * nz;
    const lim = APOTHEM - 30;
    if (d > lim) {
      f.x -= (d - lim) * nx;
      f.z -= (d - lim) * nz;
    }
  }
}

export function effRange(f: CF, m: MoveDef): [number, number] {
  const reachF = 0.78 + (0.22 * f.setup.reachCm) / 180;
  return [m.range[0], m.range[1] * reachF + (f.a.distance - 50) * 0.18 + planMod(f, 'range')];
}

function rs(f: CF, s: FightState) {
  while (f.rounds.length < s.round) f.rounds.push(newRoundStats());
  return f.rounds[s.round - 1];
}

function emit(s: FightState, e: Omit<FightEvent, 't'>) {
  s.events.push({ t: s.t, ...e });
  if (s.events.length > 400) s.events.splice(0, s.events.length - 400);
}

function spend(f: CF, amt: number, s: FightState) {
  let cost = amt;
  if (s.round === 1 && s.roundT < s.cfg.roundSeconds * 0.4) cost *= 1.22 - f.a.experience / 450; // adrenaline dump
  if (f.stamina < 20) f.deep = Math.min(34, f.deep + cost * 0.012); // working while gassed burns the tank
  f.stamina = Math.max(0, f.stamina - cost);
  f.deep = Math.min(34, f.deep + cost * 0.0075 * (1.55 - f.a.endurance / 100));
}

function setState(f: CF, st: FState, dur = 0) {
  f.state = st;
  f.stateT = 0;
  f.stateDur = dur;
  if (st !== 'attack') {
    f.move = null;
    f.phase = null;
  }
  if (st !== 'grapple') f.attempt = null;
}

// ───────────────────────────── main step
export function step(s: FightState, intents: [Intent, Intent], dt: number) {
  if (s.phase === 'over' || s.phase === 'roundOver') return;
  s.tick = (s.tick ?? 0) + 1;
  s.phaseT += dt;
  if (s.phase === 'intro') {
    if (s.phaseT >= 1.6) {
      s.phase = 'live';
      s.phaseT = 0;
      emit(s, { type: 'bell', i: -1, text: `Round ${s.round} — FIGHT!` });
    }
    return;
  }
  const rng = new RNG(s.rng);
  s.t += dt;
  s.roundT += dt;

  for (const f of s.f) {
    f.stateT += dt;
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    f.evadeCd = Math.max(0, f.evadeCd - dt);
    f.counterWindow = Math.max(0, f.counterWindow - dt);
    f.subPressCd = Math.max(0, f.subPressCd - dt);
    f.unanswered = f.unanswered.filter((tt) => s.t - tt < 5);
    // clearing the head / catching breath when not being hit
    if (s.phase === 'live' && f.hitFlash <= 0 && s.t - f.lastHitT > 3) {
      const k = (0.5 + f.a.recovery / 100) * dt;
      f.head = Math.max(0, f.head - 0.28 * k);
      f.body = Math.max(0, f.body - 0.2 * k);
    }
  }

  if (s.sub) {
    stepSub(s, intents, dt, rng);
  } else {
    for (let i = 0; i < 2; i++) handleInput(s, s.f[i], s.f[1 - i], intents[i], rng);
    for (let i = 0; i < 2; i++) advanceState(s, s.f[i], s.f[1 - i], rng);
    if (s.pos === 'standing') moveStanding(s, intents, dt);
    else if (s.pos === 'clinch') moveClinch(s, intents, dt, rng);
    else stepGroundPassive(s, intents, dt);
  }
  for (let i = 0; i < 2; i++) regen(s, s.f[i], intents[i], dt);

  // stoppages for accumulated damage
  for (let i = 0; i < 2; i++) {
    const f = s.f[i];
    if (s.phase !== 'live') break;
    if (f.head >= 100) finish(s, 1 - i, isGround(s.pos) ? 'TKO' : 'KO', isGround(s.pos) ? 'Ground strikes — the referee steps in' : 'Knocked out cold');
  }
  if (s.phase === 'live' && s.roundT >= s.cfg.roundSeconds) endRound(s);
  s.rng = rng.state;
}

function regen(s: FightState, f: CF, it: Intent, dt: number) {
  if (s.phase !== 'live') return;
  const ground = isGround(s.pos);
  let act = 1;
  if (s.sub) act = 0;
  else if (f.state === 'attack' || f.state === 'shoot' || f.state === 'clinchEntry') act = 0.5;
  else if (f.state === 'grapple') act = 0.45;
  else if (ground) act = s.top === f.idx ? 0.85 : f.guard !== 'none' ? 0.5 : 0.7;
  else if (s.pos === 'clinch') act = 0.65;
  else if (f.guard !== 'none') act = 0.55;
  else if (Math.abs(it.fwd) + Math.abs(it.lat) > 0.1) act = it.power ? 0 : 0.82;
  const rate = 6.6 * (0.55 + f.a.cardio / 110) * (1 - f.body / 170) * (f.setup.regenMult ?? 1) * planMod(f, 'regen');
  f.stamina = Math.min(maxStamina(f), f.stamina + rate * act * dt);
  // guard holding & burst footwork drain
  if (!ground && s.pos === 'standing' && f.guard !== 'none') f.stamina = Math.max(0, f.stamina - 0.6 * dt);
  if (ground && s.top !== f.idx && f.guard !== 'none') f.stamina = Math.max(0, f.stamina - 0.8 * dt);
  if (!ground && it.power && Math.abs(it.fwd) + Math.abs(it.lat) > 0.1 && f.state === 'free') spend(f, 8 * dt, s);
}

// ───────────────────────────── inputs
function handleInput(s: FightState, f: CF, o: CF, it: Intent, rng: RNG) {
  // guard follows held input when free
  const canGuard = f.state === 'free' || f.state === 'grapple' && false;
  f.guard = canGuard ? it.guard : f.state === 'stun' ? f.guard : 'none';
  if (f.state === 'stun') f.guardLevel = Math.max(0, f.guardLevel - 0.03);
  f.guardLevel = f.guard !== 'none' ? Math.min(1, f.guardLevel + 0.12) : Math.max(0, f.guardLevel - 0.2);

  let press = it.press;
  let power = it.power;
  if (!press && f.buffer && s.t - f.buffer.t < 0.18) {
    press = f.buffer.b;
    power = f.buffer.power;
  }
  if (!press) return;
  f.lastPress = press;
  const busy = f.state !== 'free';
  if (busy) {
    // defender reactions that work while busy: sprawl / grapple defense
    if (s.pos === 'standing' && o.state === 'shoot' && (press === 'takedown' || press === 'evade') && f.state !== 'down') {
      sprawl(s, f, o);
      return;
    }
    if (f.state === 'attack' && f.phase === 'recovery') f.buffer = { b: press, t: s.t, power };
    if (o.attempt && (press === 'advance' || press === 'evade' || press === 'clinch' || press === 'takedown')) o.attempt.defended = true;
    return;
  }
  f.buffer = null;
  // defending an opponent attempt by reacting to it
  if (o.attempt && o.state === 'grapple' && (press === 'advance' || press === 'evade' || press === 'clinch' || press === 'takedown')) {
    o.attempt.defended = true;
    emit(s, { type: 'text', i: f.idx, text: 'Defends' });
    spend(f, 3, s);
    return;
  }
  if (s.pos === 'standing') standingPress(s, f, o, press, power, rng);
  else if (s.pos === 'clinch') clinchPress(s, f, o, press, power, rng);
  else groundPress(s, f, o, press, power, rng);
}

const STRIKE_BUTTONS: Button[] = ['jab', 'cross', 'hook', 'upper', 'body', 'lowkick', 'bodykick', 'headkick', 'teep', 'knee', 'elbow'];

function startMove(s: FightState, f: CF, id: MoveId, power: boolean) {
  const m = MOVES[id];
  const r = attackRatings(m, f.a);
  let spd = 1.25 - r.speed / 200;
  if (s.t - f.lastAttackEnd < 0.42 && f.lastMove && f.lastMove !== id) {
    spd *= 1 - f.a.combos / 360;
    f.chain++;
  } else f.chain = 0;
  spd *= 1 + (1 - fm(f)) * 0.5 + (1 - hurt(f)) * 0.4;
  f.ms = m.startup * spd * (power ? 1.3 : 1);
  f.ma = m.active;
  f.mr = m.recovery * spd * (power ? 1.15 : 1) * (m.kind === 'kick' ? 1.2 - f.a.kickboxing / 250 : 1);
  f.move = id;
  f.movePower = power;
  f.moveResolved = false;
  setState(f, 'attack');
  f.move = id;
  f.phase = 'startup';
  const eff = 1.15 - f.a.cardio / 420 - f.a.discipline / 900;
  f.armPunch = f.stamina < m.stamina * (power ? 1.6 : 1);
  if (f.armPunch) { f.ms *= 1.35; f.mr *= 1.25; f.movePower = false; }
  spend(f, m.stamina * (power ? 1.6 : 1) * eff * (m.context === 'ground' ? planMod(f, 'grappleCost') : 1), s);
  rs(f, s).sigThrown++;
}

function standingPress(s: FightState, f: CF, o: CF, b: Button, power: boolean, rng: RNG) {
  const d = dist(s);
  if ((STRIKE_BUTTONS as string[]).includes(b)) {
    startMove(s, f, b as MoveId, power);
    return;
  }
  switch (b) {
    case 'evade': {
      if (f.evadeCd > 0) return;
      setState(f, 'evade', 0.32);
      f.evadeCd = 0.5;
      f.evadeDir = 0;
      spend(f, 4.5, s);
      return;
    }
    case 'clinch': {
      if (d > 92) {
        emit(s, { type: 'text', i: f.idx, text: 'Too far to clinch' });
        return;
      }
      setState(f, 'clinchEntry', 0.26 * (1.2 - f.a.explosiveness / 250));
      spend(f, 4, s);
      return;
    }
    case 'takedown': {
      if (d > 125) {
        emit(s, { type: 'text', i: f.idx, text: 'Too far to shoot' });
        return;
      }
      setState(f, 'shoot', 0.42 * (1.22 - f.a.explosiveness / 250) * (1 + (1 - fm(f)) * 0.5));
      o.sprawlBonus = 0;
      spend(f, 7 * planMod(f, 'grappleCost'), s);
      rs(f, s).tdAttempts++;
      return;
    }
    case 'sub': {
      // standing guillotine on a sprawled / shooting opponent
      if ((o.state === 'sprawled' || o.state === 'whiff' && o.stateT < 0.5) && d < 90) {
        startSub(s, f, o, 'guillotine', 'standing', rng);
      } else emit(s, { type: 'text', i: f.idx, text: 'No submission available' });
      return;
    }
    case 'advance': {
      if (o.state === 'down' && d < 190) {
        s.pos = 'half';
        s.top = f.idx;
        s.lastActivity = s.t;
        setState(o, 'stun', 1.2);
        setState(f, 'free');
        pinTogether(s);
        emit(s, { type: 'pos', i: f.idx, text: `${f.setup.short} pounces on top!` });
      }
      return;
    }
  }
}

function sprawl(s: FightState, f: CF, o: CF) {
  if (f.sprawlBonus > 0) return;
  const prog = o.stateT / o.stateDur; // later reaction within the shot = better sprawl timing
  f.sprawlBonus = 0.26 + 0.1 * clamp(prog * 1.4, 0, 1) + f.a.tdDefense / 600;
  spend(f, 4, s);
  emit(s, { type: 'sprawl', i: f.idx, text: 'Sprawl!' });
}

function clinchPress(s: FightState, f: CF, o: CF, b: Button, power: boolean, rng: RNG) {
  if (['jab', 'cross', 'hook', 'upper', 'body'].includes(b)) return startMove(s, f, 'cpunch', power);
  if (['knee', 'bodykick', 'lowkick', 'teep', 'headkick'].includes(b)) return startMove(s, f, 'cknee', power);
  if (b === 'elbow') return startMove(s, f, 'celbow', power);
  if (b === 'clinch' || b === 'evade') return startAttempt(s, f, 'break', 0.35);
  if (b === 'takedown') {
    rs(f, s).tdAttempts++;
    return startAttempt(s, f, 'ctd', 0.45);
  }
  if (b === 'sub') return startAttempt(s, f, 'sub', 0.5, 'guillotine');
}

export function groundSubFor(s: FightState, i: number): SubKind | null {
  const top = s.top === i;
  if (top) return s.pos === 'back' ? 'rnc' : s.pos === 'mount' || s.pos === 'side' ? 'armbar' : null;
  return s.pos === 'guard' ? 'triangle' : s.pos === 'half' ? 'guillotine' : null;
}

function groundPress(s: FightState, f: CF, o: CF, b: Button, power: boolean, rng: RNG) {
  const top = s.top === f.idx;
  if ((STRIKE_BUTTONS as string[]).includes(b)) {
    if (top) return startMove(s, f, b === 'elbow' ? 'gelbow' : 'gpunch', power);
    return startMove(s, f, 'bpunch', false);
  }
  switch (b) {
    case 'advance':
      if (top) {
        if (s.pos === 'back') return;
        return startAttempt(s, f, 'advance', 0.85);
      }
      if (s.pos === 'guard') return startAttempt(s, f, 'getup', 0.95);
      return startAttempt(s, f, 'escape', 0.8);
    case 'evade':
      if (!top && (s.pos === 'guard' || s.pos === 'half')) return startAttempt(s, f, 'sweep', 0.85);
      return;
    case 'clinch':
      if (top) {
        if (s.pos === 'guard' || s.pos === 'half') return startAttempt(s, f, 'standup', 0.5);
        return;
      }
      if (s.pos === 'guard' || s.pos === 'half' || s.pos === 'side') return startAttempt(s, f, 'getup', 0.95);
      return;
    case 'sub': {
      const k = groundSubFor(s, f.idx);
      if (k) startAttempt(s, f, 'sub', 0.6, k);
      else emit(s, { type: 'text', i: f.idx, text: 'No submission from here' });
      return;
    }
  }
}

function startAttempt(s: FightState, f: CF, kind: Attempt['kind'], dur: number, sub?: SubKind) {
  setState(f, 'grapple', dur);
  f.attempt = { kind, t: 0, dur, defended: false, sub };
  const costs: Record<string, number> = { advance: 6, escape: 7, sweep: 8, getup: 8, standup: 3, sub: 7, break: 4, ctd: 7 };
  spend(f, (costs[kind] ?? 5) * planMod(f, 'grappleCost'), s);
  s.lastActivity = s.t;
  const labels: Record<string, string> = {
    advance: 'Passing guard…', escape: 'Escaping…', sweep: 'Sweep attempt…', getup: 'Trying to stand…', standup: 'Standing up',
    sub: sub ? `${SUB_NAME[sub]}!` : 'Submission!', break: 'Breaking clinch…', ctd: 'Trip attempt…',
  };
  emit(s, { type: 'text', i: f.idx, text: labels[kind] });
}

// ───────────────────────────── state advancement
function advanceState(s: FightState, f: CF, o: CF, rng: RNG) {
  if (s.phase !== 'live') return;
  switch (f.state) {
    case 'attack': {
      if (f.phase === 'startup' && f.stateT >= f.ms) {
        f.phase = 'active';
        resolveStrike(s, f, o, rng);
      } else if (f.phase === 'active' && f.stateT >= f.ms + f.ma) {
        f.phase = 'recovery';
      } else if (f.phase === 'recovery' && f.stateT >= f.ms + f.ma + f.mr) {
        f.lastAttackEnd = s.t;
        f.lastMove = f.move;
        setState(f, 'free');
      }
      break;
    }
    case 'evade':
    case 'whiff':
    case 'stun':
    case 'sprawled':
      if (f.stateT >= f.stateDur) setState(f, 'free');
      break;
    case 'down':
      if (f.stateT >= f.stateDur) {
        setState(f, 'getup', 0.55);
        emit(s, { type: 'text', i: f.idx, text: `${f.setup.short} beats the count` });
      }
      break;
    case 'getup':
      if (f.stateT >= f.stateDur) setState(f, 'stun', 0.5);
      break;
    case 'clinchEntry':
      if (f.stateT >= f.stateDur) resolveClinchEntry(s, f, o, rng);
      break;
    case 'shoot':
      if (f.stateT >= f.stateDur) resolveTakedown(s, f, o, rng);
      break;
    case 'grapple':
      if (f.attempt) {
        f.attempt.t = f.stateT;
        if (o.guard !== 'none' && s.pos !== 'standing') f.attempt.defended = true;
        if (f.stateT >= f.stateDur) resolveAttempt(s, f, o, rng);
      } else setState(f, 'free');
      break;
  }
}

// ───────────────────────────── striking resolution
function resolveStrike(s: FightState, f: CF, o: CF, rng: RNG) {
  const m = MOVES[f.move!];
  const r = attackRatings(m, f.a);
  const st = rs(f, s);
  let accMod = planMod(f, 'acc') - (f.armPunch ? 0.1 : 0);
  let dmgMult = planMod(f, 'dmg') * (f.armPunch ? 0.5 : 1);
  let kdMult = 1;
  let counter = false;

  if (m.context === 'standing') {
    if (s.pos !== 'standing') return;
    const d = dist(s);
    const [minR, maxR] = effRange(f, m);
    if (o.state === 'down') {
      emit(s, { type: 'miss', i: f.idx, text: `${m.name} misses (opponent down)` });
      return;
    }
    if (d > maxR + 6) {
      f.whiffs++;
      f.mr *= 1.15;
      spend(f, m.stamina * 0.35 * (1.2 - f.a.discipline / 200), s);
      emit(s, { type: 'whiff', i: f.idx, text: `${m.name} falls short` });
      return;
    }
    if (d < minR) {
      dmgMult *= 0.55;
      accMod -= 0.08;
    } else {
      const rel = (d - minR) / Math.max(1, maxR - minR);
      accMod += rel > 0.88 ? -0.08 * ((rel - 0.88) / 0.12) : rel > 0.15 ? 0.04 : 0;
    }
    if (m.kind === 'kick') accMod += planMod(f, 'kickAcc');
    // lateral movement makes straight shots harder to land; hooks catch movers
    if (Math.abs(o.velLat) > 70) accMod += ['jab', 'cross', 'teep'].includes(m.id) ? -0.07 : m.id === 'hook' ? 0.03 : -0.03;
    if (o.velFwd < -90 && ['jab', 'cross', 'hook'].includes(m.id)) accMod -= 0.05;
    // evasion
    if (o.state === 'evade' && o.stateT > 0.03 && o.stateT < 0.27) {
      const pe = clamp(0.5 + (o.a.headMovement * 0.6 + o.a.agility * 0.4 - r.acc) / 240 + planMod(o, 'evade'), 0.15, 0.88) * fm(o) * hurt(o);
      const chance = m.target === 'head' ? pe : pe * 0.45;
      if (rng.chance(chance)) {
        o.counterWindow = 0.6;
        f.mr += 0.12;
        rs(o, s).evaded++;
        emit(s, { type: 'evade', i: o.idx, text: `${o.setup.short} slips the ${m.name.toLowerCase()}` });
        return;
      }
    }
  } else if (m.context === 'clinch') {
    if (s.pos !== 'clinch') return;
    if (s.top === f.idx) accMod += 0.1;
    accMod += planMod(f, 'clinch');
    if (m.kind === 'knee') dmgMult *= planMod(f, 'knee');
  } else {
    if (!isGround(s.pos)) return;
    const top = s.top === f.idx;
    const posAcc: Record<string, number> = { guard: -0.06, half: 0, side: 0.04, mount: 0.1, back: 0.04 };
    const posDmg: Record<string, number> = { guard: 0.45, half: 0.65, side: 0.8, mount: 1.2, back: 0.95 };
    if (top) {
      accMod += posAcc[s.pos];
      dmgMult *= posDmg[s.pos];
    }
  }

  // defense rating by target
  let defRating: number;
  if (m.context === 'ground') defRating = 0.5 * o.a.bottomDefense + 0.3 * o.a.posAwareness + 0.2 * o.a.blocking;
  else if (m.target === 'head') defRating = 0.45 * o.a.headMovement + 0.25 * o.a.agility + 0.15 * o.a.fightIQ + 0.15 * o.a.speed;
  else if (m.target === 'body') defRating = 0.4 * o.a.blocking + 0.3 * o.a.agility + 0.3 * o.a.fightIQ;
  else defRating = 0.4 * o.a.distance + 0.3 * o.a.balance + 0.3 * o.a.kickboxing;
  defRating *= fm(o) * hurt(o);

  // defender busy → openings
  if (o.state === 'attack') {
    if (o.phase === 'startup') accMod += 0.1;
    else if (o.phase === 'recovery') {
      accMod += 0.16;
      counter = true;
    }
  } else if (o.state === 'whiff' || o.state === 'sprawled') {
    accMod += 0.2;
    counter = true;
  } else if (o.state === 'stun') accMod += 0.28;
  else if (o.state === 'getup') accMod += 0.15;
  else if (o.state === 'shoot' && (m.id === 'knee' || m.id === 'upper' || m.id === 'elbow')) {
    accMod += 0.25;
    dmgMult *= 1.4;
    counter = true;
  } else if (o.state === 'grapple' && m.context === 'ground') accMod += 0.08;
  if (f.counterWindow > 0) {
    counter = true;
    accMod += 0.12;
  }
  if (counter && m.context === 'standing') {
    accMod += f.a.counter / 600;
    dmgMult *= 1.12 + f.a.counter / 320 + planMod(f, 'counter');
    kdMult *= 1.4;
  }

  const attackSkill = r.acc * fm(f) * hurt(f) * (0.94 + f.a.confidence / 800);
  let acc = m.acc + (attackSkill - defRating) / 230 + accMod;
  if (m.context === 'ground' && o.guard !== 'none' && s.top !== o.idx) acc -= 0.15;
  acc = clamp(acc, 0.06, 0.93);
  if (!rng.chance(acc)) {
    spend(f, m.stamina * 0.2, s);
    emit(s, { type: 'miss', i: f.idx, text: `${m.name} misses` });
    return;
  }

  // guard interaction
  let mit = 0;
  if (m.context === 'standing' || m.context === 'clinch') {
    const g = o.guardLevel > 0.55 ? o.guard : 'none';
    if (g === 'high') {
      if (m.target === 'head') mit = (0.6 + o.a.blocking * 0.003) * (1 - m.guardPierce);
      else if (m.target === 'body') mit = 0.22 * (1 - m.guardPierce * 0.5);
    } else if (g === 'low') {
      if (m.target === 'body') mit = (0.55 + o.a.blocking * 0.0035) * (1 - m.guardPierce * 0.3);
      else if (m.target === 'legs') {
        mit = 0.6 + o.a.distance * 0.0015 + o.a.kickboxing * 0.0015;
        f.legs = Math.min(100, f.legs + 2.5);
        emit(s, { type: 'check', i: o.idx, text: `${o.setup.short} checks the kick` });
      } else mit = 0.12;
    }
    if (mit > 0) mit = clamp(mit + planMod(o, 'mit'), 0, 0.92);
  } else if (m.context === 'ground' && o.guard !== 'none' && s.top !== o.idx) {
    mit = 0.35 + o.a.bottomDefense * 0.002;
  }

  // damage
  const pressing = f.velFwd > 40 ? 1 + f.a.aggression / 500 : 1;
  let dmg = m.dmg * (0.7 + (r.power / 100) * 0.6) * (0.92 + (r.tech / 100) * 0.16) * (f.movePower ? 1.35 : 1)
    * (0.7 + 0.3 * fm(f)) * rng.range(0.85, 1.15) * dmgMult * pressing * (0.95 + f.a.confidence / 1000);
  if (m.kind === 'kick') dmg *= 1 - f.legs / 220;
  dmg *= 1 - mit;
  const tgt = m.target;
  if (tgt === 'head') dmg *= (1.17 - o.a.durability / 300) * 0.47;
  else if (tgt === 'body') dmg *= (1.2 - o.a.durability / 250 - o.a.strength / 500) * 0.8;
  else dmg *= (1.2 - o.a.balance / 300 - o.a.durability / 400) * 0.85;
  dmg = Math.max(0.3, dmg);
  // knockback
  if (m.context === 'standing') push(s, o, f, m.id === 'teep' ? 24 : dmg * 1.4);

  if (mit > 0.3) {
    rs(o, s).blocked++;
    spend(o, dmg * 0.5 * (1.3 - o.a.blocking / 100), s);
    emit(s, { type: 'block', i: o.idx, text: `${o.setup.short} blocks the ${m.name.toLowerCase()}`, dmg, target: tgt });
  }
  o[tgt] = Math.min(100, o[tgt] + dmg);
  o.lastHitT = s.t;
  o.hitFlash = 0.2;
  o.hitTarget = tgt;
  st.damageDealt += dmg;
  if (mit < 0.3 && dmg >= 0.8) {
    st.sigLanded++;
    if (tgt === 'head') st.headLanded++;
    else if (tgt === 'body') st.bodyLanded++;
    else st.legLanded++;
  }
  s.lastActivity = s.t;
  if (m.context === 'ground' && s.top === f.idx) {
    o.unanswered.push(s.t);
  }
  // interrupt opponent's attack if hit cleanly
  if (o.state === 'attack' && o.phase === 'startup' && dmg > 3.5) {
    setState(o, 'free');
    emit(s, { type: 'text', i: f.idx, text: 'Beat him to the punch!' });
  }
  if (o.state === 'grapple' && o.attempt && dmg > 4) o.attempt.defended = true;
  if (mit <= 0.3) emit(s, { type: counter ? 'counter' : 'hit', i: f.idx, text: `${counter ? 'COUNTER ' : ''}${m.name}${f.movePower ? ' (power)' : ''} lands`, dmg, target: tgt, big: dmg > 5 });

  // finishing mechanics
  if (s.phase !== 'live') return;
  const chin = 1.35 - (o.a.durability / 100) * 0.75 - (o.a.composure / 100) * 0.25;
  if (tgt === 'head' && mit < 0.5 && m.kd > 0) {
    const pkd = 0.7 * m.kd * kdMult * (f.movePower ? 1.5 : 1) * Math.pow(dmg / 2.9, 1.4) * (0.3 + o.head / 70) * chin * (o.state === 'stun' ? 1.8 : 1);
    if (rng.chance(pkd)) return knockdown(s, f, o, rng, 'head', chin);
    const ps = ((dmg - 1.9) / 7) * (0.4 + o.head / 90) * chin;
    if (dmg >= 2.4 && o.state !== 'down' && rng.chance(ps)) {
      setState(o, 'stun', 0.55 + dmg / 8);
      emit(s, { type: 'stun', i: o.idx, text: `${o.setup.short} is HURT!`, big: true });
    }
  } else if (tgt === 'body' && o.body > 78 && dmg >= 5 && m.context !== 'ground' && rng.chance((o.body - 72) / 90)) {
    o.bodyKd++;
    if (o.bodyKd >= 2 || o.head > 70) return finish(s, f.idx, 'TKO', 'Body shot — doubled over, can\'t continue');
    rs(f, s).knockdowns++;
    setState(o, 'down', 2.0);
    emit(s, { type: 'kd', i: f.idx, text: `${o.setup.short} crumbles from the body shot!`, big: true });
  } else if (tgt === 'legs' && o.legs >= 96 && rng.chance(0.4)) {
    o.legKd++;
    if (o.legKd >= 2) return finish(s, f.idx, 'TKO', 'Leg kicks — the leg is gone');
    rs(f, s).knockdowns++;
    setState(o, 'down', 1.4);
    emit(s, { type: 'kd', i: f.idx, text: `${o.setup.short}'s leg gives out!`, big: true });
  }
  // referee stoppage on the ground
  if (m.context === 'ground' && s.phase === 'live') {
    const need = o.guard !== 'none' ? 7 : 6;
    if (o.unanswered.length >= need && o.head > 72) finish(s, f.idx, 'TKO', 'Unanswered ground-and-pound');
  }
}

function knockdown(s: FightState, f: CF, o: CF, rng: RNG, _t: Target, chin: number) {
  rs(f, s).knockdowns++;
  o.kdRound++;
  const pko = clamp((o.head - 50) / 55, 0.04, 0.85) * chin + (o.kdRound >= 2 ? 0.3 : 0);
  if (o.head >= 95 || rng.chance(pko)) {
    emit(s, { type: 'ko', i: f.idx, text: `${o.setup.short} IS OUT!`, big: true });
    return finish(s, f.idx, 'KO', `${MOVES[f.move!].name}`);
  }
  if (o.kdRound >= 3) return finish(s, f.idx, 'TKO', 'Third knockdown — referee waves it off');
  setState(o, 'down', 1.4 + (o.head / 100) * 0.8);
  o.guardLevel = 0;
  emit(s, { type: 'kd', i: f.idx, text: `KNOCKDOWN! ${o.setup.short} is down!`, big: true });
}

function push(s: FightState, o: CF, f: CF, amt: number) {
  const dx = o.x - f.x, dz = o.z - f.z;
  const d = Math.hypot(dx, dz) || 1;
  o.x += (dx / d) * amt;
  o.z += (dz / d) * amt;
  clampToCage(o);
}

// ───────────────────────────── takedowns & clinch
function resolveTakedown(s: FightState, f: CF, o: CF, rng: RNG) {
  const d = dist(s);
  if (d > 132) {
    setState(f, 'whiff', 0.6);
    emit(s, { type: 'tdfail', i: f.idx, text: 'Shot from too far — stumbles' });
    return;
  }
  const A = f.a.tdOffense * 0.45 + f.a.wrestling * 0.25 + f.a.explosiveness * 0.15 + f.a.strength * 0.15;
  const D = o.a.tdDefense * 0.5 + o.a.balance * 0.25 + o.a.wrestling * 0.15 + o.a.strength * 0.1;
  let p = 0.33 + ((A * fm(f) * hurt(f)) - D * fm(o) * hurt(o)) / 135 + planMod(f, 'td');
  if (o.state === 'attack') p += 0.22;
  if (o.state === 'stun' || o.state === 'getup') p += 0.3;
  if (o.state === 'whiff') p += 0.2;
  if (o.state === 'evade') p -= 0.1;
  if (atCage(o)) p += 0.07;
  p -= o.sprawlBonus;
  p = clamp(p, 0.04, 0.92);
  o.sprawlBonus = 0;
  if (rng.chance(p)) {
    s.pos = A - D > 18 && rng.chance(0.5) ? 'half' : 'guard';
    s.top = f.idx;
    s.lastActivity = s.t;
    rs(f, s).tdLanded++;
    setState(f, 'free');
    if (o.state !== 'stun') setState(o, 'free');
    o.attempt = null;
    pinTogether(s);
    emit(s, { type: 'td', i: f.idx, text: `TAKEDOWN! ${f.setup.short} lands in ${POS_NAME[s.pos].toLowerCase()}`, big: true });
  } else {
    setState(f, 'sprawled', 0.75);
    spend(f, 5, s);
    emit(s, { type: 'tdfail', i: o.idx, text: `${o.setup.short} stuffs the takedown` });
  }
}

function resolveClinchEntry(s: FightState, f: CF, o: CF, rng: RNG) {
  if (dist(s) > 100) {
    setState(f, 'whiff', 0.35);
    emit(s, { type: 'whiff', i: f.idx, text: 'Reaches for the clinch — nothing there' });
    return;
  }
  let p = 0.45 + (f.a.clinch * 0.6 + f.a.strength * 0.2 + f.a.explosiveness * 0.2 - (o.a.clinch * 0.5 + o.a.distance * 0.2 + o.a.agility * 0.3) * fm(o)) / 120
    + planMod(f, 'clinch');
  if (o.state === 'attack') p += o.phase === 'recovery' ? 0.18 : 0.1;
  if (o.state === 'stun') p += 0.3;
  if (o.state === 'evade') p -= 0.2;
  if (o.guard !== 'none') p += 0.06;
  if (rng.chance(clamp(p, 0.08, 0.92))) {
    s.pos = 'clinch';
    s.top = f.idx;
    s.lastActivity = s.t;
    setState(f, 'free');
    if (o.state === 'attack' || o.state === 'evade') setState(o, 'free');
    pinTogether(s, 46);
    emit(s, { type: 'clinch', i: f.idx, text: `${f.setup.short} ties up in the clinch` });
  } else {
    setState(f, 'whiff', 0.4);
    emit(s, { type: 'text', i: o.idx, text: `${o.setup.short} frames off the clinch` });
  }
}

function pinTogether(s: FightState, gap = 30) {
  const [a, b] = s.f;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  let dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  a.x = mx - (dx * gap) / 2; a.z = mz - (dz * gap) / 2;
  b.x = mx + (dx * gap) / 2; b.z = mz + (dz * gap) / 2;
  clampToCage(a); clampToCage(b);
}

function toStanding(s: FightState, gap: number, why: string) {
  s.pos = 'standing';
  s.top = -1;
  s.sub = null;
  for (const f of s.f) if (f.state === 'grapple' || f.state === 'attack') setState(f, 'free');
  // separate along current axis
  const [a, b] = s.f;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  let dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d < 1) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
  a.x = mx - (dx * gap) / 2; a.z = mz - (dz * gap) / 2;
  b.x = mx + (dx * gap) / 2; b.z = mz + (dz * gap) / 2;
  // pull towards centre if stuck on the fence
  for (const f of s.f) { f.x *= 0.85; f.z *= 0.85; clampToCage(f); }
  s.lastActivity = s.t;
  emit(s, { type: 'standup', i: -1, text: why });
}

// ───────────────────────────── grappling attempts
function resolveAttempt(s: FightState, f: CF, o: CF, rng: RNG) {
  const at = f.attempt!;
  setState(f, 'free');
  const def = at.defended ? 0.42 : 1;
  const ofm = fm(o), ffm = fm(f) * hurt(f);
  const stunnedBonus = o.state === 'stun' ? 0.25 : 0;
  const NEXT_TOP: Partial<Record<Pos, Pos>> = { guard: 'half', half: 'side', side: 'mount', mount: 'back' };
  const NEXT_BOTTOM: Partial<Record<Pos, Pos>> = { back: 'half', mount: 'half', side: 'half', half: 'guard' };
  switch (at.kind) {
    case 'advance': {
      if (!isGround(s.pos) || s.top !== f.idx) return;
      const base = s.pos === 'mount' ? 0.22 : 0.32;
      const p = (base + ((f.a.posAwareness * 0.4 + f.a.topControl * 0.35 + f.a.strength * 0.25) * ffm - (o.a.bottomDefense * 0.45 + o.a.posAwareness * 0.3 + o.a.bjj * 0.25) * ofm) / 130) * def + stunnedBonus;
      if (rng.chance(clamp(p, 0.05, 0.9))) {
        s.pos = NEXT_TOP[s.pos] ?? s.pos;
        emit(s, { type: 'pos', i: f.idx, text: `${f.setup.short} advances to ${POS_NAME[s.pos].toLowerCase()}`, big: s.pos === 'mount' || s.pos === 'back' });
      } else emit(s, { type: 'text', i: o.idx, text: `${o.setup.short} retains position` });
      return;
    }
    case 'escape': {
      if (!isGround(s.pos) || s.top === f.idx) return;
      const pen = s.pos === 'back' ? 0.08 : s.pos === 'mount' ? 0.05 : 0;
      const p = (0.33 + ((f.a.bottomDefense * 0.45 + f.a.agility * 0.15 + f.a.strength * 0.2 + f.a.bjj * 0.2) * ffm - (o.a.topControl * 0.5 + o.a.posAwareness * 0.3 + o.a.strength * 0.2) * ofm) / 130 - pen) * def;
      if (rng.chance(clamp(p, 0.04, 0.85))) {
        s.pos = NEXT_BOTTOM[s.pos] ?? s.pos;
        f.unanswered = [];
        emit(s, { type: 'pos', i: f.idx, text: `${f.setup.short} escapes to ${POS_NAME[s.pos].toLowerCase()}` });
      } else emit(s, { type: 'text', i: o.idx, text: `${o.setup.short} keeps him pinned` });
      return;
    }
    case 'sweep': {
      if (!(s.pos === 'guard' || s.pos === 'half') || s.top === f.idx) return;
      const p = (0.2 + ((f.a.sweeps * 0.5 + f.a.bjj * 0.3 + f.a.explosiveness * 0.2) * ffm - (o.a.balance * 0.4 + o.a.posAwareness * 0.35 + o.a.topControl * 0.25) * ofm) / 130 + planMod(f, 'sweep')) * def;
      if (rng.chance(clamp(p, 0.04, 0.75))) {
        s.top = f.idx;
        s.pos = 'half';
        f.unanswered = [];
        rs(f, s).reversals++;
        emit(s, { type: 'pos', i: f.idx, text: `SWEEP! ${f.setup.short} reverses to the top`, big: true });
      } else emit(s, { type: 'text', i: o.idx, text: `${o.setup.short} bases out` });
      return;
    }
    case 'getup': {
      if (!isGround(s.pos) || s.top === f.idx) return;
      let p = (0.41 + ((f.a.wrestling * 0.3 + f.a.bottomDefense * 0.3 + f.a.strength * 0.2 + f.a.explosiveness * 0.2) * ffm - (o.a.topControl * 0.55 + o.a.strength * 0.25 + o.a.wrestling * 0.2) * ofm) / 130) * def;
      if (atCage(f)) p += 0.08;
      if (s.pos === 'side') p -= 0.12;
      if (s.pos === 'mount' || s.pos === 'back') p = 0;
      if (rng.chance(clamp(p, 0, 0.8))) {
        toStanding(s, 95, `${f.setup.short} gets back to his feet`);
      } else emit(s, { type: 'text', i: o.idx, text: `${o.setup.short} drags him back down` });
      return;
    }
    case 'standup': {
      if (!isGround(s.pos) || s.top !== f.idx) return;
      toStanding(s, 115, `${f.setup.short} stands up out of the guard`);
      return;
    }
    case 'break': {
      if (s.pos !== 'clinch') return;
      const ctrl = s.top === f.idx;
      const p = ctrl ? 0.95 : (0.42 + ((f.a.clinch * 0.5 + f.a.strength * 0.3 + f.a.agility * 0.2) * ffm - (o.a.clinch * 0.6 + o.a.strength * 0.4) * ofm) / 140) * def;
      if (rng.chance(clamp(p, 0.08, 0.95))) toStanding(s, 105, 'They break apart');
      else emit(s, { type: 'text', i: o.idx, text: `${o.setup.short} keeps the clinch` });
      return;
    }
    case 'ctd': {
      if (s.pos !== 'clinch') return;
      let p = 0.33 + ((f.a.tdOffense * 0.4 + f.a.clinch * 0.3 + f.a.strength * 0.3) * ffm - (o.a.tdDefense * 0.5 + o.a.balance * 0.3 + o.a.clinch * 0.2) * ofm) / 140 + planMod(f, 'td');
      if (s.top === f.idx) p += 0.1;
      if (atCage(o)) p += 0.08;
      p *= def;
      if (rng.chance(clamp(p, 0.05, 0.85))) {
        s.pos = 'half';
        s.top = f.idx;
        rs(f, s).tdLanded++;
        pinTogether(s);
        emit(s, { type: 'td', i: f.idx, text: `${f.setup.short} trips him down from the clinch!`, big: true });
      } else {
        s.top = o.idx;
        emit(s, { type: 'tdfail', i: o.idx, text: `${o.setup.short} defends and takes control of the clinch` });
      }
      return;
    }
    case 'sub': {
      const kind = at.sub!;
      const valid = kind === 'guillotine' ? s.pos === 'clinch' || s.pos === 'half' || s.pos === 'standing' : groundSubFor(s, f.idx) === kind;
      if (!valid) return;
      startSub(s, f, o, kind, s.pos, rng, at.defended);
      return;
    }
  }
}

function startSub(s: FightState, f: CF, o: CF, kind: SubKind, from: Pos, rng: RNG, defended = false) {
  rs(f, s).subAttempts++;
  const posB: Record<string, number> = { back: 0.25, mount: 0.1, side: 0.05, guard: -0.05, half: -0.05, clinch: -0.08, standing: 0.05 };
  const p = (0.42 + ((f.a.subOffense * 0.5 + f.a.bjj * 0.5) * fm(f) - (o.a.subDefense * 0.6 + o.a.posAwareness * 0.4) * fm(o)) / 130 + (posB[from] ?? 0)) * (defended ? 0.55 : 1);
  if (!rng.chance(clamp(p, 0.08, 0.92))) {
    // failed entry → positional consequence
    if (kind === 'armbar' && from === 'mount') { s.pos = 'guard'; emit(s, { type: 'pos', i: o.idx, text: `${o.setup.short} pulls free of the armbar and ends in guard` }); }
    else if (kind === 'triangle') { s.pos = 'half'; emit(s, { type: 'pos', i: o.idx, text: `${o.setup.short} postures out and passes to half guard` }); }
    else if (kind === 'guillotine' && (from === 'clinch' || from === 'standing')) {
      s.pos = 'guard'; s.top = o.idx; pinTogether(s);
      emit(s, { type: 'pos', i: o.idx, text: `${o.setup.short} pops his head out and lands on top` });
    } else emit(s, { type: 'text', i: o.idx, text: `${o.setup.short} defends the ${SUB_NAME[kind].toLowerCase()}` });
    return;
  }
  if (from === 'standing') {
    s.pos = 'guard';
    s.top = o.idx; // jumped guillotine: attacker falls to guard bottom
    pinTogether(s);
  }
  setState(f, 'free');
  setState(o, 'free');
  const lock0 = 14 + (f.a.subOffense - o.a.subDefense) / 4 + (from === 'back' ? 10 : 0) + (o.state === 'stun' ? 10 : 0);
  s.sub = { attacker: f.idx, kind, lock: clamp(lock0, 5, 42), escape: 0, t: 0, marker: 0, from: s.pos };
  emit(s, { type: 'sub', i: f.idx, text: `${f.setup.short} locks up ${kind === 'armbar' ? 'an' : 'a'} ${SUB_NAME[kind]}!`, big: true });
}

export function subZoneWidth(f: CF, attacker: boolean) {
  return 0.16 + (attacker ? f.a.subOffense : f.a.subDefense) / 650;
}
export function subMarker(sub: SubState) {
  const ph = (sub.t / 1.15) % 1;
  return ph < 0.5 ? ph * 2 : 2 - ph * 2;
}

function stepSub(s: FightState, intents: [Intent, Intent], dt: number, rng: RNG) {
  const sub = s.sub!;
  sub.t += dt;
  sub.marker = subMarker(sub);
  const A = s.f[sub.attacker], D = s.f[1 - sub.attacker];
  const atk = (A.a.subOffense * 0.5 + A.a.bjj * 0.3 + A.a.strength * 0.2) * fm(A);
  const dfn = (D.a.subDefense * 0.5 + D.a.bjj * 0.2 + D.a.strength * 0.15 + D.a.flexibility * 0.15) * fm(D) * hurt(D);
  sub.lock += Math.max(0, 1.1 + (atk - dfn) / 22 + (sub.kind === 'rnc' ? 0.8 : 0)) * dt;
  sub.escape += Math.max(0.6, 3.3 + (dfn - atk) / 22) * dt;
  spend(A, 2.4 * dt, s);
  spend(D, 3 * dt, s);
  for (const f of [A, D]) {
    const it = intents[f.idx];
    if (!it.press || f.subPressCd > 0) continue;
    f.subPressCd = 0.2;
    const isA = f === A;
    const inZone = Math.abs(sub.marker - 0.5) < subZoneWidth(f, isA) / 2;
    spend(f, 1.5, s);
    if (isA) sub.lock += inZone ? 6 + A.a.subOffense / 16 + planMod(A, 'sub') * 2 : 1.5;
    else sub.escape += inZone ? 8 + D.a.subDefense / 12 : 1.5;
    if (!inZone) spend(f, 3, s);
  }
  rs(A, s).subThreat = Math.max(rs(A, s).subThreat, sub.lock);
  if (sub.lock >= 100) {
    emit(s, { type: 'tap', i: A.idx, text: `${D.setup.short} TAPS!`, big: true });
    finish(s, A.idx, 'SUB', SUB_NAME[sub.kind]);
    return;
  }
  if (sub.escape >= 100 || (sub.t > 15 && sub.lock < 70)) {
    s.sub = null;
    s.lastActivity = s.t;
    const kind = sub.kind;
    if (kind === 'armbar') {
      s.pos = 'guard';
      s.top = D.idx;
    } else if (kind === 'guillotine') {
      s.pos = 'half';
      s.top = D.idx;
    } else if (kind === 'triangle') {
      s.pos = 'guard';
    } else if (kind === 'rnc') {
      s.pos = 'half';
      s.top = A.idx;
    }
    emit(s, { type: 'subescape', i: D.idx, text: `${D.setup.short} escapes the ${SUB_NAME[kind].toLowerCase()}! (${POS_NAME[s.pos]})`, big: true });
  }
}

// ───────────────────────────── movement
function moveStanding(s: FightState, intents: [Intent, Intent], dt: number) {
  const [a, b] = s.f;
  for (let i = 0; i < 2; i++) {
    const f = s.f[i], o = s.f[1 - i], it = intents[i];
    let dx = o.x - f.x, dz = o.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    let spd = 165 * (0.68 + f.a.speed / 160) * (1 - f.legs / 170) * (0.72 + 0.28 * fm(f));
    let lspd = 150 * (0.68 + f.a.agility / 160) * (1 - f.legs / 190) * (0.72 + 0.28 * fm(f));
    let mult = 1;
    if (f.guard !== 'none') mult *= 0.72;
    if (it.power && f.state === 'free') mult *= 1.55 * (0.8 + f.a.explosiveness / 250);
    switch (f.state) {
      case 'free': break;
      case 'attack': mult *= f.phase === 'startup' ? 0.35 : 0.15; break;
      case 'stun': mult *= 0.4; break;
      case 'evade': mult *= 0; break;
      case 'shoot': mult *= 0; break;
      default: mult = 0;
    }
    let fwd = it.fwd, lat = it.lat;
    let vF = fwd * (fwd > 0 ? spd * planMod(f, 'fwd') : spd * 0.92) * mult;
    let vL = lat * lspd * mult;
    // evade step: quick burst in the held direction
    if (f.state === 'evade' && f.stateT < 0.2) {
      if (it.fwd < -0.2) vF = -260;
      else if (Math.abs(it.lat) > 0.2) vL = Math.sign(it.lat) * 230;
    }
    // shooting drives forward
    if (f.state === 'shoot') vF = 210 * (0.7 + f.a.explosiveness / 200);
    // at the cage you can't back up
    if (vF < 0 && atCage(f)) vF *= 0.25;
    f.velFwd = vF;
    f.velLat = vL;
    if (vF > 30) rs(f, s).pressure += dt;
    // lateral = circle around opponent
    const px = -dz, pz = dx;
    f.x += (dx * vF + px * vL) * dt;
    f.z += (dz * vF + pz * vL) * dt;
    clampToCage(f);
  }
  // body collision
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  const minD = 50;
  if (d < minD) {
    const push = (minD - d) / 2;
    a.x -= (dx / d) * push; a.z -= (dz / d) * push;
    b.x += (dx / d) * push; b.z += (dz / d) * push;
    clampToCage(a); clampToCage(b);
  }
}

function moveClinch(s: FightState, intents: [Intent, Intent], dt: number, rng: RNG) {
  const c = s.f[s.top], o = s.f[1 - s.top];
  const ic = intents[c.idx], io = intents[o.idx];
  rs(c, s).controlSec += dt * 0.5;
  // controller pushes opponent toward the fence
  let dx = o.x - c.x, dz = o.z - c.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  let drive = Math.max(0, ic.fwd) * 70 - Math.max(0, io.fwd) * 45;
  if (drive > 0 && c.state === 'free') {
    c.x += dx * drive * dt; c.z += dz * drive * dt;
    o.x += dx * drive * dt; o.z += dz * drive * dt;
    spend(c, 3 * dt, s);
    clampToCage(o); clampToCage(c);
    pinTogether(s, 46);
  }
  // pivot
  const lat = ic.lat || io.lat * 0.5;
  if (lat) {
    const mx = (c.x + o.x) / 2, mz = (c.z + o.z) / 2;
    const ang = lat * 0.9 * dt;
    for (const f of s.f) {
      const rx = f.x - mx, rz = f.z - mz;
      f.x = mx + rx * Math.cos(ang) - rz * Math.sin(ang);
      f.z = mz + rx * Math.sin(ang) + rz * Math.cos(ang);
      clampToCage(f);
    }
  }
  // control swap when the controlled fighter fights for underhooks
  s.clinchSwapT += dt;
  if (s.clinchSwapT > 1) {
    s.clinchSwapT = 0;
    if (io.fwd > 0.3 && o.state === 'free') {
      const p = 0.25 + (o.a.clinch * 0.6 + o.a.strength * 0.4 - (c.a.clinch * 0.6 + c.a.strength * 0.4)) / 140;
      spend(o, 3, s);
      if (rng.chance(clamp(p, 0.05, 0.7))) {
        s.top = o.idx;
        emit(s, { type: 'pos', i: o.idx, text: `${o.setup.short} wins the underhooks and reverses position` });
      }
    }
  }
  for (const f of s.f) { f.velFwd = 0; f.velLat = 0; }
  if (s.t - s.lastActivity > 8) toStanding(s, 110, 'Referee separates them');
}

function stepGroundPassive(s: FightState, intents: [Intent, Intent], dt: number) {
  rs(s.f[s.top], s).controlSec += dt;
  for (const f of s.f) { f.velFwd = 0; f.velLat = 0; }
  if (s.t - s.lastActivity > 11) toStanding(s, 120, 'Referee stands them up — inactivity');
}

// ───────────────────────────── rounds & outcomes
export function roundImpact(st: RoundStats, judge: { ws: number; wg: number }) {
  const strike = st.damageDealt * 1.0 + st.sigLanded * 0.55 + st.knockdowns * 20;
  const grapple = st.tdLanded * 5 + st.controlSec * 0.22 + st.subThreat / 4 + st.reversals * 4;
  return strike * judge.ws + grapple * judge.wg + st.pressure * 0.04;
}

export function scoreRound(s: FightState, round: number, rng: RNG): [number, number][] {
  const out: [number, number][] = [];
  const a = s.f[0].rounds[round - 1] ?? newRoundStats();
  const b = s.f[1].rounds[round - 1] ?? newRoundStats();
  for (const j of s.judges) {
    const sa = roundImpact(a, j) * rng.range(0.9, 1.1);
    const sb = roundImpact(b, j) * rng.range(0.9, 1.1);
    const tot = sa + sb;
    if (Math.abs(sa - sb) < Math.max(0.4, tot * 0.006)) out.push([10, 10]);
    else {
      const win = sa > sb ? 0 : 1;
      const ws = win === 0 ? a : b, ls = win === 0 ? b : a;
      const kdDiff = ws.knockdowns - ls.knockdowns;
      const dW = ws.damageDealt, dL = ls.damageDealt;
      // 10-8 needs real damage dominance (knockdowns / lopsided damage), not just control
      const tenEight = kdDiff >= 2 || (kdDiff >= 1 && dW > 2.5 * dL && dW - dL > 40) || (dW > 4 * dL && dW - dL > 65) || (ws.subThreat >= 90 && dW > 2 * dL && kdDiff >= 1);
      const loser = tenEight ? 8 : 9;
      out.push(win === 0 ? [10, loser] : [loser, 10]);
    }
  }
  return out;
}

function endRound(s: FightState) {
  const rng = new RNG(s.rng);
  s.sub = null;
  const cards = scoreRound(s, s.round, rng);
  s.roundCards.push({ round: s.round, cards });
  s.rng = rng.state;
  emit(s, { type: 'bell', i: -1, text: `End of round ${s.round}` });
  if (s.round >= s.cfg.rounds) {
    decide(s);
  } else {
    s.phase = 'roundOver';
    s.phaseT = 0;
  }
}

export function totals(s: FightState, i: number): [number, number][] {
  const tot: [number, number][] = [[0, 0], [0, 0], [0, 0]];
  for (const rc of s.roundCards) rc.cards.forEach((c, j) => { tot[j][0] += c[0]; tot[j][1] += c[1]; });
  return i === 0 ? tot : tot.map(([a, b]) => [b, a]);
}

function decide(s: FightState) {
  const tot = totals(s, 0);
  let w0 = 0, w1 = 0;
  for (const [a, b] of tot) { if (a > b) w0++; else if (b > a) w1++; }
  let winner = -1;
  let method: Method = 'DRAW';
  if (w0 >= 2 || w1 >= 2) {
    winner = w0 >= 2 ? 0 : 1;
    const wins = Math.max(w0, w1), losses = Math.min(w0, w1);
    method = wins === 3 ? 'UD' : losses === 1 ? 'SD' : 'MD';
  }
  s.phase = 'over';
  s.outcome = {
    winner, method, round: s.round, time: '5:00',
    detail: winner === -1 ? 'Draw' : `${method === 'UD' ? 'Unanimous' : method === 'SD' ? 'Split' : 'Majority'} decision`,
    cards: tot,
  };
  emit(s, { type: 'text', i: -1, text: 'The fight goes to the judges' });
}

export function finish(s: FightState, winner: number, method: Method, detail: string) {
  if (s.phase === 'over') return;
  s.sub = null;
  s.phase = 'over';
  s.outcome = { winner, method, round: s.round, time: elapsedString(s), detail, cards: totals(s, 0) };
  for (const f of s.f) if (f.state === 'attack' || f.state === 'grapple') setState(f, 'free');
  setState(s.f[1 - winner], method === 'SUB' ? 'free' : 'down', 99);
  emit(s, { type: 'text', i: winner, text: `${s.f[winner].setup.short} wins by ${method}!`, big: true });
}

/** Corner/round break: recovery depends on Recovery attribute; damage partially persists. */
export function startNextRound(s: FightState) {
  if (s.phase !== 'roundOver') return;
  s.round++;
  s.roundT = 0;
  s.phase = 'intro';
  s.phaseT = 0;
  s.pos = 'standing';
  s.top = -1;
  s.sub = null;
  s.lastActivity = s.t;
  s.f[0].x = -130; s.f[0].z = 0;
  s.f[1].x = 130; s.f[1].z = 0;
  for (const f of s.f) {
    setState(f, 'free');
    f.kdRound = 0;
    f.unanswered = [];
    f.buffer = null;
    f.rounds.push(newRoundStats());
    const rec = f.a.recovery;
    f.deep = Math.max(0, f.deep - (2 + rec / 25));
    f.head = Math.max(0, f.head - (5 + rec / 14));
    f.body = Math.max(0, f.body - (6 + rec / 16));
    f.legs = Math.max(0, f.legs - (4 + rec / 20));
    f.stamina = maxStamina(f);
  }
}

export function forfeit(s: FightState, loser: number, why: string) {
  finish(s, 1 - loser, 'TKO', why);
}

export function sumStats(f: CF) {
  const t = newRoundStats();
  for (const r of f.rounds) for (const k of Object.keys(t) as (keyof RoundStats)[]) t[k] += r[k];
  return t;
}

/** Contextual control list for the UI (what each button does right now). */
export function contextActions(s: FightState, i: number): { key: Button | 'guard' | 'move' | 'low' | 'power'; label: string }[] {
  const top = s.top === i;
  const o = s.f[1 - i];
  if (s.sub) {
    return s.sub.attacker === i
      ? [{ key: 'sub', label: 'Tighten (time it in the zone)' }]
      : [{ key: 'evade', label: 'Fight the hands (time it in the zone)' }];
  }
  if (s.pos === 'standing') {
    const list: { key: any; label: string }[] = [
      { key: 'move', label: 'Move / circle' }, { key: 'jab', label: 'Jab' }, { key: 'cross', label: 'Cross' }, { key: 'hook', label: 'Hook' },
      { key: 'upper', label: 'Uppercut' }, { key: 'body', label: 'Body hook' }, { key: 'lowkick', label: 'Low kick' }, { key: 'bodykick', label: 'Body kick' },
      { key: 'headkick', label: 'Head kick' }, { key: 'teep', label: 'Front kick' }, { key: 'knee', label: 'Knee' }, { key: 'elbow', label: 'Elbow' },
      { key: 'guard', label: 'High guard' }, { key: 'low', label: 'Body guard / check' }, { key: 'evade', label: 'Slip / step' }, { key: 'power', label: 'Power shot / burst' },
      { key: 'clinch', label: 'Clinch' }, { key: 'takedown', label: o.state === 'shoot' ? 'SPRAWL!' : 'Takedown' },
    ];
    if (o.state === 'down') list.unshift({ key: 'advance', label: 'POUNCE on downed opponent' });
    if (o.state === 'sprawled') list.unshift({ key: 'sub', label: 'Guillotine!' });
    return list;
  }
  if (s.pos === 'clinch') {
    return [
      { key: 'jab', label: 'Dirty boxing' }, { key: 'knee', label: 'Knee' }, { key: 'elbow', label: 'Elbow' }, { key: 'takedown', label: 'Trip / throw' },
      { key: 'clinch', label: 'Break clinch' }, { key: 'sub', label: 'Guillotine' }, { key: 'move', label: top ? 'Push to cage' : 'Fight for underhooks (W)' },
      { key: 'guard', label: 'Defend' },
    ];
  }
  const sub = groundSubFor(s, i);
  if (top) {
    const l: { key: any; label: string }[] = [
      { key: 'jab', label: 'Ground punch' }, { key: 'elbow', label: 'Elbow' },
    ];
    if (s.pos !== 'back') l.push({ key: 'advance', label: 'Advance position' });
    if (sub) l.push({ key: 'sub', label: SUB_NAME[sub] });
    if (s.pos === 'guard' || s.pos === 'half') l.push({ key: 'clinch', label: 'Stand up' });
    l.push({ key: 'guard', label: 'Defend / posture' });
    return l;
  }
  const l: { key: any; label: string }[] = [{ key: 'guard', label: 'Defend (cover up)' }, { key: 'jab', label: 'Strike from bottom' }];
  if (s.pos === 'guard') l.push({ key: 'advance', label: 'Stand up' });
  else l.push({ key: 'advance', label: 'Escape / improve' });
  if (s.pos === 'guard' || s.pos === 'half') l.push({ key: 'evade', label: 'Sweep' });
  if (s.pos === 'guard' || s.pos === 'half' || s.pos === 'side') l.push({ key: 'clinch', label: 'Wall-walk / get up' });
  if (sub) l.push({ key: 'sub', label: SUB_NAME[sub] });
  return l;
}
