import { useState } from 'react';
import { t, tp, tx } from '../../../i18n';
import { BeltHistoryModal } from '../../components/BeltHistory';
import type { DivisionId, OrgId } from '../../../game/types';
import { Scale, User, LineChart, Shirt } from 'lucide-react';
import { WalkoutPanel } from './WalkoutPanel';
import { lookEditMode } from '../LookScreen';
import { Palette } from 'lucide-react';
import { Belt, BELT_INFO } from '../../components/Belt';
import { ORG } from '../../../data/world';
import { fmtDate as fmtD } from '../../../game/core';
import { AttrRow, Btn, OvrBadge, Portrait, attrColor, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { ATTRS, CATEGORY_DEFS, categoryRatings, overallRating, type AttrGroup } from '../../../game/attributes';
import { injuredAttrs } from '../../../game/training';
import { ageOf, fmtDate, kgToLb, money } from '../../../game/core';
import { BACKGROUND, BODY_TYPE, DIV, DIVISIONS, SHORTS_COLORS } from '../../../data/world';
import { LIFESTYLE } from '../../../data/training';
import { buyShorts, SHORTS_PRICE } from '../../../game/economy';

function Radar({ values }: { values: { label: string; v: number }[] }) {
  const n = values.length, R = 92, cx = 120, cy = 112;
  const pt = (i: number, r: number) => [cx + Math.sin((i / n) * Math.PI * 2) * r, cy - Math.cos((i / n) * Math.PI * 2) * r];
  const poly = values.map((x, i) => pt(i, (x.v / 100) * R).join(',')).join(' ');
  return (
    <svg viewBox="-34 0 308 230" width="100%" style={{ maxWidth: 360 }} role="img" aria-label={t('Category radar chart')}>
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={values.map((_, i) => pt(i, R * k).join(',')).join(' ')} fill="none" stroke="#262b38" />)}
      {values.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#262b38" />; })}
      <polygon points={poly} fill="rgba(255,90,54,0.25)" stroke="#ff5a36" strokeWidth="2" />
      {values.map((x, i) => { const [px, py] = pt(i, R + 16); return <text key={i} x={px} y={py} fill="#9aa3b2" fontSize="10" textAnchor="middle" dominantBaseline="middle">{x.label} {Math.round(x.v)}</text>; })}
    </svg>
  );
}

function OvrChart({ data }: { data: { day: number; ovr: number }[] }) {
  if (data.length < 2) return <div className="muted small">{t('Rating history appears after a few weeks.')}</div>;
  const w = 520, h = 140, pad = 26;
  const min = Math.min(...data.map((d) => d.ovr)) - 2, max = Math.max(...data.map((d) => d.ovr)) + 2;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.ovr)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={t('Overall rating over time')}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#262b38" />
      <path d={`${path} L${x(data.length - 1)},${h - pad} L${x(0)},${h - pad} Z`} fill="rgba(255,90,54,0.12)" />
      <path d={path} fill="none" stroke="#ff5a36" strokeWidth="2" />
      <text x={pad} y={14} fill="#9aa3b2" fontSize="10">{Math.round(max)}</text>
      <text x={pad} y={h - pad - 4} fill="#9aa3b2" fontSize="10">{Math.round(min)}</text>
      <text x={pad} y={h - 6} fill="#6b7385" fontSize="10">{fmtDate(data[0].day, { month: 'short', year: '2-digit' })}</text>
      <text x={w - pad} y={h - 6} fill="#6b7385" fontSize="10" textAnchor="end">{fmtDate(data[data.length - 1].day, { month: 'short', year: '2-digit' })}</text>
    </svg>
  );
}

export function FighterTab() {
  const st = useGame();
  const nav = useNav();
  const curShorts = (st.player.appearance.look?.attire.shorts ?? SHORTS_COLORS[st.player.appearance.shorts]).toLowerCase();
  const p = st.player;
  const eff = injuredAttrs(p);
  const cats = categoryRatings(p.attrs);
  const groups: AttrGroup[] = ['Physical', 'Striking', 'Grappling', 'Mental'];
  const limit = DIV[p.divisionId].kg;
  const cut = Math.max(0, p.weightKg - limit) / p.weightKg;
  const nut = LIFESTYLE.nutrition[p.lifestyle.nutrition];

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Fighter')}</h1><div className="sub">{t('Every number here feeds the fight engine. Hover any attribute to see exactly what it does.')}</div></div></div>
      <div className="grid3">
        <div className="panel">
          <div className="panel-title"><h3><User size={16} /> {t('Profile')}</h3><OvrBadge v={overallRating(p.attrs)} size={46} /></div>
          <div className="row" style={{ gap: 14 }}>
            <div className="col" style={{ gap: 6, alignItems: 'center' }}><Portrait ap={p.appearance} size={96} /><Btn size="sm" onClick={() => { lookEditMode.free = false; nav.go('look'); }}><Palette size={13} /> {t('Customise look')}</Btn></div>
            <div className="small col" style={{ gap: 3 }}>
              <span><b>{p.firstName} {p.lastName}</b>{p.nickname ? ` "${p.nickname}"` : ''}</span>
              <span className="muted">{t(p.nationality)} · {t('{n} years', { n: Math.floor(ageOf(p.bornDay, st.day)) })}</span>
              <span className="muted">{t('{h} cm · reach {r} cm', { h: p.heightCm, r: p.reachCm })} · {t(p.stance)}</span>
              <span className="muted">{t('{bg} base', { bg: t(BACKGROUND[p.background].name) })} · {t(BODY_TYPE[p.bodyType].name)}</span>
              <span className="muted">{t('Learning rate ×{n} (age adjusted in training)', { n: p.talent.toFixed(2) })}</span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}><Shirt size={12} style={{ verticalAlign: -2 }} /> {t('Buy new fight shorts ({price}) — shown in the cage', { price: money(SHORTS_PRICE) })}</div>
            <div className="swatches">{SHORTS_COLORS.map((c, i) => (
              <button key={c} aria-label={t('Shorts colour {n}', { n: i + 1 })} className={`sw ${curShorts === c ? 'on' : ''}`} style={{ background: c }} disabled={curShorts === c}
                onClick={() => { const e = store.act((g) => buyShorts(g, i)); nav.toast(e ? tx(e) : t('New shorts purchased.'), e ? 'err' : 'ok'); }} />
            ))}</div>
          </div>
        </div>
        <div className="panel" style={{ display: 'grid', placeItems: 'center' }}>
          <Radar values={CATEGORY_DEFS.map((c) => ({ label: t(c.name), v: cats[c.id] }))} />
        </div>
        <div className="panel">
          <div className="panel-title"><h3><Scale size={16} /> {t('Weight management')}</h3></div>
          <div className="small col" style={{ gap: 5 }}>
            <div className="row between"><span>{t('Current weight')}</span><b>{p.weightKg.toFixed(1)} kg ({Math.round(kgToLb(p.weightKg))} lb)</b></div>
            <div className="row between"><span>{t('Natural set point')}</span><span>{p.naturalKg.toFixed(1)} kg</span></div>
            <div className="row between"><span>{t('{div} limit', { div: t(DIV[p.divisionId].name) })}</span><span>{limit} kg ({DIV[p.divisionId].lb} lb)</span></div>
            <div className="row between"><span>{t('Fight-week cut needed')}</span><b className={cut > 0.08 ? 'red' : cut > 0.06 ? 'gold' : 'green'}>{(cut * 100).toFixed(1)}%</b></div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>{t('Diet')}</label>
            <div className="row">
              {(['bulk', 'maintain', 'cut'] as const).map((d) => <button key={d} className={`chip ${p.diet === d ? 'on' : ''}`} onClick={() => store.act((g) => { g.player.diet = d; })}>{d === 'bulk' ? t('Bulk (+0.35 kg/wk)') : d === 'maintain' ? t('Maintain') : t('Diet down (−0.5 kg/wk)')}</button>)}
            </div>
          </div>
          <p className="tiny dim">{t('Up to ~6% can be cut safely in fight week. Beyond that you risk missing weight (20% purse fine) and lose gas tank and durability. Dieting down over weeks costs some fatigue and training efficiency; your set point slowly follows your weight. Food plan: {plan}.', { plan: t(nut.name) })}</p>
          <p className="tiny dim">{t('Change division in Settings → Career. Divisions: {list} lb.', { list: DIVISIONS.map((d) => d.lb).join(' / ') })}</p>
        </div>
      </div>
      <div className="grid4">
        {groups.map((g) => (
          <div className="panel" key={g}>
            <div className="panel-title"><h3>{t(g)}</h3></div>
            {ATTRS.filter((a) => a.group === g).map((a) => <AttrRow key={a.key} k={a.key} value={eff[a.key]} base={p.attrs[a.key]} gain={p.recentGains[a.key]} />)}
          </div>
        ))}
      </div>
      <TrophyCase />
      <WalkoutPanel />
      <div className="panel">
        <div className="panel-title"><h3><LineChart size={16} /> {t('Overall rating history')}</h3><span className="tiny dim">{t('Green + = gained since your last fight. Red (−) = injury penalty.')}</span></div>
        <OvrChart data={p.attrHistory} />
      </div>
      <div className="tiny dim">{t('Category scale:')} <span style={{ color: attrColor(30) }}>■ &lt;35</span> <span style={{ color: attrColor(40) }}>■ 35+</span> <span style={{ color: attrColor(55) }}>■ 50+</span> <span style={{ color: attrColor(70) }}>■ 65+</span> <span style={{ color: attrColor(85) }}>■ 80+</span></div>
    </div>
  );
}

function TrophyCase() {
  const st = useGame();
  const p = st.player;
  const [open, setOpen] = useState<{ org: OrgId; div: DivisionId } | null>(null);
  const groups = new Map<string, { org: OrgId; div: DivisionId; days: number[]; reigns: number; defenses: number }>();
  const add = (org: OrgId, div: DivisionId) => {
    const k = `${org}:${div}`;
    if (!groups.has(k)) groups.set(k, { org, div, days: [], reigns: 0, defenses: 0 });
    return groups.get(k)!;
  };
  for (const t of p.titles) add(t.orgId, t.divisionId).days.push(t.day);
  for (const r of p.reigns ?? []) { const g = add(r.org, r.div); g.reigns++; g.defenses += r.defenses.length; if (!g.days.includes(r.start)) g.days.push(r.start); }
  const list = [...groups.values()].sort((a, b) => ORG[b.org].tier - ORG[a.org].tier || a.days[0] - b.days[0]);
  return (
    <div className="panel">
      <div className="panel-title"><h3>{t('Trophy case')}</h3><span className="tiny dim">{list.length ? `${tp('{n} title win', '{n} title wins', p.titles.length)} · ${tp('{n} defense', '{n} defenses', p.titleDefenses)} · ${t('click a belt for its history')}` : t('Win a title to put a belt here.')}</span></div>
      {list.length ? (
        <div className="row wrap" style={{ gap: 18 }}>
          {list.map((g) => {
            const held = st.world.orgs[g.org].champions[g.div] === 'player';
            return (
              <button key={g.org + g.div} className="trophy-belt" style={{ opacity: held ? 1 : 0.85 }} onClick={() => setOpen({ org: g.org, div: g.div })} aria-label={t('{org} {div} belt history', { org: ORG[g.org].short, div: t(DIV[g.div].name) })}>
                <Belt org={g.org} width={230} label={t(DIV[g.div].name)} />
                <div className="small"><b className={held ? 'gold' : ''}>{t(BELT_INFO[g.org].name)}</b>{held && <span className="tag gold" style={{ marginLeft: 6 }}>{t('Current')}</span>}</div>
                <div className="tiny dim">{t('Won {dates}', { dates: [...g.days].sort((a, b) => a - b).map((d) => fmtD(d, { month: 'short', year: 'numeric' })).join(', ') })}{g.reigns ? ` · ${tp('{n} defense', '{n} defenses', g.defenses)}` : ''}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="row wrap" style={{ gap: 14, opacity: 0.35 }}>{(['ifc', 'rfl', 'cms', 'gfc', 'acl'] as const).map((o) => <Belt key={o} org={o} width={150} />)}</div>
      )}
      {open && <BeltHistoryModal st={st} org={open.org} div={open.div} onClose={() => setOpen(null)} />}
    </div>
  );
}
