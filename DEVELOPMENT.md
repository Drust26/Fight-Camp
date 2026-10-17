# Development checklist

## Update 17 Oct 2026 (4) — v1.3.0: French translation
- **How it works** (`src/i18n/`): the English text is the key.
  - `t(text, vars)` translates UI text with `{placeholders}`; `tp(one, many, n)` handles plurals (French uses the
    singular for 0 and 1); `tn(text, nodes)` (rich.tsx) puts React nodes such as key caps into a translated sentence.
  - `fr.ts` holds about 2,750 entries: UI strings, game data (divisions, styles, sessions, injuries, sponsors,
    attributes, achievements, look options…), and patterns for text the game generates.
  - `tx(text)` translates generated English text when it is shown: news, inbox, timeline, ledger, events, offers,
    results, commentary, announcer, interviews, fight log. Saves keep English, so existing careers read in French and
    switching language never touches a save.
    - Order: exact entry (case-insensitive for lower-cased names), then patterns (most fixed text first), then
      sentence by sentence, then list items, then dates and money ("12 Mar 2027" → "12 mars 2027", "$1,234" →
      "1 234 $").
    - Placeholders are typed so patterns cannot swallow other text: numbers (`n`, `m`, `pct`, `kg`…), division
      names (`div`, `div2`…), promotion codes (`org`), methods (`method`), records (`rec`) and people's names
      (`name`, `opp`, `a`, `b`, `player`…), which are copied as they are.
  - Stored text uses fixed English formats (`fmtDateEn`, `moneyEn`); the UI formats with `locale()`.
- **Language choice:** `Settings.lang`, unset = the system language (`detectLang`). Picker on the title screen and in
  Settings; the app remounts in the new language. Weekday names, dates and money come from `Intl`. The spoken
  announcer uses a French voice.
- **Release notes:** `CHANGELOG.fr.md` mirrors CHANGELOG.md. "What's new" shows the French notes in French, and the
  release workflow publishes `release-notes-fr.md`, which the updater (from 1.3.0) shows in the update prompt.
- **Code changes outside the UI:** the canvas HUD in `combat/renderer.ts` (display only; the engine is unchanged),
  poster text built in `poster.ts`, a few generated sentences now use names instead of ids (division, background,
  boost attribute).
- **Tests:** `tests/i18n.test.ts` (6 tests):
  - placeholders match in every entry;
  - every literal UI string in the source has French (about 1,100 keys);
  - every game-data name and description has French;
  - a 5-year career with real fights, events, contracts, commentary and interviews: all ~1,980 distinct generated
    strings are covered;
  - French notes exist for the current version;
  - `t`/`tp`/`tx` switch with the language.

  Full suite: 18 files, 66 tests.
- **Browser (French, fr-FR locale):** title, career creation, every hub tab, admin, 9 months of fast-forward (news,
  inbox, offers), quick fight HUD, tactical pause, a career fight night (card, walkout, cage) and the results screen
  are all in French, with no console errors.

## Update 17 Oct 2026 (3) — v1.2.0 "Living world"
- `src/game/living.ts` runs from the monthly career tick. Fighters booked against the player (offers, booking, card,
  pending events) are never touched.
  - `moveDivisions`: at most 3 moves a month worldwide, at most one per promotion and division, and only from rosters
    of 6 or more. A fighter moves again only after 18 months. Triggers:
    - 2+ title-fight losses in 3 years, including one to the current champion, while ranked top 5 (10%/month);
    - three straight losses (4%);
    - 7+ cm taller or shorter than the division average (1.5%).

    The ranking points carried over are ×0.65 + 4. Moves are news in tier 3+ promotions or in the player's division;
    otherwise they only appear on the fighter's profile (`f.mv`).
  - `aiSuperfights`: an AI HFC champion with 3 straight defenses (`rdf`, counted in recordBout) fights the next
    division's champion, or its top contender if the title is vacant. One a month at most, with a 1-year cooldown
    (`sfx`) and a 30% chance each month. If the next division's champion is the player, it becomes an offer instead.
  - `resolveDoubleChamps`: double champions (`dbl`) hold both belts for at least 120 days, then keep one (55% the
    new division) and vacate the other. A champion whose only belt is in another division moves there. Retired
    belt holders are cleared.
  - `poachStars` (quarterly): contenders and former champions of tier 2+ promotions sign with a rival of the same
    tier or one up (up to 3 a quarter). Rarely a champion leaves and vacates.
  - `invaderFor`, used by generateOffers, turns the next division's champion into a "champion vs champion"
    title-defense offer for the player (`FightOffer.invader`, 1.3× purse).
    - If the player loses, the opponent holds both belts.
    - The poster uses the superfight design with "AT STAKE" and "HIS BELT" belts.
- `world.bout()` takes the title's division (a double champion defends a belt outside his own weight class).
  - `rankings()` lists a double champion at the top of both divisions.
  - `vacateAllBelts` is used on retirement and by the admin "Retire" tool.
- **Bidding war** (`economy.ts`): an in-demand free agent gets offers from their promotion and up to two rivals at once.
  - "In demand" means champion, top 5, popularity 45+ or leverage 60+.
  - Each offer has a hidden ceiling of 1.15–1.45× its first purse; a lower-tier rival adds a 25% premium.
  - `letThemBid`: up to 3 rounds; each round tries to top the best offer. A promotion stuck far behind drops out.
  - No side offers come while the war runs; signing ends it.
- **UI:**
  - News kinds "Weight-class move" and "Superfight".
  - Profiles show every belt held, "Double champion", straight defenses and the move history.
  - Contracts has the bidding-war banner with "Let them bid".
  - Offers and Fight Prep show "CHAMPION VS CHAMPION" tags.
  - The update prompt renders the notes as a list.
- **Tests:** `tests/livingworld.test.ts` (6 tests) covers:
  - 4 simulated years of moves and their consistency;
  - an AI superfight leading to a double champion who vacates a belt;
  - locked fighters never moving, and rosters never drained;
  - the player challenged, losing, and the opponent becoming a double champion;
  - the bidding-war rounds, ceilings and signing;
  - a retiring double champion.

  Test helpers moved to `tests/worldHelpers.ts`. Full suite: 17 files, 60 tests.
- **Browser:** after 3 fast-forwarded years, 27 move stories, a superfight ("becomes a double champion") and 40
  signing stories, and a moved fighter's profile shows his move. No errors.

## Update 17 Oct 2026 (2) — v1.1.1: readable saves, "What's new"
- **Readable saves:** desktop careers are written as indented JSON (`careerData()` in `save.ts`, about 2 MB for a
  long career). The browser keeps compressed saves for its ~5 MB limit, and both formats always load.
  - A 1.1.0 save is converted the next time it is saved, and the previous file stays in `saves/backups`.
  - Checkpoints and replays stay compressed (internal files).
- **"What's new"** (`src/game/changelog.ts`, `ui/components/WhatsNew.tsx`):
  - CHANGELOG.md is bundled at build time.
  - The title screen shows the notes for every version newer than the last one seen (`seenVersion` in settings).
  - A first run records the version silently; a player with existing careers but no `seenVersion` (coming from 1.1.0) sees the current notes.
  - Settings → Version/Updates has a "What's new" button with the full changelog, in the browser too.
- **Tests:**
  - `tests/desktop_saves.test.ts`: the desktop bridge faked in memory; the JSON format, old compressed saves loading and converting, backup restore; changelog parsing and "versions since".
  - A test that fails if CHANGELOG.md has no section for the current version.
  - Full suite: 16 files, 54 tests.
- **Browser and desktop checks:**
  - First run shows no "What's new"; after an update it shows once.
  - Packaged desktop app with the player's real 1.1.0 save (Antoine Belmondo 20-0): "What's new" shown, the career continues, and saving rewrites it as readable JSON with the old file kept as a backup.

## Update 17 Oct 2026 — GitHub repository and automatic updates (v1.1.0)
- **Repository:** github.com/Drust26/Fight-Camp, public, with `main` as the default branch.
  - The game's version lives in `desktop/package.json` and is shown on the title screen (`__APP_VERSION__`).
  - Each release's notes come from `CHANGELOG.md`.
- **Updater** (`desktop/updater.cjs`, in the installed Windows game only):
  1. About 4 s after launch, and every 4 h while the game is open after a failed or empty check, it asks
     `api.github.com/repos/Drust26/Fight-Camp/releases/latest` for the newest release.
  2. A newer `FightCamp-Setup-<v>.exe` downloads to `%TEMP%\FightCamp-update`, with a progress pill in the game.
  3. The download is verified against the release asset's SHA-256: GitHub's `digest`, or a `.sha256` file published with the release. On a mismatch the file is discarded.
  4. Once ready, a prompt shows the release notes:
     - **"Restart and update"** saves the career, quits, and runs the installer with `/S /RELAUNCH`. The installer
       waits 2 s for the game to exit, replaces its files in the same folder (read from the registry) and reopens the game.
     - **"Later"** installs silently on quit, without reopening.
  - The prompt waits while a fight is running.
  - Settings has an Updates panel with the version, status and "Check now".
- **Release workflow** (`.github/workflows/release.yml`) runs when `main` carries a version with no release yet (or on a `v*.*.*` tag); the release creates the tag. It runs on a Windows runner:
  1. Sets the version from the tag, then `npm ci`, type-check and tests.
  2. Builds the single-file game.
  3. Installs NSIS, packages the app (electron-builder `dir`, with the icon set by resedit) and builds the custom NSIS installer.
  4. Writes the `.sha256` and publishes the GitHub release.
  - CI (`.github/workflows/ci.yml`) runs on every push to `main`.
- **Tested here:** a packaged build against a fake release server, with the install step recorded instead of run.
  - Update available: downloaded with progress, verified, prompt shown; "Restart and update" quits the game and hands over to `installer /S /RELAUNCH`.
  - Checksum mismatch: the download is discarded, nothing is installed, and the game keeps running.
  - "Later": the pill shows "installs when you quit", and quitting hands over to `installer /S`.
  - The 1.1.0 installer builds with the new silent-update and relaunch code. Full suite: 52 tests passing.
- **Not tested here:** the Windows silent install and relaunch themselves, and the GitHub Actions run (it first runs
  when v1.1.0 reaches `main`).
- **Upgrade path:** v1.0.0 has no updater, so v1.1.0 is installed by hand once (over the old install, same folder).
  From then on updates are automatic.

## Update 16 Oct 2026 (8) — logo and Windows desktop app
- **Logo** (`branding/`, built by `branding/make_logo.py` and `branding/render_icons.py`):
  - The icon is a cage octagon with an italic "FC" monogram over a red-to-orange hand-wrap band, plus a horizontal
    "FIGHT CAMP / CAREER MODE" wordmark.
  - Lettering is outlined from the bundled Oswald and Inter fonts, so the SVGs need no font.
  - There is a simplified icon for 16–32 px.
  - Outputs: PNGs from 16 to 1024 px and a multi-size `icon.ico`.
  - The logo appears on the title screen, in the sidebar, as the favicon, on the app window, as the exe icon and as the installer icon.
- **Fonts are bundled** (`src/assets/fonts`, latin subset of Oswald and Inter, woff2). The game no longer loads Google Fonts, so it looks right offline.
- **Storage layer** (`src/game/storage.ts`):
  - Every save, setting, preset and fight checkpoint goes through it.
  - In the browser it uses localStorage, as before.
  - In the desktop app it calls the bridge `window.fightcampNative`.
- **Desktop app** (`desktop/`, Electron 33):
  - It runs the single-file build.
  - Saves are files under Documents/FightCamp, created on the first save. Writes are atomic (temp file, then rename).
  - File layout:
    - `saves/career-N.fcsave` — one per career slot;
    - `saves/backups/` — the previous save of each slot;
    - `saves/fights/` — mid-fight checkpoints and the last fight's replay;
    - `settings.json`, `look-presets.json`.
  - "Open saves folder" buttons are in Settings and Load Career, and the title screen shows the saves path.
  - Other behaviour: single instance, F11 for fullscreen, links open in the system browser.
- **Windows build:** `cd desktop && npm run dist:win`
  - electron-builder packages `win-unpacked` with editing turned off; `afterPack.cjs` sets the exe icon and version info with resedit, so no Wine is needed.
  - `make-installer.cjs` builds `FightCamp-Setup-<version>.exe` with NSIS: a per-user install with no admin rights,
    desktop and Start menu shortcuts, an uninstaller in Apps & features, and an option to launch after install.
  - Uninstalling never touches Documents/FightCamp.
  - The installer is about 78 MB.
  - The exe is not code-signed, so Windows SmartScreen asks for confirmation the first time ("More info" → "Run anyway").
- **Verified:**
  - The packaged Linux build of the same app, under Xvfb: the saves folder is created on the first save, the career
    and its backup are written as files, and after a restart the career shows under Continue and Load Career. No errors.
  - The Windows installer and exe are valid PE files, and the exe carries the icon (7 sizes) and version info.
  - The web version still saves to browser storage. Full suite: 15 files, 52 tests passing.
- **Not verified:** installing and running on Windows itself (no Windows machine here).

## Update 16 Oct 2026 (7) — superfight posters, your own fighter page
- **Poster fix (player-reported):** the heavyweight superfight poster showed light heavyweight.
  - The fight's division wasn't stored on the history entry, so it was inferred, and the inference matched any bout
    against the same opponent in the world's bout log (an earlier fight at another weight).
  - `fightDivision()` now uses, in order:
    1. the stored division;
    2. the title record from that day;
    3. the bout log entry for that same event or day;
    4. the opponent's division;
    5. the title held at the time.
  - Old title fights also get the champion side from the promotion's title history.
- **Superfight poster design:**
  - The split red/blue background now actually shows (a blend mode was multiplying it to black).
  - Champion chips name the division (e.g. "LHW CHAMPION" vs "HW CHAMPION").
  - The belts carry readable captions: "LIGHT HEAVYWEIGHT · HELD" and "HEAVYWEIGHT · AT STAKE".
  - The title line names the division at stake.
- **Your own fighter page:** clicking yourself opens the same page as for other fighters (Rankings rows, the World
  pound-for-pound list, champions list, records, news stories about you, Hall of Fame). It shows:
  - exact ratings (no scouting range), records and finishes;
  - belts held, title wins and defenses, champion status, streaks and bonuses;
  - recent form;
  - your fight log with posters;
  - links to the Fighter profile and Fight History.
- **Tests:** an old superfight entry with a misleading earlier bout in the log checks the poster's division, superfight
  design, home belt and both champion sides. The full suite passes: 15 files, 52 tests.
- **Browser:** clicking your own Rankings row opens your fighter page, with no errors.

## Update 16 Oct 2026 (6) — belt history fix for older careers
- Bug (player-reported, triple champion): the HFC middleweight belt showed 0 defenses instead of 4.
  - **Cause 1:** the v9 rebuild guessed the division of older fights as the player's current division (light heavyweight).
  - **Cause 2:** the admin button "Allow new offers now" rewrote the latest fight's date by up to 120 days. That put the
    middleweight title win before an earlier fight, so it no longer matched its title record.
- **Fixes:**
  - The admin button now waives the rest period without touching history (`restWaivedFor`).
  - `fightDivision()` infers the division of older fights. It tries the world bout log first, then the opponent's
    division, then the title held in that promotion at the time.
  - `repairHistoryDates()` restores dates that were moved out of order.
  - The rebuild uses the true fight order and infers how each belt ended:
    - superfight wins, and "kept the other belt";
    - leaving a promotion (e.g. "Left the IFC for the RFL");
    - a weight-class move;
    - retirement.
  - Live-recorded endings, drawn defenses and admin awards are kept.
  - Old posters also get the right division, champion side and superfight design.
- **Save v10** repairs the dates and rebuilds the reigns once.
- **Tests:** a full triple-champion career from an old save, rebuilt by the v10 migration. It checks:
  - the restored date;
  - 4 middleweight and 6 light heavyweight defenses;
  - the superfight reigns;
  - leaving IFC, RFL and CMS;
  - the posters.

  The full suite passes: 15 files, 51 tests.

## Update 16 Oct 2026 (5) — belt histories and fight posters
- **Reign records** (`game/reigns.ts`, save v9): each reign stores the fight that won it, every defense (plus drawn
  defenses, where the champion kept the belt) and how it ended. It ends either when the belt is lost in a fight (that fight
  is linked) or when it is vacated or stripped, with the date and one of these reasons:
  - moved division;
  - kept the other belt after a superfight;
  - left the promotion;
  - retired as champion;
  - stripped while out injured (idle more than 300 days with a long injury or suspension);
  - stripped for inactivity (idle more than 450 days);
  - belt reassigned with the admin tools.
- Older saves: reigns are rebuilt from titles and history. The division comes from the shared bout history, defenses are
  later title wins, and the first title loss ends the reign. Otherwise the reign is marked "Vacated (before reigns were
  recorded)", unless the belt is still held.
- **Trophy case:** click a belt to open its history. It lists every reign as a timeline: how the belt was won, each
  defense, then the loss (with opponent, method and round) or the vacate/strip reason. Every fight in it can open its poster.
- **Fight posters** (`game/poster.ts`, `ui/components/FightPoster.tsx`): generated from the booking. They show:
  - both fighters, drawn with the same art as the game, with their looks;
  - nicknames, names, records and flags, and a CHAMPION chip for the belt holder;
  - the promotion, event name and tagline;
  - the date, venue, division, weight in lbs and number of rounds;
  - the billing slot;
  - the undercard;
  - the title line and belt(s).
- Five poster designs, chosen by the importance of the bout:
  - **Local** (amateur, or a lower-tier undercard): newsprint with a halftone pattern and an admit-one ticket strip.
  - **Card bout:** stripes in the promotion colour.
  - **Headliner** (main/co-main event, rivalry or rematch at tier 2+): red and blue corner lights with chrome lettering.
  - **Title fight:** black and gold with a gold frame and the belt.
  - **Superfight:** split red and blue with a gold frame and both belts.
- Where the posters appear:
  - Upcoming fight: the Overview next-fight panel (thumbnail), the booked card in Fight Offers, Fight Prep, and the fight-night card screen.
  - Past fights: the Results screen, a Poster button on every Fight History row, a Poster wall (filters: all, professional, title), and every fight in a belt history.
- Past fights store a small poster snapshot (slot, records going in, champion side, rematch/rivalry, undercard). Older
  fights infer these from history. Posters use your current look; past looks are not stored.
- Dev gallery (not part of the build): `npx vite`, then open `/dev/poster.html` (`?w=600` for full size).
- Tests: `tests/reigns.test.ts`
  - Real title defenses won and then lost: the reign and the fight that lost it are recorded, and the poster snapshot is checked.
  - Every vacate and strip path.
  - The v8→v9 rebuild.
  - Posters for old entries.
  - Poster design selection.
  - Full suite: 15 files, 50 tests passing.
- Browser check: admin HFC champion → title defense booked → posters in Offers, Overview, Prep and the fight-night card →
  fight played with the keyboard → Results poster with the result stamp → trophy case belt history → its poster →
  Fight History poster wall. No console errors.

## Update 16 Oct 2026 (4) — superfight offers always proposed
- Fix (player-reported): reaching the required defenses showed "eligible" but only regular defenses were offered.
  Causes: the superfight was only considered after the random offer roll, the rest period and the two-open-offers cap;
  an injured or booked champion silently cancelled it; and showing it once blocked re-offers for two defenses.
- Now: whenever the champion is eligible and has no superfight offer open, one is created on the next day, regardless
  of rest, chance or other open offers, against the target division's champion (dated after his injury/booking).
  It stays open for 14 days; if it lapses or a regular defense is booked instead, it is offered again. Only an explicit
  decline or a lost superfight waits for two more defenses. Save v8 clears the old block on existing careers.
- Tests: `tests/superfight.test.ts` (always offered with an injured/booked champion, full offer list and no rest;
  re-offered after expiry; decline → +2 defenses; old saves get it immediately). Browser: admin HFC champion with 4
  defenses → superfight offer after one day.

## Update 16 Oct 2026 (3) — Fighter visual overhaul & appearance system
**Audit:** fighters were 11-joint skeletons (`combat/poses.ts`) drawn as thick round strokes with a circle head; the
appearance model had six palette indices; AI looks came from a hash of the id; no animation layer beyond keyframe lerps.
The skeleton and engine were kept; everything drawn on top of them was replaced.
- `combat/fighterArt.ts` — anatomy from joints: tapered muscle segments (deltoid, biceps/triceps, forearm, thigh, calf),
  sculpted 3/4 torso (pecs, abs, obliques, shoulder blade, collarbone), neck, head with jaw/ear/nose/eye/brow/mouth,
  open-finger gloves with wrist straps and seams, feet oriented by the shin, MMA shorts with waistband/trim/patterns.
  Cylindrical shading from one overhead light, far-side limbs darker, foot contact shadows. Hair, beards and moustaches
  are drawn in a head-local frame; tattoos are drawn in their body part's frame and clipped to it, so they cannot slide
  or float. Walkout clothing (tee, hoodie, jacket, robe) for portraits/walkouts. Portraits everywhere use the same art.
- `combat/animator.ts` — style stances (crouched grapplers, bouncing range strikers, tight pressure guards), breathing,
  weight shift, fatigue slump; exponential smoothing between poses (fast during strikes so visuals stay in sync with
  engine hit events); planted feet with stepping (no gliding) and shuffle steps when circling; lean into movement; hit
  reactions from the engine's own `hitFlash/hitTarget`; stun sway; hair sway. Reads the engine, never writes to it.
- Renderer: depth scale for the farther fighter, ground scenes orient the bottom fighter on his back, reach-to-height
  ratio drives on-screen arm length, larger/framed camera, cached backdrop, tiered crowd, lighting rig, apron, textured
  mat with a light pool, chain-link fence with padded posts/rail, adaptive "lite" quality on slow frames.
- `game/look.ts` — Look model: 16 hairstyles, 9 beards + 5 moustaches with independent colour, 12 original tattoo designs
  (incl. custom lettering) on 13 regions with size/rotation/position/ink (max 8), face (shape, jaw, brow, eyes, nose,
  cauliflower ear, skin), body (build, muscle, shoulders, torso shape, limb thickness), attire (shorts colour + 7 designs,
  accent/trim/waistband, gloves + strap, headband, walkout top + colour). AI looks generated deterministically from the
  fighter id (≈38 % tattooed, ≈58 % with facial hair, build follows weight class). Presets in localStorage.
- `ui/screens/AppearanceEditor.tsx` — categories, live animated preview (stance/jab/cross/kick/victory, turn, walkout
  top), undo/redo, per-category reset, randomise, presets save/load/delete. Used in the new-career wizard, the Fighter
  tab ("Customise look", shorts keep the $200 purchase rule), the Admin panel (free) and Quick Fight (preset per corner).
- Save v7: the player's look is created from the old six fields on load; old fields are kept.
- Dev gallery (not part of the build): run `npx vite` and open `/dev/art.html?m=poses` (or `ground`, `big`, `portrait`).
- Tests: `tests/look.test.ts` (determinism & variety, cosmetics never change attributes or fight outcomes, save
  round-trip & migration, sanitising, reset/presets). Browser checks listed in the stage report below.

**Limits of the 2D canvas approach:** fighters are side-on 3/4 views on a rotating camera, not 3D models: no true
rotation of the body, no cloth or hair physics, no per-pixel lighting or skin shaders. Ground scenes use authored poses,
and the bottom fighter's legs are drawn behind the top fighter. A WebGL/three.js skinned-mesh renderer would be the
next step up in realism but means new art assets and a large rewrite of rendering; not justified until the 2D look has
been play-tested.

## Update 16 Oct 2026 (2) — HFC superfights, double & triple champions
- `game/superfight.ts` holds the rules; offers, weigh-ins, title logic, rankings, event cards, announcer and commentary
  use the bout's own division (`offer.div`) so a champion can fight one division away without leaving his own.
- 4 consecutive defenses (current reign, `reignDefenses`) → HFC offers the division above (heavyweight: below), alongside
  a normal defense. Lose → back home, still champion. Win → both belts until the player chooses one (the other is vacated),
  permanent Double Champion status, +2 to a chosen attribute. Triple: keep the heavier belt, 6 straight defenses, next
  division up (+5). Origin rules: heavyweight → double only; light heavyweight → triple only by keeping LHW and going down
  to middleweight; anyone who moved up into LHW continues to heavyweight. HFC only. Declined/lost superfights are
  re-offered after 2 more defenses. Status shows in the top bar, Overview, announcer intros; achievements and legacy.
- Save v6 migration derives `reignDefenses` from fight history. Admin panel can set defenses, status and origin.
- Tests: `tests/superfight.test.ts` (rule table, offer timing, full win → belt choice → triple path, loss → home with
  belt, migration). Browser: admin-made HFC lightweight champion with 4 defenses → superfight offer → fight night → TKO
  win → double-champion belt choice → moved to welterweight with status shown; no console errors.

## Update 16 Oct 2026 — crash fix, HFC, championship belts
- **Fixed (player-reported):** after a fight, the hub crashed with *“Cannot read properties of null (reading 'opponentId')”*
  and the save kept crashing on load. Cause: a pre-fight event (media request / training-partner intel) could still be
  pending after the fight — e.g. when fight night was entered from the advance summary while the event was waiting — and
  its text read the now-empty booking. Fight-linked events now store their opponent and booking, are dropped when that
  booking ends, can no longer crash on auto-resolution, and **every save is repaired on load** (`pruneEvents` in
  `migrate`). The hub also offers to dismiss any event that can't be displayed instead of crashing.
  Regression tests: `tests/events_regression.test.ts`; browser check loads a save in the broken state without error.
- **Top promotion renamed** to the **Hexagon Fighting Championship (HFC)**. Internal id stays `acl`, so contracts,
  titles, rankings and achievements carry over; save v5 migration renames stored text (news, event names, history).
- **Championship belts:** an original SVG belt per promotion (IFC steel plate, RFL bronze shield, CMS globe medallion,
  GFC crowned octagon, HFC ruby hexagon), shown in Rankings, the Overview hero, a new Trophy case (Fighter tab),
  fight-night walkouts / announcer / faceoff for title fights, results after winning or defending, and World reigns.



Legend: ✅ already implemented & verified · 🟡 exists, needs improvement · ❌ missing · 🧪 implemented, not yet verified · ⏭ deferred to a later stage

### Reusable foundations found in the code
- `combat/engine.ts` emits a typed `FightEvent` stream (hits, knockdowns, takedowns, subs, bells) and is fully deterministic from `seed` + intents; `AIController` uses its own seeded RNG. → commentary, highlights and **true replays** can be built on it without touching combat rules.
- `game/world.ts` `bout()` is the single place AI-vs-AI results are applied (records, points, champions, injuries) → becomes the shared result path.
- `game/fights.ts` `applyFightResult()` is the single, exactly-once path for the player's result.
- `inbox()` / `news()` exist but news is limited to the player's division and stored in the personal inbox.
- Save system: compressed localStorage slots, `migrate()` with version numbers, validation, backups.

### Gaps / risks
- No persistent bout history: world results only mutate counters, so event results, records, P4P and profiles have no source data. **Fix first.**
- Retired fighters are deleted after 400 days → conflicts with Hall of Fame / records. Keep notable retirees.
- Fight log is discarded after each fight → no highlights / timeline.
- Save growth: any new history must be capped; compression measured at ~6×.
- Mid-fight saving through `store.act` would clone + compress ~300 KB every few seconds → use a separate lightweight checkpoint key.

### Item status (52 roadmap items)
| # | Item | Before | Plan | Now (end of this session) |
|---|---|---|---|---|
| 1 | Fight-night presentation | ❌ (prep screen only) | Stage A | 🧪→✅ FightNight screen (card, walkouts, announcer, referee, faceoff; full/short/off; skippable) — browser-verified |
| 2 | Full event cards | ❌ (player bout isolated) | Stage A | ✅ cards built from real rosters, undercard resolved via world `bout()` before/after the player bout — unit + browser tested |
| 3 | Contextual commentary | ❌ (event log only) | Stage A | ✅ event-driven commentary ticker (priorities, cooldowns, no-repeat, outcome-consistent closing) — unit + browser tested |
| 4 | Post-fight interviews | ❌ | Stage A | ✅ 4–6 contextual answers; effects on popularity/reputation/rivalry/promoter/sponsors/matchmaking/title push — unit + browser tested |
| 5/38 | Highlights, timeline, replay | ❌ | Stage A (deterministic replay) | ✅ key-moment timeline, momentum trends, deterministic replay viewer (re-simulated, slow-mo) — determinism unit-tested, viewer browser-checked |
| 6 | Gym ownership | 🟡 gyms/coaches exist | ⏭ Stage B | ⏭ unchanged this session |
| 7 | Multi-division careers | 🟡 change division exists | ⏭ Stage B | ⏭ unchanged this session |
| 8 | Tournaments | ❌ | ⏭ Stage B | ⏭ unchanged this session |
| 9 | Short-notice fights | ✅ event `shortnotice` | ⏭ improve in B | ⏭ unchanged this session |
| 10 | Career-defining decisions | 🟡 events/offers | ⏭ Stage B | ⏭ unchanged this session |
| 11 | Agents | ❌ | ⏭ Stage B | ⏭ unchanged this session |
| 12 | Medical history | 🟡 injuries, suspensions | ⏭ Stage B | ⏭ unchanged this session |
| 13 | Training specialisation | ❌ | ⏭ Stage B | ⏭ unchanged this session |
| 14 | Career challenges | ❌ (admin panel can approximate) | ⏭ Stage D/E | ⏭ unchanged this session |
| 15 | Hall of Fame / legacy | 🟡 legacy rating at retirement | Stage C (world hall + records) | ✅ notable retirees kept; Hall of Fame with legacy breakdown — unit + browser tested |
| 16 | Post-retirement careers | ❌ | ⏭ Stage B | ⏭ unchanged this session |
| 17 | World news feed | 🟡 player-division only | Stage C | ✅ world news feed with promotion/type/division/headline filters, click-through to profiles — browser-tested |
| 18 | Promotion identities | 🟡 tiers/purses differ | ⏭ Stage C2 | ⏭ unchanged this session |
| 19 | Dynamic matchmaking | 🟡 points proximity | ⏭ Stage C2 | ⏭ unchanged this session |
| 20 | Personalities | ❌ | ⏭ Stage C2 | ⏭ unchanged this session |
| 21 | Prospect life cycles | 🟡 development/aging exist, invisible | Stage C (career log per fighter) | 🟡 per-fighter career log, debut, peak, streaks visible in profiles; no new prospect mechanics |
| 22 | Pound-for-pound | ❌ | Stage C | ✅ P4P top 15 with “why” explanation — unit + browser tested |
| 23/25 | Cross-promotion, markets | 🟡 promotions up a tier, releases | ⏭ Stage C2 | ⏭ unchanged this session |
| 24 | Historical records | ❌ | Stage C | ✅ records book (9 records) + current reigns — unit tested (consistency vs data) |
| 26 | Multi-stage rivalries | 🟡 rivalry heat | ⏭ Stage C2 | ⏭ unchanged this session |
| 27 | Advance-time summaries | 🟡 player-focused summary | Stage C (world highlights in summary) | ✅ “Around the world” highlights in the advance summary |
| 28 | Fighter profiles | 🟡 modal | Stage C (history, titles, timeline) | ✅ profile shows career log, titles, defenses, streaks, reign, legacy breakdown |
| 29/30 | Appearance / creator | 🟡 | ⏭ Stage D | ⏭ unchanged this session |
| 31 | Custom orgs/divisions | ❌ | ⏭ Stage D | ⏭ unchanged this session |
| 32 | Admin improvements | 🟡 player editor | Stage A/C (world tools) | ✅ world tools (search/filter, injure/heal, clear booking, rival, prefer opponent, make champion, retire, fast-forward, test title fight); confirmations; career marked “Modified” — browser-tested |
| 33 | Career timeline | ❌ | Stage C | ✅ career timeline with filters in Fight History — browser-tested |
| 34 | Statistics screens | 🟡 results screen | Stage A (round-by-round, trends) | ✅ round-by-round table, momentum chart, full event results on the results screen |
| 35 | Walkout customisation | ❌ | Stage A | ✅ track (4 originals, silence, or own upload in IndexedDB), lighting colour, entrance style, preview — browser-tested (upload) |
| 36 | Audio & atmosphere | 🟡 synth SFX | Stage A (walkout music, announcer) | 🟡 original synthesized walkout music, crowd swell, optional browser speech announcer; no recorded audio |
| 37 | Arena by event type | ❌ | Stage A | ✅ crowd density, lighting, mat branding and rail colour by event kind; gold for title fights (presentation only) |
| 39/40 | Save management, storage | 🟡 slots, compression | ⏭ Stage E (+ duplicate slot) | ⏭ unchanged this session |
| 41 | Mid-fight persistence | 🟡 round-break checkpoints | Stage A (periodic exact checkpoints) | ✅ exact checkpoints every ~5 s + round breaks in a separate key (fight + AI + recording); resume verified in browser and unit test |
| 42 | Sim speed controls | 🟡 day/week | Stage C (month, until next event) | ✅ “Month” / “To fight” advance buttons (still stop for important news) |
| 43/44 | Regression tests, analytics | 🟡 | each stage | 🟡 +12 tests (replay determinism, checkpoint resume, event cards, interviews, announcer); no analytics |
| 45 | Accessibility | 🟡 rebinding, reduced motion | ⏭ Stage E | 🟡 + UI scale setting (90–120 %); rest deferred |
| 46/47 | Modding, sandbox | ❌ | ⏭ Stage E | ⏭ unchanged this session |
| 48 | Onboarding | 🟡 | ⏭ Stage E | ⏭ unchanged this session |
| 49 | Performance | 🟡 | measure each stage | 🟡 measured: checkpoint ≈4 KB, replay ≈11 KB compressed, 90-day fast-forward ≈0.5 s |
| 50 | Shared data path | 🟡 | Stage A/C: one `recordBout()` for every result | ✅ every result (AI, card, player) goes through `recordBout()` |

### This session's stages
**Stage A — Fight Night:** event cards resolved by the real world sim, skippable walkout/announcer/faceoff sequence, original walkout music + optional user track, arena styling by event type, commentary, interviews, timeline/highlights with deterministic replay, periodic mid-fight checkpoints.
**Stage C (core) — Living World:** shared bout history & `recordBout()`, world news feed, records book, Hall of Fame (retirees kept), P4P, per-fighter career logs & profiles, player career timeline, advance-month / until-next-event, world highlights in summaries, admin world tools.
Stages B, C2, D and E remain planned (see table).

### Stage report — Stage A (Fight Night) + Stage C core (Living World)
**Not done:** Stages B, C2, D, E (items marked ⏭). The roadmap as a whole is **not** complete.

**Reused systems:** combat engine & event stream (unchanged mechanics; only a passive `tick` counter was added), AI (only
serialization helpers added), world `bout()`/`recordBout()`, `applyFightResult()`, matchmaking & title-offer logic, sponsor
offers, rivalries, inbox, save compression/migration, renderer (presentation theme only), audio engine, admin panel.

**New files:** `game/eventcard.ts`, `game/announcer.ts`, `game/commentary.ts`, `game/interview.ts`, `game/fightrec.ts`,
`game/presentation.ts`, `game/media.ts`, `game/history.ts`, `data/nations.ts`, `ui/screens/FightNight.tsx`,
`ui/screens/ResultsExtras.tsx`, `ui/screens/tabs/{WorldTab,WalkoutPanel,AdminWorld}.tsx`, `tests/{history,replay,fightnight}.test.ts`.
**Modified:** `combat/engine.ts` (tick counter), `combat/ai.ts` (serialize/restore), `combat/renderer.ts` (ArenaTheme),
`game/{types,core,save,store,world,fights,economy,career,achievements,audio}.ts`, `ui/App.tsx`, `ui/theme.css`,
`ui/components/common.tsx`, `ui/screens/{FightPrep,FightScreen,Results,Settings,Hub,LoadGame}.tsx`,
`ui/screens/tabs/{FighterTab,RankingsTab,HistoryTab,AdminTab}.tsx`.

**Tests executed (this session):** `npx tsc -b` clean; `npm test` → **11 test files, 31 tests passing** (see list below).
Browser runs (Playwright + Chromium against the production build): fight-night sequence card → walkouts → announcer →
faceoff → fight with commentary; mid-round reload → exact resume prompt → resumed at the checkpoint tick; full 3-round fight
→ results with announcement, interview, round table, momentum chart, highlights and replay viewer; walkout upload; admin
fast-forward ×3, test title fight; World tab (news, fighter modal, P4P “why”, records, Hall of Fame); career timeline;
120 % UI scale; “Modified” tag on the load screen. No page errors or console errors were recorded.

**Bugs found & fixed during the stage:** news feed displayed oldest-first (store is newest-first); tier-1 cards with an AI
title bout were styled as “major arena”; announcer phrasing for co-main/prelim bouts; highlight labels ambiguous about who
did what; label collision between shorts colour and walkout colour buttons.

**Known limitations:** announcer voice depends on the browser's speech synthesis (off by default); walkout music is short
synthesized loops; uploaded walkout tracks are stored per browser (not exported with saves); replays exist only for the most
recent career fight (kept in a separate, expendable storage key that is dropped first if storage fills); highlights inside a
round replay from that round's start; commentary is text only; world P4P/records only cover history since v4 tracking began
(older careers start empty except the backfilled player timeline).

**Save migration:** v3 → v4 is automatic and tested (history, news, records, hall, timeline backfill). New optional fields
(`walkout`, `adminUsed`, card/results extras, settings) need no migration. Checkpoints/replays live in
`fightcamp.fight.{slot}` / `fightcamp.replay.{slot}` and are deleted with the slot.


---

## v1 checklist (original build)

**Current phase:** 6 — testing & balancing (Phases 1–5 implemented).

## Completed

### Phase 1 — Foundation & vertical slice
- [x] React + TypeScript + Vite app shell, title screen, navigation, error boundary
- [x] New-career wizard: identity, appearance (skin, hair, facial hair, shorts, gloves, extras), physique & reach,
      walking weight & division eligibility, 7 backgrounds, 3 starting levels, 4 difficulties, career goals, save slot
- [x] 43 attributes (physical/striking/grappling/mental), each consumed by the engine or career systems (tooltips document where)
- [x] Derived category ratings and overall rating
- [x] Persistent saves: 3 slots, autosave, manual save, schema versioning + migration, validation,
      automatic backup, export/import, confirm before overwrite/delete, corrupt saves never silently erased
- [x] Career hub with condition, money, ranking, next action, objectives, news feed
- [x] Playable arena with movement, strikes, defense, stamina, damage, AI, timer, rounds, results, record updates

### Phase 2 — Complete combat
- [x] 11 standing strikes with startup/active/recovery, range, stamina, accuracy, damage, knockdown power, guard piercing
- [x] Power modifier, combinations (faster follow-ups), counters (strikes into recovery/whiffs), interrupting strikes
- [x] High guard / body guard & kick checks, slips with counter window, distance & lateral-movement effects
- [x] Head / body / legs damage pools with distinct consequences (stuns & KOs / gas tank / movement & kicks)
- [x] Stuns, knockdowns, flash KOs, TKOs (accumulation, repeated knockdowns, body shots, leg kicks, ground strikes)
- [x] Stamina vs. deep fatigue; adrenaline dump in round 1; exhaustion turns strikes into slow arm punches
- [x] Clinch (entry contest, control, cage pushing, underhook battles, knees/elbows/dirty boxing, trips, breaks)
- [x] Takedowns with telegraphed shot, timed sprawls, failed-shot vulnerability (knees, guillotines)
- [x] Ground: full guard, half guard, side control, mount, back control (top/bottom for each), GnP, advances,
      escapes, sweeps, get-ups/wall-walks, stand-ups, defend/posture, referee stand-ups and stoppages
- [x] Submissions (rear-naked choke, armbar, triangle, guillotine) as a timed lock-vs-escape contest
- [x] 3- and 5-round fights, round breaks with corner advice & plan changes, 10-point-must judging (3 judges with different
      striking/grappling weighting), UD/SD/MD/draw, scorecards
- [x] Opponent AI: 10 style profiles, reactions only to visible startups, punishing whiffs, sprawling, adaptation to the
      player's habits that persists into rematches, round-by-round urgency, difficulty-scaled reactions/mistakes
- [x] Tactical pause, pause menu, pause on window blur, round-break checkpoints with refresh-resume

### Phase 3 — Career systems
- [x] Weekly planner (2 slots × 7 days), 33 sessions in 6 categories, presets, fatigue/injury projection, training log
- [x] Gains depend on gym facilities, coaches, fatigue, consistency, discipline, talent, age, difficulty, diminishing returns
- [x] Fatigue, sharpness, career wear; 8 injury types with severity, blocked sessions, aggravation risk, treatment, rehab
- [x] 6 gyms with distinct facilities; hireable coaches; lifestyle (housing, nutrition, physio, home gym)
- [x] Weight management: diet modes, set-point drift, fight-week cut %, missed weight fines, fight-night penalties
- [x] Fight offers (opponent, event, date, notice, rounds, purse, bonuses, difficulty, ranking implications), camp focus,
      opponent preparation, scouting precision, withdrawals with consequences
- [x] Contracts with negotiation (leverage, counters, patience), buyouts, renewals, releases after losing streaks
- [x] Finances: ledger, monthly bills, category breakdown, cash-flow chart, debt stress (no bankruptcy)

### Phase 4 — World simulation
- [x] 5 promotions × 8 divisions with real rosters (~470 fighters), event schedules, quick-resolved AI bouts
- [x] Rankings by points (opponent quality, finishes, titles, inactivity decay), champions who defend, vacant titles
- [x] Fighter development, aging/decline, injuries, retirements, prospects, promotion between leagues
- [x] Title shots, interim/vacant title opportunities, rivalries & rematches, sponsors, popularity vs reputation
- [x] 15 data-driven random events with real state effects (call-outs, short-notice fights, intel, gym disputes, etc.)
- [x] Aging, wear, retirement choice, legacy rating & retirement screen; 18 achievements; 6 goal trackers

### Phase 5 — Presentation
- [x] Original dark "fight-night broadcast" design system; responsive hub (collapses below 900 px)
- [x] Canvas arena: rotating octagon camera, crowd, articulated fighters reflecting appearance & body type,
      keyframed strike/defense/grappling poses, impact particles, popups, screen shake (respects reduced motion)
- [x] HUD: stamina, damage silhouettes, clock, position, momentum, range bar, attack tells, submission meter
- [x] Synthesized Web Audio SFX + crowd (master/effects/crowd volume, mute), silent fallback
- [x] Coach tour (6 steps) + 10-lesson Practice Arena; contextual control hints; replayable from Settings
- [x] Quick Fight mode; key rebinding; mouse support (jab/cross clicks, clickable action chips)

## Test results (latest run)
`npm test` → **11 test files, 31 tests passing** (Roadmap v2 session; v1 build had 7 files / 20 tests)
- Combat rules: movement, out-of-range misses, guard mitigation (not invulnerable), fatigue penalties, round timing,
  finished fights immutable, KO/SUB/decision reachable by both corners, save validation.
- Balance (AI vs AI on the real engine, 270 fights): ~37% KO/TKO, ~22% SUB, ~35% decisions; every style 35–63% win rate;
  rating gap +3 → ~65%, +6 → ~80%, +10 → ~87% (upsets remain possible).
- Player decisions matter: same fighter, button-mashing wins 6%; managing range & stamina wins 31% (scripted bot).
- Judging: ~4% of rounds are 10-8.
- Career: creation, backgrounds, training effects, offer → fight → result applied **exactly once**, continuation.
- Long career (6 in-game years): titles won, promotions and releases, ~5 fights/year, state stays valid (~390 KB save).
- Progression: basic gym, no coaches: OVR 38 → 47 → 52 → 57 → 60 over 4 years (better camps go faster).
- Browser (Playwright/Chromium at 1280×720 and 1920×1080): title → wizard → hub tabs → training → offers → accept →
  advance → weigh-in → prep → full keyboard-controlled fight → results → history; grappling & submission; tactical pause
  and pause freezing the sim; refresh at a round break → resume prompt → continue to next round; zero runtime errors.
- v2 (this session): shared history & v3→v4 migration, 3-year world consistency (logs vs history, records vs data,
  champions vs title history, hall fighters persist), save size budget; replay determinism (3 seeds, every event on the
  same tick), highlight re-simulation, mid-fight checkpoint resume gives an identical result; event cards booked without
  duplicates and resolved exactly once through the world sim; withdrawals release card fighters; interviews apply once and
  feed sponsors/matchmaking; announcer lines match scorecards; commentary closing line matches the winner.

## Known limitations
- Fighters are stylised 2D figures; ground scenes use authored poses rather than full physics.
- If the browser is closed mid-round, the fight resumes from the last checkpoint (≤ ~5 s of fight time earlier).
- Saves are per-browser localStorage (export/import provided). Google Fonts falls back to system fonts offline.
- Inbox notifications cover the player's division; every division's notable results appear in the World news feed.
- Balance has been tuned with scripted bots and AI-vs-AI simulation, not yet with broad human playtesting.

## Next priorities
1. Human playtesting of fight feel and difficulty curve (especially Normal vs Hard), then retune AI reactions.
2. More strike/defense animation frames and hit reactions; distinct submission animations.
3. Feints, switch stance, and clinch-against-the-cage positions as separate states.
4. Commentary lines and walkout presentation; more authored events.
5. IndexedDB storage for larger worlds / more slots.
