// Championship reigns: every belt the player has held, the fights that won and defended it, and how it ended
// (lost in the cage, or vacated — moving division, leaving the promotion, keeping another belt, retiring, injury…).
import { DIV, ORG } from '../data/world';
import type { DivisionId, FightHistoryEntry, GameState, OrgId, Reign, ReignEnd } from './types';

export function reignsOf(st: GameState): Reign[] {
  return (st.player.reigns ??= []);
}

export function currentReign(st: GameState, org: OrgId, div: DivisionId): Reign | undefined {
  return reignsOf(st).find((r) => r.org === org && r.div === div && !r.end);
}

export function startReign(st: GameState, org: OrgId, div: DivisionId, fightId: string | null, how: Reign['how'] = 'won') {
  const open = currentReign(st, org, div);
  if (open) return open;
  const r: Reign = { id: `rg${reignsOf(st).length + 1}_${st.day}`, org, div, start: st.day, wonIn: fightId, how, defenses: [] };
  reignsOf(st).push(r);
  return r;
}

export function recordDefense(st: GameState, org: OrgId, div: DivisionId, fightId: string) {
  const r = currentReign(st, org, div) ?? startReign(st, org, div, null, 'unknown');
  if (!r.defenses.includes(fightId)) r.defenses.push(fightId);
}

export function endReign(st: GameState, org: OrgId, div: DivisionId, end: Omit<ReignEnd, 'day'>) {
  const r = currentReign(st, org, div);
  if (!r) return;
  r.end = { day: st.day, ...end };
}

/** Shorthand for the vacate reasons used around the game. */
export const VACATE = {
  division: (to: DivisionId) => ({ kind: 'vacated' as const, reason: `Moved to ${DIV[to].name}` }),
  keptOther: (kept: DivisionId) => ({ kind: 'vacated' as const, reason: `Kept the ${DIV[kept].name} belt after winning it in a superfight` }),
  leftOrg: (from: OrgId, to: OrgId) => ({ kind: 'vacated' as const, reason: `Left the ${ORG[from].short} for the ${ORG[to].short}` }),
  retired: () => ({ kind: 'vacated' as const, reason: 'Retired as champion' }),
  injury: () => ({ kind: 'stripped' as const, reason: 'Stripped — out injured for too long to defend' }),
  inactive: () => ({ kind: 'stripped' as const, reason: 'Stripped for inactivity' }),
  admin: () => ({ kind: 'stripped' as const, reason: 'Belt reassigned (admin tools)' }),
};

/** Division a past fight was contested in (stored on new entries; inferred for older ones). */
export function fightDivision(st: GameState, h: FightHistoryEntry): DivisionId {
  if (h.div) return h.div;
  // a title won that day: the title record names the division (the most reliable source, superfights included)
  if (h.title && h.result === 'W' && !h.amateur) {
    const t = (st.player.titles ?? []).filter((x) => x.orgId === h.orgId && x.day === h.day);
    if (t.length === 1) return t[0].divisionId;
  }
  // the world's bout log for this exact fight (same opponent and event or day)
  const vs = (x: { a: string; b: string }) => (x.a === 'player' && x.b === h.opponentId) || (x.b === 'player' && x.a === h.opponentId);
  const b = (st.world?.history ?? []).find((x) => vs(x) && (x.ev === h.event || x.day === h.day));
  if (b?.div) return b.div;
  const f = st.world?.fighters?.[h.opponentId];
  if (f?.div && !h.amateur) return f.div;
  const t = [...(st.player.titles ?? [])].filter((x) => x.orgId === h.orgId && x.day <= h.day).sort((a, b) => b.day - a.day)[0];
  return t?.divisionId ?? st.player.divisionId;
}

/**
 * Older builds' admin "Allow new offers now" moved the latest fight's date back by up to 120 days, which can put a fight
 * before the one that preceded it. History order is the true order, so restore such dates from the world's bout log or,
 * for a title win, from the matching title record.
 */
export function repairHistoryDates(st: GameState): number {
  const hs = st.player.history ?? [];
  let fixed = 0;
  for (let i = 0; i < hs.length - 1; i++) {
    const h = hs[i], older = hs[i + 1], newer = hs[i - 1];
    if (h.day >= older.day) continue;
    const b = (st.world?.history ?? []).find((x) => x.ev === h.event && ((x.a === 'player' && x.b === h.opponentId) || (x.b === 'player' && x.a === h.opponentId)));
    let day = b?.day;
    if (day === undefined && h.title && h.result === 'W') {
      day = (st.player.titles ?? []).find((t) => t.orgId === h.orgId && t.day >= older.day && (!newer || t.day <= newer.day))?.day;
    }
    h.day = day ?? older.day;
    fixed++;
  }
  return fixed;
}

const sameTitle = (st: GameState, h: FightHistoryEntry, org: OrgId, div: DivisionId) => h.title && !h.amateur && h.orgId === org && fightDivision(st, h) === div;

/** Rebuild reign records for saves made before reigns were tracked, from titles, fight history and the career timeline. */
export function backfillReigns(st: GameState): Reign[] {
  const p = st.player;
  const hist = [...(p.history ?? [])].reverse().filter((h) => !h.amateur); // history order is the true fight order
  const titles = [...(p.titles ?? [])].sort((a, b) => a.day - b.day);
  const tl = st.timeline ?? [];
  const used = new Set<string>();
  const out: Reign[] = [];
  const startIdx: number[] = [];
  titles.forEach((t) => {
    let win = hist.find((h) => h.day === t.day && h.title && h.result === 'W' && h.orgId === t.orgId && !used.has(h.id));
    if (!win) {
      // dates can drift (see repairHistoryDates): nearest unused title win in that promotion and division
      win = hist.filter((h) => h.title && h.result === 'W' && h.orgId === t.orgId && !used.has(h.id) && Math.abs(h.day - t.day) <= 200)
        .sort((a, b) => (b.day <= t.day ? 1 : 0) - (a.day <= t.day ? 1 : 0) || (fightDivision(st, b) === t.divisionId ? 1 : 0) - (fightDivision(st, a) === t.divisionId ? 1 : 0) || Math.abs(a.day - t.day) - Math.abs(b.day - t.day))[0];
    }
    if (win) used.add(win.id);
    const r: Reign = { id: `rg${out.length + 1}_${t.day}`, org: t.orgId, div: t.divisionId, start: t.day, wonIn: win?.id ?? null, how: win ? 'won' : 'unknown', defenses: [] };
    const after = hist.findIndex((h) => h.day >= t.day);
    const from = win ? hist.indexOf(win) : after < 0 ? hist.length - 1 : after - 1;
    startIdx.push(from);
    out.push(r);
  });
  out.forEach((r, i) => {
    const from = startIdx[i];
    // an HFC belt won while holding another HFC belt was a superfight
    const home = r.org === 'acl' ? out.slice(0, i).find((o) => o.org === r.org && o.div !== r.div && o.start <= r.start && (!o.end || o.end.day >= r.start)) : undefined;
    if (home && r.how === 'won') r.how = 'superfight';
    const nextSame = out.slice(i + 1).find((x) => x.org === r.org && x.div === r.div);
    const stopIdx = nextSame ? startIdx[out.indexOf(nextSame)] : hist.length;
    let last = from;
    for (let k = from + 1; k < stopIdx && k < hist.length; k++) {
      const h = hist[k];
      if (!sameTitle(st, h, r.org, r.div) || used.has(h.id)) continue;
      if (h.result === 'L') { r.end = { day: h.day, kind: 'lost', reason: `Lost to ${h.opponentName} by ${h.method}${['UD', 'SD', 'MD'].includes(h.method) ? '' : ` (round ${h.round})`}`, fightId: h.id }; used.add(h.id); last = k; break; }
      if (h.result === 'D') (r.draws ??= []).push(h.id); else r.defenses.push(h.id);
      used.add(h.id); last = k;
    }
    if (r.end) return;
    const holding = st.world?.orgs?.[r.org]?.champions?.[r.div] === 'player';
    if (holding && !nextSame) return; // still the champion
    const lastDay = last >= 0 && hist[last] ? hist[last].day : r.start;
    const nf = hist[last + 1];
    const tlDay = (kind: string) => tl.find((e) => e.kind === kind && e.day >= lastDay && (!nf || e.day <= nf.day))?.day;
    // won another belt in the same promotion as the very next fight → kept that one
    const sup = nf ? out.find((o) => o !== r && o.org === r.org && o.div !== r.div && o.wonIn === nf.id) : undefined;
    if (sup && !holding) { r.end = { day: tlDay('division') ?? nf!.day, ...VACATE.keptOther(sup.div) }; return; }
    // superfight belt given up to go back and defend the original one
    if (home && (st.world?.orgs?.[home.org]?.champions?.[home.div] === 'player' || (nf && sameTitle(st, nf, home.org, home.div)))) {
      r.end = { day: nf ? (tlDay('division') ?? nf.day) : lastDay, ...VACATE.keptOther(home.div) }; return;
    }
    // first later fight somewhere else: a new promotion or a new weight class
    const moved = hist.slice(last + 1, stopIdx).find((h) => h.orgId !== r.org || (fightDivision(st, h) !== r.div && !h.title));
    const tlBefore = (kind: string, until: number) => tl.find((e) => e.kind === kind && e.day >= lastDay && e.day <= until)?.day;
    if (moved && moved.orgId !== r.org) { r.end = { day: tlBefore('contract', moved.day) ?? moved.day, ...VACATE.leftOrg(r.org, moved.orgId) }; return; }
    if (moved) { r.end = { day: tlBefore('division', moved.day) ?? moved.day, ...VACATE.division(fightDivision(st, moved)) }; return; }
    if (!nf && p.retired) { r.end = { day: tlDay('retire') ?? lastDay, ...VACATE.retired() }; return; }
    r.end = { day: nextSame?.start ?? lastDay, kind: 'vacated', reason: 'Vacated (before reigns were recorded)' };
  });
  return out;
}

/**
 * Rebuild with the current inference while keeping what was recorded live (endings with a real reason, drawn
 * defenses, admin awards that have no title record).
 */
export function rebuildReigns(st: GameState): Reign[] {
  const old = st.player.reigns ?? [];
  const fresh = backfillReigns(st);
  const matched = new Set<Reign>();
  for (const r of fresh) {
    const o = old.find((x) => !matched.has(x) && x.org === r.org && x.div === r.div && ((x.wonIn && x.wonIn === r.wonIn) || Math.abs(x.start - r.start) <= 1));
    if (!o) continue;
    matched.add(o);
    r.id = o.id;
    if (o.how === 'admin' || o.how === 'vacant' || o.how === 'superfight') r.how = o.how;
    if (o.draws?.length) r.draws = [...new Set([...(r.draws ?? []), ...o.draws])];
    if (o.end && !o.end.reason.includes('before reigns were recorded') && !(r.end?.kind === 'lost')) r.end = o.end;
  }
  const kept = old.filter((x) => !matched.has(x) && x.how === 'admin');
  return [...fresh, ...kept].sort((a, b) => a.start - b.start);
}
