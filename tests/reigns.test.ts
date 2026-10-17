import { describe, it, expect } from 'vitest';
import { advanceDay, advanceDays, changeDivision, createCareer, retire, type NewCareerOpts } from '../src/game/career';
import { acceptOffer, applyFightResult, generateOffers, opponentSetup, playerSetup } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { activeEvents, resolveEvent } from '../src/game/events';
import { withRng } from '../src/game/core';
import { backfillReigns, currentReign, startReign, endReign, rebuildReigns, repairHistoryDates, VACATE } from '../src/game/reigns';
import { posterForHistory, posterForScheduled, posterTier } from '../src/game/poster';
import { chooseBelt } from '../src/game/superfight';
import { migrate, validate } from '../src/game/save';
import { ATTRS } from '../src/game/attributes';
import { DIV } from '../src/data/world';
import type { DivisionId, FightHistoryEntry, GameState, OrgId } from '../src/game/types';

const base: NewCareerOpts = {
  firstName: 'Belt', lastName: 'Holder', nickname: 'Gold', nationality: 'Ireland', age: 26, heightCm: 180, reachCm: 185, hand: 'right', stance: 'orthodox',
  bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: [], divisionId: 'light', naturalKg: 74,
  appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 4242,
};

function champ(org: OrgId, div: DivisionId, defenses = 0, seed = 4242): GameState {
  const st = createCareer({ ...base, divisionId: div, naturalKg: DIV[div].kg + 3, seed }, 1);
  const p = st.player;
  p.orgId = org;
  p.contract = { orgId: org, fightsTotal: 8, fightsLeft: 8, purse: 20000, winBonus: 20000, signingBonus: 0, exclusive: true, champClause: true, amateur: false, signedDay: 0 } as any;
  st.world.orgs[org].champions[div] = 'player';
  p.isChampion = true;
  p.titles.push({ orgId: org, divisionId: div, day: 0 });
  p.reignDefenses = defenses; p.titleDefenses = defenses;
  p.weightKg = DIV[div].kg + 2;
  p.reigns = [];
  startReign(st, org, div, null, 'admin');
  st.offers = [];
  return st;
}

function fightTo(st: GameState, playerShouldWin: boolean) {
  const sc = st.scheduled!;
  for (let seed = 1; seed < 12; seed++) {
    const me = playerSetup(st, sc.gamePlan), op = opponentSetup(st, sc.opponentId, sc.title);
    const strong = playerShouldWin ? me : op, weak = playerShouldWin ? op : me;
    for (const a of ATTRS) { (strong.attrs as any)[a.key] = 95; (weak.attrs as any)[a.key] = 20; }
    const s = createFight({ rounds: 5, roundSeconds: 60, seed, title: true }, me, op);
    const a = new AIController(0, 'pressure', 'hard', seed), b = new AIController(1, 'balanced', 'hard', seed + 1);
    let n = 0;
    while (s.phase !== 'over' && n++ < 400000) { if (s.phase === 'roundOver') startNextRound(s); step(s, [a.think(s, 1 / 60), b.think(s, 1 / 60)], 1 / 60); }
    if ((s.outcome!.winner === 0) === playerShouldWin && s.outcome!.winner !== -1) return s;
  }
  throw new Error('could not produce the required result');
}

function bookTitleDefense(st: GameState) {
  for (let i = 0; i < 400 && !st.offers.some((o) => o.title && !o.superfight); i++) { st.lastOfferDay = -999; st.day++; withRng(st, (rng) => generateOffers(st, rng)); }
  const o = st.offers.find((x) => x.title && !x.superfight)!;
  expect(o).toBeTruthy();
  expect(acceptOffer(st, o.id, 'general')).toBeNull();
  let g = 0;
  while (st.scheduled && st.day < st.scheduled.day && g++ < 40) { for (const e of activeEvents(st)) resolveEvent(st, e.id, 0); advanceDays(st, 7); }
  for (const e of activeEvents(st)) resolveEvent(st, e.id, 0);
  advanceDay(st);
}

describe('championship reigns', () => {
  it('records defenses and ends the reign with the fight that lost the belt', { timeout: 60000 }, () => {
    const st = champ('gfc', 'light');
    bookTitleDefense(st);
    const poster = posterForScheduled(st, st.scheduled!);
    expect(poster.tier).toBe('title');
    expect(poster.red.champion).toBe(true);
    expect(poster.titleLine).toContain('LIGHTWEIGHT');
    const won = applyFightResult(st, fightTo(st, true))!;
    expect(won.playerWon).toBe(true);
    const r = currentReign(st, 'gfc', 'light')!;
    expect(r.defenses).toEqual([won.id]);
    const h = st.player.history[0];
    expect(h.div).toBe('light');
    expect(h.poster?.champion).toBe('player');
    expect(h.poster?.myRec).toBeTruthy();
    // second defense: lose it
    st.day += 30; st.offers = [];
    bookTitleDefense(st);
    const lost = applyFightResult(st, fightTo(st, false))!;
    expect(lost.lostTitle).toBe(true);
    const ended = st.player.reigns!.find((x) => x.id === r.id)!;
    expect(ended.end?.kind).toBe('lost');
    expect(ended.end?.fightId).toBe(lost.id);
    expect(ended.end?.reason).toContain('Lost to');
    expect(currentReign(st, 'gfc', 'light')).toBeUndefined();
    // the past posters redraw from history with a result stamp
    const pp = posterForHistory(st, st.player.history[0]);
    expect(pp.tier).toBe('title');
    expect(pp.result?.won).toBe(false);
    expect(validate(migrate(JSON.parse(JSON.stringify(st))))).toBeNull();
  });

  it('records each vacate path with a reason', () => {
    const a = champ('gfc', 'light');
    expect(changeDivision(a, 'welter')).toBeNull();
    expect(a.player.reigns![0].end).toMatchObject({ kind: 'vacated', reason: 'Moved to Welterweight' });

    const b = champ('gfc', 'light');
    retire(b);
    expect(b.player.reigns![0].end).toMatchObject({ kind: 'vacated', reason: 'Retired as champion' });

    // stripped: champion who cannot defend for a long time
    const c = champ('gfc', 'light');
    c.player.injuries.push({ id: 'x', type: 'hand', severity: 3, daysLeft: 420, totalDays: 420, treated: false, source: 'test' });
    c.player.history = [];
    for (let i = 0; i < 400 && !c.player.reigns![0].end; i++) { for (const e of activeEvents(c)) resolveEvent(c, e.id, 0); c.offers = []; advanceDay(c); }
    expect(c.player.reigns![0].end).toMatchObject({ kind: 'stripped', reason: VACATE.injury().reason });
    expect(c.world.orgs.gfc.champions.light).toBeNull();

    const d = champ('acl', 'light');
    d.player.champStatus = 1;
    d.player.pendingBeltChoice = { home: 'light', won: 'welter', level: 1 } as any;
    d.world.orgs.acl.champions.welter = 'player';
    startReign(d, 'acl', 'welter', null, 'superfight');
    expect(chooseBelt(d, 'welter', 'boxing')).toBeNull();
    const home = d.player.reigns!.find((x) => x.div === 'light')!;
    expect(home.end).toMatchObject({ kind: 'vacated' });
    expect(home.end!.reason).toContain('Kept the Welterweight belt');
    expect(currentReign(d, 'acl', 'welter')).toBeTruthy();

    const e = champ('gfc', 'light');
    endReign(e, 'gfc', 'light', VACATE.leftOrg('gfc', 'acl'));
    expect(e.player.reigns![0].end!.reason).toBe('Left the GFC for the HFC');
  });

  it('rebuilds reigns for saves made before they were tracked', () => {
    const st = champ('gfc', 'light');
    const mk = (id: string, day: number, result: 'W' | 'L', org: OrgId = 'gfc'): FightHistoryEntry => ({ id, day, orgId: org, event: 'E', opponentId: 'x' + id, opponentName: 'Opp ' + id, opponentRecord: '10-2', result, method: 'UD', round: 5, time: '5:00', title: true, amateur: false, earnings: 0, bonuses: [], notes: '' });
    st.player.titles = [{ orgId: 'gfc', divisionId: 'light', day: 10 }, { orgId: 'acl', divisionId: 'light', day: 200 }];
    st.player.history = [mk('d', 200, 'W', 'acl'), mk('c', 90, 'L'), mk('b', 50, 'W'), mk('a', 10, 'W')];
    st.world.orgs.gfc.champions.light = null;
    st.world.orgs.acl.champions.light = 'player';
    const rs = backfillReigns(st);
    expect(rs.length).toBe(2);
    expect(rs[0]).toMatchObject({ org: 'gfc', wonIn: 'a', defenses: ['b'] });
    expect(rs[0].end).toMatchObject({ kind: 'lost', fightId: 'c' });
    expect(rs[1]).toMatchObject({ org: 'acl', wonIn: 'd' });
    expect(rs[1].end).toBeUndefined();
    // migration from v8 fills them in
    const old = JSON.parse(JSON.stringify(st));
    old.version = 8; delete old.player.reigns;
    const m = migrate(old);
    expect(m.player.reigns!.length).toBe(2);
    expect(validate(m)).toBeNull();
    // old history entries without a poster snapshot still produce a poster
    const p = posterForHistory(m, m.player.history[1]);
    expect(p.result?.won).toBe(false);
    expect(p.red.rec).toBe('2-0'); // record going into the fight
  });

  it('chooses poster designs by the importance of the bout', () => {
    expect(posterTier({ amateur: true, org: 'ifc', title: false })).toBe('local');
    expect(posterTier({ amateur: false, org: 'ifc', title: false, slot: 'prelim' })).toBe('local');
    expect(posterTier({ amateur: false, org: 'cms', title: false, slot: 'main' })).toBe('card');
    expect(posterTier({ amateur: false, org: 'cms', title: false, slot: 'mainevent' })).toBe('headliner');
    expect(posterTier({ amateur: false, org: 'gfc', title: false, slot: 'prelim', rivalry: true })).toBe('headliner');
    expect(posterTier({ amateur: false, org: 'acl', title: true, slot: 'mainevent' })).toBe('title');
    expect(posterTier({ amateur: false, org: 'acl', title: true, superfight: true })).toBe('superfight');
  });

  it('rebuilds a triple-champion career from an old save (drifted date, no stored divisions)', () => {
    const st = champ('acl', 'lhw');
    const p = st.player;
    let n = 0;
    const f = (day: number, org: OrgId, title: boolean, result: 'W' | 'L' = 'W', opp = 'Opp'): FightHistoryEntry => ({ id: `f${++n}`, day, orgId: org, event: `${org} ${n}`, opponentId: `none${n}`, opponentName: `${opp} ${n}`, opponentRecord: '10-2', result, method: 'KO', round: 1, time: '1:00', title, amateur: false, earnings: 0, bonuses: [], notes: '' });
    const chrono = [
      f(80, 'ifc', true), f(150, 'rfl', true), f(220, 'cms', true), f(250, 'cms', false), f(310, 'acl', false),
      f(400, 'acl', true), // HFC middleweight title — its date will be dragged back below
      f(450, 'acl', true), f(540, 'acl', true), f(640, 'acl', true), f(730, 'acl', true), // 4 MW defenses
      f(850, 'acl', true), // superfight: LHW title
      f(940, 'acl', true), f(1030, 'acl', true), f(1150, 'acl', true), f(1250, 'acl', true), f(1350, 'acl', true), f(1440, 'acl', true), // 6 LHW defenses
      f(1480, 'acl', true), // superfight: heavyweight title
    ];
    p.history = [...chrono].reverse();
    p.titles = [{ orgId: 'ifc', divisionId: 'middle', day: 80 }, { orgId: 'rfl', divisionId: 'middle', day: 150 }, { orgId: 'cms', divisionId: 'middle', day: 220 },
      { orgId: 'acl', divisionId: 'middle', day: 400 }, { orgId: 'acl', divisionId: 'lhw', day: 850 }, { orgId: 'acl', divisionId: 'heavy', day: 1480 }];
    p.divisionId = 'lhw';
    st.world.history = [];
    st.world.orgs.acl.champions = { ...st.world.orgs.acl.champions, middle: null, lhw: 'player', heavy: null };
    for (const o of ['ifc', 'rfl', 'cms'] as const) st.world.orgs[o].champions.middle = null;
    chrono[5].day = 400 - 120 - 10; // what the old admin "Allow new offers now" button did
    // the old (v9) rebuild got this wrong; the v10 migration repairs it
    const old = JSON.parse(JSON.stringify(st));
    old.version = 9; old.player.reigns = backfillReigns(old);
    const m = migrate(old);
    expect(validate(m)).toBeNull();
    expect(m.player.history.find((h: FightHistoryEntry) => h.id === 'f6')!.day).toBe(400);
    const by = (org: OrgId, div: DivisionId) => m.player.reigns!.filter((r) => r.org === org && r.div === div);
    expect(by('acl', 'middle')).toHaveLength(1);
    expect(by('acl', 'middle')[0]).toMatchObject({ wonIn: 'f6', defenses: ['f7', 'f8', 'f9', 'f10'] });
    expect(by('acl', 'middle')[0].end!.reason).toBe('Kept the Light Heavyweight belt after winning it in a superfight');
    expect(by('acl', 'lhw')[0]).toMatchObject({ wonIn: 'f11', how: 'superfight', defenses: ['f12', 'f13', 'f14', 'f15', 'f16', 'f17'] });
    expect(by('acl', 'lhw')[0].end).toBeUndefined();
    expect(by('acl', 'heavy')[0]).toMatchObject({ wonIn: 'f18', how: 'superfight', defenses: [] });
    expect(by('acl', 'heavy')[0].end!.reason).toBe('Kept the Light Heavyweight belt after winning it in a superfight');
    expect(by('ifc', 'middle')[0].end!.reason).toBe('Left the IFC for the RFL');
    expect(by('rfl', 'middle')[0].end!.reason).toBe('Left the RFL for the CMS');
    expect(by('cms', 'middle')[0].end!.reason).toBe('Left the CMS for the HFC');
    expect(m.player.reigns!.reduce((s: number, r) => s + r.defenses.length, 0)).toBe(10);
    // posters of those fights know the division, the champion side and the superfights
    const poster = (id: string) => posterForHistory(m, m.player.history.find((h: FightHistoryEntry) => h.id === id)!);
    expect(poster('f8').div).toBe('middle');
    expect(poster('f8').red.champion).toBe(true);
    expect(poster('f11').tier).toBe('superfight');
    expect(poster('f11').homeDiv).toBe('middle');
    expect(poster('f18').div).toBe('heavy');
    // repairing is idempotent and live records survive a rebuild
    expect(repairHistoryDates(m)).toBe(0);
    expect(rebuildReigns(m).map((r) => r.id)).toEqual(m.player.reigns!.map((r) => r.id));
  });

  it('old superfight entries get the division they were fought at, not one from an earlier bout or the current one', () => {
    const st = champ('acl', 'lhw');
    const p = st.player;
    const mk = (id: string, day: number, opp: string): FightHistoryEntry => ({ id, day, orgId: 'acl', event: `HFC ${id}`, opponentId: opp, opponentName: opp, opponentRecord: '20-3', result: 'W', method: 'KO', round: 1, time: '1:00', title: true, amateur: false, earnings: 0, bonuses: [], notes: '' });
    const rossi = Object.values(st.world.fighters).find((f) => f.div === 'lhw' && !f.retired)!; // he has since dropped to LHW
    p.history = [mk('sf', 900, rossi.id), mk('d1', 500, 'x1'), mk('won', 100, 'x0')];
    p.titles = [{ orgId: 'acl', divisionId: 'lhw', day: 100 }, { orgId: 'acl', divisionId: 'heavy', day: 900 }];
    // an earlier bout against the same man at light heavyweight is in the world's log
    st.world.history.unshift({ id: 'b1', day: 300, org: 'acl', div: 'lhw', a: 'player', b: rossi.id, an: 'You', bn: 'Rossi', w: 0, m: 'KO', r: 1, ev: 'HFC old' } as any);
    st.world.orgs.acl.titleHistory.push({ day: 600, div: 'heavy', champ: rossi.id, name: 'Rossi' });
    st.world.orgs.acl.champions.heavy = null;
    p.reigns = backfillReigns(st);
    const poster = posterForHistory(st, p.history[0]);
    expect(poster.div).toBe('heavy');
    expect(poster.tier).toBe('superfight');
    expect(poster.homeDiv).toBe('lhw');
    expect(poster.titleLine).toContain('HEAVYWEIGHT');
    expect(poster.titleLine).not.toContain('LIGHT');
    expect(poster.blue.champion).toBe(true);
    expect(poster.red.champion).toBe(true);
  });
});
