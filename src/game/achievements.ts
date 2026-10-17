import type { FightResultSummary, GameState, GoalId } from './types';
import { overallRating, categoryRatings } from './attributes';
import { inbox } from './core';
import { addTimeline } from './history';

export const ACHIEVEMENTS: { id: string; name: string; desc: string; test: (st: GameState, r?: FightResultSummary) => boolean }[] = [
  { id: 'first_win', name: 'First Blood', desc: 'Win your first fight.', test: (st) => st.player.record.w + st.player.amateurRecord.w >= 1 },
  { id: 'first_finish', name: 'Finisher', desc: 'Win by KO, TKO or submission.', test: (_s, r) => !!r && r.playerWon && ['KO', 'TKO', 'SUB'].includes(r.method) },
  { id: 'first_ko', name: 'Lights Out', desc: 'Win by knockout.', test: (_s, r) => !!r && r.playerWon && r.method === 'KO' },
  { id: 'first_sub', name: 'Tap Tap Tap', desc: 'Win by submission.', test: (_s, r) => !!r && r.playerWon && r.method === 'SUB' },
  { id: 'go_pro', name: 'Paid to Fight', desc: 'Turn professional.', test: (st) => st.player.isPro },
  { id: 'streak5', name: 'On a Tear', desc: 'Win five fights in a row.', test: (st) => st.player.streak >= 5 },
  { id: 'unbeaten10', name: 'Perfect Ten', desc: 'Start your pro career 10-0.', test: (st) => st.player.record.w >= 10 && st.player.record.l === 0 },
  { id: 'ranked', name: 'Contender', desc: 'Break into the top 5 of a promotion.', test: (st) => st.player.bestRank > 0 && st.player.bestRank <= 5 },
  { id: 'champion', name: 'Champion', desc: 'Win a championship.', test: (st) => st.player.titles.length > 0 },
  { id: 'defense', name: 'Defender', desc: 'Successfully defend a title.', test: (st) => st.player.titleDefenses >= 1 },
  { id: 'apex', name: 'The Big Show', desc: 'Sign with the Hexagon Fighting Championship.', test: (st) => st.player.orgId === 'acl' && st.player.isPro },
  { id: 'apex_champ', name: 'King of the Hexagon', desc: 'Become Hexagon Fighting Championship champion.', test: (st) => st.player.titles.some((t) => t.orgId === 'acl') },
  { id: 'double_champ', name: 'Champ-Champ', desc: 'Become an HFC double champion through a superfight.', test: (st) => (st.player.champStatus ?? 0) >= 1 },
  { id: 'triple_champ', name: 'Three-Belt Legend', desc: 'Become an HFC triple champion.', test: (st) => (st.player.champStatus ?? 0) >= 2 },
  { id: 'fotn', name: 'Crowd Pleaser', desc: 'Earn a Fight of the Night bonus.', test: (st) => st.player.fotn >= 1 },
  { id: 'comeback', name: 'Never Out', desc: 'Win after being knocked down.', test: (_s, r) => !!r && r.playerWon && r.stats.opp.knockdowns > 0 },
  { id: 'money100k', name: 'Six Figures', desc: 'Earn $100,000 in your career.', test: (st) => st.player.earningsTotal >= 100000 },
  { id: 'money1m', name: 'Millionaire', desc: 'Earn $1,000,000 in your career.', test: (st) => st.player.earningsTotal >= 1000000 },
  { id: 'rival', name: 'Settled the Score', desc: 'Beat a rival you have fought before.', test: (st, r) => !!r && r.playerWon && (st.world.fighters[r.opponentId]?.vsPlayer.length ?? 0) >= 2 },
  { id: 'ovr70', name: 'Elite Athlete', desc: 'Reach a 70 overall rating.', test: (st) => overallRating(st.player.attrs) >= 70 },
];

export function checkAchievements(st: GameState, r?: FightResultSummary) {
  for (const a of ACHIEVEMENTS) {
    if (st.achievements.some((x) => x.id === a.id)) continue;
    if (a.test(st, r)) {
      st.achievements.push({ id: a.id, day: st.day });
      inbox(st, 'news', `Achievement: ${a.name}`, a.desc);
      addTimeline(st, 'achievement', `Achievement unlocked: ${a.name} — ${a.desc}`);
    }
  }
}

export const GOALS: { id: GoalId; name: string; desc: string; progress: (st: GameState) => { value: number; label: string } }[] = [
  { id: 'champion', name: 'Become a Champion', desc: 'Win a title in any promotion — ideally the HFC belt.', progress: (st) => ({ value: st.player.titles.some((t) => t.orgId === 'acl') ? 1 : st.player.titles.length ? 0.6 : st.player.bestRank > 0 ? Math.max(0.1, 0.5 - st.player.bestRank * 0.04) : 0, label: st.player.titles.length ? `${st.player.titles.length} title(s)` : st.player.bestRank ? `Best rank #${st.player.bestRank}` : 'Unranked' }) },
  { id: 'undefeated', name: 'Stay Undefeated', desc: 'Build an unbeaten professional record.', progress: (st) => ({ value: st.player.record.l ? 0 : Math.min(1, st.player.record.w / 15), label: `${st.player.record.w}-${st.player.record.l} pro` }) },
  { id: 'ko_artist', name: 'Knockout Specialist', desc: 'Rack up 10 KO/TKO wins.', progress: (st) => ({ value: Math.min(1, (st.player.record.ko + st.player.record.tko) / 10), label: `${st.player.record.ko + st.player.record.tko}/10 KO/TKO` }) },
  { id: 'sub_artist', name: 'Submission Specialist', desc: 'Win 8 fights by submission.', progress: (st) => ({ value: Math.min(1, st.player.record.sub / 8), label: `${st.player.record.sub}/8 submissions` }) },
  { id: 'money', name: 'Get Paid', desc: 'Earn $2,000,000 across your career.', progress: (st) => ({ value: Math.min(1, st.player.earningsTotal / 2_000_000), label: `$${Math.round(st.player.earningsTotal).toLocaleString()}` }) },
  { id: 'allrounder', name: 'Legendary All-Rounder', desc: 'Reach 75+ in every skill category.', progress: (st) => { const c = categoryRatings(st.player.attrs); const min = Math.min(c.striking, c.wrestling, c.grappling, c.defense, c.conditioning); return { value: Math.min(1, min / 75), label: `Lowest category ${Math.round(min)}` }; } },
];
