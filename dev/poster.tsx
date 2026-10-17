// Dev-only gallery of poster tiers (not part of the game build).
import { createRoot } from 'react-dom/client';
import '../src/ui/theme.css';
import { FightPoster } from '../src/ui/components/FightPoster';
import { generateLook } from '../src/game/look';
import type { PosterData, PosterTier } from '../src/game/poster';

const ap = { skin: 2, hair: 2, hairColor: 0, facialHair: 1, shorts: 0, gloves: 0, accessory: 0 };
const side = (id: string, first: string, last: string, nick: string, champion = false) => ({ first, last, nick, rec: '14-2', nat: id.length % 2 ? 'Brazil' : 'Ireland', look: generateLook(id, ap, { div: 'light' }), champion, heightCm: 178 });
const tiers: PosterTier[] = ['local', 'card', 'headliner', 'title', 'superfight'];
const orgs: Record<PosterTier, [string, string, string]> = { local: ['ifc', 'Independent Fight Circuit', '#8a9bb0'], card: ['cms', 'Continental MMA Series', '#4f8df5'], headliner: ['gfc', 'Global Fight Championship', '#c47cff'], title: ['acl', 'Hexagon Fighting Championship', '#ff5a36'], superfight: ['acl', 'Hexagon Fighting Championship', '#ff5a36'] };
const data = (t: PosterTier, i: number): PosterData => ({
  id: 'p' + i, tier: t, eventName: t === 'local' ? 'IFC Fight Night 48' : t === 'title' ? 'HFC 212: Crown' : t === 'superfight' ? 'HFC 220' : 'CMS 77: Madrid',
  org: orgs[t][0] as any, orgName: orgs[t][1], orgShort: 'X', orgColor: orgs[t][2], date: 'Saturday 14 August 2027', venue: 'Major arena', div: 'welter', divName: 'Welterweight', lbs: 170,
  rounds: t === 'title' || t === 'superfight' ? 5 : 3, slotLabel: t === 'card' ? 'MAIN CARD' : t === 'local' ? 'PRELIMINARY CARD' : 'MAIN EVENT', titleLine: t === 'title' ? 'FOR THE HFC WELTERWEIGHT WORLD CHAMPIONSHIP' : t === 'superfight' ? 'FOR THE HFC HEAVYWEIGHT WORLD CHAMPIONSHIP' : null,
  homeDiv: t === 'superfight' ? 'lhw' : undefined, ...(t === 'superfight' ? { div: 'heavy', divName: 'Heavyweight', lbs: 265 } : {}), tagline: t === 'superfight' ? 'CHAMPION VS CHAMPION' : 'HEAVY IS THE HEAD',
  red: side('red' + i, 'Alex', 'Moreno', 'The Spark', t === 'superfight'), blue: side('blue' + i * 3, 'Jae-won', 'Sato', 'The Reaper', t === 'title' || t === 'superfight'),
  undercard: ['Silva vs Okafor', 'Ito vs Walker', 'Duarte vs Lim'], result: i === 2 ? { text: 'WON · KO R2 1:12', won: true } : undefined,
});
createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'flex', gap: 14, padding: 14, flexWrap: 'wrap' }}>{tiers.map((t, i) => <FightPoster key={t} data={data(t, i)} width={Number(new URLSearchParams(location.search).get('w') ?? 300)} />)}</div>,
);
