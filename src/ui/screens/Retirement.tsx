import { Trophy, Crown, Swords, Wallet, Flame } from 'lucide-react';
import { Btn, Portrait, Stat, useNav } from '../components/common';
import { useGame, store } from '../../game/store';
import { legacyRating, legacyTier } from '../../game/career';
import { money, fmtDate } from '../../game/core';
import { ORG, DIV } from '../../data/world';
import { fighterName } from '../../game/fighterGen';

export function Retirement() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const legacy = legacyRating(st);
  const r = p.record;
  const majorWins = p.history.filter((h) => h.result === 'W' && (h.title || ORG[h.orgId].tier >= 4)).slice(0, 6);
  const rivals = Object.entries(st.rivalries).filter(([, v]) => v >= 30).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => st.world.fighters[id]).filter(Boolean);
  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', background: 'radial-gradient(70% 50% at 50% 0%, rgba(250,204,21,.14), transparent 60%), var(--bg)' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '34px 26px 50px' }}>
        <div className="row" style={{ gap: 22, flexWrap: 'wrap' }}>
          <Portrait ap={p.appearance} size={150} accent="#facc15" />
          <div className="grow">
            <div className="tag gold">RETIRED · {fmtDate(st.day, { month: 'long', year: 'numeric' })}</div>
            <h1 style={{ fontSize: 46, marginTop: 8 }}>{p.firstName} {p.nickname ? <span className="muted">"{p.nickname}"</span> : null} {p.lastName}</h1>
            <div className="muted">{DIV[p.divisionId].name} · {p.nationality}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="num gold" style={{ fontSize: 72, lineHeight: 1 }}>{legacy}</div>
            <div className="tiny muted" style={{ letterSpacing: '.15em' }}>LEGACY RATING</div>
            <div style={{ fontFamily: 'var(--head)', fontSize: 20, marginTop: 4 }}>{legacyTier(legacy)}</div>
          </div>
        </div>
        <div className="grid4" style={{ marginTop: 24 }}>
          <div className="panel"><Stat v={`${r.w}-${r.l}${r.d ? '-' + r.d : ''}`} l="Pro record" /></div>
          <div className="panel"><Stat v={r.ko + r.tko + r.sub} l="Finishes" /></div>
          <div className="panel"><Stat v={p.titles.length} l="Championships" cls="gold" /></div>
          <div className="panel"><Stat v={money(p.earningsTotal)} l="Career earnings" /></div>
        </div>
        <div className="grid3" style={{ marginTop: 16 }}>
          <div className="panel">
            <div className="panel-title"><h3><Crown size={16} /> Titles & honours</h3></div>
            {p.titles.length ? p.titles.map((t, i) => <div key={i} className="small">{ORG[t.orgId].name} {DIV[t.divisionId].name} champion ({fmtDate(t.day, { month: 'short', year: 'numeric' })})</div>) : <div className="small muted">No championships.</div>}
            <div className="small muted" style={{ marginTop: 6 }}>Defenses {p.titleDefenses} · Best rank {p.bestRank ? `#${p.bestRank}` : p.titles.length ? 'Champion' : '—'} · FOTN {p.fotn} · POTN {p.potn} · Longest streak {p.bestStreak}</div>
          </div>
          <div className="panel">
            <div className="panel-title"><h3><Trophy size={16} /> Major victories</h3></div>
            {majorWins.length ? majorWins.map((h) => <div key={h.id} className="small">{h.opponentName} — {h.method} R{h.round} {h.title ? '(title)' : ''}</div>) : p.history.filter((h) => h.result === 'W').slice(0, 5).map((h) => <div key={h.id} className="small">{h.opponentName} — {h.method}</div>)}
            {!p.history.some((h) => h.result === 'W') && <div className="small muted">—</div>}
          </div>
          <div className="panel">
            <div className="panel-title"><h3><Flame size={16} /> Rivalries</h3></div>
            {rivals.length ? rivals.map((f) => <div key={f.id} className="small">{fighterName(f)} ({f.vsPlayer.map((v) => (v.result === 'L' ? 'W' : v.result === 'W' ? 'L' : 'D')).join('')})</div>) : <div className="small muted">No lasting rivalries.</div>}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 26, gap: 10 }}>
          <Btn onClick={() => { nav.setTab('history'); nav.go('hub'); }}><Swords size={16} /> Review career</Btn>
          <Btn variant="primary" onClick={() => { store.saveNow(); store.set(null); nav.go('new'); }}><Wallet size={16} /> Start a new career</Btn>
          <Btn variant="ghost" onClick={() => { store.saveNow(); store.set(null); nav.go('title'); }}>Title screen</Btn>
        </div>
        <p className="tiny dim" style={{ textAlign: 'center' }}>Starting a new career asks which slot to use — this save stays untouched unless you choose to overwrite it.</p>
      </div>
    </div>
  );
}
