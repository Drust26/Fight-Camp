// Simplified national-colour badges (colour bands + 3-letter code) — renders identically on every OS,
// unlike emoji flags, and stays within the game's own visual style.
export interface NationBadge { code: string; colors: string[]; dir: 'h' | 'v' }

export const NATION_BADGES: Record<string, NationBadge> = {
  'United States': { code: 'USA', colors: ['#b22234', '#ffffff', '#3c3b6e'], dir: 'h' },
  Brazil: { code: 'BRA', colors: ['#009c3b', '#ffdf00', '#002776'], dir: 'h' },
  Russia: { code: 'RUS', colors: ['#ffffff', '#0039a6', '#d52b1e'], dir: 'h' },
  Ireland: { code: 'IRL', colors: ['#169b62', '#ffffff', '#ff883e'], dir: 'v' },
  Mexico: { code: 'MEX', colors: ['#006847', '#ffffff', '#ce1126'], dir: 'v' },
  Canada: { code: 'CAN', colors: ['#d52b1e', '#ffffff', '#d52b1e'], dir: 'v' },
  England: { code: 'ENG', colors: ['#ffffff', '#ce1124', '#ffffff'], dir: 'v' },
  Netherlands: { code: 'NED', colors: ['#ae1c28', '#ffffff', '#21468b'], dir: 'h' },
  Poland: { code: 'POL', colors: ['#ffffff', '#dc143c'], dir: 'h' },
  Georgia: { code: 'GEO', colors: ['#ffffff', '#ff0000', '#ffffff'], dir: 'v' },
  Japan: { code: 'JPN', colors: ['#ffffff', '#bc002d', '#ffffff'], dir: 'v' },
  'South Korea': { code: 'KOR', colors: ['#ffffff', '#cd2e3a', '#0047a0'], dir: 'h' },
  Australia: { code: 'AUS', colors: ['#00008b', '#ffffff', '#ff0000'], dir: 'h' },
  'New Zealand': { code: 'NZL', colors: ['#00247d', '#ffffff', '#cc142b'], dir: 'h' },
  Nigeria: { code: 'NGA', colors: ['#008751', '#ffffff', '#008751'], dir: 'v' },
  France: { code: 'FRA', colors: ['#0055a4', '#ffffff', '#ef4135'], dir: 'v' },
  Sweden: { code: 'SWE', colors: ['#006aa7', '#fecc00', '#006aa7'], dir: 'h' },
  China: { code: 'CHN', colors: ['#de2910', '#ffde00', '#de2910'], dir: 'h' },
  Thailand: { code: 'THA', colors: ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], dir: 'h' },
  Kazakhstan: { code: 'KAZ', colors: ['#00afca', '#fec50c', '#00afca'], dir: 'h' },
  'Dagestan Region': { code: 'DAG', colors: ['#009a44', '#1f4fa6', '#d52b1e'], dir: 'h' },
  Cameroon: { code: 'CMR', colors: ['#007a5e', '#ce1126', '#fcd116'], dir: 'v' },
  Philippines: { code: 'PHI', colors: ['#0038a8', '#ce1126'], dir: 'h' },
  Argentina: { code: 'ARG', colors: ['#74acdf', '#ffffff', '#74acdf'], dir: 'h' },
  Chile: { code: 'CHI', colors: ['#ffffff', '#d52b1e'], dir: 'h' },
  Spain: { code: 'ESP', colors: ['#aa151b', '#f1bf00', '#aa151b'], dir: 'h' },
  Germany: { code: 'GER', colors: ['#000000', '#dd0000', '#ffce00'], dir: 'h' },
  Italy: { code: 'ITA', colors: ['#009246', '#ffffff', '#ce2b37'], dir: 'v' },
  Ukraine: { code: 'UKR', colors: ['#0057b7', '#ffd700'], dir: 'h' },
  Cuba: { code: 'CUB', colors: ['#002a8f', '#ffffff', '#002a8f', '#ffffff', '#002a8f'], dir: 'h' },
};

export function badgeFor(nation: string): NationBadge {
  return NATION_BADGES[nation] ?? { code: nation.slice(0, 3).toUpperCase(), colors: ['#475569', '#94a3b8'], dir: 'h' };
}
