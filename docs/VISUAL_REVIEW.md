---
title: Visual Review Workflow
updated: 2026-04-20
status: current
domain: ui
---

# Visual Review Workflow

## Purpose

Use this workflow to review the production UI against the visual direction
using stable, regenerated screenshots rather than ad hoc judgment.

## Export Commands

```bash
pnpm run visual:export
pnpm run visual:export:headless
pnpm run visual:export:fullpage
pnpm run visual:export:fullpage:headless
```

The viewport export commands render the Playwright visual fixtures and export screenshots to:

```bash
artifacts/visual-review/<project>/<fixture>.png
```

The full-page export commands capture the same fixture set with
`fullPage: true` and write them to:

```bash
artifacts/visual-review/<project>/fullpage/<fixture>.png
```

The visual capture lane now takes viewport screenshots with CSS
animations disabled. That keeps the export set deterministic across the
4 Playwright device profiles and avoids false failures on animated
screens.

## Current Fixture Set (v0.3)

- `menu` — Main menu live navigation surface
- `difficulty` — Difficulty tier grid (Easy/Medium/Hard/Nightmare/Ultra)
- `deck-garage` — Deck list / garage overview fixture
- `combat` — Single-lane live `GameScreen` fixture
- `card` — Mixed card gallery fixture (tough / weapon / drug / currency / mythic)
- `pack-opening` — Sealed → revealing → summary preview fixture with deterministic authored cards
- `game-over` — Victory-state game-over fixture with authored war outcome + sample rewards

## Review Targets

Compare exported captures against the design direction in `public/poc.html`
and the live hero art in `public/assets/hero.png`.

Focus review on:

- **Menu hierarchy**: logo, actions, and safe-area spacing read cleanly on phone and tablet
- **Difficulty grid clarity**: tier labels, icon tinting, and tile density remain readable on narrow screens
- **Deck garage density**: deck cards, controls, and spacing hold up in single-column mobile layouts
- **Single-lane combat readability**: active turf, hand, HUD, and action bar remain legible without overflow
- **Card frame language**: rarity borders, portrait area, affiliation markers, and HP bars read clearly at card scale
- **Pack opening flow**: sealed state, reveal state, and summary state all feel deliberate and readable
- **Black / dark-red / cold-metal balance** across all exported screens
- **Typography emphasis and hierarchy**
- **Spacing, density, and empty-space usage**
- **Mobile portrait clarity** versus tablet/wide composition
- **Consistency across** menu, difficulty, deck-garage, combat, card, pack-opening, and game-over

## Current Test Surface

- `pnpm run test:visual`
  Runs the multi-project visual fixture capture lane.
- `pnpm run test:visual:fullpage`
  Runs the opt-in multi-project full-page capture lane.
- `pnpm run test:e2e:full`
  Runs the full local e2e suite across 4 device profiles (desktop-chromium,
  iphone-14, pixel-7, ipad-pro-landscape).

## Notes

- Exported screenshots are intentionally ignored by git.
- Playwright attachments still land in `test-results/` for one-off debugging.
- If visual changes are made, regenerate the export set before doing subjective review.
- FixtureApp currently supports exactly the 7 fixture routes listed
  above. Add the route first before documenting any new fixture here.
- `e2e/pack-opening.spec.ts` now runs against the `?fixture=pack-opening`
  route rather than a dead live-app path.
- `e2e/visual-fixtures.spec.ts` is opt-in only
  (`MEAN_STREETS_VISUAL_SPECS=1`) as a fixture-route smoke test; the supported capture path is
  `pnpm run test:visual` / `visual:export*` via
  `scripts/capture-visual-fixtures.mjs`.
- `e2e/fullpage.spec.ts` is also opt-in only
  (`MEAN_STREETS_FULLPAGE=1`); the supported capture path is
  `pnpm run test:visual:fullpage` / `visual:export:fullpage*`.
- The supported capture scripts and `e2e/fullpage.spec.ts` disable CSS
  animations during capture so the exported screenshots stay stable.

## Gap Analysis Worksheet

Each row owns one fixture. Fill in the **Gap** column after comparing the
exported capture against the design direction. Keep each note under 80
characters.

| Fixture          | Device profile          | Target                                    | Gap (fill in) |
|------------------|-------------------------|-------------------------------------------|---------------|
| menu             | desktop-chromium        | Title wordmark + action spacing           |               |
| menu             | iphone-14               | Safe-area top, touch-friendly chips       |               |
| difficulty       | desktop-chromium        | Grid balance, tier icon tinting           |               |
| difficulty       | iphone-14               | Compact grid, touch target adequacy       |               |
| deck-garage      | desktop-chromium        | Deck card density, hierarchy              |               |
| deck-garage      | iphone-14               | Single-column fit, scroll rhythm          |               |
| combat           | desktop-chromium        | Turf readability, action bar balance      |               |
| combat           | iphone-14               | Action bar fit, hand card sizing          |               |
| card             | desktop-chromium        | Card frame, rarity borders, portraits     |               |
| pack-opening     | iphone-14               | Sealed state and summary readability      |               |
| pack-opening     | ipad-pro-landscape      | Reveal composition on wide screens        |               |
| game-over        | iphone-14               | Reward summary and CTA fit                |               |
| game-over        | desktop-chromium        | Reward panel hierarchy                    |               |

### How to review

1. Run `pnpm run visual:export:headless` — produces the capture matrix under `artifacts/visual-review/`.
2. Open each export side-by-side with `public/poc.html` in the same breakpoint.
3. Write the most important delta in the **Gap** cell (what is different, not what to do about it).
4. If a cell identifies a gap that needs code, open a sub-task.

### Change-log

- 2026-04-20 — Reconciled the fixture list with the actual `FixtureApp`
  routes (`menu`, `difficulty`, `deck-garage`, `combat`, `card`,
  `pack-opening`, `game-over`) and documented deterministic screenshot capture.
- 2026-04-17 — Updated fixture set for v0.3 single-lane rewrite: HeatMeter, BlackMarketPanel, HoldingPanel, MythicBadge, and TurfCompositeCard with HP bars replace v0.2 parallel-turf fixtures.
- 2026-04-15 — Updated fixture set and review targets for v0.2 (stack redesign).
