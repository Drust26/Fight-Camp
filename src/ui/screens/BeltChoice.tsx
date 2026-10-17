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
  const cut = (d: DivisionId) => { const lim = DIV[d].kg; const pct = Math.max(0, (p.weightKg - lim) / p.weightKg); return pct <= 0 ? 'No weight cut' : `${(pct * 100).toFixed(1)}% cut from ${p.weightKg.toFixed(1)} kg`; };
  return (
    <Modal title={`${statusName(pc.level)}! Choose your belt`} wide>
      <p className="muted" style={{ marginBottom: 12 }}>You hold two HFC belts. Choose the one you will defend from now on — the other is vacated. Your {statusName(pc.level).toLowerCase()} status is permanent.</p>
      <div className="grid2">
        {[pc.home, pc.won].map((d) => (
          <button key={d} className={`pick ${keep === d ? 'on' : ''}`} onClick={() => setKeep(d)} style={{ alignItems: 'center', textAlign: 'center' }}>
            <Belt org={SUPER_ORG} width={240} label={`${DIV[d].name} · ${DIV[d].lb} lb`} />
            <b>Keep the {DIV[d].name} belt</b>
            <span className="small muted">{d === pc.home ? 'Your original division' : 'The belt you just won'}{d !== p.divisionId ? ' — you move to this division' : ''}</span>
            <span className="tiny"><Scale size={11} style={{ verticalAlign: -1 }} /> {cut(d)}</span>
            <span className="tiny accent">{tripleHint(pc, d)}</span>
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label><Crown size={12} style={{ verticalAlign: -1 }} /> {statusName(pc.level)} boost: +{amt} to one attribute of your choice</label>
        <select className="input" value={attr} onChange={(e) => setAttr(e.target.value as AttrKey)} aria-label="Boost attribute">
          <option value="">Choose an attribute…</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {ATTRS.filter((a) => a.group === g).map((a) => <option key={a.key} value={a.key}>{a.name} ({Math.round(p.attrs[a.key])} → {Math.min(99, Math.round(p.attrs[a.key] + amt))})</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <Btn variant="primary" disabled={!keep || !attr} onClick={() => {
          const err = store.act((g) => chooseBelt(g, keep!, attr as AttrKey));
          if (err) nav.toast(err, 'err'); else { store.saveNow(); nav.toast(`You are the HFC ${DIV[keep!].name} champion — and a ${statusName(pc.level).toLowerCase()}.`, 'ok'); }
        }}>Confirm</Btn>
      </div>
    </Modal>
  );
}
