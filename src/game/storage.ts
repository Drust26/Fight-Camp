// Where Fight Camp keeps its data. In the browser: localStorage. In the desktop app: files in
// Documents/FightCamp (saves in Documents/FightCamp/saves), through the bridge the desktop shell exposes.
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void; // throws when the write fails
  removeItem(k: string): void;
  keys(): string[];
}
export interface NativeBridge {
  isDesktop: true;
  storage: KV;
  dataDir(): string;
  savesDir(): string;
  openSavesFolder(): void;
  appVersion?: string;
  updates?: {
    get(): Promise<UpdateState>;
    check(): Promise<UpdateState>;
    install(): Promise<string>;
    later(): Promise<boolean>;
    onState(cb: (s: UpdateState) => void): () => void;
  };
}
/** Auto-update progress reported by the desktop shell (desktop/updater.cjs). */
export interface UpdateState {
  status: 'idle' | 'checking' | 'none' | 'downloading' | 'ready' | 'error' | 'disabled';
  current: string;
  version?: string;
  latest?: string;
  notes?: string;
  notesFr?: string;
  progress?: number;
  received?: number;
  total?: number;
  error?: string;
}

export const native: NativeBridge | null = typeof window !== 'undefined' && (window as any).fightcampNative?.isDesktop ? (window as any).fightcampNative : null;

const web: KV = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
  keys: () => { const out: string[] = []; for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)!); return out; },
};

/** Same calls on every platform; callers keep their own try/catch (storage can be unavailable). */
export const storage: KV = {
  getItem: (k) => (native?.storage ?? web).getItem(k),
  setItem: (k, v) => (native?.storage ?? web).setItem(k, v),
  removeItem: (k) => (native?.storage ?? web).removeItem(k),
  keys: () => (native?.storage ?? web).keys(),
};

/** Short description of where saves live, for the UI. */
export function savesLocation(): string {
  return native ? native.savesDir() : 'this browser';
}
