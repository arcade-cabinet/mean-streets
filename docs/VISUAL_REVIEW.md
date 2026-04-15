---
title: Visual Review Workflow
updated: 2026-04-13
status: current
domain: ui
---

# Visual Review Workflow

## Purpose

Use this workflow to review the production UI against the visual language in `public/poc.html` using stable, regenerated screenshots rather than ad hoc judgment.

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

- `menu`
- `deck-garage`
- `deckbuilder`
- `buildup`
- `combat`
- `crew-card`
- `modifier-badges`

## Review Targets

Compare exported captures against `public/poc.html` and the live hero art in `public/assets/hero.png`.

Focus review on:

- silhouette and framing of cards, slots, and buttons
- black / dark-red / cold-metal balance
- typography emphasis and hierarchy
- spacing, density, and empty-space usage
- mobile portrait clarity versus tablet/wide composition
- consistency between menu, garage, deckbuilder, buildup, and combat

## Current Test Surface

- `pnpm run test:visual`
  Runs the multi-project visual fixture capture lane.
- `pnpm run test:e2e:smoke`
  Runs the live new-game/save/load smoke flow across configured projects.

## Notes

- Exported screenshots are intentionally ignored by git.
- Playwright attachments still land in `test-results/` for one-off debugging.
- If visual changes are made, regenerate the export set before doing subjective review.

## Gap Analysis Worksheet (Epic F1)

Each row owns one fixture. Fill in the **Gap** column after comparing the
exported capture against `public/poc.html`. Keep each note under 80
characters — longer findings go in their own commit or issue.

| Fixture          | Device profile          | POC target                            | Gap (fill in) |
|------------------|-------------------------|---------------------------------------|---------------|
| menu             | desktop-chromium        | Title wordmark + menu chip size       |               |
| menu             | iphone-14               | Safe-area top, touch-friendly chips   |               |
| menu             | ipad-pro-landscape      | Wide-mode hero crop, two-column chips |               |
| menu             | pixel-7                 | Portrait hero fit, no clipped edges   |               |
| deck-garage      | desktop-chromium        | Deck card density, hover state        |               |
| deck-garage      | iphone-14               | Single-column list, 60% screen height |               |
| deckbuilder      | desktop-chromium        | Collection grid, filter rail, summary |               |
| deckbuilder      | iphone-14               | Mobile rail collapse                  |               |
| buildup          | desktop-chromium        | Lane spacing, reserve rail            |               |
| buildup          | iphone-14               | Compact lane overview                 |               |
| combat           | desktop-chromium        | Attack affordances, readout           |               |
| combat           | iphone-14               | Target-picker UX                      |               |
| crew-card        | desktop-chromium        | Card frame, corner slots, tagline     |               |
| modifier-badges  | desktop-chromium        | Weapon/drug/cash badge hierarchy      |               |

### How to review

1. Run `pnpm run visual:export:headless` — produces the 4×7 capture matrix under `artifacts/visual-review/`.
2. Open each export side-by-side with `public/poc.html` in the same breakpoint.
3. Write the most important delta in the **Gap** cell (what is different, not what to do about it).
4. If a cell identifies a gap that needs code, open a sub-task under the epic that owns the surface (Epic F2 for menu/garage, F3 for deckbuilder, F4 for buildup/combat, F5 for card component).

### Change-log

- *(empty — no rows filled yet)*

