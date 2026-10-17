// Presentation-only animation layer between the engine's poses and the artwork.
// • Style-specific stances with breathing, weight shifts and guard motion.
// • Smoothing between poses (fast for strikes so timing still matches the engine's hit events).
// • Foot planting: feet stay put on the canvas while the body moves and step when they fall too far behind,
//   so fighters no longer glide. Lateral movement produces small shuffle steps.
// • Hit reactions driven by the engine's own hitFlash / hitTarget fields (no new hits are invented).
// Nothing here is read by the engine.
import { POSES, lerpPose, ease, type Pose, type P } from './poses';
import type { CF } from './engine';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const addP = (p: P, dx: number, dy: number): P => [p[0] + dx, p[1] + dy];

/** Idle/guard stance for a fighter's style, animated over time. */
export function stanceFor(f: CF, t: number, fatigue: number): Pose {
  const style = f.setup.style;
  const ph = f.idx * 1.7 + (f.setup.name.length % 5);
  let s: Pose = { ...POSES.stance };
  const crouch = ['wrestler', 'submission', 'gnp', 'clinch'].includes(style) ? 1 : ['pressure', 'power'].includes(style) ? 0.5 : 0;
  const rangy = ['counter', 'point', 'kickboxer'].includes(style) ? 1 : 0;
  // level & knee bend
  const lower = 4 + crouch * 6;
  s = {
    ...s,
    hip: addP(s.hip, -1, lower), neck: addP(s.neck, 2 + crouch * 3, lower * 0.85), head: addP(s.head, 3 + crouch * 4, lower * 0.8),
    fKnee: addP(s.fKnee, 3 + crouch * 2, lower * 0.6), rKnee: addP(s.rKnee, -2, lower * 0.6),
    fFoot: addP(s.fFoot, crouch * 3 + rangy * 2, 0), rFoot: addP(s.rFoot, -crouch * 3 - rangy * 2, 0),
  };
  // guard shape
  if (crouch) s = { ...s, fElbow: addP(s.fElbow, 6, 14), fHand: addP(s.fHand, 10, 20), rElbow: addP(s.rElbow, 6, 12), rHand: addP(s.rHand, 6, 18) };
  else if (rangy) s = { ...s, fElbow: addP(s.fElbow, 6, 2), fHand: addP(s.fHand, 10, 4), rHand: addP(s.rHand, -2, 0) };
  else if (style === 'pressure' || style === 'power') s = { ...s, fHand: addP(s.fHand, -4, -6), rHand: addP(s.rHand, -2, -4), fElbow: addP(s.fElbow, -2, 0), head: addP(s.head, 1, 2) };
  // breathing, weight shift, bounce, guard motion
  const breathe = Math.sin(t * (2.6 + fatigue * 2.4) + ph) * (1.1 + fatigue * 1.6);
  const shift = Math.sin(t * 1.25 + ph) * 2.2;
  const bounce = rangy ? Math.max(0, Math.sin(t * 6.4 + ph)) * 1.4 : 0;
  const hand = Math.sin(t * 1.9 + ph * 2);
  const up = (p: P, k: number): P => [p[0] + shift * k, p[1] - bounce * k - breathe * (k > 0.6 ? 0.6 : 0)];
  s = {
    ...s,
    hip: [s.hip[0] + shift * 0.6, s.hip[1] - bounce],
    neck: up(s.neck, 0.9), head: [s.head[0] + shift * 0.9 + Math.sin(t * 0.9 + ph) * 0.8, s.head[1] - bounce - breathe * 0.7],
    fElbow: up(s.fElbow, 0.8), rElbow: up(s.rElbow, 0.8),
    fHand: [s.fHand[0] + shift * 0.8 + hand * 1.6, s.fHand[1] - bounce - breathe * 0.4 + hand * 1.2],
    rHand: [s.rHand[0] + shift * 0.8 - hand * 1.0, s.rHand[1] - bounce - breathe * 0.4 - hand * 0.8],
    fKnee: [s.fKnee[0] + shift * 0.4, s.fKnee[1] - bounce * 0.5], rKnee: [s.rKnee[0] + shift * 0.4, s.rKnee[1] - bounce * 0.5],
  };
  // fatigue: hands drop, shoulders slump
  if (fatigue > 0.05) s = lerpPose(s, POSES.stun, Math.min(0.55, fatigue * 0.6));
  return s;
}

/** Additive reactions to engine-reported hits (decays with the engine's own hitFlash timer). */
export function reactTo(f: CF, p: Pose, t: number): Pose {
  let out = p;
  if (f.hitFlash > 0 && f.hitTarget) {
    const k = ease(Math.min(1, f.hitFlash / 0.2));
    if (f.hitTarget === 'head') out = { ...out, head: addP(out.head, -8 * k, 1.5 * k), neck: addP(out.neck, -3.5 * k, 0.5 * k), fHand: addP(out.fHand, -3 * k, 5 * k), rHand: addP(out.rHand, -2 * k, 4 * k) };
    else if (f.hitTarget === 'body') out = { ...out, hip: addP(out.hip, -5 * k, 1 * k), neck: addP(out.neck, 4 * k, 4 * k), head: addP(out.head, 5 * k, 5 * k), fElbow: addP(out.fElbow, -2 * k, 5 * k), rElbow: addP(out.rElbow, -2 * k, 5 * k) };
    else out = { ...out, fKnee: addP(out.fKnee, -2 * k, 6 * k), hip: addP(out.hip, -1 * k, 4 * k), neck: addP(out.neck, 0, 3 * k), head: addP(out.head, 0, 3 * k), fFoot: addP(out.fFoot, -3 * k, 0) };
  }
  if (f.state === 'stun') {
    const w = Math.sin(t * 5.5 + f.idx) * 3.5;
    out = { ...out, head: addP(out.head, w, 0), neck: addP(out.neck, w * 0.6, 0), hip: addP(out.hip, w * 0.25, 2), fKnee: addP(out.fKnee, 0, 2), rKnee: addP(out.rKnee, 0, 2) };
  }
  return out;
}

interface Step { from: number; to: number; t: number; dur: number }

export class FighterAnimator {
  disp: Pose | null = null;
  mode: 'stand' | 'ground' = 'stand';
  plant: [number, number] | null = null; // foot x offsets (pose cm) while planted: [front, rear]
  steps: [Step | null, Step | null] = [null, null];
  lastRoot: [number, number] | null = null;
  vel = 0; // forward speed, cm/s (smoothed)
  sway = 0;
  lastHeadX = 0;
  sinceStep = 0;
  next = 0;

  reset() { this.disp = null; this.plant = null; this.steps = [null, null]; this.lastRoot = null; }

  update(target: Pose, o: { dt: number; mode: 'stand' | 'ground'; f: CF; axis: [number, number]; plant: boolean; fast: boolean; facing: number }): Pose {
    const { dt, f } = o;
    if (o.mode !== this.mode) { this.mode = o.mode; this.plant = null; this.steps = [null, null]; }
    // root velocity along the line to the opponent
    if (this.lastRoot && dt > 0) {
      const dx = f.x - this.lastRoot[0], dz = f.z - this.lastRoot[1];
      const d = dx * o.axis[0] + dz * o.axis[1];
      this.vel += ((d / dt) - this.vel) * Math.min(1, dt * 10);
      if (o.mode === 'stand' && this.plant) { this.plant[0] -= d; this.plant[1] -= d; }
    }
    this.lastRoot = [f.x, f.z];
    // smoothing toward the target pose
    const k = 1 - Math.exp(-dt * (o.fast ? 32 : o.mode === 'ground' ? 12 : 17));
    this.disp = this.disp ? lerpPose(this.disp, target, dt > 0 ? k : 1) : target;
    let p: Pose = { ...this.disp };
    // lean into movement
    if (o.mode === 'stand') {
      const lean = clamp(this.vel * 0.025, -4, 4);
      p = { ...p, head: addP(p.head, lean, 0), neck: addP(p.neck, lean * 0.7, 0) };
    }
    // foot planting
    if (o.mode === 'stand' && o.plant) {
      const rest: [number, number] = [p.fFoot[0], p.rFoot[0]];
      if (!this.plant) this.plant = [...rest];
      this.sinceStep += dt;
      for (const i of [0, 1] as const) {
        const st = this.steps[i];
        if (st) {
          st.t += dt;
          if (st.t >= st.dur) { this.plant[i] = st.to; this.steps[i] = null; }
        }
      }
      const busy = this.steps[0] || this.steps[1];
      const lateral = Math.abs(f.velLat) > 35;
      if (!busy) {
        const err = [this.plant[0] - rest[0], this.plant[1] - rest[1]];
        const worst = Math.abs(err[0]) > Math.abs(err[1]) ? 0 : 1;
        if (Math.abs(err[worst]) > 7 || (lateral && this.sinceStep > 0.3) || (Math.abs(err[worst]) > 2.5 && this.sinceStep > 0.6)) {
          const i = lateral && Math.abs(err[worst]) <= 7 ? (this.next = 1 - this.next) : worst;
          const lead = clamp(this.vel * 0.06, -5, 5);
          this.steps[i] = { from: this.plant[i], to: rest[i] + lead, t: 0, dur: 0.15 + Math.min(0.08, Math.abs(err[i]) / 200) };
          this.sinceStep = 0;
        }
      }
      const footX = (i: 0 | 1) => { const st = this.steps[i]; return st ? st.from + (st.to - st.from) * ease(st.t / st.dur) : this.plant![i]; };
      const lift = (i: 0 | 1) => { const st = this.steps[i]; return st ? Math.sin(Math.PI * Math.min(1, st.t / st.dur)) * (lateral ? 3 : 5) : 0; };
      const fx = footX(0), rx = footX(1);
      p = {
        ...p,
        fFoot: [fx, p.fFoot[1] - lift(0)], rFoot: [rx, p.rFoot[1] - lift(1)],
        fKnee: [p.fKnee[0] + (fx - rest[0]) * 0.5, p.fKnee[1] - lift(0) * 0.6],
        rKnee: [p.rKnee[0] + (rx - rest[1]) * 0.5, p.rKnee[1] - lift(1) * 0.6],
      };
    } else {
      this.plant = null; this.steps = [null, null];
    }
    // hair sway from head motion
    const hx = p.head[0] * o.facing;
    const hv = dt > 0 ? (hx - this.lastHeadX) / dt : 0;
    this.lastHeadX = hx;
    this.sway += (clamp(-hv * 0.004, -0.45, 0.45) - this.sway) * Math.min(1, dt * 6);
    return p;
  }
}
