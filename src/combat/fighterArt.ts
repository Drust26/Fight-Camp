// Fighter artwork for the canvas renderer.
//
// The combat engine and pose system describe each fighter as 11 joints (head, neck, hip, elbows, hands, knees,
// feet). This module turns those joints into an athletic body: tapered, shaded muscle segments, a sculpted torso,
// a head with facial features, hair and facial hair in a head-local frame, tattoos clipped to the body part they
// belong to, MMA gloves, shorts and feet. It only draws — it never changes the fight.
//
// Frames: every attached item (hair, beard, tattoos, shorts patterns) is drawn inside the transform of its body part,
// so it moves, rotates and mirrors with that part and cannot slide across the skin.
import type { Look, Tattoo, TattooRegion } from '../game/look';

export type V = [number, number];
export interface Joints {
  head: V; neck: V; hip: V;
  fElbow: V; fHand: V; rElbow: V; rHand: V;
  fKnee: V; fFoot: V; rKnee: V; rFoot: V;
}
export interface ArtOpts {
  sc: number; // pixels per cm
  facing: 1 | -1;
  look: Look;
  flipFront?: boolean; // lying on the back in ground scenes
  hit?: number; // 0..1 recent hit flash
  headDamage?: number; // 0..100
  eyesClosed?: boolean;
  sway?: number; // hair sway, radians
  standing?: boolean; // draw foot contact shadows
  light?: number; // arena light multiplier
  top?: 'none' | 'tee' | 'hoodie' | 'jacket' | 'robe'; // walkout clothing (portraits / presentation only)
}

// ───────────────────────── small vector & colour helpers
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const len = (a: V) => Math.hypot(a[0], a[1]) || 1e-6;
const norm = (a: V): V => { const l = len(a); return [a[0] / l, a[1] / l]; };
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const perp = (a: V): V => [-a[1], a[0]];

const rgbCache = new Map<string, [number, number, number]>();
function rgb(c: string): [number, number, number] {
  const hit = rgbCache.get(c);
  if (hit) return hit;
  let out: [number, number, number];
  if (c.startsWith('#')) { const n = parseInt(c.slice(1, 7), 16); out = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  else { const m = c.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']; out = [Number(m[0]), Number(m[1]), Number(m[2])]; }
  if (out.some((v) => !isFinite(v))) out = [128, 128, 128];
  if (rgbCache.size > 500) rgbCache.clear();
  rgbCache.set(c, out);
  return out;
}
/** amt > 0 lightens toward white, amt < 0 darkens; warm=true tints shadows slightly red like skin. */
export function tone(hex: string, amt: number, alpha = 1, warm = false) {
  let [r, g, b] = rgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b);
  if (warm && amt < 0) { r = Math.min(255, r + 10 * -amt * 3); b = Math.max(0, b - 6 * -amt * 3); }
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** Reduced-cost shading (flat fills + one highlight) used when the renderer detects slow frames. */
let LITE = false;
export function setArtLite(v: boolean) { LITE = v; }

// light comes from above the cage, slightly from the camera side
const LIGHT: V = norm([0.25, -1]);

/** Tapered segment outline from A to B with separate left/right width profiles (start, middle, end). */
function segPath(A: V, B: V, wl: [number, number, number], wr: [number, number, number], caps: [number, number] = [1, 1]): Path2D {
  const d = norm(sub(B, A)), n = perp(d);
  const at = (t: number, w: number, side: 1 | -1) => add(lerp(A, B, t), mul(n, side * w / 2));
  const p = new Path2D();
  const AL = at(0, wl[0], 1), BL = at(1, wl[2], 1), AR = at(0, wr[0], -1), BR = at(1, wr[2], -1);
  p.moveTo(AL[0], AL[1]);
  const c1 = at(0.3, (wl[0] + wl[1] * 2) / 3 * 1.06, 1), c2 = at(0.68, (wl[1] * 2 + wl[2]) / 3 * 1.04, 1);
  p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], BL[0], BL[1]);
  const capB = add(B, mul(d, (wl[2] + wr[2]) * 0.3 * caps[1]));
  p.quadraticCurveTo(capB[0], capB[1], BR[0], BR[1]);
  const c3 = at(0.68, (wr[1] * 2 + wr[2]) / 3 * 1.04, -1), c4 = at(0.3, (wr[0] + wr[1] * 2) / 3 * 1.06, -1);
  p.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], AR[0], AR[1]);
  const capA = add(A, mul(d, -(wl[0] + wr[0]) * 0.3 * caps[0]));
  p.quadraticCurveTo(capA[0], capA[1], AL[0], AL[1]);
  p.closePath();
  return p;
}

/** Cylindrical shading across a segment: lit edge → base → core shadow → faint bounce light. */
function shadeSeg(ctx: CanvasRenderingContext2D, path: Path2D, A: V, B: V, w: number, base: string, light: number, warm = true, gloss = 0) {
  if (LITE) { ctx.fillStyle = base; ctx.fill(path); return; }
  const d = norm(sub(B, A));
  let n = perp(d);
  if (n[0] * LIGHT[0] + n[1] * LIGHT[1] > 0) n = mul(n, -1); // n points toward the light
  const m = lerp(A, B, 0.5);
  const g = ctx.createLinearGradient(m[0] + n[0] * w / 2, m[1] + n[1] * w / 2, m[0] - n[0] * w / 2, m[1] - n[1] * w / 2);
  g.addColorStop(0, tone(base, 0.16 * light + gloss, 1, warm));
  g.addColorStop(0.18 + gloss * 0.3, tone(base, 0.06 * light + gloss * 0.5, 1, warm));
  g.addColorStop(0.5, base);
  g.addColorStop(0.86, tone(base, -0.3, 1, warm));
  g.addColorStop(1, tone(base, -0.18, 1, warm));
  ctx.fillStyle = g;
  ctx.fill(path);
}

function catmull(points: V[], closed = true): Path2D {
  const p = new Path2D();
  const n = points.length;
  const P = (i: number) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1: V = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: V = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  if (closed) p.closePath();
  return p;
}

// ───────────────────────── body measurements (cm) from the look
function dims(look: Look) {
  const b = look.body;
  const mus = 0.88 + b.muscle * 0.2;
  const bulk = 0.86 + b.build * 0.3;
  const torsoK = b.torso === 'v' ? { lat: 1.08, waist: 0.9, belly: 0 } : b.torso === 'thick' ? { lat: 1.04, waist: 1.12, belly: 1.5 + b.build * 2.5 } : { lat: 1, waist: 1, belly: b.build * 0.8 };
  return {
    arm: bulk * 0.55 + mus * 0.45 + (b.limbs - 0.5) * 0.08,
    leg: bulk * 0.6 + mus * 0.4 + (b.limbs - 0.5) * 0.08,
    chest: 0.82 + b.build * 0.24 + b.muscle * 0.12,
    shoulders: 0.88 + b.shoulders * 0.26,
    hips: 0.94 + b.build * 0.12,
    neck: 0.88 + b.build * 0.18 + b.muscle * 0.08,
    ...torsoK,
    muscle: b.muscle,
  };
}

// ───────────────────────── torso frame
interface Frame { o: V; u: V; n: V; L: number; sc: number }
const fp = (f: Frame, s: number, ncm: number): V => add(add(f.o, mul(f.u, s * f.L)), mul(f.n, ncm * f.sc));

function torsoPoints(f: Frame, D: ReturnType<typeof dims>): { front: V[]; back: V[] } {
  const front: [number, number][] = [
    [0.03, 5.5], [0.12, 9.2 * D.shoulders], [0.24, 12.8 * D.chest], [0.37, 13.6 * D.chest], [0.49, 10.6 * D.waist + D.belly * 0.3],
    [0.63, 9.8 * D.waist + D.belly], [0.78, 10.3 * D.waist + D.belly * 0.8], [0.92, 11 * D.hips], [1.04, 10.8 * D.hips],
  ];
  const back: [number, number][] = [
    [1.04, -10.5 * D.hips], [0.9, -11.6 * D.hips], [0.74, -9.4 * D.waist], [0.54, -11 * D.lat], [0.34, -12.8 * D.lat * D.shoulders], [0.15, -11.8 * D.shoulders], [0.04, -7.5], [-0.02, -4],
  ];
  return { front: front.map(([s, n]) => fp(f, s, n)), back: back.map(([s, n]) => fp(f, s, n)) };
}

// ───────────────────────── main entry
export function drawFighterArt(ctx: CanvasRenderingContext2D, J: Joints, o: ArtOpts) {
  const { sc, look } = o;
  const D = dims(look);
  const skin = look.skin;
  const light = o.light ?? 1;
  const cm = (v: number) => v * sc;
  const u = norm(sub(J.hip, J.neck));
  let n: V = mul([u[1], -u[0]], o.facing);
  if (o.flipFront) n = mul(n, -1);
  const tf: Frame = { o: J.neck, u, n, L: len(sub(J.hip, J.neck)), sc };
  const ground = !o.standing;

  // shoulder & hip sockets
  const sNear = fp(tf, 0.13, 1.5), sFar = fp(tf, 0.11, -2.5);
  const hNear = fp(tf, 0.95, 2.5), hFar = fp(tf, 0.93, -3.5);

  // contact shadows under the feet
  if (o.standing) {
    for (const ft of [J.rFoot, J.fFoot]) {
      const h = Math.max(0, (J.hip[1] - ft[1]));
      void h;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath(); ctx.ellipse(ft[0] + o.facing * cm(5), ft[1] + cm(0.8), cm(11), cm(2.2), 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  const DIM = 0.2;
  // ── far side: leg, shorts leg, arm (drawn darker: they are in the body's shadow)
  const farLeg = drawLeg(ctx, hFar, J.rKnee, J.rFoot, D, tone(skin, -DIM, 1, true), sc, o.facing, light);
  drawTattoosOn(ctx, look.tattoos, ['rearThigh', 'rearCalf'], farLeg.parts, skin, sc);
  drawShortsLeg(ctx, hFar, J.rKnee, D, look, sc, 'far', light, DIM);
  const farArm = drawArm(ctx, sFar, J.rElbow, J.rHand, D, tone(skin, -DIM, 1, true), sc, light);
  drawTattoosOn(ctx, look.tattoos, ['rearUpperArm', 'rearForearm'], farArm.parts, skin, sc);
  if (o.top && o.top !== 'none') drawSleeves(ctx, sFar, J.rElbow, J.rHand, D, look, sc, o.top, DIM);
  drawGlove(ctx, J.rElbow, J.rHand, look, sc, light, DIM);
  if (o.top === 'hoodie' || o.top === 'robe') drawHood(ctx, tf, look, sc);

  // ── torso
  const tp = torsoPoints(tf, D);
  const torso = catmull([...tp.front, ...tp.back]);
  {
    // one fill for the form shading (back in shadow → lit front), one for the broad highlight from above
    const b0 = fp(tf, 0.45, -14), b1 = fp(tf, 0.45, 13);
    const gb = ctx.createLinearGradient(b0[0], b0[1], b1[0], b1[1]);
    gb.addColorStop(0, tone(skin, -0.38, 1, true)); gb.addColorStop(0.3, tone(skin, -0.14, 1, true)); gb.addColorStop(0.62, skin); gb.addColorStop(1, tone(skin, -0.08, 1, true));
    ctx.fillStyle = gb; ctx.fill(torso);
    const hl = fp(tf, 0.22, 7);
    const g = ctx.createRadialGradient(hl[0], hl[1], cm(2), hl[0], hl[1], cm(30));
    g.addColorStop(0, tone(skin, 0.17 * light, 0.95)); g.addColorStop(0.5, tone(skin, 0, 0)); ctx.fillStyle = g; ctx.fill(torso);
  }
  ctx.save(); ctx.clip(torso);
  {
    // anatomy: pecs, abs, obliques, spine, collarbone
    const m = D.muscle;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tone(skin, -0.42, 0.35 + m * 0.25, true); ctx.lineWidth = cm(0.9);
    line(ctx, catmullOpen([fp(tf, 0.39, 12.4 * D.chest), fp(tf, 0.4, 7), fp(tf, 0.34, 1.5)]));
    if (m > 0.3) {
      ctx.strokeStyle = tone(skin, -0.38, 0.12 + m * 0.3, true); ctx.lineWidth = cm(0.6);
      for (const s of [0.53, 0.63, 0.73]) line(ctx, catmullOpen([fp(tf, s, 9.6 * D.waist + D.belly * 0.6), fp(tf, s - 0.008, 6.5), fp(tf, s + 0.005, 4.4)]));
      line(ctx, catmullOpen([fp(tf, 0.47, 7.8), fp(tf, 0.65, 7.4), fp(tf, 0.83, 8)]));
      ctx.strokeStyle = tone(skin, -0.35, 0.18 + m * 0.2, true);
      line(ctx, catmullOpen([fp(tf, 0.44, 1), fp(tf, 0.6, 3), fp(tf, 0.82, 7.5)])); // oblique / serratus edge
    }
    ctx.strokeStyle = tone(skin, 0.3, 0.22 * light); ctx.lineWidth = cm(0.8);
    line(ctx, catmullOpen([fp(tf, 0.06, 4), fp(tf, 0.1, 7.5), fp(tf, 0.13, 9)])); // collarbone highlight
    ctx.strokeStyle = tone(skin, -0.4, 0.28, true); ctx.lineWidth = cm(0.7);
    line(ctx, catmullOpen([fp(tf, 0.12, -8.5), fp(tf, 0.3, -9.2), fp(tf, 0.5, -7)])); // shoulder blade
    ctx.fillStyle = tone(skin, -0.45, 0.6, true);
    const nip = fp(tf, 0.355, 11.8 * D.chest); ctx.beginPath(); ctx.arc(nip[0], nip[1], cm(0.55), 0, Math.PI * 2); ctx.fill();
    if (!ground) { const nav = fp(tf, 0.8, 9.6 * D.waist + D.belly * 0.75); ctx.fillStyle = tone(skin, -0.5, 0.55, true); ctx.beginPath(); ctx.ellipse(nav[0], nav[1], cm(0.35), cm(0.6), 0, 0, Math.PI * 2); ctx.fill(); }
    drawTattoosTorso(ctx, look.tattoos, tf, D, skin);
  }
  ctx.restore();
  ctx.strokeStyle = tone(skin, -0.5, 0.35, true); ctx.lineWidth = Math.max(0.6, cm(0.25)); ctx.stroke(torso);

  // ── near leg, shorts (waist drawn last so it covers both leg openings)
  const nearLeg = drawLeg(ctx, hNear, J.fKnee, J.fFoot, D, skin, sc, o.facing, light);
  drawTattoosOn(ctx, look.tattoos, ['leadThigh', 'leadCalf'], nearLeg.parts, skin, sc);
  drawShortsWaist(ctx, tf, D, look, sc, light);
  drawShortsLeg(ctx, hNear, J.fKnee, D, look, sc, 'near', light, 0);
  drawWaistband(ctx, tf, D, look, sc);
  if (o.top && o.top !== 'none') drawTopTorso(ctx, tf, D, look, sc, o.top);

  // ── neck
  const headBase = add(J.head, mul(norm(sub(J.neck, J.head)), cm(7.5)));
  const neckBase = fp(tf, 0.06, 0.5);
  const nw = 12.5 * D.neck;
  const neckPath = segPath(headBase, neckBase, [cm(nw * 0.82), cm(nw), cm(nw * 1.3)], [cm(nw * 0.82), cm(nw), cm(nw * 1.3)]);
  shadeSeg(ctx, neckPath, headBase, neckBase, cm(nw), skin, light);
  ctx.save(); ctx.clip(neckPath);
  {
    const g = ctx.createLinearGradient(headBase[0], headBase[1], lerp(headBase, neckBase, 0.6)[0], lerp(headBase, neckBase, 0.6)[1]);
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fill(neckPath); // shadow under the jaw
    const nt = look.tattoos.filter((t) => t.region === 'neck');
    for (const t of nt) drawTattooInSeg(ctx, t, headBase, neckBase, cm(nw), skin, sc);
  }
  ctx.restore();


  // ── head
  drawHead(ctx, J.head, J.neck, n, o);

  // ── near arm
  const nearArm = drawArm(ctx, sNear, J.fElbow, J.fHand, D, skin, sc, light);
  drawTattoosOn(ctx, look.tattoos, ['leadUpperArm', 'leadForearm'], nearArm.parts, skin, sc);
  if (o.top && o.top !== 'none') drawSleeves(ctx, sNear, J.fElbow, J.fHand, D, look, sc, o.top, 0);
  drawGlove(ctx, J.fElbow, J.fHand, look, sc, light, 0);

  // hit flash: warm flush over the whole silhouette area that was struck
  if (o.hit && o.hit > 0.02) {
    ctx.fillStyle = `rgba(255,70,50,${0.22 * o.hit})`;
    ctx.beginPath(); ctx.arc(J.head[0], J.head[1], cm(13), 0, Math.PI * 2); ctx.fill();
  }
}

function line(ctx: CanvasRenderingContext2D, p: Path2D) { ctx.stroke(p); }
function catmullOpen(pts: V[]) { return catmull(pts, false); }

// ───────────────────────── limbs
interface Part { region: string; A: V; B: V; w: number; path: Path2D; t0: number; t1: number }

function drawArm(ctx: CanvasRenderingContext2D, S: V, E: V, H: V, D: ReturnType<typeof dims>, skin: string, sc: number, light: number) {
  const cm = (v: number) => v * sc;
  const a = D.arm;
  const dir = norm(sub(H, E));
  const W = sub(H, mul(dir, cm(5))); // wrist (glove starts here)
  // deltoid cap
  const delt = new Path2D(); delt.ellipse(lerp(S, E, 0.12)[0], lerp(S, E, 0.12)[1], cm(7.6 * a * D.shoulders), cm(6.6 * a), Math.atan2(E[1] - S[1], E[0] - S[0]), 0, Math.PI * 2, true);
  const upper = segPath(S, E, [cm(14 * a), cm(13.6 * a), cm(9 * a)], [cm(13.4 * a), cm(12 * a), cm(8.8 * a)]);
  const fore = segPath(E, W, [cm(9.6 * a), cm(10.6 * a), cm(6.8 * a)], [cm(9.4 * a), cm(9.4 * a), cm(6.6 * a)]);
  const all = new Path2D(); all.addPath(delt); all.addPath(upper); all.addPath(fore);
  shadeSeg(ctx, fore, E, W, cm(9.5 * a), skin, light);
  shadeSeg(ctx, upper, S, E, cm(12.5 * a), skin, light);
  // elbow joint & deltoid volume
  const el = new Path2D(); el.arc(E[0], E[1], cm(4.3 * a), 0, Math.PI * 2, true);
  shadeSeg(ctx, el, S, E, cm(12.5 * a), skin, light);
  shadeSeg(ctx, upper, S, E, cm(12.5 * a), skin, light);
  shadeSeg(ctx, delt, S, E, cm(14 * a), skin, light);
  // bicep/tricep separation
  ctx.save(); ctx.clip(upper);
  ctx.strokeStyle = tone(skin, -0.4, 0.18 + D.muscle * 0.22, true); ctx.lineWidth = cm(0.6);
  const n = perp(norm(sub(E, S)));
  ctx.beginPath(); const q0 = add(lerp(S, E, 0.3), mul(n, cm(1.5))), q1 = add(lerp(S, E, 0.8), mul(n, cm(0.5))); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
  ctx.restore();
  return {
    all,
    parts: [
      { region: 'UpperArm', A: S, B: E, w: cm(12 * a), path: upper, t0: 0.2, t1: 0.85 },
      { region: 'Forearm', A: E, B: W, w: cm(8.6 * a), path: fore, t0: 0.15, t1: 0.9 },
    ] as Part[],
  };
}

function drawLeg(ctx: CanvasRenderingContext2D, Hp: V, K: V, F: V, D: ReturnType<typeof dims>, skin: string, sc: number, facing: number, light: number) {
  const cm = (v: number) => v * sc;
  const l = D.leg;
  const kd = norm(sub(F, K));
  let fd: V = perp(kd); if (fd[0] * facing < 0) fd = mul(fd, -1);
  const up: V = mul(kd, -1);
  const ankle = add(F, mul(up, cm(7)));
  const thigh = segPath(Hp, K, [cm(19.5 * l), cm(18 * l), cm(12.4 * l)], [cm(18.5 * l), cm(16.5 * l), cm(12 * l)]);
  const calf = segPath(K, ankle, [cm(12 * l), cm(14 * l), cm(7.2 * l)], [cm(11.6 * l), cm(11.8 * l), cm(7 * l)]);
  // foot in its own frame: x toward the toes, y up from the sole
  const P = (x: number, y: number): V => add(add(F, mul(fd, cm(x))), mul(up, cm(y)));
  const foot = catmull([P(-5.5, 1.2), P(-6.4, 4.5), P(-4, 8.5), P(2.6, 8.2), P(8.5, 4.4), P(14.5, 2.2), P(16.2, 0.8), P(14.5, -0.2), P(4, -0.4), P(-3.5, -0.2)]);
  shadeSeg(ctx, calf, K, ankle, cm(11 * l), skin, light);
  ctx.fillStyle = skin; ctx.fill(foot);
  shadeSeg(ctx, foot, P(-5, 6), P(15, 1), cm(8), skin, light);
  ctx.strokeStyle = tone(skin, -0.45, 0.35, true); ctx.lineWidth = Math.max(0.5, cm(0.25)); ctx.stroke(foot);
  shadeSeg(ctx, thigh, Hp, K, cm(17 * l), skin, light);
  const kn = new Path2D(); kn.arc(K[0], K[1], cm(6.1 * l), 0, Math.PI * 2, true);
  shadeSeg(ctx, kn, Hp, K, cm(18 * l), skin, light);
  shadeSeg(ctx, thigh, Hp, K, cm(18 * l), skin, light);
  // kneecap & calf definition
  ctx.save(); ctx.clip(calf);
  ctx.strokeStyle = tone(skin, -0.4, 0.15 + D.muscle * 0.2, true); ctx.lineWidth = cm(0.55);
  const n = perp(kd); const c0 = add(lerp(K, ankle, 0.15), mul(n, -cm(2))), c1 = add(lerp(K, ankle, 0.55), mul(n, -cm(1)));
  ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.quadraticCurveTo(lerp(c0, c1, 0.5)[0] + n[0] * cm(2), lerp(c0, c1, 0.5)[1] + n[1] * cm(2), c1[0], c1[1]); ctx.stroke();
  ctx.restore();
  const all = new Path2D(); all.addPath(thigh); all.addPath(calf); all.addPath(foot); all.addPath(kn);
  return {
    all,
    parts: [
      { region: 'Thigh', A: Hp, B: K, w: cm(16 * l), path: thigh, t0: 0.58, t1: 0.92 },
      { region: 'Calf', A: K, B: ankle, w: cm(11 * l), path: calf, t0: 0.1, t1: 0.8 },
    ] as Part[],
  };
}

// ───────────────────────── gloves (open-finger MMA gloves)
function drawGlove(ctx: CanvasRenderingContext2D, E: V, H: V, look: Look, sc: number, light: number, dim = 0): Path2D {
  const cm = (v: number) => v * sc;
  const d = norm(sub(H, E)), n = perp(d);
  const P = (x: number, y: number): V => add(add(H, mul(d, cm(x))), mul(n, cm(y)));
  const fist = catmull([P(-4, -4.6), P(2.5, -5.2), P(6.8, -3.6), P(7.4, 0), P(6.8, 3.6), P(2.5, 5.2), P(-4, 4.6), P(-5, 0)]);
  const cuff = catmull([P(-9.2, -4.1), P(-4, -4.6), P(-3.6, 0), P(-4, 4.6), P(-9.2, 4.1), P(-9.8, 0)]);
  const col = tone(look.attire.gloves, -dim);
  const all = new Path2D(); all.addPath(fist); all.addPath(cuff);
  shadeSeg(ctx, cuff, P(-9, 0), P(-4, 0), cm(9), tone(look.attire.gloveTrim, -dim), light, false, 0.05);
  shadeSeg(ctx, fist, P(-4, 0), P(7, 0), cm(10), col, light, false, 0.12);
  // padding seams & finger openings
  ctx.save(); ctx.clip(fist);
  ctx.strokeStyle = tone(col, -0.45, 0.6); ctx.lineWidth = cm(0.35);
  ctx.beginPath(); const a = P(3.2, -4.8), b = P(3.6, 4.8); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(P(4.6, 0)[0], P(4.6, 0)[1], b[0], b[1]); ctx.stroke();
  ctx.fillStyle = tone(look.skin, -0.2, 0.9);
  for (const y of [-2.6, 0, 2.6]) { const p = P(6.2, y); ctx.beginPath(); ctx.ellipse(p[0], p[1], cm(0.9), cm(1.1), Math.atan2(d[1], d[0]), 0, Math.PI * 2); ctx.fill(); }
  const sp = P(0.5, -2.8); ctx.fillStyle = `rgba(255,255,255,${0.28 * light})`; ctx.beginPath(); ctx.ellipse(sp[0], sp[1], cm(2.4), cm(0.9), Math.atan2(d[1], d[0]), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return all;
}

// ───────────────────────── shorts
function shortsColorFor(look: Look, side: 'near' | 'far' | 'waist') {
  const a = look.attire;
  if (a.style === 'split') return side === 'far' ? a.accent : a.shorts;
  return a.shorts;
}

function drawShortsLeg(ctx: CanvasRenderingContext2D, Hp: V, K: V, D: ReturnType<typeof dims>, look: Look, sc: number, side: 'near' | 'far', light: number, dim = 0): Path2D {
  const cm = (v: number) => v * sc;
  const end = lerp(Hp, K, 0.52);
  const start = add(Hp, mul(norm(sub(Hp, K)), cm(2)));
  const w = 20.5 * D.leg * D.hips;
  const path = segPath(start, end, [cm(w * 1.08), cm(w), cm(w * 0.98)], [cm(w * 1.04), cm(w), cm(w * 1.02)], [0.35, 0.18]);
  const col = tone(shortsColorFor(look, side), -dim);
  shadeSeg(ctx, path, start, end, cm(w), col, light, false, 0.04);
  ctx.save(); ctx.clip(path);
  shortsPattern(ctx, look, start, end, cm(w), sc, side);
  // hem trim
  const d = norm(sub(end, start)), n = perp(d);
  const h0 = add(end, mul(d, -cm(1.6)));
  ctx.strokeStyle = look.attire.trim; ctx.lineWidth = cm(1.6);
  ctx.beginPath(); ctx.moveTo(h0[0] + n[0] * cm(w), h0[1] + n[1] * cm(w)); ctx.lineTo(h0[0] - n[0] * cm(w), h0[1] - n[1] * cm(w)); ctx.stroke();
  // cloth folds
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = cm(0.5);
  for (const k of [-0.25, 0.2]) { const a = add(lerp(start, end, 0.25), mul(n, cm(w * k))), b = add(lerp(start, end, 0.9), mul(n, cm(w * k * 1.3))); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.restore();
  return path;
}

function shortsPattern(ctx: CanvasRenderingContext2D, look: Look, A: V, B: V, w: number, sc: number, side: 'near' | 'far' | 'waist') {
  const a = look.attire;
  const d = norm(sub(B, A)), n = perp(d);
  const at = (t: number, k: number): V => add(lerp(A, B, t), mul(n, w * k));
  const cm = (v: number) => v * sc;
  ctx.fillStyle = a.accent; ctx.strokeStyle = a.accent;
  switch (a.style) {
    case 'stripe': { ctx.lineWidth = cm(2.2); ctx.beginPath(); const p = at(-0.2, -0.3), q = at(1.2, -0.3); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); break; }
    case 'panel': { ctx.beginPath(); const pts = [at(-0.2, -0.6), at(1.2, -0.6), at(1.2, -0.15), at(-0.2, -0.05)]; ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.fill(); break; }
    case 'chevron': { ctx.lineWidth = cm(1.6); for (const t of [0.25, 0.5, 0.75]) { ctx.beginPath(); const p = at(t, -0.6), m = at(t + 0.12, 0), q = at(t, 0.6); ctx.moveTo(p[0], p[1]); ctx.lineTo(m[0], m[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } break; }
    case 'flame': {
      if (side === 'waist') break;
      ctx.beginPath(); const base = 1.05; ctx.moveTo(at(base, -0.6)[0], at(base, -0.6)[1]);
      for (let i = 0; i <= 6; i++) { const k = -0.6 + i * 0.2; const tip = at(0.35 + ((i * 37) % 5) * 0.06, k + 0.05), next = at(base - 0.05, k + 0.1); ctx.quadraticCurveTo(tip[0], tip[1], next[0], next[1]); }
      ctx.lineTo(at(base, 0.6)[0], at(base, 0.6)[1]); ctx.closePath(); ctx.fill(); break;
    }
    case 'camo': {
      const cols = [tone(a.shorts, -0.3), tone(a.shorts, 0.2), a.accent];
      for (let i = 0; i < 9; i++) { const p = at(((i * 0.37) % 1) * 1.1 - 0.05, ((i * 0.61) % 1) - 0.5); ctx.fillStyle = cols[i % 3]; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(p[0], p[1], cm(3.2 + (i % 3)), cm(2), i, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1; break;
    }
  }
}

function waistPath(f: Frame, D: ReturnType<typeof dims>) {
  const p = new Path2D();
  const a = fp(f, 0.86, 11.4 * D.hips + D.belly * 0.5), b = fp(f, 1.06, 12.2 * D.hips), c = fp(f, 1.08, -11.4 * D.hips), d = fp(f, 0.86, -11.2 * D.hips);
  const mf = fp(f, 0.97, 12.6 * D.hips + D.belly * 0.3), mb = fp(f, 0.97, -12.2 * D.hips), bot = fp(f, 1.12, 0);
  p.moveTo(a[0], a[1]); p.quadraticCurveTo(mf[0], mf[1], b[0], b[1]); p.quadraticCurveTo(bot[0], bot[1], c[0], c[1]); p.quadraticCurveTo(mb[0], mb[1], d[0], d[1]); p.closePath();
  return p;
}
function drawShortsWaist(ctx: CanvasRenderingContext2D, f: Frame, D: ReturnType<typeof dims>, look: Look, sc: number, light: number) {
  const path = waistPath(f, D);
  const col = shortsColorFor(look, 'waist');
  shadeSeg(ctx, path, fp(f, 0.98, 12), fp(f, 0.98, -12), sc * 24, col, light, false, 0.04);
  ctx.save(); ctx.clip(path);
  shortsPattern(ctx, look, fp(f, 0.86, 0), fp(f, 1.12, 0), sc * 12, sc, 'waist');
  ctx.restore();
}
function drawWaistband(ctx: CanvasRenderingContext2D, f: Frame, D: ReturnType<typeof dims>, look: Look, sc: number) {
  ctx.save(); ctx.clip(waistPath(f, D));
  const w0 = fp(f, 0.885, 15), w1 = fp(f, 0.885, -15);
  ctx.strokeStyle = look.attire.waistband; ctx.lineWidth = sc * 3.2;
  ctx.beginPath(); ctx.moveTo(w0[0], w0[1]); ctx.lineTo(w1[0], w1[1]); ctx.stroke();
  ctx.strokeStyle = look.attire.trim; ctx.lineWidth = sc * 0.5;
  const t0 = fp(f, 0.915, 15), t1 = fp(f, 0.915, -15); ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
  ctx.restore();
}

// ───────────────────────── tattoos
function drawTattoosOn(ctx: CanvasRenderingContext2D, tats: Tattoo[], regions: TattooRegion[], parts: Part[], skin: string, sc: number) {
  for (const t of tats) {
    if (!regions.includes(t.region)) continue;
    const part = parts.find((p) => t.region.endsWith(p.region));
    if (!part) continue;
    ctx.save(); ctx.clip(part.path);
    const tt = part.t0 + (part.t1 - part.t0) * t.pos;
    const anchor = lerp(part.A, part.B, tt);
    drawTattooAt(ctx, t, anchor, Math.atan2(part.B[1] - part.A[1], part.B[0] - part.A[0]), len(sub(part.B, part.A)) * 0.38, part.w, skin, sc);
    ctx.restore();
  }
}

function drawTattooInSeg(ctx: CanvasRenderingContext2D, t: Tattoo, A: V, B: V, w: number, skin: string, sc: number) {
  const anchor = lerp(A, B, 0.3 + t.pos * 0.4);
  drawTattooAt(ctx, t, anchor, Math.atan2(B[1] - A[1], B[0] - A[0]), len(sub(B, A)) * 0.55, w, skin, sc);
}

function drawTattoosTorso(ctx: CanvasRenderingContext2D, tats: Tattoo[], f: Frame, D: ReturnType<typeof dims>, skin: string) {
  const spots: Partial<Record<TattooRegion, [number, number, number, number]>> = {
    // s range, n centre, size (cm)
    chest: [0.18, 0.38, 7.5 * D.chest, 13],
    abdomen: [0.5, 0.8, 6 * D.waist, 12],
    upperBack: [0.12, 0.42, -7.5 * D.lat, 14],
    lowerBack: [0.62, 0.86, -6.5 * D.waist, 12],
  };
  for (const t of tats) {
    const sp = spots[t.region];
    if (!sp) continue;
    const s = sp[0] + (sp[1] - sp[0]) * t.pos;
    const anchor = fp(f, s, sp[2]);
    // torso pieces sit upright along the spine axis
    const ang = Math.atan2(f.u[1], f.u[0]) - Math.PI / 2;
    drawTattooAt(ctx, t, anchor, ang, sp[3] * f.sc, sp[3] * f.sc, skin, f.sc, true);
  }
}

/** Draw one design centred at `at`, aligned with `ang`; box length × width in px. */
function drawTattooAt(ctx: CanvasRenderingContext2D, t: Tattoo, at: V, ang: number, boxL: number, boxW: number, skin: string, sc: number, upright = false) {
  const band = t.design === 'tribal' || t.design === 'geo' || t.design === 'waves';
  let a = ang + (t.rot * Math.PI) / 180;
  // keep lettering readable (never upside down)
  if (t.design === 'script') { const c = Math.cos(a); if (c < 0) a += Math.PI; }
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(a);
  const L = (band ? sc * 4.5 : upright ? boxL * 0.75 : Math.min(boxL, boxW * 1.6)) * t.size;
  const W = (band ? boxW * 1.25 : upright ? boxW * 0.75 : boxW * 0.82) * t.size;
  ctx.globalAlpha = 0.86;
  ctx.globalCompositeOperation = 'multiply';
  TATTOO_ART[t.design](ctx, L, W, t.ink, skin, t.text ?? '');
  ctx.restore();
}

type ArtFn = (ctx: CanvasRenderingContext2D, L: number, W: number, ink: string, skin: string, text: string) => void;
const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pts = 5, inner = 0.45) => {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) { const rr = i % 2 ? r * inner : r; const a = (i * Math.PI) / pts - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
};
export const TATTOO_ART: Record<string, ArtFn> = {
  tribal: (c, L, W, ink) => {
    c.fillStyle = ink; c.beginPath(); c.moveTo(-L / 2, -W / 2);
    for (let i = 0; i <= 6; i++) { const y = -W / 2 + (W * i) / 6; c.lineTo(i % 2 ? L * 0.9 : L / 2, y); }
    c.lineTo(L / 2, W / 2); c.lineTo(-L / 2, W / 2);
    for (let i = 6; i >= 0; i--) { const y = -W / 2 + (W * i) / 6; c.lineTo(i % 2 ? -L * 0.9 : -L / 2, y); }
    c.closePath(); c.fill();
  },
  geo: (c, L, W, ink) => {
    c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = L * 0.12;
    c.beginPath(); c.moveTo(-L / 2, -W / 2); c.lineTo(-L / 2, W / 2); c.moveTo(L / 2, -W / 2); c.lineTo(L / 2, W / 2); c.stroke();
    for (let i = 0; i < 5; i++) { const y = -W / 2 + (W * (i + 0.5)) / 5; c.beginPath(); c.moveTo(-L * 0.4, y - W / 12); c.lineTo(L * 0.4, y); c.lineTo(-L * 0.4, y + W / 12); c.closePath(); c.fill(); }
  },
  waves: (c, L, W, ink) => {
    c.strokeStyle = ink; c.lineWidth = L * 0.16;
    for (const x of [-L * 0.3, L * 0.3]) { c.beginPath(); for (let i = 0; i <= 12; i++) { const y = -W / 2 + (W * i) / 12; c.lineTo(x + Math.sin(i * 1.3) * L * 0.25, y); } c.stroke(); }
  },
  mandala: (c, L, W, ink) => {
    const r = Math.min(L, W) / 2; c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = r * 0.08;
    for (const k of [1, 0.66, 0.33]) { c.beginPath(); c.arc(0, 0, r * k, 0, Math.PI * 2); c.stroke(); }
    for (let i = 0; i < 8; i++) { c.save(); c.rotate((i * Math.PI) / 4); c.beginPath(); c.ellipse(0, -r * 0.66, r * 0.12, r * 0.3, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.beginPath(); c.arc(0, 0, r * 0.12, 0, Math.PI * 2); c.fill();
  },
  sun: (c, L, W, ink) => {
    const r = Math.min(L, W) / 2; c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = r * 0.1;
    c.beginPath(); c.arc(0, 0, r * 0.38, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 12; i++) { c.save(); c.rotate((i * Math.PI) / 6); c.beginPath(); c.moveTo(-r * 0.08, -r * 0.48); c.lineTo(0, -r * (i % 2 ? 0.8 : 1)); c.lineTo(r * 0.08, -r * 0.48); c.closePath(); c.fill(); c.restore(); }
  },
  rose: (c, L, W, ink) => {
    const r = Math.min(L, W) / 2; c.strokeStyle = ink; c.lineWidth = r * 0.08; c.fillStyle = ink;
    c.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.32, rr = r * 0.05 + (r * 0.5 * i) / 60; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr - r * 0.15); } c.stroke();
    c.beginPath(); c.ellipse(-r * 0.45, r * 0.55, r * 0.28, r * 0.12, -0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(r * 0.45, r * 0.55, r * 0.28, r * 0.12, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(0, r * 0.35); c.lineTo(0, r); c.stroke();
  },
  wings: (c, L, W, ink) => {
    c.fillStyle = ink;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(s * (L * 0.12 + i * L * 0.09), -W * 0.05 + i * W * 0.08, L * (0.22 - i * 0.03), W * 0.07, s * (0.5 + i * 0.12), 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(0, 0, Math.min(L, W) * 0.07, 0, Math.PI * 2); c.fill();
  },
  stars: (c, L, W, ink) => { c.fillStyle = ink; const r = Math.min(L, W) / 2; star(c, -r * 0.3, -r * 0.4, r * 0.35); c.fill(); star(c, r * 0.35, 0, r * 0.28); c.fill(); star(c, -r * 0.1, r * 0.5, r * 0.22); c.fill(); },
  skull: (c, L, W, ink, skin) => {
    const r = Math.min(L, W) / 2; c.fillStyle = ink;
    c.beginPath(); c.ellipse(0, -r * 0.15, r * 0.62, r * 0.55, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(-r * 0.36, r * 0.25, r * 0.72, r * 0.42);
    c.globalCompositeOperation = 'source-over'; c.fillStyle = skin;
    c.beginPath(); c.ellipse(-r * 0.24, -r * 0.1, r * 0.15, r * 0.17, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(r * 0.24, -r * 0.1, r * 0.15, r * 0.17, 0, 0, Math.PI * 2); c.fill();
    for (const x of [-0.18, 0, 0.18]) c.fillRect(x * r - r * 0.03, r * 0.42, r * 0.06, r * 0.24);
  },
  dagger: (c, L, W, ink) => {
    const r = Math.max(L, W) / 2; c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = r * 0.06;
    c.beginPath(); c.moveTo(-r * 0.15, 0); c.lineTo(r * 0.85, -r * 0.08); c.lineTo(r, 0); c.lineTo(r * 0.85, r * 0.08); c.closePath(); c.stroke();
    c.fillRect(-r * 0.2, -r * 0.22, r * 0.08, r * 0.44); c.fillRect(-r * 0.62, -r * 0.06, r * 0.42, r * 0.12);
    c.beginPath(); c.arc(-r * 0.68, 0, r * 0.09, 0, Math.PI * 2); c.fill();
  },
  compass: (c, L, W, ink) => {
    const r = Math.min(L, W) / 2; c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = r * 0.06;
    c.beginPath(); c.arc(0, 0, r * 0.72, 0, Math.PI * 2); c.stroke();
    star(c, 0, 0, r, 4, 0.22); c.fill(); c.save(); c.rotate(Math.PI / 4); star(c, 0, 0, r * 0.55, 4, 0.3); c.fill(); c.restore();
  },
  script: (c, L, W, ink, _skin, text) => {
    const msg = text || 'FIGHT';
    c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    let fs = W * 0.7; c.font = `italic 700 ${fs}px Georgia, 'Times New Roman', serif`;
    const tw = c.measureText(msg).width; if (tw > L * 1.4) { fs *= (L * 1.4) / tw; c.font = `italic 700 ${fs}px Georgia, 'Times New Roman', serif`; }
    c.fillText(msg, 0, 0);
  },
};

// ───────────────────────── head, face, hair, facial hair
function drawHead(ctx: CanvasRenderingContext2D, head: V, neck: V, front: V, o: ArtOpts) {
  const { sc, look } = o;
  const upAxis = norm(sub(head, neck));
  // local frame: +x = facing direction (front), +y = down the head
  let fx = front;
  // keep the face perpendicular to the head's up axis
  const dot = fx[0] * upAxis[0] + fx[1] * upAxis[1];
  fx = norm(sub(fx, mul(upAxis, dot)));
  ctx.save();
  ctx.transform(fx[0] * sc, fx[1] * sc, -upAxis[0] * sc, -upAxis[1] * sc, head[0], head[1]);
  drawHeadLocal(ctx, look, o);
  ctx.restore();
}

function headShape(look: Look) {
  const s = look.face.shape;
  return s === 'round' ? { rx: 10.6, ry: 10.6 } : s === 'square' ? { rx: 10.3, ry: 10.9 } : s === 'long' ? { rx: 9.7, ry: 11.8 } : { rx: 10, ry: 11.2 };
}

function hairCap(rx: number, ry: number, t: number, front = 8.2, nape = 4.5): Path2D {
  // a hair mass hugging the cranium (centre -0.6,-2.2) with thickness t
  const p = new Path2D();
  const cx = -0.6, cy = -2.2;
  const pt = (a: number, extra: number): V => [cx + Math.cos(a) * (rx + extra), cy + Math.sin(a) * (ry + extra)];
  const start = pt(-0.55, t * 0.6); // front hairline
  p.moveTo(start[0], start[1]);
  for (let a = -0.55; a >= -Math.PI - 0.95; a -= 0.12) { const q = pt(a, t); p.lineTo(q[0], q[1]); }
  p.lineTo(-9.8, nape); p.lineTo(-6.5, nape + 0.4); p.lineTo(-6.2, 0.4); // behind the ear
  p.lineTo(-1.4, 1.6); p.lineTo(-0.6, -2); // sideburn
  p.lineTo(4.5, -5.6); p.lineTo(front, -6.6);
  p.closePath();
  return p;
}

function drawHeadLocal(ctx: CanvasRenderingContext2D, look: Look, o: ArtOpts) {
  const skin = look.skin, hc = look.hairColor, fc = look.facialColor;
  const { rx, ry } = headShape(look);
  const jaw = look.face.jaw, brow = look.face.brow, noseK = look.face.nose;
  const light = o.light ?? 1;
  const lw = (px: number) => px / o.sc; // convert screen px to local cm for thin strokes
  const sway = o.sway ?? 0;

  // back hair masses (behind the head)
  ctx.fillStyle = hc;
  if (look.hair === 'ponytail' || look.hair === 'braids' || look.hair === 'long') {
    ctx.save(); ctx.translate(-9.5, -3); ctx.rotate(sway);
    if (look.hair === 'long') { const p = catmull([[0, -6], [-3, 4], [-3.5, 14], [1, 22], [6, 16], [5, 4], [3, -4]]); ctx.fill(p); }
    else if (look.hair === 'ponytail') { const p = catmull([[0, -1], [-3.2, 5], [-3.6, 13], [-1.5, 19], [0.8, 12], [1.4, 4]]); ctx.fill(p); }
    else { for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(-1.5 - i * 0.2, 1 + i * 2.6, 1.6, 1.5, 0.3, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  if (look.hair === 'afro') { ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = -Math.PI * 1.15 + (i / 17) * Math.PI * 1.35; ctx.moveTo(-1.2 + Math.cos(a) * 12.6 + 1.6, -4.5 + Math.sin(a) * 12.4); ctx.arc(-1.2 + Math.cos(a) * 12.6, -4.5 + Math.sin(a) * 12.4, 1.6, 0, Math.PI * 2); } ctx.fill(); ctx.beginPath(); ctx.ellipse(-1.2, -4.5, 13, 12.4, 0, 0, Math.PI * 2); ctx.fill(); }

  // skull + face as one silhouette
  const face = new Path2D();
  face.ellipse(-0.6, -2.2, rx, ry, 0, 0, Math.PI * 2);
  const chinY = 12.4 + (look.face.shape === 'long' ? 1 : 0);
  const jawBack = -4.6 + jaw * 1.4, jawY = 8.6 + jaw * 1.2;
  const browX = 10.1 + brow * 0.7;
  face.addPath(catmull(([
    [-6.4, 2.6], [jawBack, jawY], [1.5, chinY + 0.6], [6.4, chinY], [8.9, 10.6], [9.9, 8.4], [10.4, 6.6], [10, 4.9], [9.6, 1.4],
    [browX, -2.6], [browX - 0.2, -5], [9, -8.5], [4, -10],
  ] as V[]).reverse()));
  {
    // single radial fill: lit forehead/cheek toward the light, falling into shadow at the back of the skull
    const g = ctx.createRadialGradient(5, -6, 1, 3, -3, 19);
    g.addColorStop(0, tone(skin, 0.2 * light)); g.addColorStop(0.45, tone(skin, 0.03)); g.addColorStop(0.78, tone(skin, -0.2, 1, true)); g.addColorStop(1, tone(skin, -0.38, 1, true));
    ctx.fillStyle = g; ctx.fill(face);
  }
  ctx.save(); ctx.clip(face);
  {
    // cheekbone, eye socket and jaw shadows
    ctx.fillStyle = tone(skin, -0.35, 0.35, true);
    ctx.beginPath(); ctx.ellipse(7.4, -1.2, 2.6, 1.7, 0, 0, Math.PI * 2); ctx.fill(); // socket
    ctx.fillStyle = tone(skin, -0.3, 0.3, true);
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.quadraticCurveTo(1, chinY + 1.5, 7, chinY + 0.5); ctx.lineTo(7, chinY + 3); ctx.lineTo(-6, chinY + 3); ctx.fill(); // under-jaw
    ctx.fillStyle = tone(skin, 0.18 * light, 0.5); ctx.beginPath(); ctx.ellipse(6.6, 2.4, 2.2, 1.1, -0.3, 0, Math.PI * 2); ctx.fill(); // cheekbone highlight
    // damage
    const hd = o.headDamage ?? 0;
    if (hd > 45) { ctx.fillStyle = `rgba(120,30,60,${Math.min(0.5, (hd - 45) / 80)})`; ctx.beginPath(); ctx.ellipse(8, -2.6, 2.8, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    if (hd > 72) { ctx.strokeStyle = 'rgba(150,10,20,0.75)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(9.4, -4.4); ctx.quadraticCurveTo(9.8, -1, 9.2, 2); ctx.stroke(); }
  }
  ctx.restore();

  // ear
  const ear = look.face.cauliflower ? catmull([[-2.4, -2.4], [-0.6, -0.6], [-0.9, 2.2], [-2.2, 3.8], [-4.2, 3], [-4.8, 0.4], [-4.2, -2]]) : catmull([[-2.6, -2.6], [-1.2, -1], [-1.4, 2.4], [-2.6, 3.8], [-4, 2.6], [-4.4, -0.4], [-3.8, -2.4]]);
  ctx.fillStyle = tone(skin, -0.06); ctx.fill(ear);
  ctx.strokeStyle = tone(skin, -0.42, 0.7, true); ctx.lineWidth = 0.45; ctx.stroke(ear);
  ctx.beginPath(); ctx.ellipse(-2.8, 0.5, 0.6, 1.4, 0, 0, Math.PI * 2); ctx.fillStyle = tone(skin, -0.38, 0.7, true); ctx.fill();
  if (look.face.cauliflower) { ctx.fillStyle = tone(skin, -0.2, 0.6, true); ctx.beginPath(); ctx.arc(-2.2, -0.8, 0.9, 0, Math.PI * 2); ctx.arc(-3.6, 1.6, 0.8, 0, Math.PI * 2); ctx.fill(); }

  // nose
  const tipX = 11.8 + noseK * 1.6;
  const nose = catmull([[9.7, -2.2], [tipX - 0.4, 2.6], [tipX, 3.7], [tipX - 0.9, 4.7], [9.8, 4.9], [9.2, 2]]);
  ctx.fillStyle = tone(skin, 0.03); ctx.fill(nose);
  ctx.strokeStyle = tone(skin, -0.45, 0.55, true); ctx.lineWidth = 0.35; ctx.stroke(nose);
  ctx.fillStyle = tone(skin, -0.55, 0.6, true); ctx.beginPath(); ctx.ellipse(tipX - 1.6, 4.4, 0.7, 0.35, 0.2, 0, Math.PI * 2); ctx.fill();

  // eye
  const eh = look.face.eyes === 'round' ? 1.9 : look.face.eyes === 'narrow' ? 0.85 : 1.35;
  const ex = look.face.eyes === 'deep' ? 7.4 : 7.9;
  if (o.eyesClosed) {
    ctx.strokeStyle = tone(skin, -0.6, 0.9); ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(ex - 1.6, -1.2); ctx.quadraticCurveTo(ex, -0.6, ex + 1.5, -1.2); ctx.stroke();
  } else {
    ctx.fillStyle = '#efe9e2'; ctx.beginPath(); ctx.ellipse(ex, -1.3, 1.75, eh / 2 + 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1d16'; ctx.beginPath(); ctx.arc(ex + 0.8, -1.3, Math.min(0.85, eh / 2 + 0.1), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(ex + 1.0, -1.6, 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tone(skin, -0.6, 0.85); ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(ex - 1.8, -1.3); ctx.quadraticCurveTo(ex, -1.3 - eh / 2 - 0.6, ex + 1.8, -1.4); ctx.stroke();
  }
  // brow
  ctx.strokeStyle = tone(fc, -0.1, 0.92); ctx.lineCap = 'round'; ctx.lineWidth = 0.8 + brow * 0.9;
  ctx.beginPath(); ctx.moveTo(5.4, -3.6 - brow * 0.2); ctx.quadraticCurveTo(7.8, -4.8 - brow * 0.4, 10.2, -4.1); ctx.stroke();
  // mouth
  ctx.strokeStyle = tone(skin, -0.55, 0.85, true); ctx.lineWidth = 0.45;
  ctx.beginPath(); ctx.moveTo(8.2, 8.1); ctx.quadraticCurveTo(9.2, 8.3, 10.2, 7.9); ctx.stroke();
  ctx.fillStyle = tone(skin, -0.18, 0.7, true); ctx.beginPath(); ctx.ellipse(9.5, 8.9, 0.9, 0.45, 0, 0, Math.PI * 2); ctx.fill();

  // facial hair
  drawFacialHair(ctx, look, chinY, jawBack, jawY);

  // scalp hair
  drawHair(ctx, look, rx, ry, light);
  void hc; void lw;

  if (look.attire.headband) {
    ctx.strokeStyle = look.attire.accent; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(-0.6, -2.2, rx + 0.4, ry + 0.4, 0, -0.42, -Math.PI - 0.5, true); ctx.stroke();
  }
}

function drawHair(ctx: CanvasRenderingContext2D, look: Look, rx: number, ry: number, light: number) {
  const hc = look.hairColor;
  const shine = (p: Path2D) => {
    ctx.save(); ctx.clip(p);
    const g = ctx.createLinearGradient(-6, -14, 6, -4); g.addColorStop(0, tone(hc, 0.25 * light, 0.55)); g.addColorStop(0.5, tone(hc, 0, 0)); g.addColorStop(1, tone(hc, -0.3, 0.5));
    ctx.fillStyle = g; ctx.fill(p); ctx.restore();
  };
  const fill = (p: Path2D, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = hc; ctx.fill(p); ctx.globalAlpha = 1; if (a > 0.6) shine(p); };
  const fadeSides = (top: Path2D, sideAlpha: number) => {
    fill(hairCap(rx, ry, 0.25), sideAlpha);
    fill(top);
  };
  const topOnly = (t: number, rise = 0): Path2D => {
    const p = new Path2D(); const cx = -0.6, cy = -2.2;
    p.moveTo(8.6, -6.6 - rise * 0.4);
    for (let a = -0.6; a >= -Math.PI + 0.25; a -= 0.12) p.lineTo(cx + Math.cos(a) * (rx + t), cy + Math.sin(a) * (ry + t) - (a > -1.1 ? rise * (1 - (a + 1.1) / 0.5) : 0));
    p.lineTo(-8, -6.5); p.lineTo(6, -8); p.closePath(); return p;
  };
  switch (look.hair) {
    case 'bald': {
      ctx.fillStyle = `rgba(255,255,255,${0.16 * light})`; ctx.beginPath(); ctx.ellipse(1.5, -10, 4.5, 1.6, -0.2, 0, Math.PI * 2); ctx.fill(); break;
    }
    case 'shaved': fill(hairCap(rx, ry, 0.15), 0.32); break;
    case 'buzz': fill(hairCap(rx, ry, 0.4), 0.8); break;
    case 'crew': fill(hairCap(rx, ry, 1.1, 8.4)); break;
    case 'highfade': fadeSides(topOnly(1.6), 0.25); break;
    case 'midfade': {
      fadeSides(topOnly(2.6), 0.4);
      ctx.fillStyle = hc; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-6 + i * 2.2, -13.2 - (i % 2) * 0.6 - (i > 3 ? 0.3 : 0), 1.3, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'quiff': {
      fadeSides(topOnly(1.8, 4), 0.3);
      ctx.fillStyle = hc; const q = catmull([[3, -10], [8, -14.5], [11.5, -12.5], [9.5, -8.6], [5.5, -8.8]]); ctx.fill(q); shine(q); break;
    }
    case 'medium': {
      const p = hairCap(rx, ry, 2.2, 9.2, 6.5); fill(p);
      ctx.fillStyle = hc; const fr = catmull([[2, -10], [8.8, -9.6], [11.2, -5.6], [9, -6.4], [4, -6.8]]); ctx.fill(fr); shine(fr);
      ctx.strokeStyle = tone(hc, -0.35, 0.6); ctx.lineWidth = 0.4; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 3, -12.5); ctx.quadraticCurveTo(-2 + i * 3, -9, 1 + i * 3, -7); ctx.stroke(); }
      break;
    }
    case 'curly': {
      const p = hairCap(rx, ry, 1.8, 8.6); fill(p);
      ctx.fillStyle = hc; for (let a = -0.5; a >= -Math.PI - 0.9; a -= 0.32) { ctx.beginPath(); ctx.arc(-0.6 + Math.cos(a) * (rx + 1.8), -2.2 + Math.sin(a) * (ry + 1.8), 1.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = tone(hc, 0.3 * light, 0.4); for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-7 + i * 1.8, -11 + Math.sin(i) * 1.5, 0.6, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'afro': {
      ctx.fillStyle = tone(hc, 0.25 * light, 0.35); for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(-6 + (i % 7) * 2.6, -14 + Math.floor(i / 7) * 3 + Math.sin(i) , 0.9, 0, Math.PI * 2); ctx.fill(); }
      fill(hairCap(rx, ry, 1, 7.4), 1); break;
    }
    case 'mohawk': {
      fill(hairCap(rx, ry, 0.15), 0.3);
      ctx.fillStyle = hc; const m = new Path2D(); m.moveTo(7, -9.6);
      for (let i = 0; i <= 8; i++) { const a = -1.0 - i * 0.24; const r1 = ry + (i % 2 ? 3.6 : 1.8); m.lineTo(-0.6 + Math.cos(a) * r1, -2.2 + Math.sin(a) * r1); }
      m.lineTo(-9.6, -5); m.lineTo(5, -9); m.closePath(); ctx.fill(m); shine(m); break;
    }
    case 'cornrows': case 'braids': {
      const cap = hairCap(rx, ry, 0.9, 8.4); fill(cap);
      ctx.save(); ctx.clip(cap); ctx.strokeStyle = tone(look.skin, -0.2, 0.55); ctx.lineWidth = 0.35;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(8 - i * 0.6, -7 - i * 1.25); ctx.quadraticCurveTo(-1, -13 - i * 0.2 + i * 1.6, -10, -5 + i * 1.5); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'ponytail': case 'bun': {
      const cap = hairCap(rx, ry, 0.9, 8.6); fill(cap);
      ctx.strokeStyle = tone(hc, -0.4, 0.55); ctx.lineWidth = 0.35; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(8 - i, -7.5 - i * 1.2); ctx.quadraticCurveTo(0, -13, -9, -5 + i * 0.5); ctx.stroke(); }
      if (look.hair === 'bun') { ctx.fillStyle = hc; const b = new Path2D(); b.arc(-8.2, -11, 3.6, 0, Math.PI * 2); ctx.fill(b); shine(b); }
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(look.hair === 'bun' ? -6.6 : -9.6, look.hair === 'bun' ? -9.2 : -3.2, 0.8, 1.2, 0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'long': {
      const p = hairCap(rx, ry, 1.8, 9, 7); fill(p);
      ctx.strokeStyle = tone(hc, -0.35, 0.55); ctx.lineWidth = 0.4; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(7 - i * 2, -9.5); ctx.quadraticCurveTo(-4 - i, -8 + i, -8 - i * 0.6, 4); ctx.stroke(); }
      break;
    }
  }
}

function drawFacialHair(ctx: CanvasRenderingContext2D, look: Look, chinY: number, jawBack: number, jawY: number) {
  const fc = look.facialColor;
  const area = (len: number, cheek: number) => catmull([
    [-1.2, 1.4], [jawBack - 0.2, jawY + 0.4], [1.4, chinY + 0.8 + len * 0.6], [6.2, chinY + len], [9.2, 10.8 + len * 0.4], [10.1, 9.2], [9.3, 8.7], [8, 8.9], [7.2, 7.2], [6, cheek], [1.5, cheek - 1.2],
  ]);
  ctx.fillStyle = fc;
  switch (look.beard) {
    case 'stubble': ctx.globalAlpha = 0.24; ctx.fill(area(0, 4)); break;
    case 'stubble2': ctx.globalAlpha = 0.42; ctx.fill(area(0.2, 3.6)); break;
    case 'short': ctx.globalAlpha = 0.9; ctx.fill(area(0.8, 4.2)); break;
    case 'full': ctx.globalAlpha = 0.95; ctx.fill(area(2.2, 3.2)); break;
    case 'long': ctx.globalAlpha = 0.95; ctx.fill(area(6.5, 3.2)); break;
    case 'goatee': ctx.globalAlpha = 0.92; ctx.fill(catmull([[7.2, 9.2], [9.6, 9.4], [9.4, chinY + 1.4], [6.2, chinY + 1.6], [5.6, 10.6]])); break;
    case 'chinstrap': {
      ctx.globalAlpha = 0.9; ctx.strokeStyle = fc; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-1.2, 1.6); ctx.lineTo(jawBack, jawY); ctx.quadraticCurveTo(2, chinY + 1.4, 7.5, chinY + 0.2); ctx.stroke(); break;
    }
    case 'soulpatch': ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(9, 10, 0.7, 1, 0, 0, Math.PI * 2); ctx.fill(); break;
  }
  ctx.globalAlpha = 1;
  if (['full', 'long', 'short'].includes(look.beard)) {
    ctx.strokeStyle = tone(fc, 0.2, 0.35); ctx.lineWidth = 0.25;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); const x = -1 + i * 1.3; ctx.moveTo(x, 7 + (i % 3)); ctx.lineTo(x + 0.3, 10 + (i % 3) + (look.beard === 'long' ? 3 : 0)); ctx.stroke(); }
  }
  ctx.fillStyle = fc;
  switch (look.moustache) {
    case 'classic': ctx.fill(catmull([[8, 7.4], [9.4, 6.2], [10.7, 6.3], [10.6, 7.3], [9.4, 7.5]])); break;
    case 'pencil': ctx.globalAlpha = 0.9; ctx.fillRect(8.4, 6.6, 2.2, 0.45); ctx.globalAlpha = 1; break;
    case 'chevron': ctx.fill(catmull([[7.6, 7.7], [9.2, 5.7], [10.9, 6.1], [10.8, 7.6], [9.2, 7.8]])); break;
    case 'horseshoe': {
      ctx.fill(catmull([[8, 7.4], [9.4, 6.2], [10.7, 6.3], [10.6, 7.3], [9.4, 7.5]]));
      ctx.fillRect(7.6, 7, 0.9, 4.6); break;
    }
  }
}

// ───────────────────────── portraits (head & shoulders using the same artwork)
const BUST_POSE: Joints = {
  head: [4, -164], neck: [1, -148], hip: [-4, -94],
  fElbow: [8, -110], fHand: [22, -122], rElbow: [-4, -108], rHand: [10, -124],
  fKnee: [16, -48], fFoot: [24, 0], rKnee: [-22, -48], rFoot: [-30, 0],
};
export function drawPortrait(ctx: CanvasRenderingContext2D, look: Look, size: number, opts: { mirror?: boolean; walkout?: boolean; accent?: string } = {}) {
  ctx.save();
  const sc = size / 46; // ~46 cm of body fits the frame
  const facing: 1 | -1 = opts.mirror ? -1 : 1;
  const ox = size / 2 - facing * 2 * sc, oy = size * 0.42 + 160 * sc;
  const J = Object.fromEntries(Object.entries(BUST_POSE).map(([k, p]) => [k, [ox + p[0] * sc * facing, oy + p[1] * sc]])) as unknown as Joints;
  drawFighterArt(ctx, J, { sc, facing, look, standing: false, top: opts.walkout ? look.attire.walkout : 'none' });
  ctx.restore();
}

// ───────────────────────── walkout clothing (portraits & presentation)
function drawTopTorso(ctx: CanvasRenderingContext2D, f: Frame, D: ReturnType<typeof dims>, look: Look, sc: number, top: string) {
  const col = look.attire.walkoutColor;
  const tp = torsoPoints(f, D);
  const grow = (p: V): V => { const rel = sub(p, f.o); const s = rel[0] * f.u[0] + rel[1] * f.u[1]; const nn = rel[0] * f.n[0] + rel[1] * f.n[1]; return add(add(f.o, mul(f.u, s)), mul(f.n, nn * 1.1 + (nn > 0 ? 0.6 : -0.6) * sc)); };
  const body = catmull([...tp.front.map(grow), ...tp.back.map(grow)]);
  shadeSeg(ctx, body, fp(f, 0.45, 13), fp(f, 0.45, -13), sc * 26, col, 1, false, 0.03);
  ctx.save(); ctx.clip(body);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = sc * 0.6;
  for (const k of [0.4, 0.7]) { const a = fp(f, k, -10), b = fp(f, k + 0.12, 8); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(fp(f, k + 0.1, 0)[0], fp(f, k + 0.1, 0)[1], b[0], b[1]); ctx.stroke(); }
  if (top === 'jacket' || top === 'robe') { ctx.strokeStyle = top === 'robe' ? look.attire.trim : look.attire.accent; ctx.lineWidth = sc * (top === 'robe' ? 2.4 : 1.2); const a = fp(f, 0.02, 7), b = fp(f, 1.1, 11); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  if (top === 'tee') { ctx.fillStyle = look.attire.accent; const c = fp(f, 0.33, 7); ctx.beginPath(); ctx.arc(c[0], c[1], sc * 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawSleeves(ctx: CanvasRenderingContext2D, S: V, E: V, H: V, D: ReturnType<typeof dims>, look: Look, sc: number, top: string, dim: number) {
  const col = tone(look.attire.walkoutColor, -dim);
  const a = D.arm;
  const W = sub(H, mul(norm(sub(H, E)), sc * 6));
  const up = segPath(S, E, [sc * 15 * a, sc * 14 * a, sc * 11 * a], [sc * 15 * a, sc * 13.5 * a, sc * 11 * a]);
  shadeSeg(ctx, up, S, E, sc * 14 * a, col, 1, false, 0.03);
  if (top === 'tee') return;
  const lo = segPath(E, W, [sc * 11.5 * a, sc * 11 * a, sc * 9.5 * a], [sc * 11.5 * a, sc * 11 * a, sc * 9.5 * a]);
  shadeSeg(ctx, lo, E, W, sc * 11 * a, col, 1, false, 0.03);
  ctx.strokeStyle = tone(look.attire.trim, -dim); ctx.lineWidth = sc * 1.3; const n = perp(norm(sub(W, E))), c = lerp(E, W, 0.92);
  ctx.beginPath(); ctx.moveTo(c[0] + n[0] * sc * 5, c[1] + n[1] * sc * 5); ctx.lineTo(c[0] - n[0] * sc * 5, c[1] - n[1] * sc * 5); ctx.stroke();
}
function drawHood(ctx: CanvasRenderingContext2D, f: Frame, look: Look, sc: number) {
  const col = tone(look.attire.walkoutColor, -0.15);
  const hood = catmull([fp(f, 0.02, -10.5), fp(f, -0.12, -12), fp(f, -0.2, -8), fp(f, -0.08, -2), fp(f, 0.06, -4)]);
  shadeSeg(ctx, hood, fp(f, -0.08, -12), fp(f, -0.08, -2), sc * 10, col, 1, false);
}

// ───────────────────────── fight-poster pose (upper body, guard up, facing the opponent)
const POSTER_POSE: Joints = {
  head: [5, -165], neck: [1, -149], hip: [-5, -95],
  fElbow: [20, -124], fHand: [30, -150], rElbow: [8, -120], rHand: [17, -156],
  fKnee: [16, -50], fFoot: [24, 0], rKnee: [-22, -50], rFoot: [-30, 0],
};
/** Draws a fighter for a poster: waist-up, filling a w×h canvas; `mirror` faces left. */
export function drawPosterFighter(ctx: CanvasRenderingContext2D, look: Look, w: number, h: number, opts: { mirror?: boolean; scale?: number } = {}) {
  const sc = ((h * 0.92) / 84) * (opts.scale ?? 1); // head top (≈178 cm) to hips (≈95 cm) fills the height
  const facing: 1 | -1 = opts.mirror ? -1 : 1;
  const ox = w / 2 - facing * 4 * sc, oy = h * 1.04 + 95 * sc; // hips sit just below the bottom edge
  const J = Object.fromEntries(Object.entries(POSTER_POSE).map(([k, p]) => [k, [ox + p[0] * sc * facing, oy + p[1] * sc]])) as unknown as Joints;
  drawFighterArt(ctx, J, { sc, facing, look, standing: false, light: 1.15 });
}
