---
title: Mean Streets — Production Polish PRD
updated: 2026-04-18
status: archived
domain: product
---

> **ARCHIVED**: This PRQ described the v0.2 backpack/runner model which
> was thrown away in the v0.2 stack redesign. Its instructions are
> actively misleading; see `v0.3-impl.prq.md` instead.

# Mean Streets: Production Polish

**Created**: 2026-04-14
**Timeframe**: Multi-sprint autonomous execution
**Repo**: arcade-cabinet/mean-streets
**Branch**: feat/character-card-system

## Overview

This PRD enumerates every system named in `docs/PRODUCTION.md` that currently
blocks a store-ready launch. It is the single batchable work queue for
getting Mean Streets from "CI green" to "submittable to Google Play + App
Store + playable cross-device." The doc pillars in `docs/{DESIGN,RULES,
ARCHITECTURE,PRODUCTION,VISUAL_REVIEW}.md` are the authority; this plan
references them rather than duplicating.

## Execution Model

- `stop_on_failure: false` — one failing epic should not block the
  others; balance and UI can progress in parallel with mobile
  packaging.
- `auto_commit: true` — every task commits on success with a
  conventional-commit message.
- Tasks are grouped into **epics**. Each epic owns a coherent slice
  with its own internal dependencies. Tasks within an epic run
  sequentially; epics run in the order listed below but a later epic
  can start on any platform resource that an earlier one is not
  actively holding.
- Epic completion = all child tasks `completed` + verification
  commands green + conventional-commit landed.

## Epic Index

| Epic | Title                                                  | Blocks launch? |
|------|--------------------------------------------------------|----------------|
| A    | Card authoring pipeline (raw/compiled/tuning history)  | Yes            |
| B    | Autobalance loop + full lock coverage                  | Yes            |
| C    | Backpack/runner rules refactor (engine + UI)           | Yes            |
| D    | Ability resolution in combat                           | Yes            |
| E    | Runner opening contract in AI                          | Yes            |
| F    | Visual finish to POC parity                            | Yes            |
| G    | Responsive + accessibility finish                      | Yes            |
| H    | Persistence (profile, unlock, continue)                | Yes            |
| I    | Mobile packaging (Capacitor + store metadata + Maestro)| Yes            |
| J    | Creative enrichment pass (names / lore / unlocks)      | Yes            |
| K    | Release governance / launch dry run                    | Yes            |

---

## Epic A — Card authoring pipeline

Goal: every authored card lives as a single JSON file with a tuning-history
stat array. Runtime reads a compiled flat catalog produced at build time.
Autobalance can append a new stat value and single-file-commit it.

### A1. Create `config/raw/cards/special.json` for backpack + cash rules

**Priority**: P0
**Dependencies**: none (scripts already emitted toughs/weapons/drugs)
**Files**: `config/raw/cards/special.json`

Define the two non-unique card types:

```json
{
  "backpack": {
    "slots": 4,
    "deployableTo": "reserve",
    "runnerStat": { ... },
    "transferRule": "reserve-only-during-buildup"
  },
  "cash": {
    "denominations": [
      { "id": "cash-100", "value": 100 },
      { "id": "cash-1000", "value": 1000 }
    ]
  }
}
```

**Verification**: File exists. `pnpm exec tsc --noEmit` passes. Zod parse
of `CardSpecialSchema` returns without error.

### A2. Zod schemas for tuning-history card shape

**Priority**: P0
**Dependencies**: A1
**Files**: `src/sim/cards/schemas.ts`

Add `AuthoredCrewSchema`, `AuthoredWeaponSchema`, `AuthoredDrugSchema`
where stat fields are `z.array(z.number().int().positive()).min(1)`.
Export `latestStat(arr)` helper. Keep existing runtime schemas (flat
scalar stats) as the "compiled" view; add explicit converter `toCompiled`.

**Verification**: `pnpm exec tsc --noEmit` passes. New unit test
`src/sim/cards/__tests__/schemas.test.ts` parses every file in
`config/raw/cards/{toughs,weapons,drugs}/` successfully.

### A3. Build-time compilation `raw/ → compiled/`

**Priority**: P0
**Dependencies**: A2
**Files**: `scripts/compile-cards.mjs`, `vite.config.ts`, `package.json`
(postinstall + prebuild hooks), `.gitignore` (already ignores compiled)

Script uses `fs.readdirSync` (not `import.meta.glob` — this runs in Node,
not Vite) to walk `config/raw/cards/**/*.json`, validate each with Zod,
reduce every stat array to its last element, and write:

- `config/compiled/toughs.json`
- `config/compiled/weapons.json`
- `config/compiled/drugs.json`
- `config/compiled/special.json`

Wire into `"postinstall"` and `"prebuild"` in package.json. Add a
small Vite plugin so dev-mode edits to raw files trigger a
recompile + HMR without restart.

**Verification**: `pnpm install` emits `config/compiled/*.json`.
`pnpm run build` re-emits them. `config/compiled/` is in `.gitignore`.

### A4. Runtime loaders read from compiled files

**Priority**: P0
**Dependencies**: A3
**Files**:
- `src/sim/cards/catalog.ts` (load toughs)
- `src/sim/turf/catalog.ts` (wrap all four types into `TurfCardPools`)
- `src/sim/turf/generators.ts` (delete procedural weapon/drug generators,
  replace with `loadCompiledWeapons()` / `loadCompiledDrugs()`; keep cash
  generator — cash is not authored)

Delete `src/data/cards.json` (authored data moved to `config/raw/`).
Delete `src/data/pools/weapon-categories.json` and
`drug-categories.json` (category metadata is only needed at authoring
time now — fold it into the compiled record if needed). Keep
`affiliations.json`, `archetypes.json`, `names.json` (used at
authoring time only — now dev-time only, not runtime).

**Verification**: `pnpm run test:node` green. `pnpm run build` green.
Grep confirms no runtime code imports `src/data/cards.json` or
`src/data/pools/`.

### A5. Drop dev-time scripts into the npm namespace

**Priority**: P1
**Dependencies**: A3
**Files**: `package.json`

Add:
- `"cards:compile": "node scripts/compile-cards.mjs"`
- `"cards:validate": "tsx scripts/validate-raw-cards.ts"` — new, runs
  Zod parse on every raw file, prints offenders.

**Verification**: `pnpm run cards:compile` succeeds. `pnpm run
cards:validate` succeeds. Fails loudly when a raw file is malformed
(test by hand-corrupting one file; then revert).

---

## Epic B — Autobalance loop + full lock coverage

Goal: every card in the catalog reaches `locked` state. The autobalance
tool appends tuning values to raw stat arrays, single-file-commits each
improvement, and re-runs until the release gate passes at 100 %.

### B1. Autobalance writes into raw/ stat arrays

**Priority**: P0
**Dependencies**: A4
**Files**: `src/sim/analysis/autobalance.ts`, `src/sim/analysis/cli.ts`

Replace the prior override-file approach (now deleted). For every
unstable non-locked card, `readFileSync` the raw file, append one value
to its stat array (nerf −1 / buff +1 in the closest-to-stable
direction), `writeFileSync` it, and rerun the compile step. Cards
marked `locked: true` are never edited.

**Verification**: dry-run on smoke profile mutates only in-memory
(nothing on disk). Live run on smoke profile produces git-visible
single-file diffs under `config/raw/cards/`. `pnpm run cards:compile`
then picks up the new values and runtime tests still pass.

### B2. Autobalance commits after each iteration

**Priority**: P0
**Dependencies**: B1
**Files**: `src/sim/analysis/autobalance.ts`

After each iteration that produced edits, shell out to `git add
config/raw/cards/ && git commit -m "chore(balance): iter N tuned X
cards"` with the card IDs + deltas summarised in the commit body. If
there were no edits (all cards stable), no commit.

Honour a `--no-commit` flag so CI can run it in read-only mode.

**Verification**: after `pnpm run analysis:autobalance --iterations 2`,
`git log --oneline -5` shows one commit per iteration that produced
edits. Dirty-tree guard refuses to start if there are uncommitted
changes.

### B3. Drive coverage from 75 % → 100 %

**Priority**: P0
**Dependencies**: B2
**Files**: `sim/reports/turf/balance-history.json` (tracked),
`src/data/ai/turf-sim.json`

Run the autobalance loop repeatedly on the CI profile until every card
is `locked`. Raise `LOCK_COVERAGE_MIN` in
`src/sim/turf/__tests__/release-gate.test.ts` stepwise:
0.70 → 0.80 → 0.90 → 1.00 as each plateau is reached. Each tightening
is its own commit.

**Verification**: `RELEASE_GATING=1 pnpm run test:release` green with
threshold at 1.00. `sim/reports/turf/balance-history.json` shows
`locked: true` for all 200 cards.

### B4. Autobalance CI job (weekly cron)

**Priority**: P2
**Dependencies**: B3
**Files**: `.github/workflows/autobalance.yml`

GitHub Actions workflow on `schedule: cron '0 4 * * 1'`. Checks out
`main`, runs `pnpm run analysis:autobalance --iterations 5`, and
opens a PR with the resulting raw-card diffs. Non-blocking —
informational drift detection only.

**Verification**: `gh workflow run autobalance.yml` produces an actions
run that either no-ops (catalog stable) or opens a PR tagged
`balance-drift`.

---

## Epic C — Backpack/runner rules refactor

Goal: the runtime matches `docs/RULES.md §6–7`. Backpacks are mechanical
containers player-packed in deckbuilding, not authored kits. Runners are
an overlay role on toughs. Slot model matches `RULES.md §2`.

### C1. Rename slot fields to pocket vs backpack-gated

**Priority**: P0
**Dependencies**: A4
**Files**: `src/sim/turf/types.ts`, every board/attack/ai file that
reads the old names.

Rename:
- `drugTop` / `drugBottom` → `backpackTopLeft` / `backpackBottomLeft`
- `weaponTop` / `weaponBottom` → `backpackTopRight` / `backpackBottomRight`
- `cashLeft` / `cashRight` → `pocketLeft` / `pocketRight`

Slot type is now a union — any quarter-card type can occupy any slot.
Keep affinity heuristics in the scorer (weapons *prefer* offense
corners, drugs prefer defense, cash prefers pockets).

**Verification**: grep for old names returns zero matches. `tsc
--noEmit` green. All existing tests still pass (sim engine maths
identical; only names changed).

### C2. Engine: backpacks as player-packed containers

**Priority**: P0
**Dependencies**: C1
**Files**: `src/sim/turf/types.ts`, `src/sim/turf/deck-builder.ts`,
`src/sim/turf/environment.ts`, `src/sim/turf/generators.ts`

Delete the 30-pre-built backpack generator. Add a new deck shape:
`{ toughs: [...], backpacks: [{ slots: [card, card, card, card] }, ...] }`
where each backpack's 4 slots are chosen at deckbuild time from the
player's picked quarter-card pool.

Total deck = 25 toughs + N backpacks + ≤25 quarter-cards distributed
across the backpacks. N is TBD (simulation-determined — see C5).

**Verification**: updated backpack tests in
`src/sim/turf/__tests__/backpacks.test.ts` pass. Seeded
benchmark still produces deterministic results.

### C3. UI deckbuilder: pack your own backpacks

**Priority**: P0
**Dependencies**: C2
**Files**: `src/ui/screens/DeckBuilderScreen.tsx`,
`src/ui/deckbuilder/BackpackRail.tsx` (new), `src/ui/deckbuilder/*`

Delete the current "backpack rail" that picks from 30 pre-built kits.
Add a new rail: N empty backpack slots (player-owned starting quota)
where each has 4 drop targets. Player drags quarter-cards from their
pool into backpacks. Visual affordance for "filled / partial / empty."
Remaining quarter-card budget displayed.

**Verification**: browser test `DeckBuilderScreen.browser.test.tsx`
exercises packing two backpacks and saving the deck. The saved
`DeckLoadout` shape carries `{ backpacks: [{slots: [cardId,cardId,...]}] }`
instead of `backpackIds`.

### C4. Engine: runner free-swap and payload dispense

**Priority**: P0
**Dependencies**: C2
**Files**: `src/sim/turf/environment.ts`, `src/sim/turf/game.ts`,
`src/sim/turf/attacks.ts`, `src/sim/turf/ai/*`

Implement exactly what `RULES.md §7` says:

- Equipping a backpack to a reserve tough grants one free swap into
  active (no turn penalty).
- Payload can be dispensed to own active / opponent active (as attack
  payload) / own runner.
- Retreat of a runner back to reserve costs the turn (no free-swap
  on the way back).
- Seize of a runner transfers backpack + remaining contents to the
  attacker.

**Verification**: new unit tests in
`src/sim/turf/__tests__/runners.test.ts` cover (a) free-swap fires
exactly once per equip, (b) retreat of empty-pack runner costs the
turn, (c) seize transfers the payload. `pnpm run test:sim` green.

### C5. Starting backpack quota via simulation

**Priority**: P1
**Dependencies**: C4
**Files**: `src/data/ai/turf-sim.json`, `src/sim/analysis/cli.ts`

Add a new CLI: `analysis backpack-quota` that iterates through N =
3..10 starting backpack counts and reports win rate, stall rate,
runner opportunity use, first-blood timing for each. Pick the N that
keeps buildup balanced at 12–20 rounds and all five card types
meaningfully used.

**Verification**: `pnpm run analysis:backpack-quota --profile ci`
produces a JSON summary. Docs updated in `RULES.md §3` with the
chosen N.

### C6. Runner symbol + slot visuals

**Priority**: P1
**Dependencies**: C1, C4
**Files**: `src/ui/cards/CrewCard.tsx`, `src/ui/cards/ModifierSlot.tsx`,
new `RunnerBadge.tsx`

- Runner symbol overlay on toughs carrying a backpack.
- Top-left / top-right / bottom-left / bottom-right corner slots are
  greyed-out on non-runner toughs (backpack-gated).
- Middle-left / middle-right pockets always-active regardless.

Matches the six-position frame described in `RULES.md §2`.

**Verification**: visual fixtures under `e2e/visual-fixtures.spec.ts`
capture a runner next to a non-runner; reviewer signs off.

---

## Epic D — Ability resolution in combat

Goal: every ability shown in the deckbuilder actually fires in combat.
Today only Bruiser precision-ignore is active; the rest are decorative.

### D1. Weapon category abilities in attacks.ts

**Priority**: P1
**Dependencies**: C1
**Files**: `src/sim/turf/attacks.ts`,
`src/sim/turf/__tests__/abilities-weapons.test.ts` (new)

Implement for both offense and defense orientations:
- **Bladed — LACERATE / PARRY**
- **Blunt — SHATTER / BRACE**
- **Explosive — BLAST (splash) / DETERRENT**
- **Ranged — REACH (target any position) / OVERWATCH**
- **Stealth — AMBUSH (no retaliation) / EVASION (dodge)**

Each ability has a 1-line test exercising the behaviour against a
handcrafted board.

**Verification**: `pnpm run test:sim` covers every weapon ability.
Benchmark reports show fresh attack-family distribution because
abilities now actually land.

### D2. Drug category abilities in attacks.ts + environment.ts

**Priority**: P1
**Dependencies**: D1
**Files**: `src/sim/turf/attacks.ts`, `src/sim/turf/environment.ts`,
`src/sim/turf/__tests__/abilities-drugs.test.ts` (new)

Implement:
- **Stimulant — RUSH (skip cooldown) / REFLEXES (counter-attack)**
- **Sedative — SUPPRESS (reduce power) / NUMB (ignore damage)**
- **Hallucinogen — CONFUSE (easier flips) / PARANOIA (harder flips)**
- **Steroid — BULK / FORTIFY**
- **Narcotic — BERSERK / PAINKILLERS (survive killing blow once)**

Each with a handcrafted test.

**Verification**: `pnpm run test:sim` green. Re-run autobalance (Epic B)
on top; cards that shifted because abilities now matter get re-tuned
naturally.

### D3. Archetype abilities

**Priority**: P1
**Dependencies**: D2
**Files**: `src/sim/turf/attacks.ts`, `src/sim/turf/environment.ts`,
`src/sim/turf/ai/scoring.ts`,
`src/sim/turf/__tests__/abilities-archetypes.test.ts` (new)

Implement the remaining 11:
- Snitch (reveal), Lookout (reserve access), Enforcer (rival +damage),
  Ghost (reserve attack), Arsonist (splash), Shark (weak-opponent bonus),
  Fence (sacrifice → draw), Medic (double heal), Wheelman (swap
  vanguard), Hustler (hand steal), Sniper (any-position target)

**Verification**: test per archetype confirming its ability fires.
`pnpm run analysis:benchmark` keeps win rate inside 0.42–0.58.

### D4. Rerun autobalance after ability landing

**Priority**: P0
**Dependencies**: D3, B3
**Files**: `sim/reports/turf/balance-history.json`,
`config/raw/cards/`

Landing D1–D3 likely re-destabilises many cards. Re-run Epic B's
autobalance loop until 100 % lock coverage under the new ability
model.

**Verification**: `RELEASE_GATING=1 pnpm run test:release` green,
`LOCK_COVERAGE_MIN = 1.00`.

---

## Epic E — Runner opening contract in AI

Goal: the sim AI satisfies the four-stage runner contract defined in
`docs/RULES.md` (reserve-start → equip → deploy → payload). Current
diagnostics show reserve-start misses entirely.

### E1. Diagnose why planner ignores reserve-start

**Priority**: P1
**Dependencies**: C4
**Files**: `src/sim/turf/ai/planner.ts`, `src/sim/turf/ai/scoring.ts`

Instrument a per-stage trace per game. Identify whether reserve-start
is (a) not generated as a legal action, (b) generated but scored too
low, (c) blocked by dependency gating. Report findings in a commit
message.

**Verification**: `pnpm run analysis:benchmark --profile ci` emits
`runnerStageMisses: { reserveStart: N, equip: N, deploy: N, payload:
N }` with a root cause note in the JSON summary.

### E2. Fix the contract

**Priority**: P1
**Dependencies**: E1
**Files**: `src/sim/turf/ai/*`

Implement the scoring / goal arbitration fixes per E1's findings. No
hard-coding "always take reserve-start on turn 1" — the AI must
recognise it as a valuable setup move, not a forced one.

**Verification**: reserveStartRate ≥ 0.95 on release-profile
benchmarks. Overall win-rate still 0.45–0.55. No regression in stall
rate or pass rate.

---

## Epic F — Visual finish to POC parity

Goal: the shipped game is visually indistinguishable in *language* from
`public/poc.html`, reviewed per `docs/VISUAL_REVIEW.md`.

### F1. Gap analysis vs POC

**Priority**: P1
**Dependencies**: none
**Files**: `docs/VISUAL_REVIEW.md` (append findings)

Using `pnpm run visual:export:headless` → compare each fixture
(menu / garage / deckbuilder / buildup / combat / crew-card /
modifier-badges) to `public/poc.html` screenshots. Document gaps.

**Verification**: findings table added to VISUAL_REVIEW.md with one
row per fixture and per-device-profile delta.

### F2. Menu + garage polish

**Priority**: P1
**Dependencies**: F1
**Files**: `src/ui/screens/MainMenuScreen.tsx`,
`src/ui/screens/DeckGarageScreen.tsx`, `src/ui/theme/*.css`

Land the typography, spacing, colour balance, and card framing from
POC.

**Verification**: re-export visual fixtures; reviewer signs off in
VISUAL_REVIEW.md.

### F3. Deckbuilder polish (post-C3)

**Priority**: P1
**Dependencies**: F1, C3
**Files**: `src/ui/screens/DeckBuilderScreen.tsx`,
`src/ui/deckbuilder/*.css`

Including the new backpack-packing UX, land POC-faithful density,
affordances, and slot visuals.

**Verification**: visual fixtures match POC direction.

### F4. Buildup + combat polish (post-C6)

**Priority**: P1
**Dependencies**: F1, C6, D3
**Files**: `src/ui/screens/BuildupScreen.tsx`,
`src/ui/screens/CombatScreen.tsx`,
`src/ui/board/*`, `src/ui/combat/*`

Includes runner symbol, pocket/backpack-gated visual distinction,
attack outcome animations, ability fire indicators.

**Verification**: visual fixtures match POC direction.

### F5. Card component final pass

**Priority**: P1
**Dependencies**: F1, C1, C6
**Files**: `src/ui/cards/*`

Single CardFrame component drives every full-sized card (tough,
backpack). Quarter-cards render only inside slot positions. Affiliation
badges, power/resistance numerals, and name slab all match POC.

**Verification**: visual fixtures.

---

## Epic G — Responsive + accessibility finish

### G1. Portrait layout final pass

**Priority**: P0
**Dependencies**: F4
**Files**: `src/platform/layout.ts`, `src/ui/**/*.css`

Target: iPhone 14 portrait fits full menu → buildup flow with no
scroll beyond the hand. Safe-area insets honoured.

**Verification**: e2e/iphone-14 flow passes. Visual fixture for
iphone-14 shows no clipping.

### G2. Landscape + tablet

**Priority**: P0
**Dependencies**: G1
**Files**: `src/platform/layout.ts`, `src/ui/**/*.css`

iPad Pro landscape, Pixel 7 portrait, desktop Chrome each get a
deliberate composition (not a fluid stretch).

**Verification**: all four Playwright profiles green. Visual fixtures
signed off.

### G3. Tap-to-arm accessibility path

**Priority**: P0
**Dependencies**: C3, C6
**Files**: `src/ui/dnd/*`, `src/ui/board/PositionSlot.tsx`,
`src/ui/deckbuilder/*`

Every drag interaction must have a keyboard/tap equivalent:
select source → select destination. Screen reader labels on every
interactive slot.

**Verification**: new `e2e/accessibility.spec.ts` confirms tap-only
flow completes a game. axe-core smoke passes on menu, deckbuilder,
buildup, combat.

### G4. Fold-aware layout

**Priority**: P2
**Dependencies**: G2
**Files**: `src/platform/layout.ts`

Galaxy Fold / Surface Duo posture detection via `window.visualViewport`
+ `screen.isExtended`. Two-pane layout when folded open.

**Verification**: visual fixture for a fold posture added (emulated).
Manual review on a physical device before ship.

---

## Epic H — Persistence (profile, unlock, continue)

### H1. Profile persistence end-to-end

**Priority**: P0
**Dependencies**: none
**Files**: `src/platform/persistence/storage.ts`,
`src/platform/persistence/database.ts`, `src/ui/settings/*`

`loadProfile()` / `saveProfile()` already exist. Wire UI settings
(audio, motion-reduced, rules-seen) to read/write through them. Test
full round-trip web ↔ native.

**Verification**: browser test sets audio=off, reload, still off.
Maestro smoke sets a profile setting on Android emulator, relaunches
app, value persists.

### H2. Unlock state persistence

**Priority**: P0
**Dependencies**: H1
**Files**: `src/platform/persistence/storage.ts`,
`src/ui/deckbuilder/DeckBuilderScreen.tsx`,
`src/sim/cards/catalog.ts`

Unlocks recorded in SQLite. Deckbuilder lists locked cards as locked.
Achievement events (to be wired in J3) append to the unlock set.

**Verification**: unit test fakes three achievement events and
verifies three new `cardUnlocks` rows.

### H3. Continue / load-game on active-run state

**Priority**: P0
**Dependencies**: H1
**Files**: `src/platform/persistence/storage.ts`,
`src/App.tsx`, `src/ui/screens/MainMenuScreen.tsx`

`saveActiveRun()` / `loadActiveRun()` already exist but not wired to
the resume flow. Wire Load Game to actually resume mid-game state
(phase, deck, world snapshot). Disable Load when no run.

**Verification**: browser test `App.browser.test.tsx` — start a game,
reload, Load Game resumes to the same phase.

### H4. No-localStorage guard

**Priority**: P1
**Dependencies**: H1, H2, H3
**Files**: anywhere `localStorage` appears, `.eslintrc` / biome
config (add a banned-global rule)

Add biome rule banning `localStorage.*` and `sessionStorage.*` with
an allow-list for test code. Remove any stragglers.

**Verification**: `pnpm run lint` fails on a test `localStorage.setItem`;
reverts to green after removal.

---

## Epic I — Mobile packaging

### I1. Capacitor sync + boot on Android emulator

**Priority**: P0
**Dependencies**: H3
**Files**: `android/**` (as needed), `capacitor.config.ts`

`pnpm run cap:sync` → `pnpm run cap:run:android` boots the app on a
clean emulator. SQLite persistence works. Menu → deckbuilder →
buildup → combat reachable.

**Verification**: Maestro smoke on Android emulator passes.

### I2. Capacitor sync + boot on iOS simulator

**Priority**: P0
**Dependencies**: H3
**Files**: `ios/**` (as needed), `capacitor.config.ts`

Same as I1 for iOS.

**Verification**: Maestro smoke on iOS simulator passes.

### I3. Native icons, splash, store metadata

**Priority**: P0
**Dependencies**: I1, I2
**Files**: `android/app/src/main/res/**`, `ios/App/App/Assets.xcassets/**`,
`capacitor.config.ts`

Generate via `@capacitor/assets` from a single source logo. Build
store listing copy draft in `docs/store-listing.md`.

**Verification**: android APK contains correct icons in all mipmap
densities. iOS Assets catalog has full icon + splash set. Store
listing draft peer-reviewed.

### I4. Maestro smoke expansion

**Priority**: P0
**Dependencies**: I1, I2
**Files**: `.maestro/smoke.yaml`, `.maestro/backpack-pack.yaml`
(new), `.maestro/load-game.yaml` (new)

Three Maestro flows:
- **smoke**: menu → new game → deckbuilder appears (current).
- **backpack-pack**: go through deckbuilder, pack one backpack, save
  deck, start a game.
- **load-game**: launch with a saved run, tap Load Game, arrive in
  buildup/combat.

**Verification**: all three pass on Android + iOS simulators.

### I5. Android release APK + iOS archive pipelines

**Priority**: P1
**Dependencies**: I3, I4
**Files**: `.github/workflows/mobile-release.yml`

GitHub Actions job on release tag: builds signed Android AAB and iOS
archive, uploads as release artifacts. Signing keys via repo
secrets.

**Verification**: dry-run on a pre-release tag produces the two
artifacts.

---

## Epic J — Creative enrichment pass

Goal: every procedurally-generated name / flavour / ability text becomes
hand-curated. Lock-shipped cards keep their stats.

### J1. Tough name + tagline enrichment

**Priority**: P1
**Dependencies**: A4, B3
**Files**: `config/raw/cards/toughs/*.json`

Curate `displayName`, add `tagline`, rewrite `abilityText` for all
100 toughs. Clear the `draft: true` flag as each is approved.

**Verification**: `draft: true` count = 0 for toughs. Pull request
titled `creative: tough lore pass`.

### J2. Weapon + drug name + ability-text curation

**Priority**: P1
**Dependencies**: A4, B3
**Files**: `config/raw/cards/weapons/*.json`,
`config/raw/cards/drugs/*.json`

Same as J1 for 50 weapons + 50 drugs.

**Verification**: `draft: true` count = 0 for weapons and drugs.

### J3. Unlock / achievement design

**Priority**: P1
**Dependencies**: J1, J2, H2
**Files**: `config/raw/cards/*/*.json`,
`src/platform/achievements/*` (new)

Decide which cards ship unlocked (Brawl Stars "base set") vs which
ship locked with an achievement. Write each achievement as a
deterministic triggerable condition (e.g. "win 5 games", "kill 3 in
one game", "win without reserves"). Implement the tracker.

**Verification**: playthrough unit test fakes an achievement
condition; matching card flips to unlocked state in SQLite.

### J4. Audio enrichment

**Priority**: P2
**Dependencies**: F4
**Files**: `src/audio/*`

Replace placeholder Tone.js SFX with final audio assets (or keep if
procedural sounds are hitting the noir vibe). Reviewed in
VISUAL_REVIEW.md audio section.

**Verification**: audio artist sign-off.

---

## Epic K — Release governance / launch dry run

### K1. Release runbook

**Priority**: P0
**Dependencies**: all prior epics
**Files**: `docs/RELEASE.md` (new)

Step-by-step: bump version, tag, trigger workflows, validate APK/IPA,
submit to stores, roll out.

**Verification**: runbook peer-reviewed.

### K2. Pre-launch QA sweep

**Priority**: P0
**Dependencies**: K1
**Files**: N/A (process)

Full manual playthrough on a physical Android device + physical iOS
device. Record findings in a launch readiness doc.

**Verification**: launch readiness doc approved.

### K3. Store submission dry run

**Priority**: P0
**Dependencies**: I5, J3, K1
**Files**: N/A (process)

Submit to Google Play internal track + TestFlight internal group.
Validate listings, screenshots, privacy policy, content rating.

**Verification**: both stores accept the build for internal testing.

### K4. Launch

**Priority**: P0
**Dependencies**: K3
**Files**: N/A

Publish to production tracks.

**Verification**: live store URLs resolve; installed build matches
the tagged commit.

---

## Risk Register

- **Ability resolution shifts balance far from current** — Epic B needs
  to run from scratch after Epic D lands. The tuning-history array
  handles this cleanly but adds iteration time (hours of simulation).
- **Backpack refactor is disruptive** — engine, UI, AI, tests all touch
  the same files. Epic C is the single highest-risk epic and should be
  executed by one agent or tightly coordinated.
- **Platform access** — I3 and K2 need physical devices. Agents cannot
  do final hardware checks; keep those as explicit human steps.
- **Store submission** — K3 requires Google/Apple developer account
  credentials, which are human-supplied.

## Execution Order Summary

```
A (pipeline)  ──►  B (autobalance)  ─────────┐
    │                                         │
    └──►  C (backpack/runner) ──►  D (abilities) ──►  B₂ (re-balance)
                                     │
                                     └──►  E (AI contract)
          
A ──►  F (visual polish) ──►  G (responsive + a11y)
          
H (persistence) ──►  I (mobile packaging) ──►  K (release)
          
J (creative) runs in parallel once A, B, and D are settled.
```

## Verification Cheatsheet

Any claim of "done" must pass these local commands:

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm run test                  # node + DOM
pnpm run test:browser
pnpm run test:e2e              # 4 device profiles
RELEASE_GATING=1 pnpm run test:release
pnpm run build
pnpm run cap:sync              # for mobile-touching work
```

Plus domain-specific commands listed per-task above.
