---
title: Architecture
updated: 2026-04-14
status: current
domain: technical
---

# Architecture

This document owns the technical stack, directory layout, and runtime data
flow. Gameplay mechanics are in [RULES.md](./RULES.md). Release readiness is
in [PRODUCTION.md](./PRODUCTION.md).

## System Overview

```
┌─────────────────────────────────────────────────┐
│                   React UI                       │
│  Components, GSAP animations, Tailwind 4 styles  │
├─────────────────────────────────────────────────┤
│                   Koota ECS                      │
│  Entities, Traits, React hooks for rendering     │
├─────────────────────────────────────────────────┤
│            Game Engine  (src/sim/turf/)          │
│  Board, Attacks, Game Loop, Runner logistics     │
├─────────────────────────────────────────────────┤
│         Simulation Analysis (dev-only)           │
│  Benchmarks, Sweeps, Effects, Locking            │
├─────────────────────────────────────────────────┤
│                    Yuka.js AI                    │
│  FuzzyModule → goals → seeded policy learning    │
├─────────────────────────────────────────────────┤
│           JSON Data (config/raw/cards/)          │
│  Per-card authored files, Zod-validated          │
└─────────────────────────────────────────────────┘
```

## Directory Structure

```
config/
  raw/cards/                      # Authored per-card JSON (dev source of truth)
    toughs/card-*.json            # 100 tough characters
    weapons/weap-*.json           # 50 weapons
    drugs/drug-*.json             # 50 drugs
    special.json                  # Backpack + cash rules (non-unique types)
  compiled/                       # Build-time outputs (gitignored)
    toughs.json, weapons.json, drugs.json, special.json
                                  # Flattened: stat arrays collapsed to latest value

src/
  sim/turf/                       # Active game engine (runs without React)
    types.ts                      # All game types
    board.ts                      # Position ops, effective power/defense
    attacks.ts                    # Direct/funded/pushed resolution
    game.ts                       # Buildup + combat loop
    generators.ts                 # Backpack + cash procedural generation
    environment.ts                # State init + runner logistics
    ai/                           # Planner, policy, scoring, goals
    benchmark.ts                  # Seeded benchmark runner
    balance.ts                    # Per-card performance + lock lifecycle
  sim/analysis/                   # Dev-only analysis tooling
    cli.ts                        # `analysis:*` npm scripts
    benchmarks.ts, sweeps.ts, effects.ts, locking.ts
    autobalance.ts                # Iterative tuning loop
  sim/cards/
    catalog.ts                    # Loads compiled tough catalog at runtime
    schemas.ts                    # Zod schemas for authored card shape
    rng.ts                        # Seeded Mulberry32 / seedrandom PRNG

  ecs/                            # Koota ECS bridge
    traits.ts                     # GameState, Phase, Hand, Board, etc.
    world.ts                      # createGameWorld(config, seed, deck)
    actions.ts                    # Mutations that call sim engine + sync traits
    hooks.ts                      # useGamePhase, useHand, usePlayerBoard, etc.

  platform/                       # Capacitor shell, device, persistence
    AppShell.tsx                  # Device/layout provider + safe-area shell
    device.ts, layout.ts
    persistence/                  # SQLite via @capacitor-community/sqlite

  ui/                             # React presentation layer
    filters/                      # SVG gritty-noir filter defs
    cards/, board/, hand/, hud/   # Card / board / hand / HUD components
    deckbuilder/, combat/         # Screen-specific subtrees
    screens/                      # MainMenu, DeckBuilder, Buildup, Combat, GameOver

scripts/                          # Dev-time build helpers
  explode-cards.mjs               # Split cards.json into per-card raw files
  explode-weapons-drugs.mjs       # Generate weapons/drugs as authored raw files
  compile-cards.mjs               # raw/ → compiled/ build step
  prepare-web-sqlite.mjs          # Copies sql.js wasm into public/

e2e/                              # Playwright specs
  app-flow.spec.ts                # Full menu → buildup flow per device profile
  visual-fixtures.spec.ts         # Fixture screenshots for review

.maestro/                         # Native mobile smoke tests
.github/workflows/                # CI (pull_request) and CD (push to main)
docs/                             # Design, rules, architecture, production, visual review
sim/reports/turf/                 # Versioned balance-history.json + ephemeral runs
```

## Data Flow

### Card Authoring And Compilation

```
Author per-card JSON under config/raw/cards/**/*.json
  → scripts/compile-cards.mjs (via postinstall + pre-build + vite plugin)
  → config/compiled/{toughs, weapons, drugs, special}.json
  → Runtime loaders in src/sim/cards/catalog.ts + src/sim/turf/catalog.ts
  → Zod validation + latestStat() reduction of stat arrays
  → Ready-to-play card pools
```

Raw files carry tuning history (stat arrays). Compiled files expose only
the current value so the runtime and UI never see the trail. Autobalance
writes new values to the raw files and commits each tuning iteration.

### Game Simulation

```
Compiled card pools
  → createInitialTurfState(config, seed, deck)
  → Buildup phase: both players simultaneous, runner staging in reserve
  → First blood transitions to combat
  → Combat phase: 5 actions/player/round, simultaneous, randomized initiative
  → Win check: 5 positions seized
  → Metrics collection → JSON report
```

### AI Decision Pipeline

```
Board state
  → Fuzzy inputs: crewStrength, threatLevel, resourceLevel, danger
  → Yuka FuzzyModule defuzzification
  → aggression, patience, desperation (0-1)
  → Goal evaluators: recover, finish, funded pressure, lane pressure, defense
  → Scored legal actions + seeded policy lookup
  → Chosen action + planner trace
```

### Analysis Pipeline

```
Seeded benchmark run (smoke / ci / release)
  → Fixed seed + catalog seed + warmup policy training
  → Deterministic benchmark summary
  → Forced-inclusion sweeps across curated combinations
  → Welch/bootstrap effect estimation
  → Lock-lifecycle recommendations
  → JSON analysis artifacts under sim/reports/analysis/
  → Release gate reads sim/reports/turf/balance-history.json
```

## Key Design Decisions

### Why Koota ECS?

Each card on the board is an entity with traits (Power, Resistance,
Archetype, Affiliation). Relations model ownership (HeldBy, OwnedBy).
Systems are pure functions testable without React. React hooks
(`useTrait`, `useQuery`) provide precise re-rendering without forcing a
context-provider hierarchy.

### Why Yuka.js?

Fuzzy logic produces continuous-valued context. Yuka's goal arbitration
and planner memory turn that context into explainable tactical choices.
Offline policy learning and Monte Carlo analysis reuse the same
deterministic engine.

### Why Deterministic (No Dice)?

Fixed action budgets (5/round) plus stacking modifiers provide depth.
Randomness comes from draw order only. Player agency dominates outcomes.
Simulation proved balance holds without dice.

### Why Backpacks And Runners?

Loose quarter-card draws are not a coherent ontology — quarter-cards are
attached board-state encodings, not independently drawable hand objects.
Backpacks solve that with a full-sized mechanical container that equips
to reserve toughs. See [RULES.md §6–7](./RULES.md) for the full rule set.

### Why Per-Card Raw Files + Compilation Step?

Autobalance mutates individual card stats iteratively, each change a
single-file commit. That gives us per-card review granularity in `git
log`, lets the tuning history array live alongside the current value,
and keeps the runtime a simple `import compiled/*.json` read with no
generator logic to maintain.

## Balance Validation

Every rule change must be simulation-proven before it lands. Preferred
flow:

```bash
pnpm run analysis:benchmark        # quick smoke/ci baseline
pnpm run analysis:autobalance      # iterative tuning loop
pnpm run test:release              # release-gate coverage check
```

Reports saved to `sim/reports/` under `analysis/` (ephemeral) and `turf/`
(with `balance-history.json` tracked in git). Seeds are deterministic —
any interesting game can be replayed exactly:

```bash
pnpm exec tsx -e "import {playTurfGame} from './src/sim/turf/game'; \
  console.log(playTurfGame(undefined, 1234567))"
```
