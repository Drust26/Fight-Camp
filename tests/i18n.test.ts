// French translation coverage: every UI string, every game-data name and every piece of text the game generates
// (news, inbox, timeline, results, events, commentary…) must have a French entry. Missing entries would show in
// English, so these tests list them.
import { describe, it, expect, afterAll } from 'vitest';
import { FR } from '../src/i18n/fr';
import { hasTranslation, setLang, t, tp, tx } from '../src/i18n';
import { ACCESSORIES, BACKGROUNDS, BODY_TYPES, DIVISIONS, FACIAL_HAIR, GAME_PLANS, HAIR_STYLES, NATIONS, ORGS, STYLES } from '../src/data/world';
import { GYMS, INJURIES, LIFESTYLE, SESSIONS, SPONSORS } from '../src/data/training';
import { ATTRS, CATEGORY_DEFS } from '../src/game/attributes';
import { ACHIEVEMENTS, GOALS } from '../src/game/achievements';
import { START_LEVELS } from '../src/game/career';
import { CAMP_FOCUS } from '../src/game/fights';
import { POS_NAME, SUB_NAME } from '../src/combat/engine';
import { SLOT_NAME } from '../src/game/eventcard';
import { TRACKS } from '../src/game/audio';
import { BEARDS, EYES, HAIR, HEAD_SHAPES, MOUSTACHES, SHORTS_STYLES, TATTOO_DESIGNS, TATTOO_REGIONS, TORSOS, WALKOUT_TOPS } from '../src/game/look';
import { BELT_INFO } from '../src/ui/components/Belt';
import { ACTION_LABELS } from '../src/ui/screens/Settings';
import { PRACTICE_LESSONS } from '../src/ui/Tutorial';
import { localChangelog } from '../src/game/changelog';

const placeholders = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join(' ');

// ── literal keys in the source: first argument of t()/tn() (ternaries included), both forms of tp(), and the
//    label="…" props of components that translate their label
function splitArgs(src: string, i: number): string[] {
  let depth = 0, cur = '', q: string | null = null;
  const out: string[] = [];
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (q) { cur += c; if (c === '\\') { cur += src[++j]; continue; } if (c === q) q = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { q = c; cur += c; continue; }
    if ('([{'.includes(c)) { depth++; if (depth > 1) cur += c; continue; }
    if (')]}'.includes(c)) { depth--; if (depth === 0) { out.push(cur); return out; } cur += c; continue; }
    if (c === ',' && depth === 1) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  return out;
}
const unquote = (s: string) => (s[0] === '"' ? JSON.parse(s) : s.slice(1, -1).replace(/\\'/g, '\'').replace(/\\`/g, '`').replace(/\\\\/g, '\\'));
function literalKeys(src: string): string[] {
  const keys: string[] = [];
  for (const m of src.matchAll(/(?<![\w.])(t|tn|tp)\(/g)) {
    const args = splitArgs(src, m.index! + m[0].length - 1);
    for (const seg of m[1] === 'tp' ? args.slice(0, 2) : args.slice(0, 1)) {
      const flat = seg.replace(/\[[^\]]*\]/g, ''); // index expressions (TABLE[key ?? 'x']) are lookups, not text
      for (const lm of flat.matchAll(/(===|!==|==|!=|\?\?)?\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\$]|\\.)*`)/g)) {
        if (lm[1]) continue; // compared values and fallbacks are ids, not text
        const k = unquote(lm[2]);
        if (/[A-Za-z]/.test(k)) keys.push(k);
      }
    }
  }
  for (const m of src.matchAll(/<(Chips|Swatches|Slider|NumField|NoteRow|FightRow)\b[^>]*?\blabel="([^"]+)"/g)) keys.push(m[2]);
  return keys;
}
const SOURCES = import.meta.glob(['../src/**/*.ts', '../src/**/*.tsx', '!../src/i18n/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

afterAll(() => setLang('en'));

describe('French translation', () => {
  it('every entry keeps the same {placeholders} as its English key', () => {
    const bad = Object.entries(FR).filter(([k, v]) => placeholders(k) !== placeholders(v)).map(([k]) => k);
    expect(bad).toEqual([]);
    expect(Object.values(FR).filter((v) => !v.trim())).toEqual([]);
  });

  it('every UI string in the source has a French entry', () => {
    const missing = new Set<string>();
    let n = 0;
    for (const [f, src] of Object.entries(SOURCES)) for (const k of literalKeys(src)) { n++; if (!(k in FR)) missing.add(`${f.replace('../src/', '')}: ${k}`); }
    expect(n).toBeGreaterThan(1000);
    expect([...missing]).toEqual([]);
  });

  it('every game-data name and description has a French entry', () => {
    const keys: string[] = [
      ...DIVISIONS.map((d) => d.name), ...ORGS.flatMap((o) => [o.desc, o.expectations]), ...STYLES.flatMap((s) => [s.name, s.desc]),
      ...BACKGROUNDS.flatMap((b) => [b.name, b.desc]), ...BODY_TYPES.flatMap((b) => [b.name, b.desc, b.suggest]), ...GAME_PLANS.flatMap((g) => [g.name, g.desc, g.bonus]),
      ...NATIONS, ...HAIR_STYLES, ...FACIAL_HAIR, ...ACCESSORIES,
      ...SESSIONS.flatMap((s) => [s.name, s.desc]), ...GYMS.flatMap((g) => [g.location, g.specialty]), ...Object.values(INJURIES).flatMap((i) => [i.name, i.desc, ...i.blocks]),
      ...Object.values(LIFESTYLE.housing).flatMap((h) => [h.name, h.desc]), ...Object.values(LIFESTYLE.nutrition).flatMap((h) => [h.name, h.desc]),
      LIFESTYLE.physio.name, LIFESTYLE.physio.desc, LIFESTYLE.homeGym.desc, ...SPONSORS.flatMap((s) => [s.kind, s.desc]),
      ...ATTRS.flatMap((a) => [a.name, a.effect, a.group]), ...CATEGORY_DEFS.map((c) => c.name),
      ...ACHIEVEMENTS.flatMap((a) => [a.name, a.desc]), ...GOALS.flatMap((g) => [g.name, g.desc]), ...START_LEVELS.flatMap((s) => [s.name, s.desc]),
      ...CAMP_FOCUS.flatMap((c) => [c.name, c.desc]), ...Object.values(POS_NAME), ...Object.values(SUB_NAME), ...Object.values(SLOT_NAME),
      ...TRACKS.map((x) => x.mood), ...[HAIR, BEARDS, MOUSTACHES, HEAD_SHAPES, EYES, TORSOS, SHORTS_STYLES, WALKOUT_TOPS, TATTOO_DESIGNS, TATTOO_REGIONS].flatMap((l) => l.map((x) => x.name)),
      ...Object.values(BELT_INFO).flatMap((b) => [b.name, b.desc]), ...Object.values(ACTION_LABELS), ...PRACTICE_LESSONS.flatMap((l) => [l.title, l.body]),
      'W', 'L', 'D', 'KO', 'TKO', 'SUB', 'UD', 'SD', 'MD', 'DRAW', 'DQ', 'orthodox', 'southpaw', 'easy', 'normal', 'hard', 'simulation',
      'purse', 'bonus', 'sponsor', 'gym', 'coach', 'medical', 'living', 'lifestyle', 'equipment', 'other', 'training',
      'striking', 'wrestling', 'grappling', 'conditioning', 'recovery', 'partners', 'tactics', 'No contact', 'Light contact', 'Hard contact',
      'Favourable', 'Slight edge', 'Even fight', 'Tough', 'Dangerous', 'Easy', 'Manageable', 'Hard', 'Double Champion', 'Triple Champion',
    ].filter(Boolean) as string[];
    const missing = [...new Set(keys.filter((k) => !(k in FR)))];
    expect(missing).toEqual([]);
  });

  it('every release has French notes too', () => {
    setLang('fr');
    const fr = localChangelog();
    setLang('en');
    const en = localChangelog();
    expect(fr[0].version).toBe(__APP_VERSION__);
    expect(fr[0].items.join(' ')).not.toBe(en[0].items.join(' ')); // CHANGELOG.fr.md needs a section for this version
    expect(fr.length).toBe(en.length);
  });

  it('t, tp and tx switch with the language', () => {
    setLang('fr');
    expect(t('Fight Offers')).toBe(FR['Fight Offers']);
    expect(tp('{n} day left', '{n} days left', 1)).toBe('1 jour restant');
    expect(tp('{n} day left', '{n} days left', 0)).toBe('0 jour restant');
    expect(tp('{n} day left', '{n} days left', 3)).toBe('3 jours restants');
    expect(t('Not a key')).toBe('Not a key');
    expect(tx('R12')).toBe('R12');
    expect(tx('Rxyz plus some words')).toBe('Rxyz plus some words'); // a short key like 'R{n}' must not swallow a sentence
    setLang('en');
    expect(t('Fight Offers')).toBe('Fight Offers');
    expect(tx('Lightweight')).toBe('Lightweight');
    void hasTranslation;
  });
});

// ── text the game generates while playing: a multi-year career with real fights, commentary and interviews
import { advanceDay, createCareer, legacyRating, legacyTier } from '../src/game/career';
import { acceptOffer, applyFightResult, opponentReport, opponentSetup, playerFightAttrs, playerSetup } from '../src/game/fights';
import { AIController } from '../src/combat/ai';
import { contextActions, createFight, startNextRound, step } from '../src/combat/engine';
import { activeEvents, resolveEvent, EVENT, EVENTS } from '../src/game/events';
import { generateContractOffers, letThemBid, negotiate, signContract, turnPro } from '../src/game/economy';
import { Commentator, careerCommentaryContext } from '../src/game/commentary';
import { introLines } from '../src/game/announcer';
import { interviewOptions, applyInterview } from '../src/game/interview';
import { legacyBreakdown, p4p } from '../src/game/history';
import { superfightProgress, SUPERFIGHT_RULES, tripleHint } from '../src/game/superfight';
import { checkSession } from '../src/game/training';
import { posterForHistory } from '../src/game/poster';
import { withRng } from '../src/game/core';
import { SESSIONS as ALL_SESSIONS } from '../src/data/training';
import type { GameState } from '../src/game/types';

function collectCareerText(seed: number, years: number): Map<string, string> {
  const out = new Map<string, string>();
  const add = (where: string, s: string | null | undefined) => { if (s && /[A-Za-z]{2}/.test(s) && !out.has(s)) out.set(s, where); };
  const st = createCareer({ firstName: 'Lucas', lastName: 'Ferreira', nickname: 'The Wall', nationality: 'Brazil', age: 21, heightCm: 180, reachCm: 185, hand: 'right', stance: 'orthodox',
    bodyType: 'lean', background: 'wrestling', startLevel: 'amateur', difficulty: 'easy', goals: ['champion', 'ko_artist'], divisionId: 'welter', naturalKg: 79,
    appearance: { skin: 1, hair: 1, hairColor: 0, facialHair: 0, shorts: 0, gloves: 0, accessory: 0 }, seed }, 1);
  st.player.gymId = 'northstar'; st.player.money = 60000;
  for (const k of Object.keys(st.player.attrs)) (st.player.attrs as any)[k] = Math.max((st.player.attrs as any)[k], 70);
  const fight = (g: GameState, s0: number) => {
    const sc = g.scheduled!;
    const s = createFight({ rounds: sc.rounds, roundSeconds: 45, seed: s0, title: sc.title }, playerSetup(g, sc.gamePlan), opponentSetup(g, sc.opponentId, sc.title));
    const ctx = careerCommentaryContext(g); const com = ctx ? new Commentator(ctx) : null;
    if (com) for (const l of com.opening(s)) add('commentary', l);
    const me = new AIController(0, 'balanced', 'hard', s0 + 1), op = new AIController(1, g.world.fighters[sc.opponentId].style, 'normal', s0 + 2);
    let n = 0;
    while (s.phase !== 'over' && n++ < 400000) {
      if (s.phase === 'roundOver') { startNextRound(s); if (com) add('commentary', com.roundStart(s)); }
      step(s, [me.think(s, 1 / 60), op.think(s, 1 / 60)], 1 / 60);
      for (const e of s.events.splice(0)) { add('fight log', e.text); if (com) add('commentary', com.onEvent(e, s)); }
      if (com) add('commentary', com.tick(s));
      if (n % 600 === 0) for (const a of contextActions(s, 0)) add('actions', a.label);
    }
    if (com) add('commentary', com.closing(s));
    add('outcome', s.outcome?.detail);
    return s;
  };
  let fights = 0;
  for (let d = 0; d < 365 * years && !st.player.retired; d++) {
    for (const e of activeEvents(st)) { const tpl = EVENT[e.templateId]; add('event', tpl.title(st, e)); add('event', tpl.body(st, e)); for (const c of tpl.choices) { add('event', c.label); add('event', c.hint); } add('event', resolveEvent(st, e.id, (d % 3) % tpl.choices.length)); }
    if (!st.player.isPro && st.player.amateurRecord.w >= 2) add('turnPro', turnPro(st));
    if (st.player.isPro && !st.scheduled && st.contractOffers.length) {
      for (const c of st.contractOffers) { add('offer note', c.note); }
      if (st.contractOffers.some((c) => c.bid)) add('bid', withRng(st, (rng) => letThemBid(st, rng)).message);
      const best = [...st.contractOffers].sort((a, b) => b.purse - a.purse)[0];
      add('negotiate', negotiate(st, best.id, { purse: best.purse * 1.6, winBonus: best.winBonus, signingBonus: best.signingBonus, fights: best.fights }).message);
      if (!st.player.contract || st.player.contract.fightsLeft <= 1 || best.orgId !== st.player.orgId) add('sign', signContract(st, best.id));
    }
    if (!st.scheduled && st.offers.length) { for (const o of st.offers) add('offer note', o.note); const o = st.offers.find((x) => x.title) ?? st.offers[0]; add('accept', acceptOffer(st, o.id, (['general', 'cardio', 'southpaw'] as const)[d % 3])); }
    if (st.scheduled) {
      for (const l of opponentReport(st, st.scheduled.opponentId).lines) add('scouting', l);
      for (const l of playerFightAttrs(st).notes) add('condition', l);
    }
    if (st.scheduled && st.scheduled.day <= st.day) {
      const sc = st.scheduled;
      const intro = introLines(st, sc); for (const l of [...intro.lines, ...intro.blue, ...intro.red]) add('announcer', l);
      const r = applyFightResult(st, fight(st, 5000 + d), {})!;
      fights++;
      for (const l of [...r.feedback.good, ...r.feedback.bad, ...r.feedback.tips, ...(r.announce ?? [])]) add('result', l);
      for (const b of [...r.bonuses, ...r.fines]) add('result', b.label);
      const opts = interviewOptions(st, r); for (const o of opts) { add('interview', o.label); add('interview', o.quote); add('interview', o.effects); }
      add('interview', applyInterview(st, r, opts[d % opts.length].id));
      const h = st.player.history[0]; const poster = posterForHistory(st, h);
      for (const x of [h.notes, h.event, ...h.bonuses, ...poster.undercard]) add('history', x);
      if (st.player.pendingBeltChoice) { const pc = st.player.pendingBeltChoice; add('belt', tripleHint(pc, pc.home)); add('belt', tripleHint(pc, pc.won)); }
      continue;
    }
    if (d % 7 === 0) for (const s of ALL_SESSIONS) add('session check', checkSession(st, s.id).reason);
    const res = advanceDay(st);
    for (const r of res.reasons) add('advance', r);
  }
  for (const n of st.world.news) { add('news', n.title); add('news', n.body); }
  for (const m of st.inbox) { add('inbox', m.title); add('inbox', m.body); }
  for (const x of st.timeline) add('timeline', x.text);
  for (const l of st.ledger) add('ledger', l.label);
  for (const l of st.dayLogs ?? []) for (const x of l.lines) add('day log', x);
  for (const r of st.player.reigns ?? []) add('reign', r.end?.reason);
  for (const f of Object.values(st.world.fighters)) for (const m of f.mv ?? []) add('move', m.why);
  for (const v of Object.values(st.world.records)) add('record', (v as any)?.detail);
  for (const r of p4p(st, 15)) for (const w of r.why) add('p4p', w);
  for (const x of legacyBreakdown({ w: 10, l: 2, finishes: 6, titles: 1, defenses: 2, bestStreak: 6, tierBonus: 6 }).factors) add('legacy', x.label);
  add('superfight', superfightProgress(st)); add('legacy', legacyTier(legacyRating(st)));
  for (const r of SUPERFIGHT_RULES) add('rules', r);
  void fights; void EVENTS; void generateContractOffers;
  return out;
}

describe('French translation of generated text', () => {
  it('everything a long career generates is covered', { timeout: 300000 }, () => {
    const all = collectCareerText(2027, 5);
    // names, shouted names and event names read the same in every language
    const neutral = (s: string) => /^[^a-z]+!$/.test(s) || /^\S+… ".*"… [^a-z]+!$/.test(s) || /^[\p{L}'-]+ vs [\p{L}'-]+$/u.test(s) || /^(HFC|GFC|CMS|RFL|IFC)( Fight Night)?( \d+)?(: .+)?$/.test(s);
    const missing = [...all].filter(([s]) => !neutral(s) && !hasTranslation(s)).map(([s, w]) => `${w}: ${s}`);
    console.log(`${all.size} distinct generated strings, ${missing.length} without French`);
    expect(all.size).toBeGreaterThan(800);
    expect(missing).toEqual([]);
    if (import.meta.env.I18N_DUMP) { setLang('fr'); console.log([...all.keys()].map((s) => `${s}\n  → ${tx(s)}`).join('\n')); setLang('en'); }
  });
});
