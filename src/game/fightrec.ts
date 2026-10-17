// Fight recording: deterministic replay data, key-moment timeline, momentum trends and mid-fight
// checkpoints. Purely observational — it never changes how the combat engine resolves anything.
//
// Replay model: the engine and AI are deterministic given (state, intents, dt). We store a keyframe
// (serialized fight + AI) at the opening bell and at the start of every round, plus the player's intent
// stream (only when it changes). A highlight is replayed by restoring the round keyframe and re-simulating
// up to shortly before the moment, then playing it back in real time.
import { storage } from './storage';
import { step, roundImpact, NO_INTENT, type FightState, type Intent, type FightEvent } from '../combat/engine';
import { AIController, restoreAI, serializeAI } from '../combat/ai';
import { decodeSave, encodeSave } from './save';

export const DT = 1 / 60;
export const CHECKPOINT_TICKS = 300; // ~5 seconds of fight time

export type IntentRec = [number, number, number, number, number, string | null]; // tick, fwd, lat, guard(0 none,1 high,2 low), power, press
export interface Keyframe { tick: number; round: number; fight: string; ai: Record<string, any> }
export interface Moment { tick: number; round: number; clock: string; text: string; kind: string; side: number }
export interface TrendPoint { t: number; ps: number; os: number; ph: number; oh: number }

export interface ReplayData { v: 1; keyframes: Keyframe[]; log: IntentRec[]; moments: Moment[]; endTick: number }

const G = ['none', 'high', 'low'] as const;
const encIntent = (tick: number, i: Intent): IntentRec => [tick, i.fwd, i.lat, G.indexOf(i.guard as any), i.power ? 1 : 0, i.press ?? null];
const decIntent = (r: IntentRec): Intent => ({ fwd: r[1], lat: r[2], guard: G[r[3]] ?? 'none', power: !!r[4], press: (r[5] as any) ?? null });
const sameIntent = (a: IntentRec | undefined, b: IntentRec) => !!a && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === null && b[5] === null;

export function clockOf(s: FightState) {
  const left = Math.max(0, s.cfg.roundSeconds - s.roundT);
  // display in "fight minutes": real round length scaled to a 5:00 round
  const secs = Math.round((left / s.cfg.roundSeconds) * 300);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

const MOMENT_KINDS = new Set(['ko', 'tap', 'kd', 'stun', 'sub', 'subescape', 'td', 'counter']);

export class FightRecorder {
  keyframes: Keyframe[] = [];
  log: IntentRec[] = [];
  moments: Moment[] = [];
  trends: TrendPoint[] = [];
  private lastTrend = -99;

  keyframe(s: FightState, ai: AIController) {
    const tick = s.tick ?? 0;
    this.keyframes = this.keyframes.filter((k) => k.tick !== tick);
    this.keyframes.push({ tick, round: s.round, fight: JSON.stringify({ ...s, events: [] }), ai: serializeAI(ai) });
  }

  /** Call with the player's intent immediately before step(). */
  intent(s: FightState, i: Intent) {
    const r = encIntent(s.tick ?? 0, i);
    if (!sameIntent(this.log[this.log.length - 1], r)) this.log.push(r);
  }

  /** Call with the events emitted by a step. */
  events(evs: FightEvent[], s: FightState) {
    for (const e of evs) {
      if (!MOMENT_KINDS.has(e.type)) continue;
      if ((e.type === 'td' || e.type === 'counter') && !e.big && e.type !== 'td') continue;
      if (e.type === 'counter' && !e.big) continue;
      const text = e.text ?? e.type.toUpperCase();
      // collapse duplicates in the same second (e.g. kd + stun)
      const last = this.moments[this.moments.length - 1];
      if (last && (s.tick ?? 0) - last.tick < 40 && last.side === e.i && (last.kind === 'kd' || last.kind === 'ko') && e.type === 'stun') continue;
      this.moments.push({ tick: s.tick ?? 0, round: s.round, clock: clockOf(s), text, kind: e.type, side: e.i });
    }
    if (this.moments.length > 80) this.moments.splice(0, this.moments.length - 80);
  }

  sample(s: FightState) {
    if (s.phase !== 'live' || s.t - this.lastTrend < 8) return;
    this.lastTrend = s.t;
    let ps = 0, os = 0;
    for (let r = 0; r < s.round; r++) { ps += s.f[0].rounds[r]?.sigLanded ?? 0; os += s.f[1].rounds[r]?.sigLanded ?? 0; }
    this.trends.push({ t: Math.round(s.t), ps, os, ph: Math.round(s.f[0].head), oh: Math.round(s.f[1].head) });
    if (this.trends.length > 120) this.trends.shift();
  }

  replay(s: FightState): ReplayData {
    return { v: 1, keyframes: this.keyframes, log: this.log, moments: this.moments, endTick: s.tick ?? 0 };
  }

  toJSON() { return { keyframes: this.keyframes, log: this.log, moments: this.moments, trends: this.trends, lastTrend: this.lastTrend }; }
  static from(o: any): FightRecorder {
    const r = new FightRecorder();
    if (o) { r.keyframes = o.keyframes ?? []; r.log = o.log ?? []; r.moments = o.moments ?? []; r.trends = o.trends ?? []; r.lastTrend = o.lastTrend ?? -99; }
    return r;
  }
}

/** Per-round summary used by the results screen. */
export function roundSummaries(s: FightState) {
  const pick = (r: any) => ({ sig: r.sigLanded, thrown: r.sigThrown, head: r.headLanded, body: r.bodyLanded, legs: r.legLanded, kd: r.knockdowns, td: r.tdLanded, ctrl: Math.round(r.controlSec), sub: r.subAttempts, dmg: Math.round(r.damageDealt), impact: Math.round(roundImpact(r, { ws: 1, wg: 1 })) });
  const out: { p: Record<string, number>; o: Record<string, number> }[] = [];
  for (let i = 0; i < s.round; i++) if (s.f[0].rounds[i] && s.f[1].rounds[i]) out.push({ p: pick(s.f[0].rounds[i]), o: pick(s.f[1].rounds[i]) });
  return out;
}

// ── Replay simulation ────────────────────────────────────────────────────────────────

export interface ReplaySim { fight: FightState; ai: AIController; idx: number; cur: Intent; data: ReplayData }

/** Restore the keyframe at or before `tick`. */
export function replayStart(data: ReplayData, tick: number): ReplaySim {
  const kfs = data.keyframes.filter((k) => k.tick <= tick).sort((a, b) => a.tick - b.tick);
  const kf = kfs[kfs.length - 1] ?? data.keyframes[0];
  const fight = JSON.parse(kf.fight) as FightState;
  const ai = restoreAI(kf.ai);
  // intent in force at the keyframe
  let idx = 0, cur: Intent = NO_INTENT;
  while (idx < data.log.length && data.log[idx][0] < kf.tick) { cur = decIntent(data.log[idx]); idx++; }
  if (cur.press) cur = { ...cur, press: null }; // a press is only valid for the tick it was logged on
  return { fight, ai, idx, cur, data };
}

/** Advance the replay by one tick. Returns false when the fight has ended or reached a round break. */
export function replayStep(r: ReplaySim): boolean {
  const s = r.fight;
  if (s.phase === 'over' || s.phase === 'roundOver') return false;
  const t = s.tick ?? 0;
  let pi: Intent = r.cur.press ? { ...r.cur, press: null } : r.cur;
  while (r.idx < r.data.log.length && r.data.log[r.idx][0] === t) { pi = decIntent(r.data.log[r.idx]); r.idx++; }
  r.cur = pi;
  s.events.length = 0;
  step(s, [pi, r.ai.think(s, DT)], DT);
  return true;
}

export function replayTo(r: ReplaySim, tick: number, maxSteps = 60 * 60 * 30) {
  let n = 0;
  while ((r.fight.tick ?? 0) < tick && n++ < maxSteps && replayStep(r)) { /* fast-forward */ }
}

// ── Storage (kept out of the main save to keep it small) ───────────────────────────────

const ckKey = (slot: number) => `fightcamp.fight.${slot}`;
const rpKey = (slot: number) => `fightcamp.replay.${slot}`;

export interface Checkpoint { offerId: string; savedAt: number; fight: string; ai: Record<string, any>; rec: any; plan: string; log: { t: string; c: string }[] }

export function writeCheckpoint(slot: number, c: Checkpoint): boolean {
  try { storage.setItem(ckKey(slot), encodeSave(JSON.stringify(c))); return true; } catch { return false; }
}
export function readCheckpoint(slot: number, offerId: string): Checkpoint | null {
  try {
    const raw = storage.getItem(ckKey(slot));
    if (!raw) return null;
    const c = JSON.parse(decodeSave(raw)) as Checkpoint;
    return c.offerId === offerId ? c : null;
  } catch { return null; }
}
export function clearCheckpoint(slot: number) { try { storage.removeItem(ckKey(slot)); } catch { /* ignore */ } }

export function writeReplay(slot: number, id: string, d: ReplayData): boolean {
  try { storage.setItem(rpKey(slot), encodeSave(JSON.stringify({ id, d }))); return true; } catch { return false; }
}
export function readReplay(slot: number, id: string): ReplayData | null {
  try {
    const raw = storage.getItem(rpKey(slot));
    if (!raw) return null;
    const o = JSON.parse(decodeSave(raw));
    return o.id === id ? o.d : null;
  } catch { return null; }
}
export function clearFightStorage(slot: number) { clearCheckpoint(slot); try { storage.removeItem(rpKey(slot)); } catch { /* ignore */ } }
