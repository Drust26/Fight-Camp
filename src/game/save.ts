// Persistent save slots (browser storage, or files in Documents/FightCamp/saves in the desktop app) with schema
// versioning, validation and migration.
// Never deletes a career silently: unreadable data is kept and reported.
import { native, storage } from './storage';
import { SAVE_VERSION } from './core';
import { pruneEvents } from './events';
import { lookFromLegacy, sanitizeLook } from './look';
import { backfillTimeline } from './history';
import { backfillReigns, rebuildReigns, repairHistoryDates } from './reigns';
import type { GameState, Settings } from './types';
import LZ from 'lz-string';

// Saves are LZ-compressed (≈10× smaller). Older uncompressed saves still load.
const LZ_PREFIX = 'LZ1:';
export const encodeSave = (json: string) => LZ_PREFIX + LZ.compressToUTF16(json);
export function decodeSave(raw: string): string {
  if (!raw.startsWith(LZ_PREFIX)) return raw;
  const out = LZ.decompressFromUTF16(raw.slice(LZ_PREFIX.length));
  if (!out) throw new Error('Could not decompress save');
  return out;
}

/**
 * How a career is written: the desktop app keeps plain, readable JSON files (disk space is not a concern there); the
 * browser keeps them compressed (its storage is ~5 MB). Both formats always load.
 */
export function careerData(json: string): string {
  return native ? JSON.stringify(JSON.parse(json), null, 2) : encodeSave(json);
}

export const SLOTS = [1, 2, 3];
const KEY = (slot: number) => `fightcamp.slot.${slot}`;
const BACKUP = (slot: number) => `fightcamp.slot.${slot}.bak`;
const META = 'fightcamp.meta';

export interface SlotInfo {
  slot: number;
  status: 'empty' | 'ok' | 'corrupt' | 'newer';
  name?: string;
  record?: string;
  day?: number;
  ovr?: number;
  savedAt?: number;
  retired?: boolean;
  modified?: boolean;
  error?: string;
}

export const DEFAULT_BINDINGS: Record<string, string> = {
  fwd: 'w', back: 's', left: 'a', right: 'd',
  jab: 'j', cross: 'k', hook: 'l', upper: 'u', body: 'i', elbow: 'o',
  lowkick: 'n', bodykick: 'm', headkick: 'h', teep: 'b', knee: 'y',
  guard: 'q', low: 'c', evade: ' ', power: 'shift',
  clinch: 'e', takedown: 'r', sub: 'g', advance: 'f',
};

export const DEFAULT_SETTINGS: Settings = {
  master: 0.7, sfx: 0.8, crowd: 0.5, muted: false, roundSeconds: 90, reducedMotion: false, hints: true, bindings: { ...DEFAULT_BINDINGS },
};

export function loadSettings(): Settings {
  try {
    const raw = storage.getItem(META);
    if (!raw) return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
    const m = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(m.settings ?? {}), bindings: { ...DEFAULT_BINDINGS, ...(m.settings?.bindings ?? {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  }
}
export function saveSettings(s: Settings) {
  try {
    const raw = storage.getItem(META);
    const m = raw ? JSON.parse(raw) : {};
    storage.setItem(META, JSON.stringify({ ...m, settings: s }));
  } catch { /* storage unavailable */ }
}
export function lastSlot(): number | null {
  try {
    const raw = storage.getItem(META);
    return raw ? JSON.parse(raw).lastSlot ?? null : null;
  } catch { return null; }
}
function setLastSlot(slot: number) {
  try {
    const raw = storage.getItem(META);
    const m = raw ? JSON.parse(raw) : {};
    storage.setItem(META, JSON.stringify({ ...m, lastSlot: slot }));
  } catch { /* ignore */ }
}

/** The version whose "What's new" the player last saw; `played` tells a returning player from a first run. */
export function seenVersion(): { seen: string | null; played: boolean } {
  try {
    const raw = storage.getItem(META);
    if (!raw) return { seen: null, played: SLOTS.some((s) => !!storage.getItem(KEY(s))) };
    const m = JSON.parse(raw);
    return { seen: m.seenVersion ?? null, played: true };
  } catch { return { seen: null, played: false }; }
}
export function setSeenVersion(v: string) {
  try {
    const raw = storage.getItem(META);
    const m = raw ? JSON.parse(raw) : {};
    storage.setItem(META, JSON.stringify({ ...m, seenVersion: v }));
  } catch { /* ignore */ }
}

/** Structural validation of critical fields. Returns an error string or null. */
export function validate(st: any): string | null {
  if (!st || typeof st !== 'object') return 'Not an object';
  if (typeof st.version !== 'number') return 'Missing version';
  if (!st.player || typeof st.player !== 'object') return 'Missing player';
  const p = st.player;
  if (!p.attrs || typeof p.attrs.boxing !== 'number') return 'Missing attributes';
  if (!p.record || typeof p.record.w !== 'number') return 'Missing record';
  if (typeof p.money !== 'number' || !isFinite(p.money)) return 'Bad money value';
  if (!st.world || !st.world.fighters || !st.world.orgs) return 'Missing world';
  if (typeof st.day !== 'number') return 'Missing day';
  if (!st.plan || !Array.isArray(st.plan.days) || st.plan.days.length !== 7) return 'Bad training plan';
  for (const v of Object.values(p.attrs)) if (typeof v !== 'number' || !isFinite(v as number)) return 'Corrupt attribute value';
  return null;
}

/** Upgrade older saves in place. */
function renameText(t: string) {
  return t.replace(/Apex Combat League/g, 'Hexagon Fighting Championship').replace(/Apex Predator/g, 'King of the Hexagon')
    .replace(/the Apex league/g, 'the HFC').replace(/Apex belt/g, 'HFC belt').replace(/\bAPEX\b/g, 'HFC');
}
function renameStrings(o: any) {
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string') { if (/Apex|APEX/.test(v)) o[k] = renameText(v); }
    else if (v && typeof v === 'object') renameStrings(v);
  }
}

export function migrate(st: any): GameState {
  if (st.version < 2) {
    st.seenHelp ??= {};
    st.practiceDone ??= false;
  }
  if (st.version < 3) {
    st.fightInProgress ??= null;
    st.dayLogs ??= [];
    st.player.recentGains ??= {};
    st.eventCooldowns ??= {};
  }
  if (st.version < 4) {
    // v4: shared bout history, world news, records book, hall of fame, player timeline, fight-night state
    st.world.history ??= [];
    st.world.news ??= [];
    st.world.records ??= {};
    st.world.hall ??= [];
    st.timeline ??= backfillTimeline(st as GameState);
    st.lastReplay ??= null;
    st.callout ??= null;
    st.titlePush ??= false;
    st.sponsorBuzz ??= 0;
  }
  if (st.version < 5) {
    // v5: the top promotion is now the Hexagon Fighting Championship (HFC). Same id ('acl'), so contracts, titles
    // and rankings carry over; only stored text (news, event names, history, inbox, timeline) is renamed.
    renameStrings(st);
  }
  if (st.version < 6) {
    // v6: HFC superfights — count the current reign's consecutive defenses from fight history
    const p = st.player;
    p.champStatus ??= 0;
    p.superOrigin ??= null;
    if (p.reignDefenses === undefined) {
      const held = p.isPro && st.world.orgs[p.orgId]?.champions?.[p.divisionId] === 'player';
      let n = 0;
      if (held) {
        const titleWins = (p.history ?? []).filter((h: any) => !h.amateur && h.orgId === p.orgId);
        if (typeof p.reignStart === 'number') n = titleWins.filter((h: any) => h.title && h.result === 'W' && h.day > p.reignStart).length;
        else { let k = 0; for (const h of titleWins) { if (h.title && h.result === 'W') k++; else break; } n = Math.max(0, k - 1); }
        n = Math.min(n, p.titleDefenses ?? n);
      }
      p.reignDefenses = n;
    }
  }
  if (st.version < 7) {
    // v7: full cosmetic look (hair, facial hair, tattoos, face, body, attire) derived from the old six fields
    st.player.appearance.look ??= lookFromLegacy(st.player.appearance, st.player.bodyType);
  }
  if (st.player?.appearance?.look) st.player.appearance.look = sanitizeLook(st.player.appearance.look);
  if (st.version < 8) {
    // v8: superfight offers are re-proposed until answered; earlier builds blocked re-offers as soon as one was shown
    if (st.player) st.player.superNextAt = undefined;
  }
  if (st.version < 9) {
    // v9: title reigns for the trophy case (rebuilt from titles and fight history) and fight divisions on history
    st.player.reigns ??= backfillReigns(st as GameState);
  }  if (st.version < 10) {
    // dates moved by the old admin "Allow new offers now" button are restored, then reigns are rebuilt with the
    // better inference (division of older fights, superfights, vacate reasons) keeping anything recorded live
    repairHistoryDates(st);
    st.player.reigns = rebuildReigns(st);
  }

  // always: repair events left over from a fight that already happened (v4 crash: "reading 'opponentId'")
  pruneEvents(st as GameState);
  st.version = SAVE_VERSION;
  return st as GameState;
}

export function readSlot(slot: number): { state: GameState | null; info: SlotInfo } {
  let raw: string | null = null;
  try { raw = storage.getItem(KEY(slot)); } catch (e) { return { state: null, info: { slot, status: 'corrupt', error: 'Storage unavailable' } }; }
  if (!raw) return { state: null, info: { slot, status: 'empty' } };
  try {
    const parsed = JSON.parse(decodeSave(raw));
    if (parsed.version > SAVE_VERSION) return { state: null, info: { slot, status: 'newer', error: 'Saved by a newer version of the game' } };
    const err = validate(parsed);
    if (err) return { state: null, info: { slot, status: 'corrupt', error: err } };
    const st = migrate(parsed);
    const p = st.player;
    const r = p.isPro ? p.record : p.amateurRecord;
    return {
      state: st,
      info: { slot, status: 'ok', name: `${p.firstName} ${p.lastName}`, record: `${r.w}-${r.l}${r.d ? '-' + r.d : ''}${p.isPro ? '' : ' (am)'}`, day: st.day, savedAt: st.savedAt, retired: p.retired, modified: !!st.adminUsed },
    };
  } catch (e: any) {
    return { state: null, info: { slot, status: 'corrupt', error: 'Unreadable save data' } };
  }
}

export function slotInfos(): SlotInfo[] {
  return SLOTS.map((s) => readSlot(s).info);
}

export function writeSlot(st: GameState): { ok: boolean; error?: string } {
  st.savedAt = Date.now();
  const data = careerData(JSON.stringify(st));
  const isQuota = (e: any) => e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014;
  const tryWrite = () => storage.setItem(KEY(st.slot), data);
  try {
    const prev = storage.getItem(KEY(st.slot));
    // backup is best-effort: skip it rather than fail the real save
    if (prev) { try { storage.setItem(BACKUP(st.slot), prev); } catch { try { storage.removeItem(BACKUP(st.slot)); } catch { /* ignore */ } } }
    tryWrite();
    setLastSlot(st.slot);
    return { ok: true };
  } catch (e: any) {
    if (native) return { ok: false, error: `Could not write the save file in ${native.savesDir()} (${e?.message ?? 'disk error'})` };
    if (!isQuota(e)) return { ok: false, error: 'Could not write to browser storage (it may be disabled, e.g. private browsing)' };
    // out of space: free every backup and retry, then compress older uncompressed slots
    try {
      for (const s of SLOTS) { storage.removeItem(BACKUP(s)); storage.removeItem(`fightcamp.replay.${s}`); }
      for (const s of SLOTS) {
        if (s === st.slot) continue;
        const raw = storage.getItem(KEY(s));
        if (raw && !raw.startsWith(LZ_PREFIX)) storage.setItem(KEY(s), encodeSave(raw));
      }
      tryWrite();
      setLastSlot(st.slot);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Browser storage is full. Delete an old career in Load Career, or clear other site data for this page' };
    }
  }
}

/** Approximate storage used by Fight Camp, in KB. */
export function storageUsedKB(): number {
  let n = 0;
  try {
    for (const k of storage.keys()) if (k.startsWith('fightcamp.')) n += (storage.getItem(k)?.length ?? 0) + k.length;
  } catch { /* ignore */ }
  return Math.round((n * 2) / 1024);
}

export function deleteSlot(slot: number) {
  try {
    storage.removeItem(KEY(slot));
    storage.removeItem(BACKUP(slot));
    storage.removeItem(`fightcamp.fight.${slot}`); // mid-fight checkpoint
    storage.removeItem(`fightcamp.replay.${slot}`); // last fight's replay data
  } catch { /* ignore */ }
}

export function restoreBackup(slot: number): boolean {
  try {
    const b = storage.getItem(BACKUP(slot));
    if (!b) return false;
    const parsed = JSON.parse(decodeSave(b));
    if (validate(parsed)) return false;
    storage.setItem(KEY(slot), b);
    return true;
  } catch { return false; }
}

export function exportSlot(slot: number): string | null {
  try { const r = storage.getItem(KEY(slot)); return r ? decodeSave(r) : null; } catch { return null; }
}
export function importToSlot(slot: number, json: string): string | null {
  try {
    const parsed = JSON.parse(json);
    const err = validate(parsed);
    if (err) return err;
    parsed.slot = slot;
    storage.setItem(KEY(slot), careerData(JSON.stringify(migrate(parsed))));
    return null;
  } catch { return 'Not valid save data'; }
}
