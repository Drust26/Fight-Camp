// Fight posters: the data a poster needs, for upcoming bookings and for past fights.
// Design tier follows the importance of the bout: local show → card bout → headliner → title fight → superfight.
import { t } from '../i18n';
import { DIV, ORG } from '../data/world';
import { eventKind } from './eventcard';
import { nameOf } from './history';
import { recStr, wfAppearance } from './fighterGen';
import { resolveLook, type Look } from './look';
import { fmtDate } from './core';
import { fightDivision } from './reigns';
import type { DivisionId, FightHistoryEntry, GameState, OrgId, PosterMeta, ScheduledFight } from './types';

export type PosterTier = 'local' | 'card' | 'headliner' | 'title' | 'superfight';

export interface PosterSide { first: string; last: string; nick: string; rec: string; nat: string; look: Look; champion: boolean; heightCm?: number }
export interface PosterData {
  id: string; tier: PosterTier;
  eventName: string; org: OrgId; orgName: string; orgShort: string; orgColor: string;
  date: string; venue: string; div: DivisionId; divName: string; lbs: number; rounds: number;
  slotLabel: string; titleLine: string | null; homeDiv?: DivisionId; vacant?: boolean;
  tagline: string; red: PosterSide; blue: PosterSide; undercard: string[];
  result?: { text: string; won: boolean | null };
  invader?: DivisionId; // blue corner is the champion of this division, challenging for red's belt
}

const VENUE: Record<string, string> = { amateur: 'Community hall', regional: 'Regional venue', standard: 'Arena', major: 'Major arena', title: 'Championship night' };
const SLOT_LABEL: Record<string, string> = { mainevent: 'MAIN EVENT', comain: 'CO-MAIN EVENT', main: 'MAIN CARD', prelim: 'PRELIMINARY CARD' };

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
function pick<T>(seed: string, arr: T[]): T { return arr[hash(seed) % arr.length]; }

export function posterTier(m: { amateur: boolean; org: OrgId; title: boolean; superfight?: boolean; slot?: string; rivalry?: boolean; rematch?: number }): PosterTier {
  if (m.superfight) return 'superfight';
  if (m.title) return 'title';
  if (m.amateur || ORG[m.org].tier <= 1 && m.slot !== 'mainevent') return 'local';
  if (m.slot === 'mainevent' || m.slot === 'comain' || ((m.rivalry || (m.rematch ?? 0) > 0) && ORG[m.org].tier >= 2)) return 'headliner';
  return 'card';
}

function tagline(id: string, tier: PosterTier, m: { rematch?: number; rivalry?: boolean; vacant?: boolean }, divName: string): string {
  return t(taglineEn(id, tier, m, divName), { div: t(divName).toUpperCase() });
}
function taglineEn(id: string, tier: PosterTier, m: { rematch?: number; rivalry?: boolean; vacant?: boolean }, divName: string): string {
  if (tier === 'superfight') return pick(id, ['CHAMPION VS CHAMPION', 'TWO KINGS. ONE CAGE.', 'GREATNESS HAS NO WEIGHT LIMIT']);
  if ((m.rematch ?? 0) >= 2) return 'THE TRILOGY';
  if ((m.rematch ?? 0) === 1) return pick(id, ['THE REMATCH', 'UNFINISHED BUSINESS', 'NO MORE DOUBTS']);
  if (m.rivalry) return pick(id, ['BAD BLOOD', 'SETTLE THE SCORE', 'NOTHING TO LOSE']);
  if (tier === 'title') return m.vacant ? pick(id, ['A NEW KING WILL BE CROWNED', 'THE THRONE IS EMPTY']) : pick(id, ['HEAVY IS THE HEAD', 'THE CROWN IS ON THE LINE', 'ONE BELT. NO EXCUSES.', '{div} SUPREMACY']);
  if (tier === 'headliner') return pick(id, ['COLLISION COURSE', 'NO WAY BACK', 'STAND AND DELIVER', 'ALL OR NOTHING']);
  if (tier === 'local') return pick(id, ['LIVE · LOCAL · LOUD', 'FIGHT NIGHT', 'HOMETOWN WAR', 'TICKETS AT THE DOOR']);
  return pick(id, ['FIGHT NIGHT', 'THE CLIMB CONTINUES', 'ONE STEP CLOSER']);
}

/** Snapshot stored on the history entry when the fight happens. */
export function posterMetaFor(st: GameState, sc: ScheduledFight): PosterMeta {
  const p = st.player;
  const opp = st.world.fighters[sc.opponentId];
  const fdiv = sc.div ?? p.divisionId;
  const champ = sc.title && !sc.amateur ? st.world.orgs[sc.orgId].champions[fdiv] : null;
  const card = [...(sc.card ?? [])].sort((a, b) => b.order - a.order);
  return {
    slot: card.find((c) => c.player)?.slot,
    kind: eventKind(sc),
    superfight: sc.superfight, homeDiv: sc.superfight ? p.divisionId : undefined,
    vacant: sc.title && !champ, rounds: sc.rounds,
    champion: champ === 'player' ? 'player' : champ === sc.opponentId ? 'opponent' : null,
    myRec: recStr(sc.amateur ? p.amateurRecord : p.record), oppRec: opp ? recStr(opp.rec) : '', oppNick: opp?.nick ?? '', oppNat: opp?.nat ?? '', oppHeight: opp?.h,
    undercard: card.filter((c) => !c.player).slice(0, 4).map((c) => `${nameOf(st, c.a).split(' ').slice(-1)[0]} vs ${nameOf(st, c.b).split(' ').slice(-1)[0]}`),
    rematch: opp?.vsPlayer.length ?? 0, rivalry: (st.rivalries[sc.opponentId] ?? 0) >= 30,
    ...(sc.invader ? { invader: sc.invader } : {}),
  };
}

function playerSide(st: GameState, rec: string, champion: boolean): PosterSide {
  const p = st.player;
  return { first: p.firstName, last: p.lastName, nick: p.nickname, rec, nat: p.nationality, look: resolveLook(p.appearance as any, { bodyType: p.bodyType }), champion, heightCm: p.heightCm };
}

function oppSide(st: GameState, id: string, name: string, rec: string, nick: string, nat: string, champion: boolean, div?: string, h?: number): PosterSide {
  const f = st.world.fighters[id];
  const parts = (f ? `${f.first} ${f.last}` : name).split(' ');
  const ap = wfAppearance({ id, div: f?.div ?? div, h: f?.h ?? h });
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1], nick: f?.nick ?? nick, rec, nat: f?.nat ?? nat, look: resolveLook(ap as any, { id }), champion, heightCm: f?.h ?? h };
}

function titleLine(org: OrgId, div: DivisionId, vacant?: boolean, superfight?: boolean) {
  void superfight;
  const key = ORG[org].tier >= 4 ? (vacant ? 'FOR THE VACANT {org} {div} WORLD CHAMPIONSHIP' : 'FOR THE {org} {div} WORLD CHAMPIONSHIP') : (vacant ? 'FOR THE VACANT {org} {div} CHAMPIONSHIP' : 'FOR THE {org} {div} CHAMPIONSHIP');
  return t(key, { org: ORG[org].short, div: t(DIV[div].name).toUpperCase() });
}

/** Poster for the booked (upcoming) fight. */
export function posterForScheduled(st: GameState, sc: ScheduledFight): PosterData {
  const p = st.player;
  const m = posterMetaFor(st, sc);
  const opp = st.world.fighters[sc.opponentId];
  const div = sc.div ?? p.divisionId;
  const tier = posterTier({ amateur: sc.amateur, org: sc.orgId, title: sc.title, superfight: sc.superfight || !!sc.invader, slot: m.slot, rivalry: m.rivalry, rematch: m.rematch });
  const homeChamp = !!sc.superfight || m.champion === 'player';
  return {
    id: sc.id, tier, eventName: sc.eventName, org: sc.orgId, orgName: sc.amateur ? 'Amateur Showcase' : ORG[sc.orgId].name, orgShort: sc.amateur ? 'AM' : ORG[sc.orgId].short, orgColor: ORG[sc.orgId].color,
    date: fmtDate(sc.day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), venue: t(VENUE[eventKind(sc)]),
    div, divName: t(DIV[div].name), lbs: DIV[div].lb, rounds: sc.rounds, slotLabel: t(SLOT_LABEL[m.slot ?? 'prelim']),
    titleLine: sc.title ? titleLine(sc.orgId, div, m.vacant, sc.superfight) : null, homeDiv: m.homeDiv, vacant: m.vacant,
    tagline: tagline(sc.id, tier, m, DIV[div].name),
    red: playerSide(st, m.myRec ?? '', homeChamp), blue: oppSide(st, sc.opponentId, opp ? `${opp.first} ${opp.last}` : 'Opponent', opp ? recStr(opp.rec) : '', m.oppNick ?? '', m.oppNat ?? '', m.champion === 'opponent' || !!sc.invader),
    undercard: m.undercard ?? [],
    invader: sc.invader,
  };
}

/** Poster for a fight in the player's history (redrawn from the stored snapshot; older fights are inferred). */
export function posterForHistory(st: GameState, h: FightHistoryEntry): PosterData {
  const p = st.player;
  const div = fightDivision(st, h);
  // older fights have no snapshot: champion side and superfights come from the reign records
  const reign = h.title ? (p.reigns ?? []).find((r) => r.wonIn === h.id || r.defenses.includes(h.id) || r.draws?.includes(h.id) || r.end?.fightId === h.id) : undefined;
  // who held the belt going in, from the promotion's title history
  const prevChamp = h.title && !h.amateur ? [...(st.world.orgs[h.orgId]?.titleHistory ?? [])].filter((t) => t.div === div && t.day < h.day).pop()?.champ : undefined;
  const inferred: PosterMeta = reign ? {
    champion: prevChamp === 'player' ? 'player' : prevChamp === h.opponentId ? 'opponent' : reign.wonIn === h.id ? null : 'player',
    superfight: reign.wonIn === h.id && reign.how === 'superfight',
    homeDiv: reign.wonIn === h.id && reign.how === 'superfight' ? (p.reigns ?? []).find((r) => r.org === reign.org && r.div !== reign.div && r.start <= reign.start && (!r.end || r.end.day >= reign.start))?.div : undefined,
  } : h.title ? { champion: prevChamp === 'player' ? 'player' : prevChamp === h.opponentId ? 'opponent' : null } : {};
  const m: PosterMeta = h.poster ?? inferred;
  // record going into the fight, from the history itself (older entries have no snapshot)
  const before = [...p.history].filter((x) => x.amateur === h.amateur && x.day < h.day);
  const w = before.filter((x) => x.result === 'W').length, l = before.filter((x) => x.result === 'L').length, d = before.filter((x) => x.result === 'D').length;
  const myRec = m.myRec ?? `${w}-${l}${d ? '-' + d : ''}`;
  const tier = posterTier({ amateur: h.amateur, org: h.orgId, title: h.title, superfight: m.superfight || !!m.invader, slot: m.slot ?? (h.title ? 'mainevent' : undefined), rivalry: m.rivalry, rematch: m.rematch });
  const venue = t(VENUE[m.kind ?? eventKind({ amateur: h.amateur, orgId: h.orgId, title: h.title })]);
  const won = h.result === 'W' ? true : h.result === 'L' ? false : null;
  return {
    id: h.id, tier, eventName: h.event, org: h.orgId, orgName: h.amateur ? 'Amateur Showcase' : ORG[h.orgId].name, orgShort: h.amateur ? 'AM' : ORG[h.orgId].short, orgColor: ORG[h.orgId].color,
    date: fmtDate(h.day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), venue,
    div, divName: t(DIV[div].name), lbs: DIV[div].lb, rounds: m.rounds ?? (h.title ? 5 : 3), slotLabel: t(SLOT_LABEL[m.slot ?? (h.title ? 'mainevent' : 'prelim')]),
    titleLine: h.title ? titleLine(h.orgId, div, m.vacant, m.superfight) : null, homeDiv: m.homeDiv, vacant: m.vacant,
    tagline: tagline(h.id, tier, m, DIV[div].name),
    red: playerSide(st, myRec, !!m.superfight || m.champion === 'player'),
    blue: oppSide(st, h.opponentId, h.opponentName, m.oppRec ?? h.opponentRecord, m.oppNick ?? '', m.oppNat ?? '', m.champion === 'opponent' || !!m.invader, div, m.oppHeight),
    invader: m.invader,
    undercard: m.undercard ?? [],
    result: { text: `${t(h.result === 'W' ? 'WON' : h.result === 'L' ? 'LOST' : 'DRAW')} · ${t(h.method)}${['UD', 'SD', 'MD', 'DRAW'].includes(h.method) ? '' : ` R${h.round} ${h.time}`}`, won },
  };
}
