---
title: Architecture
updated: 2026-04-15
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
│  Screens, Card/Board components, CSS animations  │
├─────────────────────────────────────────────────┤
│                   Koota ECS                      │
│  Traits, Actions, React hooks for rendering      │
├─────────────────────────────────────────────────┤
│           Game Engine  (src/sim/turf/)           │
│  Stack-based board, strikes, match lifecycle     │
├─────────────────────────────────────────────────┤
│         Simulation Analysis (dev-only)           │
│  Benchmarks, Sweeps, Effects, Locking            │
├─────────────────────────────────────────────────┤
│                    Yuka.js AI                    │
│  FuzzyModule → GOAP goals → difficulty policy    │
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
    currency/currency-*.json      # 2 currency cards ($100, $1000)
  compiled/                       # Build-time outputs (gitignored)
    toughs.json, weapons.json, drugs.json, currency.json
                                  # Flattened: stat arrays collapsed to latest value

src/
  sim/turf/                       # Active game engine (runs without React)
    types.ts                      # Card/Turf/PlayerState/GameConfig/Action/Metrics types
    board.ts                      # Stack ops, power/resistance aggregation, affiliation conflict, seizure
    stack-ops.ts                  # Reusable stack navigation: topToughIdx, killToughAtIdx, transferMods
    attacks.ts                    # 3 strike types: direct, pushed, funded recruit
    environment.ts                # stepAction (all 7 action kinds), drawPhase, actionsForTurn
    env-query.ts                  # createObservation, enumerateLegalActions, policy keys
    game.ts                       # Match lifecycle: createMatch, runTurn, isGameOver
    generators.ts                 # generateCurrency, generateWeapons, generateDrugs
    deck-builder.ts               # buildAutoDeck → flat Card[]
    benchmark.ts                  # playSimulatedGame: seeded AI-vs-AI loop
    balance.ts                    # Per-card performance, lock lifecycle, v2 history
    sweep.ts                      # Forced-inclusion permutation sweeps
    ai/                           # AI decision pipeline
      planner.ts                  # Yuka GOAP: 5 composite goals, scoreAll
      scoring.ts                  # Score all v0.2 action kinds
      policy.ts                   # selectAction: difficulty-gated top-K + noise
      ai-fuzzy.ts                 # Fuzzy module: aggression, patience, desperation
      ai-think.ts                 # Integration: wires planner to decideAction
  sim/analysis/                   # Dev-only analysis tooling
    cli.ts                        # `analysis:*` npm scripts entry point
    benchmarks.ts                 # checkConvergence (48-52% winrate band)
    sweeps.ts                     # Forced-inclusion sweeps + effect estimation
    locking.ts                    # Lock-state recommendations, saturation, rarity bands
    autobalance.ts                # Iterative stat tuning with git commits
    effects.ts                    # Welch/bootstrap effect size estimation
  sim/cards/
    catalog.ts                    # loadToughCards(), loadStarterToughCards(n)
    schemas.ts                    # Zod schemas: Authored* (stat arrays), Compiled* (flat)
    compile.ts                    # authored → compiled transform (latestStat)
    rng.ts                        # Seeded Mulberry32 PRNG: createRng, next, shuffle
  sim/packs/
    generator.ts                  # generatePack, starterGrant, matchRewardPacks
    types.ts                      # PackKind, PackInstance, PackReward

  ecs/                            # Koota ECS bridge
    traits.ts                     # GameState, PlayerA/B, ActionBudget, CardInStack, TurfOwner, SickFlag
    world.ts                      # createGameWorld(config, seed, deck)
    actions.ts                    # playCardAction, strikeAction, discardAction, passAction, endTurnAction
    hooks.ts                      # useGamePhase, useHand, usePlayerTurfs, useTurfStackComposite, useActionBudget

  platform/                       # Capacitor shell, device, persistence
    AppShell.tsx                  # Device/layout provider + safe-area shell
    device.ts, layout.ts          # Orientation, screen size, layout classification
    persistence/                  # SQLite: PlayerProfile, collection, saved games
      collection.ts               # loadCollection, addCardsToCollection, grantStarterCollection

  ui/                             # React presentation layer
    screens/                      # MainMenu, Difficulty, Game, Collection, PackOpening, GameOver
    cards/                        # Card (unified v0.2), CardFrame, ModCard
    board/                        # TurfView, TurfRow, TurfCompositeCard, StackFanModal, StreetDivider
    hand/                         # PlayerHand, CardFan
    affiliations/                 # AffiliationSymbol (SVG glow), getAffiliationRelation
    hud/                          # GameHUD (turn counter, action budget)
    combat/                       # AttackSelector, ActionMenu
    dnd/                          # DraggableCard, DragContext, DropTarget, OrientationOverlay
    filters/                      # GrittyFilters (SVG noir glow defs)
    hooks/                        # useCollection
    theme/                        # Color tokens, CSS variable wrappers

  data/
    ai/turf-sim.json              # ALL game tunables: difficulty, combat, AI, packs, rewards
    ai/turf-ai.json               # AI goal fallback config
    pools/affiliations.json       # Directed graph: loyal/rival/neutral/mediator

scripts/                          # Dev-time build helpers
  compile-cards.mjs               # raw/ → compiled/ build step (prebuild hook)
  prepare-web-sqlite.mjs          # Copies sql.js wasm into public/

e2e/                              # Playwright specs (4 device profiles)
  app-flow.spec.ts                # Menu → difficulty → game flow
  accessibility.spec.ts           # Tap-only, landmarks, keyboard navigation
  difficulty-grid.spec.ts         # Difficulty selection + sudden death toggle
  pack-opening.spec.ts            # Sealed → reveal → summary flow
  responsive-alignment.spec.ts    # Overflow checks across fixtures
  visual-fixtures.spec.ts         # Fixture screenshots for review
  layout-classification.spec.ts   # Device layout detection
  fold-posture.spec.ts            # Fold-aware layout

.maestro/                         # Native mobile smoke tests
.github/workflows/                # CI (pull_request) and CD (push to main)
docs/                             # Design, rules, architecture, production, visual review
sim/reports/turf/                 # Versioned balance-history.json + ephemeral runs
```

## Data Flow

### Card Authoring and Compilation

```
Author per-card JSON under config/raw/cards/**/*.json
  → scripts/compile-cards.mjs (via postinstall + prebuild + predev)
  → config/compiled/{toughs, weapons, drugs, currency}.json
  → Runtime loaders in src/sim/cards/catalog.ts
  → Zod validation + latestStat() reduction of stat arrays
  → Ready-to-play card pools
```

Raw files carry tuning history (stat arrays like `power: [5,6,7]`).
Compiled files expose only the latest value (`power: 7`) so the runtime
and UI never see the trail. Autobalance writes new values to the raw
files and commits each tuning iteration.

### Game Simulation

```
Compiled card pools
  → buildAutoDeck(toughs, weapons, drugs, currency, rng) → flat Card[50]
  → createMatch(config, { deckA, deckB }) → MatchState
  → Per turn: drawPhase → actionsForTurn → stepAction loop
  → stepAction handles: play_card, direct_strike, pushed_strike,
    funded_recruit, discard, end_turn, pass
  → isGameOver(match) → 'A' | 'B' | null (0-turf seizure or timeout)
  → Metrics collection → JSON report
```

### AI Decision Pipeline

```
TurfGameState + TurfObservation
  → Fuzzy inputs: crewStrength, threatLevel, resourceLevel, danger
  → Yuka FuzzyModule defuzzification
  → aggression, patience, desperation (0-1)
  → GOAP goals: build_stack, direct_pressure, funded_pressure,
    pushed_pressure, anti_stall
  → scoreAll(legalActions) → ScoredAction[]
  → selectAction(scored, difficulty, rng)
    → per-difficulty top-K filter + noise injection
  → Chosen action → stepAction(gs, action)
```

### ECS → UI Rendering

```
createGameWorld(config, seed, deck)
  → Koota world with GameState, PlayerA, PlayerB traits
GameScreen:
  → usePlayerTurfs('A') → Turf[]
  → useHand('A') → Card[]
  → renders TurfView (TurfCompositeCard × N turfs)
  → renders PlayerHand (Card × hand.length)
User action (e.g., Direct Strike):
  → strikeAction(world, 'direct_strike', srcIdx, tgtIdx)
  → calls stepAction(gs, action)  ← sim engine mutation
  → e.changed(GameState, PlayerA, PlayerB)
  → Koota subscriptions fire → React re-renders
```

### Analysis Pipeline

```
Seeded benchmark run (smoke / ci / release)
  → playSimulatedGame(seed, opts) with AI-vs-AI loop
  → Deterministic benchmark summary (winrate, turn distribution)
  → Forced-inclusion sweeps across curated combinations
  → Welch/bootstrap effect estimation
  → Lock-lifecycle recommendations (saturated at maxHistoryLength)
  → Convergence check (48-52% winrate band, 3 consecutive runs)
  → JSON analysis artifacts under sim/reports/analysis/
  → Release gate reads sim/reports/turf/balance-history.json
```

## Key Design Decisions

### Why Koota ECS?

Each game entity has traits (Power, Resistance, Archetype, Affiliation).
Systems are pure functions testable without React. React hooks
(`useTrait`, `useQuery`) provide precise re-rendering without forcing a
context-provider hierarchy. PlayerA/PlayerB traits alias the same objects
as GameState.players, so stepAction mutations are reflected in both
without re-setting trait values.

### Why Yuka.js?

Fuzzy logic produces continuous-valued context. Yuka's GOAP goal
arbitration and planner memory turn that context into explainable
tactical choices. Difficulty-gated policy selection (top-K + noise)
produces believable play across 6 difficulty tiers.

### Why Deterministic (No Dice)?

Fixed action budgets plus stacking modifiers provide depth. Randomness
comes from draw order only. Player agency dominates outcomes. Simulation
proved balance holds without dice.

### Why Stack-Based Turfs?

Turfs are open-ended stacks of cards (toughs + modifiers + currency).
Power and resistance aggregate across the entire stack. Modifiers belong
to the tough below them in the stack. This model is simpler than named
slots, supports arbitrary card counts per turf, and makes seizure/kill
logic straightforward (remove top tough, transfer orphaned modifiers).

### Why Per-Card Raw Files + Compilation Step?

Autobalance mutates individual card stats iteratively, each change a
single-file commit. That gives us per-card review granularity in `git
log`, lets the tuning history array live alongside the current value,
and keeps the runtime a simple `import compiled/*.json` read with no
generator logic to maintain.

## Balance Validation

Every rule change must be simulation-proven before it lands:

```bash
pnpm run analysis:benchmark        # quick smoke/ci baseline
pnpm run analysis:autobalance      # iterative tuning loop
pnpm run analysis:lock:persist     # persist lock state to balance-history.json
pnpm run test:release              # release-gate coverage check
```

Reports saved to `sim/reports/` under `analysis/` (ephemeral) and `turf/`
(with `balance-history.json` tracked in git). Seeds are deterministic:

```bash
pnpm exec tsx -e "import {playSimulatedGame} from './src/sim/turf/benchmark'; \
  console.log(playSimulatedGame(1234567))"
```
