# Fight Camp: MMA Career Simulator

A single-player MMA career game that runs in a desktop browser. Create a fighter, train, manage
fatigue, injuries, weight and money, take fights, and **control every fight in real time** —
striking, defense, clinch, takedowns, ground positions and submissions — from amateur bouts to
a Hexagon Fighting Championship (HFC) title.

All promotions, fighters, gyms and sponsors are fictional.

**New in v2 (Roadmap stages A + C core):** full fight nights — event cards whose other bouts are decided by the
world simulation, walkouts with original music (or your own track), announcer introductions, referee and faceoff,
venue styling by event size, live commentary, post-fight interviews, round-by-round stats, highlights with true
replays, and exact mid-fight resume. A **World** tab with a league-wide news feed, pound-for-pound list, records book,
current reigns and Hall of Fame; fighter profiles with career logs; a career timeline; month/“to fight” time
controls; and admin world tools for testing (careers changed by admin tools are marked “Modified”).

## Windows game and automatic updates

Download `FightCamp-Setup-<version>.exe` from the [latest release](https://github.com/Drust26/Fight-Camp/releases/latest)
and run it (no administrator rights needed; Windows may ask you to confirm the first time because the installer is
not code-signed: "More info" → "Run anyway"). Careers are saved in `Documents\FightCamp\saves`.

The installed game checks this repository's latest release every time it starts. A newer version downloads in the
background, is checked against its published SHA-256, and "Restart and update" closes the game, installs the update
silently and reopens it ("Later" installs it when you quit). Updates never touch the saves folder.

### Publishing an update

1. Add a section for the new version at the top of `CHANGELOG.md` (it becomes the release text and the in-game
   update notes).
2. Set the same version in `desktop/package.json`.
3. Commit, then tag and push: `git tag v1.2.0 && git push origin main v1.2.0`.

The **Release** workflow (`.github/workflows/release.yml`) then type-checks and tests the game, builds the Windows
installer on a Windows runner and publishes the release with the installer and its `.sha256`. Installed games pick it
up on their next launch. Every push to `main` also runs the **CI** workflow (type-check, tests, builds).

To build the installer yourself: `SINGLE=1 npx vite build --outDir dist-single`, then `cd desktop && npm ci && npm run dist:win`.

## Play it

**Option A — no install (recommended for players):** open `dist-single/index.html` (a single
self-contained file) in Chrome, Edge or Firefox. Saves live in that browser's local storage.

**Option B — from source:**

```bash
npm install          # Node 18+ (tested on Node 22)
npm run dev          # http://localhost:5173
```

Production build:

```bash
npm run build        # type-checks, then builds to dist/
npm run preview      # serves dist/ at http://localhost:4173
SINGLE=1 npx vite build --outDir dist-single   # one self-contained HTML file
```

Tests (combat rules, balance, career loop, long-career simulation, progression, judging):

```bash
npm test
```

## Controls (rebindable in Settings)

| Action | Key | | Action | Key |
|---|---|---|---|---|
| Move toward / away | W / S | | Jab / Cross | J / K (or left / right mouse) |
| Circle left / right | A / D | | Lead hook / Uppercut / Body hook | L / U / I |
| High guard (hold) | Q | | Low kick / Body kick / Head kick | N / M / H |
| Body guard & kick check (hold) | C | | Front kick / Knee / Elbow | B / Y / O |
| Slip / step (with direction) | Space | | Clinch / break / stand up | E |
| Power shot / burst footwork | Shift | | Takedown / **sprawl** (during their shot) | R |
| Submission | G | | Advance position / escape / pounce | F |
| Tactical pause | Tab | | Pause menu | Esc |

Contextual controls are always listed under the arena and are clickable. The warning above the
opponent shows what's coming (HEAD / BODY / LEGS / SHOT) — earlier with higher Fight IQ.

## How it fits together

```
src/
  combat/   engine.ts (pure real-time simulation), ai.ts (opponent AI), moves.ts, poses.ts, renderer.ts (canvas)
  game/     types.ts, attributes.ts, career.ts (creation + time), training.ts, fights.ts (offers, weigh-ins,
            results), economy.ts (contracts, negotiation, sponsors, gyms), world.ts (rosters, rankings,
            champions, world sim), history.ts (shared bout history, news, records, Hall of Fame, P4P),
            eventcard.ts, announcer.ts, commentary.ts, interview.ts, fightrec.ts (replays + checkpoints),
            presentation.ts, media.ts (uploaded walkout track), events.ts, achievements.ts, save.ts, store.ts, audio.ts
  data/     world.ts (divisions, promotions, styles, backgrounds), training.ts (sessions, gyms, injuries, sponsors)
  ui/       App shell, screens (title, wizard, hub tabs, fight prep, fight, results, retirement), theme.css
tests/      vitest suites, including AI-vs-AI balance runs on the real engine
```

The combat engine has no DOM dependencies; both corners are driven by the same `Intent` interface
(keyboard for the player, `AIController` for opponents), so the rules are identical for both and can be
tested headlessly. The career `GameState` is the single source of truth; every screen reads it and
mutates it only through `store.act()`, which clones, applies, and autosaves.

See `DEVELOPMENT.md` for the feature checklist, test results and known limitations.
