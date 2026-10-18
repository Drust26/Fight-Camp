# Fight Camp — Game Development Handoff

Handoff from a long Claude conversation (15–18 Oct 2026) to Claude Code. It records what the game is, what has
been built, how it is built and released, and what was decided and why, so development can continue on the existing
code instead of starting over.

**State at handoff:** version **1.3.0**, commit `eb7531f` ("v1.3.0: French translation") on `main` of
**github.com/Drust26/Fight-Camp**. The GitHub release `v1.3.0` was published by the Release workflow (installer,
`.sha256`, `release-notes-fr.md`), and the CI workflow passed.

**How to read this document**
- **Confirmed:** checked in the code, by tests, by builds, or by the player.
- **Assumption:** believed but not verified.
- **Open:** an unresolved question.

When this file and the code disagree, trust the code. `DEVELOPMENT.md` in the repo is the detailed per-version
engineering log (558 lines) and has more detail on every feature listed here.

---

## 1. Game overview

### Concept (confirmed)
**Fight Camp: MMA Career Simulator** is a single-player MMA career game. The player:
- creates a fighter;
- trains on a weekly plan and manages fatigue, injuries, weight and money;
- takes fights through promotions and contracts;
- **controls every fight in real time** on a 2D canvas: striking, defense, clinch, takedowns, ground positions and
  submissions;
- climbs from amateur bouts to the top promotion, the **Hexagon Fighting Championship (HFC)**, which offers
  double- and triple-champion superfights.

A simulated world of about 470 AI fighters in 5 promotions and 8 divisions keeps running around the player.

### Core gameplay loop (confirmed)
1. **Hub (career mode).** Plan training, pick a gym, coaches and lifestyle, read news and inbox, handle random
   events, and negotiate contracts and sponsors.
2. **Advance time** with Next day, Week, Month or "To fight". Time stops for injuries, offers, events and fight night.
3. **Accept a fight offer** and choose a camp focus. Opponent preparation builds up, then fight-week weight cut and
   weigh-in.
4. **Fight night:**
   - an event card whose other bouts are simulated;
   - walkouts, announcer, referee and faceoff;
   - the real-time fight with commentary.
5. **Results:**
   - official decision, post-fight interview, stats, scorecards, highlights with replays;
   - earnings, ranking and popularity changes.
6. Rankings, titles, reigns, superfights, contracts and the living world move on. Repeat until retirement, which
   ends on a legacy screen and the Hall of Fame.

### Intended audience and design goals
- **Confirmed (from the README and the conversation):**
  - a desktop game (browser or Windows) for players who like deep sports-career simulation and want hands-on fights;
  - controls are keyboard and mouse;
  - there are no touch or mobile controls.
- **Design goals stated or applied during development:**
  - **Original branding only.** All promotions, fighters, gyms, sponsors and belts are fictional.
  - **The career story is the heart of the game:** belts, reigns, superfights, posters, rivalries and history.
  - **Fights are fair simulations.** Both corners use the same rules (same `Intent` interface for player and AI),
    and the engine is deterministic.
  - **No fake UI.** No non-functional buttons or placeholders.
  - **Saves are sacred.** Careers survive updates through versioned migrations, and corrupt saves are never silently
    erased.
- **Open:** no formal statement of target audience, platform priorities or monetization was ever made. The game is
  `"private": true` / `UNLICENSED` in package.json.

---

## 2. Current implementation (feature inventory)

Everything below is **implemented and on `main`** unless marked otherwise. Version tags show when each feature
shipped. Before v1.1.0 the project had no Git history. Its earlier stages are described in `DEVELOPMENT.md`
("v1 checklist", "Roadmap v2", and the 16 Oct updates).

### 2.1 Combat (`src/combat/`)

**Engine** (`engine.ts`, about 1,370 lines):
- Pure simulation with no DOM. Deterministic from `seed` plus intents. Emits a typed `FightEvent` stream.
- Strikes:
  - 11 standing strikes, plus clinch strikes and ground strikes;
  - startup, active and recovery frames, range, stamina cost, accuracy, damage, knockdown power, guard piercing.
- Offense mechanics: power modifier, combos, counters.
- Defense: high guard, body guard and kick checks, slips with a counter window.
- Damage pools for head, body and legs. Stuns, knockdowns, KOs and TKOs.
- Clinch, takedowns and sprawls.
- Ground positions: guard, half guard, side control, mount, back. Ground-and-pound, advances, escapes, sweeps,
  get-ups.
- Submissions: RNC, armbar, triangle, guillotine, each a timed lock-vs-escape contest.
- Rounds and judging: 3- and 5-round fights; three judges with different weightings; UD, SD, MD and draws;
  10-8 rounds.

**AI** (`ai.ts`):
- 10 style profiles. The AI reacts only to visible startups.
- It remembers how the player fights. This memory is stored per opponent and carries into rematches.
- Difficulty (easy, normal, hard, simulation) scales reactions and mistakes.
- Serialize and restore helpers support checkpoints.

**Renderer** (`renderer.ts`) and fighter drawing (`fighterArt.ts`, `animator.ts`, `poses.ts`):
- Canvas 2D: rotating octagon camera, crowd, lighting, anatomical fighters drawn on an 11-joint skeleton, hair,
  beards and tattoos.
- HUD: stamina, damage silhouettes, clock, position, momentum, range bar, attack tells, submission meter.
- The renderer only reads the engine state; it never changes it.

**Fight screen** (`ui/screens/FightScreen.tsx`):
- Keyboard (rebindable) and mouse; clickable context actions.
- Tactical pause (Tab), pause menu (Esc), round breaks with corner advice and game-plan changes.
- Forfeit ("retire on stool").

**Fight recording** (`game/fightrec.ts`):
- An exact mid-fight checkpoint is written every ~5 s and at round breaks, so an interrupted fight can resume.
- The last career fight's replay is kept for highlights and is re-simulated deterministically.

### 2.2 Career systems (`src/game/`)

**Creation** (`career.ts`, `ui/screens/NewCareer.tsx`):
- Identity and appearance editor.
- Physique: height, reach and walking weight, with division eligibility.
- 7 backgrounds, 3 starting levels (Amateur Prospect, New Professional, Experienced Regional Fighter).
- 4 difficulties, goals, and a save slot (3 slots).

**Attributes** (`attributes.ts`): 43 attributes in 4 groups (Physical, Striking, Grappling, Mental), category
ratings and an overall rating.

**Training** (`training.ts`, `data/training.ts`):
- Weekly planner (7 days × morning and evening) with 34 sessions in 6 categories, and presets.
- 6 gyms with facility levels, hireable coaches, and lifestyle choices (housing, nutrition, physio, home gym).
- Fatigue, sharpness and career wear. 8 injury types with severity, blocked sessions and treatment.
- Weight: diet modes, set-point drift, fight-week cut percentage, missed-weight fines.

**Fights and offers** (`fights.ts`):
- Offers, camp focus, opponent preparation and scouting.
- Weigh-ins and withdrawals.
- `applyFightResult()` is the single path that applies the player's result, exactly once.

**Economy** (`economy.ts`):
- Contracts with negotiation (leverage, counters, patience), buyouts, renewals, and release after losing streaks.
- Sponsors (max 3), gyms and coaches, a finances ledger, and debt stress (no bankruptcy).
- **Bidding wars (v1.2.0):** an in-demand free agent gets simultaneous offers. "Let them bid" runs up to
  `BID_ROUNDS = 3` rounds.

**Random events** (`events.ts`): about 16 data-driven events with real effects (callout, coach advice, media,
short notice, intel, gym dispute, rematch, champion injured, charity, loan, supplement, seminar, prospect sparring,
turn pro, retirement talk). Fight-linked events are pruned when their booking ends.

**Superfights** (`superfight.ts`, HFC only):
- **Double champion:** after 4 consecutive defenses (`DOUBLE_AFTER`), the HFC offers the division above; a
  heavyweight goes down instead.
  - Win: the player holds both belts, then chooses one; the other is vacated. +2 to a chosen attribute.
  - Lose: back home, still champion.
- **Triple champion:** keep the new, heavier belt and make 6 straight defenses (`TRIPLE_AFTER`) to be offered the
  next division up. +5 to a chosen attribute.
- Special origin rules for heavyweight and light heavyweight.
- Superfight offers are **always** proposed when the player is eligible (fixed in an earlier update).

**Reigns and belt histories** (`reigns.ts`, save v9/v10):
- Each reign stores the fight that won it, its defenses (including draws), and how it ended (lost, vacated or
  stripped, with a reason).
- In the Trophy case (Fighter tab), clicking a belt opens its history.

**Fight posters** (`poster.ts`, `ui/components/FightPoster.tsx`):
- Five designs by importance: local, card, headliner, title, superfight.
- Shown for upcoming and past fights; there is also a Poster wall.

**Achievements and goals** (`achievements.ts`): 20 achievements and 6 goal trackers.

**Retirement:** legacy rating and tier, retirement screen, Hall of Fame.

### 2.3 World simulation (`world.ts`, `history.ts`, `living.ts`, `eventcard.ts`)

- **Promotions:** `ifc` IFC (tier 1), `rfl` RFL (2), `cms` CMS (3), `gfc` GFC (4), and `acl` HFC (5).
  - **Note:** the HFC's internal id is still `acl`. It was originally the "Apex Combat League"; save v5 renamed the
    stored text.
- **Divisions:** fly, bantam, feather, light, welter, middle, lhw, heavy.
- Rosters, rankings by points, champions, title defenses, injuries, aging, retirements, prospects, promotion
  between leagues.
- **Shared bout history.** Every result goes through `recordBout()`. This feeds:
  - the news feed and the records book (9 records);
  - the Hall of Fame and the pound-for-pound top 15 with its "why" explanations;
  - per-fighter career logs and the player's career timeline.
- **Event cards:** built from real rosters. The undercard is resolved through world `bout()`.
- **Living world (v1.2.0):**
  - AI fighters change weight class (`moveDivisions`).
  - AI HFC superfights (`aiSuperfights`) and double champions (`resolveDoubleChamps`).
  - "Champion vs champion" challenges to the player (`FightOffer.invader`).
  - Rival promotions poach contenders (`poachStars`).
  - `vacateAllBelts` runs on retirement.
- **World tab:** news (with filters), P4P, records and reigns, Hall of Fame. Fighter profile modals; clicking
  yourself opens your own fighter page.

### 2.4 Presentation

- **Fight night** (`FightNight.tsx`):
  - card, walkouts (4 original synthesized tracks, silence, or an uploaded track kept in IndexedDB), announcer
    lines, referee, faceoff;
  - presentation can be Full, Short or Off, and every part can be skipped.
- **Arena styling** by event type (`presentation.ts`); gold styling for title fights.
- **Live commentary** (`commentary.ts`) and **interviews** (`interview.ts`).
- **Audio** (`audio.ts`): synthesized Web Audio sound effects, crowd and music. Optional spoken announcer through
  the browser's speech synthesis (off by default; uses a French voice when the game is in French).
- **Appearance system** (`look.ts`, `AppearanceEditor.tsx`):
  - 16 hairstyles, beards and moustaches;
  - 12 tattoo designs on 13 body regions (max 8 tattoos);
  - face, body and attire options, plus presets.
  - AI fighters' looks are generated deterministically from their id.
  - New shorts cost $200 in career mode.
- **Belts:** an original SVG belt per promotion (`ui/components/Belt.tsx`).
- **Logo and branding:** `branding/` (Python generators); fonts bundled (Oswald, Inter woff2, latin subset).
- **Tutorials:** a 6-step coach tour and a 10-lesson Practice Arena. **Quick Fight** mode.

### 2.5 Admin tools (`AdminTab.tsx`, `AdminWorld.tsx`)

- **Player editor:** every attribute (including "Max all (99)"), body, money, records, champion status, superfight
  state, free appearance editor.
- **World tools:** search fighters; injure or heal; clear a booking; make a rival; prefer as next opponent; make
  champion; retire; fast-forward 7/30/90 days; run a test title fight.
- Destructive actions ask for confirmation.
- **Any admin use sets `adminUsed`**, and the career is shown as "Modified" on the load screen.

### 2.6 Persistence (`save.ts`, `storage.ts`, `store.ts`)

- **`GameState` is the single source of truth.** Screens read it with `useGame()` and change it only through
  `store.act(fn)`, which does `structuredClone`, then the change, then a notify, then a debounced autosave
  (600 ms plus `requestIdleCallback`).
- **Save schema `SAVE_VERSION` is 10.**
  - `migrate()` is gated by version (v2…v10) and also always repairs leftover events (`pruneEvents`).
  - `validate()` checks structure before a save loads.
- **Storage keys:**
  - `fightcamp.slot.N` (slots 1–3) and `fightcamp.slot.N.bak` (backup);
  - `fightcamp.meta` (settings);
  - `fightcamp.lookPresets`;
  - `fightcamp.fight.N` (checkpoint) and `fightcamp.replay.N` (last replay).
- **Browser:** localStorage, with saves compressed using lz-string (`LZ1:` prefix plus `compressToUTF16`). When
  storage is full, backups and replays are freed and the write is retried.
- **Desktop:** the same keys are mapped to files by `desktop/storage.cjs`:
  - `Documents/FightCamp/saves/career-N.fcsave`, now readable indented JSON since v1.1.1;
  - `saves/backups/career-N.backup.fcsave`;
  - `saves/fights/career-N.checkpoint` and `career-N.replay`;
  - `settings.json`, `look-presets.json`, and `data/<key>.dat`.
- Export and import of saves as JSON (Load Career screen).

### 2.7 Desktop app and auto-update (v1.0.0 → v1.1.x)

- **Shell:** `desktop/` (Electron 33) loads the single-file build from `desktop/app/index.html`.
  - Single instance, F11 for fullscreen, no menu, external links open in the system browser.
  - Storage goes through synchronous IPC, exposed as `window.fightcampNative`.
- **Installer:** a custom NSIS installer `FightCamp-Setup-<version>.exe` (about 78 MB).
  - Per-user install with no admin rights; desktop and Start menu shortcuts.
  - Uninstalling never touches Documents/FightCamp.
  - The exe is **not code-signed**, so SmartScreen asks "More info → Run anyway".
- **Updater** (`desktop/updater.cjs`, only in the packaged Windows game):
  1. About 4 s after launch it checks `api.github.com/repos/Drust26/Fight-Camp/releases/latest`.
  2. It downloads the installer to `%TEMP%\FightCamp-update` and verifies its SHA-256 (GitHub's asset `digest`, or
     the `.sha256` asset).
  3. A prompt then offers:
     - **"Restart and update"**: saves, quits, and runs `installer /S /RELAUNCH`;
     - **"Later"**: installs silently on quit.
  - The prompt waits while a fight is running.
  - Since 1.3.0 it also fetches `release-notes-fr.md` for French notes.
  - Test hooks: `FIGHTCAMP_UPDATE_URL`, `FIGHTCAMP_UPDATE_DRYRUN=1`, and `FIGHTCAMP_DATA_DIR` (the data folder).
- **"What's new"** (`changelog.ts`, `WhatsNew.tsx`) is shown once after each update. The version is
  `__APP_VERSION__`, taken from `desktop/package.json`.

### 2.8 Internationalization (v1.3.0, the most recent work)

The French translation is complete. Code is in `src/i18n/`:
- `index.ts` has `t`, `tp`, `tx`, `setLang`, `getLang`, `locale`, `detectLang`, `weekdayShort` and
  `hasTranslation`.
- `fr.ts` holds about 2,750 entries.
- `rich.tsx` has `tn` for sentences that contain React nodes.

How it works:
- **English text is the key.**
  - `t(s, vars)` translates UI text with `{placeholders}`.
  - `tp(one, many, n)` handles plurals (French uses the singular for 0 and 1).
  - `tn()` fills placeholders with React nodes, for example key caps in hints.
- **Generated text stays English in saves.** `tx()` translates it when it is shown, using exact entries first,
  then `{pattern}` entries. As a result, old saves read in French, and switching language never changes a save.
  - Placeholders are typed so patterns cannot swallow other text:
    - numeric: `n`, `m`, `max`, `pct`, `kg`, `lb`, `limit`, `q`, `v`;
    - `div`, `div2`, `div3`: English division names only;
    - `org`: 2–5 capital letters;
    - `method`: KO, TKO, SUB, UD, SD, MD, DRAW or DQ;
    - `rec`: a record like 12-3 or 12-3-1;
    - person names (`name`, `opp`, `a`, `b`, `player`, …): copied verbatim, never translated;
    - `org2` (full promotion name): also copied verbatim.
  - Patterns are sorted so the one with the most fixed text wins.
  - If no pattern matches, `tx()` translates sentence by sentence, then list item by list item (on ", ").
  - Finally, `localizeBits` converts English dates and money. It only touches months and weekdays next to a digit,
    so a fighter named "Jun" is not changed.
- **Stored generated text uses fixed English formats** (`fmtDateEn`, `moneyEn` in `core.ts`). UI formatting uses
  `locale()` (`fr-FR` or `en-GB`).
- **Language choice:**
  - `Settings.lang` (`'en' | 'fr'`); when unset, the game follows the system language.
  - The picker is on the title screen and in Settings.
  - `App.tsx` remounts the UI (`<div key={lang}>`) when the language changes.
- **Release notes:** `CHANGELOG.fr.md` mirrors `CHANGELOG.md`, and the release workflow publishes
  `release-notes-fr.md`.

---

## 3. Technical architecture

### Stack (confirmed from package.json files)
| Area | Choice |
|---|---|
| Language | TypeScript `~5.6.3` (strict) |
| UI | React `^18.3.1`, `react-dom` |
| Build | Vite `^6.0.3`, `@vitejs/plugin-react`, `vite-plugin-singlefile` (one-file HTML build when `SINGLE=1`) |
| Tests | Vitest `^2.1.8` (node environment, `tests/**/*.test.ts`) |
| Icons | `lucide-react` `^0.460.0` |
| Save compression | `lz-string` `^1.5.0` |
| Fonts | `@fontsource/inter`, `@fontsource/oswald` (woff2 subsets copied into `src/assets/fonts`) |
| Desktop | Electron `^33.4.11`, electron-builder `^25.1.8` (`dir` target only), `resedit` (exe icon and version info), custom NSIS script |
| Rendering | Canvas 2D (fights, previews, posters' fighters) and SVG (belts, logo). No WebGL. |
| Audio | Web Audio API synthesis; `speechSynthesis` for the optional announcer |
| CI/CD | GitHub Actions: `ci.yml` and `release.yml` |

There is **no backend and no network use**, except the desktop updater calling the GitHub API.

### Source layout
```
index.html                 Vite entry (#root)
src/main.tsx               mounts <App/>, sets favicon
src/vite-env.d.ts          declares __APP_VERSION__ and ?raw imports
src/combat/                engine.ts, ai.ts, moves.ts, poses.ts, animator.ts, fighterArt.ts, renderer.ts
src/game/                  types.ts (GameState and all types), core.ts (dates, money, ledger, inbox, SAVE_VERSION,
                           withRng), store.ts, save.ts, storage.ts, career.ts, training.ts, fights.ts, economy.ts,
                           world.ts, history.ts, living.ts, reigns.ts, superfight.ts, events.ts, achievements.ts,
                           eventcard.ts, announcer.ts, commentary.ts, interview.ts, fightrec.ts, presentation.ts,
                           poster.ts, look.ts, media.ts, audio.ts, fighterGen.ts, attributes.ts, rng.ts, changelog.ts
src/data/                  world.ts (divisions, orgs, styles, backgrounds, body types, game plans, nations, names),
                           training.ts (sessions, gyms, injuries, lifestyle, sponsors), nations.ts (badges)
src/i18n/                  index.ts, fr.ts, rich.tsx
src/ui/App.tsx             screen router, NavCtx, toasts, error boundary, language remount
src/ui/Tutorial.tsx        coach tour and PRACTICE_LESSONS
src/ui/theme.css           the whole design system (dark "fight-night broadcast" style)
src/ui/components/         common.tsx (Btn, Modal, Confirm, Portrait, Bar, Stat, NationBadge, …), Belt.tsx,
                           BeltHistory.tsx, FightPoster.tsx, Logo.tsx, UpdateNotice.tsx, WhatsNew.tsx,
                           LanguagePicker.tsx
src/ui/screens/            Title, NewCareer, LoadGame, Settings, Hub, FightPrep, FightNight, FightScreen, Results,
                           ResultsExtras, QuickFight, Retirement, LookScreen, AppearanceEditor, BeltChoice
src/ui/screens/tabs/       Overview, FighterTab, TrainingTab, GymTab, CalendarTab, OffersTab, RankingsTab,
                           ContractsTab, FinancesTab, HistoryTab, WorldTab, WalkoutPanel, AdminTab, AdminWorld
tests/                     18 test files and 2 helpers (simHelpers.ts, worldHelpers.ts)
dev/                       art.html/art.ts and poster.html/poster.tsx: dev galleries, not in the build
desktop/                   main.cjs, preload.cjs, storage.cjs, updater.cjs, prepare.cjs, afterPack.cjs,
                           make-installer.cjs, package.json (holds the game's VERSION)
scripts/release-notes.cjs  prints one CHANGELOG section (`--lang fr` reads CHANGELOG.fr.md)
branding/                  logo SVGs, icon.ico, PNGs, make_logo.py, render_icons.py
.github/workflows/         ci.yml, release.yml
```

### How the systems interact
- **Engine and controllers.** Player input (keyboard or mouse) and `AIController` both produce `Intent`s. Each
  frame calls `step(state, [intent0, intent1], dt)`, and the emitted `FightEvent`s feed the renderer, audio,
  commentary, recorder and HUD log.
- **Fight to career.** When a fight is over, `applyFightResult()` updates:
  - the record, money (ledger), rankings and titles/reigns;
  - injuries, rivalries, achievements, poster snapshot, timeline, inbox and news.

  It produces `lastResult` (a `FightResultSummary`) for the Results screen.
- **Career time.** `advanceDay()` runs training sessions, injuries and weight, the world simulation, monthly bills
  and `living.ts`, offers and contract offers, and events. It stops for important things and returns `reasons`.
- **World results.** Every bout result goes through `recordBout()` (history, records, news). `bout()` resolves AI
  bouts.
- **Randomness.** The save stores an RNG state. `withRng(st, fn)` keeps runs reproducible.
- **Rendering and state.** React screens subscribe through `useSyncExternalStore` (store version). The canvas
  renderer is imperative.
- **Platform split.** `storage.ts` picks localStorage or `window.fightcampNative.storage`. Everything else is shared
  between web and desktop.

---

## 4. Design decisions (with reasons and rejected alternatives)

| Decision | Reason | Alternatives rejected |
|---|---|---|
| 2D canvas fighters on a joint skeleton | Good enough look; effort better spent on depth | **WebGL/three.js 3D rewrite**, explicitly rejected ("What not to do yet" in the Development Plan) |
| Combat engine pure and deterministic; player and AI share the `Intent` interface | Identical rules for both corners; headless tests; true replays and exact checkpoints | Separate AI rules |
| One `GameState` changed only through `store.act()` | One source of truth, autosave, no partial changes when a function throws | Scattered component state |
| Save schema versioned with `migrate()`; corrupt saves never erased | The player has a long, valued career (Antoine Belmondo, triple champion) | Resetting incompatible saves |
| Desktop saves are readable JSON (v1.1.1) | The player opened a save in a text editor and saw "Chinese" characters (the lz-string UTF-16 output) | Keeping compressed desktop saves. **The browser keeps compression** because of its ~5 MB limit. |
| Store full context when a fight happens instead of guessing it later | Belt-history and poster bugs came from data guessed after the fact | Inference only (kept only as a fallback for old saves) |
| Admin "Allow new offers now" waives the rest period (`restWaivedFor`) | The old version rewrote fight dates and corrupted belt history | Rewriting history |
| Admin use marks the career "Modified" | Keeps playtest evidence honest | Silent admin changes |
| Electron with a custom NSIS installer (`make-installer.cjs`) and `resedit` | electron-builder's NSIS target needed Wine on Linux | electron-builder's NSIS target |
| Auto-update from GitHub Releases with SHA-256 verification and silent `/S /RELAUNCH` | The player asked that updates download and install by themselves | Manual downloads; electron-updater (not used) |
| The release is created from `main` when `desktop/package.json` has a version with no release yet | Pushing tags was blocked by the proxy in Claude's sandbox (HTTP 403) | Tag-only releases (tag pushes still work) |
| Version lives in `desktop/package.json` | The installer, updater and `__APP_VERSION__` all read it | The root package.json (kept in sync by hand) |
| i18n: English text as the key, with display-time `tx()` for generated text | Old saves translate too; saves stay language-neutral; switching language is instant | Storing translated text; i18n ids such as `offers.title` (the codebase has thousands of inline strings); an i18n library (none added) |
| Weekday names from `Intl` (`weekdayShort`) | "Sun" collided with the "Sun" tattoo design key | Translating short day names as keys |
| Some English keys renamed to avoid collisions ("Shortened", "Ranking & reputation", "Title screen", contact "No/Light/Hard contact") | One English word can need two French translations | Context-tagged keys |
| Fighter names, promotion names, event names and belt engravings stay English | Proper nouns and branding | Translating them |
| Balance changes wait for a clean playtest | The only evidence so far comes from a career with all attributes at 99 | Tuning difficulty from the maxed career |
| Online multiplayer: not now | Scope | — |

---

## 5. Current state

### Works (confirmed)
- **Tests:** `npx tsc -b` is clean and `npm test` passes: **18 files, 66 tests**.
- **Builds:** `vite build` and the single-file build work. CI is green.
- **Release v1.3.0** was published by GitHub Actions with these assets:
  - `FightCamp-Setup-1.3.0.exe` (77,808,900 bytes);
  - its `.sha256`;
  - `release-notes-fr.md`.
- **Auto-update:** the player confirmed in-game that the update from 1.1.0 to 1.1.1 worked on Windows ("Sa marche
  nickel boss").
- **The player's real save** (Antoine Belmondo, triple champion, all attributes at 99) loaded and played in the
  packaged desktop app of 1.1.1 and 1.2.0 during testing here (the packaged Linux build).
- **French browser walkthrough** (Playwright, fr-FR locale), with no console errors:
  - title screen and career creation;
  - every hub tab and the admin panel;
  - 9 months of fast-forward;
  - quick fight HUD, tactical pause and pause menu;
  - a career fight night (card, walkout, cage), forfeit, and the Results screen.
- **Language switching** works and persists across a reload; `<html lang>` is updated.
- **Web version:** published as a private claude.ai artifact (https://claude.ai/artifact/7PYrdQS6dnEcT673F1beBS),
  updated to 1.3.0. It is a Claude-hosted copy of `dist-single/index.html`; the repo does not deploy a website.

### Partially implemented, or limited (confirmed)
- **Audio:** synthesized only (no recorded audio). The announcer voice depends on the browser.
- **Replays:** only the last career fight. Uploaded walkout tracks stay in one browser and are not exported with
  saves.
- **Posters:** use the player's *current* look; past looks are not stored.
- **Older saves:** P4P, records and history only cover data recorded since history tracking began (save v4).
- **Translation:**
  - French text was written by Claude and has **not been reviewed by a native speaker**.
  - Some generated sentences are translated by generic patterns (for example `{title} — {choice}`, `{x} · {y}`) and
    may read slightly mechanically.
  - Sponsor offers and some money amounts in generated text have no `$` (pre-existing English formatting, kept as is).
- **Accessibility:** key rebinding, reduced motion and UI scale (90–120%) only.
- **Docs out of date:**
  - The README "Publishing an update" section does not mention that **CHANGELOG.fr.md now needs a section for each
    version** (a test fails without it).
  - DEVELOPMENT.md's "Known limitations" still mentions Google Fonts and per-browser saves; fonts are now bundled and
    the desktop has file saves.

### Not verified (open)
- Packaged **1.3.0** desktop app: built by CI but not launched by Claude, and not yet confirmed by the player.
- The Windows silent install and relaunch were never run by Claude (no Windows machine). The player's successful
  1.1.1 update is the evidence that they work.
- The French update prompt (release-notes-fr) only applies to the update *after* 1.3.0. Players on 1.2.0 see the
  English prompt for 1.3.0.
- Rare generated-text paths are covered by hand-written French patterns but were **not exercised** by the coverage
  test, which simulates one career (seed 2027, 5 years). Examples: titles stripped for inactivity or injury, some
  living-world inbox messages, the admin-only texts.

### Not implemented (confirmed, from the plans and the item table in DEVELOPMENT.md)
- **Gameplay:**
  - gym ownership, tournaments, agents, medical history, training specialisation, career challenges;
  - post-retirement careers (coach or gym owner);
  - personalities, rival generations, multi-stage rivalries (press conferences);
  - dynamic matchmaking improvements, promotion identities, cross-promotion fights, promotions rising and falling.
- **Customisation and modding:** custom organisations and divisions, modding, a sandbox mode.
- **Combat:** feints, switch stance, cage-clinch positions as separate states, submission scrambles.
- **Platform and tooling:** touch and mobile controls; IndexedDB saves; an automated browser regression suite;
  analytics.
- **Languages:** any language other than English and French.

---

## 6. Outstanding bugs and known issues

No crash bugs are known at handoff. The issues are:

1. **Generosity of bonuses (balance, not fixed).**
   - *Observed* in the player's maxed career: Performance of the Night nearly every fight, 4–5 sponsor bonuses, and
     purses near $400k.
   - *Suspected cause:* bonus rules in `applyFightResult()` (`fights.ts`, around the bonuses/fines block) and sponsor
     win/finish bonuses stacking.
   - *Not changed* on purpose. Measure in a clean career first (Development Plan, Phase 2).
2. **Difficulty is unmeasured.** The only long career used all attributes at 99 (set with admin tools), so its
   17-0, all-finishes run says nothing about normal difficulty. **Open:** how hard an unmodified Normal or Hard career
   is.
3. **Browser storage can fill up.**
   - "Storage full" happened once (player-reported, earlier in development).
   - Mitigation: compressed saves; backups and replays are freed when full; desktop saves use files.
   - Real fix (planned): IndexedDB.
4. **Old saves keep some raw ids in stored text.**
   - Examples: news "12-3 light fighter inks a 4-fight deal", and the timeline "Career began: 21-year-old wrestling
     background…".
   - New text uses proper names. `economy.ts` was fixed in 1.3.0; **`career.ts` still writes the raw background id**
     in "Career began…", though French entries for the ids make it read correctly in French.
   - A superfight boost timeline entry from before 1.3.0 shows a raw attribute key such as `punchPower`.
5. **Unsigned installer.** SmartScreen warns on first run. Fixing it needs a code-signing certificate (an open
   decision for the player).
6. **Belt-history and poster inference for very old saves** relies on heuristics (`fightDivision()`,
   `repairHistoryDates()`, `rebuildReigns()` in `reigns.ts`).
   - These were fixed for the reported cases: the Middleweight belt showed "0 defenses", and the superfight poster
     showed the wrong division.
   - Other unusual old histories could still be inferred wrongly.
   - *Repro if suspected:* load the old save, open Fighter → Trophy case → click the belt, and compare with Fight
     History.

Historical bugs that are fixed (useful context, all in `DEVELOPMENT.md`):
- A crash reading `opponentId` from leftover fight events (fixed with `pruneEvents` in `migrate`, plus regression
  tests).
- The Middleweight belt showed 0 defenses (save v10 repair).
- Wrong division on the heavyweight superfight poster.
- Superfight offers not being proposed (save v8).
- News shown oldest-first.
- Too many living-world moves (capped at 3 a month).
- A retiring double champion keeping a belt.
- A falsy day-0 `dbl` value.
- Poaching taking another promotion's belt holder.
- Duplicate "Later" button labels in the update prompt.

---

## 7. Roadmap (recommended order)

Source: the player-approved **"Fight Camp — Development Plan"** (Claude Doc, 16 Oct 2026,
https://claude.ai/artifact/Rx5MYfCx4J5xH76wFUYFr2), updated with what shipped since. Its phases run in order.

**Phase 1: Stabilise (do first)**
1. Audit data that is *inferred* instead of *stored*, and make every fight store its full context when it happens.
   Posters partly do this already (poster snapshot).
2. **Move browser saves to IndexedDB.**
   - Keep the `KV` interface in `storage.ts`. The web side currently uses synchronous localStorage calls, so an async
     store needs a cache layer or async save paths.
   - The desktop file storage is unaffected.
3. **Automate the Playwright browser playthroughs as a regression suite.** They are currently ad-hoc Python scripts
   that are not in the repo.
4. Lock down admin tools that touch history: make them read-only or clearly flagged.

**Phase 2: Measure difficulty, then tune it** (depends on Phase 1.3 for repeatable runs, and on a clean playtest by
the player)
1. Play a clean career (no admin) on Normal and Hard, from amateur to title contention.
2. Make bonuses rarer: Performance of the Night and sponsor stacking.
3. Then tune:
   - opponents who adapt to how you win (career-long, opponent-specific AI memory);
   - real stakes: weight cuts, accumulated damage lowering the chin, cuts and doctor stoppages, aging;
   - fast-rising dangerous prospects.

**Phase 3: A living world** (partly done in 1.2.0)
- Done: AI weight-class moves, AI superfights and double champions, bidding wars, poaching.
- Remaining:
  - rival generations (aging contemporaries, new fighters who grew up watching you);
  - rivalry storylines (trash talk, press conferences, demanded rematches);
  - cross-promotion fights;
  - promotions rising and falling.

**Phase 4: Fight feel and presentation** (after difficulty is right)
- Feints, switch stance, cage clinch, submission scrambles.
- Actionable corner advice and cut treatment between rounds.
- Broadcast stats overlay, slow-motion replays of finishes, a highlight reel per fight next to its poster.
- **Touch and mobile controls.**
- **Constraint:** changes to combat mechanics, balance, AI or damage need the player's explicit approval (see §9).

**Phase 5: Endgame**
- A GOAT ranking against world history, and record chases.
- Life after fighting: coach or gym owner training a prospect in the same world and Hall of Fame.
- Legends and comeback fights with legacy risk.

**Additional items (not in the plan document)**
- More languages. The i18n system is ready:
  1. add the language to `LANGS` (`src/i18n/index.ts`);
  2. add a dictionary file like `fr.ts`;
  3. extend `t()` and `tx()` to choose it (they currently check `lang === 'fr'`);
  4. extend the plural rule in `tp()`;
  5. add `CHANGELOG.<lang>.md` and a `--lang` release-notes asset;
  6. add `localNotes(rel, '<lang>')` in the updater;
  7. update the tests.
- Native-speaker review of `fr.ts`.
- Code signing for the Windows installer.

**Explicitly not now:** a 3D rewrite, online multiplayer, big balance changes before a clean playtest.

---

## 8. Development workflow

### Prerequisites (confirmed)
- **Node.js:** CI uses Node 20; Claude worked with Node 22.22.0. The README says Node 18+.
- **npm** (lockfiles are committed: `package-lock.json` and `desktop/package-lock.json`).
- **Desktop builds:** Windows with NSIS (`makensis`), or Linux for an unpacked test build.

### Install and run
```bash
npm ci                      # or npm install
npm run dev                 # Vite dev server, http://localhost:5173
npm run build               # tsc -b, then vite build → dist/
npm run preview             # serves dist/ at http://localhost:4173
SINGLE=1 npx vite build --outDir dist-single   # one self-contained HTML file (offline-playable)
```
Dev galleries (not in the build): with `npx vite` running, open `/dev/art.html?m=poses|ground|big|portrait` and
`/dev/poster.html?w=600`.

### Type-check and test
```bash
npx tsc -b                  # also checks tests/ (tsconfig includes src and tests; no @types/node, so tests read
                            # files through import.meta.glob, not fs)
npm test                    # vitest run: 18 files, 66 tests
npx vitest run tests/i18n.test.ts                 # translation coverage only
I18N_DUMP=1 npx vitest run tests/i18n.test.ts -t "generated text"   # prints every generated string with its French
```
Test suites:
- `balance`, `career`, `combat`, `desktop_saves`, `events_regression`, `fightnight`, `history`;
- `i18n`, `judging`, `livingworld`, `longcareer`, `look`, `progression`, `reigns`;
- `replay`, `size`, `superfight`, `tactics`.

**i18n test rules** (they will fail your build if ignored):
- Every literal passed to `t()`, `tn()` or `tp()` must exist in `src/i18n/fr.ts`. Ternary branches count.
- Every literal `label="…"` on `Chips`, `Swatches`, `Slider`, `NumField`, `NoteRow` and `FightRow` must exist too.
- Every game-data name and description must have French.
- Every string generated during the simulated 5-year career must be covered by an exact entry or a pattern.
- The French and English entries of each pair must have the same `{placeholders}`.
- `CHANGELOG.fr.md` must have a section for the current version.
- **When you add UI text:** wrap it in `t()`. Text the game *stores* (inbox, news, timeline, ledger, reasons, notes)
  stays English in code; add a French pattern to `fr.ts` and make sure the UI shows it through `tx()`.
- Never call `t()` at module level, because the language is set at render time. Avoid naming local variables `t`
  in files that import `t`.

### Desktop build (locally)
```bash
SINGLE=1 npx vite build --outDir dist-single
cd desktop && npm ci
npm run dist:win            # prepare.cjs → electron-builder --win dir --x64 → make-installer.cjs (needs NSIS)
npm start                   # run Electron against desktop/app (run prepare.cjs first)
```
- Outputs go to `desktop/release/` (git-ignored); `desktop/app/` and `desktop/build/` are generated.
- Environment variables for testing: `FIGHTCAMP_DATA_DIR`, `FIGHTCAMP_UPDATE_URL`, `FIGHTCAMP_UPDATE_DRYRUN=1`.

### Releasing a new version (how it was done for 1.1.0 → 1.3.0)
1. Add `## v<version>` sections at the top of **both** `CHANGELOG.md` and `CHANGELOG.fr.md`.
2. Set the version in **`desktop/package.json`**. Also keep the root `package.json` in sync (done by hand so far).
3. Optionally add a section to `DEVELOPMENT.md`.
4. Commit and push to `main`.

`release.yml` then runs:
- It checks whether release `v<version>` exists.
- If not, on `windows-latest`: npm ci, tsc, tests, single-file build, `choco install nsis`, package and installer,
  `.sha256`, release notes in English and French.
- It publishes with `softprops/action-gh-release@v2` and creates the tag.

`ci.yml` runs tsc, tests and both builds on every push and pull request to `main`. Installed games pick up the
release on their next launch.

### Commit convention used so far
Each commit is a version, with a summary body, ending with:
```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SVMhpXBPCvhqxRC4DCkgyH
```
(This was the attribution required in the Claude environment. Use whatever Claude Code's environment asks for.)

---

## 9. Important context from the conversation

### The player and their preferences (confirmed)
- The repo owner is **Drust** (GitHub `Drust26`). Writes mostly in English, sometimes French; French-speaking
  (requested the French translation).
- Plays on **Windows** with the installed game. Saves live in `Documents\FightCamp\saves`.
- Main career is **Antoine Belmondo**: HFC triple champion, about 17-0 at the time, **all attributes set to 99 from
  the start with the admin tools**. The player reports issues from this career with screenshots.
- Values:
  - realistic, professional MMA presentation (posters "like professional MMA promotional posters", belt histories);
  - automatic updates;
  - readable save files;
  - concise explanations.

### Standing rules from earlier in the conversation
The exact original wording is not preserved; these are the rules as applied.
- Don't change combat mechanics, balance, AI or damage unless asked. Presentation-only changes to the renderer are
  allowed.
- Preserve saves: add migrations with a version bump and a test. Never erase or rewrite a save silently.
- All branding original and fictional. No real promotions, fighters or brands.
- No non-functional UI.
- Never fabricate test results. Report what was and wasn't verified.
- Admin tools must not be exposed accidentally, destructive admin actions need confirmation, and careers changed by
  admin tools are marked as modified.

### Features requested by the player in this conversation (all delivered)
1. Trophy-case belt history menus (won, defenses, lost or vacated with reason) and generated fight posters for every
   upcoming and past fight, with designs by importance.
2. Superfight poster division fix, and opening your own fighter page.
3. A development plan (delivered as the Claude Doc above).
4. A logo and a Windows `.exe` with saves in `Documents\FightCamp\saves`.
5. A GitHub repo with automatic updates (v1.1.0).
6. Readable saves and What's new (v1.1.1), after the player saw "Chinese" characters in a save.
7. v1.2.0 "Living world", chosen by the player over the other options offered.
8. French translation (v1.3.0).

### Environment facts that may matter
- Claude worked in a cloud Linux container, not on the player's PC.
  - The working copy was `/home/claude/fight-camp`, cloned from GitHub; an older copy `/home/claude/fightcamp` is
    obsolete.
  - Windows-only steps were never executed there.
- In that environment, **tag pushes were rejected (HTTP 403)** by the network proxy, which is why releases are
  created from `main`. This may not apply on the player's machine.
- Browser checks used Playwright with Chromium against `npm run preview` on port 4174.
  - The scripts were throwaway Python files in a scratch folder and are **not in the repo**; Phase 1 suggests
    adding real ones.
- The single-file web build is also published as a private claude.ai artifact.
  - Process: build with `SINGLE=1 npx vite build --outDir dist-single`, strip
    `<!doctype>/<html>/<head>/<body>/<meta>`, then prepend `<title>Fight Camp</title>`.
  - This is optional and Claude-specific.

### Open questions
- Should the root `package.json` version be derived automatically from `desktop/package.json`? Currently both are
  edited by hand.
- Code-signing certificate for the installer: wanted or not?
- Target difficulty curve: waits for the player's clean playtest.
- Which language comes after French, if any?
- Whether earlier projects in the player's Claude account ("IRONCARD — MMA Career Simulator", 23 Sep 2026; esports
  sims) relate to this codebase is **unknown**. Nothing in this conversation connected them.
