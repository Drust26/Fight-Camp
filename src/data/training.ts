import type { AttrKey } from '../game/attributes';

export type SessionCat = 'striking' | 'grappling' | 'conditioning' | 'mma' | 'recovery' | 'life';
export type Facility = 'striking' | 'wrestling' | 'grappling' | 'conditioning' | 'recovery' | 'partners';
export type CoachSpec = 'striking' | 'wrestling' | 'grappling' | 'conditioning' | 'tactics' | 'recovery';

export interface SessionDef {
  id: string;
  name: string;
  cat: SessionCat;
  facility: Facility;
  coach: CoachSpec | null;
  gains: Partial<Record<AttrKey, number>>;
  intensity: number; // fatigue added
  risk: number; // base injury chance per session
  cost: number; // extra $ per session (mat fees, sparring partners)
  hours: number;
  contact: 'none' | 'light' | 'hard';
  tags: ('punch' | 'kick' | 'wrestle' | 'ground' | 'sparring' | 'explosive')[];
  requires?: { facility?: number; coach?: number };
  desc: string;
  special?: 'recovery' | 'rehab' | 'work' | 'film' | 'prep' | 'media';
  sharpness?: number;
}

export const SESSIONS: SessionDef[] = [
  // ── Striking
  { id: 'boxing', name: 'Boxing Fundamentals', cat: 'striking', facility: 'striking', coach: 'striking', hours: 2, contact: 'light', tags: ['punch'],
    gains: { boxing: 1, punchAccuracy: 0.6, punchSpeed: 0.4, combos: 0.3 }, intensity: 14, risk: 0.004, cost: 0, desc: 'Pads, shadowboxing and technical bag work.' },
  { id: 'combos', name: 'Punching Combinations', cat: 'striking', facility: 'striking', coach: 'striking', hours: 2, contact: 'light', tags: ['punch'],
    gains: { combos: 1, punchSpeed: 0.6, boxing: 0.4, cardio: 0.2 }, intensity: 16, risk: 0.004, cost: 0, desc: 'High-volume combination drills on mitts.' },
  { id: 'powerbag', name: 'Heavy Bag Power', cat: 'striking', facility: 'striking', coach: null, hours: 1.5, contact: 'none', tags: ['punch', 'kick'],
    gains: { punchPower: 1, kickPower: 0.5, strength: 0.2 }, intensity: 15, risk: 0.005, cost: 0, desc: 'Sit down on every shot. Builds knockout power.' },
  { id: 'kickboxing', name: 'Kickboxing', cat: 'striking', facility: 'striking', coach: 'striking', hours: 2, contact: 'light', tags: ['kick', 'punch'],
    gains: { kickboxing: 1, kickAccuracy: 0.6, kickPower: 0.4, distance: 0.4, flexibility: 0.2 }, intensity: 16, risk: 0.006, cost: 0, desc: 'Kicks, switch kicks and punch-kick combinations.' },
  { id: 'muaythai', name: 'Muay Thai Clinch Work', cat: 'striking', facility: 'striking', coach: 'striking', hours: 2, contact: 'light', tags: ['kick'],
    gains: { knees: 1, elbows: 0.8, clinch: 0.5, kickPower: 0.4 }, intensity: 18, risk: 0.007, cost: 15, requires: { facility: 50 }, desc: 'Plum clinch, knees and elbows. Needs a decent striking room.' },
  { id: 'defstrike', name: 'Defensive Striking', cat: 'striking', facility: 'striking', coach: 'striking', hours: 1.5, contact: 'light', tags: ['punch'],
    gains: { headMovement: 1, blocking: 0.8, distance: 0.4, composure: 0.2 }, intensity: 12, risk: 0.003, cost: 0, desc: 'Slips, rolls, parries and shell defense.' },
  { id: 'countering', name: 'Counter-Striking', cat: 'striking', facility: 'striking', coach: 'striking', hours: 1.5, contact: 'light', tags: ['punch'],
    gains: { counter: 1, fightIQ: 0.4, headMovement: 0.3, punchAccuracy: 0.3 }, intensity: 13, risk: 0.003, cost: 0, desc: 'Reactive drills: make them miss, make them pay.' },
  { id: 'sparstrike', name: 'Hard Striking Sparring', cat: 'striking', facility: 'partners', coach: 'striking', hours: 1.5, contact: 'hard', tags: ['punch', 'kick', 'sparring'], sharpness: 10,
    gains: { boxing: 0.5, kickboxing: 0.4, headMovement: 0.5, composure: 0.6, experience: 0.4, durability: 0.25, distance: 0.4 }, intensity: 26, risk: 0.03, cost: 20, desc: 'Live rounds at near fight intensity. Fast learning, real risk.' },
  // ── Grappling
  { id: 'wrestling', name: 'Wrestling Drills', cat: 'grappling', facility: 'wrestling', coach: 'wrestling', hours: 2, contact: 'light', tags: ['wrestle'],
    gains: { wrestling: 1, tdOffense: 0.6, balance: 0.3, strength: 0.2 }, intensity: 20, risk: 0.008, cost: 0, desc: 'Stance, penetration steps and hand fighting.' },
  { id: 'tdchains', name: 'Takedown Chains', cat: 'grappling', facility: 'wrestling', coach: 'wrestling', hours: 2, contact: 'light', tags: ['wrestle', 'explosive'],
    gains: { tdOffense: 1, explosiveness: 0.3, wrestling: 0.4, fightIQ: 0.2 }, intensity: 20, risk: 0.009, cost: 0, desc: 'Double to single to trip. Never stop at one attempt.' },
  { id: 'tddef', name: 'Takedown Defense', cat: 'grappling', facility: 'wrestling', coach: 'wrestling', hours: 1.5, contact: 'light', tags: ['wrestle'],
    gains: { tdDefense: 1, balance: 0.5, wrestling: 0.3 }, intensity: 16, risk: 0.006, cost: 0, desc: 'Sprawls, whizzers and underhooks.' },
  { id: 'bjj', name: 'BJJ Fundamentals', cat: 'grappling', facility: 'grappling', coach: 'grappling', hours: 2, contact: 'light', tags: ['ground'],
    gains: { bjj: 1, subDefense: 0.5, posAwareness: 0.5, flexibility: 0.2 }, intensity: 14, risk: 0.005, cost: 0, desc: 'Guard, passing and core submissions.' },
  { id: 'subchains', name: 'Submission Transitions', cat: 'grappling', facility: 'grappling', coach: 'grappling', hours: 2, contact: 'light', tags: ['ground'],
    gains: { subOffense: 1, bjj: 0.5, sweeps: 0.3 }, intensity: 14, risk: 0.006, cost: 10, requires: { facility: 50 }, desc: 'Armbar to triangle to omoplata chains.' },
  { id: 'escapes', name: 'Ground Escapes', cat: 'grappling', facility: 'grappling', coach: 'grappling', hours: 1.5, contact: 'light', tags: ['ground'],
    gains: { bottomDefense: 1, sweeps: 0.7, subDefense: 0.4 }, intensity: 15, risk: 0.005, cost: 0, desc: 'Shrimping, bridging, wall-walking and sweeps.' },
  { id: 'topgame', name: 'Top Control & Passing', cat: 'grappling', facility: 'grappling', coach: 'grappling', hours: 1.5, contact: 'light', tags: ['ground'],
    gains: { topControl: 1, posAwareness: 0.6, gnp: 0.3, strength: 0.2 }, intensity: 16, risk: 0.005, cost: 0, desc: 'Heavy hips, guard passing and mount retention.' },
  { id: 'rolling', name: 'Positional Sparring', cat: 'grappling', facility: 'partners', coach: 'grappling', hours: 1.5, contact: 'hard', tags: ['ground', 'wrestle', 'sparring'], sharpness: 8,
    gains: { bjj: 0.5, wrestling: 0.3, posAwareness: 0.5, subDefense: 0.5, cardio: 0.3, experience: 0.3 }, intensity: 24, risk: 0.02, cost: 10, desc: 'Live rolling from set positions.' },
  // ── Conditioning
  { id: 'aerobic', name: 'Aerobic Conditioning', cat: 'conditioning', facility: 'conditioning', coach: 'conditioning', hours: 1.5, contact: 'none', tags: [],
    gains: { cardio: 1, endurance: 0.8, recovery: 0.2 }, intensity: 12, risk: 0.002, cost: 0, desc: 'Long runs and bike work. Builds the engine.' },
  { id: 'hiit', name: 'High-Intensity Intervals', cat: 'conditioning', facility: 'conditioning', coach: 'conditioning', hours: 1, contact: 'none', tags: ['explosive'],
    gains: { endurance: 1, cardio: 0.6, explosiveness: 0.3, discipline: 0.2 }, intensity: 24, risk: 0.005, cost: 0, desc: 'Brutal intervals. Big gains, big fatigue.' },
  { id: 'strength', name: 'Strength Training', cat: 'conditioning', facility: 'conditioning', coach: 'conditioning', hours: 1.5, contact: 'none', tags: [],
    gains: { strength: 1, durability: 0.2, punchPower: 0.2, balance: 0.2 }, intensity: 18, risk: 0.007, cost: 0, desc: 'Squats, deadlifts, carries.' },
  { id: 'plyo', name: 'Explosive Power', cat: 'conditioning', facility: 'conditioning', coach: 'conditioning', hours: 1, contact: 'none', tags: ['explosive'],
    gains: { explosiveness: 1, speed: 0.6, agility: 0.4 }, intensity: 18, risk: 0.008, cost: 0, desc: 'Plyometrics, sprints and med-ball throws.' },
  { id: 'mobility', name: 'Mobility & Yoga', cat: 'conditioning', facility: 'recovery', coach: 'recovery', hours: 1, contact: 'none', tags: [],
    gains: { flexibility: 1, balance: 0.5, recovery: 0.3, agility: 0.2 }, intensity: 3, risk: 0, cost: 0, desc: 'Low fatigue. Improves flexibility and lowers future injury risk.' },
  // ── MMA integration
  { id: 'cagewrestle', name: 'Cage Wrestling', cat: 'mma', facility: 'wrestling', coach: 'wrestling', hours: 1.5, contact: 'light', tags: ['wrestle'],
    gains: { clinch: 1, tdOffense: 0.5, tdDefense: 0.5, strength: 0.3 }, intensity: 22, risk: 0.01, cost: 0, desc: 'Fence fighting: pins, underhooks, trips.' },
  { id: 'strike2td', name: 'Strike-to-Takedown', cat: 'mma', facility: 'wrestling', coach: 'wrestling', hours: 1.5, contact: 'light', tags: ['wrestle', 'punch'],
    gains: { tdOffense: 0.8, combos: 0.4, fightIQ: 0.4, explosiveness: 0.3 }, intensity: 20, risk: 0.008, cost: 0, desc: 'Hide the shot behind the punches.' },
  { id: 'gnpdrill', name: 'Ground-and-Pound', cat: 'mma', facility: 'grappling', coach: 'grappling', hours: 1.5, contact: 'light', tags: ['ground'],
    gains: { gnp: 1, topControl: 0.5, elbows: 0.3 }, intensity: 16, risk: 0.005, cost: 0, desc: 'Posture, space and heavy strikes from top.' },
  { id: 'defmma', name: 'Defensive MMA', cat: 'mma', facility: 'partners', coach: 'tactics', hours: 1.5, contact: 'light', tags: ['wrestle', 'punch'],
    gains: { tdDefense: 0.5, headMovement: 0.5, bottomDefense: 0.5, composure: 0.4 }, intensity: 16, risk: 0.006, cost: 0, desc: 'Defend everything, from the feet to the floor.' },
  { id: 'fightsim', name: 'Fight Simulation', cat: 'mma', facility: 'partners', coach: 'tactics', hours: 2, contact: 'hard', tags: ['sparring', 'punch', 'kick', 'wrestle', 'ground'], sharpness: 14,
    gains: { endurance: 0.5, cardio: 0.4, composure: 0.5, experience: 0.5, fightIQ: 0.4, adaptability: 0.3 }, intensity: 30, risk: 0.025, cost: 30, requires: { facility: 45 },
    desc: 'Full five-minute rounds with fresh partners. Peak sharpness, peak risk.' },
  { id: 'tactical', name: 'Tactical Sparring', cat: 'mma', facility: 'partners', coach: 'tactics', hours: 1.5, contact: 'light', tags: ['sparring', 'punch'], sharpness: 6,
    gains: { fightIQ: 1, adaptability: 0.8, distance: 0.5, counter: 0.3, discipline: 0.3 }, intensity: 18, risk: 0.012, cost: 10, desc: 'Controlled sparring with specific objectives each round.' },
  { id: 'film', name: 'Film Study', cat: 'mma', facility: 'partners', coach: 'tactics', hours: 1, contact: 'none', tags: [], special: 'film',
    gains: { fightIQ: 0.6, adaptability: 0.5 }, intensity: 0, risk: 0, cost: 0, desc: 'Study tape. Also adds preparation for your next opponent.' },
  { id: 'oppprep', name: 'Opponent-Specific Camp', cat: 'mma', facility: 'partners', coach: 'tactics', hours: 2, contact: 'light', tags: ['sparring'], special: 'prep', sharpness: 6,
    gains: { fightIQ: 0.3, adaptability: 0.3 }, intensity: 16, risk: 0.008, cost: 25, desc: 'Partners mimic your next opponent. Requires a booked fight.' },
  // ── Recovery
  { id: 'light', name: 'Light Technical Work', cat: 'recovery', facility: 'striking', coach: null, hours: 1, contact: 'none', tags: [],
    gains: { boxing: 0.2, bjj: 0.2, kickboxing: 0.15, wrestling: 0.15, discipline: 0.2 }, intensity: 5, risk: 0, cost: 0, desc: 'Slow, technical flow work. Safe while injured.' },
  { id: 'recover', name: 'Active Recovery', cat: 'recovery', facility: 'recovery', coach: 'recovery', hours: 1, contact: 'none', tags: [], special: 'recovery',
    gains: { recovery: 0.2 }, intensity: -14, risk: 0, cost: 15, desc: 'Sauna, massage, ice baths. Removes fatigue.' },
  { id: 'rehab', name: 'Rehabilitation', cat: 'recovery', facility: 'recovery', coach: 'recovery', hours: 1.5, contact: 'none', tags: [], special: 'rehab',
    gains: {}, intensity: -4, risk: 0, cost: 40, desc: 'Physio-guided rehab. Speeds up injury recovery.' },
  // ── Life
  { id: 'work', name: 'Part-Time Job', cat: 'life', facility: 'partners', coach: null, hours: 5, contact: 'none', tags: [], special: 'work',
    gains: {}, intensity: 6, risk: 0, cost: 0, desc: 'Earn $90 working a shift. Costs training time.' },
  { id: 'media', name: 'Media & Social Content', cat: 'life', facility: 'partners', coach: null, hours: 2, contact: 'none', tags: [], special: 'media',
    gains: {}, intensity: 2, risk: 0, cost: 0, desc: 'Interviews, podcasts, social posts. Builds popularity slowly.' },
];
export const SESSION: Record<string, SessionDef> = Object.fromEntries(SESSIONS.map((s) => [s.id, s]));

export interface GymDef {
  id: string;
  name: string;
  location: string;
  fee: number;
  fac: Record<Facility, number>;
  equipment: number;
  reputation: number;
  specialty: string;
  minReputation: number;
  coaches: { id: string; name: string; specialty: CoachSpec; quality: number; fee: number }[];
}

export const GYMS: GymDef[] = [
  { id: 'ironside', name: 'Ironside Community Gym', location: 'Hometown', fee: 90, equipment: 35, reputation: 20, specialty: 'Cheap, friendly, basic', minReputation: 0,
    fac: { striking: 42, wrestling: 34, grappling: 36, conditioning: 45, recovery: 22, partners: 32 },
    coaches: [
      { id: 'c_iron1', name: 'Coach Ray Dunn', specialty: 'striking', quality: 42, fee: 150 },
      { id: 'c_iron2', name: 'Lena Vos', specialty: 'conditioning', quality: 40, fee: 120 },
    ] },
  { id: 'steelvalley', name: 'Steel Valley Wrestling Club', location: 'Steel Valley', fee: 180, equipment: 55, reputation: 45, specialty: 'Wrestling factory', minReputation: 0,
    fac: { striking: 32, wrestling: 82, grappling: 52, conditioning: 62, recovery: 40, partners: 60 },
    coaches: [
      { id: 'c_sv1', name: 'Hank Brodsky', specialty: 'wrestling', quality: 74, fee: 700 },
      { id: 'c_sv2', name: 'Maya Torres', specialty: 'conditioning', quality: 58, fee: 350 },
    ] },
  { id: 'lotus', name: 'Lotus Jiu-Jitsu Academy', location: 'Harbor District', fee: 200, equipment: 55, reputation: 48, specialty: 'Submission grappling', minReputation: 0,
    fac: { striking: 30, wrestling: 44, grappling: 86, conditioning: 46, recovery: 52, partners: 62 },
    coaches: [
      { id: 'c_lo1', name: 'Professor Ícaro Lemos', specialty: 'grappling', quality: 78, fee: 750 },
      { id: 'c_lo2', name: 'Aiko Hara', specialty: 'recovery', quality: 55, fee: 300 },
    ] },
  { id: 'kingsguard', name: 'Kingsguard Kickboxing', location: 'Eastside', fee: 220, equipment: 60, reputation: 50, specialty: 'Technical striking', minReputation: 0,
    fac: { striking: 86, wrestling: 26, grappling: 28, conditioning: 60, recovery: 44, partners: 64 },
    coaches: [
      { id: 'c_kg1', name: 'Jaap Verhoeven', specialty: 'striking', quality: 80, fee: 800 },
      { id: 'c_kg2', name: 'Sam Achebe', specialty: 'tactics', quality: 52, fee: 300 },
    ] },
  { id: 'northstar', name: 'Northstar MMA', location: 'Capital City', fee: 450, equipment: 75, reputation: 72, specialty: 'Well-rounded pro team', minReputation: 25,
    fac: { striking: 72, wrestling: 70, grappling: 70, conditioning: 76, recovery: 70, partners: 76 },
    coaches: [
      { id: 'c_ns1', name: 'Dana Whitlock', specialty: 'tactics', quality: 78, fee: 1100 },
      { id: 'c_ns2', name: 'Bogdan Rusu', specialty: 'wrestling', quality: 70, fee: 900 },
      { id: 'c_ns3', name: 'Kirra Wells', specialty: 'conditioning', quality: 72, fee: 800 },
      { id: 'c_ns4', name: 'Marco Pellegrini', specialty: 'striking', quality: 70, fee: 900 },
    ] },
  { id: 'apexpi', name: 'Apex Performance Institute', location: 'Desert Springs', fee: 1200, equipment: 95, reputation: 95, specialty: 'Elite, everything', minReputation: 55,
    fac: { striking: 90, wrestling: 88, grappling: 88, conditioning: 94, recovery: 95, partners: 92 },
    coaches: [
      { id: 'c_api1', name: 'Viktor Saar', specialty: 'striking', quality: 92, fee: 3500 },
      { id: 'c_api2', name: 'Dr. Lucia Ferraz', specialty: 'recovery', quality: 94, fee: 3000 },
      { id: 'c_api3', name: 'Kamal Idrisov', specialty: 'wrestling', quality: 92, fee: 3500 },
      { id: 'c_api4', name: 'Renata Gracie-Lima', specialty: 'grappling', quality: 93, fee: 3500 },
      { id: 'c_api5', name: 'Tom Ashby', specialty: 'tactics', quality: 90, fee: 3200 },
    ] },
];
export const GYM: Record<string, GymDef> = Object.fromEntries(GYMS.map((g) => [g.id, g]));

export interface InjuryDef {
  id: string;
  name: string;
  attrs: Partial<Record<AttrKey, number>>; // penalty at severity 1 (scaled by severity)
  days: [number, number];
  blocks: string[]; // session tags blocked
  cost: number; // treatment cost
  suspension: boolean;
  desc: string;
}
export const INJURIES: Record<string, InjuryDef> = {
  ribs: { id: 'ribs', name: 'Bruised Ribs', attrs: { endurance: -6, cardio: -4, durability: -3 }, days: [10, 20], blocks: ['sparring', 'wrestle'], cost: 250, suspension: false, desc: 'Breathing hurts. Body shots will hurt more.' },
  hand: { id: 'hand', name: 'Damaged Hand', attrs: { punchPower: -12, boxing: -5, punchAccuracy: -3 }, days: [14, 32], blocks: ['punch'], cost: 600, suspension: false, desc: 'Swollen knuckles. Punching at full power is not possible.' },
  ankle: { id: 'ankle', name: 'Sprained Ankle', attrs: { speed: -8, agility: -9, kickPower: -6, balance: -5 }, days: [7, 20], blocks: ['kick', 'explosive'], cost: 300, suspension: false, desc: 'Movement and kicking are compromised.' },
  knee: { id: 'knee', name: 'Knee Ligament Strain', attrs: { explosiveness: -10, tdOffense: -8, kickPower: -8, speed: -5 }, days: [28, 60], blocks: ['kick', 'wrestle', 'explosive', 'sparring'], cost: 2500, suspension: false, desc: 'A serious knee strain. Rest and rehab are essential.' },
  cut: { id: 'cut', name: 'Facial Cut', attrs: { durability: -4 }, days: [7, 14], blocks: ['sparring'], cost: 150, suspension: false, desc: 'A cut over the eye that could reopen under pressure.' },
  shoulder: { id: 'shoulder', name: 'Shoulder Strain', attrs: { strength: -6, punchPower: -6, subOffense: -5, clinch: -4 }, days: [14, 28], blocks: ['wrestle', 'ground'], cost: 450, suspension: false, desc: 'Pulling and pushing are weak.' },
  concussion: { id: 'concussion', name: 'Concussion Protocol', attrs: { durability: -10, composure: -6, fightIQ: -4 }, days: [28, 50], blocks: ['sparring'], cost: 800, suspension: true, desc: 'Brain trauma after heavy head damage (medical suspension). No hard contact until cleared.' },
  swelling: { id: 'swelling', name: 'Swelling & Bruising', attrs: { durability: -2, speed: -2 }, days: [3, 7], blocks: [], cost: 60, suspension: false, desc: 'General soreness from a hard fight or session.' },
};

export const LIFESTYLE = {
  housing: [
    { name: 'Shared Room', cost: 650, recovery: 0, desc: 'Cheap and noisy.' },
    { name: 'Own Apartment', cost: 1400, recovery: 0.08, desc: '+8% daily fatigue recovery.' },
    { name: 'Premium Condo', cost: 3600, recovery: 0.16, desc: '+16% recovery, small popularity boost.' },
  ],
  nutrition: [
    { name: 'Cook for Yourself', cost: 300, recovery: 0, weight: 0, desc: 'Groceries only.' },
    { name: 'Meal Plan Service', cost: 650, recovery: 0.05, weight: 0.25, desc: '+5% recovery, easier weight control.' },
    { name: 'Personal Nutritionist', cost: 1500, recovery: 0.1, weight: 0.5, desc: '+10% recovery, much easier weight cuts.' },
  ],
  physio: { name: 'Physio Membership', cost: 400, desc: 'Injuries heal 25% faster; −15% injury risk.' },
  homeGym: { name: 'Home Gym Equipment', cost: 2500, desc: 'One-off. +6% conditioning session quality.' },
};

export interface SponsorDef { id: string; name: string; kind: string; minPop: number; base: number; desc: string }
export const SPONSORS: SponsorDef[] = [
  { id: 'corner', name: "Corner Deli & Grill", kind: 'Local business', minPop: 0, base: 150, desc: 'Your neighbourhood spot backs its local fighter.' },
  { id: 'gripwrap', name: 'GripWrap Tape Co.', kind: 'Equipment', minPop: 12, base: 300, desc: 'Hand wraps and athletic tape.' },
  { id: 'vortex', name: 'Vortex Apparel', kind: 'Sportswear', minPop: 22, base: 650, desc: 'Streetwear brand chasing fight fans.' },
  { id: 'ironfuel', name: 'IronFuel Nutrition', kind: 'Nutrition', minPop: 30, base: 1000, desc: 'Protein, electrolytes and recovery shakes.' },
  { id: 'titan', name: 'Titan Combat Gear', kind: 'Equipment', minPop: 40, base: 1800, desc: 'Premium gloves and shin guards.' },
  { id: 'pulse', name: 'Pulse Energy', kind: 'Beverage', minPop: 52, base: 4000, desc: 'Loves finishes. Hates boring decisions.' },
  { id: 'kinetic', name: 'Kinetic Sportswear', kind: 'Sportswear', minPop: 62, base: 7500, desc: 'Global athletic brand.' },
  { id: 'meridian', name: 'Meridian Watches', kind: 'International luxury', minPop: 76, base: 15000, desc: 'Only signs genuine stars.' },
];
export const SPONSOR: Record<string, SponsorDef> = Object.fromEntries(SPONSORS.map((s) => [s.id, s]));
