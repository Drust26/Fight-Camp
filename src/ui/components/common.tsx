import { badgeFor } from '../../data/nations';
import { t } from '../../i18n';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { resolveLook, type Look } from '../../game/look';
import { drawPortrait } from '../../combat/fighterArt';
import { X } from 'lucide-react';
import { ATTR_BY_KEY, type AttrKey } from '../../game/attributes';
import { HAIR_COLORS, SHORTS_COLORS, SKIN_TONES } from '../../data/world';
import type { Appearance } from '../../game/types';
import { audio } from '../../game/audio';

// ───────────── navigation / toasts
export type Screen = 'title' | 'new' | 'load' | 'settings' | 'credits' | 'hub' | 'prep' | 'fightnight' | 'look' | 'fight' | 'results' | 'practice' | 'retired' | 'quick' | 'quickbout';
export type Tab = 'overview' | 'fighter' | 'training' | 'gym' | 'calendar' | 'offers' | 'rankings' | 'contracts' | 'finances' | 'history' | 'world' | 'settings' | 'admin';

export interface Nav {
  screen: Screen;
  tab: Tab;
  go: (s: Screen) => void;
  setTab: (t: Tab) => void;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}
export const NavCtx = createContext<Nav>(null as any);
export const useNav = () => useContext(NavCtx);

export function Toasts({ items }: { items: { id: number; msg: string; kind: string }[] }) {
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
      ))}
    </div>
  );
}

// ───────────── modal
export function Modal({ children, onClose, wide, xl, title }: { children: React.ReactNode; onClose?: () => void; wide?: boolean; xl?: boolean; title?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`modal ${xl ? 'xl' : wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {(title || onClose) && (
          <div className="row between" style={{ marginBottom: 12 }}>
            {title ? <h2>{title}</h2> : <span />}
            {onClose && <button className="btn ghost sm" onClick={onClose} aria-label={t('Close')}><X size={16} /></button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, body, confirm, danger, onYes, onNo }: { title: string; body: React.ReactNode; confirm: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal onClose={onNo} title={title}>
      <div className="muted" style={{ marginBottom: 18 }}>{body}</div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onNo}>{t('Cancel')}</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onYes}>{confirm}</button>
      </div>
    </Modal>
  );
}

// ───────────── bars & stats
export function Bar({ value, max = 100, color, ghost }: { value: number; max?: number; color?: string; ghost?: number }) {
  return (
    <div className="bar">
      {ghost !== undefined && <i className="ghost" style={{ width: `${Math.min(100, (ghost / max) * 100)}%` }} />}
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

export function attrColor(v: number) {
  return v >= 80 ? '#facc15' : v >= 65 ? '#22c55e' : v >= 50 ? '#60a5fa' : v >= 35 ? '#9aa3b2' : '#ef4444';
}

export function AttrRow({ k, value, gain, base }: { k: AttrKey; value: number; gain?: number; base?: number }) {
  const def = ATTR_BY_KEY[k];
  return (
    <div className="attr-row tip" data-tip={`${t(def.name)}: ${t(def.effect)}`}>
      <div>
        <div className="name">
          <span>{t(def.name)}</span>
          {gain && gain >= 0.05 ? <span className="gain">+{gain.toFixed(1)}</span> : null}
          {base !== undefined && Math.round(base) !== Math.round(value) ? <span className="red tiny">({Math.round(value - base)})</span> : null}
        </div>
        <Bar value={value} color={attrColor(value)} />
      </div>
      <div className="val" style={{ color: attrColor(value) }}>{Math.floor(value)}</div>
    </div>
  );
}

export function Stat({ v, l, cls }: { v: React.ReactNode; l: string; cls?: string }) {
  return (
    <div className="stat">
      <div className={`v ${cls ?? ''}`}>{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

export function OvrBadge({ v, size = 54 }: { v: number; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: `linear-gradient(135deg, ${attrColor(v)}, #1f2430)`, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)' }}>
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <div className="num" style={{ fontSize: size * 0.44, fontWeight: 700, color: '#0b0c10' }}>{Math.round(v)}</div>
        <div style={{ fontSize: size * 0.15, fontWeight: 700, color: '#0b0c10', letterSpacing: '0.1em' }}>OVR</div>
      </div>
    </div>
  );
}

// ───────────── portrait: head & shoulders drawn with the same artwork as the fight renderer
export function Portrait({ ap, size = 120, accent = '#ff5a36', mirror, walkout, look }: { ap: Appearance; size?: number; accent?: string; mirror?: boolean; walkout?: boolean; look?: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const l = useMemo(() => look ?? resolveLook(ap as any), [ap, look]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, size, size, size * 0.12) : ctx.rect(0, 0, size, size); ctx.clip();
    ctx.fillStyle = '#11141b'; ctx.fillRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size * 0.5, size * 0.38, 2, size * 0.5, size * 0.4, size * 0.7);
    g.addColorStop(0, accent + '66'); g.addColorStop(1, 'rgba(11,12,16,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    try { drawPortrait(ctx, l, size, { mirror, walkout }); } catch { /* never break a page over a portrait */ }
    ctx.restore();
  }, [l, size, accent, mirror, walkout]);
  return <canvas ref={ref} style={{ width: size, height: size, borderRadius: size * 0.12, flexShrink: 0, display: 'block' }} aria-hidden />;
}

export function useInterval(fn: () => void, ms: number) {
  useEffect(() => {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }, [fn, ms]);
}

export function ErrorView({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div style={{ height: 'var(--app-h, 100vh)', display: 'grid', placeItems: 'center', padding: 30 }}>
      <div className="panel" style={{ maxWidth: 560 }}>
        <h2 className="accent">{t('Something broke')}</h2>
        <p className="muted">{t('The game hit an unexpected error. Your last autosave is safe in its slot.')}</p>
        <pre className="small" style={{ whiteSpace: 'pre-wrap', background: '#000', padding: 10, borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>{error.message}</pre>
        <button className="btn primary" onClick={onReset}>{t('Return to title')}</button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(e: Error) { console.error(e); }
  render() {
    if (this.state.error) return <ErrorView error={this.state.error} onReset={() => { this.setState({ error: null }); this.props.onReset(); }} />;
    return this.props.children;
  }
}

/** Button with click sound. */
export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) {
  const { variant, size, className, onClick, ...rest } = props;
  return (
    <button
      {...rest}
      className={`btn ${variant ?? ''} ${size ?? ''} ${className ?? ''}`}
      onClick={(e) => { audio.click(); onClick?.(e); }}
    />
  );
}

export function useToggle(init = false): [boolean, () => void, (v: boolean) => void] {
  const [v, setV] = useState(init);
  return [v, () => setV((x) => !x), setV];
}

// ───────────── nation badge (colour bands + code; no emoji flags)
export function NationBadge({ nation, size = 14 }: { nation: string; size?: number }) {
  const b = badgeFor(nation);
  const w = size * 1.5;
  return (
    <span title={t(nation)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
      <span style={{ display: 'inline-flex', flexDirection: b.dir === 'h' ? 'column' : 'row', width: w, height: size, borderRadius: 2, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,.18)' }}>
        {b.colors.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
      </span>
      <span className="tiny" style={{ fontWeight: 700, letterSpacing: '.06em', fontSize: Math.max(10, size * 0.75) }}>{b.code}</span>
    </span>
  );
}

export const WALKOUT_COLORS = ['#ff5a36', '#facc15', '#60a5fa', '#22c55e', '#a78bfa', '#f472b6', '#e2e8f0', '#ef4444'];
