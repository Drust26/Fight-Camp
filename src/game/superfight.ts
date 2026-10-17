// HFC superfights: champion-vs-champion bouts in a neighbouring division, double and triple champion status.
//
// Rules (Hexagon Fighting Championship only):
// • 4 consecutive defenses of your belt → the HFC proposes a superfight one division UP for that division's title
//   (a heavyweight champion is offered the light heavyweight title instead — the only way down).
// • Lose: you go back to your own division, still champion. Win: you are double champion, hold both belts and must
//   choose which one to keep defending (the other is vacated). Double champion status grants a small permanent boost.
// • Triple champion: after keeping the NEW (heavier) belt and defending it 6 times in a row, the HFC proposes the next
//   division up. Same process, bigger boost.
// • Fighters whose run started at heavyweight can only become double champion. Fighters whose run started at light
//   heavyweight become triple champion only by keeping the light heavyweight belt (not moving up to heavyweight) and
//   later winning the middleweight title, again after 6 defenses. A middleweight who moved up to light heavyweight is
//   NOT bound by this: he goes on up to heavyweight.
import { clamp } from './rng';
import { addNews, addTimeline } from './history';
import { endReign, VACATE } from './reigns';
import { inbox } from './core';
import { rankings } from './world';
import { fighterName } from './fighterGen';
import { DIV, DIVISIONS, ORG } from '../data/world';
import type { AttrKey } from './attributes';
import type { DivisionId, GameState, OrgId } from './types';

export const SUPER_ORG: OrgId = 'acl';
export const DOUBLE_AFTER = 4;
export const TRIPLE_AFTER = 6;
export const BOOST = { 1: 2, 2: 5 } as const; // attribute points granted by double / triple status

const order = DIVISIONS.map((d) => d.id);
const up = (d: DivisionId): DivisionId | null => order[order.indexOf(d) + 1] ?? null;
const down = (d: DivisionId): DivisionId | null => order[order.indexOf(d) - 1] ?? null;

export function statusName(level: number | undefined) {
  return level === 2 ? 'Triple Champion' : level === 1 ? 'Double Champion' : '';
}

/** Which division the next superfight would be in for this champion's current situation (ignores timing). */
export function superfightDivision(st: GameState): { div: DivisionId; level: 1 | 2 } | null {
  const p = st.player;
  if (!p.isPro || p.retired || p.orgId !== SUPER_ORG || p.pendingBeltChoice) return null;
  if (st.world.orgs[SUPER_ORG].champions[p.divisionId] !== 'player') return null;
  const L = p.champStatus ?? 0;
  const cur = p.divisionId;
  if (L === 0) {
    const t = cur === 'heavy' ? down(cur) : up(cur);
    return t ? { div: t, level: 1 } : null;
  }
  if (L === 1) {
    const origin = p.superOrigin ?? cur;
    if (origin === 'heavy') return null; // heavyweights top out at double champion
    if (origin === 'lhw') return cur === 'lhw' ? { div: 'middle', level: 2 } : null; // kept LHW → may go down to MW
    if (cur !== up(origin)) return null; // must have moved up and kept the new belt
    const t = up(cur);
    return t ? { div: t, level: 2 } : null;
  }
  return null;
}

/** Defenses still needed before the next proposal (0 = eligible now), or null when no path exists. */
export function defensesUntilSuperfight(st: GameState): number | null {
  const target = superfightDivision(st);
  if (!target) return null;
  const p = st.player;
  const need = Math.max(target.level === 1 ? DOUBLE_AFTER : TRIPLE_AFTER, p.superNextAt ?? 0);
  return Math.max(0, need - (p.reignDefenses ?? 0));
}

/** The opponent for a superfight: always the champion of the target division (an injured or busy champion simply
 *  means a later fight date — see superfightDate); only a vacant belt falls back to the top contender. */
export function superfightOpponent(st: GameState, div: DivisionId): string | null {
  const champ = st.world.orgs[SUPER_ORG].champions[div];
  if (champ && champ !== 'player' && st.world.fighters[champ] && !st.world.fighters[champ].retired) return champ;
  const live = (id: string) => { const f = st.world.fighters[id]; return !!f && !f.retired; };
  const rows = rankings(st, SUPER_ORG, div).filter((r) => !r.isPlayer && !r.champion && live(r.id));
  const free = rows.find((r) => st.world.fighters[r.id].injuredUntil <= st.day && st.world.fighters[r.id].bookedUntil <= st.day);
  return (free ?? rows[0])?.id ?? null;
}

/** A fight date that works for both fighters (after any injury or booking the opponent already has). */
export function superfightDate(st: GameState, oppId: string, base: number): number {
  const f = st.world.fighters[oppId];
  return Math.max(base, f.injuredUntil + 14, f.bookedUntil + 21, st.player.medicalSuspensionUntil + 7);
}

/** Message shown when the offer is made. */
export function superfightPitch(st: GameState, div: DivisionId, level: 1 | 2, oppId: string) {
  const champ = st.world.orgs[SUPER_ORG].champions[div] === oppId;
  const dir = order.indexOf(div) > order.indexOf(st.player.divisionId) ? 'up' : 'down';
  return `${ORG[SUPER_ORG].short} SUPERFIGHT: move ${dir} to ${DIV[div].name} and face ${champ ? 'champion ' : ''}${fighterName(st.world.fighters[oppId])} for the ${champ ? '' : 'vacant '}${DIV[div].name} title. Win and you become a ${statusName(level).toLowerCase()}; lose and you return to ${DIV[st.player.divisionId].name} with your belt.`;
}

/** Called from applyFightResult when the player wins a superfight. Both belts are held until the choice is made. */
export function onSuperfightWin(st: GameState, div: DivisionId, homeReignStart: number | null) {
  const p = st.player;
  const level = (Math.min(2, (p.champStatus ?? 0) + 1)) as 1 | 2;
  p.pendingBeltChoice = { home: p.divisionId, won: div, level, homeReignStart, day: st.day };
  if (level === 1) p.superOrigin = p.divisionId;
  p.champStatus = level;
  p.superNextAt = undefined;
  const name = `${p.firstName} ${p.lastName}`;
  addNews(st, { kind: 'title', title: `${name} becomes ${ORG[SUPER_ORG].short} ${statusName(level).toLowerCase()}`, body: `The ${DIV[p.divisionId].name} champion moved to ${DIV[div].name} and took that belt too.`, refs: ['player'], org: SUPER_ORG, div, imp: 3 });
  addTimeline(st, 'title', `Became ${ORG[SUPER_ORG].short} ${statusName(level)} by winning the ${DIV[div].name} title.`);
  inbox(st, 'news', `${statusName(level).toUpperCase()}!`, `You hold the ${DIV[p.divisionId].name} and ${DIV[div].name} belts. Choose which one to defend from now on — the other will be vacated.`);
}

/** After the player turns a superfight down (or loses it), wait for two more defenses before offering again.
 *  An offer that simply expires, or is replaced by booking a regular defense, is offered again straight away. */
export function markOffered(st: GameState) {
  st.player.superNextAt = (st.player.reignDefenses ?? 0) + 2;
}

export function chooseBelt(st: GameState, keep: DivisionId, boost: AttrKey): string | null {
  const p = st.player;
  const pc = p.pendingBeltChoice;
  if (!pc) return 'There is no belt decision to make.';
  if (keep !== pc.home && keep !== pc.won) return 'Pick one of your two belts.';
  if (!(boost in p.attrs)) return 'Pick an attribute for your boost.';
  const os = st.world.orgs[SUPER_ORG];
  const drop = keep === pc.home ? pc.won : pc.home;
  if (os.champions[drop] === 'player') os.champions[drop] = null;
  endReign(st, SUPER_ORG, drop, VACATE.keptOther(keep));
  os.champions[keep] = 'player';
  const name = `${p.firstName} ${p.lastName}`;
  addNews(st, { kind: 'title', title: `${ORG[SUPER_ORG].short} ${DIV[drop].name} title vacated`, body: `${name} keeps the ${DIV[keep].name} belt and gives up the ${DIV[drop].name} title.`, refs: ['player'], org: SUPER_ORG, div: drop, imp: 2 });
  if (keep !== p.divisionId) {
    p.divisionId = keep;
    st.offers = [];
    addTimeline(st, 'division', `Moved to ${DIV[keep].name} to defend the ${ORG[SUPER_ORG].short} ${DIV[keep].name} title.`);
    p.reignStart = st.day;
  } else {
    p.reignStart = pc.homeReignStart ?? p.reignStart ?? st.day;
  }
  p.isChampion = true;
  p.reignDefenses = 0;
  p.superNextAt = undefined;
  const amt = BOOST[pc.level];
  p.attrs[boost] = clamp(p.attrs[boost] + amt, 1, 99);
  (p.superBoosts ??= []).push({ key: boost, amt, day: st.day, level: pc.level });
  p.popularity = clamp(p.popularity + (pc.level === 2 ? 10 : 5), 0, 100);
  p.reputation = clamp(p.reputation + (pc.level === 2 ? 10 : 5), 0, 100);
  addTimeline(st, 'milestone', `Chose to defend the ${DIV[keep].name} belt; vacated ${DIV[drop].name}. ${statusName(pc.level)} bonus: +${amt} ${boost}.`);
  p.pendingBeltChoice = null;
  return null;
}

/** Plain-language status line for the UI. */
export function superfightProgress(st: GameState): string | null {
  const p = st.player;
  if (p.orgId !== SUPER_ORG || !p.isPro) return null;
  if (p.pendingBeltChoice) return 'Choose which belt to keep.';
  const t = superfightDivision(st);
  const left = defensesUntilSuperfight(st);
  if (!t || left === null) return (p.champStatus ?? 0) > 0 ? `${statusName(p.champStatus)} — no further superfight path from here.` : null;
  return left === 0
    ? `Superfight eligible: the HFC can offer you the ${DIV[t.div].name} title (${statusName(t.level).toLowerCase()} bid).`
    : `${left} more consecutive defense${left === 1 ? '' : 's'} until a ${DIV[t.div].name} superfight (${statusName(t.level).toLowerCase()} bid).`;
}

export const SUPERFIGHT_RULES = [
  `HFC only. After ${DOUBLE_AFTER} consecutive defenses the HFC offers a superfight one division up (heavyweights go down to light heavyweight).`,
  'Lose: you return to your division, still champion. Win: you hold both belts, choose one to keep, and the other is vacated.',
  `Double champion: +${BOOST[1]} to an attribute of your choice. Triple champion: +${BOOST[2]}.`,
  `Triple: keep the new heavier belt and defend it ${TRIPLE_AFTER} times in a row to be offered the next division up.`,
  'Started at heavyweight: double champion only. Started at light heavyweight: keep the LHW belt, then go down to middleweight after 6 defenses.',
];


/** For the belt choice screen: does keeping this belt leave a path to a triple-champion superfight? */
export function tripleHint(pc: { home: DivisionId; won: DivisionId; level: 1 | 2 }, keep: DivisionId): string {
  if (pc.level === 2) return 'You are already a triple champion — the highest status.';
  const origin = pc.home;
  if (origin === 'heavy') return 'Heavyweights can only become double champion.';
  if (origin === 'lhw') return keep === 'lhw' ? `Keeps the triple-champion path open: ${TRIPLE_AFTER} straight defenses → Middleweight superfight.` : 'Moving up to heavyweight ends the triple-champion path.';
  if (keep === pc.won) { const t = up(pc.won); return t ? `Keeps the triple-champion path open: ${TRIPLE_AFTER} straight defenses → ${DIV[t].name} superfight.` : 'No division above this one.'; }
  return 'Staying in your original division ends the triple-champion path.';
}
