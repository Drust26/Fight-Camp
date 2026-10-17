// Ring announcer & referee: introductions and post-fight announcements built from real data.
import { DIV, ORG } from '../data/world';
import { badgeFor } from '../data/nations';
import { recStr } from './fighterGen';
import type { FightResultSummary, GameState, ScheduledFight } from './types';

const REFEREES = ['Dan Kessler', 'Maria Okonkwo', 'Tomas Rehn', 'Grace Whitford', 'Luis Abrantes', 'Kenji Moriyama', 'Pete Sollano', 'Ana Vukovic'];
const JUDGES = ['Ortiz', 'Lindgren', 'Abara'];

export function refereeFor(sc: { id: string }) {
  let h = 0;
  for (let i = 0; i < sc.id.length; i++) h = (h * 31 + sc.id.charCodeAt(i)) >>> 0;
  return REFEREES[h % REFEREES.length];
}

export interface Intro { lines: string[]; blue: string[]; red: string[]; champion: 'player' | 'opponent' | null }

export function introLines(st: GameState, sc: ScheduledFight): Intro {
  const p = st.player;
  const opp = st.world.fighters[sc.opponentId];
  const fdiv = sc.div ?? p.divisionId;
  const champ = sc.title ? st.world.orgs[sc.orgId].champions[fdiv] : null;
  const champion = champ === 'player' ? 'player' : champ === sc.opponentId ? 'opponent' : null;
  const slot = sc.card?.find((c) => c.player)?.slot ?? 'prelim';
  const div = DIV[fdiv];
  const lines: string[] = [];
  lines.push(slot === 'mainevent' ? `Ladies and gentlemen… it is time for the MAIN EVENT of ${sc.eventName}!` : `Ladies and gentlemen, this is ${slot === 'comain' ? 'the co-main event' : slot === 'main' ? 'a main card bout' : 'a preliminary bout'} of ${sc.eventName}.`);
  lines.push(sc.title
    ? `Five rounds, for the ${ORG[sc.orgId].name} ${div.name} Championship of the world!`
    : `${sc.rounds} rounds in the ${div.name.toLowerCase()} division${sc.amateur ? ' — amateur rules' : ''}.`);
  if (sc.superfight) lines.push(`This is a SUPERFIGHT — champion versus champion! The ${ORG[sc.orgId].short} ${DIV[p.divisionId].name} titleholder moves to ${div.name.toLowerCase()} for a second belt.`);
  lines.push(`Your referee in charge: ${refereeFor(sc)}.`);
  if ((st.rivalries[sc.opponentId] ?? 0) >= 30 && opp.vsPlayer.length) lines.push(`These two have met ${opp.vsPlayer.length === 1 ? 'once' : `${opp.vsPlayer.length} times`} before — and there is bad blood.`);
  const intro = (who: 'player' | 'opponent', corner: 'blue' | 'red') => {
    const isP = who === 'player';
    const name = isP ? `${p.firstName} ${p.lastName}` : `${opp.first} ${opp.last}`;
    const nick = isP ? p.nickname : opp.nick;
    const h = isP ? p.heightCm : opp.h;
    const rec = isP ? recStr(sc.amateur ? p.amateurRecord : p.record) : recStr(opp.rec);
    const nat = isP ? p.nationality : opp.nat;
    const out = [`Fighting out of the ${corner} corner…`, `Standing ${h} centimetres, with a ${sc.amateur ? '' : 'professional '}record of ${rec}…`, `Representing ${nat} (${badgeFor(nat).code})…`];
    if ((isP && champion === 'player') || (!isP && champion === 'opponent')) out.push(`He is the reigning, defending ${ORG[sc.orgId].short} ${div.name} champion of the world!`);
    else if (isP && sc.superfight) out.push(`He is the reigning ${ORG[sc.orgId].short} ${DIV[p.divisionId].name} champion of the world!`);
    if (isP && (p.champStatus ?? 0) > 0) out.push(`The ${ORG[sc.orgId].short} ${p.champStatus === 2 ? 'TRIPLE' : 'DOUBLE'} CHAMPION!`);
    out.push(nick ? `${name.split(' ')[0]}… "${nick.toUpperCase()}"… ${name.split(' ').slice(1).join(' ').toUpperCase()}!` : `${name.toUpperCase()}!`);
    return out;
  };
  // champion is introduced last; otherwise the player (red corner)
  const playerLast = champion !== 'opponent';
  return { lines, blue: intro(playerLast ? 'opponent' : 'player', 'blue'), red: intro(playerLast ? 'player' : 'opponent', 'red'), champion };
}

export function postFightLines(st: GameState, sc: { id: string; title: boolean; orgId: string }, r: FightResultSummary): string[] {
  const p = st.player;
  const winner = r.playerWon ? `${p.firstName} ${p.lastName}` : r.draw ? '' : r.opponentName;
  const out: string[] = [];
  const isDec = ['UD', 'SD', 'MD', 'DRAW'].includes(r.method);
  if (isDec) {
    out.push('Ladies and gentlemen, we go to the judges’ scorecards.');
    r.scorecards.forEach((c, i) => {
      const hi = Math.max(c[0], c[1]), lo = Math.min(c[0], c[1]);
      out.push(c[0] === c[1] ? `Judge ${JUDGES[i]} scores it ${hi}–${lo}, a draw.` : `Judge ${JUDGES[i]} scores it ${hi}–${lo}…`);
    });
    if (r.draw) out.push('This bout is declared a DRAW!');
    else out.push(`…for the winner, by ${r.method === 'UD' ? 'unanimous' : r.method === 'SD' ? 'split' : 'majority'} decision…`);
  } else {
    const how = r.method === 'SUB' ? 'by submission' : r.method === 'KO' ? 'by knockout' : 'by technical knockout';
    out.push(`Referee ${refereeFor(sc)} calls a stop to this contest at ${r.time} of round ${r.round}.`);
    out.push(`Your winner, ${how}…`);
  }
  if (r.wonTitle && r.superfight) out.push(`AND THE NEW ${ORG[sc.orgId as keyof typeof ORG].short} ${(st.player.champStatus ?? 1) === 2 ? 'TRIPLE' : 'DOUBLE'} CHAMPION OF THE WORLD…`);
  else if (r.wonTitle) out.push(`AND NEW ${ORG[sc.orgId as keyof typeof ORG].short} CHAMPION OF THE WORLD…`);
  else if (r.title && !r.lostTitle && r.playerWon) out.push('AND STILL…');
  else if (r.title && !r.playerWon && !r.draw && !r.lostTitle) out.push('AND STILL…');
  else if (r.lostTitle) out.push(`AND NEW ${ORG[sc.orgId as keyof typeof ORG].short} CHAMPION OF THE WORLD…`);
  if (winner) out.push(`${winner.toUpperCase()}!`);
  return out;
}
