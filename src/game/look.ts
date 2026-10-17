// Fighter appearance ("look") — the full cosmetic model used by the fight renderer and portraits.
// Purely cosmetic: nothing here feeds attributes, reach, height or any combat calculation.
//
// Storage: `Appearance.look` (optional). Older saves and AI fighters without a stored look get one derived
// deterministically — from the legacy appearance indices, and for AI fighters from their id — so a fighter looks
// the same across sessions, saves and loads.
import { storage } from './storage';
import { RNG } from './rng';
import { HAIR_COLORS, SHORTS_COLORS, SKIN_TONES } from '../data/world';
import type { Appearance } from './types';

// ───────────────────────────── option catalogues
export const HAIR = [
  { id: 'bald', name: 'Bald' }, { id: 'shaved', name: 'Shaved' }, { id: 'buzz', name: 'Buzz cut' }, { id: 'crew', name: 'Crew cut' },
  { id: 'highfade', name: 'High fade' }, { id: 'midfade', name: 'Mid fade (textured top)' }, { id: 'quiff', name: 'Fade with quiff' },
  { id: 'medium', name: 'Medium swept' }, { id: 'curly', name: 'Short curls' }, { id: 'afro', name: 'Afro' }, { id: 'mohawk', name: 'Mohawk' },
  { id: 'cornrows', name: 'Cornrows' }, { id: 'braids', name: 'Braids, tied back' }, { id: 'ponytail', name: 'Long, ponytail' },
  { id: 'bun', name: 'Man bun' }, { id: 'long', name: 'Long, loose' },
] as const;
export type HairId = (typeof HAIR)[number]['id'];

export const BEARDS = [
  { id: 'none', name: 'Clean-shaven' }, { id: 'stubble', name: 'Light stubble' }, { id: 'stubble2', name: 'Heavy stubble' },
  { id: 'short', name: 'Short beard' }, { id: 'full', name: 'Full beard' }, { id: 'long', name: 'Long beard' },
  { id: 'goatee', name: 'Goatee' }, { id: 'chinstrap', name: 'Chin strap' }, { id: 'soulpatch', name: 'Soul patch' },
] as const;
export type BeardId = (typeof BEARDS)[number]['id'];

export const MOUSTACHES = [
  { id: 'none', name: 'None' }, { id: 'classic', name: 'Classic' }, { id: 'horseshoe', name: 'Horseshoe' }, { id: 'pencil', name: 'Pencil' }, { id: 'chevron', name: 'Chevron' },
] as const;
export type MoustacheId = (typeof MOUSTACHES)[number]['id'];

export const HEAD_SHAPES = [{ id: 'oval', name: 'Oval' }, { id: 'round', name: 'Round' }, { id: 'square', name: 'Square' }, { id: 'long', name: 'Long' }] as const;
export type HeadShape = (typeof HEAD_SHAPES)[number]['id'];
export const EYES = [{ id: 'almond', name: 'Almond' }, { id: 'round', name: 'Round' }, { id: 'narrow', name: 'Narrow' }, { id: 'deep', name: 'Deep-set' }] as const;
export type EyeShape = (typeof EYES)[number]['id'];
export const TORSOS = [{ id: 'v', name: 'V-taper' }, { id: 'straight', name: 'Straight' }, { id: 'thick', name: 'Thick / barrel' }] as const;
export type TorsoShape = (typeof TORSOS)[number]['id'];

export const SHORTS_STYLES = [
  { id: 'solid', name: 'Solid' }, { id: 'stripe', name: 'Side stripe' }, { id: 'panel', name: 'Side panel' }, { id: 'split', name: 'Two-tone split' },
  { id: 'chevron', name: 'Chevrons' }, { id: 'flame', name: 'Flames' }, { id: 'camo', name: 'Camo' },
] as const;
export type ShortsStyle = (typeof SHORTS_STYLES)[number]['id'];
export const WALKOUT_TOPS = [{ id: 'none', name: 'Bare / shirtless' }, { id: 'tee', name: 'Team tee' }, { id: 'hoodie', name: 'Hoodie' }, { id: 'jacket', name: 'Track jacket' }, { id: 'robe', name: 'Robe' }] as const;
export type WalkoutTop = (typeof WALKOUT_TOPS)[number]['id'];

export const TATTOO_DESIGNS = [
  { id: 'tribal', name: 'Tribal band', kind: 'band' }, { id: 'geo', name: 'Geometric band', kind: 'band' }, { id: 'waves', name: 'Wave band', kind: 'band' },
  { id: 'mandala', name: 'Mandala', kind: 'piece' }, { id: 'sun', name: 'Sun', kind: 'piece' }, { id: 'rose', name: 'Rose', kind: 'piece' },
  { id: 'wings', name: 'Wings', kind: 'piece' }, { id: 'stars', name: 'Stars', kind: 'piece' }, { id: 'skull', name: 'Skull', kind: 'piece' },
  { id: 'dagger', name: 'Dagger', kind: 'piece' }, { id: 'compass', name: 'Compass rose', kind: 'piece' }, { id: 'script', name: 'Lettering', kind: 'text' },
] as const;
export type TattooDesign = (typeof TATTOO_DESIGNS)[number]['id'];

export const TATTOO_REGIONS = [
  { id: 'leadUpperArm', name: 'Lead upper arm' }, { id: 'rearUpperArm', name: 'Rear upper arm' }, { id: 'leadForearm', name: 'Lead forearm' },
  { id: 'rearForearm', name: 'Rear forearm' }, { id: 'chest', name: 'Chest' }, { id: 'abdomen', name: 'Stomach / ribs' }, { id: 'upperBack', name: 'Upper back' },
  { id: 'lowerBack', name: 'Lower back' }, { id: 'neck', name: 'Neck' }, { id: 'leadThigh', name: 'Lead thigh (below shorts)' }, { id: 'rearThigh', name: 'Rear thigh (below shorts)' },
  { id: 'leadCalf', name: 'Lead calf' }, { id: 'rearCalf', name: 'Rear calf' },
] as const;
export type TattooRegion = (typeof TATTOO_REGIONS)[number]['id'];

export const INK_COLORS = ['#1c2433', '#2d3b52', '#5b1d24', '#1f4d3a', '#4a2a63', '#7a5520'];
export const GLOVE_COLORS = ['#c8102e', '#111111', '#1d4ed8', '#e5e5e5', '#f59e0b', '#16a34a', '#7c3aed', '#ec4899'];
export const TRIM_COLORS = ['#ffffff', '#111111', '#facc15', '#c8102e', '#1d4ed8', '#16a34a', '#9ca3af', '#f97316'];
export const MAX_TATTOOS = 8;

export interface Tattoo {
  id: string;
  design: TattooDesign;
  region: TattooRegion;
  size: number; // 0.6 .. 1.4
  rot: number; // degrees, -60 .. 60
  pos: number; // 0..1 position along the body part
  ink: string;
  text?: string; // lettering only, max 12 chars
}

export interface Look {
  v: 1;
  skin: string;
  hair: HairId; hairColor: string;
  beard: BeardId; moustache: MoustacheId; facialColor: string;
  face: { shape: HeadShape; jaw: number; brow: number; eyes: EyeShape; nose: number; cauliflower: boolean };
  body: { build: number; muscle: number; shoulders: number; torso: TorsoShape; limbs: number };
  attire: { shorts: string; style: ShortsStyle; accent: string; trim: string; waistband: string; gloves: string; gloveTrim: string; walkout: WalkoutTop; walkoutColor: string; headband: boolean };
  tattoos: Tattoo[];
}

export type LookCategory = 'hair' | 'facial' | 'tattoos' | 'face' | 'body' | 'attire';

const LEGACY_HAIR: HairId[] = ['shaved', 'buzz', 'crew', 'mohawk', 'ponytail', 'afro'];
const LEGACY_BEARD: BeardId[] = ['none', 'stubble', 'goatee', 'full'];
const BODY_BUILD: Record<string, { build: number; muscle: number; shoulders: number; torso: TorsoShape }> = {
  lean: { build: 0.3, muscle: 0.55, shoulders: 0.45, torso: 'v' },
  compact: { build: 0.55, muscle: 0.6, shoulders: 0.55, torso: 'straight' },
  rangy: { build: 0.25, muscle: 0.45, shoulders: 0.5, torso: 'straight' },
  stocky: { build: 0.8, muscle: 0.6, shoulders: 0.7, torso: 'thick' },
};

function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }

/** Map the original six-field appearance onto the full look (used for old saves and as editor defaults). */
export function lookFromLegacy(ap: Appearance, bodyType?: string): Look {
  const b = BODY_BUILD[bodyType ?? ''] ?? BODY_BUILD.compact;
  const hc = HAIR_COLORS[ap.hairColor] ?? HAIR_COLORS[0];
  const tattoos: Tattoo[] = [];
  if (ap.accessory === 1) tattoos.push({ id: 't1', design: 'tribal', region: 'leadUpperArm', size: 1, rot: 0, pos: 0.45, ink: INK_COLORS[0] }, { id: 't2', design: 'geo', region: 'leadForearm', size: 1, rot: 0, pos: 0.5, ink: INK_COLORS[0] });
  if (ap.accessory === 3) tattoos.push({ id: 't3', design: 'sun', region: 'chest', size: 1, rot: 0, pos: 0.4, ink: INK_COLORS[0] });
  return {
    v: 1, skin: SKIN_TONES[ap.skin] ?? SKIN_TONES[2],
    hair: LEGACY_HAIR[ap.hair] ?? 'crew', hairColor: hc,
    beard: LEGACY_BEARD[ap.facialHair] ?? 'none', moustache: ap.facialHair === 3 ? 'classic' : 'none', facialColor: hc,
    face: { shape: 'oval', jaw: 0.5, brow: 0.5, eyes: 'almond', nose: 0.5, cauliflower: false },
    body: { ...b, limbs: 0.5 },
    attire: { shorts: SHORTS_COLORS[ap.shorts] ?? SHORTS_COLORS[0], style: 'solid', accent: '#ffffff', trim: '#ffffff', waistband: '#111111', gloves: GLOVE_COLORS[ap.gloves] ?? GLOVE_COLORS[0], gloveTrim: '#111111', walkout: 'hoodie', walkoutColor: '#111111', headband: ap.accessory === 2 },
    tattoos,
  };
}

/** Deterministic look for an AI fighter: same id → same look, forever. Body build follows the weight class. */
export function generateLook(id: string, ap: Appearance, opts: { div?: string; heightCm?: number } = {}): Look {
  const r = new RNG(hashStr(`look:${id}`));
  const base = lookFromLegacy(ap);
  const heavy = { fly: 0.15, bantam: 0.2, feather: 0.28, light: 0.35, welter: 0.45, middle: 0.55, lhw: 0.65, heavy: 0.85 }[opts.div ?? ''] ?? 0.45;
  const hairPool: HairId[] = ['bald', 'shaved', 'buzz', 'buzz', 'crew', 'crew', 'highfade', 'midfade', 'quiff', 'medium', 'curly', 'afro', 'mohawk', 'cornrows', 'braids', 'ponytail', 'bun', 'long'];
  const beardRoll = r.next();
  const beard: BeardId = beardRoll < 0.42 ? 'none' : beardRoll < 0.58 ? 'stubble' : beardRoll < 0.68 ? 'stubble2' : beardRoll < 0.78 ? 'short' : beardRoll < 0.87 ? 'full' : beardRoll < 0.93 ? 'goatee' : beardRoll < 0.97 ? 'chinstrap' : 'long';
  const moustache: MoustacheId = beard === 'none' ? (r.chance(0.06) ? 'classic' : 'none') : ['full', 'long', 'short', 'goatee'].includes(beard) ? (r.chance(0.8) ? 'classic' : 'horseshoe') : r.chance(0.12) ? 'chevron' : 'none';
  const tattoos: Tattoo[] = [];
  if (r.chance(0.38)) {
    const n = r.chance(0.4) ? r.int(2, 4) : 1;
    const regions = r.shuffle(TATTOO_REGIONS.map((x) => x.id) as TattooRegion[]);
    const designs = TATTOO_DESIGNS.filter((d) => d.id !== 'script');
    for (let i = 0; i < n; i++) {
      const reg = regions[i];
      const d = reg.includes('Arm') || reg.includes('Forearm') || reg.includes('Calf') ? r.pick(designs) : r.pick(designs.filter((x) => x.kind === 'piece'));
      tattoos.push({ id: `a${i}`, design: d.id, region: reg, size: Math.round((0.8 + r.next() * 0.4) * 100) / 100, rot: d.kind === 'band' ? 0 : r.int(-15, 15), pos: 0.35 + r.next() * 0.3, ink: r.chance(0.85) ? INK_COLORS[0] : r.pick(INK_COLORS) });
    }
  }
  const styles: ShortsStyle[] = ['solid', 'solid', 'stripe', 'panel', 'split', 'chevron', 'flame', 'camo'];
  return {
    ...base,
    hair: r.pick(hairPool), beard, moustache,
    face: { shape: r.pick(['oval', 'round', 'square', 'long'] as HeadShape[]), jaw: r.next(), brow: r.next(), eyes: r.pick(['almond', 'round', 'narrow', 'deep'] as EyeShape[]), nose: r.next(), cauliflower: r.chance(0.18) },
    body: { build: clamp01(heavy + (r.next() - 0.5) * 0.3), muscle: clamp01(0.35 + r.next() * 0.55), shoulders: clamp01(heavy * 0.6 + r.next() * 0.45), torso: heavy > 0.7 && r.chance(0.5) ? 'thick' : r.pick(['v', 'straight', 'v'] as TorsoShape[]), limbs: r.next() },
    attire: { ...base.attire, style: r.pick(styles), accent: r.pick(TRIM_COLORS), trim: r.pick(TRIM_COLORS), waistband: r.pick(['#111111', '#ffffff', base.attire.shorts]), gloveTrim: r.pick(['#111111', '#ffffff']), walkout: r.pick(['hoodie', 'tee', 'jacket', 'hoodie', 'robe'] as WalkoutTop[]), walkoutColor: r.pick(['#111111', '#1f2937', base.attire.shorts, '#f5f5f5']) },
    tattoos,
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The look to draw. Stored looks win; otherwise derive from legacy fields (player) or id (AI). */
export function resolveLook(ap: Appearance & { look?: Look }, ctx: { id?: string; bodyType?: string; div?: string; heightCm?: number } = {}): Look {
  if (ap.look && ap.look.v === 1) return sanitizeLook(ap.look);
  if (ctx.id && ctx.id !== 'player') return generateLook(ctx.id, ap, ctx);
  return lookFromLegacy(ap, ctx.bodyType);
}

/** Defensive normalisation so a hand-edited or partial look can never break rendering. */
export function sanitizeLook(l: Partial<Look>): Look {
  const d = lookFromLegacy({ skin: 2, hair: 2, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 });
  const pick = <T extends string>(v: any, list: readonly { id: T }[], def: T): T => (list.some((x) => x.id === v) ? v : def);
  const num = (v: any, def: number) => (typeof v === 'number' && isFinite(v) ? clamp01(v) : def);
  const col = (v: any, def: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : def);
  const f: Partial<Look['face']> = l.face ?? {}, b: Partial<Look['body']> = l.body ?? {}, a: Partial<Look['attire']> = l.attire ?? {};
  return {
    v: 1, skin: col(l.skin, d.skin),
    hair: pick(l.hair, HAIR, d.hair), hairColor: col(l.hairColor, d.hairColor),
    beard: pick(l.beard, BEARDS, 'none'), moustache: pick(l.moustache, MOUSTACHES, 'none'), facialColor: col(l.facialColor, col(l.hairColor, d.hairColor)),
    face: { shape: pick(f.shape, HEAD_SHAPES, 'oval'), jaw: num(f.jaw, 0.5), brow: num(f.brow, 0.5), eyes: pick(f.eyes, EYES, 'almond'), nose: num(f.nose, 0.5), cauliflower: !!f.cauliflower },
    body: { build: num(b.build, 0.5), muscle: num(b.muscle, 0.55), shoulders: num(b.shoulders, 0.5), torso: pick(b.torso, TORSOS, 'straight'), limbs: num(b.limbs, 0.5) },
    attire: {
      shorts: col(a.shorts, d.attire.shorts), style: pick(a.style, SHORTS_STYLES, 'solid'), accent: col(a.accent, '#ffffff'), trim: col(a.trim, '#ffffff'), waistband: col(a.waistband, '#111111'),
      gloves: col(a.gloves, d.attire.gloves), gloveTrim: col(a.gloveTrim, '#111111'), walkout: pick(a.walkout, WALKOUT_TOPS, 'hoodie'), walkoutColor: col(a.walkoutColor, '#111111'), headband: !!a.headband,
    },
    tattoos: (Array.isArray(l.tattoos) ? l.tattoos : []).slice(0, MAX_TATTOOS).map((t, i) => ({
      id: typeof t.id === 'string' ? t.id : `t${i}`, design: pick(t.design, TATTOO_DESIGNS, 'tribal'), region: pick(t.region, TATTOO_REGIONS, 'leadUpperArm'),
      size: Math.max(0.6, Math.min(1.4, Number(t.size) || 1)), rot: Math.max(-60, Math.min(60, Number(t.rot) || 0)), pos: num(t.pos, 0.5), ink: col(t.ink, INK_COLORS[0]),
      text: t.design === 'script' ? String(t.text ?? 'FIGHT').slice(0, 12) : undefined,
    })),
  };
}

/** Which categories differ between two looks (for undo/reset UI and the shorts purchase rule). */
export function categoryOf(key: string): LookCategory {
  if (key === 'hair' || key === 'hairColor') return 'hair';
  if (key === 'beard' || key === 'moustache' || key === 'facialColor') return 'facial';
  if (key === 'tattoos') return 'tattoos';
  if (key === 'face' || key === 'skin') return 'face';
  if (key === 'body') return 'body';
  return 'attire';
}
export function resetCategory(cur: Look, def: Look, cat: LookCategory): Look {
  const out: Look = JSON.parse(JSON.stringify(cur));
  for (const k of Object.keys(def) as (keyof Look)[]) if (k !== 'v' && categoryOf(k) === cat) (out as any)[k] = JSON.parse(JSON.stringify(def[k]));
  return out;
}
export function shortsChanged(a: Look, b: Look) {
  const x = a.attire, y = b.attire;
  return x.shorts !== y.shorts || x.style !== y.style || x.accent !== y.accent || x.trim !== y.trim || x.waistband !== y.waistband;
}

// ───────────────────────────── presets (shared by every career on this browser)
const PRESET_KEY = 'fightcamp.lookPresets';
export interface LookPreset { name: string; look: Look; savedAt: number }
export function loadPresets(): LookPreset[] {
  try { const raw = storage.getItem(PRESET_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr.filter((p) => p && p.name && p.look).map((p) => ({ ...p, look: sanitizeLook(p.look) })) : []; } catch { return []; }
}
export function savePreset(name: string, look: Look): string | null {
  const n = name.trim().slice(0, 30);
  if (!n) return 'Give the preset a name.';
  const all = loadPresets().filter((p) => p.name !== n);
  all.unshift({ name: n, look, savedAt: Date.now() });
  try { storage.setItem(PRESET_KEY, JSON.stringify(all.slice(0, 24))); return null; } catch { return 'Browser storage is full.'; }
}
export function deletePreset(name: string) {
  try { storage.setItem(PRESET_KEY, JSON.stringify(loadPresets().filter((p) => p.name !== name))); } catch { /* ignore */ }
}
