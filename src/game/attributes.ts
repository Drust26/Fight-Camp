// Attribute catalogue. Every attribute listed here is consumed by at least one gameplay
// calculation; the `effect` text documents where (shown in tooltips).

export const ATTR_KEYS = [
  // physical
  'strength', 'explosiveness', 'speed', 'agility', 'endurance', 'cardio', 'durability', 'recovery', 'balance', 'flexibility',
  // striking
  'boxing', 'punchPower', 'punchAccuracy', 'punchSpeed', 'kickboxing', 'kickPower', 'kickAccuracy', 'elbows', 'knees',
  'headMovement', 'blocking', 'counter', 'distance', 'combos',
  // grappling
  'wrestling', 'tdOffense', 'tdDefense', 'clinch', 'topControl', 'bottomDefense', 'gnp', 'bjj', 'subOffense', 'subDefense',
  'sweeps', 'posAwareness',
  // mental
  'fightIQ', 'composure', 'discipline', 'adaptability', 'aggression', 'confidence', 'experience',
] as const;

export type AttrKey = (typeof ATTR_KEYS)[number];
export type Attributes = Record<AttrKey, number>;

export type AttrGroup = 'Physical' | 'Striking' | 'Grappling' | 'Mental';

export interface AttrDef {
  key: AttrKey;
  name: string;
  group: AttrGroup;
  effect: string;
}

export const ATTRS: AttrDef[] = [
  { key: 'strength', name: 'Strength', group: 'Physical', effect: 'Clinch control, takedown finishing, top pressure and a small boost to strike force.' },
  { key: 'explosiveness', name: 'Explosiveness', group: 'Physical', effect: 'Takedown entry speed, power-shot startup and burst footwork.' },
  { key: 'speed', name: 'Speed', group: 'Physical', effect: 'Movement speed and strike startup time.' },
  { key: 'agility', name: 'Agility', group: 'Physical', effect: 'Lateral movement, evasion success and body-shot avoidance.' },
  { key: 'endurance', name: 'Endurance', group: 'Physical', effect: 'Maximum fight stamina and resistance to deep fatigue in later rounds.' },
  { key: 'cardio', name: 'Cardio Efficiency', group: 'Physical', effect: 'Stamina regeneration in fights and lower fatigue from training.' },
  { key: 'durability', name: 'Durability', group: 'Physical', effect: 'Reduces head damage taken and knockdown chance. Never makes you invulnerable.' },
  { key: 'recovery', name: 'Recovery', group: 'Physical', effect: 'Between-round recovery, daily fatigue recovery and injury healing speed.' },
  { key: 'balance', name: 'Balance', group: 'Physical', effect: 'Takedown defense, getting up after knockdowns, and kick checking.' },
  { key: 'flexibility', name: 'Flexibility', group: 'Physical', effect: 'Head-kick accuracy, submission defense and lower training injury risk.' },
  { key: 'boxing', name: 'Boxing', group: 'Striking', effect: 'Punch technique: accuracy and efficiency of all punches.' },
  { key: 'punchPower', name: 'Punch Power', group: 'Striking', effect: 'Damage and knockdown potential of punches.' },
  { key: 'punchAccuracy', name: 'Punch Accuracy', group: 'Striking', effect: 'Chance for punches to land cleanly.' },
  { key: 'punchSpeed', name: 'Punch Speed', group: 'Striking', effect: 'Punch startup and recovery time.' },
  { key: 'kickboxing', name: 'Kickboxing', group: 'Striking', effect: 'Kick technique: accuracy, recovery and balance after kicks.' },
  { key: 'kickPower', name: 'Kick Power', group: 'Striking', effect: 'Damage of kicks and knees.' },
  { key: 'kickAccuracy', name: 'Kick Accuracy', group: 'Striking', effect: 'Chance for kicks to land.' },
  { key: 'elbows', name: 'Elbow Technique', group: 'Striking', effect: 'Elbow accuracy/damage standing, in the clinch and on the ground.' },
  { key: 'knees', name: 'Knee Technique', group: 'Striking', effect: 'Knee accuracy and damage, especially in the clinch.' },
  { key: 'headMovement', name: 'Head Movement', group: 'Striking', effect: 'Chance to slip head strikes and avoid punches.' },
  { key: 'blocking', name: 'Blocking', group: 'Striking', effect: 'How much damage your guard absorbs and its stamina cost.' },
  { key: 'counter', name: 'Counter-Striking', group: 'Striking', effect: 'Bonus accuracy and damage when hitting an opponent who is mid-attack.' },
  { key: 'distance', name: 'Distance Management', group: 'Striking', effect: 'Effective range of strikes and kick checking.' },
  { key: 'combos', name: 'Combinations', group: 'Striking', effect: 'Faster follow-up strikes thrown in quick succession.' },
  { key: 'wrestling', name: 'Wrestling', group: 'Grappling', effect: 'General takedown and scramble ability.' },
  { key: 'tdOffense', name: 'Takedown Offense', group: 'Grappling', effect: 'Success rate of takedown attempts.' },
  { key: 'tdDefense', name: 'Takedown Defense', group: 'Grappling', effect: 'Stopping takedowns and sprawling.' },
  { key: 'clinch', name: 'Clinch Control', group: 'Grappling', effect: 'Entering, controlling and breaking the clinch.' },
  { key: 'topControl', name: 'Top Control', group: 'Grappling', effect: 'Keeping position on top; stopping escapes and sweeps.' },
  { key: 'bottomDefense', name: 'Bottom Defense', group: 'Grappling', effect: 'Escaping bad positions, getting up and reducing ground strikes.' },
  { key: 'gnp', name: 'Ground-and-Pound', group: 'Grappling', effect: 'Accuracy and damage of strikes from top position.' },
  { key: 'bjj', name: 'Brazilian Jiu-Jitsu', group: 'Grappling', effect: 'Overall submission and guard game technique.' },
  { key: 'subOffense', name: 'Submission Offense', group: 'Grappling', effect: 'How fast submissions are locked in.' },
  { key: 'subDefense', name: 'Submission Defense', group: 'Grappling', effect: 'How fast you escape submissions.' },
  { key: 'sweeps', name: 'Sweeps & Reversals', group: 'Grappling', effect: 'Chance to reverse position from the bottom.' },
  { key: 'posAwareness', name: 'Positional Awareness', group: 'Grappling', effect: 'Advancing position on top and preventing passes underneath.' },
  { key: 'fightIQ', name: 'Fight IQ', group: 'Mental', effect: 'Reading opponents: earlier attack tells, better AI decisions, tactical-pause insight.' },
  { key: 'composure', name: 'Composure', group: 'Mental', effect: 'Reduces performance loss while hurt and resistance to being stunned.' },
  { key: 'discipline', name: 'Discipline', group: 'Mental', effect: 'Training gains, weight-cut execution and stamina waste on misses.' },
  { key: 'adaptability', name: 'Adaptability', group: 'Mental', effect: 'Between-round adjustments and how quickly AI fighters adapt to you.' },
  { key: 'aggression', name: 'Aggression', group: 'Mental', effect: 'Damage bonus when pressing forward; AI attack frequency; crowd appeal.' },
  { key: 'confidence', name: 'Confidence', group: 'Mental', effect: 'Small accuracy/power swing. Rises with wins, drops with losses.' },
  { key: 'experience', name: 'Competitive Experience', group: 'Mental', effect: 'Reduces adrenaline dump in round 1 and judge-impressing ring craft.' },
];

export const ATTR_BY_KEY: Record<AttrKey, AttrDef> = Object.fromEntries(ATTRS.map((a) => [a.key, a])) as Record<AttrKey, AttrDef>;

export const CATEGORY_DEFS: { id: CategoryId; name: string; keys: AttrKey[]; weight: number }[] = [
  { id: 'striking', name: 'Striking', weight: 0.24, keys: ['boxing', 'punchPower', 'punchAccuracy', 'punchSpeed', 'kickboxing', 'kickPower', 'kickAccuracy', 'elbows', 'knees', 'combos', 'counter', 'distance'] },
  { id: 'wrestling', name: 'Wrestling', weight: 0.17, keys: ['wrestling', 'tdOffense', 'tdDefense', 'clinch', 'topControl', 'gnp'] },
  { id: 'grappling', name: 'Grappling', weight: 0.15, keys: ['bjj', 'subOffense', 'subDefense', 'sweeps', 'posAwareness', 'bottomDefense'] },
  { id: 'defense', name: 'Defense', weight: 0.16, keys: ['headMovement', 'blocking', 'tdDefense', 'subDefense', 'durability', 'distance'] },
  { id: 'conditioning', name: 'Conditioning', weight: 0.16, keys: ['endurance', 'cardio', 'recovery', 'strength', 'explosiveness', 'speed', 'agility', 'balance', 'flexibility'] },
  { id: 'mental', name: 'Mental', weight: 0.12, keys: ['fightIQ', 'composure', 'discipline', 'adaptability', 'confidence', 'experience'] },
];
export type CategoryId = 'striking' | 'wrestling' | 'grappling' | 'defense' | 'conditioning' | 'mental';

export function categoryRatings(a: Attributes): Record<CategoryId, number> {
  const out = {} as Record<CategoryId, number>;
  for (const c of CATEGORY_DEFS) {
    out[c.id] = c.keys.reduce((s, k) => s + a[k], 0) / c.keys.length;
  }
  return out;
}

/** Derived overall rating: weighted category average with a bonus for having a real specialty. */
export function overallRating(a: Attributes): number {
  const cats = categoryRatings(a);
  let w = 0;
  for (const c of CATEGORY_DEFS) w += cats[c.id] * c.weight;
  const offense = Math.max(cats.striking, cats.wrestling, cats.grappling);
  return Math.round(Math.min(99, w + Math.max(0, offense - w) * 0.18));
}

export function blankAttrs(v = 40): Attributes {
  return Object.fromEntries(ATTR_KEYS.map((k) => [k, v])) as Attributes;
}

export function packAttrs(a: Attributes): number[] {
  return ATTR_KEYS.map((k) => Math.round(a[k]));
}
export function unpackAttrs(arr: number[]): Attributes {
  const a = {} as Attributes;
  ATTR_KEYS.forEach((k, i) => (a[k] = arr[i] ?? 40));
  return a;
}
