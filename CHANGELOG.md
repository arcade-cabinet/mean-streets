---
title: Changelog
updated: 2026-04-15
status: current
---

# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-04-15

### Added
- Stack-based turf model replacing v0.1 named-slot positions
- 3 strike types: direct strike, pushed strike, funded recruit
- Draw-gate enforcement (modifiers require tough in play)
- Affiliation conflict system with rival graph, currency buffer, and neutral mediator rules
- 6 difficulty tiers: Easy (5 turfs), Medium (4), Hard (3/4 actions), Nightmare (2), Sudden Death (1), Ultra-Nightmare (1)
- Sudden death toggle on difficulty selection
- Stack-ops module for reusable stack navigation (topToughIdx, killToughAtIdx, transferMods)
- Environment/env-query split: mutations in environment.ts, queries in env-query.ts
- Match lifecycle API: createMatch, runTurn, isGameOver (replaces playTurfGame)
- Yuka GOAP planner with 5 composite goals (build_stack, direct/pushed/funded pressure, anti_stall)
- Difficulty-gated AI policy selection (top-K + noise per tier)
- Fuzzy logic context (aggression, patience, desperation)
- Unified MTG-style Card component rendering all 4 card kinds
- Rarity border tinting (common=slate, rare=sky, legendary=amber)
- AffiliationSymbol SVG components for all 11 affiliations with loyal/rival glow
- TurfView, TurfCompositeCard, StackFanModal board components
- GameScreen with action menu and two-phase strike interaction
- DifficultyScreen with 2x3 tier grid
- CollectionScreen with category and rarity filters
- PackOpeningScreen with sealed → revealing → summary flow
- Pack generator with 70/25/5 rarity roll and starter grant
- Match reward packs (per-difficulty tier)
- Collection persistence via unlockedCardIds + SQLite
- Currency cards ($100, $1000) as authored per-card files
- Directed affiliation graph (loyal/rival/neutral/mediator) replacing flat at-war lists
- All game tunables externalized to turf-sim.json
- Convergence checking (48-52% winrate band, 3 consecutive runs)
- Saturation lock state (maxHistoryLength = 8)
- Balance history v2 format with kind discriminant
- 517 tests passing: 280 node, 99 DOM, 27 browser, 111 e2e (4 device profiles)
- E2E specs: app-flow, accessibility, difficulty-grid, pack-opening, responsive-alignment, visual-fixtures

### Changed
- Card discriminant from `type` to `kind` (tough/weapon/drug/currency)
- PlayerState flattened: turfs/hand/deck/discard (no board sub-object)
- Position replaced by Turf (open-ended stack, no named slots)
- Power/resistance unified across all card types (replaces bonus/potency)
- buildAutoDeck returns flat Card[] (no separate crew/modifiers)
- playSimulatedGame replaces playTurfGame for AI-vs-AI benchmarking
- GameConfig replaces TurfGameConfig with difficulty-driven shape
- Free actions: discard and end_turn do not cost actions
- All ECS actions delegate to stepAction (no direct board/attack imports)
- Benchmark thresholds widened for v0.2 game dynamics (longer games)
- Schemas renamed: AuthoredToughSchema, CompiledToughSchema, etc.
- Catalog exports renamed: loadToughCards, loadStarterToughCards, generateCurrency

### Removed
- Quarter-card / half-card modifier slots
- Backpack mechanic (PackedDeckSnapshot, resolvePackedDeck)
- Runner mechanic (reserve staging, runner retreat, runner swap)
- Buildup phase (combat begins turn 1)
- 5-slot active/reserve board model
- DeckBuilderScreen (deck = collection in v0.2)
- CombatScreen (replaced by GameScreen)
- BuildupScreen
- BackpackRail, ReserveDropTarget, ModifierSlot, ModifierBadge components
- slot-accessors.ts, pack-resolver.ts
- special.json (backpack + cash rules)
- CrewCard, ProductCard, CashCard types (replaced by unified Card union)
- Runner opening contract analysis commands
- positionDefense, placeModifier, createBoard, emptyPosition APIs

## [0.1.0] - 2026-04-13

### Added
- Initial game engine with 5-slot active/reserve board model
- Quarter-card modifier system (weapons, drugs, cash in named slots)
- Backpack mechanic with runner staging
- Buildup + combat phase flow
- 3 attack types (direct, funded, pushed)
- Yuka.js AI with fuzzy logic and GOAP planning
- Seeded PRNG for deterministic games
- Per-card authored JSON with tuning history arrays
- Autobalance loop with convergence checking
- React UI with Koota ECS bridge
- Capacitor shell for iOS/Android
- SQLite persistence (profile, unlocks, saved games)
- Playwright e2e tests across 4 device profiles
- Maestro mobile smoke tests
- CI/CD with GitHub Actions
