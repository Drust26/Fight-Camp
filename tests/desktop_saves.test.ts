import { it, expect, vi } from 'vitest';

// The desktop app's file storage, faked in memory (same shape as desktop/preload.cjs exposes).
function fakeDesktop() {
  const files = new Map<string, string>();
  (globalThis as any).window = {
    fightcampNative: {
      isDesktop: true, appVersion: '1.1.1', dataDir: () => '/Docs/FightCamp', savesDir: () => '/Docs/FightCamp/saves', openSavesFolder: () => {},
      storage: { getItem: (k: string) => files.get(k) ?? null, setItem: (k: string, v: string) => { files.set(k, v); }, removeItem: (k: string) => { files.delete(k); }, keys: () => [...files.keys()] },
    },
  };
  return files;
}

it('desktop careers are written as readable JSON, and older compressed saves still load', async () => {
  const files = fakeDesktop();
  vi.resetModules();
  const save = await import('../src/game/save');
  const { createCareer } = await import('../src/game/career');
  const st = createCareer({ firstName: 'Readable', lastName: 'Save', nickname: '', nationality: 'France', age: 24, heightCm: 182, reachCm: 186, hand: 'right', stance: 'orthodox', bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: [], divisionId: 'middle', naturalKg: 86, appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 11 } as any, 1);
  expect(save.writeSlot(st).ok).toBe(true);
  const raw = files.get('fightcamp.slot.1')!;
  expect(raw.startsWith('{')).toBe(true); // plain text, not "LZ1:…"
  expect(raw).toContain('\n  "player": {');
  expect(raw).toContain('"firstName": "Readable"');
  expect(save.readSlot(1).info).toMatchObject({ status: 'ok', name: 'Readable Save' });
  // a compressed save from 1.1.0 or the browser loads, and is rewritten readable on its next save
  const old = { ...JSON.parse(raw), slot: 2 };
  files.set('fightcamp.slot.2', save.encodeSave(JSON.stringify(old)));
  const r2 = save.readSlot(2);
  expect(r2.info.status).toBe('ok');
  expect(save.writeSlot(r2.state!).ok).toBe(true);
  expect(files.get('fightcamp.slot.2')!.startsWith('{')).toBe(true);
  // the previous save is kept as a backup and restores
  expect(files.get('fightcamp.slot.2.bak')!.startsWith('LZ1:')).toBe(true);
  expect(save.restoreBackup(2)).toBe(true);
  delete (globalThis as any).window;
});

it('the changelog lists each version, and "what\'s new" shows the versions since the last one seen', async () => {
  const { CHANGELOG, notesSince, parseChangelog } = await import('../src/game/changelog');
  expect(CHANGELOG[0].version).toBe(__APP_VERSION__); // every release needs its CHANGELOG.md section
  expect(CHANGELOG[0].items.length).toBeGreaterThan(0);
  const all = parseChangelog('# C\n\n## v1.3.0\n- c\n  wrapped\n## v1.2.0\n- b\n## v1.1.0\n- a\n');
  expect(all[0]).toEqual({ version: '1.3.0', items: ['c wrapped'] });
  expect(notesSince('1.1.0', '1.3.0', all).map((r) => r.version)).toEqual(['1.3.0', '1.2.0']);
  expect(notesSince(null, '1.2.0', all).map((r) => r.version)).toEqual(['1.2.0', '1.1.0']);
  expect(notesSince('1.3.0', '1.3.0', all)).toEqual([]);
});
