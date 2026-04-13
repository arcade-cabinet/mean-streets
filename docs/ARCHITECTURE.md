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
│  Board, Attacks, Game Loop, Generators           │
├─────────────────────────────────────────────────┤
│              Yuka.js AI                          │
│  FuzzyModule → StateMachine → Action Priorities  │
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
      board.ts                  # Board ops: placeModifier, positionPower/Defense
      attacks.ts                # Direct/funded/pushed attack resolution
      game.ts                   # Game loop: buildup + combat phases
      generators.ts             # Product/cash/weapon card generators
      ai-fuzzy.ts               # Yuka FuzzyModule (4 inputs → 3 outputs)
      ai-states.ts              # State machine (BUILDING/AGGRESSIVE/DEFENSIVE/DESPERATE)
      run.ts                    # CLI: npx tsx src/sim/turf/run.ts --games N
    cards/                      # Card generation
      generator.ts              # 100-card crew generator from name pools
      schemas.ts                # Zod schemas for crew/archetype/affiliation
      rng.ts                    # Seeded Mulberry32 PRNG
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
    cards.json                  # Generated 100-card crew pool
  components/                   # React UI (TODO)
docs/
  plans/port-to-production.prq.md  # PRD with full task breakdown
  DESIGN.md                     # Game design document
  ARCHITECTURE.md               # This file
sim/
  engine.mjs                    # Original monolithic sim (deprecated)
  reports/                      # JSON balance reports from simulation runs
    turf/                       # Turf war balance reports
```

## Data Flow

### Card Generation
```
JSON pools (names, archetypes, affiliations, weapon-categories, drug-categories)
  → Zod validation
  → Generators (seeded PRNG)
  → 100 crew + 50 weapons + 50 drugs + 30 cash
```

### Game Simulation
```
Card pools
  → Shared deck template (both players get identical cards)
  → Shuffle independently per player (seeded PRNG)
  → Deal initial hands (3 crew, modifiers)
  → Buildup phase (place, stack, fuzzy strike-timing)
  → Combat phase (5 actions/round, state machine priorities)
  → Win check (5 positions seized)
  → Metrics collection → JSON report
```

### AI Decision Pipeline
```
Board state
  → Fuzzy inputs (crewStrength, threatLevel, resourceLevel, danger)
  → Yuka FuzzyModule defuzzification
  → aggression, patience, desperation (0-1)
  → resolveState() → BUILDING | AGGRESSIVE | DEFENSIVE | DESPERATE
  → getStatePriorities() → ordered action list
  → tryAction() for each priority until one succeeds
```

## Key Design Decisions

### Why Koota ECS?
Each card is an entity with traits (Power, Resistance, Archetype, Affiliation). Relations model ownership (HeldBy, OwnedBy). Systems are pure functions testable without React. React hooks (useTrait, useQuery) provide precise re-rendering.

### Why Yuka.js?
Fuzzy logic produces continuous-valued decisions (not binary if/else). The state machine creates distinct AI "personalities" during different game phases. Both systems are lightweight (~7KB for the goal module alone).

### Why Deterministic (No Dice)?
Fixed action budgets (5/round) + stacking modifiers provide enough depth. Randomness from draw order only. Player agency over outcomes. Dice were removed after simulation proved balance holds without them.

### Why Simultaneous Rounds?
Eliminates first-mover advantage entirely. Both players act each round with randomized initiative per action pair. Proven at 50.0/50.0% win rate across 10k games.

## Balance Validation

Every rule change is validated through Monte Carlo simulation:
```bash
npx tsx src/sim/turf/run.ts --games 10000
```

Reports saved to `sim/reports/turf/` as JSON with metrics: win rate, stall rate, pass rate, actions per game, card type usage, seizures, flips, kills, etc.

Seeds are tracked — any interesting game can be replayed exactly:
```bash
# Re-run a specific game by seed
npx tsx -e "import {playTurfGame} from './src/sim/turf/game'; console.log(playTurfGame(undefined, 1234567))"
```
