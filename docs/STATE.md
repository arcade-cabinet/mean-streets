---
title: State
updated: 2026-04-18
status: current
domain: context
---

# Mean Streets — Current State

What is done, what is in flight, and what comes next. Release blockers and
per-system status live in [PRODUCTION.md](./PRODUCTION.md). Branch history
is in `git log`.

## Where We Are (2026-04-18)

## Recent Releases

### v1.0.0 — 2026-04-18

- **Card art pipeline** — 212 PNG silhouettes, dark red surface, ragged edges, 212 unique flavor text entries.
- **Draw flow redesign** — pending → contextual placement, auto-market for unplayable modifiers, peek button, drawn card modal with flip animation.
- **SFX** — procedural sound via Tone.js, integrated on all game events.
- **Phone layout** — vertical menu, HUD draw button, safe-area aware.
- **Balance gate** — Medium AI-vs-AI winrate 0.5049 for 3 consecutive seeded runs. Medium firstTurnActions bumped 5 → 6.
- **Automerge** — Dependabot automerge workflow added.
- **PRs**: #27 (beta.1), #28 (rc.1), #29 (mythic art), #30 (phone fix), #31 (1.0.0), #32 (changelog)

### v0.6.0

- Board grid layout (PR #15): 3x2 card-slot board, simplified 3-button main menu.
- Browser test expansion: 95 Vitest browser tests across 15 files.
- E2E spec alignment: specs updated for v0.3 board layout testids. E2E moved to cd.yml.

### v0.5.0

- Mythic abilities complete.

### v0.4.0

- v0.3 full rewrite merged: HP + damage tiers, heat + raids, Black Market + Holding, handless queue-and-resolve, reserve turf promotion, base + rolled rarity, 10 hand-authored mythics.
- Pack simplification: single draw pile with probabilistic type drops. Config-driven weights from turf-sim.json.
- Workflow consolidation: `ci.yml`, `release.yml`, `cd.yml` per global standards.

### Test Coverage

| Suite | Count | Runner |
|-------|-------|--------|
| Node (sim, ECS, pure logic) | 518 | `pnpm run test:node` |
| DOM (jsdom presentational) | 108 | `pnpm run test:dom` |
| Browser (real Chromium) | 95 | `pnpm run test:browser` |
| E2E (4 device viewports) | 142 pass / 34 skip | `pnpm run test:e2e` (local) |

## Current Work

No active feature branches. v1.0.0 shipped. Post-1.0 polish in progress.

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
