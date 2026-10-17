// Canvas renderer for the fight. Reads FightState; never mutates it.
import { HAIR_COLORS, SHORTS_COLORS, SKIN_TONES } from '../data/world';
import { CAGE_R, POS_NAME, clockString, dist, effRange, fm, isGround, maxStamina, roundImpact, subMarker, subZoneWidth, SUB_NAME, type CF, type FightEvent, type FightState } from './engine';
import { MOVES } from './moves';
import { GROUND_POSES, POSES, ease, lerpPose, type Pose } from './poses';
import { drawFighterArt, setArtLite, type Joints } from './fighterArt';
import { FighterAnimator, reactTo, stanceFor } from './animator';
import { resolveLook, type Look } from '../game/look';
import type { FighterSetup } from './engine';
import { t, tx as trx } from '../i18n';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Popup { text: string; x: number; y: number; life: number; color: string; big: boolean }

const GLOVE = ['#c8102e', '#111', '#1d4ed8', '#e5e5e5'];
const T = (v: number) => v;

export interface ArenaTheme { crowd: number; light: number; accent: string; matText: string; gold: boolean }

export class FightRenderer {
  ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  cam = { mx: 0, mz: 0, th: 0, zoom: 1, init: false };
  particles: Particle[] = [];
  popups: Popup[] = [];
  shake = 0;
  flash = 0;
  reducedMotion = false;
  crowd: { x: number; y: number; s: number; c: number }[] = [];
  telegraphIQ = 50;
  playerIdx = 0;
  showRange = true;
  /** Presentation only: venue look for the event (crowd size, lighting, mat branding). */
  theme: ArenaTheme = { crowd: 0.8, light: 1, accent: '#ff5a36', matText: 'FIGHT CAMP', gold: false };
  anims: [FighterAnimator, FighterAnimator] = [new FighterAnimator(), new FighterAnimator()];
  private looks = new WeakMap<FighterSetup, Look>();
  private frameDt = 1 / 60;
  /** Lite mode drops the mat texture, light pool and wire mesh when frames run long (slow / software-rendered canvas). */
  lite = false;
  private slowFrames = 0;
  private adaptQuality(dt: number) {
    if (this.lite || dt <= 0) return;
    this.slowFrames = dt > 1 / 42 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 120) { this.lite = true; setArtLite(true); }
  }
  /** Resolved cosmetic look for a fight setup (cached; derived deterministically when not stored). */
  lookOf(setup: FighterSetup): Look {
    let l = this.looks.get(setup);
    if (!l) { l = resolveLook(setup.appearance as any, { bodyType: setup.bodyType }); this.looks.set(setup, l); }
    return l;
  }

  constructor(public canvas: HTMLCanvasElement) {
    setArtLite(false);
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 420; i++) this.crowd.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8, c: Math.random() });
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(320, r.width);
    this.H = Math.max(240, r.height);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  // projection helpers
  private sc() { return (this.H * 0.47) / 190 * this.cam.zoom; }
  // the floor line drops a little as the camera zooms in, keeping heads clear of the HUD
  private groundY() { return this.H * (0.8 + Math.max(0, this.cam.zoom - 1) * 0.12); }
  project(x: number, z: number) {
    const dx = x - this.cam.mx, dz = z - this.cam.mz;
    const c = Math.cos(-this.cam.th), s = Math.sin(-this.cam.th);
    const u = dx * c - dz * s;
    const v = dx * s + dz * c;
    const sc = this.sc();
    return { x: this.W / 2 + u * sc, y: this.groundY() - v * sc * 0.3, v, u };
  }

  onEvents(evs: FightEvent[], s: FightState) {
    for (const e of evs) {
      const f = e.i >= 0 ? s.f[e.i] : null;
      const o = e.i >= 0 ? s.f[1 - e.i] : null;
      if ((e.type === 'hit' || e.type === 'counter') && o) {
        const p = this.fighterScreen(s, o.idx);
        const yOff = e.target === 'head' ? -160 : e.target === 'body' ? -115 : -45;
        const pos = { x: p.x + (o.idx === this.leftIdx(s) ? 1 : -1) * 6 * this.sc(), y: p.y + yOff * this.sc() };
        this.burst(pos.x, pos.y, e.big ? 18 : 9, e.big ? '#ffd27a' : '#fff4d6');
        if (e.big) this.shake = Math.max(this.shake, 7);
        if (e.type === 'counter') this.popup('COUNTER!', pos.x, pos.y - 30, '#ffb020', true);
        else if ((e.dmg ?? 0) > 3) this.popup(e.target === 'legs' ? 'LEG' : e.target === 'body' ? 'BODY' : 'CLEAN', pos.x, pos.y - 24, '#ffffff', false);
      }
      if (e.type === 'block' && f) {
        const p = this.fighterScreen(s, f.idx);
        this.burst(p.x, p.y - 140 * this.sc(), 5, '#9ecbff');
      }
      if (e.type === 'evade' && f) { const p = this.fighterScreen(s, f.idx); this.popup('SLIP', p.x, p.y - 190 * this.sc(), '#7dd3fc', false); }
      if (e.type === 'check' && f) { const p = this.fighterScreen(s, f.idx); this.popup('CHECKED', p.x, p.y - 70 * this.sc(), '#7dd3fc', false); }
      if (e.type === 'kd' || e.type === 'ko') { this.shake = 14; this.flash = 0.35; }
      if (e.type === 'kd' && o) { const p = this.fighterScreen(s, o.idx); this.popup('KNOCKDOWN!', p.x, p.y - 200 * this.sc(), '#ff4d3d', true); }
      if (e.type === 'ko') this.popup('KNOCKOUT!', this.W / 2, this.H * 0.35, '#ff4d3d', true);
      if (e.type === 'tap') this.popup('TAP OUT!', this.W / 2, this.H * 0.35, '#ff4d3d', true);
      if (e.type === 'td' && f) { const p = this.fighterScreen(s, f.idx); this.popup('TAKEDOWN', p.x, p.y - 150 * this.sc(), '#facc15', true); this.shake = Math.max(this.shake, 6); }
      if (e.type === 'sprawl' && f) { const p = this.fighterScreen(s, f.idx); this.popup('SPRAWL', p.x, p.y - 160 * this.sc(), '#7dd3fc', true); }
      if (e.type === 'stun' && f) { const p = this.fighterScreen(s, f.idx); this.popup('HURT!', p.x, p.y - 200 * this.sc(), '#ff7a59', true); }
      if (e.type === 'pos' && f && e.big) this.popup(t(POS_NAME[s.pos]).toUpperCase(), this.W / 2, this.H * 0.28, '#facc15', true);
      if (e.type === 'sub') this.popup(s.sub ? t(SUB_NAME[s.sub.kind]).toUpperCase() : e.text?.split(/locks up an? /)[1]?.replace('!', '').toUpperCase() ?? 'SUBMISSION', this.W / 2, this.H * 0.26, '#f472b6', true);
    }
  }

  private burst(x: number, y: number, n: number, color: string) {
    if (this.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.35 + Math.random() * 0.25, max: 0.6, color, size: 1.5 + Math.random() * 2.5 });
    }
  }
  private popup(text: string, x: number, y: number, color: string, big: boolean) {
    text = trx(text);
    this.popups.push({ text, x, y, life: big ? 1.3 : 0.7, color, big });
    if (this.popups.length > 8) this.popups.shift();
  }

  /** Which fighter appears on the left of the screen (player when possible). */
  leftIdx(_s: FightState) { return this.playerIdx; }

  fighterScreen(s: FightState, i: number) {
    const f = s.f[i];
    if (isGround(s.pos) || s.sub) {
      const a = this.project((s.f[0].x + s.f[1].x) / 2, (s.f[0].z + s.f[1].z) / 2);
      return { x: a.x, y: a.y };
    }
    return this.project(f.x, f.z);
  }

  updateCamera(s: FightState, dt: number) {
    const L = s.f[this.leftIdx(s)], R = s.f[1 - this.leftIdx(s)];
    const mx = (L.x + R.x) / 2, mz = (L.z + R.z) / 2;
    let th = Math.atan2(R.z - L.z, R.x - L.x);
    if (!this.cam.init) { this.cam = { mx, mz, th, zoom: 1, init: true }; return; }
    if (isGround(s.pos) || s.pos === 'clinch') th = this.cam.th; // hold camera during grappling
    let dth = th - this.cam.th;
    while (dth > Math.PI) dth -= Math.PI * 2;
    while (dth < -Math.PI) dth += Math.PI * 2;
    const k = Math.min(1, dt * 6);
    this.cam.th += dth * k;
    this.cam.mx += (mx - this.cam.mx) * k;
    this.cam.mz += (mz - this.cam.mz) * k;
    const d = dist(s);
    const z = isGround(s.pos) ? 1.3 : Math.max(0.8, Math.min(1.28, 320 / (d + 170)));
    this.cam.zoom += (z - this.cam.zoom) * Math.min(1, dt * 3);
  }

  render(s: FightState, dt: number, opts: { paused: boolean; hint?: string; hud?: boolean }) {
    const { ctx } = this;
    this.frameDt = dt;
    this.updateCamera(s, dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let sx = 0, sy = 0;
    if (this.shake > 0 && !this.reducedMotion) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 40);
    } else this.shake = 0;
    ctx.save();
    ctx.translate(sx, sy);
    this.adaptQuality(dt);
    this.drawBackground();
    this.drawCage(s, 'back');
    this.drawFighters(s);
    this.drawCage(s, 'front');
    this.drawFx(dt);
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * (this.reducedMotion ? 0.3 : 0.8)})`;
      ctx.fillRect(0, 0, this.W, this.H);
      this.flash = Math.max(0, this.flash - dt);
    }
    if (opts.hud !== false) {
      this.drawHud(s);
      if (s.sub) this.drawSub(s);
    }
    if (opts.paused) {
      ctx.fillStyle = 'rgba(5,6,10,0.45)';
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  private matPattern: CanvasPattern | null = null;
  private crowdPal = ['#2b3140', '#3a2f2f', '#2e3a33', '#383447', '#45392c', '#2a3846', '#4a4a52', '#3b2633'];

  private bgCache: { key: string; bg: HTMLCanvasElement; crowd: HTMLCanvasElement } | null = null;

  /** Static layers (backdrop, lighting rig, crowd strip) are rendered once per size/theme and blitted each frame. */
  private bgLayers() {
    const { W, H } = this;
    const key = `${W}x${H}x${this.dpr}|${this.theme.crowd}|${this.theme.light}|${this.theme.accent}|${this.theme.gold}`;
    if (this.bgCache?.key === key) return this.bgCache;
    const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.round(w * this.dpr); c.height = Math.round(h * this.dpr); const x = c.getContext('2d')!; x.scale(this.dpr, this.dpr); return { c, x }; };
    const L = this.theme.light;
    const { c: bg, x: ctx } = mk(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05060a'); g.addColorStop(0.5, '#0e1119'); g.addColorStop(1, '#090a0f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(30,34,44,0.9)'; ctx.fillRect(0, H * 0.02, W, 3);
    for (let i = 0; i < 7; i++) {
      const x = ((i + 0.5) / 7) * W;
      ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.fillRect(x - 6, H * 0.02 + 3, 12, 3);
      const cone = ctx.createLinearGradient(0, H * 0.03, 0, H * 0.7);
      cone.addColorStop(0, `rgba(255,240,215,${0.05 * L})`); cone.addColorStop(1, 'rgba(255,240,215,0)');
      ctx.fillStyle = cone;
      ctx.beginPath(); ctx.moveTo(x - 8, H * 0.03); ctx.lineTo(x + 8, H * 0.03); ctx.lineTo(x + W * 0.09, H * 0.7); ctx.lineTo(x - W * 0.09, H * 0.7); ctx.closePath(); ctx.fill();
    }
    // crowd strip twice the screen width so it can scroll with the camera angle
    const { c: crowd, x: cx } = mk(W * 2, H * 0.5);
    const nCrowd = Math.round(this.crowd.length * this.theme.crowd);
    const rows = [...this.crowd.slice(0, nCrowd)].sort((a, b) => a.y - b.y);
    for (let ci = 0; ci < rows.length; ci++) {
      const c = rows[ci];
      for (const rep of [0, 1]) {
        const x = (c.x + rep) * W;
        const depth = c.y;
        const y = H * 0.1 + depth * H * 0.33;
        const r = (2.2 + c.s * 2.2) * (0.55 + depth * 0.9);
        cx.globalAlpha = 0.35 + depth * 0.4;
        cx.fillStyle = this.crowdPal[(ci * 7) % this.crowdPal.length];
        cx.beginPath(); cx.ellipse(x, y + r * 1.9, r * 1.7, r * 1.1, 0, Math.PI, 0); cx.fill();
        cx.fillStyle = c.c > 0.5 ? '#3a2c24' : '#2a2320';
        cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
        if (c.c > 0.985) { cx.globalAlpha = 0.85; cx.fillStyle = '#e8f1ff'; cx.fillRect(x - 1, y - r - 3, 2, 3); }
      }
    }
    cx.globalAlpha = 1;
    const by = H * 0.45;
    const bgr = cx.createLinearGradient(0, by - 8, 0, by + 26);
    bgr.addColorStop(0, 'rgba(10,11,16,0)'); bgr.addColorStop(0.4, 'rgba(10,11,16,0.85)'); bgr.addColorStop(1, 'rgba(10,11,16,0.95)');
    cx.fillStyle = bgr; cx.fillRect(0, by - 8, W * 2, H * 0.5 - by + 8);
    cx.fillStyle = this.theme.gold ? 'rgba(250,204,21,0.35)' : hexA(this.theme.accent, 0.3); cx.fillRect(0, by + 6, W * 2, 2);
    // overall light pool (static: baked into the backdrop)
    const sp = ctx.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, W * 0.62);
    sp.addColorStop(0, this.theme.gold ? `rgba(255,220,140,${0.12 * L})` : `rgba(255,240,210,${0.09 * L})`);
    sp.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
    this.bgCache = { key, bg, crowd };
    return this.bgCache;
  }

  private drawBackground() {
    const { ctx, W, H } = this;
    const layers = this.bgLayers();
    ctx.drawImage(layers.bg, 0, 0, W, H);
    const off = ((this.cam.th / (Math.PI * 2)) % 1 + 1) % 1;
    ctx.drawImage(layers.crowd, -off * W, 0, W * 2, H * 0.5);
  }

  private octagon(r = CAGE_R) {
    const pts: { x: number; z: number }[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
    return pts;
  }

  private getMatPattern() {
    if (this.matPattern) return this.matPattern;
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d')!;
    for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(Math.random() * 96, Math.random() * 96, 1.2, 1.2); }
    x.strokeStyle = 'rgba(255,255,255,0.025)'; for (let i = 0; i < 96; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 96); x.stroke(); }
    this.matPattern = this.ctx.createPattern(c, 'repeat');
    return this.matPattern;
  }

  private drawCage(s: FightState, layer: 'back' | 'front') {
    const { ctx } = this;
    const pts = this.octagon().map((p) => this.project(p.x, p.z));
    const sc = this.sc();
    const fenceH = 125 * sc;
    const accent = this.theme.gold ? '#facc15' : this.theme.accent;
    if (layer === 'back') {
      // apron outside the fence
      const apron = this.octagon(CAGE_R + 34).map((p) => this.project(p.x, p.z));
      ctx.beginPath(); apron.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.fillStyle = '#0d0f14'; ctx.fill();
      // mat
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      const c = this.project(0, 0);
      const g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, CAGE_R * sc * 1.1);
      g.addColorStop(0, '#3a3f4c');
      g.addColorStop(0.6, '#272b36');
      g.addColorStop(1, '#16181f');
      ctx.fillStyle = g;
      ctx.fill();
      const pat = this.getMatPattern();
      if (pat && !this.lite) { ctx.fillStyle = pat; ctx.fill(); } // canvas texture (same path, no clipping needed)
      // light pool that follows the fighters
      const f0 = this.project((s.f[0].x + s.f[1].x) / 2, (s.f[0].z + s.f[1].z) / 2);
      const lp = ctx.createRadialGradient(f0.x, f0.y, 4, f0.x, f0.y, 170 * sc);
      lp.addColorStop(0, `rgba(255,246,228,${0.1 * this.theme.light})`); lp.addColorStop(1, 'rgba(255,246,228,0)');
      if (!this.lite) { ctx.fillStyle = lp; ctx.fill(); }
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
      // centre logo ellipse
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, 0.3);
      ctx.rotate(-this.cam.th);
      ctx.strokeStyle = hexA(accent, 0.4);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 90 * sc, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 98 * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.font = `700 ${60 * sc}px Oswald, Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.theme.matText, 0, 0);
      if (this.theme.gold) { ctx.font = `600 ${16 * sc}px Inter, sans-serif`; ctx.fillStyle = 'rgba(250,204,21,0.35)'; ctx.fillText(t('WORLD CHAMPIONSHIP'), 0, 44 * sc); }
      ctx.restore();
    }
    // fence segments
    for (let k = 0; k < 8; k++) {
      const a = pts[k], b = pts[(k + 1) % 8];
      const vMid = (a.v + b.v) / 2;
      const isFront = vMid < 0; // v negative = toward camera (drawn lower)
      if ((layer === 'front') !== isFront) continue;
      const alpha = layer === 'front' ? 0.16 : 0.75;
      ctx.fillStyle = `rgba(30,34,44,${layer === 'front' ? 0.05 : 0.4})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - fenceH); ctx.lineTo(a.x, a.y - fenceH); ctx.closePath();
      ctx.fill();
      // chain-link mesh: diagonal wires clipped analytically to the panel (no canvas clip — cheaper)
      if (layer === 'back' && !this.lite) {
        ctx.strokeStyle = `rgba(170,180,200,${alpha * 0.2})`;
        ctx.lineWidth = 1;
        const segW = Math.hypot(b.x - a.x, b.y - a.y) || 1, n = Math.max(5, Math.round(segW / 12));
        const span = 3 / n; // horizontal travel of one wire from the mat to the top rail (as a fraction of the panel)
        const P = (t: number, h: number) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - h * fenceH] as const;
        ctx.beginPath();
        for (let i = -Math.ceil(span * n); i <= n; i++) {
          const t0 = i / n;
          for (const dir of [1, -1]) {
            // wire from (t0, 0) to (t0 + dir*span, 1), clipped to 0 ≤ t ≤ 1
            let ta = dir === 1 ? t0 : t0 + span, ha = dir === 1 ? 0 : 0;
            let tb = dir === 1 ? t0 + span : t0, hb = 1;
            if (dir === -1) { ta = t0 + span; tb = t0; }
            const clip = (t: number, h: number, ot: number, oh: number): [number, number] => {
              if (t < 0) return [0, h + (oh - h) * ((0 - t) / (ot - t))];
              if (t > 1) return [1, h + (oh - h) * ((1 - t) / (ot - t))];
              return [t, h];
            };
            if (Math.max(ta, tb) < 0 || Math.min(ta, tb) > 1) continue;
            const A = clip(ta, ha, tb, hb), B = clip(tb, hb, ta, ha);
            const pa = P(A[0], A[1]), pb = P(B[0], B[1]);
            ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
          }
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(170,180,200,${alpha * 0.25})`; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 1; j < 6; j++) { const h = (fenceH * j) / 6; ctx.moveTo(a.x, a.y - h); ctx.lineTo(b.x, b.y - h); }
        ctx.stroke();
      }
      // padded top rail
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(14,15,20,${Math.min(1, alpha + 0.25)})`;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - fenceH); ctx.lineTo(b.x, b.y - fenceH); ctx.stroke();
      ctx.strokeStyle = hexA(accent, alpha);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - fenceH - 1); ctx.lineTo(b.x, b.y - fenceH - 1); ctx.stroke();
      // padded posts with a highlight
      for (const p of [a, b]) {
        ctx.strokeStyle = `rgba(10,10,14,${Math.min(1, alpha + 0.25)})`;
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - fenceH - 6); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.12})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - 2, p.y - 4); ctx.lineTo(p.x - 2, p.y - fenceH); ctx.stroke();
        ctx.strokeStyle = hexA(accent, alpha * 0.8); ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - fenceH * 0.55); ctx.lineTo(p.x, p.y - fenceH * 0.62); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }

  // ───────── fighters
  private poseFor(s: FightState, f: CF): { pose: Pose; key: string } {
    const st = f.state;
    // style-specific stance with breathing, weight shift and fatigue (presentation only)
    const fat = 1 - fm(f);
    const base = stanceFor(f, s.t, fat);
    if (s.phase === 'over' && s.outcome) {
      if (s.outcome.winner === f.idx) return { pose: POSES.victory, key: 'victory' };
      if (s.outcome.winner === 1 - f.idx && s.outcome.method !== 'SUB' && s.outcome.method.length <= 3 && ['KO', 'TKO'].includes(s.outcome.method)) return { pose: POSES.down, key: 'down' };
    }
    if (s.pos === 'clinch') {
      let p = s.top === f.idx ? POSES.clinch : POSES.clinchDefend;
      if (st === 'attack' && f.move) p = lerpPose(p, POSES[MOVES[f.move].pose] ?? p, this.attackT(f));
      return { pose: p, key: 'clinch' };
    }
    switch (st) {
      case 'attack': {
        const m = MOVES[f.move!];
        const target = POSES[m.pose] ?? POSES.jab;
        return { pose: lerpPose(f.guardLevel > 0.3 ? POSES.guardHigh : base, target, this.attackT(f)), key: m.pose };
      }
      case 'evade': return { pose: lerpPose(base, POSES.evade, ease(Math.sin((f.stateT / f.stateDur) * Math.PI))), key: 'evade' };
      case 'stun': return { pose: lerpPose(base, POSES.stun, 0.85), key: 'stun' };
      case 'down': return { pose: POSES.down, key: 'down' };
      case 'getup': return { pose: lerpPose(POSES.getup, base, ease(f.stateT / f.stateDur)), key: 'getup' };
      case 'shoot': return { pose: lerpPose(base, POSES.shoot, ease(f.stateT / f.stateDur * 1.3)), key: 'shoot' };
      case 'sprawled': return { pose: POSES.sprawled, key: 'sprawled' };
      case 'whiff': return { pose: lerpPose(base, POSES.evade, 0.5), key: 'whiff' };
      case 'clinchEntry': return { pose: lerpPose(base, POSES.clinch, ease(f.stateT / f.stateDur)), key: 'clinch' };
    }
    const o = s.f[1 - f.idx];
    if (o.state === 'shoot' && f.sprawlBonus > 0) return { pose: POSES.sprawl, key: 'sprawl' };
    if (f.guardLevel > 0) return { pose: lerpPose(base, f.guard === 'low' ? POSES.guardLow : POSES.guardHigh, ease(f.guardLevel)), key: 'guard' };
    return { pose: base, key: 'stance' };
  }

  private attackT(f: CF) {
    if (f.phase === 'startup') return ease(f.stateT / Math.max(0.01, f.ms));
    if (f.phase === 'active') return 1;
    return 1 - ease((f.stateT - f.ms - f.ma) / Math.max(0.01, f.mr));
  }

  private drawFighters(s: FightState) {
    const L = this.leftIdx(s);
    if (isGround(s.pos) || s.sub && isGround(s.sub.from)) {
      this.drawGround(s);
      return;
    }
    // draw the farther fighter first (higher on screen)
    const order = [0, 1].sort((a, b) => this.project(s.f[a].x, s.f[a].z).y - this.project(s.f[b].x, s.f[b].z).y);
    for (const i of order) {
      const f = s.f[i];
      const p = this.project(f.x, f.z);
      const { pose, key } = this.poseFor(s, f);
      const facing = i === L ? 1 : -1;
      const o = s.f[1 - i];
      const ax = o.x - f.x, az = o.z - f.z, al = Math.hypot(ax, az) || 1;
      const kick = f.state === 'attack' && !!f.move && ['lowkick', 'bodykick', 'headkick', 'teep', 'knee'].includes(MOVES[f.move].pose);
      const plant = !kick && !['down', 'getup', 'shoot', 'sprawled', 'sprawl', 'victory', 'clinch'].includes(key) && s.pos === 'standing';
      const animated = this.anims[i].update(reactTo(f, pose, s.t), { dt: this.frameDt, mode: 'stand', f, axis: [ax / al, az / al], plant, fast: f.state === 'attack', facing });
      const persp = this.persp(p.v);
      this.shadow(p.x, p.y, 34 * persp);
      this.drawFigure(animated, p.x, p.y, facing, f, s, { persp, standing: true });
    }
    this.drawTelegraph(s);
    if (this.showRange && s.pos === 'standing') this.drawRangeBar(s);
  }

  private drawGround(s: FightState) {
    const mid = this.project((s.f[0].x + s.f[1].x) / 2, (s.f[0].z + s.f[1].z) / 2);
    let key: string = s.pos;
    if (s.sub) key = s.sub.kind === 'rnc' ? 'back' : s.sub.kind;
    const scene = GROUND_POSES[key] ?? GROUND_POSES.guard;
    // which fighter is on top in the scene
    let topIdx = s.top;
    if (s.sub && (s.sub.kind === 'triangle' || (s.sub.kind === 'guillotine' && s.top !== s.sub.attacker))) topIdx = 1 - s.sub.attacker;
    if (s.sub && s.sub.kind === 'armbar') topIdx = s.sub.attacker;
    if (s.sub && s.sub.kind === 'rnc') topIdx = s.sub.attacker;
    if (topIdx < 0) topIdx = 0;
    // the top fighter faces right if he is the left-side fighter
    const flip = topIdx === this.leftIdx(s) ? 1 : -1;
    this.shadow(mid.x, mid.y, 80);
    const bot = s.f[1 - topIdx], top = s.f[topIdx];
    const bob = (f: CF): Pose => {
      if (f.state !== 'attack') return f.state === 'grapple' ? jiggle(scene[f === top ? 'top' : 'bottom'], s.t) : scene[f === top ? 'top' : 'bottom'];
      const t = this.attackT(f);
      const base = scene[f === top ? 'top' : 'bottom'];
      const strike = { ...base, rHand: [base.rHand[0] + 30 * t, base.rHand[1] + 50 * t] as [number, number], rElbow: [base.rElbow[0] + 16 * t, base.rElbow[1] + 30 * t] as [number, number] };
      return strike;
    };
    const drawOrder = key === 'back' || key === 'armbar' ? [top, bot] : [bot, top];
    for (const f of drawOrder) {
      const pose = this.anims[f.idx].update(reactTo(f, bob(f), s.t), { dt: this.frameDt, mode: 'ground', f, axis: [1, 0], plant: false, fast: f.state === 'attack', facing: flip });
      // the bottom fighter lies on his back in every scene except back control
      const onBack = f === bot && key !== 'back';
      this.drawFigure(pose, mid.x, mid.y, flip, f, s, { persp: this.persp(mid.v), standing: false, flipFront: onBack });
    }
  }

  private shadow(x: number, y: number, r: number) {
    const { ctx } = this;
    const sc = this.sc();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * sc, r * sc * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Depth cue: fighters farther from the camera are drawn slightly smaller. */
  private persp(v: number) { return Math.max(0.9, Math.min(1.1, 1 - v * 0.0011)); }

  private drawFigure(pose: Pose, ox: number, oy: number, facing: number, f: CF, s: FightState, o: { persp?: number; standing?: boolean; flipFront?: boolean } = {}) {
    const { ctx } = this;
    const sc = this.sc() * (f.setup.heightCm / 180) * (o.persp ?? 1);
    const look = this.lookOf(f.setup);
    // arms drawn to the fighter's real reach-to-height ratio (reach is gameplay data; this only visualises it)
    const armK = Math.max(0.94, Math.min(1.07, (f.setup.reachCm / f.setup.heightCm) / 1.02));
    const sh = pose.neck;
    const arm = (p: [number, number]): [number, number] => [sh[0] + (p[0] - sh[0]) * armK, sh[1] + (p[1] - sh[1]) * armK];
    const P = (p: [number, number]) => [ox + p[0] * sc * facing, oy + p[1] * sc] as [number, number];
    const J: Joints = {
      head: P(pose.head), neck: P(pose.neck), hip: P(pose.hip),
      fElbow: P(arm(pose.fElbow)), fHand: P(arm(pose.fHand)), rElbow: P(arm(pose.rElbow)), rHand: P(arm(pose.rHand)),
      fKnee: P(pose.fKnee), fFoot: P(pose.fFoot), rKnee: P(pose.rKnee), rFoot: P(pose.rFoot),
    };
    const ko = f.state === 'down' || (s.phase === 'over' && s.outcome?.winner === 1 - f.idx && ['KO', 'TKO'].includes(s.outcome.method));
    drawFighterArt(ctx, J, {
      sc, facing: facing as 1 | -1, look, flipFront: o.flipFront, hit: f.hitFlash > 0 ? Math.min(1, f.hitFlash / 0.2) : 0,
      headDamage: this.reducedMotion ? 0 : f.head, eyesClosed: ko, sway: this.anims[f.idx].sway, standing: o.standing, light: this.theme.light,
    });
    // marker above the player
    if (f.setup.isPlayer && s.pos === 'standing') {
      const head = J.head;
      ctx.fillStyle = 'rgba(255,90,54,0.95)';
      ctx.beginPath();
      ctx.moveTo(head[0], head[1] - 26 * sc); ctx.lineTo(head[0] - 5, head[1] - 26 * sc - 8); ctx.lineTo(head[0] + 5, head[1] - 26 * sc - 8); ctx.closePath();
      ctx.fill();
    }
  }

  /** Opponent attack tells — show earlier with higher Fight IQ. */
  private drawTelegraph(s: FightState) {
    const me = s.f[this.playerIdx], o = s.f[1 - this.playerIdx];
    const { ctx } = this;
    const threshold = 0.7 - this.telegraphIQ / 200;
    let label = '', col = '';
    if (o.state === 'attack' && o.phase === 'startup' && o.move) {
      const prog = o.stateT / Math.max(0.01, o.ms);
      if (prog >= threshold) {
        const m = MOVES[o.move];
        label = m.target === 'head' ? '▲ HEAD' : m.target === 'body' ? '■ BODY' : '▼ LEGS';
        col = m.target === 'head' ? '#ff5a36' : m.target === 'body' ? '#facc15' : '#60a5fa';
      }
    } else if (o.state === 'shoot') { label = '⇣ SHOT! (R / Space)'; col = '#f472b6'; }
    else if (o.state === 'grapple' && o.attempt) { label = 'GRAPPLE! (Q / F to defend)'; col = '#f472b6'; }
    if (!label) return;
    label = t(label);
    const p = this.fighterScreen(s, o.idx);
    const y = p.y - 215 * this.sc();
    ctx.font = '700 14px Oswald, Impact, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, p.x - w / 2, y - 12, w, 22, 6); ctx.fill();
    ctx.fillStyle = col;
    ctx.fillText(label, p.x, y + 4);
    void me;
  }

  private drawRangeBar(s: FightState) {
    const { ctx, W, H } = this;
    const me = s.f[this.playerIdx];
    const d = dist(s);
    const w = Math.min(360, W * 0.35), x0 = W / 2 - w / 2, y = H - 30;
    const max = 170;
    const zones = [
      { a: 0, b: 72, c: '#a855f7', l: 'CLINCH' },
      { a: 72, b: effRange(me, MOVES.cross)[1], c: '#ff5a36', l: 'PUNCH' },
      { a: effRange(me, MOVES.cross)[1], b: effRange(me, MOVES.headkick)[1], c: '#facc15', l: 'KICK' },
      { a: effRange(me, MOVES.headkick)[1], b: max, c: '#475569', l: 'OUT' },
    ];
    ctx.globalAlpha = 0.9;
    for (const z of zones) {
      const xa = x0 + (Math.min(max, z.a) / max) * w, xb = x0 + (Math.min(max, z.b) / max) * w;
      ctx.fillStyle = z.c + '55';
      ctx.fillRect(xa, y, xb - xa, 6);
    }
    const mx = x0 + (Math.min(max, d) / max) * w;
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx - 1.5, y - 5, 3, 16);
    const zone = zones.find((z) => d >= z.a && d < z.b) ?? zones[3];
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = zone.c;
    ctx.fillText(t('RANGE: {zone}', { zone: t(zone.l) }), W / 2, y - 8);
    ctx.globalAlpha = 1;
  }

  private drawFx(dt: number) {
    const { ctx } = this;
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= dt * (p.big ? 18 : 40);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.font = `700 ${p.big ? 30 : 15}px Oswald, Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  // ───────── HUD
  private drawHud(s: FightState) {
    const { ctx, W } = this;
    const L = s.f[this.playerIdx], R = s.f[1 - this.playerIdx];
    const panelW = Math.min(360, W * 0.32);
    this.fighterPanel(L, 14, 12, panelW, 'left', s);
    this.fighterPanel(R, W - panelW - 14, 12, panelW, 'right', s);
    // clock
    const cw = 150;
    ctx.fillStyle = 'rgba(8,9,13,0.85)';
    roundRect(ctx, W / 2 - cw / 2, 10, cw, 66, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,54,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa3b2';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText(t('ROUND {n} OF {m}', { n: s.round, m: s.cfg.rounds }), W / 2, 27);
    ctx.fillStyle = '#fff';
    ctx.font = '700 28px Oswald, Impact, sans-serif';
    ctx.fillText(clockString(s), W / 2, 56);
    ctx.fillStyle = '#facc15';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText(s.sub ? t(SUB_NAME[s.sub.kind]).toUpperCase() : t(POS_NAME[s.pos]).toUpperCase() + (s.top >= 0 && s.pos !== 'standing' ? ' · ' + t(s.pos === 'clinch' ? '{name} controls' : '{name} on top', { name: trx(s.f[s.top].setup.short) }) : ''), W / 2, 92);
    // round momentum
    const a = roundImpact(L.rounds[s.round - 1] ?? ({} as any), { ws: 1, wg: 1 }) || 0;
    const b = roundImpact(R.rounds[s.round - 1] ?? ({} as any), { ws: 1, wg: 1 }) || 0;
    const tot = a + b || 1;
    const mw = 150, my = 100;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(W / 2 - mw / 2, my, mw, 4);
    ctx.fillStyle = '#ff5a36';
    ctx.fillRect(W / 2 - mw / 2, my, mw * (a / tot), 4);
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(W / 2 - mw / 2 + mw * (a / tot), my, mw * (b / tot), 4);
    ctx.fillStyle = '#9aa3b2';
    ctx.font = '500 9px Inter, sans-serif';
    ctx.fillText(t('ROUND MOMENTUM'), W / 2, my + 15);
  }

  private fighterPanel(f: CF, x: number, y: number, w: number, side: 'left' | 'right', s: FightState) {
    const { ctx } = this;
    const accent = f.setup.isPlayer ? '#ff5a36' : '#60a5fa';
    ctx.fillStyle = 'rgba(8,9,13,0.82)';
    roundRect(ctx, x, y, w, 86, 10); ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(side === 'left' ? x : x + w - 4, y + 8, 4, 70);
    const tx = side === 'left' ? x + 14 : x + w - 14;
    ctx.textAlign = side;
    ctx.fillStyle = '#fff';
    ctx.font = '700 17px Oswald, Impact, sans-serif';
    ctx.fillText(trx(f.setup.name).toUpperCase(), tx, y + 24);
    ctx.fillStyle = '#9aa3b2';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillText(`${trx(f.setup.record ?? '')}  ·  ${t(f.setup.stance)}`, tx, y + 39);
    // stamina
    const bx = x + 14, bw = w - 28 - 70;
    const sx = side === 'left' ? bx : x + 14 + 70;
    const mx = maxStamina(f);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(sx, y + 50, bw, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(sx, y + 50, bw * (mx / 100), 9);
    const sp = f.stamina / 100;
    ctx.fillStyle = sp > 0.35 ? '#22c55e' : sp > 0.18 ? '#facc15' : '#ef4444';
    ctx.fillRect(sx, y + 50, bw * sp, 9);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = side;
    ctx.fillText(t('STAMINA'), side === 'left' ? sx : sx + bw, y + 72);
    // damage silhouette (head/body/legs)
    const dx = side === 'left' ? x + w - 52 : x + 22;
    const col = (v: number) => `hsl(${Math.max(0, 120 - v * 1.2)}, 75%, ${v > 85 ? 45 : 50}%)`;
    ctx.fillStyle = col(f.head); ctx.beginPath(); ctx.arc(dx + 15, y + 22, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col(f.body); roundRect(ctx, dx + 7, y + 31, 16, 22, 4); ctx.fill();
    ctx.fillStyle = col(f.legs); ctx.fillRect(dx + 8, y + 55, 6, 22); ctx.fillRect(dx + 16, y + 55, 6, 22);
    if (f.state === 'stun') { ctx.fillStyle = '#ff7a59'; ctx.font = '700 10px Inter'; ctx.textAlign = 'center'; ctx.fillText(t('HURT'), dx + 15, y + 9); }
    void T; void s;
  }

  private drawSub(s: FightState) {
    const sub = s.sub!;
    const { ctx, W, H } = this;
    const me = s.f[this.playerIdx];
    const attacking = sub.attacker === this.playerIdx;
    const w = Math.min(520, W * 0.6), x = W / 2 - w / 2, y = Math.max(178, H * 0.2);
    ctx.fillStyle = 'rgba(8,9,13,0.88)';
    roundRect(ctx, x - 16, y - 54, w + 32, 112, 12); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = attacking ? '#f472b6' : '#ff5a36';
    ctx.font = '700 18px Oswald, Impact, sans-serif';
    ctx.fillText(`${t(SUB_NAME[sub.kind]).toUpperCase()} — ${attacking ? t('FINISH IT!') : t('DEFEND!')}`, W / 2, y - 30);
    // timing bar
    const zw = subZoneWidth(me, attacking);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y - 8, w, 16);
    ctx.fillStyle = attacking ? 'rgba(244,114,182,0.55)' : 'rgba(34,197,94,0.55)';
    ctx.fillRect(x + w * (0.5 - zw / 2), y - 8, w * zw, 16);
    const mk = subMarker(sub);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * mk - 2, y - 13, 4, 26);
    // meters
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f472b6';
    ctx.fillText(t('LOCK {n}%', { n: Math.round(sub.lock) }), x, y + 30);
    ctx.fillStyle = 'rgba(244,114,182,0.25)'; ctx.fillRect(x, y + 36, w / 2 - 10, 6);
    ctx.fillStyle = '#f472b6'; ctx.fillRect(x, y + 36, (w / 2 - 10) * Math.min(1, sub.lock / 100), 6);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#22c55e';
    ctx.fillText(t('ESCAPE {n}%', { n: Math.round(sub.escape) }), x + w, y + 30);
    ctx.fillStyle = 'rgba(34,197,94,0.25)'; ctx.fillRect(x + w / 2 + 10, y + 36, w / 2 - 10, 6);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(x + w / 2 + 10, y + 36, (w / 2 - 10) * Math.min(1, sub.escape / 100), 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(attacking ? t('Press G (or F) while the marker is in the pink zone') : t('Press SPACE (or F) while the marker is in the green zone'), W / 2, y + 52);
  }
}

function jiggle(p: Pose, t: number): Pose {
  const j = Math.sin(t * 22) * 2;
  return { ...p, hip: [p.hip[0] + j, p.hip[1]], neck: [p.neck[0] - j, p.neck[1]] };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b);
  return `rgb(${r},${g},${b})`;
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
