// Shared, single path for recording bout results and everything derived from them:
// bout history, per-fighter career logs, streaks, title reigns, the records book, the world news feed,
// the Hall of Fame and the player's career timeline. Both AI-vs-AI bouts (world.ts) and the player's
// bouts (fights.ts) call recordBout(), so all views stay consistent with one source of truth.
import { overallRating, unpackAttrs } from './attributes';
import { DIV, ORG } from '../data/world';
import type {
  BoutRecord, CareerLogEntry, DivisionId, GameState, HallEntry, Method, NewsItem, OrgId, RecordEntry, RecordsBook, TimelineEntry, WorldFighter,
} from './types';

export const HISTORY_CAP = 700;
export const NEWS_CAP = 260;
export const LOG_CAP = 10;
const isFinish = (m: Method) => m === 'KO' || m === 'TKO' || m === 'SUB';
let seq = 0;
const nid = (st: GameState, p: string) => `${p}${st.day}_${(seq++).toString(36)}_${Math.floor(Math.random() * 1e5).toString(36)}`;

export function ensureHistory(st: GameState) {
  const w = st.world as any;
  w.history ??= [];
  w.news ??= [];
  w.records ??= {};
  w.hall ??= [];
  (st as any).timeline ??= [];
}

// ───────────────────────── names / ratings for either the player or a world fighter
export function nameOf(st: GameState, id: string): string {
  if (id === 'player') return `${st.player.firstName} ${st.player.lastName}`;
  const f = st.world.fighters[id];
  return f ? `${f.first} ${f.last}` : 'Unknown fighter';
}
export function ovrOf(st: GameState, id: string): number {
  if (id === 'player') return overallRating(st.player.attrs);
  const f = st.world.fighters[id];
  return f ? overallRating(unpackAttrs(f.a)) : 50;
}
export function ageOfId(st: GameState, id: string): number {
  const born = id === 'player' ? st.player.bornDay : st.world.fighters[id]?.bornDay ?? st.day - 30 * 365;
  return (st.day - born) / 365;
}

// ───────────────────────── news & timeline
export function addNews(st: GameState, n: Omit<NewsItem, 'id' | 'day'>) {
  ensureHistory(st);
  st.world.news.unshift({ id: nid(st, 'w'), day: st.day, ...n });
  if (st.world.news.length > NEWS_CAP) st.world.news.length = NEWS_CAP;
}

export function addTimeline(st: GameState, kind: TimelineEntry['kind'], text: string, ref?: string) {
  ensureHistory(st);
  const last = st.timeline[st.timeline.length - 1];
  if (last && last.day === st.day && last.text === text) return; // no duplicates
  st.timeline.push({ day: st.day, kind, text, ref });
  if (st.timeline.length > 400) st.timeline.splice(0, st.timeline.length - 400);
}

// ───────────────────────── records book
function better(cur: RecordEntry | undefined, value: number, lower = false) {
  if (!cur) return true;
  return lower ? value < cur.value : value > cur.value;
}
function setRecord(st: GameState, key: keyof RecordsBook, e: RecordEntry, lower = false) {
  const rb = st.world.records;
  const cur = rb[key];
  if (!better(cur, e.value, lower)) return;
  const beatsSomeone = !!cur && cur.id !== e.id;
  rb[key] = e;
  // announce only meaningful new records
  if (beatsSomeone && (key !== 'mostWins' || e.value >= 20)) {
    const labels: Record<string, string> = {
      mostWins: 'most career wins', mostFinishes: 'most finishes', mostDefenses: 'most title defenses', longestReign: 'longest title reign',
      longestStreak: 'longest win streak', biggestUpset: 'biggest upset', oldestChamp: 'oldest champion', youngestChamp: 'youngest champion', mostTitleWins: 'most title wins',
    };
    addNews(st, { kind: 'record', title: `New record: ${labels[key]}`, body: `${e.name} — ${e.detail}.`, refs: [e.id], imp: 2 });
    if (e.id === 'player') addTimeline(st, 'record', `Set the world record for ${labels[key]} (${e.detail}).`);
  }
}

// ───────────────────────── per-fighter tracking helpers
interface Tracked { stk: number; mstk: number; ttl: number; dfn: number; rgn: number | null; wins: number; finishes: number }
function tracked(st: GameState, id: string): Tracked {
  if (id === 'player') {
    const p = st.player;
    return { stk: Math.max(0, p.streak), mstk: p.bestStreak, ttl: p.titles.length, dfn: p.titleDefenses, rgn: (p as any).reignStart ?? null, wins: p.record.w, finishes: p.record.ko + p.record.tko + p.record.sub };
  }
  const f = st.world.fighters[id];
  return { stk: f?.stk ?? 0, mstk: f?.mstk ?? 0, ttl: f?.ttl ?? 0, dfn: f?.dfn ?? 0, rgn: f?.rgn ?? null, wins: f?.rec.w ?? 0, finishes: (f?.rec.ko ?? 0) + (f?.rec.tko ?? 0) + (f?.rec.sub ?? 0) };
}

function pushLog(f: WorldFighter, e: CareerLogEntry) {
  f.log = [e, ...(f.log ?? [])].slice(0, LOG_CAP);
}

export interface BoutInput {
  org: OrgId; div: DivisionId; a: string; b: string; winner: 0 | 1 | -1; method: Method; round: number;
  title: boolean; vacant?: boolean; event?: string;
  /** champion before the bout, used to detect title changes */
  champBefore?: string | null;
  /** ratings before the bout (for upset detection) */
  aOvr?: number; bOvr?: number;
}

/**
 * Record a completed bout. Callers have already applied records/points/champion changes;
 * this function derives history, logs, streaks, reigns, records, news and timeline entries.
 */
export function recordBout(st: GameState, b: BoutInput): BoutRecord {
  ensureHistory(st);
  const aOvr = b.aOvr ?? ovrOf(st, b.a), bOvr = b.bOvr ?? ovrOf(st, b.b);
  const rec: BoutRecord = {
    id: nid(st, 'b'), day: st.day, org: b.org, div: b.div, a: b.a, b: b.b, an: nameOf(st, b.a), bn: nameOf(st, b.b),
    w: b.winner, m: b.method, r: b.round, ao: aOvr, bo: bOvr,
  };
  if (b.title) rec.t = 1;
  if (b.vacant) rec.v = 1;
  if (b.event) rec.ev = b.event;
  const W = b.winner === 0 ? b.a : b.winner === 1 ? b.b : null;
  const L = b.winner === 0 ? b.b : b.winner === 1 ? b.a : null;
  const gap = W && L ? (W === b.a ? bOvr - aOvr : aOvr - bOvr) : 0;
  if (gap >= 6) rec.up = gap;
  st.world.history.unshift(rec);
  if (st.world.history.length > HISTORY_CAP) st.world.history.length = HISTORY_CAP;
  const tier = ORG[b.org].tier;
  const divName = DIV[b.div].name;

  // per-fighter logs, debut, peak, streaks
  for (const [me, opp, res] of [[b.a, b.b, b.winner === 0 ? 'W' : b.winner === 1 ? 'L' : 'D'], [b.b, b.a, b.winner === 1 ? 'W' : b.winner === 0 ? 'L' : 'D']] as const) {
    if (me === 'player') continue;
    const f = st.world.fighters[me];
    if (!f) continue;
    pushLog(f, b.title ? [st.day, nameOf(st, opp), opp, res as any, b.method, b.round, b.org, 1] : [st.day, nameOf(st, opp), opp, res as any, b.method, b.round, b.org]);
    f.deb ??= st.day;
    const ovr = ovrOf(st, me);
    if (!f.pk || ovr > f.pk) { f.pk = ovr; f.pkd = st.day; }
    if (res === 'W') { f.stk = (f.stk ?? 0) + 1; f.mstk = Math.max(f.mstk ?? 0, f.stk); } else if (res === 'L') f.stk = 0;
  }

  // titles & reigns
  if (b.title && W) {
    const won = b.champBefore !== W;
    const setReign = (id: string, start: number | null) => { if (id === 'player') st.player.reignStart = start; else if (st.world.fighters[id]) st.world.fighters[id].rgn = start; };
    const incr = (id: string, key: 'ttl' | 'dfn') => { if (id !== 'player' && st.world.fighters[id]) st.world.fighters[id][key] = (st.world.fighters[id][key] ?? 0) + 1; };
    if (won) {
      // previous champion's reign ends
      if (b.champBefore && b.champBefore !== W) {
        const t = tracked(st, b.champBefore);
        if (t.rgn !== null && t.rgn !== undefined) setRecord(st, 'longestReign', { id: b.champBefore, name: nameOf(st, b.champBefore), value: st.day - t.rgn, day: st.day, detail: `${st.day - t.rgn} days as ${ORG[b.org].short} ${divName} champion` });
        setReign(b.champBefore, null);
      }
      setReign(W, st.day);
      incr(W, 'ttl');
      if (W !== 'player' && st.world.fighters[W]) st.world.fighters[W].rdf = 0;
      const age = ageOfId(st, W);
      setRecord(st, 'oldestChamp', { id: W, name: nameOf(st, W), value: Math.round(age * 10) / 10, day: st.day, detail: `won ${ORG[b.org].short} ${divName} title at ${age.toFixed(1)}` });
      setRecord(st, 'youngestChamp', { id: W, name: nameOf(st, W), value: Math.round(age * 10) / 10, day: st.day, detail: `won ${ORG[b.org].short} ${divName} title at ${age.toFixed(1)}` }, true);
      const t = tracked(st, W);
      setRecord(st, 'mostTitleWins', { id: W, name: nameOf(st, W), value: t.ttl, day: st.day, detail: `${t.ttl} championship wins` });
      if (W !== 'player' && L !== 'player') addNews(st, {
        kind: 'title', title: `${ORG[b.org].short}: new ${divName} champion`,
        body: `${nameOf(st, W)} ${b.vacant || !b.champBefore ? 'claims the vacant belt against' : 'dethrones'} ${nameOf(st, L!)} by ${b.method} in round ${b.round}.`,
        refs: [W, L!], org: b.org, div: b.div, imp: tier >= 3 ? 3 : 2,
      });
    } else {
      incr(W, 'dfn');
      if (W !== 'player' && st.world.fighters[W]) st.world.fighters[W].rdf = (st.world.fighters[W].rdf ?? 0) + 1;
      const t = tracked(st, W);
      setRecord(st, 'mostDefenses', { id: W, name: nameOf(st, W), value: t.dfn, day: st.day, detail: `${t.dfn} successful title defenses` });
      if (W !== 'player' && L !== 'player') addNews(st, { kind: 'defense', title: `${ORG[b.org].short} ${divName} title retained`, body: `${nameOf(st, W)} defends against ${nameOf(st, L!)} by ${b.method} (R${b.round}) — defense #${t.dfn}.`, refs: [W, L!], org: b.org, div: b.div, imp: tier >= 4 ? 2 : 1 });
    }
  }

  // career records
  if (W) {
    const t = tracked(st, W);
    setRecord(st, 'mostWins', { id: W, name: nameOf(st, W), value: t.wins, day: st.day, detail: `${t.wins} professional wins` });
    setRecord(st, 'mostFinishes', { id: W, name: nameOf(st, W), value: t.finishes, day: st.day, detail: `${t.finishes} wins inside the distance` });
    setRecord(st, 'longestStreak', { id: W, name: nameOf(st, W), value: t.mstk, day: st.day, detail: `${t.mstk} straight wins` });
    if (gap >= 6) setRecord(st, 'biggestUpset', { id: W, name: nameOf(st, W), value: gap, day: st.day, detail: `beat ${nameOf(st, L!)} as a ${gap}-point underdog (${ORG[b.org].short})` });
    // streak & upset news for the wider world
    if (W !== 'player' && L !== 'player') {
      if ([5, 8, 10, 12, 15].includes(t.stk)) addNews(st, { kind: 'streak', title: `${nameOf(st, W)} extends streak to ${t.stk}`, body: `${ORG[b.org].short} ${divName}: ${t.stk} straight after beating ${nameOf(st, L!)} (${b.method}).`, refs: [W, L!], org: b.org, div: b.div, imp: t.stk >= 8 || tier >= 4 ? 2 : 1 });
      if (gap >= 8 || (gap >= 6 && tier >= 4)) addNews(st, { kind: 'upset', title: `Upset in the ${ORG[b.org].short}`, body: `${nameOf(st, W)} stuns ${nameOf(st, L!)} by ${b.method} in round ${b.round} — a ${gap}-point underdog.`, refs: [W, L!], org: b.org, div: b.div, imp: gap >= 10 || tier >= 4 ? 2 : 1 });
      const wf = st.world.fighters[W];
      if (wf && !wf.am && wf.rec.l === 0 && wf.rec.w >= 6 && wf.rec.w <= 7 && ageOfId(st, W) < 27) addNews(st, { kind: 'prospect', title: `Unbeaten prospect: ${nameOf(st, W)} moves to ${wf.rec.w}-0`, body: `The ${Math.floor(ageOfId(st, W))}-year-old ${divName} keeps rolling in the ${ORG[b.org].short}.`, refs: [W], org: b.org, div: b.div, imp: 1 });
    }
  }
  return rec;
}

// ───────────────────────── legacy (world fighters and player)
export interface LegacyFactor { label: string; value: number }
export function legacyBreakdown(x: { w: number; l: number; finishes: number; titles: number; defenses: number; bestStreak: number; tierBonus: number }): { total: number; factors: LegacyFactor[] } {
  const factors: LegacyFactor[] = [
    { label: `Wins (${x.w} × 2)`, value: x.w * 2 },
    { label: `Losses (${x.l} × −1)`, value: -x.l },
    { label: `Finishes (${x.finishes} × 1.2)`, value: Math.round(x.finishes * 1.2 * 10) / 10 },
    { label: `Championships (${x.titles} × 14)`, value: x.titles * 14 },
    { label: `Title defenses (${x.defenses} × 6)`, value: x.defenses * 6 },
    { label: `Best win streak (${x.bestStreak} × 1.5)`, value: x.bestStreak * 1.5 },
    { label: 'Level of competition', value: x.tierBonus },
  ];
  const total = Math.max(0, Math.min(100, Math.round(factors.reduce((s, f) => s + f.value, 0))));
  return { total, factors };
}
export function worldLegacy(f: WorldFighter) {
  const fin = f.rec.ko + f.rec.tko + f.rec.sub;
  return legacyBreakdown({ w: f.rec.w, l: f.rec.l, finishes: fin, titles: f.ttl ?? 0, defenses: f.dfn ?? 0, bestStreak: f.mstk ?? 0, tierBonus: (ORG[f.org].tier - 1) * 3 });
}

export function isNotable(f: WorldFighter) {
  return (f.ttl ?? 0) > 0 || f.rec.w >= 16 || (f.mstk ?? 0) >= 8;
}

/** Called when a world fighter retires: news + Hall of Fame entry for notable careers. */
export function onRetire(st: GameState, f: WorldFighter) {
  ensureHistory(st);
  f.rd = st.day;
  if (!isNotable(f)) return;
  const lg = worldLegacy(f);
  const entry: HallEntry = {
    id: f.id, name: `${f.first} ${f.last}`, nat: f.nat, div: f.div, org: f.org, rec: `${f.rec.w}-${f.rec.l}${f.rec.d ? '-' + f.rec.d : ''}`,
    titles: f.ttl ?? 0, defenses: f.dfn ?? 0, finishes: f.rec.ko + f.rec.tko + f.rec.sub, bestStreak: f.mstk ?? 0, retiredDay: st.day, legacy: lg.total,
  };
  st.world.hall = [entry, ...st.world.hall.filter((h) => h.id !== f.id)].sort((a, b) => b.legacy - a.legacy).slice(0, 60);
  addNews(st, { kind: 'retire', title: `${entry.name} retires`, body: `${entry.rec}${entry.titles ? `, ${entry.titles}-time champion` : ''}${entry.defenses ? ` with ${entry.defenses} defenses` : ''}. Legacy rating ${entry.legacy}.`, refs: [f.id], org: f.org, div: f.div, imp: entry.titles ? 2 : 1 });
}

export function addPlayerToHall(st: GameState, legacy: number) {
  ensureHistory(st);
  const p = st.player;
  const entry: HallEntry = {
    id: 'player', name: `${p.firstName} ${p.lastName}`, nat: p.nationality, div: p.divisionId, org: p.orgId, rec: `${p.record.w}-${p.record.l}${p.record.d ? '-' + p.record.d : ''}`,
    titles: p.titles.length, defenses: p.titleDefenses, finishes: p.record.ko + p.record.tko + p.record.sub, bestStreak: p.bestStreak, retiredDay: st.day, legacy, isPlayer: true,
  };
  st.world.hall = [entry, ...st.world.hall.filter((h) => h.id !== 'player')].sort((a, b) => b.legacy - a.legacy).slice(0, 60);
}

// ───────────────────────── pound-for-pound
export interface P4PRow { id: string; name: string; div: DivisionId; org: OrgId; rec: string; score: number; champion: boolean; why: string[] }
const TIER_W = [0, 0.35, 0.5, 0.68, 0.85, 1];

export function p4p(st: GameState, limit = 15): P4PRow[] {
  const rows: P4PRow[] = [];
  const champs = new Set<string>();
  for (const o of Object.values(st.world.orgs)) for (const c of Object.values(o.champions)) if (c) champs.add(c);
  const score = (id: string, org: OrgId, pts: number, stk: number, dfn: number, lastFight: number, recentL: number) => {
    const tw = TIER_W[ORG[org].tier];
    const why: string[] = [];
    let s = pts * tw;
    why.push(`${Math.round(pts)} ranking pts × ${tw} (${ORG[org].short} level)`);
    if (champs.has(id)) { s += 30 * tw; why.push(`${ORG[org].short} champion (+${Math.round(30 * tw)})`); }
    if (dfn) { s += dfn * 5 * tw; why.push(`${dfn} title defenses (+${Math.round(dfn * 5 * tw)})`); }
    if (stk >= 3) { s += stk * 2; why.push(`${stk}-fight win streak (+${stk * 2})`); }
    if (recentL) { s -= recentL * 4; why.push(`${recentL} recent losses (−${recentL * 4})`); }
    if (st.day - lastFight > 300) { s *= 0.8; why.push('Inactive for 10+ months (×0.8)'); }
    return { s, why };
  };
  for (const f of Object.values(st.world.fighters)) {
    if (f.retired || f.am || ORG[f.org].tier < 2) continue;
    const r = score(f.id, f.org, f.pts, f.stk ?? 0, f.dfn ?? 0, f.lastFight, f.recent.slice(-3).filter((x) => x === 'L').length);
    rows.push({ id: f.id, name: `${f.first} ${f.last}`, div: f.div, org: f.org, rec: `${f.rec.w}-${f.rec.l}`, score: Math.round(r.s * 10) / 10, champion: champs.has(f.id), why: r.why });
  }
  const p = st.player;
  if (p.isPro && !p.retired && ORG[p.orgId].tier >= 2) {
    const r = score('player', p.orgId, p.rankPoints, Math.max(0, p.streak), p.titleDefenses, p.history[0]?.day ?? st.day, p.history.slice(0, 3).filter((h) => h.result === 'L').length);
    rows.push({ id: 'player', name: `${p.firstName} ${p.lastName}`, div: p.divisionId, org: p.orgId, rec: `${p.record.w}-${p.record.l}`, score: Math.round(r.s * 10) / 10, champion: champs.has('player'), why: r.why });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Current title reigns with lengths, for records display. */
export function currentReigns(st: GameState) {
  const out: { id: string; name: string; org: OrgId; div: DivisionId; days: number; defenses: number }[] = [];
  for (const o of Object.values(st.world.orgs)) for (const [div, c] of Object.entries(o.champions)) {
    if (!c) continue;
    const t = tracked(st, c);
    if (t.rgn === null || t.rgn === undefined) continue;
    out.push({ id: c, name: nameOf(st, c), org: o.id, div: div as DivisionId, days: st.day - t.rgn, defenses: t.dfn });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** Rebuild a player timeline from existing data for saves created before v4. */
export function backfillTimeline(st: GameState) {
  const p = st.player;
  const tl: TimelineEntry[] = [{ day: 0, kind: 'start', text: `Career began at ${Math.floor((0 - p.bornDay) / 365)} years old.` }];
  for (const h of [...p.history].reverse()) {
    tl.push({ day: h.day, kind: h.title ? 'title' : 'fight', text: `${h.result === 'W' ? 'Beat' : h.result === 'L' ? 'Lost to' : 'Drew with'} ${h.opponentName} by ${h.method} (R${h.round})${h.title ? ' — title fight' : ''} at ${h.event}.`, ref: h.opponentId });
  }
  for (const t of p.titles) tl.push({ day: t.day, kind: 'title', text: `Won the ${ORG[t.orgId].short} ${DIV[t.divisionId].name} championship.` });
  tl.sort((a, b) => a.day - b.day);
  return tl;
}
