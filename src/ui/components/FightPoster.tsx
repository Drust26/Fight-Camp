// Generated fight posters. Designed at 600×840 and scaled to any width. The design follows the importance of the
// bout: local show (newsprint), card bout, headliner (main/co-main, rivalry), title fight (black & gold) and superfight.
import { useEffect, useRef, useState } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { Belt } from './Belt';
import { NationBadge } from './common';
import { drawPosterFighter } from '../../combat/fighterArt';
import { DIV } from '../../data/world';
import type { PosterData, PosterSide } from '../../game/poster';

const W = 600, H = 840;

function FighterCanvas({ side, mirror, tier }: { side: PosterSide; mirror?: boolean; tier: PosterData['tier'] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const cw = 360, ch = 470;
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    const tall = side.heightCm ? Math.max(0.94, Math.min(1.06, side.heightCm / 180)) : 1;
    try { drawPosterFighter(ctx, side.look, cw, ch, { mirror, scale: tall }); } catch { /* poster still renders its text */ }
  }, [JSON.stringify(side.look), side.heightCm, mirror]);
  return <canvas ref={ref} className={`pf-fighter ${mirror ? 'right' : 'left'} t-${tier}`} aria-hidden />;
}

const ABBR: Record<string, string> = { fly: 'FLW', bantam: 'BW', feather: 'FW', light: 'LW', welter: 'WW', middle: 'MW', lhw: 'LHW', heavy: 'HW' };

function Name({ side, align, champLabel }: { side: PosterSide; align: 'left' | 'right'; champLabel?: string }) {
  return (
    <div className={`pf-name ${align}`}>
      {side.nick && <div className="pf-nick">“{side.nick}”</div>}
      <div className="pf-first">{side.first}</div>
      <div className="pf-last">{side.last}</div>
      <div className="pf-meta">
        {align === 'right' && <span>{side.rec}</span>}
        <NationBadge nation={side.nat} size={13} />
        {align === 'left' && <span>{side.rec}</span>}
        {side.champion && <span className="pf-champ">{champLabel ?? 'CHAMPION'}</span>}
      </div>
    </div>
  );
}

export function FightPoster({ data, width = 300 }: { data: PosterData; width?: number }) {
  const k = width / W;
  const d = data;
  return (
    <div style={{ width, height: H * k, flexShrink: 0 }} className="pf-wrap">
      <div className={`pf pf-t-${d.tier}`} style={{ transform: `scale(${k})`, ['--org' as any]: d.orgColor }} role="img" aria-label={`Fight poster: ${d.red.first} ${d.red.last} vs ${d.blue.first} ${d.blue.last}, ${d.eventName}`}>
        <div className="pf-bg" />
        {d.tier === 'superfight' && <div className="pf-bigword">SUPERFIGHT</div>}
        {d.tier === 'title' && <div className="pf-bigword gold">CHAMPIONSHIP</div>}
        <div className="pf-top">
          <div className="pf-org" style={d.orgName.length > 22 ? { letterSpacing: '.24em', fontSize: 14 } : undefined}>{d.orgName.toUpperCase()}{d.tier !== 'local' ? ' PRESENTS' : ''}</div>
          <div className="pf-event" style={{ fontSize: Math.min(54, Math.round(860 / Math.max(10, d.eventName.length))) }}>{d.eventName}</div>
          <div className="pf-tag">{d.tagline}</div>
        </div>
        <FighterCanvas side={d.red} tier={d.tier} />
        <FighterCanvas side={d.blue} mirror tier={d.tier} />
        <div className="pf-vs">VS</div>
        <Name side={d.red} align="left" champLabel={d.tier === 'superfight' && d.homeDiv ? `${ABBR[d.homeDiv] ?? ''} CHAMPION` : undefined} />
        <Name side={d.blue} align="right" champLabel={d.tier === 'superfight' ? `${ABBR[d.div] ?? ''} CHAMPION` : undefined} />
        {(d.tier === 'title' || d.tier === 'superfight') && (
          <div className="pf-belts">
            {d.tier === 'superfight' && d.homeDiv
              ? <><div className="pf-beltcol"><Belt org={d.org} width={150} /><span>{DIV[d.homeDiv].name.toUpperCase()} · HELD</span></div><div className="pf-beltcol"><Belt org={d.org} width={150} /><span>{d.divName.toUpperCase()} · AT STAKE</span></div></>
              : <Belt org={d.org} width={180} />}
          </div>
        )}
        {d.titleLine && <div className="pf-titleline">{d.titleLine}</div>}
        <div className="pf-bottom">
          <div className="pf-slot">{d.slotLabel}</div>
          <div className="pf-info">{d.date.toUpperCase()}</div>
          <div className="pf-info dim">{d.venue.toUpperCase()} · {d.divName.toUpperCase()} · {d.lbs} LBS · {d.rounds} ROUNDS</div>
          {d.undercard.length > 0 && <div className="pf-under">ALSO ON THE CARD: {d.undercard.join(' · ').toUpperCase()}</div>}
        </div>
        {d.result && <div className={`pf-stamp ${d.result.won === true ? 'win' : d.result.won === false ? 'loss' : 'draw'}`}>{d.result.text}</div>}
        {d.tier === 'local' && <div className="pf-ticket">ADMIT ONE · DOORS 6PM · CASH AT THE DOOR</div>}
      </div>
    </div>
  );
}

/** Thumbnail that opens the full poster in a viewer. */
export function PosterThumb({ data, width = 120, label }: { data: PosterData; width?: number; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="pf-thumb" onClick={() => setOpen(true)} title="View fight poster" aria-label={`View poster for ${data.eventName}`}>
        <FightPoster data={data} width={width} />
        {label && <span className="tiny">{label}</span>}
      </button>
      {open && <PosterViewer data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PosterButton({ data, label = 'Poster' }: { data: PosterData; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="chip" onClick={(e) => { e.stopPropagation(); setOpen(true); }} title="View fight poster"><ImageIcon size={12} style={{ verticalAlign: -2 }} /> {label}</button>
      {open && <PosterViewer data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PosterViewer({ data, onClose }: { data: PosterData; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const w = Math.min(560, Math.round((window.innerHeight - 90) * (W / H)));
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onClick={(e) => e.stopPropagation()}>
      <div className="col" style={{ alignItems: 'center', gap: 10 }}>
        <FightPoster data={data} width={w} />
        <button className="btn sm" onClick={onClose}><X size={14} /> Close</button>
      </div>
    </div>
  );
}
