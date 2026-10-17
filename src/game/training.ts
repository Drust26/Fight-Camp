// Training, fatigue, injuries, weight and daily condition updates.
import type { AttrKey, Attributes } from './attributes';
import { ATTR_KEYS } from './attributes';
import { RNG, clamp, uid } from './rng';
import { GYM, INJURIES, LIFESTYLE, SESSION, type SessionDef } from '../data/training';
import { ageOf, gymCoachBonus, inbox, ledger } from './core';
import type { GameState, Injury, PlayerFighter } from './types';

export const BASE_GAIN = 0.42;
const PHYSICAL: AttrKey[] = ['strength', 'explosiveness', 'speed', 'agility', 'endurance', 'cardio', 'durability', 'recovery', 'balance', 'flexibility'];

export function ageFactor(age: number, physical: boolean) {
  const f = age < 23 ? 1.18 : age < 27 ? 1.08 : age < 31 ? 0.96 : age < 34 ? 0.82 : age < 37 ? 0.66 : 0.5;
  return physical ? f : Math.max(0.82, f + 0.1);
}

export function diminishing(cur: number) {
  return Math.pow(clamp((100 - cur) / 60, 0.02, 1.4), 1.6);
}

/** Attribute caps from accumulated wear (damage) — durability and recovery erode over a long career. */
export function attrCap(p: PlayerFighter, k: AttrKey) {
  if (k === 'durability') return 99 - p.wear * 0.4;
  if (k === 'recovery') return 99 - p.wear * 0.2;
  return 99;
}

export interface SessionCheck { ok: boolean; reason?: string; replacement?: string }

export function checkSession(st: GameState, id: string): SessionCheck {
  const s = SESSION[id];
  if (!s) return { ok: false, reason: 'Unknown session' };
  const p = st.player;
  for (const inj of p.injuries) {
    const def = INJURIES[inj.type];
    const blocked = s.tags.some((t) => def.blocks.includes(t)) || (s.contact === 'hard' && def.blocks.includes('sparring')) || (inj.type === 'concussion' && s.contact === 'hard');
    if (blocked) return { ok: false, reason: `${def.name} prevents this`, replacement: 'light' };
  }
  if (s.requires?.facility) {
    const gym = GYM[p.gymId];
    const coachQ = gymCoachBonus(st, s.coach);
    if (gym.fac[s.facility] < s.requires.facility && coachQ < s.requires.facility)
      return { ok: false, reason: `Needs ${s.facility} facilities ${s.requires.facility}+ (or a matching coach)`, replacement: 'light' };
  }
  if (s.special === 'prep' && !st.scheduled) return { ok: false, reason: 'No fight booked', replacement: 'film' };
  if (s.cost > 0 && p.money - s.cost < -2000) return { ok: false, reason: 'Cannot afford session fees', replacement: 'light' };
  return { ok: true };
}

export function sessionQuality(st: GameState, s: SessionDef) {
  const p = st.player;
  const gym = GYM[p.gymId];
  let q = 0.55 + (gym.fac[s.facility] / 100) * 0.35;
  const coach = gymCoachBonus(st, s.coach);
  q += (coach / 100) * 0.45;
  if (s.cat === 'conditioning' && p.lifestyle.homeGym) q += 0.06;
  if (s.cat === 'conditioning' && st.sponsors.some((d) => d.sponsorId === 'titan')) q += 0.03;
  return q;
}

export function injuryRisk(st: GameState, s: SessionDef) {
  const p = st.player;
  const diff = st.difficulty === 'easy' ? 0.6 : st.difficulty === 'hard' ? 1.1 : st.difficulty === 'simulation' ? 1.3 : 1;
  const rec = gymCoachBonus(st, 'recovery');
  let r = s.risk * Math.pow(1 + p.fatigue / 45, 1.3) * (1.2 - p.attrs.flexibility / 250) * (p.lifestyle.physio ? 0.85 : 1) * (1 - rec / 400) * diff;
  if (p.injuries.length) r *= 1.5;
  return r;
}

export function trainingMultiplier(st: GameState) {
  const p = st.player;
  const fatigueF = clamp(1 - p.fatigue / 140, 0.3, 1);
  const injF = p.injuries.length ? 0.85 : 1;
  const consistency = 1 + Math.min(p.trainingStreakDays, 30) / 300;
  const disc = 0.85 + p.attrs.discipline / 330;
  const diff = st.difficulty === 'easy' ? 1.25 : st.difficulty === 'hard' ? 0.9 : st.difficulty === 'simulation' ? 0.8 : 1;
  const diet = p.diet === 'cut' ? 0.92 : 1;
  return fatigueF * injF * consistency * disc * diff * diet * p.talent;
}

/** Expected per-session gains (no randomness) for UI previews. */
export function expectedGains(st: GameState, id: string): Partial<Record<AttrKey, number>> {
  const s = SESSION[id];
  const p = st.player;
  const age = ageOf(p.bornDay, st.day);
  const q = sessionQuality(st, s) * trainingMultiplier(st);
  const out: Partial<Record<AttrKey, number>> = {};
  for (const [k, w] of Object.entries(s.gains) as [AttrKey, number][]) {
    out[k] = BASE_GAIN * w * q * ageFactor(age, PHYSICAL.includes(k)) * diminishing(p.attrs[k]);
  }
  return out;
}

const INJ_BY_TAG: Record<string, string[]> = {
  sparring: ['cut', 'hand', 'ribs', 'swelling', 'concussion'],
  punch: ['hand', 'shoulder'],
  kick: ['ankle', 'knee'],
  wrestle: ['knee', 'shoulder', 'ribs'],
  ground: ['shoulder', 'ribs'],
  explosive: ['ankle', 'knee'],
};

export function addInjury(st: GameState, rng: RNG, type: string, severity: number, source: string): Injury {
  const def = INJURIES[type];
  const days = Math.round(rng.range(def.days[0], def.days[1]) * (0.6 + severity * 0.4));
  const existing = st.player.injuries.find((i) => i.type === type);
  if (existing) {
    existing.severity = Math.min(3, existing.severity + 1);
    existing.daysLeft += Math.round(days * 0.6);
    existing.totalDays = Math.max(existing.totalDays, existing.daysLeft);
    return existing;
  }
  const inj: Injury = { id: uid(rng, 'i'), type, severity, daysLeft: days, totalDays: days, treated: false, source };
  st.player.injuries.push(inj);
  if (def.suspension) st.player.medicalSuspensionUntil = Math.max(st.player.medicalSuspensionUntil, st.day + days);
  return inj;
}

/** Execute one training session for the current day. Returns log lines. */
export function runSession(st: GameState, rng: RNG, id: string, gains: Partial<Record<AttrKey, number>>): string[] {
  const lines: string[] = [];
  let s = SESSION[id];
  const chk = checkSession(st, id);
  if (!chk.ok) {
    lines.push(`${s.name} skipped — ${chk.reason}.${chk.replacement ? ` Did ${SESSION[chk.replacement].name} instead.` : ''}`);
    if (!chk.replacement) return lines;
    s = SESSION[chk.replacement];
  }
  const p = st.player;
  if (s.cost) ledger(st, -s.cost, `${s.name} fees`, 'training');
  const age = ageOf(p.bornDay, st.day);
  const q = sessionQuality(st, s) * trainingMultiplier(st);
  for (const [k, w] of Object.entries(s.gains) as [AttrKey, number][]) {
    const cur = p.attrs[k];
    const g = BASE_GAIN * w * q * ageFactor(age, PHYSICAL.includes(k)) * diminishing(cur) * rng.range(0.8, 1.2);
    const nv = Math.min(attrCap(p, k), cur + g);
    if (nv > cur) {
      p.attrs[k] = nv;
      gains[k] = (gains[k] ?? 0) + (nv - cur);
      p.recentGains[k] = (p.recentGains[k] ?? 0) + (nv - cur);
    }
  }
  // fatigue & sharpness
  const fat = s.intensity >= 0 ? s.intensity * (1.15 - p.attrs.cardio / 250) * (p.injuries.length ? 1.1 : 1) : s.intensity * (1 + gymCoachBonus(st, 'recovery') / 200);
  p.fatigue = clamp(p.fatigue + fat, 0, 100);
  p.sharpness = clamp(p.sharpness + (s.sharpness ?? Math.max(0, s.intensity / 6)), 0, 100);
  if (s.contact === 'hard') p.wear = Math.min(100, p.wear + 0.08);
  p.sessionsDone++;
  // specials
  switch (s.special) {
    case 'work':
      ledger(st, 90, 'Part-time shift', 'other');
      lines.push('Worked a shift (+$90).');
      break;
    case 'media': {
      const g = 0.25 * (1 - p.popularity / 100);
      p.popularity = clamp(p.popularity + g, 0, 100);
      lines.push('Posted content and did a podcast (+popularity).');
      break;
    }
    case 'film':
      if (st.scheduled) {
        const add = 5 + gymCoachBonus(st, 'tactics') / 20;
        st.scheduled.prep = clamp(st.scheduled.prep + add, 0, 100);
        lines.push(`Film study: opponent preparation +${add.toFixed(0)}%.`);
      }
      break;
    case 'prep':
      if (st.scheduled) {
        const add = 9 + gymCoachBonus(st, 'tactics') / 12 + GYM[p.gymId].fac.partners / 20;
        st.scheduled.prep = clamp(st.scheduled.prep + add, 0, 100);
        lines.push(`Opponent-specific camp: preparation +${add.toFixed(0)}%.`);
      }
      break;
    case 'rehab':
      for (const inj of p.injuries) inj.daysLeft = Math.max(0, inj.daysLeft - (1 + gymCoachBonus(st, 'recovery') / 80));
      if (p.injuries.length) lines.push('Rehab session sped up injury recovery.');
      break;
  }
  if (!s.special || s.special === 'prep') lines.push(`${s.name} completed.`);
  // injury roll — telegraphed by the planner's risk readout
  const risk = injuryRisk(st, s);
  if (s.risk > 0 && rng.chance(risk)) {
    const pool = s.tags.flatMap((t) => INJ_BY_TAG[t] ?? []);
    const type = pool.length ? rng.pick(pool) : 'swelling';
    const sev = p.fatigue > 70 ? rng.int(2, 3) : p.fatigue > 45 ? rng.int(1, 2) : 1;
    const inj = addInjury(st, rng, type === 'concussion' && s.contact !== 'hard' ? 'swelling' : type, sev, s.name);
    const why = p.fatigue > 55 ? ' Training while this fatigued made it far more likely.' : '';
    lines.push(`INJURY: ${INJURIES[inj.type].name} (severity ${inj.severity}) during ${s.name}. Out ~${inj.daysLeft} days.${why}`);
    inbox(st, 'injury', `Injury: ${INJURIES[inj.type].name}`, `You picked up a ${INJURIES[inj.type].name.toLowerCase()} during ${s.name}. Estimated recovery ${inj.daysLeft} days. ${INJURIES[inj.type].desc}${why}`);
  }
  return lines;
}

/** Overnight recovery: fatigue, injuries, weight, sharpness. */
export function overnight(st: GameState, trainedToday: boolean, lines: string[]) {
  const p = st.player;
  const life = LIFESTYLE.housing[p.lifestyle.housing].recovery + LIFESTYLE.nutrition[p.lifestyle.nutrition].recovery;
  const rec = (13 + p.attrs.recovery / 7) * (1 + life + gymCoachBonus(st, 'recovery') / 500) * (trainedToday ? 1 : 1.6) + (trainedToday ? 0 : 6);
  p.fatigue = clamp(p.fatigue - rec, 0, 100);
  p.sharpness = clamp(p.sharpness - (trainedToday ? 1.2 : 2.2), 0, 100);
  if (p.diet === 'cut') p.fatigue = clamp(p.fatigue + 1.5, 0, 100);
  // injuries
  const heal = (1 + p.attrs.recovery / 200) * (p.lifestyle.physio ? 1.25 : 1) * (trainedToday ? 1 : 1.3);
  for (const inj of p.injuries) inj.daysLeft -= heal * (inj.treated ? 1.35 : 1);
  const healed = p.injuries.filter((i) => i.daysLeft <= 0);
  for (const h of healed) {
    lines.push(`${INJURIES[h.type].name} has healed.`);
    inbox(st, 'injury', `Cleared: ${INJURIES[h.type].name}`, 'You are cleared to return to full training.');
  }
  p.injuries = p.injuries.filter((i) => i.daysLeft > 0);
  // weight
  const nut = LIFESTYLE.nutrition[p.lifestyle.nutrition].weight;
  if (p.diet === 'bulk') p.weightKg = Math.min(p.naturalKg + 6, p.weightKg + 0.05);
  else if (p.diet === 'cut') p.weightKg = Math.max(p.naturalKg * 0.9, p.weightKg - 0.07 * (1 + nut * 0.4));
  else p.weightKg += (p.naturalKg - p.weightKg) * 0.03;
  p.naturalKg += (p.weightKg - p.naturalKg) * 0.003;
  p.trainingStreakDays = trainedToday ? p.trainingStreakDays + 1 : Math.max(0, p.trainingStreakDays - 2);
}

/** Effective attributes after injuries (used for display and by the fight setup). */
export function injuredAttrs(p: PlayerFighter): Attributes {
  const a = { ...p.attrs };
  for (const inj of p.injuries) {
    const def = INJURIES[inj.type];
    for (const [k, v] of Object.entries(def.attrs) as [AttrKey, number][]) a[k] = clamp(a[k] + v * (0.6 + inj.severity * 0.4), 1, 99);
  }
  return a;
}

export function readiness(st: GameState): { score: number; notes: string[] } {
  const p = st.player;
  const notes: string[] = [];
  let score = 100;
  if (p.fatigue > 30) { score -= (p.fatigue - 30) * 0.7; notes.push(`Fatigue ${Math.round(p.fatigue)}%`); }
  for (const inj of p.injuries) { score -= 8 * inj.severity; notes.push(`${INJURIES[inj.type].name}`); }
  if (p.sharpness < 30) { score -= (30 - p.sharpness) * 0.3; notes.push('Lacking sharpness'); }
  return { score: clamp(Math.round(score), 0, 100), notes };
}

export function healPlayerFully(p: PlayerFighter) {
  p.injuries = [];
  p.fatigue = 0;
}

export const allAttrKeys = ATTR_KEYS;
