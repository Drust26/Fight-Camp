import { LogoMark } from '../components/Logo';
import { t, tp, tx, weekdayShort } from '../../i18n';
import { tn } from '../../i18n/rich';
import { useMemo, useState } from 'react';
import {
  LayoutDashboard, User, Dumbbell, Building2, CalendarDays, Swords, Trophy, FileSignature, Wallet, History, Settings as Cog, LogOut, Save, Wrench, ChevronsRight, ChevronRight, AlertTriangle, Flame, Globe,
} from 'lucide-react';
import { Btn, Modal, useNav, type Tab } from '../components/common';
import { store, useGame } from '../../game/store';
import { advanceDays } from '../../game/career';
import { activeEvents, EVENT, resolveEvent } from '../../game/events';
import { fmtDate, money, weekday, DAY_NAMES, monthlyTotal, dateOf } from '../../game/core';
import { SESSION } from '../../data/training';
import { injuryRisk } from '../../game/training';
import { playerRank } from '../../game/world';
import { ORG } from '../../data/world';
import { Overview } from './tabs/Overview';
import { FighterTab } from './tabs/FighterTab';
import { TrainingTab } from './tabs/TrainingTab';
import { GymTab } from './tabs/GymTab';
import { CalendarTab } from './tabs/CalendarTab';
import { OffersTab } from './tabs/OffersTab';
import { RankingsTab } from './tabs/RankingsTab';
import { ContractsTab } from './tabs/ContractsTab';
import { FinancesTab } from './tabs/FinancesTab';
import { HistoryTab } from './tabs/HistoryTab';
import { AdminTab } from './tabs/AdminTab';
import { WorldTab } from './tabs/WorldTab';
import { SettingsScreen } from './Settings';
import type { AttrKey } from '../../game/attributes';
import { ATTR_BY_KEY } from '../../game/attributes';
import { CoachTour } from '../Tutorial';
import { BeltChoiceModal } from './BeltChoice';
import { statusName } from '../../game/superfight';
import type { NewsItem } from '../../game/types';

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'fighter', label: 'Fighter', icon: User },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'gym', label: 'Gym & Life', icon: Building2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'offers', label: 'Fight Offers', icon: Swords },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'contracts', label: 'Contracts', icon: FileSignature },
  { id: 'finances', label: 'Finances', icon: Wallet },
  { id: 'history', label: 'Fight History', icon: History },
  { id: 'world', label: 'World', icon: Globe },
];

interface Summary { days: number; reasons: string[]; gains: Partial<Record<AttrKey, number>>; lines: string[]; moneyDelta: number; fatigue: [number, number]; world: NewsItem[] }

export function Hub() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [preview, setPreview] = useState(false);
  const events = activeEvents(st);
  const ev = events[0];
  const fightDay = !!st.scheduled && st.scheduled.day <= st.day;
  const countdown = st.scheduled ? st.scheduled.day - st.day : null;
  const rank = playerRank(st);

  const advance = (n: number) => {
    if (store.state?.player.pendingBeltChoice) { nav.toast(t('Choose which belt to keep first.'), 'err'); return; }
    const before = { money: p.money, fatigue: p.fatigue, day: st.day };
    const res = store.act((g) => advanceDays(g, n));
    const g = store.state!;
    const logs = g.dayLogs.filter((l) => l.day >= before.day);
    const gains: Partial<Record<AttrKey, number>> = {};
    for (const l of logs) for (const [k, v] of Object.entries(l.gains)) gains[k as AttrKey] = (gains[k as AttrKey] ?? 0) + (v as number);
    if (!res) return;
    if (res.days === 0) { nav.toast(tx(res.reasons[0]) || t('Cannot advance.'), 'err'); return; }
    const lines = logs.reverse().flatMap((l) => l.lines.filter((x) => /INJURY|healed|bills|skipped|Worked|preparation|Rehab/i.test(x)).map((x) => `${weekdayShort(weekday(l.day))}: ${tx(x)}`));
    const world = g.world.news.filter((x) => x.day > before.day && x.imp >= 2).slice(0, 6); // news is stored newest-first
    if (n > 1 || res.reasons.length) setSummary({ days: res.days, reasons: res.reasons, gains, lines, moneyDelta: g.player.money - before.money, fatigue: [before.fatigue, g.player.fatigue], world });
    else nav.toast(`${fmtDate(g.day)} — ${logs[0]?.lines.slice(0, 2).map(tx).join(' ') ?? t('Day passed.')}`);
  };

  // week preview: sessions, risks, bills, obligations
  const weekPreview = useMemo(() => {
    const rows: { day: number; s: string[]; risk: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = st.day + i;
      const ids = st.plan.days[weekday(d)].filter(Boolean) as string[];
      rows.push({ day: d, s: ids.map((x) => t(SESSION[x]?.name ?? x)), risk: ids.reduce((r, x) => r + (SESSION[x] ? injuryRisk(st, SESSION[x]) : 0), 0) });
    }
    let bills = 0;
    for (let i = 1; i <= 7; i++) if (dateOf(st.day + i).getUTCDate() === 1) bills = monthlyTotal(st);
    return { rows, bills };
  }, [st]);

  const unread = st.inbox.filter((m) => !m.read).length;
  const badges: Partial<Record<Tab, number>> = { offers: st.offers.length || undefined as any, contracts: (st.contractOffers.length + st.sponsorOffers.length) || undefined as any, overview: unread || undefined as any };

  let content: JSX.Element;
  switch (nav.tab) {
    case 'fighter': content = <FighterTab />; break;
    case 'training': content = <TrainingTab />; break;
    case 'gym': content = <GymTab />; break;
    case 'calendar': content = <CalendarTab />; break;
    case 'offers': content = <OffersTab />; break;
    case 'rankings': content = <RankingsTab />; break;
    case 'contracts': content = <ContractsTab />; break;
    case 'finances': content = <FinancesTab />; break;
    case 'history': content = <HistoryTab />; break;
    case 'world': content = <WorldTab />; break;
    case 'admin': content = <AdminTab />; break;
    case 'settings': content = <><div className="page-head"><h1>{t('Settings')}</h1></div><SettingsScreen /></>; break;
    default: content = <Overview onAdvance={advance} />;
  }

  const save = () => { const r = store.saveNow(); nav.toast(r.ok ? t('Career saved.') : t('Save FAILED: {error}', { error: tx(r.error ?? '') }), r.ok ? 'ok' : 'err'); };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><LogoMark size={34} /><div className="name">FIGHT CAMP<small>{t('CAREER MODE')}</small></div></div>
        <nav className="nav" aria-label={t('Career sections')}>
          {NAV.map((n) => (
            <button key={n.id} data-tour={n.id} className={`nav-item ${nav.tab === n.id ? 'on' : ''}`} onClick={() => nav.setTab(n.id)} title={t(n.label)}>
              <n.icon size={17} /><span className="lbl">{t(n.label)}</span>{badges[n.id] ? <span className="badge">{badges[n.id]}</span> : null}
            </button>
          ))}
          <div className="nav-sep" />
          <button className={`nav-item ${nav.tab === 'settings' ? 'on' : ''}`} onClick={() => nav.setTab('settings')} title={t('Settings')}><Cog size={17} /><span className="lbl">{t('Settings')}</span></button>
          <button data-tour="admin" className={`nav-item ${nav.tab === 'admin' ? 'on' : ''}`} onClick={() => nav.setTab('admin')} title={t('Admin panel')}><Wrench size={17} /><span className="lbl">{t('Admin Panel')}</span></button>
        </nav>
        <div className="side-foot">
          <button className="nav-item" onClick={save} title={t('Save')}><Save size={17} /><span className="lbl">{t('Save')}</span>
            <span className="lbl tiny" style={{ marginLeft: 'auto', color: store.saveStatus.ok ? 'var(--dim)' : 'var(--red)' }}>{store.saveStatus.ok ? (store.saveStatus.at ? t('autosaved') : '') : t('failed!')}</span></button>
          <button className="nav-item" onClick={() => { store.saveNow(); store.set(null); nav.go('title'); }} title={t('Exit to title')}><LogOut size={17} /><span className="lbl">{t('Exit to title')}</span></button>
        </div>
      </aside>
      <header className="topbar">
        <div className="seg"><span className="l">{t('Date')}</span><span className="v">{fmtDate(st.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
        <div className="vsep" />
        <div className="seg"><span className="l">{t('Bank')}</span><span className={`v ${p.money < 0 ? 'red' : ''}`}>{money(p.money)}</span></div>
        <div className="vsep hide-sm" />
        <div className="seg hide-sm"><span className="l">{t('Fatigue')}</span><span className={`v ${p.fatigue > 60 ? 'red' : p.fatigue > 35 ? 'gold' : 'green'}`}>{Math.round(p.fatigue)}%</span></div>
        <div className="vsep hide-sm" />
        <div className="seg hide-sm"><span className="l">{p.isPro ? ORG[p.orgId].short : t('Amateur')}</span><span className="v">{p.isPro ? (st.world.orgs[p.orgId].champions[p.divisionId] === 'player' ? <span className="gold">{(p.champStatus ?? 0) > 0 ? t(statusName(p.champStatus)).toUpperCase() : t('CHAMPION')}</span> : rank ? `#${rank}` : t('Unranked')) : `${p.amateurRecord.w}-${p.amateurRecord.l}`}</span></div>
        {p.injuries.length > 0 && <><div className="vsep" /><span className="tag red"><AlertTriangle size={12} /> {tp('{n} injury', '{n} injuries', p.injuries.length)}</span></>}
        <div className="grow" />
        {st.scheduled && !fightDay && <span className="tag accent hide-sm"><Flame size={12} /> {tp('Fight in {n} day', 'Fight in {n} days', countdown ?? 0)}</span>}
        {fightDay ? (
          <Btn variant="primary" size="lg" className="pulse" onClick={() => nav.go('prep')}><Swords size={18} /> {t('Fight Night')}</Btn>
        ) : (
          <div className="row" style={{ gap: 6 }} data-tour="advance">
            <Btn onClick={() => advance(1)} disabled={p.retired} title={t('Advance one day')}><ChevronRight size={16} /> {t('Next day')}</Btn>
            <Btn variant="primary" onClick={() => (st.seenHelp.weekPreviewOff ? advance(7) : setPreview(true))} disabled={p.retired} title={t('Advance up to 7 days (stops on important news)')}><ChevronsRight size={16} /> {t('Advance week')}</Btn>
            <Btn onClick={() => advance(countdown && countdown > 0 ? countdown : 30)} disabled={p.retired} title={countdown ? t('Advance to fight night (still stops for injuries, offers and events)') : t('Advance up to 30 days (stops on important news)')}>{countdown ? t('To fight') : t('Month')}</Btn>
          </div>
        )}
      </header>
      <main className="main">{content}</main>

      {p.pendingBeltChoice && !summary && <BeltChoiceModal />}
      {ev && !summary && !p.pendingBeltChoice && (() => {
        const tpl = EVENT[ev.templateId];
        let title: string, body: string;
        try { title = tx(tpl.title(st, ev)); body = tx(tpl.body(st, ev)); } catch {
          // never let one bad event lock the career: offer to dismiss it
          return (
            <Modal title={t("An old event can't be shown")}>
              <p className="muted" style={{ marginBottom: 16 }}>{t('This decision no longer applies to your career.')}</p>
              <Btn variant="primary" onClick={() => store.act((g) => { g.pending = g.pending.filter((x) => x.id !== ev.id); })}>{t('Dismiss')}</Btn>
            </Modal>
          );
        }
        return (
          <Modal title={title}>
            <p className="muted" style={{ marginBottom: 16 }}>{body}</p>
            <div className="col">
              {tpl.choices.map((c, i) => {
                const dis = c.disabled?.(st, ev);
                return (
                  <button key={i} className="pick" disabled={!!dis} style={{ opacity: dis ? 0.5 : 1 }} onClick={() => { const msg = store.act((g) => resolveEvent(g, ev.id, i)); nav.toast(tx(msg ?? ''), 'info'); }}>
                    <b>{tx(c.label)}</b><span className="small muted">{tx(dis ?? c.hint)}</span>
                  </button>
                );
              })}
            </div>
            {!tpl.urgent && <p className="tiny dim" style={{ marginTop: 10 }}>{t('Ignored events resolve with the first option after {n} days.', { n: tpl.expires })}</p>}
          </Modal>
        );
      })()}

      {preview && (
        <Modal title={t('Advance week')} onClose={() => setPreview(false)}>
          <table className="tbl">
            <thead><tr><th>{t('Day')}</th><th>{t('Plan')}</th><th>{t('Injury risk')}</th></tr></thead>
            <tbody>{weekPreview.rows.map((r) => (
              <tr key={r.day} style={{ opacity: st.scheduled && r.day >= st.scheduled.day ? 0.4 : 1 }}>
                <td className="small">{fmtDate(r.day, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                <td className="small">{st.scheduled && r.day === st.scheduled.day ? <b className="accent">{t('FIGHT NIGHT — time stops here')}</b> : r.s.length ? r.s.join(' + ') : <span className="dim">{t('Rest')}</span>}</td>
                <td className={`small ${r.risk > 0.04 ? 'red' : r.risk > 0.015 ? 'gold' : 'muted'}`}>{(r.risk * 100).toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
          <div className="small muted" style={{ marginTop: 10 }}>
            {t('Current fatigue {n}% — risk climbs steeply when fatigue is high.', { n: Math.round(p.fatigue) })}{weekPreview.bills ? <> {tn('Monthly bills of {amount} are due this week.', { amount: <b className="gold">{money(weekPreview.bills)}</b> })}</> : null} {t('Time stops early for injuries, offers, events or fight night.')}
          </div>
          <div className="row between" style={{ marginTop: 16 }}>
            <label className="row small muted"><input type="checkbox" onChange={(e) => store.act((g) => { g.seenHelp.weekPreviewOff = e.target.checked; })} /> {t("Don't show this again")}</label>
            <div className="row"><Btn onClick={() => setPreview(false)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={() => { setPreview(false); advance(7); }}>{t('Advance')}</Btn></div>
          </div>
        </Modal>
      )}

      {summary && (
        <Modal title={tp('{n} day later', '{n} days later', summary.days)} onClose={() => setSummary(null)}>
          {summary.reasons.length > 0 && <div className="row wrap" style={{ marginBottom: 12 }}>{summary.reasons.map((r) => <span key={r} className="tag accent">{tx(r)}</span>)}</div>}
          <div className="grid3" style={{ marginBottom: 14 }}>
            <div className="stat"><div className={`v ${summary.moneyDelta >= 0 ? 'green' : 'red'}`}>{summary.moneyDelta >= 0 ? '+' : ''}{money(summary.moneyDelta)}</div><div className="l">{t('Money')}</div></div>
            <div className="stat"><div className="v">{Math.round(summary.fatigue[0])}→{Math.round(summary.fatigue[1])}%</div><div className="l">{t('Fatigue')}</div></div>
            <div className="stat"><div className="v green">+{Object.values(summary.gains).reduce((a, b) => a + (b ?? 0), 0).toFixed(1)}</div><div className="l">{t('Attribute points')}</div></div>
          </div>
          {Object.keys(summary.gains).length > 0 && (
            <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
              {Object.entries(summary.gains).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 12).map(([k, v]) => <span key={k} className="tag green">{t(ATTR_BY_KEY[k as AttrKey].name)} +{(v ?? 0).toFixed(2)}</span>)}
            </div>
          )}
          {summary.world.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="tiny dim" style={{ letterSpacing: '.12em', fontWeight: 700, marginBottom: 4 }}>{t('AROUND THE WORLD')}</div>
              {summary.world.map((n) => <div key={n.id} className="small" style={{ marginBottom: 3 }}>• <b>{tx(n.title)}</b> <span className="muted">— {tx(n.body)}</span></div>)}
              <button className="chip" style={{ marginTop: 4 }} onClick={() => { setSummary(null); nav.setTab('world'); }}>{t('Open the World news feed')}</button>
            </div>
          )}
          {summary.lines.length > 0 && <div className="col small muted" style={{ gap: 3, maxHeight: 180, overflow: 'auto' }}>{summary.lines.map((l, i) => <div key={i} className={/INJURY|BLESSURE/.test(l) ? 'red' : ''}>{l}</div>)}</div>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            {summary.reasons.some((r) => /offer/i.test(r)) && <Btn onClick={() => { setSummary(null); nav.setTab(summary.reasons.some((r) => /Contract/.test(r)) ? 'contracts' : 'offers'); }}>{t('View offers')}</Btn>}
            {summary.reasons.some((r) => /Fight night/i.test(r)) ? <Btn variant="primary" onClick={() => { setSummary(null); nav.go('prep'); }}>{t('Go to fight night')}</Btn> : <Btn variant="primary" onClick={() => setSummary(null)}>{t('Continue')}</Btn>}
          </div>
        </Modal>
      )}
      <CoachTour />
    </div>
  );
}
