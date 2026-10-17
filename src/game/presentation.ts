// Fight-night presentation helpers (venue look, walkout tracks). Presentation only — no effect on results.
import { ORG } from '../data/world';
import { eventKind, type EventKind } from './eventcard';
import { TRACKS } from './audio';
import type { ArenaTheme } from '../combat/renderer';
import type { ScheduledFight } from './types';

export function arenaTheme(sc: ScheduledFight): ArenaTheme & { kind: EventKind; label: string } {
  const kind = eventKind(sc);
  const org = ORG[sc.orgId];
  switch (kind) {
    case 'amateur': return { kind, label: 'Community hall', crowd: 0.18, light: 0.6, accent: '#8a9bb0', matText: 'AMATEUR', gold: false };
    case 'regional': return { kind, label: 'Regional venue', crowd: 0.4, light: 0.8, accent: org.color, matText: org.short, gold: false };
    case 'standard': return { kind, label: 'Arena', crowd: 0.7, light: 1, accent: org.color, matText: org.short, gold: false };
    case 'major': return { kind, label: 'Major arena', crowd: 1, light: 1.15, accent: org.color, matText: org.short, gold: false };
    case 'title': return { kind, label: 'Championship night', crowd: 1, light: 1.3, accent: org.color, matText: org.short, gold: true };
  }
}

/** Opponent walkout track — stable per fighter. */
export function trackForFighter(id: string): string {
  const pool = TRACKS.filter((t) => t.id !== 'silence');
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return pool[h % pool.length].id;
}
