import { describe, it, expect } from 'vitest';
import { advanceDay, createCareer, type NewCareerOpts } from '../src/game/career';
import { activeEvents, resolveEvent } from '../src/game/events';
import { encodeSave, migrate, validate } from '../src/game/save';
import { p4p, currentReigns, worldLegacy } from '../src/game/history';
import { overallRating, unpackAttrs } from '../src/game/attributes';
import type { GameState } from '../src/game/types';

import { baseOpts, runDays } from './worldHelpers';
export { baseOpts, runDays };

describe('shared history (v4)', () => {
  it('migrates a v3 save without losing data', () => {
    const st = createCareer(baseOpts, 1) as any;
    runDays(st, 30);
    const fighters = Object.keys(st.world.fighters).length;
    // make it look like a v3 save
    delete st.world.history; delete st.world.news; delete st.world.records; delete st.world.hall; delete st.timeline;
    delete st.lastReplay; delete st.callout; delete st.titlePush; delete st.sponsorBuzz;
    st.version = 3;
    st.player.history = [{ id: 'x', day: 5, orgId: 'ifc', event: 'IFC 1', opponentId: 'q', opponentName: 'Old Foe', opponentRecord: '1-0', result: 'W', method: 'KO', round: 1, time: '1:00', title: false, amateur: false, earnings: 1, bonuses: [], notes: '' }];
    const m = migrate(JSON.parse(JSON.stringify(st)));
    expect(m.version).toBe(10);
    expect(validate(m)).toBeNull();
    expect(Object.keys(m.world.fighters).length).toBe(fighters);
    expect(m.world.history).toEqual([]);
    expect(m.timeline.some((t) => t.text.includes('Old Foe'))).toBe(true); // back-filled from real history
  });

  it('three simulated years keep history, records, champions and news consistent', { timeout: 120000 }, () => {
    const st = createCareer({ ...baseOpts, seed: 777 }, 1);
    runDays(st, 365 * 3);
    const w = st.world;
    expect(w.history.length).toBeGreaterThan(300);
    expect(w.news.length).toBeGreaterThan(30);
    // every recorded bout's participants have matching log entries (when still present)
    for (const b of w.history.slice(0, 60)) {
      for (const id of [b.a, b.b]) {
        const f = w.fighters[id];
        if (!f || id === 'player') continue;
        const hit = f.log?.some((e) => e[0] === b.day && (e[2] === b.a || e[2] === b.b));
        if ((f.log?.length ?? 0) < 10) expect(hit).toBe(true);
      }
    }
    // records reference real values
    const rb = w.records;
    expect(rb.mostWins).toBeDefined();
    const mw = rb.mostWins!;
    const holder = mw.id === 'player' ? st.player.record.w : w.fighters[mw.id]?.rec.w;
    if (holder !== undefined) expect(holder).toBeGreaterThanOrEqual(mw.value);
    // current champions agree with each org's title history (last entry for that division)
    for (const o of Object.values(w.orgs)) for (const [div, champ] of Object.entries(o.champions)) {
      const last = [...o.titleHistory].reverse().find((h) => h.div === div);
      if (last && champ) expect(last.champ).toBe(champ);
    }
    // retired champions remain in the record (not pruned)
    for (const h of w.hall.filter((x) => !x.isPlayer)) expect(w.fighters[h.id]).toBeDefined();
    // title news are backed by real title bouts in history
    for (const n of w.news.filter((x) => x.kind === 'title' && x.title.includes('new')).slice(0, 10)) {
      expect(w.history.some((b) => b.t && b.day === n.day && n.refs.includes(b.a === n.refs[0] || b.b === n.refs[0] ? n.refs[0] : ''))).toBe(true);
    }
    const pf = p4p(st);
    expect(pf.length).toBe(15);
    for (let i = 1; i < pf.length; i++) expect(pf[i - 1].score).toBeGreaterThanOrEqual(pf[i].score);
    expect(currentReigns(st).length).toBeGreaterThan(5);
    const any = Object.values(w.fighters).find((f) => (f.ttl ?? 0) > 0)!;
    expect(worldLegacy(any).factors.length).toBeGreaterThan(3);
    // save stays a sane size
    const kb = JSON.stringify(st).length / 1024;
    console.log('3-year save KB', Math.round(kb), 'history', w.history.length, 'news', w.news.length, 'hall', w.hall.length, 'fighters', Object.keys(w.fighters).length);
    expect(kb).toBeLessThan(800);
    expect(encodeSave(JSON.stringify(st)).length / 1024).toBeLessThan(150); // compressed chars actually stored
    void overallRating; void unpackAttrs;
  });
});
