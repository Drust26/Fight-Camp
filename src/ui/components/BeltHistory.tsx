// Belt history: every reign the player has had with one belt — the fight that won it, each defense,
// and how it ended (lost in the cage, or vacated/stripped with the reason). Each fight can show its poster.
import { Crown, Shield, Flag, DoorOpen, Swords } from 'lucide-react';
import { Modal } from './common';
import { Belt, BELT_INFO } from './Belt';
import { PosterButton } from './FightPoster';
import { DIV, ORG } from '../../data/world';
import { fmtDate } from '../../game/core';
import { posterForHistory } from '../../game/poster';
import type { DivisionId, FightHistoryEntry, GameState, OrgId, Reign } from '../../game/types';

const HOW: Record<Reign['how'], string> = {
  won: 'Won the title',
  vacant: 'Won the vacant title',
  superfight: 'Won the title in a superfight',
  admin: 'Awarded the title (admin tools)',
  unknown: 'Won the title',
};

const dt = (d: number) => fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' });

function FightRow({ st, h, label, icon, tone }: { st: GameState; h: FightHistoryEntry; label: string; icon: React.ReactNode; tone: string }) {
  const res = h.result === 'W' ? 'Won' : h.result === 'L' ? 'Lost' : 'Draw';
  const how = ['UD', 'SD', 'MD', 'DRAW'].includes(h.method) ? h.method : `${h.method} · R${h.round} ${h.time}`;
  return (
    <div className="bh-row">
      <div className={`bh-dot ${tone}`}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="small"><b>{label}</b> <span className="dim">· {dt(h.day)}</span></div>
        <div className="small">{res} vs <b>{h.opponentName}</b> <span className="dim">({h.opponentRecord})</span> — {how}</div>
        <div className="tiny dim">{h.event}{h.bonuses.length ? ` · ${h.bonuses.join(', ')}` : ''}</div>
      </div>
      <PosterButton data={posterForHistory(st, h)} />
    </div>
  );
}

function NoteRow({ label, sub, icon, tone }: { label: string; sub?: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="bh-row">
      <div className={`bh-dot ${tone}`}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="small"><b>{label}</b></div>
        {sub && <div className="tiny dim">{sub}</div>}
      </div>
    </div>
  );
}

export function ReignCard({ st, r, n }: { st: GameState; r: Reign; n: number }) {
  const byId = new Map(st.player.history.map((h) => [h.id, h]));
  const won = r.wonIn ? byId.get(r.wonIn) : undefined;
  const steps = [...r.defenses.map((id) => ({ id, draw: false })), ...(r.draws ?? []).map((id) => ({ id, draw: true }))]
    .map((x) => ({ ...x, h: byId.get(x.id) }))
    .filter((x): x is { id: string; draw: boolean; h: FightHistoryEntry } => !!x.h)
    .sort((a, b) => a.h.day - b.h.day);
  const lostIn = r.end?.kind === 'lost' && r.end.fightId ? byId.get(r.end.fightId) : undefined;
  const held = !r.end && st.world.orgs[r.org]?.champions[r.div] === 'player';
  const endDay = r.end?.day ?? st.day;
  const days = Math.max(0, endDay - r.start);
  let def = 0;
  return (
    <div className="bh-reign">
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <b>Reign {n}</b>
        <span className="tiny dim">{dt(r.start)} – {r.end ? dt(r.end.day) : 'present'} · {days} days · {r.defenses.length} defense{r.defenses.length === 1 ? '' : 's'}</span>
      </div>
      <div className="bh-steps">
        {won
          ? <FightRow st={st} h={won} label={HOW[r.how]} icon={<Crown size={13} />} tone="gold" />
          : <NoteRow label={HOW[r.how]} sub={`${dt(r.start)}${r.how === 'admin' ? '' : ' · fight details were not recorded'}`} icon={<Crown size={13} />} tone="gold" />}
        {steps.map((s) => s.draw
          ? <FightRow key={s.id} st={st} h={s.h} label="Drawn defense — title retained" icon={<Shield size={13} />} tone="dim" />
          : <FightRow key={s.id} st={st} h={s.h} label={`Defense #${++def}`} icon={<Shield size={13} />} tone="green" />)}
        {r.end?.kind === 'lost' && (lostIn
          ? <FightRow st={st} h={lostIn} label="Lost the title" icon={<Swords size={13} />} tone="red" />
          : <NoteRow label="Lost the title" sub={`${r.end.reason} · ${dt(r.end.day)}`} icon={<Swords size={13} />} tone="red" />)}
        {r.end && r.end.kind !== 'lost' && (
          <NoteRow label={r.end.kind === 'stripped' ? 'Stripped of the title' : 'Vacated the title'} sub={`${r.end.reason} · ${dt(r.end.day)}`} icon={r.end.kind === 'stripped' ? <Flag size={13} /> : <DoorOpen size={13} />} tone={r.end.kind === 'stripped' ? 'red' : 'dim'} />
        )}
        {!r.end && (held
          ? <NoteRow label="Current champion" sub={`Reign ongoing · ${days} days so far`} icon={<Crown size={13} />} tone="gold" />
          : <NoteRow label="Title no longer held" sub="How the reign ended was not recorded" icon={<DoorOpen size={13} />} tone="dim" />)}
      </div>
    </div>
  );
}

export function BeltHistoryModal({ st, org, div, onClose }: { st: GameState; org: OrgId; div: DivisionId; onClose: () => void }) {
  const reigns = (st.player.reigns ?? []).filter((r) => r.org === org && r.div === div).sort((a, b) => a.start - b.start);
  return (
    <Modal onClose={onClose} wide title={`${ORG[org].short} ${DIV[div].name} championship`}>
      <div className="col" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Belt org={org} width={200} label={DIV[div].name} />
          <div>
            <div><b>{BELT_INFO[org].name}</b></div>
            <div className="tiny dim">{ORG[org].name} · {DIV[div].name} ({DIV[div].lb} lbs)</div>
            <div className="small" style={{ marginTop: 4 }}>{reigns.length} reign{reigns.length === 1 ? '' : 's'} · {(() => { const n = reigns.reduce((s, r) => s + r.defenses.length, 0); return `${n} successful defense${n === 1 ? '' : 's'}`; })()}</div>
          </div>
        </div>
        {reigns.length
          ? reigns.map((r, i) => <ReignCard key={r.id} st={st} r={r} n={i + 1} />)
          : <div className="small muted">No reign records for this belt.</div>}
      </div>
    </Modal>
  );
}
