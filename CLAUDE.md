---
title: Claude Code Instructions
updated: 2026-04-15
status: current
---

# Mean Streets — Agent Instructions

## What This Is

A gritty tactical turf war card game. 25 toughs + 25 modifiers (weapons, drugs, currency) per deck, stack-based turfs, single combat phase, 6 difficulty tiers, no dice.

**Doc pillars** — each file owns exactly one area:
- `docs/DESIGN.md` — vision, identity, philosophy, pivot history
- `docs/RULES.md` — authoritative gameplay mechanics (cards, turfs, strikes, stacks, affiliations)
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

- `src/sim/turf/` — Game engine: types, board (stack ops), attacks (3 strike types), environment (stepAction), game (match lifecycle), AI (GOAP planner + fuzzy + difficulty policy)
- `src/sim/turf/stack-ops.ts` — Stack navigation helpers (topToughIdx, killToughAtIdx, transferMods, modsBelongingToTough)
- `src/sim/turf/env-query.ts` — Query/read functions split from environment.ts (observations, legal actions, policy keys)
- `src/sim/cards/` — Zod schemas (Authored*/Compiled*), compile transforms, catalog loaders, seeded PRNG
- `src/sim/packs/` — Pack generator (rarity stamping 70/25/5), starter grant, match rewards
- `src/sim/analysis/` — Benchmark, sweep, lock, autobalance, convergence tooling
- `src/data/pools/` — JSON card data (affiliations graph)
- `src/data/ai/turf-sim.json` — ALL game tunables (difficulty, combat, AI scoring, packs, rewards)
- `src/ecs/` — Koota ECS bridge: traits (GameState, PlayerA/B, ActionBudget), actions (delegate to stepAction), hooks (usePlayerTurfs, useHand, useTurfStackComposite)
- `src/ui/screens/` — MainMenu, Difficulty (2x3 grid), Game (action bar + strike interaction), Collection (category/rarity filters), PackOpening (sealed → reveal → summary), GameOver
- `src/ui/cards/` — Card (unified v0.2 MTG-style, 4 kinds), CardFrame, ModCard
- `src/ui/board/` — TurfView, TurfRow, TurfCompositeCard, StackFanModal
- `src/ui/affiliations/` — AffiliationSymbol (SVG per-affiliation + loyal/rival glow)
- `src/platform/` — Capacitor/Device shell, persistence (SQLite), collection management
- `src/test/` — Shared test helpers (render-browser, browser-helpers)
- `e2e/` — Playwright specs (app-flow, accessibility, difficulty-grid, pack-opening, responsive, visual-fixtures, layout, fold)
- `.maestro/` — Maestro mobile smoke tests
- `docs/` — Vision, rules, architecture, production, visual review
- `config/raw/cards/` — Per-card authored JSON (dev source of truth; compiled to `config/compiled/` for runtime)
- `sim/reports/turf/balance-history.json` — **Tracked**: source of truth for card lock state

## Key Types

- `Card` — Discriminated union on `kind`: `ToughCard | WeaponCard | DrugCard | CurrencyCard`
- `ToughCard` — `{ kind: 'tough', id, name, tagline, archetype, affiliation, power, resistance, rarity, abilities[] }`
- `WeaponCard` — `{ kind: 'weapon', id, name, category, power, resistance, rarity, abilities[] }`
- `DrugCard` — `{ kind: 'drug', id, name, category, power, resistance, rarity, abilities[] }`
- `CurrencyCard` — `{ kind: 'currency', id, name, denomination (100|1000), rarity }`
- `Turf` — `{ id, stack: Card[], sickTopIdx? }` — open-ended stack, no named slots
- `PlayerState` — `{ turfs: Turf[], hand: Card[], deck: Card[], discard: Card[], toughsInPlay, actionsRemaining }`
- `GameConfig` — `{ difficulty, suddenDeath, turfCount, actionsPerTurn, firstTurnActions }`
- `TurfAction` — `{ kind: TurfActionKind, side, turfIdx?, targetTurfIdx?, cardId? }`
- `TurfActionKind` — `play_card | direct_strike | pushed_strike | funded_recruit | discard | end_turn | pass`
- `MatchState` — `{ game: TurfGameState, turnCount, maxTurns }`
- `positionPower(turf)` — Effective attack (all toughs + modifiers in stack, excludes currency, respects sickTopIdx)
- `positionResistance(turf)` — Effective defense (all toughs + modifiers in stack)
- `stepAction(state, action)` — Single entry point for all game mutations (7 action kinds)
- `createMatch(config, opts?) → MatchState` / `runTurn(match, actions)` / `isGameOver(match)`

## Testing Conventions

- `*.test.ts` / `*.test.tsx` — Node environment (pure logic, sim, ECS)
- `*.dom.test.tsx` — jsdom for presentational components. **Do not** import anything that touches Capacitor, jeep-sqlite, or real browser APIs here — move those tests to `.browser.test.tsx`.
- `*.browser.test.tsx` — Real Chromium via `@vitest/browser-playwright`. Use `renderInBrowser` from `src/test/render-browser.tsx`; it sets `window.__MEAN_STREETS_TEST__ = true` so `AppShellProvider` skips native shell configuration.
- `e2e/*.spec.ts` — Playwright end-to-end against the dev server (configured in `playwright.config.ts`, includes desktop-chromium, iphone-14, pixel-7, ipad-pro-landscape projects).

## Known Gaps

- Category abilities (LACERATE, PARRY, RUSH, etc.) are tracked on cards but not yet resolved in combat — `attacks.ts` uses raw power/resistance only.
- Archetype abilities are partially implemented — shark/ghost targeting and bruiser precision-ignore are active in `attacks.ts`. Other archetypes tracked but not resolved.
- Release gate (`test:release`) currently requires >= 70% of the balance catalog to be `locked`. Progress by running `pnpm run analysis:lock:persist`.
