import type { Attributes, AttrKey } from './attributes';
import type { Look } from './look';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'simulation';
export type Stance = 'orthodox' | 'southpaw';
export type BodyType = 'lean' | 'compact' | 'rangy' | 'stocky';
export type BackgroundId = 'wrestling' | 'boxing' | 'kickboxing' | 'bjj' | 'muaythai' | 'judo' | 'mma';
export type StartLevel = 'amateur' | 'pro' | 'regional';
export type StyleId =
  | 'pressure' | 'counter' | 'kickboxer' | 'wrestler' | 'submission' | 'clinch' | 'balanced' | 'power' | 'point' | 'gnp';
export type DivisionId = 'fly' | 'bantam' | 'feather' | 'light' | 'welter' | 'middle' | 'lhw' | 'heavy';
export type OrgId = 'ifc' | 'rfl' | 'cms' | 'gfc' | 'acl';
export type GoalId = 'champion' | 'undefeated' | 'ko_artist' | 'sub_artist' | 'money' | 'allrounder';
export type GamePlanId = 'pressure' | 'counter' | 'distance' | 'wrestling' | 'clinch' | 'submission' | 'balanced' | 'defensive';
export type Method = 'KO' | 'TKO' | 'SUB' | 'UD' | 'SD' | 'MD' | 'DRAW' | 'DQ';

export interface Appearance {
  skin: number; // index into palette
  hair: number; // style index
  hairColor: number;
  facialHair: number;
  shorts: number; // colour index
  gloves: number;
  accessory: number; // 0 none, 1 tattoo sleeve, 2 headband, 3 mouthguard colour
  look?: Look; // full cosmetic appearance (v7); derived from the fields above when absent
}

export interface FightRecord {
  w: number; l: number; d: number;
  ko: number; tko: number; sub: number; dec: number;
  lossKo: number; lossSub: number; lossDec: number;
}

export interface Injury {
  id: string;
  type: string; // key into INJURIES
  severity: number; // 1..3
  daysLeft: number;
  totalDays: number;
  treated: boolean;
  source: string;
}

export interface Contract {
  orgId: OrgId;
  fightsTotal: number;
  fightsLeft: number;
  purse: number;
  winBonus: number;
  signingBonus: number;
  exclusive: boolean;
  champClause: boolean; // auto-extension + raise if champion
  amateur: boolean;
  signedDay: number;
}

export interface Coach {
  id: string;
  name: string;
  specialty: 'striking' | 'wrestling' | 'grappling' | 'conditioning' | 'tactics' | 'recovery';
  quality: number; // 1..100
  fee: number; // monthly
}

export interface FightHistoryEntry {
  id: string;
  day: number;
  orgId: OrgId;
  event: string;
  opponentId: string;
  opponentName: string;
  opponentRecord: string;
  result: 'W' | 'L' | 'D';
  method: Method;
  round: number;
  time: string;
  title: boolean;
  amateur: boolean;
  earnings: number;
  bonuses: string[];
  notes: string;
  div?: DivisionId; // division the bout was contested in (v9+)
  poster?: PosterMeta; // what the fight poster needs to be redrawn later (v9+)
}

/** Snapshot of fight-night billing details so past fights can show their poster again. */
export interface PosterMeta {
  slot?: 'prelim' | 'main' | 'comain' | 'mainevent';
  kind?: 'amateur' | 'regional' | 'standard' | 'major' | 'title';
  superfight?: boolean; homeDiv?: DivisionId; vacant?: boolean; rounds?: number;
  champion?: 'player' | 'opponent' | null;
  myRec?: string; oppRec?: string; oppNick?: string; oppNat?: string; oppHeight?: number;
  undercard?: string[];
  rematch?: number; rivalry?: boolean;
}

export interface ReignEnd { day: number; kind: 'lost' | 'vacated' | 'stripped'; reason: string; fightId?: string }
/** One continuous title reign of the player (one belt, from the win to the loss or vacating). */
export interface Reign {
  id: string; org: OrgId; div: DivisionId; start: number;
  wonIn: string | null; // history id of the fight that won it
  how: 'won' | 'superfight' | 'vacant' | 'admin' | 'unknown';
  defenses: string[]; // history ids of successful defenses
  draws?: string[]; // title fights drawn (belt retained)
  end?: ReignEnd;
}

export interface PlayerFighter {
  id: 'player';
  firstName: string;
  lastName: string;
  nickname: string;
  nationality: string;
  bornDay: number;
  heightCm: number;
  reachCm: number;
  hand: 'right' | 'left';
  stance: Stance;
  bodyType: BodyType;
  background: BackgroundId;
  appearance: Appearance;
  attrs: Attributes;
  talent: number; // learning multiplier ~0.85-1.2
  // condition
  fatigue: number; // 0..100 (training fatigue / soreness)
  sharpness: number; // 0..100 (fight readiness from recent hard work)
  wear: number; // career accumulated damage 0..100
  injuries: Injury[];
  medicalSuspensionUntil: number; // day
  // weight
  naturalKg: number; // walking-around set point
  weightKg: number; // current
  divisionId: DivisionId;
  diet: 'bulk' | 'maintain' | 'cut';
  // career
  record: FightRecord;
  amateurRecord: FightRecord;
  isPro: boolean;
  money: number;
  contract: Contract | null;
  orgId: OrgId;
  rankPoints: number;
  popularity: number; // 0..100
  reputation: number; // 0..100
  streak: number; // + win streak, - loss streak
  bestStreak: number;
  titles: { orgId: OrgId; divisionId: DivisionId; day: number }[];
  isChampion: boolean;
  titleDefenses: number;
  bestRank: number;
  earningsTotal: number;
  history: FightHistoryEntry[];
  gymId: string;
  coaches: Coach[];
  lifestyle: { housing: 0 | 1 | 2; nutrition: 0 | 1 | 2; physio: boolean; homeGym: boolean };
  attrHistory: { day: number; ovr: number }[];
  recentGains: Partial<Record<AttrKey, number>>; // since last fight, for UI
  trainingStreakDays: number;
  sessionsDone: number;
  fotn: number;
  potn: number;
  retired: boolean;
  walkout?: WalkoutStyle;
  reignStart?: number | null;
  // ── HFC superfights (v6)
  reignDefenses?: number; // consecutive successful defenses of the belt currently held (resets on new belt / loss)
  champStatus?: 0 | 1 | 2; // 1 = double champion, 2 = triple champion (permanent career status)
  superOrigin?: DivisionId | null; // division the multi-division run started from
  superNextAt?: number; // reignDefenses value at which the next superfight may be proposed (after a decline/loss)
  superBoosts?: { key: AttrKey; amt: number; day: number; level: 1 | 2 }[];
  pendingBeltChoice?: BeltChoice | null;
  reigns?: Reign[]; // v9: full title-reign records for the trophy case
}

/** After winning a superfight the champion holds two belts and must keep one (the other is vacated). */
export interface BeltChoice { home: DivisionId; won: DivisionId; level: 1 | 2; homeReignStart: number | null; day: number }

export interface WorldFighter {
  id: string;
  first: string;
  last: string;
  nick: string;
  nat: string;
  bornDay: number;
  h: number; // height cm
  r: number; // reach cm
  stance: Stance;
  style: StyleId;
  a: number[]; // packed attributes
  div: DivisionId;
  org: OrgId;
  rec: FightRecord;
  pts: number; // ranking points
  pop: number;
  injuredUntil: number;
  bookedUntil: number;
  lastFight: number;
  recent: ('W' | 'L' | 'D')[];
  retired: boolean;
  vsPlayer: { day: number; result: 'W' | 'L' | 'D'; method: Method; close: boolean }[];
  adapt?: Record<string, number>; // remembered tendencies from previous fights vs player
  peak: number; // potential overall
  am?: boolean; // amateur-pool fighter (not ranked)
  // ── v4 career tracking (all optional for old saves)
  log?: CareerLogEntry[]; // last results (newest first, capped)
  ttl?: number; // title fight wins that won a belt
  dfn?: number; // successful title defenses
  rgn?: number | null; // day current reign began
  stk?: number; // current win streak
  mstk?: number; // best win streak
  deb?: number; // debut day in the simulation (first recorded bout)
  pk?: number; // peak overall
  pkd?: number; // day of peak
  rd?: number; // retirement day
}

/** Compact per-fighter career log entry. */
/** Compact per-fighter career log entry: [day, opponent name, opponent id, result, method, round, org, title?] */
export type CareerLogEntry = [number, string, string, 'W' | 'L' | 'D', Method, number, OrgId, 1?];

/** One bout anywhere in the world (player bouts included, player id = 'player'). */
export interface BoutRecord {
  id: string; day: number; org: OrgId; div: DivisionId;
  a: string; b: string; an: string; bn: string;
  w: 0 | 1 | -1; m: Method; r: number;
  t?: 1; v?: 1; ev?: string; up?: number; ao?: number; bo?: number;
}

export interface NewsItem {
  id: string; day: number;
  kind: 'title' | 'defense' | 'upset' | 'retire' | 'prospect' | 'streak' | 'signing' | 'injury' | 'event' | 'record' | 'player' | 'result';
  title: string; body: string;
  refs: string[]; // fighter ids mentioned
  org?: OrgId; div?: DivisionId;
  imp: 1 | 2 | 3; // 3 = headline
}

export interface RecordEntry { id: string; name: string; value: number; day: number; detail: string }
export interface RecordsBook {
  mostWins?: RecordEntry; mostFinishes?: RecordEntry; mostDefenses?: RecordEntry; longestReign?: RecordEntry;
  longestStreak?: RecordEntry; biggestUpset?: RecordEntry; oldestChamp?: RecordEntry; youngestChamp?: RecordEntry; mostTitleWins?: RecordEntry;
}

export interface HallEntry {
  id: string; name: string; nat: string; div: DivisionId; org: OrgId; rec: string; titles: number; defenses: number;
  finishes: number; bestStreak: number; retiredDay: number; legacy: number; isPlayer?: boolean;
}

export interface TimelineEntry { day: number; kind: 'start' | 'pro' | 'contract' | 'fight' | 'title' | 'injury' | 'division' | 'rival' | 'achievement' | 'retire' | 'record' | 'milestone'; text: string; ref?: string }

export interface CardBout {
  id: string; a: string; b: string; div: DivisionId; title: boolean; vacant?: boolean;
  slot: 'prelim' | 'main' | 'comain' | 'mainevent'; order: number; player?: boolean;
  result?: { w: 0 | 1 | -1; m: Method; r: number; note?: string };
}

export interface WalkoutStyle { track: string; color: number; entrance: 'calm' | 'hype' | 'stare' }

export interface OrgState {
  id: OrgId;
  champions: Partial<Record<DivisionId, string | null>>; // fighter id or 'player'
  nextEventDay: number;
  eventNo: number;
  titleHistory: { day: number; div: DivisionId; champ: string; name: string }[];
}

export interface World {
  fighters: Record<string, WorldFighter>;
  orgs: Record<OrgId, OrgState>;
  lastSimDay: number;
  history: BoutRecord[]; // recent bouts (capped)
  news: NewsItem[]; // world news feed (capped)
  records: RecordsBook;
  hall: HallEntry[];
}

export interface FightOffer {
  id: string;
  orgId: OrgId;
  opponentId: string;
  eventName: string;
  day: number; // fight day
  rounds: 3 | 5;
  purse: number;
  winBonus: number;
  title: boolean;
  shortNotice: boolean;
  expiresDay: number;
  amateur: boolean;
  rivalry: boolean;
  note?: string;
  div?: DivisionId; // division the bout is contested in (defaults to the player's division)
  superfight?: boolean; // HFC champion-vs-champion bout in another division
}

export interface ScheduledFight extends FightOffer {
  card?: CardBout[];
  acceptedDay: number;
  campFocus: CampFocus;
  prep: number; // opponent-specific preparation 0..100
  gamePlan: GamePlanId;
  mediaDone: boolean;
  weighIn?: { madeWeight: boolean; weightKg: number; limitKg: number; cutPct: number };
}

export type CampFocus = 'general' | 'opponent' | 'wrestling_def' | 'southpaw' | 'striking_def' | 'cardio' | 'weight';

export interface ContractOffer {
  id: string;
  orgId: OrgId;
  fights: number;
  purse: number;
  winBonus: number;
  signingBonus: number;
  exclusive: boolean;
  champClause: boolean;
  patience: number; // negotiation rounds left
  expiresDay: number;
  note: string;
  lastResponse?: string;
}

export interface SponsorDeal {
  id: string;
  sponsorId: string;
  monthly: number;
  winBonus: number;
  finishBonus: number;
  monthsLeft: number;
  dropOnLosses: number; // ends after N straight losses (0 = never)
}

export interface LedgerEntry {
  day: number;
  amount: number;
  label: string;
  cat: 'purse' | 'bonus' | 'sponsor' | 'gym' | 'coach' | 'medical' | 'living' | 'lifestyle' | 'equipment' | 'other' | 'training';
}

export interface InboxMessage {
  id: string;
  day: number;
  title: string;
  body: string;
  kind: 'news' | 'offer' | 'injury' | 'finance' | 'event' | 'training' | 'result' | 'world';
  read: boolean;
}

export interface PendingEvent {
  id: string;
  templateId: string;
  day: number;
  params: Record<string, any>;
}

export type DaySlot = string | null; // session id or null (rest)
export interface WeekPlan {
  days: [DaySlot, DaySlot][]; // 7 days (Mon..Sun), AM/PM
}

export interface DayLog {
  day: number;
  lines: string[];
  gains: Partial<Record<AttrKey, number>>;
}

export interface Settings {
  master: number;
  sfx: number;
  crowd: number;
  muted: boolean;
  roundSeconds: number; // real seconds per round
  reducedMotion: boolean;
  hints: boolean;
  bindings: Record<string, string>;
  presentation?: 'full' | 'short' | 'off';
  commentary?: boolean;
  announcerVoice?: boolean;
  uiScale?: number;
  music?: number;
}

export interface GameState {
  version: number;
  slot: number;
  rng: number;
  createdAt: number;
  savedAt: number;
  day: number;
  difficulty: Difficulty;
  goals: GoalId[];
  player: PlayerFighter;
  world: World;
  plan: WeekPlan;
  offers: FightOffer[];
  contractOffers: ContractOffer[];
  scheduled: ScheduledFight | null;
  sponsors: SponsorDeal[];
  sponsorOffers: { id: string; sponsorId: string; monthly: number; winBonus: number; finishBonus: number; months: number; dropOnLosses: number; expiresDay: number }[];
  ledger: LedgerEntry[];
  inbox: InboxMessage[];
  pending: PendingEvent[];
  eventCooldowns: Record<string, number>;
  rivalries: Record<string, number>;
  achievements: { id: string; day: number }[];
  promoterRelation: number; // -50..50
  declinedOffers: number;
  lastOfferDay: number;
  dayLogs: DayLog[];
  lastResultId: string | null;
  lastResult: FightResultSummary | null;
  tutorialStep: number; // -1 = done/disabled
  practiceDone: boolean;
  seenHelp: Record<string, boolean>;
  fightInProgress: { offerId: string; round: number; snapshot?: string } | null;
  timeline: TimelineEntry[];
  lastReplay: string | null; // compressed deterministic replay of the latest fight
  callout: string | null; // fighter the player called out (weights matchmaking)
  titlePush: boolean; // player publicly demanded a title shot
  restWaivedFor?: string; // admin: id of the fight whose rest period was waived
  adminUsed?: boolean; // admin/dev tools changed this career (shown as 'Modified career')
  sponsorBuzz: number;
}

export interface FightResultSummary {
  timeline?: { tick: number; round: number; clock: string; text: string; kind: string; side: number }[];
  rounds?: { p: Record<string, number>; o: Record<string, number> }[];
  trends?: { t: number; ps: number; os: number; ph: number; oh: number }[];
  interview?: string;
  announce?: string[];
  cardResults?: CardBout[];
  superfight?: boolean;
  fightDiv?: DivisionId;
  commentary?: string[];
  id: string;
  day: number;
  playerWon: boolean;
  draw: boolean;
  method: Method;
  round: number;
  time: string;
  opponentId: string;
  opponentName: string;
  scorecards: [number, number][]; // per judge [player, opp]
  roundScores: { judge: number; round: number; p: number; o: number }[];
  stats: { player: FightStatsTotals; opp: FightStatsTotals };
  purse: number;
  winBonus: number;
  bonuses: { label: string; amount: number }[];
  fines: { label: string; amount: number }[];
  totalEarned: number;
  rankBefore: number | null;
  rankAfter: number | null;
  popularityDelta: number;
  reputationDelta: number;
  injuries: string[];
  xpGains: Partial<Record<AttrKey, number>>;
  feedback: { good: string[]; bad: string[]; tips: string[] };
  title: boolean;
  wonTitle: boolean;
  lostTitle: boolean;
  amateur: boolean;
  recordAfter: string;
  eventName: string;
  orgId: OrgId;
}

export interface FightStatsTotals {
  sigLanded: number;
  sigThrown: number;
  headLanded: number;
  bodyLanded: number;
  legLanded: number;
  knockdowns: number;
  tdLanded: number;
  tdAttempts: number;
  subAttempts: number;
  controlSec: number;
  damageDealt: number;
  reversals: number;
}
