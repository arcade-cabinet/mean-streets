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
