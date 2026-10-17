// Release notes, read from CHANGELOG.md at build time (the same text as the GitHub releases).
import raw from '../../CHANGELOG.md?raw';
import rawFr from '../../CHANGELOG.fr.md?raw';
import { getLang } from '../i18n';

export interface ReleaseNotes { version: string; items: string[] }

export function parseChangelog(text: string): ReleaseNotes[] {
  const out: ReleaseNotes[] = [];
  let cur: ReleaseNotes | null = null;
  for (const line of text.split(/\r?\n/)) {
    const h = /^##\s+v?(\d+\.\d+\.\d+)/.exec(line);
    if (h) { cur = { version: h[1], items: [] }; out.push(cur); continue; }
    if (!cur) continue;
    const b = /^\s*[-*]\s+(.*)$/.exec(line);
    if (b) cur.items.push(b[1].trim());
    else if (line.trim() && cur.items.length) cur.items[cur.items.length - 1] += ' ' + line.trim(); // wrapped bullet
  }
  return out;
}

const cmp = (a: string, b: string) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

export const CHANGELOG = parseChangelog(raw);
const CHANGELOG_FR = parseChangelog(rawFr);

/** The changelog in the game's language: each version's French notes when they exist, the English otherwise. */
export function localChangelog(): ReleaseNotes[] {
  if (getLang() !== 'fr') return CHANGELOG;
  return CHANGELOG.map((r) => CHANGELOG_FR.find((x) => x.version === r.version) ?? r);
}

/** Notes for every version after `seen`, up to and including `current` (newest first). */
export function notesSince(seen: string | null, current: string, all = localChangelog()): ReleaseNotes[] {
  return all.filter((r) => cmp(r.version, current) <= 0 && (!seen || cmp(r.version, seen) > 0));
}
