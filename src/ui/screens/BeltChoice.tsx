// Decision after winning an HFC superfight: keep one belt (the other is vacated) and pick the status boost.
import { useState } from 'react';
import { Crown, Scale } from 'lucide-react';
import { Btn, Modal, useNav } from '../components/common';
import { Belt } from '../components/Belt';
import { store, useGame } from '../../game/store';
import { BOOST, chooseBelt, statusName, tripleHint, SUPER_ORG } from '../../game/superfight';
import { ATTRS, type AttrGroup, type AttrKey } from '../../game/attributes';
import { DIV } from '../../data/world';
import type { DivisionId } from '../../game/types';
import { t, tx } from '../../i18n';

export function BeltChoiceModal() {
  const st = useGame();
  const nav = useNav();
  const p = st.player;
  const pc = p.pendingBeltChoice;
  const [keep, setKeep] = useState<DivisionId | null>(null);
  const [attr, setAttr] = useState<AttrKey | ''>('');
  if (!pc) return null;
  const amt = BOOST[pc.level];
  const groups: AttrGroup[] = ['Physical', 'Striking', 'Grappling', 'Mental'];
  const cut = (d: DivisionId) => { const lim = DIV[d].kg; const pct = Math.max(0, (p.weightKg - lim) / p.weightKg); return pct <= 0 ? t('No weight cut') : t('{pct}% cut from {kg} kg', { pct: (pct * 100).toFixed(1), kg: p.weightKg.toFixed(1) }); };
  return (
    <Modal title={t('{status}! Choose your belt', { status: t(statusName(pc.level)) })} wide>
      <p className="muted" style={{ marginBottom: 12 }}>{t('You hold two HFC belts. Choose the one you will defend from now on — the other is vacated. Your {status} status is permanent.', { status: t(statusName(pc.level)).toLowerCase() })}</p>
      <div className="grid2">
        {[pc.home, pc.won].map((d) => (
          <button key={d} className={`pick ${keep === d ? 'on' : ''}`} onClick={() => setKeep(d)} style={{ alignItems: 'center', textAlign: 'center' }}>
            <Belt org={SUPER_ORG} width={240} label={`${t(DIV[d].name)} · ${DIV[d].lb} lb`} />
            <b>{t('Keep the {div} belt', { div: t(DIV[d].name) })}</b>
            <span className="small muted">{d === pc.home ? t('Your original division') : t('The belt you just won')}{d !== p.divisionId ? ' — ' + t('you move to this division') : ''}</span>
            <span className="tiny"><Scale size={11} style={{ verticalAlign: -1 }} /> {cut(d)}</span>
            <span className="tiny accent">{tx(tripleHint(pc, d))}</span>
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label><Crown size={12} style={{ verticalAlign: -1 }} /> {t('{status} boost: +{n} to one attribute of your choice', { status: t(statusName(pc.level)), n: amt })}</label>
        <select className="input" value={attr} onChange={(e) => setAttr(e.target.value as AttrKey)} aria-label={t('Boost attribute')}>
          <option value="">{t('Choose an attribute…')}</option>
          {groups.map((g) => (
            <optgroup key={g} label={t(g)}>
              {ATTRS.filter((a) => a.group === g).map((a) => <option key={a.key} value={a.key}>{t(a.name)} ({Math.round(p.attrs[a.key])} → {Math.min(99, Math.round(p.attrs[a.key] + amt))})</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <Btn variant="primary" disabled={!keep || !attr} onClick={() => {
          const err = store.act((g) => chooseBelt(g, keep!, attr as AttrKey));
          if (err) nav.toast(tx(err), 'err'); else { store.saveNow(); nav.toast(t('You are the HFC {div} champion — and a {status}.', { div: t(DIV[keep!].name), status: t(statusName(pc.level)).toLowerCase() }), 'ok'); }
        }}>{t('Confirm')}</Btn>
      </div>
    </Modal>
  );
}
