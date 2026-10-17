import { startReign } from '../../../game/reigns';
import { useState } from 'react';
import { Wrench, HeartPulse, Trophy, User, Wallet, Sliders } from 'lucide-react';
import { Btn, useNav, attrColor } from '../../components/common';
import { AdminWorld } from './AdminWorld';
import { lookEditMode } from '../LookScreen';
import { superfightProgress } from '../../../game/superfight';
import { store, useGame } from '../../../game/store';
import { ATTRS, overallRating, type AttrGroup, type AttrKey } from '../../../game/attributes';
import { ACCESSORIES, DIVISIONS, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLES, ORGS, ORG, SHORTS_COLORS, SKIN_TONES } from '../../../data/world';
import { ageOf, money } from '../../../game/core';
import { INJURIES } from '../../../data/training';
import type { DivisionId, GameState, OrgId, FightRecord } from '../../../game/types';
import { t, tx } from '../../../i18n';

const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0));

function NumField({ id, label, value, min, max, step = 1, onSet }: { id: string; label: string; value: number; min: number; max: number; step?: number; onSet: (v: number) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{t(label)}</label>
      <input id={id} className="input" type="number" min={min} max={max} step={step} value={Math.round(value * 100) / 100} onChange={(e) => onSet(num(e.target.value, min, max))} />
    </div>
  );
}

export function AdminTab() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const [showWorld, setShowWorld] = useState(false);
  const set = (fn: (g: GameState) => void) => store.act((g) => { g.adminUsed = true; fn(g); });
  const groups: AttrGroup[] = ['Physical', 'Striking', 'Grappling', 'Mental'];
  const setAll = (v: number | ((x: number) => number)) => set((g) => { for (const a of ATTRS) g.player.attrs[a.key] = Math.max(1, Math.min(99, typeof v === 'number' ? v : v(g.player.attrs[a.key]))); });
  const rec = (key: 'record' | 'amateurRecord', k: keyof FightRecord, v: number) => set((g) => { g.player[key][k] = v; });

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head">
        <div><h1>{t('Admin Panel')}</h1><div className="sub">{t('Edit anything about your fighter. Changes apply instantly and are saved with the career.')}</div></div>
        <div className="row" style={{ gap: 6 }}>{st.adminUsed && <span className="tag" title={t('Admin tools have changed this career')}>{t('Modified career')}</span>}<span className="tag gold"><Wrench size={12} /> {t('Overall {n}', { n: overallRating(p.attrs) })}</span></div>
      </div>

      <div className="panel">
        <div className="panel-title"><h3><Sliders size={16} /> {t('Attributes')}</h3>
          <div className="row wrap" style={{ gap: 6 }}>
            <Btn size="sm" onClick={() => setAll(99)}>{t('Max all (99)')}</Btn>
            <Btn size="sm" onClick={() => setAll((x) => x + 5)}>{t('+5 all')}</Btn>
            <Btn size="sm" onClick={() => setAll((x) => x - 5)}>{t('−5 all')}</Btn>
            <Btn size="sm" onClick={() => setAll(50)}>{t('Reset all to 50')}</Btn>
          </div>
        </div>
        <div className="grid4">
          {groups.map((g) => (
            <div key={g} className="col" style={{ gap: 6 }}>
              <h4>{t(g)}</h4>
              {ATTRS.filter((a) => a.group === g).map((a) => (
                <div key={a.key} className="row" style={{ gap: 8 }}>
                  <label htmlFor={`adm-${a.key}`} className="small grow" title={t(a.effect)}>{t(a.name)}</label>
                  <input id={`adm-${a.key}`} type="range" min={1} max={99} value={Math.round(p.attrs[a.key])} style={{ width: 90 }}
                    onChange={(e) => set((s) => { s.player.attrs[a.key as AttrKey] = +e.target.value; })} />
                  <span className="num small" style={{ width: 24, textAlign: 'right', color: attrColor(p.attrs[a.key]) }}>{Math.round(p.attrs[a.key])}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-title"><h3><User size={16} /> {t('Identity & body')}</h3></div>
          <div className="col">
            <div className="grid2">
              <div className="field"><label htmlFor="adm-first">{t('First name')}</label><input id="adm-first" className="input" value={p.firstName} onChange={(e) => set((g) => { g.player.firstName = e.target.value; })} /></div>
              <div className="field"><label htmlFor="adm-last">{t('Last name')}</label><input id="adm-last" className="input" value={p.lastName} onChange={(e) => set((g) => { g.player.lastName = e.target.value; })} /></div>
            </div>
            <div className="field"><label htmlFor="adm-nick">{t('Nickname')}</label><input id="adm-nick" className="input" value={p.nickname} onChange={(e) => set((g) => { g.player.nickname = e.target.value; })} /></div>
            <div className="grid2">
              <NumField id="adm-age" label="Age" value={Math.floor(ageOf(p.bornDay, st.day))} min={16} max={50} onSet={(v) => set((g) => { g.player.bornDay = g.day - Math.round(v * 365); })} />
              <NumField id="adm-talent" label="Learning rate ×" value={p.talent} min={0.5} max={3} step={0.05} onSet={(v) => set((g) => { g.player.talent = v; })} />
              <NumField id="adm-h" label="Height (cm)" value={p.heightCm} min={150} max={215} onSet={(v) => set((g) => { g.player.heightCm = v; })} />
              <NumField id="adm-r" label="Reach (cm)" value={p.reachCm} min={145} max={230} onSet={(v) => set((g) => { g.player.reachCm = v; })} />
              <NumField id="adm-w" label="Weight (kg)" value={p.weightKg} min={45} max={150} step={0.1} onSet={(v) => set((g) => { g.player.weightKg = v; })} />
              <NumField id="adm-nw" label="Natural weight (kg)" value={p.naturalKg} min={45} max={150} step={0.1} onSet={(v) => set((g) => { g.player.naturalKg = v; })} />
            </div>
            <div className="grid2">
              <div className="field"><label htmlFor="adm-stance">{t('Stance')}</label>
                <select id="adm-stance" className="input" value={p.stance} onChange={(e) => set((g) => { g.player.stance = e.target.value as any; })}><option value="orthodox">{t('Orthodox')}</option><option value="southpaw">{t('Southpaw')}</option></select></div>
              <div className="field"><label htmlFor="adm-div">{t('Division (no restrictions)')}</label>
                <select id="adm-div" className="input" value={p.divisionId} disabled={!!st.scheduled} onChange={(e) => set((g) => { g.player.divisionId = e.target.value as DivisionId; g.offers = []; })}>{DIVISIONS.map((d) => <option key={d.id} value={d.id}>{t(d.name)}</option>)}</select></div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <Btn size="sm" onClick={() => { lookEditMode.free = true; nav.go('look'); }}>{t('Open appearance editor (free)')}</Btn>
              <span className="tiny dim">{t('Hair, facial hair, tattoos, face, body and attire — no shorts charge from here.')}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title"><h3><HeartPulse size={16} /> {t('Condition & fame')}</h3></div>
          <div className="grid2">
            <NumField id="adm-fat" label="Fatigue %" value={p.fatigue} min={0} max={100} onSet={(v) => set((g) => { g.player.fatigue = v; })} />
            <NumField id="adm-sharp" label="Sharpness %" value={p.sharpness} min={0} max={100} onSet={(v) => set((g) => { g.player.sharpness = v; })} />
            <NumField id="adm-wear" label="Career wear %" value={p.wear} min={0} max={100} onSet={(v) => set((g) => { g.player.wear = v; })} />
            <NumField id="adm-pop" label="Popularity" value={p.popularity} min={0} max={100} onSet={(v) => set((g) => { g.player.popularity = v; })} />
            <NumField id="adm-rep" label="Reputation" value={p.reputation} min={0} max={100} onSet={(v) => set((g) => { g.player.reputation = v; })} />
            <NumField id="adm-promo" label="Promoter relation" value={st.promoterRelation} min={-50} max={50} onSet={(v) => set((g) => { g.promoterRelation = v; })} />
          </div>
          <div className="small muted" style={{ margin: '10px 0 6px' }}>
            {t('Injuries:')} {p.injuries.length ? p.injuries.map((i) => t(INJURIES[i.type].name)).join(', ') : t('none')} · {t('Suspension:')} {p.medicalSuspensionUntil > st.day ? t('{n} days', { n: p.medicalSuspensionUntil - st.day }) : t('none')}
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <Btn size="sm" onClick={() => set((g) => { g.player.injuries = []; g.player.medicalSuspensionUntil = g.day; })}>{t('Heal injuries & clear suspension')}</Btn>
            <Btn size="sm" onClick={() => set((g) => { g.player.fatigue = 0; g.player.sharpness = 100; })}>{t('Fresh & sharp')}</Btn>
            <Btn size="sm" onClick={() => set((g) => { g.player.wear = 0; })}>{t('Reset wear')}</Btn>
          </div>
          <h4 style={{ marginTop: 14 }}>{t('Weight cut')}</h4>
          <Btn size="sm" onClick={() => set((g) => { g.player.weightKg = DIVISIONS.find((d) => d.id === g.player.divisionId)!.kg; g.player.naturalKg = g.player.weightKg; })}>{t('Walk around exactly at the limit')}</Btn>
        </div>

        <div className="panel">
          <div className="panel-title"><h3><Wallet size={16} /> {t('Money & career')}</h3></div>
          <div className="grid2">
            <NumField id="adm-money" label="Bank ($)" value={p.money} min={-1e6} max={1e9} step={100} onSet={(v) => set((g) => { g.player.money = v; })} />
            <NumField id="adm-pts" label="Ranking points" value={p.rankPoints} min={0} max={1000} onSet={(v) => set((g) => { g.player.rankPoints = v; })} />
          </div>
          <div className="row wrap" style={{ gap: 6, margin: '8px 0' }}>
            {[1000, 10000, 100000, 1000000].map((v) => <Btn key={v} size="sm" onClick={() => set((g) => { g.player.money += v; })}>+{money(v)}</Btn>)}
          </div>
          <div className="field" style={{ marginTop: 6 }}><label htmlFor="adm-org">{t('Promotion (signs a fresh 4-fight deal)')}</label>
            <select id="adm-org" className="input" value={p.isPro ? p.orgId : ''} disabled={!!st.scheduled} onChange={(e) => set((g) => {
              const org = e.target.value as OrgId; const o = ORG[org];
              if (g.player.isChampion) { g.world.orgs[g.player.orgId].champions[g.player.divisionId] = null; g.player.isChampion = false; }
              g.player.isPro = true; g.player.orgId = org; g.offers = [];
              g.player.contract = { orgId: org, fightsTotal: 4, fightsLeft: 4, purse: o.purse, winBonus: o.winBonus, signingBonus: 0, exclusive: o.tier >= 2, champClause: o.tier >= 3, amateur: false, signedDay: g.day };
            })}>
              {!p.isPro && <option value="">{t('Amateur')}</option>}
              {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select></div>
          <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
            <Btn size="sm" disabled={!p.isPro || p.isChampion} onClick={() => set((g) => {
              const os = g.world.orgs[g.player.orgId]; os.champions[g.player.divisionId] = 'player'; g.player.isChampion = true;
              g.player.titles.push({ orgId: g.player.orgId, divisionId: g.player.divisionId, day: g.day });
              os.titleHistory.push({ day: g.day, div: g.player.divisionId, champ: 'player', name: `${g.player.firstName} ${g.player.lastName}` });
              g.player.reignDefenses = 0; g.player.reignStart = g.day; g.player.superNextAt = undefined;
              startReign(g, g.player.orgId, g.player.divisionId, null, 'admin');
            })}><Trophy size={13} /> {t('Make me champion')}</Btn>
            <Btn size="sm" disabled={!!st.scheduled} onClick={() => set((g) => { g.lastOfferDay = -999; g.offers = []; g.restWaivedFor = g.player.history[0]?.id; })}>{t('Allow new offers now')}</Btn>
          </div>
          <h4 style={{ marginTop: 14 }}>{t('HFC superfights')}</h4>
          <div className="grid3" style={{ marginTop: 6 }}>
            <NumField id="adm-reign-def" label="Consecutive defenses (current belt)" value={p.reignDefenses ?? 0} min={0} max={30} onSet={(v) => set((g) => { g.player.reignDefenses = v; g.player.superNextAt = undefined; })} />
            <div className="field"><label htmlFor="adm-status">{t('Champion status')}</label>
              <select id="adm-status" className="input" value={p.champStatus ?? 0} onChange={(e) => set((g) => { const v = +e.target.value as 0 | 1 | 2; g.player.champStatus = v; g.player.superOrigin = v === 0 ? null : g.player.superOrigin ?? g.player.divisionId; })}>
                <option value={0}>{t('None')}</option><option value={1}>{t('Double champion')}</option><option value={2}>{t('Triple champion')}</option>
              </select></div>
            <div className="field"><label htmlFor="adm-origin">{t('Superfight run started in')}</label>
              <select id="adm-origin" className="input" value={p.superOrigin ?? ''} onChange={(e) => set((g) => { g.player.superOrigin = (e.target.value || null) as DivisionId | null; })}>
                <option value="">{t('— (set automatically)')}</option>{DIVISIONS.map((d) => <option key={d.id} value={d.id}>{t(d.name)}</option>)}
              </select></div>
          </div>
          <div className="tiny dim" style={{ marginTop: 4 }}>{tx(superfightProgress(st) ?? 'Superfights are only offered to HFC champions.')}</div>
          <h4 style={{ marginTop: 14 }}>{t('Records')}</h4>
          {(['record', 'amateurRecord'] as const).map((key) => (
            <div key={key} className="grid3" style={{ marginTop: 6 }}>
              {(['w', 'l', 'd'] as const).map((k) => (
                <NumField key={k} id={`adm-${key}-${k}`} label={`${key === 'record' ? 'Pro' : 'Am'} ${k === 'w' ? 'wins' : k === 'l' ? 'losses' : 'draws'}`} value={p[key][k]} min={0} max={200} onSet={(v) => rec(key, k, v)} />
              ))}
            </div>
          ))}
          <div className="grid3" style={{ marginTop: 6 }}>
            {(['ko', 'tko', 'sub'] as const).map((k) => <NumField key={k} id={`adm-fin-${k}`} label={`Pro ${k.toUpperCase()} wins`} value={p.record[k]} min={0} max={200} onSet={(v) => rec('record', k, v)} />)}
          </div>
        </div>
      </div>
      {showWorld ? <AdminWorld /> : <div className="row"><Btn onClick={() => setShowWorld(true)}>{t('Show world & testing tools…')}</Btn><span className="tiny dim">{t('Developer controls for other fighters, titles and simulation.')}</span></div>}
      <div className="row"><Btn onClick={() => { const r = store.saveNow(); nav.toast(r.ok ? t('Saved.') : t('Save failed: {err}', { err: r.error ?? '' }), r.ok ? 'ok' : 'err'); }}>{t('Save now')}</Btn></div>
    </div>
  );
}
