---
title: Visual Review Workflow
updated: 2026-04-15
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
```

Both commands render the Playwright visual fixtures and export screenshots to:

```bash
artifacts/visual-review/<project>/<fixture>.png
```

## Current Fixture Set

- `menu` — Main menu with 4 navigation buttons
- `difficulty` — 2x3 difficulty tier grid with sudden death toggle
- `deck-garage` — Saved deck browser
- `combat` — GameScreen with turf rows, action bar, hand
- `card` — All card kinds (tough, weapon, drug, currency) at 3 rarity levels

## Review Targets

Compare exported captures against the design direction in `public/poc.html`
and the live hero art in `public/assets/hero.png`.

Focus review on:

- Turf composite card readability (power/resistance badges, roster, affiliation icons)
- Card frame: rarity border tinting, kind surface tints, portrait area
- Affiliation symbol glow (loyal=gold, rival=red) visibility
- Action bar button sizing and touch target adequacy at phone breakpoints
- Stack fan modal: carousel navigation clarity, card rendering at modal scale
- Black / dark-red / cold-metal balance across all screens
- Typography emphasis and hierarchy
- Spacing, density, and empty-space usage
- Mobile portrait clarity versus tablet/wide composition
- Consistency across menu, difficulty, game, collection, and pack opening

## Current Test Surface

- `pnpm run test:visual`
  Runs the multi-project visual fixture capture lane.
- `pnpm run test:e2e`
  Runs the full e2e suite across 4 device profiles (desktop-chromium,
  iphone-14, pixel-7, ipad-pro-landscape).

## Notes

- Exported screenshots are intentionally ignored by git.
- Playwright attachments still land in `test-results/` for one-off debugging.
- If visual changes are made, regenerate the export set before doing subjective review.
- FixtureApp supports 5 fixtures: menu, difficulty, deck-garage, combat, card.
- Pack opening, collection, and game over screens are tested via live
  navigation flows in `e2e/app-flow.spec.ts` and `e2e/pack-opening.spec.ts`.

## Gap Analysis Worksheet

Each row owns one fixture. Fill in the **Gap** column after comparing the
exported capture against the design direction. Keep each note under 80
characters.

| Fixture          | Device profile          | Target                                    | Gap (fill in) |
|------------------|-------------------------|-------------------------------------------|---------------|
| menu             | desktop-chromium        | Title wordmark + menu chip size           |               |
| menu             | iphone-14               | Safe-area top, touch-friendly chips       |               |
| menu             | ipad-pro-landscape      | Wide-mode hero crop, two-column chips     |               |
| menu             | pixel-7                 | Portrait hero fit, no clipped edges       |               |
| difficulty       | desktop-chromium        | 2x3 grid balance, tier icon tinting       |               |
| difficulty       | iphone-14               | Compact grid, touch target adequacy       |               |
| deck-garage      | desktop-chromium        | Deck card density, hover state            |               |
| deck-garage      | iphone-14               | Single-column list, 60% screen height     |               |
| combat           | desktop-chromium        | Turf composite readability, action bar    |               |
| combat           | iphone-14               | Action bar overflow, hand card sizing     |               |
| card             | desktop-chromium        | Card frame, rarity borders, affiliation   |               |

### How to review

1. Run `pnpm run visual:export:headless` — produces the capture matrix under `artifacts/visual-review/`.
2. Open each export side-by-side with `public/poc.html` in the same breakpoint.
3. Write the most important delta in the **Gap** cell (what is different, not what to do about it).
4. If a cell identifies a gap that needs code, open a sub-task.

### Change-log

- 2026-04-15 — Updated fixture set and review targets for v0.2 (stack redesign).
