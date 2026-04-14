---
title: Architecture
updated: 2026-04-13
status: current
domain: technical
---

# Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│                   React UI                       │
│  (Components, GSAP animations, Tailwind styles)  │
├─────────────────────────────────────────────────┤
│                  Koota ECS                       │
│  (Entities, Traits, Relations, Systems)          │
├─────────────────────────────────────────────────┤
│              Game Engine (src/sim/turf/)          │
│  Board, Attacks, Game Loop, Runners, Generators  │
├─────────────────────────────────────────────────┤
│            Simulation Analysis (dev-only)        │
│  Benchmarks, Sweeps, Effects, Locking, Reports   │
├─────────────────────────────────────────────────┤
│              Yuka.js AI                          │
│  FuzzyModule → Think/Goals → Policy Learning     │
├─────────────────────────────────────────────────┤
│           JSON Data (src/data/)                  │
│  Card pools validated by Zod schemas             │
└─────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
  sim/                          # Simulation engine (runs without React)
    turf/                       # Active game engine
      types.ts                  # All game types: Position, PlayerState, Config
      board.ts                  # Board ops: place crew, deploy runner payload, positionPower/Defense
      attacks.ts                # Direct/funded/pushed attack resolution
      game.ts                   # Game loop: buildup + combat phases + runner logistics
      generators.ts             # Backpack/payload generators
      ai-fuzzy.ts               # Yuka FuzzyModule (4 inputs → 3 outputs)
      ai/                       # Active planner/policy package
      run.ts                    # CLI: npx tsx src/sim/turf/run.ts --games N
    analysis/                   # Dev-only balance/statistics tooling
      benchmarks.ts             # Seeded benchmark profiles + summaries
      sweeps.ts                 # Deterministic forced-inclusion sweeps
      effects.ts                # Welch/bootstrap effect estimation
      locking.ts                # Lock lifecycle + recommendations
      reports.ts                # JSON artifact writers
      cli.ts                    # analysis:benchmark/sweep/lock entrypoint
    cards/                      # Card generation
      catalog.ts                # Authored crew-card loader from src/data/cards.json
      generator.ts              # Legacy seeded crew generator (deprecated for production pools)
      schemas.ts                # Zod schemas for crew/archetype/affiliation
      rng.ts                    # Seedrandom-backed deterministic PRNG
    engine/                     # Legacy gang-deck engine (deprecated)
    ai/                         # Legacy Yuka brain (deprecated, replaced by turf/ai-*)
    balance/                    # Legacy balance runner (deprecated)
  data/                         # JSON card/pool definitions
    pools/
      names.json                # First/last name pools by ethnicity + nicknames
      archetypes.json           # 12 archetypes with abilities
      affiliations.json         # 10 gangs + freelance with relationships
      weapon-categories.json    # 5 categories with abilities, bonusMod, name pools
      drug-categories.json      # 5 categories with abilities, potencyMod, name pools
    cards.json                  # Authored 100-card crew pool used by runtime + analysis
  platform/                     # Capacitor shell, device/layout services, SQLite persistence
    AppShell.tsx                # Device/layout provider + safe-area shell
    device.ts                   # Capacitor-backed device profile detection
    layout.ts                   # Viewport/orientation/posture classification
    persistence/                # Capacitor SQLite repositories
  ui/                           # Production React UI
docs/
  DESIGN.md                     # Game design document
  ARCHITECTURE.md               # This file
  PRODUCTION.md                 # Release checklist and mobile/store criteria
sim/
  engine.mjs                    # Original monolithic sim (deprecated)
  reports/                      # JSON balance reports from simulation runs
    turf/                       # Turf war balance reports
```

## Data Flow

### Card Generation
```
Authored crew pool (src/data/cards.json)
  → Shared loader + Zod normalization
  → 100 production crew cards

JSON pools (weapon-categories, drug-categories)
  → Zod validation
  → Seeded generators
  → backpack/payload card pools
```

### Game Simulation
```
Card pools
  → Independent deck templates (seeded PRNG)
  → Shuffle independently per player (seeded PRNG)
  → Deal initial hands (3 crew, backpack kits)
  → Buildup phase (place crew, stage runners, deploy kit payload, fuzzy strike-timing)
  → Combat phase (5 actions/round, Yuka goal arbitration + policy guidance)
  → Win check (5 positions seized)
  → Metrics collection → JSON report
```

### AI Decision Pipeline
```
Board state
  → Fuzzy inputs (crewStrength, threatLevel, resourceLevel, danger)
  → Yuka FuzzyModule defuzzification
  → aggression, patience, desperation (0-1)
  → Goal evaluators (recover, finish, funded pressure, lane pressure, defense)
  → Scored legal actions + policy artifact lookup
  → Chosen action + planner trace
```

### Analysis Pipeline
```
Seeded benchmark run
  → Fixed seed + catalog seed + warmup policy training
  → Deterministic benchmark summary
  → Forced-inclusion sweeps across curated combinations
  → Welch/bootstrap effect estimation
  → Lock recommendation lifecycle
  → JSON analysis artifacts + release gate
```

## Production Matrix

| Surface | Status | Notes |
|---------|--------|-------|
| Turf rules engine (`src/sim/turf`) | Active production engine | Shared by runtime, sim, and analysis |
| Legacy engine (`src/sim/engine`) | Deprecated | Excluded from release guarantees |
| Dev balancing (`src/sim/analysis`) | Active | Release authority for locking and thresholds |
| Web shell | Active dev/test target | Primary iteration surface, not the only release target |
| Capacitor app shell | Active production target | Android and iOS projects are first-class |
| Persistence | Active production target | Capacitor SQLite on native and web OPFS path |
| Responsive layout system | Active production target | Device/posture-aware, not scale-only CSS |
| LocalStorage persistence | Removed from product path | Test cleanup only, not a runtime backend |
| Backpack / runner ontology | Required production correction | Replaces the invalid loose quarter-card draw model |

## Release Ownership

- `src/sim/turf/`: deterministic rules, AI legality, replay safety
- `src/sim/analysis/`: card locking, seeded benchmarks, release-gate metrics
- `src/platform/`: device shell, safe areas, SQLite persistence, native parity
- `src/ui/`: responsive presentation, accessibility, and POC-faithful visual system
- `.github/workflows/`: build/test/release lanes for web and mobile readiness

## Key Design Decisions

### Why Koota ECS?
Each card is an entity with traits (Power, Resistance, Archetype, Affiliation). Relations model ownership (HeldBy, OwnedBy). Systems are pure functions testable without React. React hooks (useTrait, useQuery) provide precise re-rendering.

### Why Yuka.js?
Fuzzy logic produces continuous-valued context. Yuka goal arbitration and planner memory then turn that context into explainable tactical choices. Offline policy learning and Monte Carlo analysis reuse the same deterministic engine.

### Why Deterministic (No Dice)?
Fixed action budgets (5/round) + stacking modifiers provide enough depth. Randomness from draw order only. Player agency over outcomes. Dice were removed after simulation proved balance holds without them.

### Why Backpacks And Runners?
Loose quarter-card draws are not a coherent ontology. Quarter-cards are attached board-state encodings only, not independently drawable hand objects. Backpacks solve that by introducing a real full-card container that is equipped to reserve crew, turning them into runners who stage and deliver payload into the active street.

### Why Simultaneous Rounds?
Eliminates first-mover advantage entirely. Both players act each round with randomized initiative per action pair. Proven at 50.0/50.0% win rate across 10k games.

## Balance Validation

Every rule change is validated through Monte Carlo simulation:
```bash
npx tsx src/sim/turf/run.ts --games 10000
```

Reports saved to `sim/reports/turf/` as JSON with metrics: win rate, stall rate, pass rate, actions per game, card type usage, seizures, flips, kills, etc.

Dev-only analysis artifacts are saved to `sim/reports/analysis/` and include:
- benchmark summaries
- sweep outputs
- per-card effect estimates
- lock recommendations

Seeds are tracked — any interesting game can be replayed exactly:
```bash
# Re-run a specific game by seed
npx tsx -e "import {playTurfGame} from './src/sim/turf/game'; console.log(playTurfGame(undefined, 1234567))"
```
