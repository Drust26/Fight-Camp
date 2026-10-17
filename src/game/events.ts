// Data-driven random events. Each has a condition, generated params, and choices with real state effects.
import { RNG, clamp, uid } from './rng';
import { inbox, ledger, money, withRng } from './core';
import { fighterName, recStr } from './fighterGen';
import { makeOffer } from './fights';
import { addInjury } from './training';
import { playerRank, rankings } from './world';
import { turnPro } from './economy';
import { DIV, ORG, STYLE } from '../data/world';
import { SESSION } from '../data/training';
import { categoryRatings, CATEGORY_DEFS } from './attributes';
import type { GameState, OrgId, PendingEvent } from './types';

export interface Choice {
  label: string;
  hint: string;
  apply: (st: GameState, ev: PendingEvent, rng: RNG) => string;
  disabled?: (st: GameState, ev: PendingEvent) => string | null;
}
export interface EventTemplate {
  id: string;
  title: (st: GameState, ev: PendingEvent) => string;
  body: (st: GameState, ev: PendingEvent) => string;
  weight: number;
  cooldown: number; // days
  urgent?: boolean; // must decide before advancing more than a few days
  expires: number; // days until auto-resolved with choice 0 (or last if urgent)
  when: (st: GameState) => boolean;
  /** Tied to the currently booked fight: discarded if that fight happens, is cancelled or changes. */
  needsFight?: boolean;
  params?: (st: GameState, rng: RNG) => Record<string, any> | null;
  choices: Choice[];
}

const oppName = (st: GameState, id: string | undefined) => (id && st.world.fighters[id] ? fighterName(st.world.fighters[id]) : 'your opponent');
/** Opponent for fight-linked events (stored at roll time; older saves fall back to the current booking). */
const evOpp = (st: GameState, ev: PendingEvent): string | undefined => ev.params?.opp ?? st.scheduled?.opponentId;
const fightParams = (st: GameState) => (st.scheduled ? { opp: st.scheduled.opponentId, fight: st.scheduled.id } : null);
const pop = (st: GameState, d: number) => (st.player.popularity = clamp(st.player.popularity + d, 0, 100));
const attr = (st: GameState, k: keyof GameState['player']['attrs'], d: number) => (st.player.attrs[k] = clamp(st.player.attrs[k] + d, 1, 99));

export const EVENTS: EventTemplate[] = [
  {
    id: 'callout', weight: 3, cooldown: 60, expires: 5,
    when: (st) => st.player.isPro && !st.player.retired,
    params: (st, rng) => {
      const ranks = rankings(st, st.player.orgId, st.player.divisionId).filter((r) => !r.isPlayer && !r.injured);
      const my = playerRank(st) ?? 15;
      const near = ranks.filter((r) => Math.abs(r.rank - my) <= 4);
      if (!near.length) return null;
      return { opp: rng.pick(near).id };
    },
    title: (st, ev) => `${oppName(st, ev.params.opp)} calls you out`,
    body: (st, ev) => `In a post-fight interview, ${oppName(st, ev.params.opp)} said you "wouldn't last a round". Fans are buzzing. How do you respond?`,
    choices: [
      { label: 'Ignore it', hint: 'No change.', apply: () => 'You let your training do the talking.' },
      { label: 'Fire back on social media', hint: '+Popularity, +rivalry. Slight composure risk.', apply: (st, ev, rng) => {
        pop(st, 3); st.rivalries[ev.params.opp] = clamp((st.rivalries[ev.params.opp] ?? 0) + 30, 0, 100);
        if (rng.chance(0.3)) { attr(st, 'composure', -0.5); return 'Your reply went viral. The rivalry is ON — though it got under your skin a little.'; }
        return 'Your reply went viral. The rivalry is ON — a fight between you two would sell.';
      } },
      { label: 'Accept the challenge', hint: 'Request the fight. Next offer likely vs him.', disabled: (st) => (st.scheduled ? 'You already have a fight booked' : null), apply: (st, ev, rng) => {
        st.rivalries[ev.params.opp] = clamp((st.rivalries[ev.params.opp] ?? 0) + 35, 0, 100); pop(st, 2);
        const o = makeOffer(st, rng, { opponentId: ev.params.opp, note: 'Grudge match' });
        if (o) { st.offers.push(o); return 'The promoter jumped on it — a grudge-match offer is waiting in Fight Offers.'; }
        return 'The promoter likes it but couldn\'t make the date work yet.';
      } },
    ],
  },
  {
    id: 'coach_advice', weight: 3, cooldown: 45, expires: 4,
    when: (st) => !st.player.retired,
    params: (st) => {
      const c = categoryRatings(st.player.attrs);
      const weakest = CATEGORY_DEFS.filter((d) => d.id !== 'mental').sort((a, b) => c[a.id] - c[b.id])[0];
      return { cat: weakest.id, name: weakest.name };
    },
    title: () => 'Your coach pulls you aside',
    body: (_st, ev) => `"Your ${ev.params.name.toLowerCase()} is the hole in your game. Opponents will find it. I want two extra sessions a week on it."`,
    choices: [
      { label: 'Follow the advice', hint: 'Rewrites two weekly sessions toward your weakest area.', apply: (st, ev) => {
        const map: Record<string, string[]> = { striking: ['boxing', 'kickboxing'], wrestling: ['wrestling', 'tddef'], grappling: ['bjj', 'escapes'], defense: ['defstrike', 'tddef'], conditioning: ['aerobic', 'strength'] };
        const ss = map[ev.params.cat] ?? ['boxing', 'wrestling'];
        st.plan.days[1][1] = ss[0]; st.plan.days[3][1] = ss[1];
        attr(st, 'discipline', 0.5);
        return `Tuesday and Thursday evenings now: ${SESSION[ss[0]].name} and ${SESSION[ss[1]].name}.`;
      } },
      { label: 'Thanks, but I\'ll stick to my plan', hint: 'No change.', apply: () => 'Your coach shrugs. "Your call."' },
    ],
  },
  {
    id: 'journalist', weight: 3, cooldown: 30, expires: 3,
    when: (st) => !!st.scheduled && !st.scheduled.amateur,
    needsFight: true,
    params: fightParams,
    title: () => 'Media request',
    body: (st, ev) => `A journalist wants a sit-down interview about your fight with ${oppName(st, evOpp(st, ev))}.`,
    choices: [
      { label: 'Respectful interview', hint: '+Reputation, +small popularity.', apply: (st) => { st.player.reputation = clamp(st.player.reputation + 1.5, 0, 100); pop(st, 1); return 'Measured, professional. Promoters noticed.'; } },
      { label: 'Hype it up', hint: '++Popularity, +rivalry, −reputation.', apply: (st, ev) => { pop(st, 3.5); st.player.reputation = clamp(st.player.reputation - 1, 0, 100); const id = evOpp(st, ev); if (id) st.rivalries[id] = clamp((st.rivalries[id] ?? 0) + 15, 0, 100); return 'Your trash talk is everywhere. Ticket sales are up.'; } },
      { label: 'Decline — focus on camp', hint: '+Opponent prep, nothing else.', apply: (st) => { if (st.scheduled) st.scheduled.prep = clamp(st.scheduled.prep + 5, 0, 100); return 'You spent the time studying tape instead.'; } },
    ],
  },
  {
    id: 'shortnotice', weight: 2, cooldown: 50, expires: 2, urgent: true,
    when: (st) => st.player.isPro && !st.scheduled && !!st.player.contract && st.player.medicalSuspensionUntil < st.day + 10 && !st.player.retired,
    params: (st, rng) => {
      const o = makeOffer(st, rng, { shortNotice: true, note: 'Short-notice replacement' });
      if (!o) return null;
      return { offer: o };
    },
    title: () => 'Short-notice fight!',
    body: (st, ev) => {
      const o = ev.params.offer; const f = st.world.fighters[o.opponentId];
      return `A fighter withdrew injured. ${ORG[o.orgId as OrgId].short} offers you ${f ? fighterName(f) + ' (' + recStr(f.rec) + ', ' + STYLE[f.style].name + ')' : 'a replacement bout'} in ${o.day - st.day} days — ${money(o.purse)} + ${money(o.winBonus)} (40% above your usual pay). Almost no camp, and you'll have to cut weight fast.`;
    },
    choices: [
      { label: 'Decline', hint: 'Small promoter disappointment.', apply: (st) => { st.promoterRelation = clamp(st.promoterRelation - 1, -50, 50); return 'You passed. Someone else took it.'; } },
      { label: 'Accept', hint: 'More money and exposure, little preparation.', disabled: (st) => (st.scheduled ? 'Already booked' : null), apply: (st, ev) => {
        const o = { ...ev.params.offer, expiresDay: st.day + 3 };
        st.offers = [o];
        st.promoterRelation = clamp(st.promoterRelation + 6, -50, 50); pop(st, 2);
        return 'You said yes. The offer is in Fight Offers — confirm it and pick your camp.';
      } },
    ],
  },
  {
    id: 'partner_intel', weight: 2, cooldown: 60, expires: 4,
    when: (st) => !!st.scheduled,
    needsFight: true,
    params: fightParams,
    title: () => 'A training partner has inside info',
    body: (st, ev) => `A new guy at the gym used to train with ${oppName(st, evOpp(st, ev))}. He offers to walk you through his habits over a few sparring rounds.`,
    choices: [
      { label: 'Spar with him', hint: '+20% opponent prep, some fatigue, small injury risk.', apply: (st, _ev, rng) => {
        if (st.scheduled) st.scheduled.prep = clamp(st.scheduled.prep + 20, 0, 100); st.player.fatigue = clamp(st.player.fatigue + 12, 0, 100);
        if (rng.chance(0.08)) { addInjury(st, rng, 'swelling', 1, 'Sparring'); return 'Great intel — and a black eye to remember it by.'; }
        return 'You now know exactly what he likes to do when he\'s hurt.';
      } },
      { label: 'Just talk', hint: '+8% prep, no risk.', apply: (st) => { if (st.scheduled) st.scheduled.prep = clamp(st.scheduled.prep + 8, 0, 100); return 'A useful conversation over coffee.'; } },
    ],
  },
  {
    id: 'gym_dispute', weight: 1.5, cooldown: 120, expires: 4,
    when: (st) => st.player.sessionsDone > 20,
    title: () => 'Trouble in the gym',
    body: () => 'Two teammates are feuding and the head coach wants you to pick a side in front of everyone.',
    choices: [
      { label: 'Back the coach', hint: '+Discipline. Lose a sparring partner (fatigue).', apply: (st) => { attr(st, 'discipline', 1); st.player.fatigue = clamp(st.player.fatigue + 5, 0, 100); return 'Order restored. The gym is quieter — and short one hard sparring partner.'; } },
      { label: 'Mediate', hint: '+Composure, costs a day of training (fatigue relief).', apply: (st) => { attr(st, 'composure', 0.8); st.player.fatigue = clamp(st.player.fatigue - 10, 0, 100); st.player.sharpness = clamp(st.player.sharpness - 5, 0, 100); return 'You spent the day talking them down. Everyone respects you more.'; } },
      { label: 'Stay out of it', hint: 'No effect.', apply: () => 'Not your fight.' },
    ],
  },
  {
    id: 'rematch', weight: 2, cooldown: 90, expires: 5,
    when: (st) => st.player.isPro && !st.scheduled && st.player.history.some((h) => !h.amateur && h.result !== 'W' && st.world.fighters[h.opponentId] && !st.world.fighters[h.opponentId].retired && st.world.fighters[h.opponentId].org === st.player.orgId),
    params: (st) => {
      const h = st.player.history.find((x) => !x.amateur && x.result !== 'W' && st.world.fighters[x.opponentId] && !st.world.fighters[x.opponentId].retired && st.world.fighters[x.opponentId].org === st.player.orgId);
      return h ? { opp: h.opponentId } : null;
    },
    title: (st, ev) => `Rematch with ${oppName(st, ev.params.opp)}?`,
    body: (st, ev) => `${oppName(st, ev.params.opp)} beat you before. The promoter thinks a rematch would sell. Do you want it?`,
    choices: [
      { label: 'Run it back', hint: 'Rematch offer; he remembers some of your habits.', apply: (st, ev, rng) => { st.rivalries[ev.params.opp] = clamp((st.rivalries[ev.params.opp] ?? 0) + 20, 0, 100); const o = makeOffer(st, rng, { opponentId: ev.params.opp, note: 'Rematch' }); if (o) { st.offers.push(o); return 'Rematch offer added to Fight Offers.'; } return 'Couldn\'t line up the date.'; } },
      { label: 'Not now', hint: 'No effect.', apply: () => 'Maybe another time.' },
    ],
  },
  {
    id: 'champ_injured', weight: 2, cooldown: 120, expires: 3,
    when: (st) => {
      const champ = st.world.orgs[st.player.orgId]?.champions[st.player.divisionId];
      const r = playerRank(st);
      return st.player.isPro && !!champ && champ !== 'player' && r !== null && r <= 5 && !st.scheduled;
    },
    title: () => 'The champion is hurt',
    body: (st) => `${ORG[st.player.orgId].short}'s ${DIV[st.player.divisionId].name} champion is out for months. The promoter is considering an interim title fight between top contenders — your name is on the list.`,
    choices: [
      { label: 'Campaign for the interim shot', hint: 'Interim-title offer vs a top contender (5 rounds).', apply: (st, _ev, rng) => {
        const champId = st.world.orgs[st.player.orgId].champions[st.player.divisionId]!;
        const champ = st.world.fighters[champId];
        if (champ) champ.injuredUntil = st.day + 150;
        st.world.orgs[st.player.orgId].champions[st.player.divisionId] = null;
        const top = rankings(st, st.player.orgId, st.player.divisionId).filter((r) => !r.isPlayer && !r.injured && !r.champion)[0];
        const o = top ? makeOffer(st, rng, { title: true, opponentId: top.id, note: 'For the interim/vacant title' }) : null;
        if (o) { st.offers.push(o); pop(st, 2); return 'You got it. A title fight offer is waiting.'; }
        return 'The promoter went another direction.';
      } },
      { label: 'Wait for the real champion', hint: '+Reputation.', apply: (st) => { st.player.reputation = clamp(st.player.reputation + 2, 0, 100); return '"I want the man, not a placeholder belt." Respect.'; } },
    ],
  },
  {
    id: 'charity', weight: 1.5, cooldown: 90, expires: 4,
    when: (st) => st.player.popularity > 10,
    title: () => 'Charity event invitation',
    body: () => 'A children\'s hospital asks you to appear at a fundraiser this weekend.',
    choices: [
      { label: 'Attend', hint: '+Popularity, +reputation, $150 travel.', apply: (st) => { pop(st, 2.5); st.player.reputation = clamp(st.player.reputation + 1, 0, 100); ledger(st, -150, 'Charity event travel', 'other'); return 'The photos went everywhere. Good human, good business.'; } },
      { label: 'Decline', hint: 'No effect.', apply: () => 'You sent a signed glove instead.' },
    ],
  },
  {
    id: 'loan', weight: 1, cooldown: 200, expires: 4,
    when: (st) => st.player.money > 1500,
    title: () => 'An old friend needs money',
    body: () => 'A childhood friend is behind on rent and asks to borrow $500.',
    choices: [
      { label: 'Lend $500', hint: 'Might come back. Good for the soul.', apply: (st, _ev, rng) => { ledger(st, -500, 'Loan to a friend', 'other'); attr(st, 'composure', 0.5); if (rng.chance(0.6)) st.pending.push({ id: uid(rng, 'e'), templateId: 'loan_back', day: st.day + 40, params: {} }); return 'He was grateful.'; } },
      { label: 'Refuse', hint: 'Keep your money.', apply: () => 'Awkward, but rent is due for you too.' },
    ],
  },
  {
    id: 'loan_back', weight: 0, cooldown: 0, expires: 10,
    when: () => false,
    title: () => 'Your friend paid you back',
    body: () => 'Your friend got a job and returned the $500 — with a little extra.',
    choices: [{ label: 'Nice', hint: '+$600', apply: (st) => { ledger(st, 600, 'Loan repaid', 'other'); return '+$600.'; } }],
  },
  {
    id: 'supplement', weight: 1, cooldown: 300, expires: 4,
    when: (st) => st.player.isPro,
    title: () => 'A "miracle" supplement',
    body: () => 'A guy at the gym swears by an untested recovery supplement. "Totally legal. Probably."',
    choices: [
      { label: 'Refuse', hint: '+Discipline.', apply: (st) => { attr(st, 'discipline', 1); return 'You stick to clean food and sleep.'; } },
      { label: 'Try it', hint: 'Faster recovery for a while… if it\'s clean.', apply: (st, _ev, rng) => {
        if (rng.chance(0.35)) { st.player.medicalSuspensionUntil = Math.max(st.player.medicalSuspensionUntil, st.day + 90); pop(st, -8); st.player.reputation = clamp(st.player.reputation - 10, 0, 100); if (st.scheduled) { const o = st.world.fighters[st.scheduled.opponentId]; if (o) o.bookedUntil = st.day; st.scheduled = null; } inbox(st, 'news', 'FAILED DRUG TEST', 'A random test flagged a banned substance. 90-day suspension; any booked fight is cancelled.'); return 'It was not clean. You failed a random test: 90-day suspension.'; }
        attr(st, 'recovery', 1.5); return 'You feel great. Recovery noticeably better.';
      } },
    ],
  },
  {
    id: 'seminar', weight: 1.5, cooldown: 90, expires: 4,
    when: (st) => st.player.popularity > 18,
    title: () => 'Seminar invitation',
    body: () => 'A gym two states over wants you to teach a weekend seminar.',
    choices: [
      { label: 'Teach it', hint: '+$1,200, +popularity, lose some sharpness.', apply: (st) => { ledger(st, 1200, 'Seminar fee', 'other'); pop(st, 1.5); st.player.sharpness = clamp(st.player.sharpness - 10, 0, 100); return 'Good money and new fans.'; } },
      { label: 'Stay and train', hint: 'No effect.', apply: () => 'Camp comes first.' },
    ],
  },
  {
    id: 'prospect_spar', weight: 1.5, cooldown: 70, expires: 3,
    when: (st) => st.player.sessionsDone > 10,
    title: () => 'A hungry prospect wants to spar',
    body: () => 'A young undefeated prospect visiting your gym asks you for a few hard rounds.',
    choices: [
      { label: 'Spar hard', hint: '+Experience, +composure, fatigue, injury risk.', apply: (st, _ev, rng) => { attr(st, 'experience', 0.8); attr(st, 'composure', 0.5); st.player.fatigue = clamp(st.player.fatigue + 15, 0, 100); if (rng.chance(0.12)) { const i = addInjury(st, rng, rng.pick(['cut', 'hand', 'ribs']), 1, 'Prospect sparring'); return `Great work — but you picked up a ${i.type}.`; } return 'He pushed you. You pushed back harder.'; } },
      { label: 'Keep it technical', hint: '+Fight IQ, safe.', apply: (st) => { attr(st, 'fightIQ', 0.4); return 'Light, technical rounds. You picked up a trick or two.'; } },
      { label: 'Pass', hint: 'No effect.', apply: () => 'Not today, kid.' },
    ],
  },
  {
    id: 'turnpro', weight: 0, cooldown: 0, expires: 30,
    when: () => false,
    title: () => 'Time to turn pro?',
    body: (st) => `With an amateur record of ${st.player.amateurRecord.w}-${st.player.amateurRecord.l}, the IFC offers you a professional contract: 3 fights at ${money(ORG.ifc.purse)}/${money(ORG.ifc.winBonus)}. More amateur bouts build experience safely; going pro starts the real climb.`,
    choices: [
      { label: 'Stay amateur for now', hint: 'You can turn pro later from Contracts.', apply: () => 'You\'ll keep sharpening in the amateurs.' },
      { label: 'Turn professional', hint: 'Pro record, purses, rankings.', disabled: (st) => (st.scheduled ? 'Finish your booked bout first' : null), apply: (st) => turnPro(st) ?? 'Welcome to the professional ranks.' },
    ],
  },
  {
    id: 'retire_talk', weight: 1, cooldown: 365, expires: 6,
    when: (st) => st.player.wear > 75 || (st.day - st.player.bornDay) / 365 > 37,
    title: () => 'Your team wants to talk about the future',
    body: () => 'Your doctor and coach are worried about the damage you\'ve taken over the years. They gently suggest thinking about retirement.',
    choices: [
      { label: 'I\'ve got more in me', hint: 'Continue your career.', apply: () => 'They respect your decision — but they\'ll keep watching.' },
      { label: 'Plan a farewell fight', hint: '+Popularity. Retire from the hub whenever ready.', apply: (st) => { pop(st, 4); return 'The fans want one more. You can retire from Settings → Career whenever you choose.'; } },
    ],
  },
];
export const EVENT: Record<string, EventTemplate> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function rollEvents(st: GameState, rng: RNG) {
  if (st.player.retired) return;
  // scheduled future events (e.g. loan repaid)
  if (st.pending.length >= 2 || !rng.chance(0.075)) return;
  const avail = EVENTS.filter((e) => e.weight > 0 && (st.eventCooldowns[e.id] ?? -999) <= st.day && e.when(st) && !st.pending.some((p) => p.templateId === e.id));
  if (!avail.length) return;
  const t = rng.weighted(avail, (e) => e.weight);
  const params = t.params ? t.params(st, rng) : {};
  if (params === null) return;
  st.pending.push({ id: uid(rng, 'e'), templateId: t.id, day: st.day, params });
  st.eventCooldowns[t.id] = st.day + t.cooldown;
  inbox(st, 'event', t.title(st, st.pending[st.pending.length - 1]), 'A decision is waiting for you.');
}

/** False when an event can no longer be shown or applied (unknown template, or its fight is gone). */
export function eventStillValid(st: GameState, ev: PendingEvent): boolean {
  const t = EVENT[ev.templateId];
  if (!t) return false;
  if (t.needsFight) {
    if (!st.scheduled) return false;
    if (ev.params?.fight && ev.params.fight !== st.scheduled.id) return false;
  }
  return true;
}

/** Drop events that no longer make sense (e.g. pre-fight media requests after the fight). */
export function pruneEvents(st: GameState) {
  st.pending = (st.pending ?? []).filter((ev) => eventStillValid(st, ev));
}

/** Visible events are those whose day has arrived. */
export function activeEvents(st: GameState) {
  return st.pending.filter((p) => p.day <= st.day && eventStillValid(st, p));
}

export function resolveEvent(st: GameState, evId: string, choiceIdx: number): string {
  const ev = st.pending.find((p) => p.id === evId);
  if (!ev) return 'Event no longer available.';
  const t = EVENT[ev.templateId];
  if (!eventStillValid(st, ev)) { st.pending = st.pending.filter((p) => p.id !== evId); return 'That situation has passed.'; }
  const c = t.choices[choiceIdx];
  if (!c) return 'Invalid choice.';
  const dis = c.disabled?.(st, ev);
  if (dis) return dis;
  st.pending = st.pending.filter((p) => p.id !== evId);
  const msg = withRng(st, (rng) => c.apply(st, ev, rng));
  inbox(st, 'event', `${t.title(st, ev)} — ${c.label}`, msg);
  return msg;
}

/** Events nobody answered resolve with their first (safe/default) choice. */
export function expireEvents(st: GameState) {
  pruneEvents(st);
  for (const ev of [...st.pending]) {
    const t = EVENT[ev.templateId];
    if (ev.day <= st.day && st.day - ev.day >= t.expires) resolveEvent(st, ev.id, 0);
  }
}
