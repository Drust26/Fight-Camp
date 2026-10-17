// Post-fight interviews. Options depend on the result and career context; effects feed existing
// systems: popularity, reputation, rivalries, promoter relationship, sponsor interest (sponsorBuzz),
// matchmaking (callout) and title-shot eligibility (titlePush).
import { clamp } from './rng';
import { ORG } from '../data/world';
import { rankings, playerRank } from './world';
import { addNews, addTimeline, nameOf } from './history';
import type { FightResultSummary, GameState } from './types';

export interface InterviewOption { id: string; label: string; quote: string; effects: string; target?: string }

export function interviewOptions(st: GameState, r: FightResultSummary): InterviewOption[] {
  const p = st.player;
  const won = r.playerWon;
  const opp = r.opponentName.split(' ').slice(-1)[0];
  const rank = playerRank(st);
  const champ = p.isPro ? st.world.orgs[p.orgId].champions[p.divisionId] : null;
  const out: InterviewOption[] = [
    { id: 'respect', label: 'Respectful', quote: won ? `Huge respect to ${opp}. He made me dig deep tonight.` : `${opp} was the better man tonight. I'll learn from this.`, effects: '+Reputation, cools any rivalry' },
    { id: 'confident', label: 'Confident', quote: won ? `I told everyone this would happen. I'm just getting started.` : `One bad night doesn't define me. I'll be back stronger.`, effects: won ? '+Popularity, +reputation' : 'Small popularity gain, small reputation risk' },
    { id: 'humor', label: 'Entertain the crowd', quote: won ? `I'd like to thank my mum, my coach, and the guy who sold me these shorts.` : `Well… at least my hair still looks good.`, effects: '+Popularity, sponsors take notice' },
    { id: 'confront', label: 'Confrontational', quote: won ? `${opp} talked a lot of trash. Where's that energy now?` : `That was a lucky shot and everybody knows it. Run it back.`, effects: '++Popularity, −reputation, heats up the rivalry, sponsor risk' },
  ];
  if (p.isPro && !r.amateur) {
    // call out a rival or a top contender
    const targets = Object.entries(st.rivalries).filter(([id, v]) => v >= 30 && id !== r.opponentId && st.world.fighters[id] && !st.world.fighters[id].retired).map(([id]) => id);
    const top = rankings(st, p.orgId, p.divisionId).filter((x) => !x.isPlayer && x.id !== r.opponentId && !x.injured).slice(0, 3).map((x) => x.id);
    const t = targets[0] ?? top[0];
    if (t && won) out.push({ id: 'callout', label: `Call out ${nameOf(st, t).split(' ').slice(-1)[0]}`, quote: `${nameOf(st, t)}, I'm coming for you. Sign the contract.`, effects: '+Popularity, starts/heats a rivalry, makes that fight more likely', target: t });
    if (won && champ !== 'player' && champ) {
      const deserving = rank !== null && rank <= 3;
      out.push({ id: 'title', label: 'Demand a title shot', quote: `${nameOf(st, champ)}, your time is up. Give me the belt fight.`, effects: deserving ? 'Promoter considers you for the next title shot' : 'Bold for your ranking — may cost reputation', target: champ });
    }
  }
  return out;
}

export function applyInterview(st: GameState, r: FightResultSummary, id: string): string {
  if (r.interview) return 'Already interviewed.';
  const p = st.player;
  const o = interviewOptions(st, r).find((x) => x.id === id);
  if (!o) return 'Unknown answer.';
  const won = r.playerWon;
  const repW = 0.5 + p.reputation / 100; // established names are taken more seriously
  const tier = ORG[r.orgId].tier;
  const pop = (d: number) => (p.popularity = clamp(p.popularity + d * (d > 0 ? 1 - p.popularity / 120 : 1), 0, 100));
  const rep = (d: number) => (p.reputation = clamp(p.reputation + d, 0, 100));
  let msg = '';
  switch (id) {
    case 'respect':
      rep(1.5 + tier * 0.3);
      pop(0.5);
      if (st.rivalries[r.opponentId]) st.rivalries[r.opponentId] = Math.max(0, st.rivalries[r.opponentId] - 15);
      msg = 'Classy. Promoters and fans respect it.';
      break;
    case 'confident':
      if (won) { pop(1.5 * repW); rep(0.5); msg = 'The crowd loved the swagger.'; }
      else { pop(0.5); rep(p.reputation > 40 ? -0.5 : -1.5); msg = 'Some fans bought it. Others rolled their eyes.'; }
      break;
    case 'humor':
      pop(2 + (won ? 0.5 : 0));
      st.sponsorBuzz = Math.min(3, st.sponsorBuzz + 1);
      msg = 'The clip is going viral — brands have noticed.';
      break;
    case 'confront':
      pop(3 * repW);
      rep(-2);
      st.rivalries[r.opponentId] = clamp((st.rivalries[r.opponentId] ?? 0) + 25, 0, 100);
      st.promoterRelation = clamp(st.promoterRelation + 2, -50, 50);
      if (st.sponsors.some((d) => d.dropOnLosses)) { st.sponsorBuzz = Math.max(0, st.sponsorBuzz - 1); msg = 'Ticket sales love it. Your premium sponsors are less amused.'; }
      else msg = 'The press conference just got a lot more interesting.';
      break;
    case 'callout': {
      const t = o.target!;
      pop(2 * repW);
      st.rivalries[t] = clamp((st.rivalries[t] ?? 0) + 30, 0, 100);
      st.callout = t;
      addNews(st, { kind: 'player', title: `${p.lastName} calls out ${nameOf(st, t)}`, body: `After ${r.eventName}, ${p.firstName} ${p.lastName} demanded a fight with ${nameOf(st, t)}.`, refs: ['player', t], org: r.orgId, div: p.divisionId, imp: 2 });
      addTimeline(st, 'rival', `Called out ${nameOf(st, t)} after ${r.eventName}.`, t);
      msg = `The promoter heard you — a fight with ${nameOf(st, t)} is now more likely.`;
      break;
    }
    case 'title': {
      const rank = playerRank(st);
      if (rank !== null && rank <= 3) { st.titlePush = true; st.promoterRelation = clamp(st.promoterRelation + 3, -50, 50); pop(2); msg = 'The promoter says you are in the conversation for the next title shot.'; }
      else { pop(1); rep(-1.5); msg = 'Reporters pointed out your ranking. Bold, but premature.'; }
      break;
    }
  }
  r.interview = id;
  if (st.lastResult && st.lastResult.id === r.id) st.lastResult.interview = id;
  return msg;
}
