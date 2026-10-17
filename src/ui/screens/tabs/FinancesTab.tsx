import { Wallet, Receipt, PieChart } from 'lucide-react';
import { Stat } from '../../components/common';
import { useGame } from '../../../game/store';
import { dateOf, fmtDate, money, monthlyExpenses, monthlyTotal } from '../../../game/core';
import { locale, t, tx } from '../../../i18n';

export function FinancesTab() {
  const st = useGame();
  const p = st.player;
  const exp = monthlyExpenses(st);
  const sponsorIn = st.sponsors.reduce((s, d) => s + d.monthly, 0);
  // monthly net for the last 8 months
  const months: { key: string; inc: number; out: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = dateOf(st.day);
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push({ key: m.toLocaleDateString(locale(), { month: 'short', timeZone: 'UTC' }), inc: 0, out: 0 });
  }
  for (const e of st.ledger) {
    const d = dateOf(e.day);
    const now = dateOf(st.day);
    const idx = 7 - ((now.getUTCFullYear() - d.getUTCFullYear()) * 12 + now.getUTCMonth() - d.getUTCMonth());
    if (idx < 0 || idx > 7) continue;
    if (e.amount > 0) months[idx].inc += e.amount; else months[idx].out -= e.amount;
  }
  const maxM = Math.max(1, ...months.map((m) => Math.max(m.inc, m.out)));
  const byCat: Record<string, number> = {};
  for (const e of st.ledger.filter((x) => st.day - x.day <= 90)) byCat[e.cat] = (byCat[e.cat] ?? 0) + e.amount;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-head"><div><h1>{t('Finances')}</h1><div className="sub">{t("Bills are charged on the 1st of each month. Debt beyond −{amount} forces lifestyle cuts, but you can't go bankrupt.", { amount: money(3000) })}</div></div></div>
      <div className="grid4">
        <div className="panel"><Stat v={money(p.money)} l={t('Balance')} cls={p.money < 0 ? 'red' : 'green'} /></div>
        <div className="panel"><Stat v={money(monthlyTotal(st))} l={t('Monthly costs')} /></div>
        <div className="panel"><Stat v={money(sponsorIn)} l={t('Sponsor income / mo')} /></div>
        <div className="panel"><Stat v={money(p.earningsTotal)} l={t('Career earnings')} cls="gold" /></div>
      </div>
      <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-title"><h3><Wallet size={16} /> {t('Recurring costs')}</h3></div>
          {exp.map((e) => <div key={e.label} className="row between small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}><span>{tx(e.label)}</span><span className="red">−{money(e.amount)}</span></div>)}
          <div className="row between" style={{ paddingTop: 8 }}><b>{t('Total')}</b><b className="red">−{money(monthlyTotal(st))}</b></div>
          <div className="tiny dim" style={{ marginTop: 8 }}>{t('Change these in Gym & Life. Session fees (sparring partners, mats) are charged per session.')}</div>
        </div>
        <div className="panel">
          <div className="panel-title"><h3><PieChart size={16} /> {t('Last 90 days')}</h3></div>
          {Object.entries(byCat).sort((a, b) => a[1] - b[1]).map(([k, v]) => <div key={k} className="row between small" style={{ padding: '4px 0' }}><span style={{ textTransform: 'capitalize' }}>{t(k)}</span><span className={v >= 0 ? 'green' : 'red'}>{v >= 0 ? '+' : ''}{money(v)}</span></div>)}
          {!Object.keys(byCat).length && <div className="muted small">{t('No transactions yet.')}</div>}
        </div>
        <div className="panel">
          <div className="panel-title"><h3>{t('Monthly cash flow')}</h3></div>
          <svg viewBox="0 0 280 150" width="100%" role="img" aria-label={t('Monthly income and expenses')}>
            {months.map((m, i) => {
              const x = 14 + i * 33;
              const hi = (m.inc / maxM) * 110, ho = (m.out / maxM) * 110;
              return (
                <g key={i}>
                  <rect x={x} y={125 - hi} width={12} height={hi} fill="#22c55e" rx="2" />
                  <rect x={x + 13} y={125 - ho} width={12} height={ho} fill="#ef4444" rx="2" opacity="0.8" />
                  <text x={x + 12} y={142} fill="#6b7385" fontSize="9" textAnchor="middle">{m.key}</text>
                </g>
              );
            })}
          </svg>
          <div className="tiny dim"><span className="green">■</span> {t('income')} <span className="red">■</span> {t('spending')}</div>
        </div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px 0' }}><div className="panel-title"><h3><Receipt size={16} /> {t('Transactions')}</h3></div></div>
        <table className="tbl">
          <thead><tr><th>{t('Date')}</th><th>{t('Description')}</th><th>{t('Category')}</th><th style={{ textAlign: 'right' }}>{t('Amount')}</th></tr></thead>
          <tbody>
            {st.ledger.slice(0, 60).map((e, i) => (
              <tr key={i}><td className="small muted">{fmtDate(e.day)}</td><td className="small">{tx(e.label)}</td><td className="small muted">{t(e.cat)}</td><td className={`num ${e.amount >= 0 ? 'green' : 'red'}`} style={{ textAlign: 'right' }}>{e.amount >= 0 ? '+' : ''}{money(e.amount)}</td></tr>
            ))}
            {!st.ledger.length && <tr><td colSpan={4} className="muted small">{t('No transactions yet — bills arrive on the 1st.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
