---
title: Claude Code Instructions
updated: 2026-04-14
status: current
---

# Mean Streets — Agent Instructions

## What This Is

A gritty tactical turf war card game. 25 toughs + up to 25 quarter-cards packed into backpacks per deck, 5v5 position seizure, simultaneous rounds, no dice.

**Doc pillars** — each file owns exactly one area:
- `docs/DESIGN.md` — vision, identity, philosophy, pivot history
- `docs/RULES.md` — authoritative gameplay mechanics (cards, phases, attacks, backpacks, runners)
- `docs/ARCHITECTURE.md` — technical stack, directory layout, data flow
- `docs/PRODUCTION.md` — release readiness, platform targets, blockers, implementation status
- `docs/VISUAL_REVIEW.md` — how to run and review visual fixtures

## Critical Rules

1. **The game design is LOCKED IN.** `docs/RULES.md` is the authoritative source of truth for mechanics — do not reinvent them. Release status tracks in `docs/PRODUCTION.md`.
2. **Balance is simulation-proven.** Any rule change must be validated with `pnpm run analysis:benchmark` before committing. Changes to `src/sim/turf/**` that shift thresholds must update `src/data/ai/turf-sim.json`.
3. **No dice, no coin flip.** Outcomes are deterministic. Only randomness is draw order.
4. **The simulation engine runs WITHOUT React.** Pure TypeScript, testable independently.
5. **pnpm only.** Do not create `package-lock.json` or `yarn.lock`. Use `pnpm` for every install/run.
6. **Biome, not ESLint.** `pnpm run lint` runs Biome.

## Commands

```bash
pnpm dev                    # Vite dev server
pnpm run build              # Production build (tsc + vite)
pnpm run lint               # Biome
pnpm run test               # Node + DOM unit tests (fast)
pnpm run test:node          # Pure node tests (sim, pure logic)
pnpm run test:dom           # jsdom tests (presentational components)
pnpm run test:browser       # Vitest browser-playwright (real Chromium)
pnpm run test:e2e           # Playwright end-to-end
pnpm run test:visual        # Playwright visual fixture capture
pnpm run test:release       # Release gate (requires RELEASE_GATING=1)
pnpm run analysis:benchmark # Rerun balance benchmark → sim/reports/analysis/
pnpm run analysis:lock      # Curated sweep + balance locking pass (read-only)
pnpm run analysis:lock:persist # Same, but writes sim/reports/turf/balance-history.json
pnpm run cap:sync           # Build + sync web assets to Capacitor
```

## Project Structure

- `src/sim/turf/` — Active game engine (types, board, attacks, game loop, AI)
- `src/sim/cards/` — Card generators, schemas, seeded PRNG
- `src/sim/analysis/` — Benchmark, sweep, and lock tooling
- `src/data/pools/` — JSON card data (names, archetypes, affiliations, weapon/drug categories)
- `src/data/ai/turf-sim.json` — AI config + benchmark thresholds
- `src/ecs/` — Koota ECS bridge between sim engine and React
- `src/ui/` — React components (cards, board, hand, screens, filters, theme)
- `src/platform/` — Capacitor/Device shell, persistence (SQLite), app shell
- `src/test/` — Shared test helpers (render-browser, browser-helpers)
- `e2e/` — Playwright specs (app-flow, visual-fixtures)
- `.maestro/` — Maestro mobile smoke tests
- `docs/` — Vision, rules, architecture, production, visual review (see "Doc pillars" at the top)
- `config/raw/cards/` — Per-card authored JSON (dev source of truth; compiled to `config/compiled/` for runtime)
- `sim/reports/turf/balance-history.json` — **Tracked**: source of truth for card lock state

## Key Types

- `Position` — A street slot with crew + 6 quarter-card modifier slots (drugTop/Bottom, weaponTop/Bottom, cashLeft/Right)
- `PlayerState` — Board + crewDraw + modifierDraw (unified) + hand (crew + modifiers)
- `WeaponCard` — Has category (bladed/blunt/explosive/ranged/stealth), bonus, dual offense/defense abilities
- `ProductCard` — Has category (stimulant/sedative/hallucinogen/steroid/narcotic), potency, dual offense/defense abilities
- `CashCard` — Two denominations only: $100 or $1000
- `placeModifier(board, idx, card, 'offense'|'defense')` — Unified modifier placement
- `positionPower(pos)` — Effective attack (crew power + top weapon + top drug)
- `positionDefense(pos)` — Effective defense (crew resistance + bottom weapon + bottom drug)

## Testing Conventions

- `*.test.ts` / `*.test.tsx` — Node environment (pure logic, sim, ECS)
- `*.dom.test.tsx` — jsdom for presentational components. **Do not** import anything that touches Capacitor, jeep-sqlite, or real browser APIs here — move those tests to `.browser.test.tsx`.
- `*.browser.test.tsx` — Real Chromium via `@vitest/browser-playwright`. Use `renderInBrowser` from `src/test/render-browser.tsx`; it sets `window.__MEAN_STREETS_TEST__ = true` so `AppShellProvider` skips native shell configuration.
- `e2e/*.spec.ts` — Playwright end-to-end against the dev server (configured in `playwright.config.ts`, includes desktop-chromium, iphone-14, pixel-7, ipad-pro-landscape projects).

## Known Gaps

- Category abilities (LACERATE, PARRY, RUSH, etc.) are tracked on cards but not yet fully resolved in combat — `attacks.ts` uses raw bonus/potency only.
- Archetype abilities are partially implemented — only Bruiser's precision-ignore is active in `attacks.ts`.
- Release gate (`test:release`) currently requires ≥70% of the balance catalog to be `locked`. Progress by running `pnpm run analysis:lock:persist` — stable runs feed back into `sim/reports/turf/balance-history.json`. Raise `LOCK_COVERAGE_MIN` in `src/sim/turf/__tests__/release-gate.test.ts` once more cards stabilize.
