// In-career appearance editing. Cosmetics are free except new fight shorts, which keep the existing
// $200 purchase rule (admin edits are free and mark the career as modified).
import { ArrowLeft } from 'lucide-react';
import { Btn, useNav } from '../components/common';
import { AppearanceEditor } from './AppearanceEditor';
import { store, useGame } from '../../game/store';
import { lookFromLegacy, shortsChanged, type Look } from '../../game/look';
import { SHORTS_PRICE } from '../../game/economy';
import { ledger, money } from '../../game/core';

export const lookEditMode = { free: false };

export function LookScreen() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const cur: Look = p.appearance.look ?? lookFromLegacy(p.appearance, p.bodyType);
  const free = lookEditMode.free;
  const back = () => { lookEditMode.free = false; nav.setTab(free ? 'admin' : 'fighter'); nav.go('hub'); };
  const apply = (draft: Look) => {
    const cost = !free && shortsChanged(cur, draft) ? SHORTS_PRICE : 0;
    if (cost && p.money < cost) { nav.toast(`New shorts cost ${money(cost)} — not enough money. Undo the shorts change or come back later.`, 'err'); return; }
    store.act((g) => {
      g.player.appearance.look = draft;
      if (cost) ledger(g, -cost, 'New fight shorts', 'lifestyle');
      if (free) g.adminUsed = true;
    });
    store.saveNow();
    nav.toast(cost ? `Appearance saved. New shorts: −${money(cost)}.` : 'Appearance saved.', 'ok');
    back();
  };
  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', padding: '22px 30px 40px' }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <Btn variant="ghost" onClick={back}><ArrowLeft size={16} /> Back to camp</Btn>
        <h1 style={{ fontSize: 26 }}>Appearance — {p.firstName} {p.lastName}{free ? ' (admin, free)' : ''}</h1>
        <span />
      </div>
      <AppearanceEditor initial={cur} seedName={p.firstName + p.lastName}
        costNote={(d) => (!free && shortsChanged(cur, d) ? `Applying buys new fight shorts for ${money(SHORTS_PRICE)} (other changes are free).` : null)}
        footer={(d, dirty) => (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Btn onClick={back}>Cancel</Btn>
            <Btn variant="primary" disabled={!dirty} onClick={() => apply(d)}>Apply changes</Btn>
          </div>
        )} />
    </div>
  );
}
