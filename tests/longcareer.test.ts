import { it, expect } from 'vitest';
import { advanceDay, createCareer } from '../src/game/career';
import { acceptOffer, applyFightResult, opponentSetup, playerSetup } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { overallRating } from '../src/game/attributes';
import { playerRank } from '../src/game/world';
import { activeEvents, resolveEvent, EVENT } from '../src/game/events';
import { signContract, turnPro } from '../src/game/economy';
import { validate } from '../src/game/save';
import type { GameState } from '../src/game/types';

function fight(st: GameState, seed: number) {
  const sc = st.scheduled!;
  const s = createFight({ rounds: sc.rounds, roundSeconds: 45, seed, title: sc.title }, playerSetup(st, sc.gamePlan), opponentSetup(st, sc.opponentId, sc.title));
  const me = new AIController(0, 'balanced', 'hard', seed + 1);
  const op = new AIController(1, st.world.fighters[sc.opponentId].style, 'normal', seed + 2);
  let n = 0;
  while (s.phase !== 'over' && n++ < 400000) { if (s.phase === 'roundOver') startNextRound(s); step(s, [me.think(s, 1 / 60), op.think(s, 1 / 60)], 1 / 60); }
  return s;
}

it('a long career reaches titles and promotions; state stays valid', () => {
  const st = createCareer({ firstName: 'L', lastName: 'C', nickname: '', nationality: 'x', age: 21, heightCm: 180, reachCm: 185, hand: 'right', stance: 'orthodox',
    bodyType: 'lean', background: 'wrestling', startLevel: 'amateur', difficulty: 'easy', goals: [], divisionId: 'welter', naturalKg: 79,
    appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 99 }, 1);
  // better camp: good gym & coaches so progression is quick
  st.player.gymId = 'northstar';
  st.player.money = 50000;
  const log: string[] = [];
  let fights = 0;
  for (let d = 0; d < 365 * 6 && !st.player.retired; d++) {
    for (const e of activeEvents(st)) {
      const t = EVENT[e.templateId];
      const idx = e.templateId === 'turnpro' ? 1 : e.templateId === 'shortnotice' ? 0 : 0;
      resolveEvent(st, e.id, Math.min(idx, t.choices.length - 1));
    }
    if (!st.player.isPro && st.player.amateurRecord.w >= 3) turnPro(st);
    if (st.player.isPro && !st.scheduled && st.contractOffers.length) {
      const best = [...st.contractOffers].sort((a, b) => b.purse - a.purse)[0];
      if (!st.player.contract || st.player.contract.fightsLeft <= 1 || best.orgId !== st.player.orgId) {
        const err = signContract(st, best.id);
        if (!err) log.push(`day ${st.day}: signed ${best.orgId} ${best.purse}`);
      }
    }
    if (!st.scheduled && st.offers.length) {
      const title = st.offers.find((o) => o.title);
      acceptOffer(st, (title ?? st.offers[0]).id, 'general');
    }
    if (st.scheduled && st.scheduled.day <= st.day) {
      const sc = st.scheduled;
      const r = applyFightResult(st, fight(st, 1000 + d), {});
      fights++;
      log.push(`day ${st.day} ${sc.orgId}${sc.title ? ' TITLE' : ''}: ${r!.playerWon ? 'W' : r!.draw ? 'D' : 'L'} ${r!.method} vs ovr? rank ${r!.rankBefore}->${r!.rankAfter} ovr ${overallRating(st.player.attrs)}`);
      continue;
    }
    advanceDay(st);
    expect(Number.isFinite(st.player.money)).toBe(true);
  }
  console.log(log.join('\n'));
  console.log('FINAL', { fights, rec: st.player.record, am: st.player.amateurRecord, org: st.player.orgId, titles: st.player.titles, ovr: overallRating(st.player.attrs), money: Math.round(st.player.money), earned: Math.round(st.player.earningsTotal), rank: playerRank(st), pop: Math.round(st.player.popularity), sponsors: st.sponsors.length, ach: st.achievements.length, saveKB: Math.round(JSON.stringify(st).length / 1024) });
  expect(validate(st)).toBeNull();
  expect(fights).toBeGreaterThan(12);
}, 300000);
