// In-career appearance editing. Cosmetics are free except new fight shorts, which keep the existing
// $200 purchase rule (admin edits are free and mark the career as modified).
import { ArrowLeft } from 'lucide-react';
import { Btn, useNav } from '../components/common';
import { AppearanceEditor } from './AppearanceEditor';
import { store, useGame } from '../../game/store';
import { lookFromLegacy, shortsChanged, type Look } from '../../game/look';
import { SHORTS_PRICE } from '../../game/economy';
import { ledger, money } from '../../game/core';
import { t } from '../../i18n';

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
    if (cost && p.money < cost) { nav.toast(t('New shorts cost {amount} — not enough money. Undo the shorts change or come back later.', { amount: money(cost) }), 'err'); return; }
    store.act((g) => {
      g.player.appearance.look = draft;
      if (cost) ledger(g, -cost, 'New fight shorts', 'lifestyle');
      if (free) g.adminUsed = true;
    });
    store.saveNow();
    nav.toast(cost ? t('Appearance saved. New shorts: −{amount}.', { amount: money(cost) }) : t('Appearance saved.'), 'ok');
    back();
  };
  return (
    <div style={{ height: 'var(--app-h, 100vh)', overflow: 'auto', padding: '22px 30px 40px' }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <Btn variant="ghost" onClick={back}><ArrowLeft size={16} /> {t('Back to camp')}</Btn>
        <h1 style={{ fontSize: 26 }}>{t('Appearance')} — {p.firstName} {p.lastName}{free ? ' ' + t('(admin, free)') : ''}</h1>
        <span />
      </div>
      <AppearanceEditor initial={cur} seedName={p.firstName + p.lastName}
        costNote={(d) => (!free && shortsChanged(cur, d) ? t('Applying buys new fight shorts for {amount} (other changes are free).', { amount: money(SHORTS_PRICE) }) : null)}
        footer={(d, dirty) => (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Btn onClick={back}>{t('Cancel')}</Btn>
            <Btn variant="primary" disabled={!dirty} onClick={() => apply(d)}>{t('Apply changes')}</Btn>
          </div>
        )} />
    </div>
  );
}
