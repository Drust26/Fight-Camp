// Central game store: the single authoritative GameState. Screens read it via useGame() and
// mutate only through act(), which clones, applies, notifies and autosaves.
import { useSyncExternalStore } from 'react';
import type { GameState, Settings } from './types';
import { loadSettings, saveSettings, writeSlot } from './save';

type Listener = () => void;

class Store {
  state: GameState | null = null;
  settings: Settings = loadSettings();
  saveStatus: { ok: boolean; at: number; error?: string } = { ok: true, at: 0 };
  private listeners = new Set<Listener>();
  private version = 0;
  private saveTimer: number | null = null;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  set(st: GameState | null) {
    this.state = st;
    this.emit();
  }

  /** Apply a mutation to a copy of the state. If fn throws, nothing changes (no partial charges). */
  act<T>(fn: (draft: GameState) => T, opts: { save?: boolean } = { save: true }): T | undefined {
    if (!this.state) return undefined;
    const draft: GameState = structuredClone(this.state);
    const out = fn(draft);
    this.state = draft;
    this.emit();
    if (opts.save !== false) this.scheduleSave();
    return out;
  }

  scheduleSave() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    // compress & write when the browser is idle so gameplay never hitches
    this.saveTimer = window.setTimeout(() => {
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: any) => number) | undefined;
      if (ric) ric(() => this.saveNow(), { timeout: 2500 });
      else this.saveNow();
    }, 600);
  }

  saveNow(): { ok: boolean; error?: string } {
    if (this.saveTimer) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (!this.state) return { ok: false, error: 'No career loaded' };
    const r = writeSlot(this.state);
    this.saveStatus = { ok: r.ok, at: Date.now(), error: r.error };
    this.emit();
    return r;
  }

  updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.emit();
  }
}

export const store = new Store();

export function useStoreVersion() {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}
export function useGame(): GameState {
  useStoreVersion();
  return store.state!;
}
export function useSettings(): Settings {
  useStoreVersion();
  return store.settings;
}
