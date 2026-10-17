import { generateLook } from './look';
import { ATTR_KEYS, overallRating, packAttrs, unpackAttrs, type Attributes } from './attributes';
import { RNG, clamp, uid } from './rng';
import { DIV, FIRST_NAMES, LAST_NAMES, NATIONS, NICKNAMES, STYLE, STYLES } from '../data/world';
import type { Appearance, DivisionId, FightRecord, OrgId, StyleId, WorldFighter } from './types';

export const emptyRecord = (): FightRecord => ({ w: 0, l: 0, d: 0, ko: 0, tko: 0, sub: 0, dec: 0, lossKo: 0, lossSub: 0, lossDec: 0 });
export const recStr = (r: FightRecord) => `${r.w}-${r.l}${r.d ? '-' + r.d : ''}`;

/** Generate a coherent attribute set around a target overall for a given style. */
export function genAttrs(rng: RNG, level: number, style: StyleId): Attributes {
  const bias = STYLE[style].bias;
  const a = {} as Attributes;
  for (const k of ATTR_KEYS) {
    const b = bias[k] ?? 0;
    a[k] = clamp(Math.round(level + b * 0.9 + rng.gauss() * 5), 12, 97);
  }
  // nudge to target overall
  for (let i = 0; i < 6; i++) {
    const ovr = overallRating(a);
    const diff = level - ovr;
    if (Math.abs(diff) < 1) break;
    for (const k of ATTR_KEYS) a[k] = clamp(a[k] + diff * 0.8, 12, 97);
  }
  for (const k of ATTR_KEYS) a[k] = Math.round(a[k]);
  return a;
}

export function genRecord(rng: RNG, level: number, style: StyleId, tier: number): FightRecord {
  const r = emptyRecord();
  const fights = clamp(Math.round(rng.range(2, 6) + tier * rng.range(1.5, 4)), 1, 34);
  const winRate = clamp(0.5 + (level - 50) / 80 + rng.gauss() * 0.1, 0.35, 0.95);
  const finishBias = STYLE[style].id === 'point' ? 0.3 : 0.6;
  for (let i = 0; i < fights; i++) {
    if (rng.chance(0.02)) { r.d++; continue; }
    const win = rng.chance(winRate);
    const m = rng.next();
    if (win) {
      r.w++;
      if (m < finishBias * (['power', 'pressure', 'kickboxer', 'gnp'].includes(style) ? 0.7 : 0.35)) rng.chance(0.5) ? r.ko++ : r.tko++;
      else if (m < finishBias * (style === 'submission' ? 0.9 : 0.55)) r.sub++;
      else r.dec++;
    } else {
      r.l++;
      if (m < 0.3) r.lossKo++;
      else if (m < 0.45) r.lossSub++;
      else r.lossDec++;
    }
  }
  return r;
}

export function genFighter(rng: RNG, opts: { org: OrgId; div: DivisionId; level: number; day: number; tier: number; style?: StyleId; ageRange?: [number, number] }): WorldFighter {
  const style = opts.style ?? rng.pick(STYLES).id;
  const level = opts.level;
  const attrs = genAttrs(rng, level, style);
  const div = DIV[opts.div];
  const h = Math.round(div.avgHeight + rng.gauss() * 5);
  const age = opts.ageRange ? rng.range(opts.ageRange[0], opts.ageRange[1]) : clamp(22 + opts.tier * 1.6 + rng.gauss() * 3.5, 19, 39);
  return {
    id: uid(rng, 'f'),
    first: rng.pick(FIRST_NAMES),
    last: rng.pick(LAST_NAMES),
    nick: rng.chance(0.7) ? rng.pick(NICKNAMES) : '',
    nat: rng.pick(NATIONS),
    bornDay: Math.round(opts.day - age * 365),
    h,
    r: Math.round(h + rng.gauss() * 4 + (style === 'kickboxer' ? 3 : 0)),
    stance: rng.chance(0.24) ? 'southpaw' : 'orthodox',
    style,
    a: packAttrs(attrs),
    div: opts.div,
    org: opts.org,
    rec: genRecord(rng, level, style, opts.tier),
    pts: 0,
    pop: clamp(Math.round(level * 0.5 + opts.tier * 6 + rng.gauss() * 8), 1, 95),
    injuredUntil: 0,
    bookedUntil: 0,
    lastFight: opts.day - rng.int(10, 160),
    recent: [],
    retired: false,
    vsPlayer: [],
    peak: clamp(Math.round(level + (age < 27 ? rng.range(2, 14) : rng.range(-2, 4))), 30, 96),
  };
}

export function fighterName(f: { first: string; last: string; nick?: string }) {
  return `${f.first} ${f.last}`;
}
export function fullName(f: { first: string; last: string; nick?: string }) {
  return f.nick ? `${f.first} "${f.nick}" ${f.last}` : `${f.first} ${f.last}`;
}
export function wfAttrs(f: WorldFighter) {
  return unpackAttrs(f.a);
}
export function wfOverall(f: WorldFighter) {
  return overallRating(unpackAttrs(f.a));
}

/** Deterministic appearance for AI fighters from their id. */
const lookCache = new Map<string, Appearance>();
/** Deterministic appearance for a world fighter (never stored: derived from the id, so it is stable forever). */
export function wfAppearance(f: { id: string; div?: string; h?: number }): Appearance {
  const key = `${f.id}|${f.div ?? ''}`;
  const hit = lookCache.get(key);
  if (hit) return hit;
  let h = 0;
  for (let i = 0; i < f.id.length; i++) h = (h * 31 + f.id.charCodeAt(i)) >>> 0;
  const r = new RNG(h);
  const ap: Appearance = { skin: r.int(0, 6), hair: r.int(0, 5), hairColor: r.int(0, 6), facialHair: r.int(0, 3), shorts: r.int(0, 7), gloves: r.int(0, 3), accessory: r.int(0, 3) };
  ap.look = generateLook(f.id, ap, { div: f.div, heightCm: f.h });
  if (lookCache.size > 2000) lookCache.clear();
  lookCache.set(key, ap);
  return ap;
}
