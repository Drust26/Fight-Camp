// User-provided media (custom walkout music) kept in IndexedDB — audio files are far too large for
// localStorage. Stored per browser; the career only remembers that a custom track was chosen.
const DB = 'fightcamp-media';
const STORE = 'files';
export const MAX_TRACK_BYTES = 12 * 1024 * 1024;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    } catch (e) { rej(e); }
  });
}

export async function saveWalkoutFile(file: File): Promise<string | null> {
  if (!file.type.startsWith('audio/')) return 'That file is not an audio file.';
  if (file.size > MAX_TRACK_BYTES) return 'Please use an audio file under 12 MB.';
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ blob: file, name: file.name }, 'walkout');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return null;
  } catch {
    return 'This browser blocked file storage (private mode?).';
  }
}

let cachedUrl: string | null = null;
export async function loadWalkout(): Promise<{ url: string; name: string } | null> {
  try {
    const db = await open();
    const rec: any = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get('walkout');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!rec?.blob) return null;
    if (cachedUrl) URL.revokeObjectURL(cachedUrl);
    cachedUrl = URL.createObjectURL(rec.blob);
    return { url: cachedUrl, name: rec.name };
  } catch {
    return null;
  }
}

export async function clearWalkoutFile() {
  try {
    const db = await open();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('walkout');
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch { /* ignore */ }
}
