// Results-screen additions: announcer verdict, post-fight interview, round-by-round breakdown, momentum
// chart, highlights with deterministic replays, and the rest of the event card.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Film, Play, X, Swords, BarChart3, Megaphone, Trophy, Gauge } from 'lucide-react';
import { Btn, Modal } from '../components/common';
import { store } from '../../game/store';
import { audio } from '../../game/audio';
import { interviewOptions, applyInterview } from '../../game/interview';
import { readReplay, replayStart, replayStep, replayTo, type Moment, type ReplayData } from '../../game/fightrec';
import { FightRenderer } from '../../combat/renderer';
import { nameOf } from '../../game/history';
import { DIV } from '../../data/world';
import { SLOT_NAME } from '../../game/eventcard';
import type { FightResultSummary, GameState } from '../../game/types';

export function Announcement({ r }: { r: FightResultSummary }) {
  const lines = r.announce ?? [];
  const [n, setN] = useState(lines.length ? 1 : 0);
  useEffect(() => {
    if (n >= lines.length) return;
    const id = window.setTimeout(() => setN((x) => x + 1), store.settings.reducedMotion ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [n, lines.length]);
  useEffect(() => { if (lines.length) audio.speak(lines.join(' ')); return () => audio.stopSpeech(); }, []);
  if (!lines.length) return null;
  return (
    <div className="panel" style={{ marginTop: 18, textAlign: 'center' }}>
      <div className="tiny dim" style={{ letterSpacing: '.25em', fontWeight: 700 }}><Megaphone size={12} style={{ verticalAlign: -2 }} /> THE OFFICIAL DECISION</div>
      <div className="col" style={{ gap: 4, marginTop: 8 }}>
        {lines.slice(0, n).map((l, i) => <div key={i} style={{ fontFamily: 'var(--head)', fontSize: i === lines.length - 1 ? 26 : 17, letterSpacing: '.03em', animation: 'fade .4s' }}>{l}</div>)}
      </div>
      {n < lines.length && <button className="chip" style={{ marginTop: 8 }} onClick={() => setN(lines.length)}>Show all</button>}
    </div>
  );
}

export function Interview({ st, r }: { st: GameState; r: FightResultSummary }) {
  const [msg, setMsg] = useState<string | null>(null);
  const opts = useMemo(() => interviewOptions(st, r), [r.id, !!r.interview]);
  const chosen = r.interview ? opts.find((o) => o.id === r.interview) : null;
  return (
    <div className="panel">
      <div className="panel-title"><h3><Mic size={16} /> Post-fight interview</h3><span className="tiny dim">One answer — it affects popularity, reputation, rivalries and matchmaking.</span></div>
      {chosen ? (
        <div>
          <div style={{ fontStyle: 'italic' }}>"{chosen.quote}"</div>
          {msg && <div className="small green" style={{ marginTop: 6 }}>{msg}</div>}
        </div>
      ) : (
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {opts.map((o) => (
            <button key={o.id} className="pick" onClick={() => { const m = store.act((g) => (g.lastResult ? applyInterview(g, g.lastResult, o.id) : 'No result.')); setMsg(m ?? null); }}>
              <b>{o.label}</b><span className="small" style={{ fontStyle: 'italic' }}>"{o.quote}"</span><span className="tiny accent">{o.effects}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ROWS: [string, string][] = [['sig', 'Sig. strikes'], ['head', 'Head'], ['body', 'Body'], ['legs', 'Legs'], ['kd', 'Knockdowns'], ['td', 'Takedowns'], ['ctrl', 'Control (s)'], ['sub', 'Sub attempts'], ['dmg', 'Damage']];

export function RoundBreakdown({ r }: { r: FightResultSummary }) {
  const rounds = r.rounds ?? [];
  if (!rounds.length) return null;
  return (
    <div className="panel">
      <div className="panel-title"><h3><BarChart3 size={16} /> Round by round</h3><span className="tiny dim"><span className="accent">You</span> – <span className="blue">Opponent</span></span></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead><tr><th></th>{rounds.map((_, i) => <th key={i}>R{i + 1}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(([k, l]) => (
              <tr key={k}><td className="small">{l}</td>{rounds.map((x, i) => <td key={i} className="num small"><span className={x.p[k] > x.o[k] ? 'accent' : ''}>{x.p[k]}</span>–<span className={x.o[k] > x.p[k] ? 'blue' : ''}>{x.o[k]}</span></td>)}</tr>
            ))}
            <tr><td className="small">Edge</td>{rounds.map((x, i) => <td key={i} className="small"><b className={x.p.impact >= x.o.impact ? 'accent' : 'blue'}>{x.p.impact >= x.o.impact ? 'You' : 'Opp'}</b></td>)}</tr>
          </tbody>
        </table>
      </div>
      <Trends r={r} />
    </div>
  );
}

function Trends({ r }: { r: FightResultSummary }) {
  const t = r.trends ?? [];
  if (t.length < 3) return null;
  const W = 520, H = 120, maxT = t[t.length - 1].t || 1;
  const maxS = Math.max(5, ...t.map((x) => Math.max(x.ps, x.os)));
  const pts = (f: (x: (typeof t)[number]) => number, max: number) => t.map((x) => `${(x.t / maxT) * W},${H - (f(x) / max) * (H - 8) - 4}`).join(' ');
  return (
    <div style={{ marginTop: 14 }}>
      <div className="tiny dim" style={{ marginBottom: 4 }}><Gauge size={11} style={{ verticalAlign: -1 }} /> Momentum: cumulative significant strikes (solid) and head damage taken (dashed)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120, background: 'var(--bg2)', borderRadius: 8 }} role="img" aria-label="Fight momentum chart">
        <polyline points={pts((x) => x.ps, maxS)} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <polyline points={pts((x) => x.os, maxS)} fill="none" stroke="var(--blue)" strokeWidth="2.5" />
        <polyline points={pts((x) => x.ph, 100)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
        <polyline points={pts((x) => x.oh, 100)} fill="none" stroke="var(--blue)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
      </svg>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { ko: 'Finish', tap: 'Submission', kd: 'Knockdown', stun: 'Hurt', sub: 'Sub attempt', subescape: 'Escape', td: 'Takedown', counter: 'Counter' };
// the event actor is the attacker, except for 'stun' (the hurt fighter) and 'subescape' (the escaper)
const VERB: Record<string, string> = { ko: 'finishes the fight', tap: 'gets the tap', kd: 'scores a knockdown', stun: 'is hurt', sub: 'attempts a submission', subescape: 'escapes a submission', td: 'lands a takedown', counter: 'lands a big counter' };

export function Highlights({ st, r }: { st: GameState; r: FightResultSummary }) {
  const data = useMemo(() => (st.lastReplay === r.id ? readReplay(st.slot, r.id) : null), [r.id, st.lastReplay]);
  const [watch, setWatch] = useState<Moment | null>(null);
  const moments = (r.timeline ?? []).filter((m) => m.kind !== 'stun' || !(r.timeline ?? []).some((x) => x.kind === 'kd' && Math.abs(x.tick - m.tick) < 60));
  const key = moments.filter((m) => ['ko', 'tap', 'kd', 'sub', 'subescape'].includes(m.kind) || m.kind === 'stun');
  const list = (key.length >= 3 ? key : moments).slice(-12);
  const name = (side: number) => (side === 0 ? st.player.lastName : r.opponentName.split(' ').slice(-1)[0]);
  return (
    <div className="panel">
      <div className="panel-title"><h3><Film size={16} /> Highlights</h3>{!data && <span className="tiny dim">{r.timeline ? 'Replays unavailable (not stored for this fight)' : ''}</span>}</div>
      {!list.length && <div className="small muted">A tactical fight without standout moments.</div>}
      <div className="col" style={{ gap: 4 }}>
        {list.map((m, i) => (
          <div key={i} className="row between" style={{ padding: '5px 8px', background: 'var(--bg2)', borderRadius: 8 }}>
            <div className="small"><span className="tiny dim num">R{m.round} {m.clock}</span> <b className={m.side === 0 ? 'accent' : 'blue'}>{m.side >= 0 ? name(m.side) : ''}</b> {VERB[m.kind] ?? m.kind}</div>
            {data && <Btn size="sm" onClick={() => setWatch(m)}><Play size={12} /> Watch</Btn>}
          </div>
        ))}
      </div>
      {watch && data && <ReplayViewer data={data} m={watch} title={`R${watch.round} ${watch.clock} — ${KIND_LABEL[watch.kind] ?? watch.kind}`} onClose={() => setWatch(null)} />}
    </div>
  );
}

/** Re-simulates the real fight from the round keyframe and plays ~6 seconds around the moment. */
function ReplayViewer({ data, m, title, onClose }: { data: ReplayData; m: Moment; title: string; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const c = ref.current!;
    const r = new FightRenderer(c);
    r.reducedMotion = store.settings.reducedMotion;
    r.resize();
    const sim = replayStart(data, Math.max(0, m.tick - 180));
    replayTo(sim, m.tick - 180);
    const end = m.tick + 150;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000) * (slow ? 0.4 : 1);
      last = t;
      acc += dt;
      while (acc >= 1 / 60 && (sim.fight.tick ?? 0) < end) {
        acc -= 1 / 60;
        if (!replayStep(sim)) break;
        const evs = sim.fight.events.splice(0);
        if (evs.length) {
          r.onEvents(evs, sim.fight);
          for (const e of evs) if (e.type === 'hit' || e.type === 'counter') audio.punch(e.big); else if (e.type === 'kd' || e.type === 'ko' || e.type === 'td') audio.slam();
        }
      }
      r.render(sim.fight, dt, { paused: false, hud: true });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run, slow]);
  return (
    <Modal title={`Replay · ${title}`} onClose={onClose} wide>
      <canvas ref={ref} style={{ width: '100%', height: 380, display: 'block', borderRadius: 10, background: '#07080c' }} />
      <div className="row between" style={{ marginTop: 10 }}>
        <span className="tiny dim">Re-simulated from the recorded fight — the exact same exchange.</span>
        <div className="row">
          <Btn size="sm" onClick={() => setSlow((x) => !x)}>{slow ? 'Normal speed' : 'Slow motion'}</Btn>
          <Btn size="sm" onClick={() => setRun((x) => x + 1)}><Play size={12} /> Again</Btn>
          <Btn size="sm" onClick={onClose}><X size={12} /> Close</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function CardResults({ st, r }: { st: GameState; r: FightResultSummary }) {
  const card = [...(r.cardResults ?? [])].sort((a, b) => b.order - a.order);
  if (card.length <= 1) return null;
  return (
    <div className="panel">
      <div className="panel-title"><h3><Swords size={16} /> {r.eventName} — full results</h3></div>
      {card.map((c) => {
        const res = c.result;
        const w = res && res.w !== -1 ? (res.w === 0 ? c.a : c.b) : null;
        const l = w ? (w === c.a ? c.b : c.a) : null;
        return (
          <div key={c.id} className="row between small" style={{ padding: '5px 8px', borderRadius: 8, background: c.player ? 'var(--accentDim)' : 'var(--bg2)', marginBottom: 3 }}>
            <span>{c.title && <Trophy size={12} className="gold" style={{ verticalAlign: -1 }} />} {res && res.r === 0 ? <span className="muted">{nameOf(st, c.a)} vs {nameOf(st, c.b)} — {res.note}</span>
              : w ? <><b>{nameOf(st, w)}</b> def. {nameOf(st, l!)}</> : <>{nameOf(st, c.a)} drew with {nameOf(st, c.b)}</>}
              <span className="tiny dim"> · {SLOT_NAME[c.slot]} · {DIV[c.div].name}</span></span>
            <span className="tiny">{res && res.r > 0 ? `${res.m} R${res.r}` : ''}{res?.note && res.r > 0 ? <b className="gold"> · {res.note}</b> : null}</span>
          </div>
        );
      })}
    </div>
  );
}
