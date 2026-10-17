// Event-driven commentary. Lines are built from the actual fight state and career data, with
// priorities, cooldowns, per-template no-repeat tracking and consistency checks (e.g. it only calls a
// round "dominant" when the round really is lopsided).
import { roundImpact, type FightEvent, type FightState } from '../combat/engine';
import { SUB_NAME, POS_NAME } from '../combat/engine';
import { DIV, ORG, STYLE } from '../data/world';
import { rankings } from './world';
import { recStr } from './fighterGen';
import { ovrOf } from './history';
import type { GameState } from './types';

export interface CommentaryContext {
  pName: string; oName: string; // surnames
  pFull: string; oFull: string;
  title: boolean; orgShort: string; divName: string; eventName: string;
  pRec: string; oRec: string;
  pRank: number | null; oRank: number | null; champion: 'player' | 'opponent' | null;
  rivalry: number; previous: { result: 'W' | 'L' | 'D'; method: string }[]; // from the opponent's perspective
  pLayoff: number; oLayoff: number; // days since last fight
  ovrGap: number; // opponent overall − player overall
  pFinishes: number; oFinishes: number; oStyle: string;
  milestone?: string;
}

interface Line { text: string; prio: number }

export class Commentator {
  ctx: CommentaryContext;
  used = new Set<string>();
  lastAt = -99;
  catAt: Record<string, number> = {};
  noted = new Set<string>(); // once-per-fight observations
  lines: string[] = [];
  constructor(ctx: CommentaryContext) { this.ctx = ctx; }

  private name(i: number) { return i === 0 ? this.ctx.pName : this.ctx.oName; }
  private pick(key: string, opts: string[]): string | null {
    const fresh = opts.map((t, i) => [`${key}:${i}`, t] as const).filter(([k]) => !this.used.has(k));
    const pool = fresh.length ? fresh : opts.map((t, i) => [`${key}:${i}`, t] as const);
    const [k, t] = pool[Math.floor(Math.random() * pool.length)];
    this.used.add(k);
    return t;
  }
  private emit(s: FightState, cat: string, prio: number, text: string | null, catGap = 8): string | null {
    if (!text) return null;
    if (prio < 4) {
      if (s.t - this.lastAt < (prio >= 3 ? 1.5 : 4)) return null;
      if (s.t - (this.catAt[cat] ?? -99) < catGap) return null;
    }
    this.lastAt = s.t;
    this.catAt[cat] = s.t;
    this.lines.push(text);
    if (this.lines.length > 60) this.lines.shift();
    return text;
  }

  /** Pre-fight context lines (shown during the intro countdown). */
  opening(s: FightState): string[] {
    const c = this.ctx, out: string[] = [];
    if (c.title) out.push(c.champion === 'player' ? `${c.pName} puts the ${c.orgShort} ${c.divName} title on the line tonight.` : c.champion === 'opponent' ? `${c.oName} defends the ${c.orgShort} belt against ${c.pName}.` : `The vacant ${c.orgShort} ${c.divName} title is up for grabs.`);
    if (c.previous.length) {
      const last = c.previous[c.previous.length - 1];
      out.push(last.result === 'W' ? `${c.oName} beat ${c.pName} by ${last.method} last time. Revenge is on the menu.` : last.result === 'L' ? `${c.pName} won their last meeting by ${last.method}. Can ${c.oName} even the score?` : 'Their last fight was a draw. Somebody settles it tonight.');
    } else if (c.rivalry >= 30) out.push('There is real animosity between these two.');
    if (c.oLayoff > 300) out.push(`${c.oName} hasn't fought in ${Math.round(c.oLayoff / 30)} months. Ring rust could be a factor.`);
    if (c.pLayoff > 300) out.push(`${c.pName} returns after ${Math.round(c.pLayoff / 30)} months away.`);
    if (c.ovrGap >= 6) out.push(`On paper ${c.pName} is the underdog here.`);
    else if (c.ovrGap <= -6) out.push(`${c.pName} comes in as a clear favourite.`);
    if (c.oRank && c.pRank) out.push(`${c.pRank === 0 ? 'The champion' : `#${c.pRank}`} against ${c.oRank === 0 ? 'the champion' : `#${c.oRank}`} — rankings on the line.`);
    if (c.oFinishes >= 5) out.push(`${c.oName} has finished ${c.oFinishes} opponents. A ${c.oStyle.toLowerCase()} — be careful.`);
    if (c.milestone) out.push(c.milestone);
    for (const l of out) this.lines.push(l);
    return out.slice(0, 4);
  }

  roundStart(s: FightState): string | null {
    if (s.round === 1) return null;
    const imp = (i: number) => s.f[i].rounds.slice(0, s.round - 1).reduce((a, r) => a + roundImpact(r, { ws: 1, wg: 1 }), 0);
    const p = imp(0), o = imp(1);
    const last = s.round === s.cfg.rounds;
    let t: string;
    if (last) t = Math.abs(p - o) < 10 ? `Final round, and this one is razor close.` : `Final round. ${p < o ? this.ctx.pName : this.ctx.oName} probably needs something big.`;
    else t = p > o * 1.4 ? `Round ${s.round}: ${this.ctx.pName} has the early edge.` : o > p * 1.4 ? `Round ${s.round}: ${this.ctx.oName} has controlled this fight so far.` : `Round ${s.round}: hard to separate them.`;
    return this.emit(s, 'round', 4, t);
  }

  onEvent(e: FightEvent, s: FightState): string | null {
    const n = e.i >= 0 ? this.name(e.i) : '';
    const o = e.i >= 0 ? this.name(1 - e.i) : '';
    switch (e.type) {
      case 'ko': return this.emit(s, 'finish', 5, this.pick('ko', [`IT'S ALL OVER! ${n} puts ${o} out!`, `${n} lands — and ${o} is out cold!`, `Lights out! ${n} with a devastating finish!`]));
      case 'tap': return this.emit(s, 'finish', 5, this.pick('tap', [`HE TAPS! ${n} gets the submission!`, `${o} has to tap — ${n} finishes it on the mat!`]));
      case 'kd': return this.emit(s, 'kd', 4, this.pick('kd', [`DOWN GOES ${o.toUpperCase()}! ${n} drops him!`, `${n} puts ${o} on the canvas!`, `Knockdown! ${o} is in serious trouble!`]));
      case 'stun': return this.emit(s, 'hurt', 3, this.pick('stun', [`${n} is hurt! He's wobbling!`, `That one rocked ${n}!`, `${n}'s legs are gone for a moment!`]), 6);
      case 'sub': {
        const kind = s.sub ? SUB_NAME[s.sub.kind] : 'submission';
        return this.emit(s, 'sub', 4, this.pick('sub', [`${n} has locked up a ${kind.toLowerCase()}! ${o} is in danger!`, `${kind} attempt by ${n} — this is tight!`]));
      }
      case 'subescape': return this.emit(s, 'sub', 3, this.pick('subesc', [`${n} survives! What a escape!`.replace('a escape', 'an escape'), `${n} fights his way out of it!`]), 4);
      case 'td': return this.emit(s, 'td', 2, this.pick('td', [`${n} changes levels and takes it down.`, `Takedown, ${n}. Now he goes to work on top.`, `${n} drags ${o} to the mat.`]));
      case 'tdfail': return this.emit(s, 'tdd', 2, this.pick('tdd', [`Excellent takedown defence by ${n}.`, `${n} stuffs that shot.`]));
      case 'pos': if (!e.big) return null; return this.emit(s, 'pos', 2, this.pick('pos', [`${n} moves to ${POS_NAME[s.pos].toLowerCase()} — a dominant position.`, `${POS_NAME[s.pos]} for ${n}. Dangerous spot for ${o}.`]));
      case 'counter': if (!e.big) return null; return this.emit(s, 'counter', 2, this.pick('counter', [`Beautiful counter from ${n}!`, `${n} makes him pay for that miss!`]));
      case 'hit': if (!e.big) return null; return this.emit(s, 'big', 1, this.pick('big', [`Big shot from ${n}!`, `${n} lands clean!`, `That one landed flush for ${n}.`]), 10);
      case 'check': return this.emit(s, 'check', 1, this.pick('check', [`${n} checks the leg kick — that hurts the kicker.`]), 20);
    }
    return null;
  }

  /** Periodic observations from the live state (called ~2×/s). */
  tick(s: FightState): string | null {
    if (s.phase !== 'live' || s.t - this.lastAt < 9) return null;
    for (let i = 0; i < 2; i++) {
      const f = s.f[i], n = this.name(i);
      const key = (k: string) => `${k}${i}r${s.round}`;
      if (f.stamina < 22 && !this.noted.has(key('gas'))) { this.noted.add(key('gas')); return this.emit(s, 'obs', 2, `${n} is breathing heavily. The pace is catching up with him.`); }
      if (f.legs > 60 && !this.noted.has(`legs${i}`)) { this.noted.add(`legs${i}`); return this.emit(s, 'obs', 2, `${n}'s lead leg is badly compromised.`); }
      if (f.body > 60 && !this.noted.has(`body${i}`)) { this.noted.add(`body${i}`); return this.emit(s, 'obs', 2, `The body work is adding up on ${n}.`); }
    }
    const r = s.round - 1;
    const a = s.f[0].rounds[r], b = s.f[1].rounds[r];
    if (a && b && s.roundT > s.cfg.roundSeconds * 0.6 && !this.noted.has(`mom${s.round}`)) {
      const ia = roundImpact(a, { ws: 1, wg: 1 }), ib = roundImpact(b, { ws: 1, wg: 1 });
      if (ia + ib > 15) {
        this.noted.add(`mom${s.round}`);
        if (ia > ib * 2) return this.emit(s, 'obs', 2, `A dominant round for ${this.ctx.pName} so far.`);
        if (ib > ia * 2) return this.emit(s, 'obs', 2, `${this.ctx.oName} is running away with this round.`);
        return this.emit(s, 'obs', 1, 'Close round. The judges will have work to do.');
      }
    }
    return null;
  }

  /** Closing line once the outcome is known (consistent with the result). */
  closing(s: FightState): string | null {
    const out = s.outcome;
    if (!out) return null;
    const c = this.ctx;
    if (out.winner === -1) return this.emit(s, 'end', 5, 'A draw. Neither man could find the edge.');
    const winnerIsPlayer = out.winner === 0;
    const upset = winnerIsPlayer ? c.ovrGap >= 6 : c.ovrGap <= -6;
    const w = winnerIsPlayer ? c.pName : c.oName;
    if (c.title) return this.emit(s, 'end', 5, winnerIsPlayer && c.champion !== 'player' ? `${w} is on top of the ${c.orgShort} mountain!` : `${w} leaves with the ${c.orgShort} gold.`);
    if (upset) return this.emit(s, 'end', 5, `What an upset! ${w} defies the odds!`);
    if (c.previous.length) return this.emit(s, 'end', 5, `${w} wins chapter ${c.previous.length + 1} of this rivalry.`);
    return this.emit(s, 'end', 5, `${w} gets the job done.`);
  }
}

/** Build the commentary context for the player's booked fight from real career data. */
export function careerCommentaryContext(st: GameState): CommentaryContext | null {
  const sc = st.scheduled;
  if (!sc) return null;
  const p = st.player;
  const o = st.world.fighters[sc.opponentId];
  if (!o) return null;
  const rows = sc.amateur ? [] : rankings(st, sc.orgId, sc.div ?? p.divisionId);
  const rk = (id: string) => { const r = rows.find((x) => (id === 'player' ? x.isPlayer : x.id === id)); return r ? (r.champion ? 0 : r.rank) : null; };
  const champ = sc.title ? st.world.orgs[sc.orgId].champions[sc.div ?? p.divisionId] : null;
  const lastP = p.history[p.history.length - 1];
  const pRec = sc.amateur ? p.amateurRecord : p.record;
  const pf = p.history.filter((h) => h.result === 'W' && !h.amateur).length;
  const proWins = p.record.w;
  let milestone: string | undefined;
  if (!sc.amateur && p.record.w + p.record.l + p.record.d === 0) milestone = `This is ${p.lastName}'s professional debut.`;
  else if (!sc.amateur && (proWins + 1) % 10 === 0) milestone = `A win tonight would be pro victory number ${proWins + 1} for ${p.lastName}.`;
  if (sc.superfight) milestone = `Superfight! ${p.lastName}, the ${ORG[sc.orgId].short} ${DIV[p.divisionId].name} champion, is in ${DIV[sc.div!].name} chasing a second belt.`;
  else if (p.streak >= 4) milestone = `${p.lastName} rides a ${p.streak}-fight winning streak into this one.`;
  void pf;
  return {
    pName: p.lastName, oName: o.last, pFull: `${p.firstName} ${p.lastName}`, oFull: `${o.first} ${o.last}`,
    title: sc.title, orgShort: sc.amateur ? 'amateur' : ORG[sc.orgId].short, divName: DIV[sc.div ?? p.divisionId].name, eventName: sc.eventName,
    pRec: recStr(pRec), oRec: recStr(o.rec), pRank: rk('player'), oRank: rk(o.id),
    champion: champ === 'player' ? 'player' : champ === o.id ? 'opponent' : null,
    rivalry: st.rivalries[o.id] ?? 0, previous: o.vsPlayer.map((v) => ({ result: v.result, method: v.method })),
    pLayoff: lastP ? st.day - lastP.day : 0, oLayoff: o.lastFight ? st.day - o.lastFight : 0,
    ovrGap: ovrOf(st, o.id) - ovrOf(st, "player"),
    pFinishes: pRec.ko + pRec.tko + pRec.sub, oFinishes: o.rec.ko + o.rec.tko + o.rec.sub, oStyle: STYLE[o.style].name, milestone,
  };
}
