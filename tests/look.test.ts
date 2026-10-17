import { describe, it, expect, beforeAll } from 'vitest';
import { createCareer, type NewCareerOpts } from '../src/game/career';
import { generateLook, lookFromLegacy, resetCategory, resolveLook, sanitizeLook, shortsChanged, savePreset, loadPresets, deletePreset, MAX_TATTOOS, type Look } from '../src/game/look';
import { wfAppearance } from '../src/game/fighterGen';
import { migrate, validate } from '../src/game/save';
import { playerSetup } from '../src/game/fights';
import { createFight, startNextRound, step } from '../src/combat/engine';
import { AIController } from '../src/combat/ai';
import { setup } from './simHelpers';

const base: NewCareerOpts = {
  firstName: 'Look', lastName: 'Test', nickname: '', nationality: 'Brazil', age: 22, heightCm: 180, reachCm: 183, hand: 'right', stance: 'orthodox',
  bodyType: 'lean', background: 'mma', startLevel: 'pro', difficulty: 'normal', goals: [], divisionId: 'light', naturalKg: 74,
  appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed: 31337,
};

beforeAll(() => {
  const mem: Record<string, string> = {};
  (globalThis as any).localStorage ??= { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: (k: string) => { delete mem[k]; } };
});

describe('appearance (looks)', () => {
  it('AI looks are deterministic per fighter and varied across fighters', () => {
    const a = wfAppearance({ id: 'w_abc', div: 'light' }), b = wfAppearance({ id: 'w_abc', div: 'light' });
    expect(JSON.stringify(a.look)).toBe(JSON.stringify(b.look));
    const ids = Array.from({ length: 400 }, (_, i) => `w_${i * 7919}`);
    const looks = ids.map((id) => generateLook(id, { skin: 1, hair: 1, hairColor: 1, facialHair: 1, shorts: 1, gloves: 1, accessory: 0 }, { div: 'welter' }));
    const tattooed = looks.filter((l) => l.tattoos.length).length / looks.length;
    const bearded = looks.filter((l) => l.beard !== 'none').length / looks.length;
    expect(tattooed).toBeGreaterThan(0.2); expect(tattooed).toBeLessThan(0.55);
    expect(bearded).toBeGreaterThan(0.4); expect(bearded).toBeLessThan(0.75);
    expect(new Set(looks.map((l) => l.hair)).size).toBeGreaterThan(10);
    // heavier divisions are built heavier on average
    const avg = (div: string) => ids.slice(0, 150).map((id) => generateLook(id, { skin: 1, hair: 1, hairColor: 1, facialHair: 1, shorts: 1, gloves: 1, accessory: 0 }, { div }).body.build).reduce((x, y) => x + y) / 150;
    expect(avg('heavy')).toBeGreaterThan(avg('fly') + 0.3);
  });

  it('cosmetics never change attributes or fight outcomes', () => {
    const plain = createCareer(base, 1);
    const fancy = createCareer({ ...base, appearance: { ...base.appearance, look: { ...lookFromLegacy(base.appearance, 'stocky'), hair: 'afro', beard: 'full', body: { build: 1, muscle: 1, shoulders: 1, torso: 'thick', limbs: 1 }, tattoos: [{ id: 'x', design: 'skull', region: 'chest', size: 1.4, rot: 30, pos: 0.5, ink: '#5b1d24' }] } } }, 1);
    expect(fancy.player.attrs).toEqual(plain.player.attrs);
    expect(fancy.player.heightCm).toBe(plain.player.heightCm);
    expect(fancy.player.reachCm).toBe(plain.player.reachCm);
    expect(playerSetup(fancy, 'balanced').attrs).toEqual(playerSetup(plain, 'balanced').attrs);
    // the engine ignores looks entirely: same seed, different looks → identical fight
    const run = (look?: Look) => {
      const a = setup('A', 60, 'pressure', 5, true), b = setup('B', 60, 'wrestler', 6);
      if (look) a.appearance = { ...a.appearance, look };
      const s = createFight({ rounds: 3, roundSeconds: 60, seed: 77, title: false }, a, b);
      const x = new AIController(0, 'pressure', 'normal', 1), y = new AIController(1, 'wrestler', 'normal', 2);
      let n = 0; while (s.phase !== 'over' && n++ < 200000) { if (s.phase === 'roundOver') startNextRound(s); step(s, [x.think(s, 1 / 60), y.think(s, 1 / 60)], 1 / 60); }
      return JSON.stringify([s.outcome, s.tick, s.f.map((f) => f.rounds)]);
    };
    expect(run(fancy.player.appearance.look)).toBe(run());
  });

  it('saves keep the look exactly; old saves get one derived from the original fields', () => {
    const st = createCareer(base, 1);
    st.player.appearance.look = { ...st.player.appearance.look!, hair: 'braids', moustache: 'horseshoe', tattoos: [{ id: 'a', design: 'script', region: 'leadForearm', size: 1, rot: 0, pos: 0.4, ink: '#1c2433', text: 'LOYALTY' }] };
    const back = migrate(JSON.parse(JSON.stringify(st)));
    expect(back.player.appearance.look).toEqual(st.player.appearance.look);
    const old = JSON.parse(JSON.stringify(st)) as any;
    delete old.player.appearance.look; old.version = 6; old.player.appearance.accessory = 1;
    const m = migrate(old);
    expect(validate(m)).toBeNull();
    expect(m.player.appearance.look!.tattoos.length).toBe(2); // the old "tattoo sleeve"
    expect(m.player.appearance.skin).toBe(st.player.appearance.skin); // original fields untouched
  });

  it('sanitises bad data, limits tattoos and lettering', () => {
    const bad = sanitizeLook({ hair: 'nope' as any, skin: 'red', tattoos: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, design: 'script', region: 'chest', size: 9, rot: 999, pos: 3, ink: 'x', text: 'A VERY LONG TATTOO TEXT' })) as any });
    expect(bad.hair).toBe('crew');
    expect(bad.skin).toMatch(/^#/);
    expect(bad.tattoos.length).toBe(MAX_TATTOOS);
    expect(bad.tattoos[0].size).toBe(1.4); expect(bad.tattoos[0].rot).toBe(60); expect(bad.tattoos[0].text!.length).toBe(12);
    expect(resolveLook({ skin: 0, hair: 0, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }).hair).toBe('shaved');
  });

  it('per-category reset, shorts-change detection and presets', () => {
    const a = lookFromLegacy(base.appearance, 'lean');
    const b: Look = { ...a, hair: 'afro', attire: { ...a.attire, shorts: '#16a34a' }, face: { ...a.face, jaw: 0.9 } };
    const r = resetCategory(b, a, 'hair');
    expect(r.hair).toBe(a.hair); expect(r.face.jaw).toBe(0.9); expect(r.attire.shorts).toBe('#16a34a');
    expect(shortsChanged(a, b)).toBe(true); expect(shortsChanged(a, { ...a, hair: 'bald' })).toBe(false);
    expect(savePreset('Southpaw Sam', b)).toBeNull();
    expect(loadPresets().find((p) => p.name === 'Southpaw Sam')!.look.hair).toBe('afro');
    deletePreset('Southpaw Sam');
    expect(loadPresets().some((p) => p.name === 'Southpaw Sam')).toBe(false);
  });
});
