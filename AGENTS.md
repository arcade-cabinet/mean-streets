---
title: Codex Instructions
updated: 2026-04-23
status: current
---

# Mean Streets — Agent Instructions

## What This Is

A gritty tactical turf war card game. 25 toughs + up to 25 quarter-cards packed into backpacks per deck, 5v5 position seizure, simultaneous rounds, no dice.

**Doc pillars** — start with `docs/README.md` for the domain map, then go to the owner doc for the area you're changing:
- `docs/README.md` — canonical docs index, pillar map, remaining-work summary
- `docs/DESIGN.md` — product vision, identity, player journey, future direction
- `docs/RULES.md` — authoritative gameplay mechanics and invariants
- `docs/LORE.md` — world, tone, factions, character fiction
- `docs/ARCHITECTURE.md` — technical stack, runtime data flow, file ownership
- `docs/TESTING.md` — test lanes, release gate, fixture/test expectations
- `docs/VISUAL_REVIEW.md` — visual fixtures, review workflow, screenshot targets
- `docs/DEPLOYMENT.md` — environments, secrets, CI/CD deployment mechanics
- `docs/RELEASE.md` — release-please and store-cut runbook
- `docs/LAUNCH_READINESS.md` — pre-submit manual QA and signing checklist
- `docs/PRODUCTION.md` — single source of truth for remaining launch/polish work
- `docs/STATE.md` — current shipped state and recent release history
- `docs/store-listing.md` — store metadata and screenshot deliverables

## Critical Rules

1. **The game design is LOCKED IN.** Do not reinvent mechanics. `docs/RULES.md` is the authoritative source of truth for gameplay; `docs/PRODUCTION.md` is the release tracker; `docs/README.md` is the docs map.
2. **Balance is simulation-proven.** Any rule change must be validated with `pnpm run analysis:benchmark` (optionally `analysis:lock`) before committing.
3. **No dice, no coin flip.** Outcomes are deterministic. Only randomness is draw order.
4. **The simulation engine runs WITHOUT React.** Pure TypeScript, testable independently.
5. **The product path is mobile-first.** Web is the development/test harness; persistence and interaction choices must still make sense in Capacitor iOS/Android.
6. **Do not introduce localStorage as a product backend.** Use the shared Capacitor SQLite layer.

## Commands

```bash
pnpm run dev
pnpm run build
pnpm run test
pnpm run test:browser
pnpm run test:e2e
pnpm run analysis:benchmark
pnpm run analysis:sweep
pnpm run analysis:lock
pnpm run cap:sync
```

## Project Structure

- `src/sim/turf/` — Active game engine (types, board, attacks, game loop, AI)
- `src/sim/analysis/` — Dev-only benchmarking, sweep, effect, and lock-state tooling
- `src/sim/cards/` — Authored crew loader, schemas, seeded PRNG
- `src/platform/` — Capacitor shell, responsive layout classification, SQLite persistence
- `src/data/pools/` — JSON card data (names, archetypes, affiliations, products, weapons)
- `src/data/cards.json` — Authored 100-card crew pool used by runtime and analysis
- `docs/` — Root source-of-truth docs split by product, creative, technical, quality, UI, release, context, and ops domains
- `sim/reports/` — JSON balance reports from simulation runs

## Key Types

- `Position` — A street slot with crew + 6 quarter-card modifier slots (drugTop/Bottom, weaponTop/Bottom, cashLeft/Right)
- `PlayerState` — Board + crewDraw + modifierDraw (unified) + hand (crew + modifiers)
- `WeaponCard` — Has category (bladed/blunt/explosive/ranged/stealth), bonus, dual offense/defense abilities
- `ProductCard` — Has category (stimulant/sedative/hallucinogen/steroid/narcotic), potency, dual offense/defense abilities
- `CashCard` — Two denominations only: $100 or $1000
- `placeModifier(board, idx, card, 'offense'|'defense')` — Unified modifier placement
- `positionPower(pos)` — Effective attack (crew power + top weapon + top drug)
- `positionDefense(pos)` — Effective defense (crew resistance + bottom weapon + bottom drug)

## Release Direction

- Ship target is mobile app stores first.
- Accessibility must support drag/drop and tap-to-arm/tap-to-place flows.
- Release is blocked until the analysis layer has all balance-relevant cards in `locked` state.
