import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Brain, Flag, Play, LogOut, Volume2, VolumeX } from 'lucide-react';
import { Btn, Modal, useNav } from '../components/common';
import { store, useSettings } from '../../game/store';
import { audio } from '../../game/audio';
import {
  createFight, contextActions, forfeit, isGround, NO_INTENT, POS_NAME, roundImpact, startNextRound, step, sumStats, SUB_NAME,
  type Button, type FightState, type FighterSetup, type Intent,
} from '../../combat/engine';
import { AIController, adaptMemory, restoreAI, serializeAI } from '../../combat/ai';
import { CHECKPOINT_TICKS, FightRecorder, clearCheckpoint, readCheckpoint, writeCheckpoint, writeReplay, type Checkpoint } from '../../game/fightrec';
import { Commentator, careerCommentaryContext } from '../../game/commentary';
import { arenaTheme } from '../../game/presentation';
import { FightRenderer } from '../../combat/renderer';
import { applyFightResult, opponentSetup, playerSetup } from '../../game/fights';
import { genAttrs } from '../../game/fighterGen';
import { RNG } from '../../game/rng';
import { GAME_PLANS, STYLE } from '../../data/world';
import { keyLabel } from './Settings';
import { PRACTICE_LESSONS } from '../Tutorial';
import type { Difficulty, GamePlanId, StyleId } from '../../game/types';

export type FightMode = 'career' | 'practice' | 'quick';

/** Quick-fight setups are passed through this module-level slot from the setup screen. */
export const quickFightSlot: { a?: FighterSetup; b?: FighterSetup; rounds?: number; difficulty?: Difficulty } = {};

const BUTTONS: Button[] = ['jab', 'cross', 'hook', 'upper', 'body', 'lowkick', 'bodykick', 'headkick', 'teep', 'knee', 'elbow', 'evade', 'clinch', 'takedown', 'sub', 'advance'];

interface Ctl { fight: FightState; ai: AIController; rec: FightRecorder; com: Commentator | null; renderer: FightRenderer | null; lastCk: number }

function cornerAdvice(s: FightState): string[] {
  const me = s.f[0], op = s.f[1];
  const r = me.rounds[s.round - 1], o = op.rounds[s.round - 1];
  const tips: string[] = [];
  if (!r || !o) return ['Stay sharp out there.'];
  if (me.stamina < 35 || me.deep > 18) tips.push('"You\'re fading. Pick your shots — stop loading up on power punches."');
  if (o.tdLanded >= 1) tips.push('"He\'s getting you down. When he dips, hit R to sprawl — or circle off the fence."');
  if (op.legs > 45) tips.push('"His lead leg is hurt. Keep kicking it!"');
  if (me.legs > 45) tips.push('"Check those leg kicks — hold C when he throws low."');
  if (op.head > 50) tips.push('"He\'s hurt upstairs. Push the pace and look for the finish."');
  if (me.head > 55) tips.push('"Keep your hands up (Q) and get out of the pocket. You\'re taking too much."');
  if (r.sigThrown > 6 && r.sigLanded / r.sigThrown < 0.3) tips.push('"You\'re missing from too far. Close the distance before you throw."');
  if (o.controlSec > 30) tips.push('"Don\'t accept the bottom. Cover up, then escape (F) or wall-walk (E)."');
  if (op.stamina < 40) tips.push('"He\'s tired! Make him work, attack the body."');
  if (!tips.length) tips.push(roundImpact(r, { ws: 1, wg: 1 }) >= roundImpact(o, { ws: 1, wg: 1 }) ? '"Good round. Same again — don\'t get greedy."' : '"You\'re losing the exchanges. Change something: feint, level change, mix in the body."');
  return tips.slice(0, 3);
}

export function FightScreen({ mode }: { mode: FightMode }) {
  const nav = useNav();
  const settings = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<Ctl | null>(null);
  const held = useRef(new Set<string>());
  const presses = useRef<Button[]>([]);
  const [paused, setPaused] = useState<null | 'menu' | 'tactical'>(null);
  const pausedRef = useRef<null | 'menu' | 'tactical'>(null);
  const [phase, setPhase] = useState<FightState['phase']>('intro');
  const [tick, setTick] = useState(0);
  const [nextPlan, setNextPlan] = useState<GamePlanId>('balanced');
  const [forfeitAsk, setForfeitAsk] = useState(false);
  const [resumeAsk, setResumeAsk] = useState<string | null>(null);
  const ckRef = useRef<Checkpoint | null>(null);
  const [ticker, setTicker] = useState<string | null>(null);
  const tickerQ = useRef<string[]>([]);
  const tickerUntil = useRef(0);
  const [ready, setReady] = useState(false);
  const applied = useRef(false);
  const logRef = useRef<{ t: string; c: string }[]>([]);
  const lastPressed = useRef<{ b: string; t: number }>({ b: '', t: 0 });
  const lesson = useRef({ idx: 0, pressed: new Set<string>(), events: [] as string[], moved: false, guarded: false, lowGuard: false });
  const [lessonIdx, setLessonIdx] = useState(0);
  const st0 = store.state;

  // ── build the fight
  const build = useCallback((snapshot?: string, ck?: Checkpoint | null): Omit<Ctl, 'renderer'> => {
    const s = store.settings;
    const commentator = () => (mode === 'career' && store.settings.commentary !== false && store.state ? (() => { const c = careerCommentaryContext(store.state!); return c ? new Commentator(c) : null; })() : null);
    if (mode === 'career' && ck) {
      // exact mid-fight checkpoint: fight state, AI decision state and recording all restored
      const fight = JSON.parse(ck.fight) as FightState;
      const ai = restoreAI(ck.ai);
      logRef.current = ck.log ?? [];
      setNextPlan(ck.plan as GamePlanId);
      return { fight, ai, rec: FightRecorder.from(ck.rec), com: commentator(), lastCk: fight.tick ?? 0 };
    }
    if (mode === 'career') {
      const st = store.state!;
      const sc = st.scheduled!;
      const opp = st.world.fighters[sc.opponentId];
      let fight: FightState;
      let mem = opp.adapt;
      if (snapshot) {
        const snap = JSON.parse(snapshot);
        fight = snap.fight;
        mem = snap.adapt;
      } else {
        fight = createFight({ rounds: sc.rounds, roundSeconds: s.roundSeconds, seed: (st.rng ^ (st.day * 7919)) >>> 0, title: sc.title }, playerSetup(st, sc.gamePlan), opponentSetup(st, sc.opponentId, sc.title));
      }
      const ai = new AIController(1, opp.style, st.difficulty, fight.cfg.seed + 11 + fight.round, mem);
      setNextPlan(fight.f[0].setup.plan);
      const rec = new FightRecorder();
      rec.keyframe(fight, ai);
      const com = commentator();
      if (com && !snapshot) for (const l of com.opening(fight)) tickerQ.current.push(l);
      return { fight, ai, rec, com, lastCk: fight.tick ?? 0 };
    }
    if (mode === 'quick') {
      const a = quickFightSlot.a!, b = quickFightSlot.b!;
      const fight = createFight({ rounds: quickFightSlot.rounds ?? 3, roundSeconds: s.roundSeconds, seed: Date.now() & 0xffffff, title: false }, a, b);
      const ai = new AIController(1, b.style, quickFightSlot.difficulty ?? 'normal', 77);
      return { fight, ai, rec: new FightRecorder(), com: null, lastCk: 0 };
    }
    // practice partner
    const rng = new RNG(4242);
    const me: FighterSetup = st0 ? playerSetup(st0, 'balanced') : {
      name: 'You', short: 'You', attrs: genAttrs(rng, 55, 'balanced'), heightCm: 180, reachCm: 183, stance: 'orthodox', style: 'balanced', plan: 'balanced', isPlayer: true,
      appearance: { skin: 2, hair: 2, hairColor: 0, facialHair: 1, shorts: 0, gloves: 0, accessory: 0 },
    };
    me.staminaMult = 1; me.regenMult = 1;
    const partnerStyle: StyleId = 'balanced';
    const partner: FighterSetup = {
      name: 'Training Partner', short: 'Partner', attrs: genAttrs(rng, 40, partnerStyle), heightCm: 178, reachCm: 180, stance: 'orthodox', style: partnerStyle, plan: 'balanced', isPlayer: false,
      appearance: { skin: 4, hair: 1, hairColor: 0, facialHair: 0, shorts: 1, gloves: 2, accessory: 0 }, record: 'Sparring',
    };
    const fight = createFight({ rounds: 99, roundSeconds: 300, seed: 99, title: false, practice: true }, me, partner);
    return { fight, ai: new AIController(1, partnerStyle, 'easy', 5, undefined, true), rec: new FightRecorder(), com: null, lastCk: 0 };
  }, [mode]);

  useEffect(() => {
    // offer resume when a snapshot exists for this booked fight
    if (mode === 'career') {
      const st = store.state;
      if (!st?.scheduled) { nav.go('hub'); return; }
      const ck = readCheckpoint(st.slot, st.scheduled.id);
      if (ck) { ckRef.current = ck; setResumeAsk('checkpoint'); return; }
      const fip = st.fightInProgress;
      if (fip?.snapshot && fip.offerId === st.scheduled.id) { setResumeAsk(fip.snapshot); return; }
    }
    ctl.current = { ...build(), renderer: null };
    setReady(true);
  }, []);

  // ── input
  useEffect(() => {
    const b = settings.bindings;
    const keyToAction: Record<string, string> = {};
    for (const [a, k] of Object.entries(b)) keyToAction[k] = a;
    const norm = (e: KeyboardEvent) => (e.key === 'Shift' ? 'shift' : e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const down = (e: KeyboardEvent) => {
      const k = norm(e);
      if (k === 'Tab') { e.preventDefault(); togglePause('tactical'); return; }
      if (k === 'Escape') { e.preventDefault(); togglePause('menu'); return; }
      const a = keyToAction[k] ?? ({ ArrowUp: 'fwd', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, string>)[k];
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return;
      held.current.add(a);
      if ((BUTTONS as string[]).includes(a)) {
        presses.current.push(a as Button);
        lastPressed.current = { b: a, t: performance.now() };
        lesson.current.pressed.add(a);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = norm(e);
      const a = keyToAction[k] ?? ({ ArrowUp: 'fwd', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, string>)[k];
      if (a) held.current.delete(a);
    };
    const blur = () => { held.current.clear(); if (!pausedRef.current && ctl.current?.fight.phase !== 'over') togglePause('menu'); };
    const vis = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [settings.bindings]);

  const togglePause = (kind: 'menu' | 'tactical') => {
    const s = ctl.current?.fight;
    if (!s || s.phase === 'over' || s.phase === 'roundOver') return;
    const next = pausedRef.current === kind ? null : kind;
    pausedRef.current = next;
    setPaused(next);
    held.current.clear();
  };

  const intentFromInput = (): Intent => {
    const h = held.current;
    const press = presses.current.shift() ?? null;
    return {
      fwd: (h.has('fwd') ? 1 : 0) - (h.has('back') ? 1 : 0),
      lat: (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0),
      guard: h.has('guard') ? 'high' : h.has('low') ? 'low' : 'none',
      power: h.has('power'),
      press,
    };
  };

  // ── main loop
  useEffect(() => {
    if (!ready || !ctl.current) return;
    const c = canvasRef.current!;
    const r = new FightRenderer(c);
    r.reducedMotion = store.settings.reducedMotion;
    r.telegraphIQ = ctl.current.fight.f[0].a.fightIQ;
    ctl.current.renderer = r;
    if (mode === 'career' && store.state?.scheduled) r.theme = arenaTheme(store.state.scheduled);
    (window as any).__fightDebug = () => ctl.current?.fight; // read-only handle for automated tests
    (window as any).__fightRenderer = r; // for automated rendering/performance checks
    setPhase(ctl.current.fight.phase); // restored snapshots may start at a round break
    r.resize();
    const onResize = () => r.resize();
    window.addEventListener('resize', onResize);
    audio.resume();
    audio.startCrowd();
    let raf = 0, last = performance.now(), acc = 0, uiT = 0;
    let prevPhase: FightState['phase'] = ctl.current.fight.phase;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const C = ctl.current!;
      const s = C.fight;
      if (!pausedRef.current) {
        acc += dt;
        while (acc >= 1 / 60) {
          acc -= 1 / 60;
          const pi = s.phase === 'live' ? intentFromInput() : NO_INTENT;
          if (pi.fwd || pi.lat) lesson.current.moved = true;
          if (pi.guard === 'high') lesson.current.guarded = true;
          if (pi.guard === 'low') lesson.current.lowGuard = true;
          C.rec.intent(s, pi);
          step(s, [pi, C.ai.think(s, 1 / 60)], 1 / 60);
          const evs = s.events.splice(0);
          if (evs.length) { C.rec.events(evs, s); handleEvents(evs, s); }
          C.rec.sample(s);
          if (s.phase !== prevPhase) { prevPhase = s.phase; setPhase(s.phase); onPhase(s); }
          else if (mode === 'career' && s.phase === 'live' && (s.tick ?? 0) - C.lastCk >= CHECKPOINT_TICKS) checkpoint();
        }
      } else acc = 0;
      r.render(s, pausedRef.current ? 0 : dt, { paused: !!pausedRef.current });
      uiT += dt;
      if (uiT > 0.12) {
        uiT = 0; setTick((x) => x + 1); updateLesson(s);
        if (C.com && !pausedRef.current) { const l = C.com.tick(s); if (l) say(l); }
        const now = performance.now();
        if (now > tickerUntil.current) {
          const nxt = tickerQ.current.shift();
          if (nxt) { setTicker(nxt); tickerUntil.current = now + 3600; } else if (now > tickerUntil.current + 1200) setTicker(null);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); audio.stopCrowd(); };
  }, [ready]);

  const handleEvents = (evs: FightState['events'], s: FightState) => {
    const r = ctl.current!.renderer!;
    r.onEvents(evs, s);
    const com = ctl.current!.com;
    for (const e of evs) {
      if (com) { const l = com.onEvent(e, s); if (l) say(l, e.type === 'ko' || e.type === 'tap' || e.type === 'kd'); }
      lesson.current.events.push(e.type);
      if (lesson.current.events.length > 60) lesson.current.events.shift();
      switch (e.type) {
        case 'hit': case 'counter': {
          const kick = e.text?.includes('Kick') || e.text?.includes('Knee');
          kick ? audio.kick(e.big) : audio.punch(e.big);
          if (e.big) audio.cheer(0.6);
          break;
        }
        case 'block': audio.block(); break;
        case 'miss': case 'whiff': case 'evade': audio.whoosh(); break;
        case 'kd': audio.slam(); audio.cheer(1.3); break;
        case 'ko': audio.slam(); audio.cheer(2); break;
        case 'td': audio.slam(); audio.cheer(0.8); break;
        case 'tap': audio.cheer(2); break;
        case 'bell': audio.bell(1); break;
        case 'sub': audio.cheer(1); break;
      }
      if (e.text && e.type !== 'miss' && e.type !== 'whiff') {
        const c = e.big ? 'big' : e.i === 0 ? 'me' : e.i === 1 ? 'op' : '';
        logRef.current.unshift({ t: `${s.round}·${e.text}`, c });
        if (logRef.current.length > 50) logRef.current.length = 50;
      }
    }
  };

  const onPhase = (s: FightState) => {
    if (s.phase === 'roundOver') {
      audio.bell(2);
      // checkpoint for refresh-resume (career only)
      if (mode === 'career' && !checkpoint()) {
        // storage full: fall back to the in-save round-break snapshot
        const snap = JSON.stringify({ fight: { ...s, events: [] }, adapt: ctl.current!.ai.adapt });
        store.act((g) => { if (g.scheduled) g.fightInProgress = { offerId: g.scheduled.id, round: s.round + 1, snapshot: snap }; });
      }
    }
    if (s.phase === 'over') {
      audio.bell(3);
      const won = s.outcome?.winner === 0;
      const com = ctl.current?.com;
      if (com) { const l = com.closing(s); if (l) say(l, true); }
      won ? audio.victory() : audio.defeat();
      if (mode === 'practice') logRef.current.unshift({ t: 'Practice bout over — press Esc to restart or leave.', c: 'big' });
    }
  };

  const say = (l: string, urgent = false) => {
    if (urgent) { tickerQ.current = [l]; tickerUntil.current = 0; }
    else { tickerQ.current.push(l); if (tickerQ.current.length > 2) tickerQ.current.shift(); }
  };

  /** Write an exact checkpoint (fight + AI + recording) outside the main save. Career only. */
  const checkpoint = (): boolean => {
    const C = ctl.current, st = store.state;
    if (!C || mode !== 'career' || !st?.scheduled || C.fight.phase === 'over') return false;
    C.lastCk = C.fight.tick ?? 0;
    return writeCheckpoint(st.slot, { offerId: st.scheduled.id, savedAt: Date.now(), fight: JSON.stringify({ ...C.fight, events: [] }), ai: serializeAI(C.ai), rec: C.rec.toJSON(), plan: C.fight.f[0].setup.plan, log: logRef.current.slice(0, 30) });
  };

  const updateLesson = (s: FightState) => {
    if (mode !== 'practice') return;
    const L = lesson.current;
    const cur = PRACTICE_LESSONS[L.idx];
    if (cur && cur.done({ pos: s.sub ? 'sub' : s.pos, events: L.events, pressed: L.pressed, moved: L.moved, guarded: L.guarded, lowGuard: L.lowGuard })) {
      L.idx = Math.min(PRACTICE_LESSONS.length - 1, L.idx + 1);
      L.pressed = new Set(); L.events = []; L.moved = false; L.guarded = false; L.lowGuard = false;
      setLessonIdx(L.idx);
      audio.bell(1);
      // make the partner spar back for defense & grappling lessons
      const id = PRACTICE_LESSONS[L.idx].id;
      if (id === 'guard' || id === 'stamina') ctl.current!.ai.passive = false;
      if (id === 'td' || id === 'ground' || id === 'sub') ctl.current!.ai.passive = true;
      if (L.idx === PRACTICE_LESSONS.length - 1 && store.state) store.act((g) => { g.practiceDone = true; });
    }
  };

  const nextRound = () => {
    const C = ctl.current!;
    const s = C.fight;
    s.f[0].setup = { ...s.f[0].setup, plan: nextPlan };
    const me = s.f[0].rounds.reduce((a, r) => a + roundImpact(r, { ws: 1, wg: 1 }), 0);
    const op = s.f[1].rounds.reduce((a, r) => a + roundImpact(r, { ws: 1, wg: 1 }), 0);
    C.ai.betweenRounds(s, op < me);
    startNextRound(s);
    C.rec.keyframe(s, C.ai);
    if (C.com) { const l = C.com.roundStart(s); if (l) say(l, true); }
    checkpoint();
    setPhase(s.phase);
  };

  const finishCareer = () => {
    if (applied.current) return;
    applied.current = true;
    const C = ctl.current!;
    const st = store.state!;
    const slot = st.slot, fid = st.scheduled?.id ?? '';
    const extras = { timeline: C.rec.moments, trends: C.rec.trends, commentary: C.com ? C.com.lines.slice(-40) : undefined };
    const replayOk = writeReplay(slot, fid, C.rec.replay(C.fight));
    const res = store.act((g) => { const r = applyFightResult(g, C.fight, adaptMemory(C.ai) as Record<string, number>, extras); if (r) g.lastReplay = replayOk ? fid : null; return r; });
    clearCheckpoint(slot);
    store.saveNow();
    if (!res && !store.state?.lastResult) { nav.toast('Result could not be applied.', 'err'); nav.go('hub'); return; }
    nav.go('results');
  };

  const restartPractice = () => {
    ctl.current = { ...build(), renderer: ctl.current?.renderer ?? null };
    if (ctl.current.renderer) ctl.current.renderer.cam.init = false;
    pausedRef.current = null; setPaused(null); setPhase('intro');
    ctl.current.ai.passive = !['guard', 'stamina'].includes(PRACTICE_LESSONS[lesson.current.idx].id);
  };

  const leave = () => {
    audio.stopCrowd();
    if (mode === 'practice') nav.go(store.state ? 'hub' : 'title');
    else if (mode === 'quick') nav.go('title');
  };

  // ── resume prompt
  if (resumeAsk) {
    return (
      <Modal title="Resume fight?">
        {ckRef.current
          ? <p className="muted">This fight was interrupted. Resume exactly where it was saved (round {JSON.parse(ckRef.current.fight).round}, a few seconds before the interruption), or restart from the opening bell?</p>
          : <p className="muted">This fight was interrupted at a round break. Resume from round {store.state?.fightInProgress?.round}, or restart from the opening bell?</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Btn onClick={() => { setResumeAsk(null); if (store.state) clearCheckpoint(store.state.slot); ckRef.current = null; ctl.current = { ...build(), renderer: null }; setReady(true); }}>Restart fight</Btn>
          <Btn variant="primary" onClick={() => { const s = resumeAsk; setResumeAsk(null); try { ctl.current = { ...build(ckRef.current ? undefined : s, ckRef.current), renderer: null }; } catch { ctl.current = { ...build(), renderer: null }; } setReady(true); }}>Resume</Btn>
        </div>
      </Modal>
    );
  }
  if (!ready || !ctl.current) return <div style={{ height: 'var(--app-h, 100vh)', display: 'grid', placeItems: 'center' }} className="muted">Entering the cage…</div>;

  const s = ctl.current.fight;
  const actions = contextActions(s, 0);
  const b = settings.bindings;
  const keyFor = (k: string) => k === 'move' ? 'WASD' : k === 'guard' ? keyLabel(b.guard) : k === 'low' ? keyLabel(b.low) : k === 'power' ? keyLabel(b.power) : keyLabel(b[k] ?? '?');
  const hot = performance.now() - lastPressed.current.t < 250 ? lastPressed.current.b : '';
  const hint = (() => {
    if (!settings.hints) return null;
    const o = s.f[1], me = s.f[0];
    if (s.phase === 'intro') return <>Round {s.round}. <b>WASD</b> move · <b>J/K/L</b> punch · <b>N/M/H</b> kick · <b>Q</b> guard · <b>R</b> takedown · <b>Tab</b> tactical pause</>;
    if (s.sub) return s.sub.attacker === 0 ? <>Submission! Press <b>{keyLabel(b.sub)}</b> when the marker is in the pink zone.</> : <>You're caught! Press <b>{keyLabel(b.evade)}</b> when the marker is in the green zone.</>;
    if (o.state === 'shoot') return <>He's shooting! Press <b>{keyLabel(b.takedown)}</b> or <b>{keyLabel(b.evade)}</b> NOW to sprawl.</>;
    if (o.state === 'down') return <>He's down! Press <b>{keyLabel(b.advance)}</b> to pounce, or let him up.</>;
    if (o.state === 'sprawled') return <>He's stuck on his knees — <b>{keyLabel(b.sub)}</b> for a guillotine or strike him!</>;
    if (me.state === 'stun') return <>You're hurt! Hold <b>{keyLabel(b.guard)}</b> and back away (<b>{keyLabel(b.back)}</b>).</>;
    if (isGround(s.pos) && s.top === 1) return <>Bottom of {POS_NAME[s.pos]}: <b>{keyLabel(b.guard)}</b> cover · <b>{keyLabel(b.advance)}</b> {s.pos === 'guard' ? 'stand' : 'escape'} · <b>{keyLabel(b.evade)}</b> sweep · <b>{keyLabel(b.clinch)}</b> get up</>;
    if (isGround(s.pos) && s.top === 0) return <>Top in {POS_NAME[s.pos]}: <b>{keyLabel(b.jab)}</b> strike · <b>{keyLabel(b.advance)}</b> advance · <b>{keyLabel(b.sub)}</b> submission · <b>{keyLabel(b.clinch)}</b> stand up</>;
    if (s.pos === 'clinch') return <>Clinch: <b>{keyLabel(b.knee)}</b> knee · <b>{keyLabel(b.elbow)}</b> elbow · <b>{keyLabel(b.takedown)}</b> trip · <b>{keyLabel(b.clinch)}</b> break</>;
    if (me.stamina < 25) return <>You're gassed — back off and breathe. Low stamina slows everything.</>;
    if (mode === 'career' && (store.state?.player.history.length ?? 1) === 0) return <>Watch the warning above your opponent: it shows what's coming. Guard high (<b>{keyLabel(b.guard)}</b>) for head shots, low (<b>{keyLabel(b.low)}</b>) for body and leg kicks.</>;
    return null;
  })();
  const lessonDef = mode === 'practice' ? PRACTICE_LESSONS[lessonIdx] : null;
  const myTot = sumStats(s.f[0]), opTot = sumStats(s.f[1]);
  void tick;

  return (
    <div className="fight">
      <div className="fight-stage">
        <canvas ref={canvasRef} className="arena" onMouseDown={(e) => { if (e.button === 0) presses.current.push('jab'); if (e.button === 2) presses.current.push('cross'); }} onContextMenu={(e) => e.preventDefault()} />
        <div className="fight-top-btns">
          <Btn size="sm" onClick={() => togglePause('menu')} title="Pause (Esc)"><Pause size={14} /></Btn>
          <Btn size="sm" onClick={() => togglePause('tactical')} title="Tactical pause (Tab)"><Brain size={14} /></Btn>
          <Btn size="sm" onClick={() => { store.updateSettings({ muted: !settings.muted }); audio.applyVolume(); }} title="Mute">{settings.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</Btn>
        </div>
        {hint && !paused && phase !== 'roundOver' && phase !== 'over' && <div className="fight-hint">{hint}</div>}
        {ticker && settings.commentary !== false && !paused && <div className="ticker" aria-live="polite"><b>COMMENTARY</b>{ticker}</div>}
        {lessonDef && (
          <div className="panel" style={{ position: 'absolute', left: 14, top: 112, width: 330, zIndex: 5, background: 'rgba(13,15,21,.92)' }}>
            <div className="tiny accent" style={{ fontWeight: 700, letterSpacing: '.1em' }}>PRACTICE ARENA · LESSON {lessonIdx + 1}/{PRACTICE_LESSONS.length}</div>
            <h3 style={{ margin: '4px 0' }}>{lessonDef.title}</h3>
            <div className="small muted">{lessonDef.body}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <Btn size="sm" onClick={() => { lesson.current.idx = Math.min(PRACTICE_LESSONS.length - 1, lesson.current.idx + 1); setLessonIdx(lesson.current.idx); }}>Skip lesson</Btn>
              <Btn size="sm" onClick={leave}>Leave</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="fight-bottom">
        <div className="keys" aria-label="Available actions">
          {actions.map((a) => (
            <button key={a.key + a.label} className={`key ${hot === a.key ? 'hot' : ''}`} onClick={() => { if ((BUTTONS as string[]).includes(a.key)) { presses.current.push(a.key as Button); lesson.current.pressed.add(a.key); } }}>
              <kbd>{keyFor(a.key)}</kbd>{a.label}
            </button>
          ))}
          <span className="key"><kbd>Tab</kbd>Tactical pause</span>
          <span className="key"><kbd>Esc</kbd>Pause</span>
        </div>
        <div className="flog" aria-live="off">
          {logRef.current.slice(0, 30).map((l, i) => <div key={i} className={l.c}>{l.t}</div>)}
        </div>
      </div>

      {paused === 'menu' && (
        <Modal title="Paused">
          <div className="col">
            <Btn variant="primary" onClick={() => togglePause('menu')}><Play size={16} /> Resume</Btn>
            {mode === 'practice' && <Btn onClick={restartPractice}>Restart sparring</Btn>}
            {mode !== 'career' && <Btn onClick={leave}><LogOut size={16} /> Leave {mode === 'practice' ? 'practice' : 'fight'}</Btn>}
            {mode === 'career' && <Btn variant="danger" onClick={() => setForfeitAsk(true)}><Flag size={16} /> Retire on stool (TKO loss)</Btn>}
            <label className="row small"><input type="checkbox" checked={settings.muted} onChange={(e) => { store.updateSettings({ muted: e.target.checked }); audio.applyVolume(); }} /> Mute</label>
            <label className="row small"><input type="checkbox" checked={settings.hints} onChange={(e) => store.updateSettings({ hints: e.target.checked })} /> Show hints</label>
            <div className="tiny dim">Controls can be rebound in Settings. The simulation is fully paused.</div>
          </div>
        </Modal>
      )}
      {paused === 'tactical' && (
        <Modal title="Tactical pause" onClose={() => togglePause('tactical')} wide>
          <div className="grid2">
            <div>
              <h4>This round so far</h4>
              <div className="col small" style={{ gap: 4, marginTop: 6 }}>
                {(() => { const r = s.f[0].rounds[s.round - 1], o = s.f[1].rounds[s.round - 1]; return (<>
                  <div className="row between"><span>Significant strikes</span><span><b className="accent">{r?.sigLanded ?? 0}</b> – <b className="blue">{o?.sigLanded ?? 0}</b></span></div>
                  <div className="row between"><span>Takedowns</span><span><b className="accent">{r?.tdLanded ?? 0}</b> – <b className="blue">{o?.tdLanded ?? 0}</b></span></div>
                  <div className="row between"><span>Control time</span><span><b className="accent">{Math.round(r?.controlSec ?? 0)}s</b> – <b className="blue">{Math.round(o?.controlSec ?? 0)}s</b></span></div>
                  <div className="row between"><span>Damage dealt</span><span><b className="accent">{Math.round(r?.damageDealt ?? 0)}</b> – <b className="blue">{Math.round(o?.damageDealt ?? 0)}</b></span></div>
                </>); })()}
              </div>
              <h4 style={{ marginTop: 12 }}>Condition</h4>
              <div className="small">You: stamina {Math.round(s.f[0].stamina)} · head {Math.round(s.f[0].head)} · body {Math.round(s.f[0].body)} · legs {Math.round(s.f[0].legs)}</div>
              <div className="small">Him: stamina {Math.round(s.f[1].stamina)} · head {Math.round(s.f[1].head)} · body {Math.round(s.f[1].body)} · legs {Math.round(s.f[1].legs)}</div>
            </div>
            <div>
              <h4>Read on your opponent ({STYLE[s.f[1].setup.style].name})</h4>
              <div className="col small" style={{ gap: 4, marginTop: 6 }}>
                {s.f[0].a.fightIQ >= 45 ? cornerAdvice(s).map((t, i) => <div key={i}>{t}</div>) : <div className="muted">Raise your Fight IQ to read the fight better from in here.</div>}
                <div className="muted">He tends to: {Object.entries(ctl.current.ai.adapt).filter(([, v]) => v > 0.25).map(([k]) => ({ head: 'guard against head shots', body: 'watch for body shots', legs: 'check leg kicks', td: 'expect your takedowns', clinch: 'avoid the clinch', aggr: 'counter your aggression' } as any)[k]).join(', ') || 'not have adapted to you yet'}.</div>
              </div>
              <h4 style={{ marginTop: 12 }}>Game plan</h4>
              <div className="small">{GAME_PLANS.find((g) => g.id === s.f[0].setup.plan)?.name} — change it between rounds.</div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><Btn variant="primary" onClick={() => togglePause('tactical')}><Play size={16} /> Back to the fight</Btn></div>
        </Modal>
      )}
      {phase === 'roundOver' && (
        <Modal title={`End of round ${s.round}`} wide>
          <div className="grid2">
            <div>
              <h4>Round stats</h4>
              {(() => { const r = s.f[0].rounds[s.round - 1], o = s.f[1].rounds[s.round - 1]; const lines: [string, number | string, number | string][] = [
                ['Sig. strikes', r.sigLanded, o.sigLanded], ['Head / body / legs', `${r.headLanded}/${r.bodyLanded}/${r.legLanded}` as any, `${o.headLanded}/${o.bodyLanded}/${o.legLanded}` as any], ['Knockdowns', r.knockdowns, o.knockdowns], ['Takedowns', r.tdLanded, o.tdLanded],
                ['Control (s)', Math.round(r.controlSec), Math.round(o.controlSec)], ['Sub attempts', r.subAttempts, o.subAttempts]];
                return lines.map(([l, a, bb]) => <div key={l} className="statline"><span className="a">{a}</span><span className="l">{l}</span><span className="b">{bb}</span></div>); })()}
              <div className="small muted" style={{ marginTop: 8 }}>Your corner scores it: <b className={roundImpact(s.f[0].rounds[s.round - 1], { ws: 1, wg: 1 }) >= roundImpact(s.f[1].rounds[s.round - 1], { ws: 1, wg: 1 }) ? 'green' : 'red'}>{roundImpact(s.f[0].rounds[s.round - 1], { ws: 1, wg: 1 }) >= roundImpact(s.f[1].rounds[s.round - 1], { ws: 1, wg: 1 }) ? 'your round' : 'his round'}</b> (judges may differ).</div>
            </div>
            <div>
              <h4>Corner advice</h4>
              <div className="col small" style={{ gap: 6, marginTop: 6 }}>{cornerAdvice(s).map((t, i) => <div key={i}>{t}</div>)}</div>
              <h4 style={{ marginTop: 14 }}>Adjust game plan</h4>
              <select className="input" value={nextPlan} onChange={(e) => setNextPlan(e.target.value as GamePlanId)}>{GAME_PLANS.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.bonus}</option>)}</select>
              <div className="tiny dim" style={{ marginTop: 6 }}>Recovery between rounds: stamina refills toward your (shrinking) max; some damage heals based on your Recovery attribute.</div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><Btn variant="primary" size="lg" onClick={nextRound}>Round {s.round + 1} <Play size={16} /></Btn></div>
        </Modal>
      )}
      {phase === 'over' && s.outcome && (
        <div className="overlay" style={{ background: 'rgba(3,4,7,.55)' }}>
          <div className="modal" style={{ textAlign: 'center' }}>
            <div className={`result-banner ${s.outcome.winner === 0 ? 'win' : 'loss'}`}>{s.outcome.winner === 0 ? 'Victory' : s.outcome.winner === -1 ? 'Draw' : 'Defeat'}</div>
            <div className="muted" style={{ margin: '10px 0 4px' }}>{s.outcome.winner >= 0 ? `${s.f[s.outcome.winner].setup.name} wins by ${s.outcome.method}` : 'Split down the middle'} — {s.outcome.detail}</div>
            <div className="small dim">Round {s.outcome.round} · {s.outcome.time} · strikes {myTot.sigLanded}–{opTot.sigLanded} · takedowns {myTot.tdLanded}–{opTot.tdLanded}</div>
            {s.outcome.method.endsWith('D') || s.outcome.method === 'DRAW' ? <div className="row" style={{ justifyContent: 'center', gap: 16, marginTop: 10 }}>{s.outcome.cards.map((c, i) => <span key={i} className="num">{c[0]}–{c[1]}</span>)}</div> : null}
            <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
              {mode === 'career' && <Btn variant="primary" size="lg" onClick={finishCareer}>Continue to results</Btn>}
              {mode === 'practice' && <><Btn onClick={restartPractice}>Spar again</Btn><Btn variant="primary" onClick={leave}>Leave</Btn></>}
              {mode === 'quick' && <><Btn onClick={() => nav.go('quick')}>New quick fight</Btn><Btn variant="primary" onClick={leave}>Title screen</Btn></>}
            </div>
          </div>
        </div>
      )}
      {forfeitAsk && (
        <Modal title="Retire on your stool?" onClose={() => setForfeitAsk(false)}>
          <p className="muted">Your corner will stop the fight. This counts as a TKO loss with all career consequences.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Btn onClick={() => setForfeitAsk(false)}>Keep fighting</Btn>
            <Btn variant="danger" onClick={() => { forfeit(s, 0, 'Corner stoppage'); setForfeitAsk(false); pausedRef.current = null; setPaused(null); setPhase('over'); }}>Stop the fight</Btn>
          </div>
        </Modal>
      )}
      <span hidden>{SUB_NAME.rnc}{mode}{s.round}</span>
    </div>
  );
}
