import type { AttrKey } from '../game/attributes';
import type { BackgroundId, BodyType, DivisionId, GamePlanId, OrgId, StyleId } from '../game/types';

export const LB = 0.453592;

export interface DivisionDef { id: DivisionId; name: string; lb: number; kg: number; avgHeight: number }
export const DIVISIONS: DivisionDef[] = [
  { id: 'fly', name: 'Flyweight', lb: 125, kg: 56.7, avgHeight: 165 },
  { id: 'bantam', name: 'Bantamweight', lb: 135, kg: 61.2, avgHeight: 170 },
  { id: 'feather', name: 'Featherweight', lb: 145, kg: 65.8, avgHeight: 174 },
  { id: 'light', name: 'Lightweight', lb: 155, kg: 70.3, avgHeight: 177 },
  { id: 'welter', name: 'Welterweight', lb: 170, kg: 77.1, avgHeight: 181 },
  { id: 'middle', name: 'Middleweight', lb: 185, kg: 83.9, avgHeight: 185 },
  { id: 'lhw', name: 'Light Heavyweight', lb: 205, kg: 93.0, avgHeight: 189 },
  { id: 'heavy', name: 'Heavyweight', lb: 265, kg: 120.2, avgHeight: 193 },
];
export const DIV: Record<DivisionId, DivisionDef> = Object.fromEntries(DIVISIONS.map((d) => [d.id, d])) as any;

export interface OrgDef {
  id: OrgId;
  name: string;
  short: string;
  tier: number;
  level: [number, number]; // typical overall range
  rosterPerDiv: number;
  eventEveryDays: number;
  purse: number; // entry show money
  winBonus: number;
  color: string;
  reputation: number;
  desc: string;
  expectations: string;
}
export const ORGS: OrgDef[] = [
  { id: 'ifc', name: 'Independent Fight Circuit', short: 'IFC', tier: 1, level: [34, 52], rosterPerDiv: 9, eventEveryDays: 14, purse: 800, winBonus: 800, color: '#8a9bb0', reputation: 15,
    desc: 'Local shows in community halls and casinos. Where everyone starts.', expectations: 'Show up, make weight, fight often.' },
  { id: 'rfl', name: 'Rising Fighters League', short: 'RFL', tier: 2, level: [44, 60], rosterPerDiv: 10, eventEveryDays: 21, purse: 2500, winBonus: 2500, color: '#3fb68b', reputation: 35,
    desc: 'The developmental feeder league scouts watch closely.', expectations: 'Win impressively — finishes get you noticed.' },
  { id: 'cms', name: 'Continental MMA Series', short: 'CMS', tier: 3, level: [52, 68], rosterPerDiv: 12, eventEveryDays: 21, purse: 6000, winBonus: 6000, color: '#4f8df5', reputation: 55,
    desc: 'A major regional promotion with televised cards across the continent.', expectations: 'Stay active and entertaining.' },
  { id: 'gfc', name: 'Global Fight Championship', short: 'GFC', tier: 4, level: [60, 78], rosterPerDiv: 13, eventEveryDays: 14, purse: 12000, winBonus: 12000, color: '#c47cff', reputation: 78,
    desc: 'An established international rival to the HFC.', expectations: 'Headline-quality fights and media duties.' },
  { id: 'acl', name: 'Hexagon Fighting Championship', short: 'HFC', tier: 5, level: [67, 90], rosterPerDiv: 15, eventEveryDays: 14, purse: 20000, winBonus: 20000, color: '#ff5a36', reputation: 95,
    desc: 'The pinnacle of the sport. Its belts define legacies.', expectations: 'Elite performance, every time.' },
];
export const ORG: Record<OrgId, OrgDef> = Object.fromEntries(ORGS.map((o) => [o.id, o])) as any;

export interface StyleDef {
  id: StyleId;
  name: string;
  desc: string;
  bias: Partial<Record<AttrKey, number>>;
  plan: GamePlanId;
}
export const STYLES: StyleDef[] = [
  { id: 'pressure', name: 'Pressure Boxer', plan: 'pressure', desc: 'Walks forward, cuts off the cage and throws combinations.',
    bias: { boxing: 12, combos: 14, punchPower: 6, aggression: 18, cardio: 8, endurance: 8, headMovement: 4, kickboxing: -8, bjj: -8, subOffense: -10, distance: -4 } },
  { id: 'counter', name: 'Counter-Striker', plan: 'counter', desc: 'Stays at range, makes you miss and makes you pay.',
    bias: { counter: 18, headMovement: 12, distance: 12, punchAccuracy: 10, fightIQ: 10, composure: 8, aggression: -14, wrestling: -6, tdOffense: -10 } },
  { id: 'kickboxer', name: 'Technical Kickboxer', plan: 'distance', desc: 'Long kicks, sharp straight punches and disciplined distance.',
    bias: { kickboxing: 16, kickAccuracy: 14, kickPower: 10, distance: 12, flexibility: 10, punchAccuracy: 4, wrestling: -10, tdOffense: -12, topControl: -8, bjj: -6 } },
  { id: 'wrestler', name: 'Wrestler', plan: 'wrestling', desc: 'Chains takedowns and grinds opponents on the mat.',
    bias: { wrestling: 16, tdOffense: 16, tdDefense: 12, topControl: 14, strength: 8, cardio: 8, gnp: 6, kickboxing: -12, kickAccuracy: -10, headMovement: -6, subOffense: -4 } },
  { id: 'submission', name: 'Submission Specialist', plan: 'submission', desc: 'Hunts necks and limbs from anywhere.',
    bias: { bjj: 18, subOffense: 18, subDefense: 14, sweeps: 14, posAwareness: 12, flexibility: 8, boxing: -8, punchPower: -10, kickPower: -8, tdDefense: -4 } },
  { id: 'clinch', name: 'Clinch Fighter', plan: 'clinch', desc: 'Ties you up against the fence: knees, elbows and trips.',
    bias: { clinch: 18, knees: 16, elbows: 14, strength: 10, tdDefense: 6, wrestling: 4, kickAccuracy: -6, distance: -10, headMovement: -6 } },
  { id: 'balanced', name: 'Balanced MMA', plan: 'balanced', desc: 'Competent everywhere, dominant nowhere.',
    bias: { fightIQ: 6, adaptability: 10, composure: 4 } },
  { id: 'power', name: 'Power Puncher', plan: 'pressure', desc: 'Loads up on heavy shots. Dangerous early, fades late.',
    bias: { punchPower: 20, explosiveness: 10, strength: 8, durability: 6, aggression: 10, cardio: -7, endurance: -6, punchAccuracy: -2, combos: -4, bjj: -8, tdDefense: 3 } },
  { id: 'point', name: 'Defensive Point Fighter', plan: 'defensive', desc: 'Low-risk volume and slick defense. Rarely finishes.',
    bias: { headMovement: 14, blocking: 14, distance: 10, punchSpeed: 10, punchAccuracy: 8, cardio: 10, tdDefense: 12, punchPower: -7, kickPower: -5, aggression: -12, bjj: -4, subOffense: -6 } },
  { id: 'gnp', name: 'Ground-and-Pound Brawler', plan: 'wrestling', desc: 'Takes you down and pounds you out.',
    bias: { gnp: 18, topControl: 12, tdOffense: 10, strength: 12, aggression: 14, elbows: 8, punchPower: 6, subOffense: -8, sweeps: -8, kickboxing: -8, distance: -6 } },
];
export const STYLE: Record<StyleId, StyleDef> = Object.fromEntries(STYLES.map((s) => [s.id, s])) as any;

export interface BackgroundDef { id: BackgroundId; name: string; desc: string; bias: Partial<Record<AttrKey, number>>; style: StyleId }
export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'wrestling', name: 'Wrestling', style: 'wrestler', desc: 'Collegiate wrestler. Elite takedowns and top control, raw striking.',
    bias: { wrestling: 18, tdOffense: 16, tdDefense: 14, topControl: 12, strength: 6, cardio: 6, discipline: 6, kickboxing: -10, kickAccuracy: -10, kickPower: -6, headMovement: -6, bjj: -4 } },
  { id: 'boxing', name: 'Boxing', style: 'pressure', desc: 'Amateur boxing pedigree. Sharp hands and head movement, no ground game.',
    bias: { boxing: 18, punchAccuracy: 12, punchSpeed: 10, headMovement: 12, combos: 12, counter: 6, wrestling: -10, tdDefense: -8, bjj: -12, subDefense: -8, kickboxing: -8 } },
  { id: 'kickboxing', name: 'Kickboxing', style: 'kickboxer', desc: 'Dutch-style kickboxer. Kicks and combinations, weak off the back.',
    bias: { kickboxing: 18, kickPower: 12, kickAccuracy: 12, combos: 8, distance: 8, flexibility: 6, wrestling: -10, bottomDefense: -8, bjj: -10, tdOffense: -10 } },
  { id: 'bjj', name: 'Brazilian Jiu-Jitsu', style: 'submission', desc: 'Black-belt grappler. Submissions everywhere, striking is a work in progress.',
    bias: { bjj: 20, subOffense: 16, subDefense: 16, sweeps: 14, posAwareness: 10, flexibility: 8, boxing: -10, punchPower: -6, headMovement: -8, tdOffense: -4, kickboxing: -8 } },
  { id: 'muaythai', name: 'Muay Thai', style: 'clinch', desc: 'Thai-boxing roots. Knees, elbows and a dangerous clinch.',
    bias: { knees: 18, elbows: 16, clinch: 14, kickPower: 12, kickboxing: 8, durability: 6, wrestling: -10, bjj: -10, tdDefense: -6, headMovement: -4 } },
  { id: 'judo', name: 'Judo', style: 'clinch', desc: 'Judoka. Throws from the clinch, great balance, average striking.',
    bias: { clinch: 16, balance: 16, tdOffense: 10, strength: 8, topControl: 8, subDefense: 6, bjj: 4, boxing: -8, kickboxing: -10, kickAccuracy: -8, headMovement: -6 } },
  { id: 'mma', name: 'General MMA', style: 'balanced', desc: 'Grew up in MMA gyms. No glaring holes and no superpower.',
    bias: { fightIQ: 6, adaptability: 8, composure: 4, combos: 2, wrestling: 2, bjj: 2 } },
];
export const BACKGROUND: Record<BackgroundId, BackgroundDef> = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b])) as any;

export interface BodyTypeDef { id: BodyType; name: string; desc: string; bias: Partial<Record<AttrKey, number>>; reachAdj: number; suggest: string }
export const BODY_TYPES: BodyTypeDef[] = [
  { id: 'lean', name: 'Lean & Mobile', reachAdj: 2, suggest: 'Counter-striking, kickboxing', desc: 'Light on the feet with a big gas tank. Less raw strength.',
    bias: { speed: 7, agility: 8, cardio: 6, endurance: 4, strength: -7, durability: -3 } },
  { id: 'compact', name: 'Compact & Powerful', reachAdj: -3, suggest: 'Pressure boxing, wrestling', desc: 'Short levers and explosive hips. Smaller reach.',
    bias: { explosiveness: 8, punchPower: 6, strength: 5, balance: 4, agility: 2, distance: -6 } },
  { id: 'rangy', name: 'Tall & Rangy', reachAdj: 6, suggest: 'Distance striking, submissions', desc: 'Long reach and limbs. Easier to bully in the clinch.',
    bias: { distance: 8, kickAccuracy: 4, flexibility: 5, subOffense: 3, balance: -5, clinch: -5, strength: -3 } },
  { id: 'stocky', name: 'Stocky & Strong', reachAdj: -1, suggest: 'Wrestling, ground-and-pound', desc: 'Dense and hard to move. Gets tired carrying the muscle.',
    bias: { strength: 9, durability: 6, balance: 6, tdDefense: 3, cardio: -6, speed: -4, flexibility: -4 } },
];
export const BODY_TYPE: Record<BodyType, BodyTypeDef> = Object.fromEntries(BODY_TYPES.map((b) => [b.id, b])) as any;

export const GAME_PLANS: { id: GamePlanId; name: string; desc: string; bonus: string }[] = [
  { id: 'pressure', name: 'Pressure Striking', desc: 'March forward, cut the cage, overwhelm with volume.', bonus: '+Forward speed, +damage while advancing, −stamina regen' },
  { id: 'counter', name: 'Counter-Striking', desc: 'Make them miss, make them pay.', bonus: '+Counter damage/accuracy, longer read on attacks' },
  { id: 'distance', name: 'Distance Management', desc: 'Stay on the end of your long weapons.', bonus: '+Strike range, +kick accuracy' },
  { id: 'wrestling', name: 'Wrestling-Heavy', desc: 'Get them down, keep them down.', bonus: '+Takedown success, cheaper grappling' },
  { id: 'clinch', name: 'Clinch-Focused', desc: 'Tie them up and work knees, elbows and trips.', bonus: '+Clinch entry/control, +knee damage' },
  { id: 'submission', name: 'Submission-Focused', desc: 'Find a limb or the neck.', bonus: '+Submission lock speed, +sweeps' },
  { id: 'balanced', name: 'Balanced MMA', desc: 'Take what they give you.', bonus: 'Small bonus everywhere' },
  { id: 'defensive', name: 'Defensive & Patient', desc: 'Survive, win the minutes, never get careless.', bonus: '+Guard absorption, +evasion, +stamina regen' },
];

export const NATIONS = [
  'United States', 'Brazil', 'Russia', 'Ireland', 'Mexico', 'Canada', 'England', 'Netherlands', 'Poland', 'Georgia',
  'Japan', 'South Korea', 'Australia', 'New Zealand', 'Nigeria', 'France', 'Sweden', 'China', 'Thailand', 'Kazakhstan',
  'Dagestan Region', 'Cameroon', 'Philippines', 'Argentina', 'Chile', 'Spain', 'Germany', 'Italy', 'Ukraine', 'Cuba',
];

export const FIRST_NAMES = [
  'Marcus', 'Diego', 'Tomasz', 'Kenji', 'Ruslan', 'Liam', 'Mateo', 'Andre', 'Kofi', 'Jae-won', 'Dmitri', 'Caio', 'Felipe',
  'Owen', 'Sean', 'Viktor', 'Jamal', 'Arman', 'Luis', 'Pierre', 'Hugo', 'Erik', 'Nikolai', 'Tariq', 'Bruno', 'Rafael',
  'Kai', 'Tane', 'Hemi', 'Darius', 'Sergio', 'Malik', 'Emeka', 'Yuto', 'Shamil', 'Islam', 'Khalid', 'Cody', 'Brandon',
  'Nate', 'Rory', 'Callum', 'Jonas', 'Lars', 'Henrique', 'Thiago', 'Anton', 'Ilya', 'Giorgi', 'Levan', 'Alejandro', 'Paulo',
  'Wei', 'Jun', 'Tiago', 'Omar', 'Ivan', 'Sasha', 'Mikael', 'Ronan', 'Jett', 'Bastian', 'Felix', 'Joaquin', 'Ricardo',
  'Abdul', 'Zhan', 'Bekzat', 'Somchai', 'Manny', 'Rey', 'Isaac', 'Elijah', 'Darnell', 'Trevor', 'Gunnar', 'Matteo',
];
export const LAST_NAMES = [
  'Vance', 'Santos', 'Kowalski', 'Tanaka', 'Magomedov', 'Byrne', 'Herrera', 'Okafor', 'Park', 'Volkov', 'Ferreira',
  'Silva', 'Reyes', 'Murphy', 'Lindqvist', 'Adeyemi', 'Nakamura', 'Kurbanov', 'Duarte', 'Moreau', 'Becker', 'Rossi',
  'Petrov', 'Haddad', 'Costa', 'Mendes', 'Ward', 'Walker', 'Kaipo', 'Ngata', 'Barros', 'Ortega', 'Chen', 'Lim', 'Yamada',
  'Aliev', 'Nurmagov', 'Kapanadze', 'Beridze', 'Novak', 'Horvat', 'Jansen', 'de Vries', 'Bakker', 'Gallagher', 'Doyle',
  'Price', 'Holloway', 'Castillo', 'Navarro', 'Vargas', 'Sokolov', 'Zhukov', 'Kozlov', 'Abara', 'Mbeki', 'Diallo',
  'Sato', 'Kimura', 'Ito', 'Choi', 'Kang', 'Thongchai', 'Suarez', 'Romero', 'Molina', 'Pacheco', 'Strand', 'Berg',
  'Fischer', 'Wagner', 'Hart', 'Stone', 'Cole', 'Ferro', 'Delgado', 'Mansour', 'Rahimov', 'Tursunov',
];
export const NICKNAMES = [
  'The Hammer', 'Ice', 'The Wolf', 'Cyclone', 'The Surgeon', 'Bulldozer', 'Phantom', 'The Viper', 'Thunder', 'Iron',
  'The Professor', 'Mad Dog', 'Kid Dynamite', 'The Anaconda', 'Silent', 'Pitbull', 'The Reaper', 'Hurricane', 'Showtime',
  'The Machine', 'Stone Cold', 'Blitz', 'The Eagle', 'Grizzly', 'The Natural', 'Lights Out', 'Bonecrusher', 'Smooth',
  'The Spider', 'Tank', 'Sniper', 'The Butcher', 'Shadow', 'The Matador', 'Monsoon', 'Diesel', 'The Prodigy', 'Saint',
  'Wildfire', 'The Technician', 'Rampage', 'Rattlesnake', 'Hitman', 'The Dentist', 'Tornado', 'Python', 'Juggernaut',
];

export const SKIN_TONES = ['#f2d0b4', '#e4b896', '#c99a72', '#a87650', '#7d5235', '#5a3a24', '#3e281a'];
export const HAIR_COLORS = ['#1b1714', '#3b2a1e', '#6b4a2b', '#a87a46', '#d8b46a', '#8a8a8a', '#b03a2e'];
export const SHORTS_COLORS = ['#c8102e', '#1d4ed8', '#111111', '#f5f5f5', '#16a34a', '#f59e0b', '#7c3aed', '#0e7490'];
export const HAIR_STYLES = ['Shaved', 'Buzz cut', 'Short', 'Mohawk', 'Long tied', 'Afro'];
export const FACIAL_HAIR = ['None', 'Stubble', 'Goatee', 'Full beard'];
export const ACCESSORIES = ['None', 'Tattoo sleeve', 'Headband', 'Chest tattoo'];
