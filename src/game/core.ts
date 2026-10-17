// Shared career helpers: calendar, inbox, ledger, money, ages.
import { RNG } from './rng';
import type { GameState, InboxMessage, LedgerEntry } from './types';
import { GYM, LIFESTYLE } from '../data/training';
import { DIV, LB } from '../data/world';

export const SAVE_VERSION = 10;
const START = Date.UTC(2027, 0, 4); // a Monday
export const dateOf = (day: number) => new Date(START + day * 86400000);
export const weekday = (day: number) => ((day % 7) + 7) % 7; // 0 = Monday
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function fmtDate(day: number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return dateOf(day).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}
export const ageOf = (bornDay: number, day: number) => (day - bornDay) / 365;
export const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
export const kgToLb = (kg: number) => kg / LB;

/** Run fn with the save's RNG and write the advanced state back (keeps runs reproducible). */
export function withRng<T>(st: GameState, fn: (rng: RNG) => T): T {
  const rng = new RNG(st.rng);
  const out = fn(rng);
  st.rng = rng.state;
  return out;
}

let msgCounter = 0;
export function inbox(st: GameState, kind: InboxMessage['kind'], title: string, body: string) {
  st.inbox.unshift({ id: `m${st.day}_${msgCounter++}_${st.inbox.length}`, day: st.day, title, body, kind, read: false });
  if (st.inbox.length > 120) st.inbox.length = 120;
}

export function ledger(st: GameState, amount: number, label: string, cat: LedgerEntry['cat']) {
  if (!amount) return;
  st.player.money += amount;
  st.ledger.unshift({ day: st.day, amount, label, cat });
  if (st.ledger.length > 300) st.ledger.length = 300;
  if (amount > 0 && (cat === 'purse' || cat === 'bonus' || cat === 'sponsor')) st.player.earningsTotal += amount;
}

/** Recurring monthly costs, itemised. */
export function monthlyExpenses(st: GameState): { label: string; amount: number; cat: LedgerEntry['cat'] }[] {
  const p = st.player;
  const gym = GYM[p.gymId];
  const items: { label: string; amount: number; cat: LedgerEntry['cat'] }[] = [
    { label: `Housing: ${LIFESTYLE.housing[p.lifestyle.housing].name}`, amount: LIFESTYLE.housing[p.lifestyle.housing].cost, cat: 'living' },
    { label: `Food: ${LIFESTYLE.nutrition[p.lifestyle.nutrition].name}`, amount: LIFESTYLE.nutrition[p.lifestyle.nutrition].cost, cat: 'living' },
    { label: `Gym: ${gym.name}`, amount: gym.fee, cat: 'gym' },
  ];
  for (const c of p.coaches) items.push({ label: `Coach: ${c.name}`, amount: c.fee, cat: 'coach' });
  if (p.lifestyle.physio) items.push({ label: LIFESTYLE.physio.name, amount: LIFESTYLE.physio.cost, cat: 'medical' });
  const mult = st.difficulty === 'easy' ? 0.8 : st.difficulty === 'hard' ? 1.1 : st.difficulty === 'simulation' ? 1.2 : 1;
  return items.map((i) => ({ ...i, amount: Math.round(i.amount * mult) }));
}
export const monthlyTotal = (st: GameState) => monthlyExpenses(st).reduce((s, i) => s + i.amount, 0);

export const divLimitKg = (st: GameState) => DIV[st.player.divisionId].kg;

export function gymCoachBonus(st: GameState, spec: string | null): number {
  if (!spec) return 0;
  const c = st.player.coaches.find((x) => x.specialty === spec);
  return c ? c.quality : 0;
}
