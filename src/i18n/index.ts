// Translations. The English text is the key: t('Fight Offers') returns the French when the game is in French and the
// English otherwise, so a missing translation can never blank out the UI.
//
// - t(text, vars)       fixed UI text, with {placeholders}
// - tp(one, many, n)     plural forms ({n} is filled in)
// - tx(text)             text the game generated in English (news, inbox, timeline, events, offers…): translated when
//                        shown, so existing saves read in French too. Exact entries first, then {pattern} entries,
//                        whose captured parts are translated again (names of divisions, methods, dates…).
import { FR } from './fr';

export type Lang = 'en' | 'fr';
export const LANGS: { id: Lang; name: string }[] = [{ id: 'en', name: 'English' }, { id: 'fr', name: 'Français' }];

let lang: Lang = 'en';
export function setLang(l: Lang) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
export const getLang = () => lang;
export const locale = () => (lang === 'fr' ? 'fr-FR' : 'en-GB');

/** Short weekday name, Monday = 0 ("Mon" / "lun."). */
export function weekdayShort(i: number): string {
  const s = new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale(), { weekday: 'short', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The system language, used until the player picks one in Settings. */
export function detectLang(): Lang {
  const n = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? '') : '';
  return n.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

export function t(s: string, vars?: Record<string, string | number>): string {
  return fill(lang === 'fr' ? FR[s] ?? s : s, vars);
}

/** Plurals: French uses the singular for 0 and 1. */
export function tp(one: string, many: string, n: number, vars?: Record<string, string | number>): string {
  const single = lang === 'fr' ? Math.abs(n) < 2 : Math.abs(n) === 1;
  return t(single ? one : many, { n, ...vars });
}

// ───────────────────────── display-time translation of generated English text
interface Pattern { re: RegExp; names: string[]; out: string; weight: number }
let patterns: Pattern[] | null = null;
const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
/** Placeholders that always hold a number: they only match digits, so short keys like 'R{n}' never swallow sentences. */
const NUMERIC = new Set(['n', 'm', 'max', 'pct', 'kg', 'lb', 'limit', 'q', 'v']);
/** Placeholders holding people's names, promotions or event names: copied as they are (a fighter called 'Cross' stays Cross). */
const VERBATIM = new Set(['name', 'opp', 'a', 'b', 'first', 'last', 'champ', 'org', 'org2', 'who', 'winner', 'loser', 'player']);
const PERSON = new Set(['name', 'opp', 'a', 'b', 'first', 'last', 'champ', 'who', 'winner', 'loser', 'player']);
const DIVS = ['Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight'];
const DIV_RE = `(${[...DIVS, ...DIVS.map((d) => d.toLowerCase())].map(esc).join('|')})`;
/** What each kind of placeholder may match in generated text: the tighter, the fewer false matches. */
function capture(name: string): string {
  if (NUMERIC.has(name)) return '([-−+]?\\d[\\d.,\\u202f\\u00a0]*)';
  if (/^div\d?$/.test(name)) return DIV_RE;
  if (name === 'org') return '([A-Z]{2,5})';
  if (name === 'method') return '(KO|TKO|SUB|UD|SD|MD|DRAW|DQ)';
  if (name === 'rec') return '(\\d+-\\d+(?:-\\d+)?)';
  if (PERSON.has(name)) return "([^.!?:;—()]+?)";
  return '(.+?)';
}
function compile(): Pattern[] {
  const out: Pattern[] = [];
  for (const [k, v] of Object.entries(FR)) {
    if (!/\{\w+\}/.test(k)) continue;
    const names: string[] = [];
    let literal = 0;
    const src = k.split(/(\{\w+\})/).map((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (m) { names.push(m[1]); return capture(m[1]); }
      literal += part.replace(/\s/g, '').length;
      return esc(part);
    }).join('');
    out.push({ re: new RegExp(`^${src}$`, 's'), names, out: v, weight: literal });
  }
  // the most specific patterns (most fixed text) first
  return out.sort((a, b) => b.weight - a.weight);
}
let lower: Map<string, string> | null = null;
/** Exact entry, ignoring case ("sprained ankle" inside a sentence finds "Sprained ankle"). */
function exactLoose(s: string): string | undefined {
  if (FR[s] !== undefined) return FR[s];
  lower ??= new Map(Object.entries(FR).filter(([k]) => !/\{/.test(k)).map(([k, v]) => [k.toLowerCase(), v]));
  const v = lower.get(s.toLowerCase());
  if (v === undefined) return undefined;
  return /^[a-z]/.test(s) ? v[0].toLowerCase() + v.slice(1) : v;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MON_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS: Record<string, string> = { Monday: 'lundi', Tuesday: 'mardi', Wednesday: 'mercredi', Thursday: 'jeudi', Friday: 'vendredi', Saturday: 'samedi', Sunday: 'dimanche', Mon: 'lun.', Tue: 'mar.', Wed: 'mer.', Thu: 'jeu.', Fri: 'ven.', Sat: 'sam.', Sun: 'dim.' };
/** English dates and money baked into stored text → French. */
function localizeBits(s: string): string {
  const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return s
    // weekdays and months only next to a day number or a year, so a fighter called Jun or May keeps his name
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),? (?=\d)/g, (d) => `${DAYS[d.replace(/,? $/, '')]} `)
    .replace(new RegExp(`(?<=\\d )(${MONTHS_EN.join('|')})\\b|\\b(${MONTHS_EN.join('|')})(?= \\d)`, 'g'), (m) => MONTHS_FR[MONTHS_EN.indexOf(m)])
    .replace(/(?<=\d )(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b\.?|\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\.?(?= \d)/g, (m) => MON_FR[SHORT.indexOf(m.replace(/\.$/, '').replace('Sept', 'Sep'))] ?? m)
    .replace(/\$(\d{1,3}(?:,\d{3})+|\d+)/g, (_m, n) => `${Number(n.replace(/,/g, '')).toLocaleString('fr-FR')} $`)
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, (n) => Number(n.replace(/,/g, '')).toLocaleString('fr-FR'));
}

const cache = new Map<string, string>();
function translateGenerated(s: string, depth: number): string {
  const exact = exactLoose(s);
  if (exact !== undefined) return exact;
  patterns ??= compile();
  for (const p of patterns) {
    const m = p.re.exec(s);
    if (!m) continue;
    const vars: Record<string, string> = {};
    p.names.forEach((n, i) => { vars[n] = depth < 4 && !VERBATIM.has(n) ? translateGenerated(m[i + 1], depth + 1) : m[i + 1]; });
    return fill(p.out, vars);
  }
  if (depth < 4) {
    // several sentences: one by one
    const sentences = s.split(/(?<=[.!?…]) (?=[A-Z"“«])/);
    if (sentences.length > 1) return sentences.map((x) => translateGenerated(x, depth + 1)).join(' ');
    // a list ("he won (KO), you won (UD)"): item by item, when every item is known
    const items = s.split(', ');
    if (items.length > 1 && items.every((x) => covered(x))) return items.map((x) => translateGenerated(x, depth + 1)).join(', ');
  }
  return localizeBits(s);
}
function covered(s: string): boolean {
  if (exactLoose(s) !== undefined) return true;
  patterns ??= compile();
  return patterns.some((p) => p.re.test(s));
}

export function tx(s: string | undefined | null): string {
  if (!s) return s ?? '';
  if (lang !== 'fr') return s;
  let r = cache.get(s);
  if (r === undefined) {
    r = translateGenerated(s, 0);
    if (cache.size > 5000) cache.clear();
    cache.set(s, r);
  }
  return r;
}

/** For tests: is there a French entry (exact or pattern, whole text, sentence by sentence or item by item) for this generated text? */
export function hasTranslation(s: string): boolean {
  if (covered(s)) return true;
  const sentences = s.split(/(?<=[.!?…]) (?=[A-Z"“«])/);
  if (sentences.length > 1) return sentences.every((x) => hasTranslation(x));
  const items = s.split(', ');
  return items.length > 1 && items.every((x) => covered(x));
}
