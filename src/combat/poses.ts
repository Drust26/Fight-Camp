// Keyframe poses for the articulated 2D fighters. Coordinates in cm, facing right, y up = negative,
// origin on the floor between the feet (standing) or at the pair anchor (ground scenes).
export type P = [number, number];
export interface Pose {
  head: P; neck: P; hip: P;
  fElbow: P; fHand: P; rElbow: P; rHand: P;
  fKnee: P; fFoot: P; rKnee: P; rFoot: P;
}
export type PoseKey = keyof Pose;
export const JOINTS: PoseKey[] = ['head', 'neck', 'hip', 'fElbow', 'fHand', 'rElbow', 'rHand', 'fKnee', 'fFoot', 'rKnee', 'rFoot'];

const stance: Pose = {
  head: [6, -164], neck: [2, -148], hip: [-4, -94],
  fElbow: [18, -120], fHand: [32, -146], rElbow: [4, -116], rHand: [18, -150],
  fKnee: [18, -48], fFoot: [24, 0], rKnee: [-24, -48], rFoot: [-32, 0],
};
const mod = (base: Pose, m: Partial<Pose>): Pose => ({ ...base, ...m });

export const POSES: Record<string, Pose> = {
  stance,
  guardHigh: mod(stance, { head: [3, -159], fElbow: [18, -128], fHand: [22, -160], rElbow: [6, -126], rHand: [14, -162] }),
  guardLow: mod(stance, { fElbow: [16, -106], fHand: [26, -122], rElbow: [4, -104], rHand: [14, -126], fKnee: [26, -64], fFoot: [28, -30] }),
  jab: mod(stance, { head: [4, -164], neck: [0, -148], fElbow: [46, -142], fHand: [76, -147] }),
  cross: mod(stance, { head: [18, -162], neck: [12, -148], hip: [0, -94], rElbow: [46, -142], rHand: [78, -147], rKnee: [-16, -48], rFoot: [-26, 0], fHand: [24, -154] }),
  hook: mod(stance, { head: [12, -162], neck: [8, -148], fElbow: [40, -142], fHand: [54, -150] }),
  upper: mod(stance, { head: [16, -156], neck: [10, -142], hip: [-2, -90], rElbow: [28, -110], rHand: [50, -148], fKnee: [18, -44], rKnee: [-22, -44] }),
  body: mod(stance, { head: [24, -150], neck: [16, -136], hip: [0, -88], rElbow: [36, -112], rHand: [60, -112], fKnee: [22, -44], rKnee: [-22, -42] }),
  lowkick: mod(stance, { hip: [-2, -96], neck: [-8, -150], head: [-6, -166], rKnee: [26, -52], rFoot: [66, -28], fHand: [26, -152], rHand: [-8, -126], rElbow: [-8, -110] }),
  bodykick: mod(stance, { hip: [-2, -96], neck: [-14, -148], head: [-14, -164], rKnee: [36, -86], rFoot: [84, -104], rHand: [-22, -112], rElbow: [-14, -116] }),
  headkick: mod(stance, { hip: [-4, -98], neck: [-22, -144], head: [-26, -158], rKnee: [42, -122], rFoot: [82, -168], rHand: [-34, -108], rElbow: [-24, -116], fHand: [10, -152] }),
  teep: mod(stance, { hip: [-6, -94], neck: [-6, -148], head: [-4, -164], fKnee: [44, -84], fFoot: [84, -96] }),
  knee: mod(stance, { neck: [16, -150], head: [22, -164], rKnee: [42, -104], rFoot: [22, -62], fHand: [46, -156], rHand: [40, -152], fElbow: [30, -140], rElbow: [24, -136] }),
  elbow: mod(stance, { head: [16, -162], neck: [10, -148], rElbow: [54, -150], rHand: [28, -156] }),
  evade: mod(stance, { head: [-8, -150], neck: [-6, -138], hip: [-8, -90], fKnee: [14, -44], rKnee: [-26, -44], fHand: [20, -142], rHand: [8, -146] }),
  stun: mod(stance, { head: [-12, -160], neck: [-8, -146], hip: [-6, -92], fElbow: [12, -120], fHand: [14, -110], rElbow: [-2, -118], rHand: [2, -106], fKnee: [16, -44], rKnee: [-22, -44] }),
  down: { head: [-90, -14], neck: [-70, -15], hip: [-20, -12], fElbow: [-58, -24], fHand: [-40, -16], rElbow: [-74, -6], rHand: [-56, -4], fKnee: [10, -34], fFoot: [34, 0], rKnee: [8, -22], rFoot: [32, -2] },
  getup: { head: [14, -126], neck: [8, -110], hip: [-6, -56], fElbow: [18, -86], fHand: [20, -66], rElbow: [6, -84], rHand: [8, -64], fKnee: [22, -42], fFoot: [26, 0], rKnee: [-14, -2], rFoot: [-46, 0] },
  shoot: { head: [52, -96], neck: [38, -92], hip: [-10, -64], fElbow: [52, -70], fHand: [68, -60], rElbow: [38, -72], rHand: [62, -58], fKnee: [30, -14], fFoot: [4, 0], rKnee: [-34, -34], rFoot: [-62, 0] },
  sprawled: { head: [38, -62], neck: [24, -60], hip: [-14, -40], fElbow: [34, -36], fHand: [42, -16], rElbow: [26, -34], rHand: [34, -14], fKnee: [10, -2], fFoot: [-8, 0], rKnee: [-30, -2], rFoot: [-54, 0] },
  sprawl: { head: [24, -102], neck: [12, -98], hip: [-30, -62], fElbow: [28, -86], fHand: [40, -76], rElbow: [20, -84], rHand: [34, -72], fKnee: [-36, -30], fFoot: [-56, 0], rKnee: [-48, -28], rFoot: [-72, 0] },
  clinch: mod(stance, { neck: [16, -148], head: [24, -158], hip: [-6, -94], fElbow: [36, -150], fHand: [52, -160], rElbow: [30, -140], rHand: [48, -156], fKnee: [16, -48], rKnee: [-22, -48] }),
  victory: mod(stance, { head: [2, -168], neck: [0, -150], fElbow: [18, -170], fHand: [26, -200], rElbow: [-14, -170], rHand: [-20, -200] }),
};
POSES.cknee = mod(POSES.clinch, { rKnee: [42, -102], rFoot: [22, -62] });
POSES.celbow = mod(POSES.clinch, { rElbow: [50, -158], rHand: [30, -162] });
POSES.cpunch = mod(POSES.clinch, { rElbow: [28, -122], rHand: [46, -132] });
POSES.clinchDefend = mod(POSES.clinch, { neck: [10, -144], head: [16, -152], fHand: [30, -150], rHand: [26, -146], fElbow: [22, -132], rElbow: [18, -128] });

// ── ground scenes (absolute positions, bottom fighter's head points to +x)
const B_FLAT: Pose = { head: [72, -14], neck: [54, -16], hip: [0, -12], fElbow: [38, -36], fHand: [28, -58], rElbow: [44, -30], rHand: [34, -50], fKnee: [-30, -24], fFoot: [-62, -4], rKnee: [-34, -16], rFoot: [-68, 0] };
export const GROUND_POSES: Record<string, { top: Pose; bottom: Pose }> = {
  guard: {
    bottom: mod(B_FLAT, { fKnee: [-16, -58], fFoot: [-40, -40], rKnee: [-8, -52], rFoot: [-32, -36], fElbow: [36, -40], fHand: [22, -64], rElbow: [42, -34], rHand: [28, -58] }),
    top: { head: [22, -100], neck: [8, -92], hip: [-30, -50], fElbow: [24, -66], fHand: [36, -36], rElbow: [6, -72], rHand: [18, -92], fKnee: [-18, -4], fFoot: [-58, 0], rKnee: [-30, -4], rFoot: [-68, 0] },
  },
  half: {
    bottom: mod(B_FLAT, { fKnee: [-12, -40], fFoot: [-34, -12], fElbow: [38, -34], fHand: [26, -60] }),
    top: { head: [38, -66], neck: [22, -64], hip: [-22, -44], fElbow: [36, -44], fHand: [52, -24], rElbow: [14, -60], rHand: [22, -82], fKnee: [-6, -4], fFoot: [-44, 0], rKnee: [-28, -6], rFoot: [-66, 0] },
  },
  side: {
    bottom: B_FLAT,
    top: { head: [56, -44], neck: [40, -46], hip: [-8, -40], fElbow: [52, -26], fHand: [66, -18], rElbow: [26, -50], rHand: [32, -70], fKnee: [-4, -2], fFoot: [-40, 0], rKnee: [-24, -2], rFoot: [-58, 0] },
  },
  mount: {
    bottom: mod(B_FLAT, { fElbow: [40, -40], fHand: [30, -66], rElbow: [46, -36], rHand: [38, -62] }),
    top: { head: [14, -110], neck: [10, -94], hip: [4, -30], fElbow: [30, -62], fHand: [44, -42], rElbow: [24, -80], rHand: [16, -106], fKnee: [28, -6], fFoot: [-12, -2], rKnee: [20, -6], rFoot: [-20, -2] },
  },
  back: {
    bottom: { head: [18, -96], neck: [12, -80], hip: [0, -20], fElbow: [26, -70], fHand: [20, -90], rElbow: [18, -66], rHand: [14, -88], fKnee: [36, -42], fFoot: [62, 0], rKnee: [30, -36], rFoot: [56, 0] },
    top: { head: [-4, -100], neck: [-12, -84], hip: [-26, -22], fElbow: [8, -82], fHand: [18, -94], rElbow: [-2, -92], rHand: [14, -98], fKnee: [16, -44], fFoot: [30, -18], rKnee: [8, -38], rFoot: [24, -12] },
  },
  armbar: {
    bottom: mod(B_FLAT, { fElbow: [26, -46], fHand: [22, -74] }),
    top: { head: [-40, -12], neck: [-22, -12], hip: [30, -14], fElbow: [8, -34], fHand: [22, -62], rElbow: [0, -28], rHand: [18, -56], fKnee: [52, -46], fFoot: [82, -30], rKnee: [48, -38], rFoot: [74, -12] },
  },
  triangle: {
    bottom: { head: [72, -14], neck: [54, -16], hip: [0, -16], fElbow: [36, -42], fHand: [20, -72], rElbow: [42, -34], rHand: [26, -66], fKnee: [-4, -86], fFoot: [26, -104], rKnee: [-14, -70], rFoot: [20, -88] },
    top: { head: [12, -88], neck: [0, -80], hip: [-34, -48], fElbow: [10, -56], fHand: [24, -40], rElbow: [-2, -58], rHand: [12, -42], fKnee: [-20, -4], fFoot: [-60, 0], rKnee: [-32, -4], rFoot: [-70, 0] },
  },
  guillotine: {
    bottom: mod(B_FLAT, { fKnee: [-16, -58], fFoot: [-40, -40], rKnee: [-8, -52], rFoot: [-32, -36], fElbow: [30, -60], fHand: [12, -76], rElbow: [36, -54], rHand: [16, -72] }),
    top: { head: [20, -70], neck: [6, -74], hip: [-30, -50], fElbow: [26, -46], fHand: [40, -28], rElbow: [10, -50], rHand: [24, -28], fKnee: [-18, -4], fFoot: [-58, 0], rKnee: [-30, -4], rFoot: [-68, 0] },
  },
};

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const k of JOINTS) out[k] = [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t];
  return out;
}
export const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
