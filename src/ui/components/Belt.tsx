// Championship belts — an original design per promotion, drawn as SVG (no external images).
// IFC: steel plate on black leather · RFL: bronze shield with green enamel and laurels · CMS: silver globe medallion
// on navy · GFC: gold octagon with violet gem and crown · HFC: grand gold hexagon with ruby stones on crimson leather.
import { t } from '../../i18n';
import { useId } from 'react';
import type { OrgId } from '../../game/types';

type Metal = 'gold' | 'silver' | 'bronze';
const METAL: Record<Metal, [string, string, string, string]> = {
  gold: ['#fff4bf', '#f2c14e', '#b8860b', '#6f4e0a'],
  silver: ['#ffffff', '#d9dee7', '#8b96a8', '#46505f'],
  bronze: ['#ffd9b0', '#d08a45', '#8a5326', '#4e2c12'],
};

export const BELT_INFO: Record<OrgId, { name: string; desc: string }> = {
  ifc: { name: 'IFC Circuit Belt', desc: 'Brushed steel plate on black leather — the first belt most careers ever touch.' },
  rfl: { name: 'RFL Rising Shield', desc: 'Bronze crest with green enamel and laurels, awarded to the league’s best prospect in each division.' },
  cms: { name: 'CMS Continental Medallion', desc: 'A silver globe medallion on navy leather, carried across the continent’s televised cards.' },
  gfc: { name: 'GFC Royal Octagon', desc: 'A gold octagon crowned in violet — the international rival’s statement of prestige.' },
  acl: { name: 'HFC World Championship', desc: 'The grand gold hexagon with six ruby stones. The most important belt in the sport.' },
};

export function Belt({ org, width = 320, label }: { org: OrgId; width?: number; label?: string }) {
  const uid = useId().replace(/:/g, '');
  const g = (m: Metal) => `url(#${uid}-${m})`;
  const strap = { ifc: '#16181d', rfl: '#3a2416', cms: '#10224a', gfc: '#121016', acl: '#5c0b10' }[org];
  const edge = { ifc: '#2a2e36', rfl: '#5a3a24', cms: '#1d3a78', gfc: '#2d2338', acl: '#1a0405' }[org];
  const H = width * (150 / 360);
  return (
    <svg width={width} height={H} viewBox="0 0 360 150" role="img" aria-label={`${t(BELT_INFO[org].name)}${label ? ` — ${label}` : ''}`} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        {(Object.keys(METAL) as Metal[]).map((m) => (
          <linearGradient key={m} id={`${uid}-${m}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={METAL[m][0]} /><stop offset="0.35" stopColor={METAL[m][1]} /><stop offset="0.75" stopColor={METAL[m][2]} /><stop offset="1" stopColor={METAL[m][3]} />
          </linearGradient>
        ))}
        <linearGradient id={`${uid}-strap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={edge} /><stop offset="0.25" stopColor={strap} /><stop offset="0.8" stopColor={strap} /><stop offset="1" stopColor="#000" />
        </linearGradient>
        <radialGradient id={`${uid}-ruby`} cx="0.35" cy="0.35" r="0.7"><stop offset="0" stopColor="#ffb3b3" /><stop offset="0.4" stopColor="#e11d2e" /><stop offset="1" stopColor="#5b0710" /></radialGradient>
        <radialGradient id={`${uid}-amethyst`} cx="0.35" cy="0.35" r="0.7"><stop offset="0" stopColor="#f0d9ff" /><stop offset="0.45" stopColor="#a855f7" /><stop offset="1" stopColor="#3b0764" /></radialGradient>
        <linearGradient id={`${uid}-enamel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={{ ifc: '#2b3240', rfl: '#5fd3a6', cms: '#6ea5ff', gfc: '#c47cff', acl: '#2a0a0d' }[org]} />
          <stop offset="1" stopColor={{ ifc: '#11151c', rfl: '#1f7a57', cms: '#1d4fb8', gfc: '#4c1d95', acl: '#0b0203' }[org]} />
        </linearGradient>
      </defs>

      {/* strap with stitching */}
      <rect x="4" y="50" width="352" height="50" rx="22" fill={`url(#${uid}-strap)`} />
      <rect x="12" y="56" width="336" height="38" rx="17" fill="none" stroke={org === 'acl' ? '#d4a73a' : 'rgba(255,255,255,.22)'} strokeWidth="1.2" strokeDasharray="4 3" opacity={org === 'acl' ? 0.7 : 1} />
      {org === 'acl' && <><rect x="4" y="50" width="352" height="4" fill="#1a0405" /><rect x="4" y="96" width="352" height="4" fill="#1a0405" /></>}

      {org === 'ifc' && (
        <g>
          {[46, 314].map((x) => <g key={x}><rect x={x - 18} y="58" width="36" height="34" rx="5" fill={g('silver')} /><rect x={x - 12} y="64" width="24" height="22" rx="3" fill="none" stroke="#5b6577" strokeWidth="1.5" /></g>)}
          <rect x="120" y="34" width="120" height="82" rx="14" fill={g('silver')} stroke="#3a414d" strokeWidth="1.5" />
          <rect x="130" y="44" width="100" height="62" rx="9" fill={`url(#${uid}-enamel)`} stroke="#8b96a8" strokeWidth="1.5" />
          <rect x="130" y="44" width="100" height="10" rx="5" fill="#8a9bb0" opacity="0.8" />
          <text x="180" y="86" textAnchor="middle" fontFamily="Oswald, Impact, sans-serif" fontWeight="700" fontSize="28" fill={g('silver')} letterSpacing="3">IFC</text>
          <text x="180" y="100" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="7" fill="#aab4c4" letterSpacing="2">CHAMPION</text>
        </g>
      )}

      {org === 'rfl' && (
        <g>
          {[52, 308].map((x) => <path key={x} d={`M${x - 16} 60 h32 v14 q0 14 -16 20 q-16 -6 -16 -20z`} fill={g('bronze')} stroke="#4e2c12" strokeWidth="1" />)}
          {/* laurels */}
          {[-1, 1].map((side) => [0, 1, 2, 3, 4].map((i) => (
            <ellipse key={`${side}${i}`} cx={180 + side * (64 - i * 2)} cy={106 - i * 15} rx="9" ry="4.5" transform={`rotate(${side * (60 - i * 12)} ${180 + side * (64 - i * 2)} ${106 - i * 15})`} fill={g('bronze')} />
          )))}
          <path d="M132 30 h96 v38 q0 36 -48 54 q-48 -18 -48 -54z" fill={g('bronze')} stroke="#4e2c12" strokeWidth="1.5" />
          <path d="M142 40 h76 v28 q0 28 -38 43 q-38 -15 -38 -43z" fill={`url(#${uid}-enamel)`} stroke="#ffd9b0" strokeWidth="1" opacity="0.95" />
          <path d="M180 46 l4.5 9 10 1.4 -7.3 7 1.8 9.9 -9 -4.8 -9 4.8 1.8 -9.9 -7.3 -7 10 -1.4z" fill={g('bronze')} />
          <text x="180" y="94" textAnchor="middle" fontFamily="Oswald, Impact, sans-serif" fontWeight="700" fontSize="20" fill="#fff3e3" letterSpacing="2">RFL</text>
        </g>
      )}

      {org === 'cms' && (
        <g>
          {[40, 92, 268, 320].map((x) => <g key={x}><circle cx={x} cy="75" r="15" fill={g('silver')} /><circle cx={x} cy="75" r="6" fill="#4f8df5" stroke="#d9dee7" strokeWidth="1.5" /></g>)}
          <circle cx="180" cy="75" r="60" fill={g('silver')} stroke="#46505f" strokeWidth="1.5" />
          <circle cx="180" cy="75" r="50" fill="none" stroke="#4f8df5" strokeWidth="6" />
          <circle cx="180" cy="75" r="42" fill={`url(#${uid}-enamel)`} />
          {/* globe */}
          <ellipse cx="180" cy="75" rx="16" ry="42" fill="none" stroke="#dbe7ff" strokeWidth="1.2" opacity="0.8" />
          <ellipse cx="180" cy="75" rx="32" ry="42" fill="none" stroke="#dbe7ff" strokeWidth="1" opacity="0.5" />
          <line x1="138" y1="75" x2="222" y2="75" stroke="#dbe7ff" strokeWidth="1.2" opacity="0.8" />
          <path d="M143 58 q37 10 74 0 M143 92 q37 -10 74 0" stroke="#dbe7ff" strokeWidth="1" fill="none" opacity="0.6" />
          <path d="M124 104 h112 l-7 9 7 9 h-112 l7 -9z" fill={g('silver')} stroke="#46505f" strokeWidth="1" />
          <text x="180" y="117" textAnchor="middle" fontFamily="Oswald, Impact, sans-serif" fontWeight="700" fontSize="10" fill="#10224a" letterSpacing="2">CMS CHAMPION</text>
        </g>
      )}

      {org === 'gfc' && (
        <g>
          {[42, 94, 266, 318].map((x) => <g key={x}><path d={oct(x, 75, 16)} fill={g('gold')} /><circle cx={x} cy="75" r="5.5" fill={`url(#${uid}-amethyst)`} /></g>)}
          <path d={oct(180, 78, 60)} fill={g('gold')} stroke="#6f4e0a" strokeWidth="1.5" />
          <path d={oct(180, 78, 47)} fill={`url(#${uid}-enamel)`} stroke="#fff4bf" strokeWidth="1.2" />
          {/* crown */}
          <path d="M156 22 l8 14 8 -12 8 12 8 -12 8 12 8 -14 -4 22 h-40z" fill={g('gold')} stroke="#6f4e0a" strokeWidth="1" />
          {[156, 172, 188, 204].map((x, i) => <circle key={i} cx={x + (i > 1 ? 8 : 0)} cy={i % 2 ? 24 : 22} r="2.6" fill={`url(#${uid}-amethyst)`} />)}
          <circle cx="180" cy="66" r="12" fill={`url(#${uid}-amethyst)`} stroke={g('gold')} strokeWidth="3" />
          <text x="180" y="100" textAnchor="middle" fontFamily="Oswald, Impact, sans-serif" fontWeight="700" fontSize="20" fill={g('gold')} letterSpacing="3">GFC</text>
          <text x="180" y="110" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="5.2" fill="#f3e8ff" letterSpacing="1">WORLD CHAMPION</text>
        </g>
      )}

      {org === 'acl' && (
        <g>
          {[24, 56, 88, 272, 304, 336].map((x) => <g key={x}><path d={hex(x, 75, 15)} fill={g('gold')} stroke="#6f4e0a" strokeWidth="0.8" /><path d={hex(x, 75, 8)} fill={`url(#${uid}-ruby)`} /></g>)}
          {/* outer hexagon with double border */}
          <path d={hex(180, 75, 74)} fill={g('gold')} stroke="#5a3d06" strokeWidth="2" />
          <path d={hex(180, 75, 65)} fill="none" stroke="#fff4bf" strokeWidth="1.2" opacity="0.8" />
          <path d={hex(180, 75, 56)} fill={`url(#${uid}-enamel)`} stroke={g('gold')} strokeWidth="3" />
          {/* ruby on each vertex */}
          {Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return <circle key={i} cx={180 + Math.cos(a) * 69} cy={75 + Math.sin(a) * 69 * 0.92} r="6" fill={`url(#${uid}-ruby)`} stroke="#fff4bf" strokeWidth="1" />; })}
          {/* hexagon emblem */}
          <path d={hex(180, 56, 15)} fill="none" stroke={g('gold')} strokeWidth="3" />
          <path d={hex(180, 56, 7)} fill={`url(#${uid}-ruby)`} />
          <text x="180" y="96" textAnchor="middle" fontFamily="Oswald, Impact, sans-serif" fontWeight="700" fontSize="24" fill={g('gold')} letterSpacing="4">HFC</text>
          <text x="180" y="106" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="5.4" fill="#f5d27a" letterSpacing="1.2">WORLD CHAMPION</text>
        </g>
      )}
      {label && <text x="180" y="148.5" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="9" fill="#9aa3b2" letterSpacing="2">{label.toUpperCase()}</text>}
    </svg>
  );
}

function oct(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 4) * i + Math.PI / 8; return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`; });
  return `M${pts.join(' L')}Z`;
}
function hex(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * 0.92).toFixed(1)}`; });
  return `M${pts.join(' L')}Z`;
}
