---
title: State
updated: 2026-04-17
status: current
domain: context
---

# Mean Streets — Current State

What is done, what is in flight, and what comes next. Release blockers and
per-system status live in [PRODUCTION.md](./PRODUCTION.md). Branch history
is in `git log`.

## Where We Are (2026-04-17)

### Recently Completed

- **v0.3 single-lane rewrite** — Full stack redesign: HP + damage tiers,
  heat + raids, Black Market + Holding, handless queue-and-resolve, reserve
  turf promotion, base + rolled rarity, 10 hand-authored mythics.

- **Board grid layout** — PR #15: 3x2 card-slot board, simplified 3-button
  main menu (New Game / Load Game / Cards), full-viewport cards screen.

- **Pack simplification** — PR #16: single draw pile with probabilistic type
  drops (tough 50% / weapon 20% / drug 20% / currency 10%). Removed typed
  pack kinds (tough-5, weapon-5, drug-5, currency-5). Config-driven weights
  from turf-sim.json.

- **Workflow consolidation** — PR #16: 3 workflows per global standards.
  `ci.yml` (PR gate: lint, test, build, browser tests), `release.yml`
  (tag → Android AAB + iOS archive), `cd.yml` (push main → E2E gate →
  Pages deploy + debug APK + release-please + autobalance).

- **Browser test expansion** — 95 Vitest browser tests across 15 files:
  GameOverScreen, CollectionScreen, PackOpeningScreen, CardGarageScreen,
  BlackMarketPanel, HoldingPanel, plus existing Card, TurfCompositeCard,
  StackFanModal, DifficultyScreen, GameScreen, MainMenuScreen, CardsScreen,
  ResponsiveLayouts, App flow.

- **E2E spec alignment** — All E2E specs updated for v0.3 board layout
  testids. E2E removed from PR CI (runs in cd.yml on push to main). 142
  passing / 34 skipped across 4 device viewports.

- **Releases** — v0.4.0 (governance + v0.3), v0.5.0 (mythic abilities),
  v0.6.0 (board grid + browser tests).

### Test Coverage

| Suite | Count | Runner |
|-------|-------|--------|
| Node (sim, ECS, pure logic) | 518 | `pnpm run test:node` |
| DOM (jsdom presentational) | varies | `pnpm run test:dom` |
| Browser (real Chromium) | 95 | `pnpm run test:browser` |
| E2E (4 device viewports) | 142 pass / 34 skip | `pnpm run test:e2e` (local) |

## Current Work

No active feature branches. Main is green.

## What Comes Next

### Visual Polish Pass

- Designer review of the full UI surface.
- Screenshot capture and visual regression baseline via `pnpm run test:visual`.

### Paper Playtesting

- Individual paper-playtest of each of the 10 mythic cards.
- Reference: `docs/plans/v0.3-paper-playtest.md`.

### Post-v0.3 (Future)

- **Mythic art** — Replace geometric SVG placeholders with editorial
  illustrations.
- **AI curation tuning** — `curator.ts` heuristics, post-launch.
- **Pack economy expansion** — Seasonal packs, themed affiliation bundles.
- **Multiplayer** — Async PvP, deferred until single-player core is locked.

## Known Gaps

| Gap | Status |
|-----|--------|
| Mythic art — geometric SVG placeholders | Post-v0.3 editorial pass |
| AI curation heuristics | Functional; post-launch tuning |
| Mythic ability edge-case validation | Paper-playtest dependent |
| iOS signing automation | Manual Xcode Organizer pass for now |
| Store metadata, screenshots, copy | Pre-launch task |

## Useful Commands

```bash
git log --oneline -10          # recent commits
gh pr list                     # open PRs
pnpm run analysis:benchmark    # check current balance state
pnpm run test:node             # node tests (fast)
pnpm run test:browser          # browser tests (real Chromium)
pnpm run test:e2e              # E2E (local only, 4 device viewports)
pnpm run test:release          # release gate check
```
