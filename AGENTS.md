---
title: Codex Instructions
updated: 2026-04-13
status: current
---

# Mean Streets — Agent Instructions

## What This Is

A gritty tactical turf war card game. 25 crew + 25 modifiers per deck, 5v5 position seizure, simultaneous rounds, no dice. See `docs/DESIGN.md` for full game design and `docs/ARCHITECTURE.md` for technical architecture.

## Critical Rules

1. **The game design is LOCKED IN.** Do not reinvent mechanics. `docs/DESIGN.md` is the gameplay source of truth and `docs/PRODUCTION.md` is the release tracker.
2. **Balance is simulation-proven.** Any rule change must be validated with `npx tsx src/sim/turf/run.ts --games 10000` before committing.
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
- `src/sim/cards/` — Card generators, schemas, seeded PRNG
- `src/platform/` — Capacitor shell, responsive layout classification, SQLite persistence
- `src/data/pools/` — JSON card data (names, archetypes, affiliations, products, weapons)
- `src/data/cards.json` — Generated 100-card crew pool
- `docs/` — Design doc, architecture, production checklist
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
