import type { Attributes } from '../game/attributes';

export type MoveId =
  | 'jab' | 'cross' | 'hook' | 'upper' | 'body' | 'lowkick' | 'bodykick' | 'headkick' | 'teep' | 'knee' | 'elbow'
  | 'cpunch' | 'cknee' | 'celbow' | 'gpunch' | 'gelbow' | 'bpunch';

export type MoveKind = 'punch' | 'kick' | 'knee' | 'elbow' | 'ground';
export type Target = 'head' | 'body' | 'legs';

export interface MoveDef {
  id: MoveId;
  name: string;
  kind: MoveKind;
  target: Target;
  startup: number;
  active: number;
  recovery: number;
  stamina: number;
  range: [number, number]; // centre-to-centre distance (cm) at reach 180
  dmg: number;
  acc: number; // base hit chance
  kd: number; // knockdown potential
  guardPierce: number; // 0..1 fraction of high-guard mitigation ignored
  context: 'standing' | 'clinch' | 'ground';
  pose: string;
}

export const MOVES: Record<MoveId, MoveDef> = {
  jab: { id: 'jab', name: 'Jab', kind: 'punch', target: 'head', startup: 0.13, active: 0.06, recovery: 0.2, stamina: 2.4, range: [50, 120], dmg: 2.6, acc: 0.6, kd: 0.015, guardPierce: 0, context: 'standing', pose: 'jab' },
  cross: { id: 'cross', name: 'Cross', kind: 'punch', target: 'head', startup: 0.2, active: 0.07, recovery: 0.3, stamina: 4.2, range: [50, 116], dmg: 5.6, acc: 0.5, kd: 0.075, guardPierce: 0.05, context: 'standing', pose: 'cross' },
  hook: { id: 'hook', name: 'Lead Hook', kind: 'punch', target: 'head', startup: 0.23, active: 0.07, recovery: 0.33, stamina: 4.8, range: [38, 90], dmg: 6.4, acc: 0.45, kd: 0.095, guardPierce: 0.12, context: 'standing', pose: 'hook' },
  upper: { id: 'upper', name: 'Uppercut', kind: 'punch', target: 'head', startup: 0.23, active: 0.07, recovery: 0.36, stamina: 4.8, range: [30, 80], dmg: 6.4, acc: 0.43, kd: 0.095, guardPierce: 0.45, context: 'standing', pose: 'upper' },
  body: { id: 'body', name: 'Body Hook', kind: 'punch', target: 'body', startup: 0.21, active: 0.07, recovery: 0.33, stamina: 4.4, range: [36, 92], dmg: 5.2, acc: 0.52, kd: 0.03, guardPierce: 0.6, context: 'standing', pose: 'body' },
  lowkick: { id: 'lowkick', name: 'Low Kick', kind: 'kick', target: 'legs', startup: 0.27, active: 0.08, recovery: 0.38, stamina: 5.6, range: [62, 126], dmg: 5.6, acc: 0.58, kd: 0.0, guardPierce: 1, context: 'standing', pose: 'lowkick' },
  bodykick: { id: 'bodykick', name: 'Body Kick', kind: 'kick', target: 'body', startup: 0.34, active: 0.08, recovery: 0.48, stamina: 7.5, range: [74, 136], dmg: 7.8, acc: 0.48, kd: 0.04, guardPierce: 0.7, context: 'standing', pose: 'bodykick' },
  headkick: { id: 'headkick', name: 'Head Kick', kind: 'kick', target: 'head', startup: 0.43, active: 0.08, recovery: 0.6, stamina: 9.5, range: [80, 142], dmg: 11, acc: 0.3, kd: 0.17, guardPierce: 0.3, context: 'standing', pose: 'headkick' },
  teep: { id: 'teep', name: 'Front Kick', kind: 'kick', target: 'body', startup: 0.25, active: 0.08, recovery: 0.36, stamina: 5.2, range: [62, 132], dmg: 3.8, acc: 0.52, kd: 0.0, guardPierce: 0.7, context: 'standing', pose: 'teep' },
  knee: { id: 'knee', name: 'Knee', kind: 'knee', target: 'body', startup: 0.23, active: 0.08, recovery: 0.36, stamina: 5.6, range: [22, 72], dmg: 6.8, acc: 0.5, kd: 0.06, guardPierce: 0.6, context: 'standing', pose: 'knee' },
  elbow: { id: 'elbow', name: 'Elbow', kind: 'elbow', target: 'head', startup: 0.2, active: 0.07, recovery: 0.32, stamina: 4.8, range: [22, 66], dmg: 6.6, acc: 0.42, kd: 0.07, guardPierce: 0.25, context: 'standing', pose: 'elbow' },
  // clinch
  cpunch: { id: 'cpunch', name: 'Dirty Boxing', kind: 'punch', target: 'head', startup: 0.16, active: 0.06, recovery: 0.26, stamina: 3.2, range: [0, 999], dmg: 3.4, acc: 0.55, kd: 0.03, guardPierce: 0.2, context: 'clinch', pose: 'cpunch' },
  cknee: { id: 'cknee', name: 'Clinch Knee', kind: 'knee', target: 'body', startup: 0.24, active: 0.08, recovery: 0.38, stamina: 5.4, range: [0, 999], dmg: 6.6, acc: 0.55, kd: 0.05, guardPierce: 0.6, context: 'clinch', pose: 'cknee' },
  celbow: { id: 'celbow', name: 'Clinch Elbow', kind: 'elbow', target: 'head', startup: 0.2, active: 0.07, recovery: 0.34, stamina: 4.8, range: [0, 999], dmg: 6.2, acc: 0.46, kd: 0.06, guardPierce: 0.3, context: 'clinch', pose: 'celbow' },
  // ground
  gpunch: { id: 'gpunch', name: 'Ground Punch', kind: 'ground', target: 'head', startup: 0.18, active: 0.06, recovery: 0.3, stamina: 3.6, range: [0, 999], dmg: 3.3, acc: 0.56, kd: 0, guardPierce: 0, context: 'ground', pose: 'gpunch' },
  gelbow: { id: 'gelbow', name: 'Ground Elbow', kind: 'ground', target: 'head', startup: 0.24, active: 0.06, recovery: 0.42, stamina: 5, range: [0, 999], dmg: 4.8, acc: 0.46, kd: 0, guardPierce: 0, context: 'ground', pose: 'gelbow' },
  bpunch: { id: 'bpunch', name: 'Strike from Bottom', kind: 'ground', target: 'head', startup: 0.2, active: 0.06, recovery: 0.32, stamina: 3.4, range: [0, 999], dmg: 1.8, acc: 0.45, kd: 0, guardPierce: 0, context: 'ground', pose: 'bpunch' },
};

export const STANDING_MOVES: MoveId[] = ['jab', 'cross', 'hook', 'upper', 'body', 'lowkick', 'bodykick', 'headkick', 'teep', 'knee', 'elbow'];

/** Technique-based attack ratings derived from career attributes. */
export function attackRatings(m: MoveDef, a: Attributes) {
  switch (m.kind) {
    case 'punch':
      return {
        acc: 0.5 * a.punchAccuracy + 0.35 * a.boxing + 0.15 * a.speed,
        power: 0.75 * a.punchPower + 0.15 * a.strength + 0.1 * a.explosiveness,
        speed: 0.65 * a.punchSpeed + 0.35 * a.speed,
        tech: a.boxing,
      };
    case 'kick':
      return {
        acc: 0.5 * a.kickAccuracy + 0.32 * a.kickboxing + (m.target === 'head' ? 0.18 * a.flexibility : 0.18 * a.balance),
        power: 0.8 * a.kickPower + 0.2 * a.strength,
        speed: 0.45 * a.speed + 0.35 * a.kickboxing + 0.2 * a.explosiveness,
        tech: a.kickboxing,
      };
    case 'knee':
      return {
        acc: 0.6 * a.knees + 0.25 * a.clinch + 0.15 * a.kickAccuracy,
        power: 0.45 * a.knees + 0.35 * a.kickPower + 0.2 * a.strength,
        speed: 0.5 * a.explosiveness + 0.5 * a.speed,
        tech: a.knees,
      };
    case 'elbow':
      return {
        acc: 0.7 * a.elbows + 0.3 * a.boxing,
        power: 0.6 * a.elbows + 0.2 * a.strength + 0.2 * a.punchPower,
        speed: 0.6 * a.punchSpeed + 0.4 * a.speed,
        tech: a.elbows,
      };
    case 'ground':
      return {
        acc: 0.6 * a.gnp + 0.2 * a.topControl + 0.2 * a.punchAccuracy,
        power: 0.5 * a.gnp + 0.3 * a.punchPower + 0.2 * a.strength,
        speed: 0.5 * a.punchSpeed + 0.5 * a.speed,
        tech: m.id === 'gelbow' ? a.elbows : a.gnp,
      };
  }
}
