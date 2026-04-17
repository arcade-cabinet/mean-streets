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

- **v0.3 single-lane rewrite** — The core game engine rewrite landed via PR
  #4 (merged 2026-04-17 into `main`). This was the full stack redesign: HP +
  damage tiers, heat + raids, Black Market + Holding, handless queue-and-
  resolve, reserve turf promotion, base + rolled rarity, and the 10 hand-
  authored mythics.

- **Governance alignment pass** — Current branch `fix/release-please-pnpm`
  is adding the missing governance and documentation files to bring the repo
  up to the required standard: `STANDARDS.md`, `docs/TESTING.md`,
  `docs/DEPLOYMENT.md`, `docs/LORE.md`, `docs/STATE.md`, `.cursor/rules`.

- **Simulation infrastructure** — Balance benchmark, curated sweep, lock
  lifecycle, and release gate are wired and operational. `analysis:benchmark`,
  `analysis:lock`, `analysis:lock:persist` all run.

- **CI/CD pipeline** — `ci.yml` (PR gate), `cd.yml` (Pages deploy with
  release gate), `mobile-release.yml` (tag-triggered Android + iOS), and
  `autobalance.yml` (weekly cron) are all in place.

- **Mythic card authoring** — All 10 mythic JSON files and SVG placeholder
  art are in place. Abilities registered in `ability-hooks.ts`.

## Current Work

**Branch: `fix/release-please-pnpm`**

- Aligning governance files to the required project standard (this pass).
- Fixing release-please configuration for pnpm projects.

## What Comes Next

### Visual Polish Pass

- Designer review of the full UI surface — TurfView, Card, HUD, panels.
- Screenshot capture and visual regression baseline via `pnpm run test:visual`.
- Address any layout or spacing issues found during visual review.

### Paper Playtesting

- Individual paper-playtest of each of the 10 mythic cards to validate their
  balance note assumptions (simulation cannot tune game-warping abilities the
  same way it tunes common stats).
- Reference: `docs/plans/v0.3-paper-playtest.md` and
  `docs/plans/v0.3-paper-playtest-2.md`.

### E2E Expansion

- Promote the v0.3 integration smoke suite from `describe.skip` to active
  (`src/sim/turf/__tests__/v03-integration.test.ts`).
- Add E2E specs for: `single-lane-flow`, `market-and-holding`,
  `mythic-engagement`, `card-garage`, `war-outcome`, `retreat-and-closed-ranks`.
- Reach 70%+ balance lock coverage to unblock the release gate.

### Release Gate

Currently blocked by:
- Lock coverage below 70% (run `pnpm run analysis:lock:persist` iteratively).
- v0.3 integration suite still `describe.skip`-gated.

### Post-v0.3 (Future)

- **Mythic art** — Replace geometric SVG placeholders with editorial
  illustrations. This is explicitly deferred past v0.3 launch.
- **AI curation tuning** — `curator.ts` heuristics may benefit from
  simulation tuning post-launch. Currently functional but simple.
- **Mythic ability registration** — All 10 mythic signature abilities are
  authored; some intangible handler bodies may need validation against
  edge-case resolution sequences.
- **Pack economy expansion** — Seasonal packs, themed affiliation bundles,
  milestone packs.
- **Multiplayer** — Async PvP is a natural extension of the AI-mirror pattern.
  Deferred until single-player v0.3 core is locked.

## Known Gaps

These are tracked in [PRODUCTION.md](./PRODUCTION.md) under post-merge
blockers. Summarized here for orientation:

| Gap | Status |
|-----|--------|
| Mythic art — geometric SVG placeholders | Post-v0.3 editorial pass |
| AI curation heuristics | Functional; post-launch tuning |
| Mythic ability edge-case validation | Paper-playtest dependent |
| `usePlayerTurfs` backward-compat alias | Retire in Epic G completion |
| v0.3 integration suite (`describe.skip`) | Promote when modules stabilize |
| Balance lock coverage < 70% | Run `analysis:lock:persist` iteratively |
| iOS signing automation | Manual Xcode Organizer pass for now |
| Store metadata, screenshots, copy | Pre-launch task |

## Useful Commands for Orientation

```bash
git log --oneline -10          # recent commits
gh pr list                     # open PRs
pnpm run analysis:benchmark    # check current balance state
pnpm run test                  # node + DOM (fast)
pnpm run test:release          # release gate check
```
