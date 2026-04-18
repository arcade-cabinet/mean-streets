---
title: Architecture
updated: 2026-04-17
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
    toughs/card-*.json            # 100 toughs (55 common / 25 uncommon / 15 rare / 5 legendary)
    weapons/weap-*.json           # 50 weapons (28/12/8/2)
    drugs/drug-*.json             # 50 drugs (28/12/8/2)
    currency/currency-*.json      # 2 currency cards ($100, $1000)
    mythics/mythic-*.json         # 10 hand-authored mythics (never in packs)
  compiled/                       # Build-time outputs (gitignored)
    toughs.json, weapons.json, drugs.json, currency.json, mythics.json
                                  # Flattened: stat arrays collapsed to latest value;
                                  # toughs get hp = maxHp = resistance at compile time

src/
  sim/turf/                       # Active game engine (runs without React)
    types.ts                      # Card/StackedCard/Turf/PlayerState/QueuedAction/CardInstance/
                                  # ToughInCustody/WarStats + heat/blackMarket/holding/lockup
                                  # mythicPool/mythicAssignments on TurfGameState
    board.ts                      # Stack ops, power/resistance with HP clamp,
                                  # affiliation conflict, seizure, promoteReserveTurf,
                                  # modifiersByOwner
    stack-ops.ts                  # Reusable stack navigation: topToughIdx, killToughAtIdx, transferMods
    attack-helpers.ts             # Shared attack computation helpers
    attacks.ts                    # resolveStrikeNow with tiered damage (glance/wound/serious/crushing)
    abilities.ts                  # applyTangibles (rarity-scaled) + runIntangiblesPhase
                                  # (probabilistic bribes + counter/redirect)
    abilities-effects.ts          # ABILITY_INDEX: authored-flag → TangibleDelta / IntangibleHandlerId
    ability-hooks.ts              # Passive hooks: hasImmunity, hasNoReveal, hasTranscend,
                                  # hasInsight, hasStrikeTwo, hasChainThree, hasAbsolute,
                                  # hasLaunder, hasLowProfile — consumed by sim + UI
    ability-handlers.ts           # Intangible handler bodies (runCleanSlate, runBuildTurf,
                                  # runStrikeRetreated, maybeBribe, etc.)
    heat.ts                       # computeHeat(state), raidProbability(heat, difficulty)
    market.ts                     # sendToMarket/tradeAtMarket/healAtMarket/returnFromMarket/wipeMarket
    holding.ts                    # sendToHolding/holdingCheck/bribeSuccess/returnFromHolding/lockupProcess
    resolve.ts                    # resolvePhase: raid → combat pass 1 dominance → pass 2 priority chain
                                  # → seize reconciliation → promoteReserveTurf
    env-handlers.ts               # Action handler implementations (extracted from environment.ts)
    environment.ts                # stepAction: draw, play_card, retreat, modifier_swap,
                                  # send_to_market, send_to_holding, black_market_trade,
                                  # black_market_heal, queued strikes, discard, end_turn
    env-query.ts                  # createObservation (with heat/market/holding/lockup/pending),
                                  # enumerateLegalActions, policy keys
    game.ts                       # createMatch, runTurn, isGameOver (A/B/draw/timeout)
    catalog.ts                    # Card catalog access helpers (co-located with engine)
    generators.ts                 # generateCurrency, generateWeapons, generateDrugs
    deck-builder.ts               # buildAutoDeck → flat Card[] (with CardInstance priority shuffle)
    run.ts                        # Single-game runner entry point
    benchmark.ts                  # playSimulatedGame: seeded AI-vs-AI loop
    balance.ts                    # Per-card performance, lock lifecycle, v2 history
    sweep.ts                      # Forced-inclusion permutation sweeps
    ai/                           # AI decision pipeline
      planner.ts                  # Yuka GOAP: composite goals over v0.3 action set
      planner-goals.ts            # Goal definitions: heat_management, mythic_hunt, stack_rebuild,
                                  # build_stack, direct_pressure, pushed_pressure, funded_pressure,
                                  # anti_stall, draw_tempo, retreat_shield
      scoring.ts                  # Score all v0.3 actions: draw/play/retreat/swap/market/holding/queued
      policy.ts                   # selectAction: difficulty-gated top-K + noise
      curator.ts                  # Pre-war collection curation for AI (merge + priority + enable/disable)
      config.ts                   # AI configuration constants
      index.ts                    # AI module public exports
      learning.ts                 # Learning/adaptation utilities
      runner.ts                   # AI game runner
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
    rng.ts                        # Seeded PRNG via `seedrandom`: createRng, next, shuffle
  sim/packs/
    generator.ts                  # generatePack, starterGrant (rolled rarity), matchRewardPacks
    rewards.ts                    # computePerTurfRewards + computeWarOutcomeReward
                                  # (Absolute/Overwhelming/Decisive/Standard + Perfect/Flawless/Dominant/Won)
    mythic-pool.ts                # Pool tracking, flip-on-combat, escalating-currency fallback
    types.ts                      # PackKind, PackInstance, PackReward, MythicDraw

  ecs/                            # Koota ECS bridge
    traits.ts                     # GameState, PlayerA/B, ActionBudget, TurnEnded, DeckPending,
                                  # QueuedStrike, Heat, BlackMarket, Holding, Lockup, MythicPool
    world.ts                      # createGameWorld(config, seed, deck)
    actions.ts                    # drawAction, playCardAction, retreatAction, modifierSwapAction,
                                  # sendToMarketAction, sendToHoldingAction, blackMarketTradeAction,
                                  # blackMarketHealAction, queueStrikeAction, endTurnAction
    hooks.ts                      # useTurfActive, useTurfReserves, useDeckPending, useTurnEnded,
                                  # useQueuedStrikes, useHeat, useBlackMarket, useHolding,
                                  # useLockup, useMythicPool, useActionBudget, useTurfStackComposite

  platform/                       # Capacitor shell, device, persistence
    AppShell.tsx                  # Device/layout provider + safe-area shell
    device.ts, layout.ts          # Orientation, screen size, layout classification
    persistence/                  # SQLite: PlayerProfile, collection, saved games
      collection.ts               # loadCollection (CardInstance[]), addCardsToCollection,
                                  # grantStarterCollection, loadPreferences, mergeInstances
      profile.ts                  # PlayerProfile + aiCollection mirror + mythicAssignments
                                  # + warStats
      ai-profile.ts               # Parallel AI collection tracking (invisible to player)

  ui/                             # React presentation layer
    screens/                      # MainMenu, Difficulty, Game, Collection, CardGarage,
                                  # PackOpening, GameOver
    cards/                        # Card (unified v0.3 w/ unlock-difficulty icon + rolled-rarity
                                  # border + mythic treatment), CardFrame, ModCard
    board/                        # TurfView (single-lane 1v1 + reserves indicator),
                                  # TurfCompositeCard (HP bar per tough), StackFanModal,
                                  # BlackMarketPanel, HoldingPanel, HeatMeter, MythicBadge,
                                  # StreetDivider
    affiliations/                 # AffiliationSymbol, MythicSymbol (shared gold ring),
                                  # getAffiliationRelation
    hud/                          # GameHUD (turn counter, action budget, queued-strikes row,
                                  # heat meter, reserve count)
    overlays/                     # Modal overlays and contextual UI layers
    animations/                   # Card movement + resolution animation utilities
    audio/                        # Tone.js SFX integration
    deckbuilder/                  # Deck/collection curation UI (CardGarage sub-components)
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
  difficulty-grid.spec.ts         # Difficulty selection (5 tiers, no Sudden Death in v0.3)
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
Compiled card pools + CardInstance[] collection + Preferences
  → buildAutoDeck(collection, rng, prefs)
    → filters disabled instances; biases shuffle by priority (1–10)
    → flat Card[N] materialized from CardInstance (apply rarity scaling)
  → createMatch(config, { deckA, deckB }) → MatchState
    → turfs[0].isActive=true, turfs[1..].isActive=false (reserves)
    → heat=0, blackMarket=[], holding={A:[],B:[]}, lockup={A:[],B:[]}
    → mythicPool = 10 unassigned ids; mythicAssignments = {}
  → Each turn, both players independently apply actions in parallel:
    → stepAction per action: draw (→ pending), play_card (pending → turf),
      retreat, modifier_swap, send_to_market, send_to_holding,
      black_market_trade, black_market_heal, queued strikes, discard, end_turn
  → When both players turnEnded:
    → resolvePhase(state):
      1. Raid phase first:
         - computeHeat → raidProbability = heat² × difficulty_coef
         - If fires: wipeMarket, sweep face-up active tops to Lockup,
           defender can bail $500 (cops pocket full tribute)
         - Closed Ranks turfs exempt
      2. Combat Pass 1: compute dominance per queued strike
         (cumulative_P + tangibles + loyalty - cumulative_R)
         Sort by dominance desc. Ties favor defender.
      3. Combat Pass 2 per queued: priority chain
         - Affiliations (loyal/rival bonuses)
         - Currency bribes (probabilistic: 500=70%, 1k=85%, 2k=95%, 5k=99%)
         - Drugs (intangible: PATCHUP/LAUNDER/LOW_PROFILE/CLEAN_SLATE/…)
         - Weapons (intangible: PARRY/EVASION/DETERRENT/…)
      4. Tiered damage on survival (glance/wound/serious/crushing)
         + HP clamp on wounded toughs
      5. Seize reconciliation: empty defender turf → promoteReserveTurf
      6. Cleanup: clear queues, reset turnEnded, reset action budgets
         (5 if new active turf's first turn, else 3/4/3 by difficulty)
  → isGameOver(match) → 'A' | 'B' | 'draw' | null
  → Metrics collection → JSON report (including heat history, raid counts,
    market activity, mythic flips)
```

### AI Decision Pipeline

```
TurfGameState + TurfObservation
  → Fuzzy inputs: crewStrength, threatLevel, resourceLevel, danger, heatAmbient
  → Yuka FuzzyModule defuzzification → aggression/patience/desperation
  → GOAP goals: build_stack, direct_pressure, pushed_pressure,
    funded_pressure, anti_stall, draw_tempo, retreat_shield,
    heat_management, mythic_hunt, stack_rebuild
  → scoreAll(legalActions) over v0.3 action set → ScoredAction[]
    → draw scored by deck-info value vs action budget
    → retreat scored by top-shield delta
    → modifier_swap scored by stat realignment value
    → send_to_market scored by trade/heal value vs tough sacrifice
    → send_to_holding scored by heat relief vs custody risk
    → queued strikes scored with intangible-awareness (known face-up mods)
  → selectAction(scored, difficulty, rng)
    → per-difficulty top-K filter + noise injection
  → Chosen action → stepAction(gs, action)

Pre-war collection curation:
  curator.ts runs same scoring over collection state
  → enable/disable + priority 1-10 + merge recommendations
  → applied to AI's next-war deck
```

### ECS → UI Rendering (v0.3 single-lane)

```
createGameWorld(config, seed, deck)
  → Koota world with GameState, PlayerA, PlayerB, TurnEnded,
    DeckPending, QueuedStrike, Heat, BlackMarket, Holding, Lockup, MythicPool

GameScreen (single-lane layout):
  → useTurfActive('A') → Turf (the one active turf)
  → useTurfReserves('A') → number (count of reserves behind active)
  → useTurfActive('B') → Turf (opponent's active)
  → useTurfReserves('B') → number
  → useDeckPending('A') → Card | null
  → useQueuedStrikes('A') → QueuedAction[]
  → useTurnEnded(['A','B']) → boolean pair
  → useHeat() → number (shared scalar, drives HeatMeter)
  → useBlackMarket() → ModifierCard[] (shared pool, drives BlackMarketPanel)
  → useHolding('A') → ToughInCustody[] (drives HoldingPanel)
  → useLockup('A') → ToughInCustody[] (drives Lockup indicator)
  → useMythicPool() → { unassigned: string[]; assignments: Record<string, 'A'|'B'> }

User action (e.g., Send to Market):
  → sendToMarketAction(world, 'A', toughId)
  → stepAction(gs, { kind: 'send_to_market', side: 'A', toughId })
  → Koota subscriptions fire → BlackMarketPanel re-renders
  → Animation: tough card slides from turf → market panel

On both sides ending turn:
  → resolvePhase triggered by stepAction
  → If raid fires: market-wipe animation + lockup-sweep animation
  → Otherwise: combat overlay animates each queued action in dominance order
  → Mythic flip-on-kill → badge slide from loser to winner
  → Final state renders after animation
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
produces believable play across 5 difficulty tiers.

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
