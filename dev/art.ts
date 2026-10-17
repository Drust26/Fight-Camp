// Dev-only gallery for the fighter artwork (not part of the game build).
import { drawFighterArt, drawPortrait, type Joints } from '../src/combat/fighterArt';
import { POSES, GROUND_POSES, type Pose } from '../src/combat/poses';
import { generateLook, lookFromLegacy, type Look } from '../src/game/look';

const c = document.getElementById('c') as HTMLCanvasElement;
const ctx = c.getContext('2d')!;
const params = new URLSearchParams(location.search);
const mode = params.get('m') ?? 'poses';
ctx.fillStyle = '#1a1d26'; ctx.fillRect(0, 0, c.width, c.height);

function joints(p: Pose, ox: number, oy: number, sc: number, facing: number): Joints {
  const P = (q: [number, number]) => [ox + q[0] * sc * facing, oy + q[1] * sc] as [number, number];
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, P(v as any)])) as any;
}
const looks: Look[] = [];
for (let i = 0; i < 12; i++) looks.push(generateLook(`f${i * 7919 + 3}`, { skin: i % 7, hair: i % 6, hairColor: i % 7, facialHair: i % 4, shorts: i % 8, gloves: i % 4, accessory: i % 4 }, { div: ['light', 'heavy', 'welter', 'fly', 'middle', 'lhw'][i % 6] }));
looks[0] = { ...lookFromLegacy({ skin: 2, hair: 2, hairColor: 0, facialHair: 1, shorts: 0, gloves: 0, accessory: 1 }), tattoos: [
  { id: 'a', design: 'tribal', region: 'leadUpperArm', size: 1, rot: 0, pos: 0.5, ink: '#1c2433' },
  { id: 'b', design: 'script', region: 'leadForearm', size: 1, rot: 0, pos: 0.5, ink: '#1c2433', text: 'FAMILY' },
  { id: 'c', design: 'wings', region: 'chest', size: 1.1, rot: 0, pos: 0.5, ink: '#1c2433' },
  { id: 'd', design: 'rose', region: 'leadCalf', size: 1, rot: 10, pos: 0.4, ink: '#5b1d24' },
  { id: 'e', design: 'mandala', region: 'upperBack', size: 1, rot: 0, pos: 0.5, ink: '#1c2433' },
] };

if (mode === 'poses') {
  const keys = ['stance', 'guardHigh', 'jab', 'cross', 'hook', 'upper', 'body', 'lowkick', 'bodykick', 'headkick', 'teep', 'knee', 'evade', 'stun', 'shoot', 'sprawl', 'clinch', 'victory'];
  keys.forEach((k, i) => {
    const x = 90 + (i % 9) * 175, y = 400 + Math.floor(i / 9) * 440;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 85, y - 380, 170, 400);
    drawFighterArt(ctx, joints(POSES[k], x - 20, y, 1.9, 1), { sc: 1.9, facing: 1, look: looks[i % looks.length], standing: true });
    ctx.fillStyle = '#9aa3b2'; ctx.font = '12px sans-serif'; ctx.fillText(k, x - 80, y - 365);
  });
} else if (mode === 'ground') {
  Object.entries(GROUND_POSES).forEach(([k, sc], i) => {
    const x = 200 + (i % 4) * 380, y = 330 + Math.floor(i / 4) * 400;
    ctx.fillStyle = '#9aa3b2'; ctx.font = '12px sans-serif'; ctx.fillText(k, x - 150, y - 200);
    drawFighterArt(ctx, joints(sc.bottom, x, y, 2, 1), { sc: 2, facing: 1, look: looks[1], flipFront: k !== 'back' });
    drawFighterArt(ctx, joints(sc.top, x, y, 2, 1), { sc: 2, facing: 1, look: looks[2] });
  });
} else if (mode === 'big') {
  drawFighterArt(ctx, joints(POSES.stance, 520, 860, 4.6, 1), { sc: 4.6, facing: 1, look: looks[Number(params.get('i') ?? 0)], standing: true });
  drawFighterArt(ctx, joints(POSES.cross, 1150, 860, 4.6, -1), { sc: 4.6, facing: -1, look: looks[Number(params.get('j') ?? 3)], standing: true });
} else {
  looks.forEach((l, i) => { ctx.save(); ctx.translate(30 + (i % 6) * 260, 40 + Math.floor(i / 6) * 300); ctx.fillStyle = '#11141b'; ctx.fillRect(0, 0, 240, 240); drawPortrait(ctx, l, 240, { mirror: i % 2 === 1, walkout: i > 8 }); ctx.restore(); });
}
