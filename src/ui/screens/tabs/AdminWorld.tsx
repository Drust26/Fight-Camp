import { endReign, VACATE } from '../../../game/reigns';
// Admin world tools (developer/testing controls). Every change affects only this career, marks it as a
// modified career, and destructive actions ask for confirmation first.
import { useMemo, useState } from 'react';
import { Globe2, Search, AlertTriangle } from 'lucide-react';
import { Btn, Confirm, useNav } from '../../components/common';
import { store, useGame } from '../../../game/store';
import { withRng } from '../../../game/core';
import { bout, rankings, vacateAllBelts } from '../../../game/world';
import { addNews, onRetire } from '../../../game/history';
import { advanceDay } from '../../../game/career';
import { activeEvents, resolveEvent } from '../../../game/events';
import { fighterName, recStr } from '../../../game/fighterGen';
import { DIV, DIVISIONS, ORG, ORGS } from '../../../data/world';
import type { DivisionId, GameState, OrgId } from '../../../game/types';
import { t, tx } from '../../../i18n';

type Pending = { title: string; body: string; run: (g: GameState) => string | void } | null;

/** Fighters the player's booked fight depends on (opponent and event card) must not be altered. */
function lockedIds(st: GameState) {
  const s = new Set<string>();
  if (st.scheduled) { s.add(st.scheduled.opponentId); for (const c of st.scheduled.card ?? []) { s.add(c.a); s.add(c.b); } }
  return s;
}

export function AdminWorld() {
  const st = useGame();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [org, setOrg] = useState<string>('all');
  const [div, setDiv] = useState<string>(st.player.divisionId);
  const [sel, setSel] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const locked = lockedIds(st);

  const results = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return Object.values(st.world.fighters)
      .filter((f) => !f.retired && !f.am && (org === 'all' || f.org === org) && (div === 'all' || f.div === div) && (!qq || `${f.first} ${f.last} ${f.nick}`.toLowerCase().includes(qq)))
      .sort((a, b) => b.pts - a.pts).slice(0, 25);
  }, [st.world.fighters, q, org, div, st.day]);
  const f = sel ? st.world.fighters[sel] : null;
  const act = (fn: (g: GameState) => string | void, ok?: string) => {
    const r = store.act((g) => { g.adminUsed = true; return fn(g); });
    nav.toast(tx((typeof r === 'string' ? r : ok) ?? 'Done.'), 'ok');
  };
  const ask = (title: string, body: string, run: (g: GameState) => string | void) => setPending({ title, body, run });

  return (
    <div className="panel">
      <div className="panel-title"><h3><Globe2 size={16} /> {t('World tools')}</h3><span className="tag gold"><AlertTriangle size={11} /> {t('Affects only this career · marks it as modified')}</span></div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
            <div className="row" style={{ gap: 4, flex: 1, minWidth: 160 }}><Search size={14} /><input className="input" placeholder={t('Search fighters…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Search fighters')} /></div>
            <select className="input" style={{ width: 'auto' }} value={org} onChange={(e) => setOrg(e.target.value)} aria-label={t('Filter promotion')}><option value="all">{t('All orgs')}</option>{ORGS.map((o) => <option key={o.id} value={o.id}>{o.short}</option>)}</select>
            <select className="input" style={{ width: 'auto' }} value={div} onChange={(e) => setDiv(e.target.value)} aria-label={t('Filter division')}><option value="all">{t('All divisions')}</option>{DIVISIONS.map((d) => <option key={d.id} value={d.id}>{t(d.name)}</option>)}</select>
          </div>
          <div className="col" style={{ gap: 2, maxHeight: 300, overflow: 'auto' }}>
            {results.map((x) => (
              <button key={x.id} className={`chip ${sel === x.id ? 'on' : ''}`} style={{ justifyContent: 'space-between', display: 'flex', textAlign: 'left' }} onClick={() => setSel(x.id)}>
                <span>{fighterName(x)} {locked.has(x.id) && <span className="tiny gold">· {t('on your card')}</span>}</span>
                <span className="tiny dim">{ORG[x.org].short} {t(DIV[x.div].name)} · {recStr(x.rec)}</span>
              </button>
            ))}
            {!results.length && <div className="small muted">{t('No fighters match.')}</div>}
          </div>
        </div>
        <div>
          {f ? (
            <div className="col" style={{ gap: 8 }}>
              <div><b>{fighterName(f)}</b> <span className="tiny dim">{ORG[f.org].short} {t(DIV[f.div].name)} · {recStr(f.rec)} · {t('{n} pts', { n: Math.round(f.pts) })}</span></div>
              {f.injuredUntil > st.day && <div className="small red">{t('Injured for {n} more days', { n: f.injuredUntil - st.day })}</div>}
              {locked.has(f.id) && <div className="small gold">{t('Booked on your upcoming event — booking, injury and retirement tools are locked for this fighter.')}</div>}
              <div className="row wrap" style={{ gap: 6 }}>
                <Btn size="sm" disabled={locked.has(f.id)} onClick={() => act((g) => { g.world.fighters[f.id].injuredUntil = g.day + 45; }, 'Injured for 45 days.')}>{t('Injure (45 days)')}</Btn>
                <Btn size="sm" onClick={() => act((g) => { g.world.fighters[f.id].injuredUntil = g.day; }, 'Healed.')}>{t('Heal')}</Btn>
                <Btn size="sm" disabled={locked.has(f.id)} onClick={() => act((g) => { g.world.fighters[f.id].bookedUntil = g.day; }, 'Booking cleared.')}>{t('Clear booking')}</Btn>
                <Btn size="sm" onClick={() => act((g) => { g.rivalries[f.id] = Math.max(g.rivalries[f.id] ?? 0, 60); }, 'Rivalry created (heat 60).')}>{t('Make rival')}</Btn>
                <Btn size="sm" onClick={() => act((g) => { g.callout = f.id; }, 'Matchmaking now favours this opponent.')}>{t('Prefer as next opponent')}</Btn>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <Btn size="sm" variant="danger" onClick={() => ask(t('Make champion?'), t(st.world.orgs[f.org].champions[f.div] === 'player' ? '{name} becomes the {org} {div} champion, replacing the current holder — that is YOU, so you would lose your belt.' : '{name} becomes the {org} {div} champion, replacing the current holder.', { name: fighterName(f), org: ORG[f.org].short, div: t(DIV[f.div].name) }), (g) => {
                  const os = g.world.orgs[f.org];
                  if (os.champions[f.div] === 'player') { endReign(g, f.org, f.div, VACATE.admin()); g.player.isChampion = false; g.player.reignStart = null; }
                  const prev = os.champions[f.div];
                  if (prev && prev !== 'player' && g.world.fighters[prev]) g.world.fighters[prev].rgn = null;
                  os.champions[f.div] = f.id;
                  const nf = g.world.fighters[f.id];
                  nf.rgn = g.day;
                  os.titleHistory.push({ day: g.day, div: f.div, champ: f.id, name: fighterName(nf) });
                  addNews(g, { kind: 'title', title: `${fighterName(nf)} installed as ${ORG[f.org].short} champion (admin)`, body: 'Set with the admin tools.', refs: [f.id], org: f.org, div: f.div, imp: 1 });
                  return 'Champion set.';
                })}>{t('Make champion…')}</Btn>
                <Btn size="sm" variant="danger" disabled={locked.has(f.id)} onClick={() => ask(t('Retire fighter?'), t('{name} retires permanently. Any title they hold is vacated. Notable careers enter the Hall of Fame.', { name: fighterName(f) }), (g) => {
                  const nf = g.world.fighters[f.id];
                  nf.retired = true;
                  onRetire(g, nf);
                  vacateAllBelts(g, nf, 'retired (admin)');
                  setSel(null);
                  return 'Retired.';
                })}>{t('Retire…')}</Btn>
              </div>
            </div>
          ) : <div className="small muted">{t('Select a fighter to edit them.')}</div>}
        </div>
      </div>
      <h4 style={{ marginTop: 14 }}>{t('Simulation')}</h4>
      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
        {[7, 30, 90].map((n) => (
          <Btn key={n} size="sm" onClick={() => ask(t('Fast-forward {n} days?', { n }), t('Runs the real day-by-day simulation for up to {n} days. Pending events are auto-resolved with their first choice and new fight offers are left unanswered. Stops at your fight night.', { n }), (g) => {
            let d = 0;
            for (; d < n; d++) {
              for (const e of activeEvents(g)) resolveEvent(g, e.id, 0);
              if (g.scheduled && g.scheduled.day <= g.day) break;
              advanceDay(g);
            }
            return `Simulated ${d} days.`;
          })}>{t('Fast-forward {n} days…', { n })}</Btn>
        ))}
        <Btn size="sm" onClick={() => ask(t('Run a test title fight?'), t('Books an immediate title fight between a champion and a top contender in the selected division (or a random one) using the real world simulation. The result is permanent in this career.'), (g) => {
          const divs: DivisionId[] = div !== 'all' ? [div as DivisionId] : DIVISIONS.map((d) => d.id);
          const orgs: OrgId[] = org !== 'all' ? [org as OrgId] : ORGS.filter((o) => o.tier >= 2).map((o) => o.id);
          for (const o of orgs) for (const dv of divs) {
            const champ = g.world.orgs[o].champions[dv];
            if (!champ || champ === 'player') continue;
            const cf = g.world.fighters[champ];
            const locked2 = lockedIds(g);
            const ch = rankings(g, o, dv).find((r) => !r.isPlayer && r.id !== champ && !locked2.has(r.id) && g.world.fighters[r.id] && g.world.fighters[r.id].injuredUntil <= g.day);
            if (!cf || !ch || locked2.has(champ)) continue;
            const r = withRng(g, (rng) => bout(g, rng, o, cf, g.world.fighters[ch.id], true, false, `${ORG[o].short} Admin Test Card`));
            const w = r.winner === 0 ? cf : r.winner === 1 ? g.world.fighters[ch.id] : null;
            return `${ORG[o].short} ${DIV[dv].name}: ${w ? `${fighterName(w)} wins by ${r.method}` : 'draw'}.`;
          }
          return 'No eligible title fight found for that filter.';
        })}>{t('Run test title fight…')}</Btn>
      </div>
      {pending && <Confirm title={pending.title} body={pending.body} confirm={t('Do it')} danger onNo={() => setPending(null)} onYes={() => { const p = pending; setPending(null); act(p.run); }} />}
    </div>
  );
}
