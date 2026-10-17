import { FightPoster } from '../components/FightPoster';
import { posterForScheduled } from '../../game/poster';
import { Belt } from '../components/Belt';
// Fight night: event card (resolved by the real world simulation), walkouts, announcer introductions,
// referee instructions and faceoff. Presentation only — skippable, and controlled by Settings.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Music, SkipForward, FastForward, Trophy, Swords } from 'lucide-react';
import { Btn, NationBadge, Portrait, WALKOUT_COLORS, useNav } from '../components/common';
import { store, useGame, useSettings } from '../../game/store';
import { withRng } from '../../game/core';
import { resolveCard, SLOT_NAME } from '../../game/eventcard';
import { introLines, refereeFor } from '../../game/announcer';
import { nameOf } from '../../game/history';
import { audio, TRACKS } from '../../game/audio';
import { loadWalkout } from '../../game/media';
import { arenaTheme, trackForFighter } from '../../game/presentation';
import { readCheckpoint } from '../../game/fightrec';
import { recStr, wfAppearance } from '../../game/fighterGen';
import { DIV, ORG } from '../../data/world';
import type { CardBout } from '../../game/types';

type Stage = 'card' | 'walk1' | 'walk2' | 'intro' | 'faceoff';
const METHOD_SHORT: Record<string, string> = { KO: 'KO', TKO: 'TKO', SUB: 'Submission', UD: 'Unanimous decision', SD: 'Split decision', MD: 'Majority decision', DRAW: 'Draw', DQ: 'DQ' };

export function FightNight() {
  const st = useGame();
  const nav = useNav();
  const settings = useSettings();
  const mode = settings.presentation ?? 'full';
  const sc = st.scheduled;
  const [stage, setStage] = useState<Stage>('card');
  const [lineIdx, setLineIdx] = useState(0);
  const [customName, setCustomName] = useState<string | null>(null);
  const started = useRef(false);

  const enterCage = useCallback(() => {
    audio.stopMusic();
    audio.stopSpeech();
    nav.go('fight');
  }, [nav]);

  // undercard bouts before ours happen now, through the world simulation (idempotent)
  useEffect(() => {
    if (!store.state?.scheduled) { nav.go('hub'); return; }
    if (started.current) return;
    started.current = true;
    const s = store.state;
    // an interrupted fight goes straight back to the cage (its resume prompt appears there)
    if (s.fightInProgress?.snapshot || readCheckpoint(s.slot, s.scheduled!.id)) { nav.go('fight'); return; }
    store.act((g) => { withRng(g, (rng) => resolveCard(g, rng, 'before')); });
    if (mode === 'off') { nav.go('fight'); return; }
    audio.resume();
    audio.startCrowd();
    audio.setCrowdLevel(0.6);
    return () => { audio.stopMusic(); audio.stopSpeech(); };
  }, []);

  useEffect(() => () => { audio.stopMusic(); audio.stopSpeech(); }, []);

  const intro = useMemo(() => (sc ? introLines(st, sc) : null), [sc?.id]);
  const order = useMemo(() => {
    if (!intro) return { first: 'opponent' as const, second: 'player' as const };
    // the champion (or, otherwise, the player as the red corner) walks out last
    return intro.champion === 'opponent' ? { first: 'player' as const, second: 'opponent' as const } : { first: 'opponent' as const, second: 'player' as const };
  }, [intro]);
  const announcerLines = useMemo(() => {
    if (!intro) return [];
    const all = [...intro.lines, ...intro.blue, ...intro.red];
    return mode === 'short' ? [intro.lines[0], intro.blue[intro.blue.length - 1], intro.red[intro.red.length - 1]] : all;
  }, [intro, mode]);

  // stage timers
  const dur = mode === 'short' ? { walk: 3500, line: 1300, face: 2200 } : { walk: 8000, line: 2100, face: 3800 };
  const stageRef = useRef<Stage>('card');
  stageRef.current = stage;
  const next = useCallback(() => {
    const s = stageRef.current;
    if (s === 'card') setStage('walk1');
    else if (s === 'walk1') setStage('walk2');
    else if (s === 'walk2') { setLineIdx(0); setStage('intro'); }
    else if (s === 'intro') setStage('faceoff');
    else enterCage();
  }, [enterCage]);

  // walkout music
  useEffect(() => {
    if (!sc) return;
    if (stage !== 'walk1' && stage !== 'walk2') { if (stage === 'intro') { audio.stopMusic(); audio.setCrowdLevel(1); } return; }
    const who = stage === 'walk1' ? order.first : order.second;
    audio.setCrowdLevel(who === 'player' ? 1.4 : 1);
    if (who === 'player') {
      const t = st.player.walkout?.track ?? 'iron';
      if (t === 'custom') {
        loadWalkout().then((w) => { if (w) { setCustomName(w.name); audio.playUrl(w.url); } else audio.playTrack('iron', 12); });
      } else audio.playTrack(t, 12);
    } else audio.playTrack(trackForFighter(sc.opponentId), 12);
    const id = window.setTimeout(next, dur.walk);
    return () => window.clearTimeout(id);
  }, [stage]);

  // announcer
  useEffect(() => {
    if (stage !== 'intro') return;
    if (lineIdx >= announcerLines.length) { const id = window.setTimeout(next, 600); return () => window.clearTimeout(id); }
    audio.speak(announcerLines[lineIdx]);
    const l = announcerLines[lineIdx];
    if (/[A-Z]{3,}!$/.test(l)) audio.cheer(1.2);
    const id = window.setTimeout(() => setLineIdx((i) => i + 1), dur.line);
    return () => window.clearTimeout(id);
  }, [stage, lineIdx]);

  useEffect(() => {
    if (stage !== 'faceoff') return;
    audio.bell(1);
    const id = window.setTimeout(enterCage, dur.face);
    return () => window.clearTimeout(id);
  }, [stage]);

  // keyboard: Space/Enter skips the current part; Esc skips everything
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (stage === 'intro' && lineIdx < announcerLines.length - 1) setLineIdx(announcerLines.length - 1); else next(); }
      if (e.key === 'Escape') { e.preventDefault(); enterCage(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [stage, lineIdx, announcerLines.length, next, enterCage]);

  if (!sc || !intro) return <div style={{ padding: 40 }} className="muted">No fight booked.</div>;
  const p = st.player;
  const opp = st.world.fighters[sc.opponentId];
  const theme = arenaTheme(sc);
  const org = ORG[sc.orgId];
  const pColor = WALKOUT_COLORS[p.walkout?.color ?? 0] ?? WALKOUT_COLORS[0];
  const entrance = p.walkout?.entrance ?? 'hype';
  const card = [...(sc.card ?? [])].sort((a, b) => b.order - a.order);
  const mine = card.find((c) => c.player);

  const corner = (who: 'player' | 'opponent') => who === 'player'
    ? { name: `${p.firstName} ${p.lastName}`, nick: p.nickname, rec: recStr(sc.amateur ? p.amateurRecord : p.record), nat: p.nationality, ap: p.appearance, color: pColor, champion: intro.champion === 'player' || !!sc.superfight, track: (p.walkout?.track ?? 'iron') === 'custom' ? (customName ?? 'Your track') : TRACKS.find((t) => t.id === (p.walkout?.track ?? 'iron'))?.name ?? 'Iron Pulse', entrance }
    : { name: `${opp.first} ${opp.last}`, nick: opp.nick, rec: recStr(opp.rec), nat: opp.nat, ap: wfAppearance(opp), color: '#60a5fa', champion: intro.champion === 'opponent', track: TRACKS.find((t) => t.id === trackForFighter(opp.id))?.name ?? '', entrance: 'calm' as const };

  const bg = `radial-gradient(70% 55% at 50% 30%, ${theme.gold ? 'rgba(250,204,21,.18)' : 'rgba(255,255,255,.07)'}, transparent 70%), var(--bg)`;

  return (
    <div className="fightnight" style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', background: bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 24px 40px' }}>
        <div className="row between wrap">
          <div>
            <div className="tiny" style={{ letterSpacing: '.25em', fontWeight: 700, color: theme.gold ? 'var(--gold)' : org.color }}>{sc.amateur ? 'AMATEUR SHOW' : org.name.toUpperCase()} · {theme.label.toUpperCase()}</div>
            <h1 style={{ fontSize: 34 }}>{sc.eventName}</h1>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {stage !== 'faceoff' && <Btn size="sm" onClick={next}><SkipForward size={14} /> Skip <span className="tiny dim">(Space)</span></Btn>}
            <Btn size="sm" onClick={enterCage}><FastForward size={14} /> Straight to the cage <span className="tiny dim">(Esc)</span></Btn>
          </div>
        </div>

        {stage === 'card' && (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-title"><h3><Swords size={16} /> Tonight's card</h3><span className="tiny dim">Earlier bouts have already been decided by the world simulation.</span></div>
            <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
            <div style={{ margin: '0 auto' }}><FightPoster data={posterForScheduled(st, sc)} width={250} /></div>
            <div className="grow" style={{ minWidth: 280 }}>
            {(['mainevent', 'comain', 'main', 'prelim'] as CardBout['slot'][]).map((slot) => {
              const rows = card.filter((c) => c.slot === slot);
              if (!rows.length) return null;
              return (
                <div key={slot} style={{ marginBottom: 12 }}>
                  <div className="tiny dim" style={{ letterSpacing: '.15em', fontWeight: 700, marginBottom: 4 }}>{SLOT_NAME[slot].toUpperCase()}</div>
                  {rows.map((c) => <CardRow key={c.id} c={c} mineOrder={mine?.order ?? 0} />)}
                </div>
              );
            })}
            {!card.length && <div className="muted small">A small local show — just your bout tonight.</div>}
            </div>
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}><Btn variant="primary" size="lg" onClick={next}>Head to the locker room <SkipForward size={16} /></Btn></div>
          </div>
        )}

        {(stage === 'walk1' || stage === 'walk2') && (() => {
          const who = stage === 'walk1' ? order.first : order.second;
          const c = corner(who);
          return (
            <div key={stage} className={`walkout ent-${c.entrance}`} style={{ marginTop: 26, textAlign: 'center', ['--wc' as any]: c.color }}>
              <div className="walk-light" />
              <div className="tiny" style={{ letterSpacing: '.3em', fontWeight: 700, color: c.color }}>{who === 'player' ? 'YOUR WALKOUT' : 'MAKING HIS WAY TO THE CAGE'}</div>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}><div className="walk-portrait"><Portrait ap={c.ap} size={210} accent={c.color} mirror={who === 'opponent'} walkout /></div></div>
              {c.champion && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><Belt org={sc.orgId} width={240} /><div className="tag gold" style={{ fontSize: 13 }}><Trophy size={13} /> Champion</div></div>}
              <h1 style={{ fontSize: 44, marginTop: 6 }}>{c.name}</h1>
              {c.nick && <div className="muted" style={{ fontFamily: 'var(--head)', letterSpacing: '.15em', fontSize: 18 }}>"{c.nick.toUpperCase()}"</div>}
              <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 8 }}><NationBadge nation={c.nat} size={18} /><span className="num">{c.rec}</span></div>
              <div className="small muted" style={{ marginTop: 14 }}><Music size={13} style={{ verticalAlign: -2 }} /> {c.track}</div>
            </div>
          );
        })()}

        {stage === 'intro' && (
          <div className="panel" style={{ marginTop: 22, textAlign: 'center', padding: '30px 20px', minHeight: 300 }}>
            <div className="tiny dim" style={{ letterSpacing: '.3em', fontWeight: 700 }}>THE ANNOUNCER</div>
            {sc.title && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}><Belt org={sc.orgId} width={220} label={`${DIV[sc.div ?? p.divisionId].name} championship`} /></div>}
            <div className="col" style={{ gap: 10, marginTop: 16 }}>
              {announcerLines.slice(Math.max(0, lineIdx - 3), lineIdx + 1).map((l, i, arr) => (
                <div key={l + i} style={{ fontFamily: 'var(--head)', fontSize: i === arr.length - 1 ? (/[A-Z]{3,}!$/.test(l) ? 34 : 24) : 17, opacity: i === arr.length - 1 ? 1 : 0.4, letterSpacing: '.03em', animation: 'fade .4s' }}>{l}</div>
              ))}
            </div>
          </div>
        )}

        {stage === 'faceoff' && (
          <div style={{ marginTop: 26, textAlign: 'center' }}>
            <div className="row" style={{ justifyContent: 'center', gap: 30, alignItems: 'center' }}>
              <div className="faceoff-l"><Portrait ap={p.appearance} size={190} accent={pColor} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><div className="vs" style={{ fontSize: 60 }}>VS</div>{sc.title && <Belt org={sc.orgId} width={200} label="On the line" />}</div>
              <div className="faceoff-r"><Portrait ap={wfAppearance(opp)} size={190} accent="#60a5fa" mirror /></div>
            </div>
            <div className="panel" style={{ maxWidth: 640, margin: '20px auto 0' }}>
              <div className="tiny dim" style={{ letterSpacing: '.2em', fontWeight: 700 }}>REFEREE {refereeFor(sc).toUpperCase()}</div>
              <div style={{ marginTop: 6 }}>"You've had your instructions in the back. Protect yourselves at all times, obey my commands. Touch gloves if you want — let's go."</div>
              <div className="tiny dim" style={{ marginTop: 8 }}>{sc.title ? `${org.short} ${DIV[sc.div ?? p.divisionId].name} Championship · 5 rounds` : `${sc.rounds} rounds · ${DIV[sc.div ?? p.divisionId].name}`}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function CardRow({ c, mineOrder }: { c: CardBout; mineOrder: number }) {
    const later = !c.player && !c.result && c.order > mineOrder;
    const r = c.result;
    const a = nameOf(st, c.a), b = nameOf(st, c.b);
    return (
      <div className="row between" style={{ padding: '7px 10px', borderRadius: 8, background: c.player ? 'var(--accentDim)' : 'var(--bg2)', marginBottom: 4, border: c.player ? '1px solid rgba(255,90,54,.4)' : '1px solid transparent' }}>
        <div className="small" style={{ minWidth: 0 }}>
          {c.title && <Trophy size={12} className="gold" style={{ verticalAlign: -1, marginRight: 4 }} />}
          <b className={r && r.w === 0 ? 'green' : ''}>{a}</b> <span className="dim">vs</span> <b className={r && r.w === 1 ? 'green' : ''}>{b}</b>
          <span className="tiny dim"> · {DIV[c.div].name}</span>
        </div>
        <div className="tiny" style={{ textAlign: 'right', flexShrink: 0 }}>
          {c.player ? <span className="accent" style={{ fontWeight: 700 }}>YOUR FIGHT</span>
            : r ? (r.r === 0 ? <span className="muted">{r.note}</span> : <span>{r.w === -1 ? 'Draw' : `${nameOf(st, r.w === 0 ? c.a : c.b).split(' ').slice(-1)[0]} wins`} · {METHOD_SHORT[r.m] ?? r.m} R{r.r}{r.note ? <b className="gold"> · {r.note}</b> : null}</span>)
              : later ? <span className="dim">Later tonight</span> : <span className="dim">—</span>}
        </div>
      </div>
    );
  }
}
