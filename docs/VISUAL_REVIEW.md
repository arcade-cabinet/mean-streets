---
title: Visual Review Workflow
updated: 2026-04-17
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

## Current Fixture Set (v0.3)

- `menu` — Main menu with navigation buttons (New Game, Load, Collection, Card Garage, Open Pack)
- `difficulty` — Difficulty tier grid (Easy/Medium/Hard/Nightmare/Ultra — Sudden Death removed)
- `card-garage` — Collection management UI with enable/disable + priority slider 1-10 + merge UI + auto-toggles
- `game-single-lane` — GameScreen with 1v1 active turf + reserves indicator + heat meter + queued strikes
- `game-heat-high` — GameScreen variant with heat ≥ 0.7 showing raid-imminent state
- `game-market-open` — GameScreen with BlackMarketPanel expanded (modal on phone)
- `game-holding-active` — GameScreen with HoldingPanel showing tough in custody + lockup countdown
- `game-resolution` — Resolution overlay mid-animation (queued strike landing, dominance order)
- `stack-fan` — StackFanModal showing own-side (all face-up) vs opponent-side (mostly face-down + some revealed)
- `card-base` — All card kinds at all 5 rolled rarities (common/uncommon/rare/legendary/mythic)
- `card-mythic` — All 10 mythics with their unique SVG art + shared gold ring treatment
- `card-wounded` — Tough card showing HP bar at full/wounded/critical states
- `card-unlock-diff` — Card showing unlock-difficulty icon variants (easy/medium/hard/nightmare/ultra)
- `pack-opening` — Sealed → revealing → summary flow with rolled-rarity reveal animation
- `game-over` — Winner screen with per-turf ratings + war outcome + reward pack queue

## Review Targets

Compare exported captures against the design direction in `public/poc.html`
and the live hero art in `public/assets/hero.png`.

Focus review on:

- **Single-lane readability**: is the active 1v1 engagement clear? Reserves indicator unambiguous?
- **Heat meter**: 0-100% scale legible, color gradient at raid thresholds, positioned centrally
- **Turf composite card**: power/resistance badges, HP bar per tough, roster, affiliation icons, closed-ranks indicator
- **Card frame v0.3**: rolled-rarity border (grey/blue/gold/red/custom-mythic), unlock-difficulty icon top-left, kind surface tints, portrait area
- **Mythic visual language**: shared gold-ring treatment across all 10, per-mythic unique SVG readable at card scale
- **Affiliation symbol glow**: loyal=gold, rival=red visibility — compared to mythic gold ring (distinction clear?)
- **Action bar sizing**: new buttons (Draw, Retreat, Modifier Swap, Send to Market, Send to Holding, Direct/Pushed/Funded) fit on phone portrait
- **BlackMarketPanel + HoldingPanel**: modal on phone vs inline on tablet/desktop, readable at glance
- **Stack fan modal**: face-down opponent cards clearly marked, face-up revealed cards distinct, HP bar visible per tough
- **Resolution overlay**: dominance-ordered strike animation, intangible trigger flashes, mythic flip animation
- **Card Garage merge UI**: pyramid cost clarity (2→1 upgrade path), priority slider responsiveness, auto-toggles distinct
- **Black / dark-red / cold-metal balance** across all screens
- **Typography emphasis and hierarchy**
- **Spacing, density, and empty-space usage**
- **Mobile portrait clarity** versus tablet/wide composition
- **Consistency across** menu, difficulty, game, collection, card-garage, pack-opening, game-over

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
- FixtureApp supports the v0.3 fixture set (listed above). Some fixtures
  are state-dependent (game-heat-high, game-market-open) — FixtureApp
  accepts a `scenario` query param to seed the sim to the target state.
- Pack opening, collection, card-garage, and game-over screens are
  tested via live navigation flows in `e2e/app-flow.spec.ts`,
  `e2e/pack-opening.spec.ts`, `e2e/card-garage.spec.ts`, and
  `e2e/war-outcome.spec.ts`.
- Resolution overlay + heat-meter reactivity are tested via
  `e2e/single-lane-flow.spec.ts` with scripted sim state.

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

- 2026-04-17 — Updated fixture set for v0.3 single-lane rewrite: HeatMeter, BlackMarketPanel, HoldingPanel, MythicBadge, and TurfCompositeCard with HP bars replace v0.2 parallel-turf fixtures.
- 2026-04-15 — Updated fixture set and review targets for v0.2 (stack redesign).
