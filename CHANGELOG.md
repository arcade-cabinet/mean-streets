---
title: Changelog
updated: 2026-04-17
status: current
---

# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.4.0](https://github.com/arcade-cabinet/mean-streets/compare/v0.3.0...v0.4.0) (2026-04-17)


### Features

* production polish batch (Epics A–K) ([#2](https://github.com/arcade-cabinet/mean-streets/issues/2)) ([558491f](https://github.com/arcade-cabinet/mean-streets/commit/558491f75ac6f83ba41b068c77ad6acd5a81f560))
* v0.3 single-lane turf war rewrite ([#4](https://github.com/arcade-cabinet/mean-streets/issues/4)) ([62ab2e8](https://github.com/arcade-cabinet/mean-streets/commit/62ab2e8bb200569059578061cc8f5091462ba52d))

## [0.3.0] - 2026-04-17

This is the v0.3 single-lane rewrite. The v0.2 parallel-turf model
is gone. Sudden Death is gone (covered by turf progression + raids).
The hand is still gone (from v0.2). New core systems: heat, Black
Market, Holding/Lockup, Mythic pool, damage tiers with HP, modifier
swap, rarity-scaled abilities, parallel AI collection progression.

Authoritative spec: [docs/RULES.md](docs/RULES.md) v0.3.
Archived: [docs/archive/RULES-v0.2.md](docs/archive/RULES-v0.2.md).

### Added
- **Single-lane turf progression** — each player defends ONE active
  turf at a time; reserves promote up on seizure. Match = best-of-N
  where N is turf count by difficulty.
- **Damage tiers + HP**: toughs track `hp` starting at `rolledResistance`.
  Strikes hit glance / wound / serious wound / crushing tiers
  based on P/R ratio. Wounded toughs have effective P/R clamped
  to `hp/maxHp` ratio.
- **Base + rolled rarity model**: every card has an authored base
  rarity (the floor); instances roll rarity at pack-open time per
  base distribution. 5 tiers: common / uncommon / rare / legendary /
  mythic. Rolled rarity applies a ×1.0 / ×1.15 / ×1.3 / ×1.5 / ×1.7
  stat + ability scaling multiplier.
- **Card merging** (collection management):
  - Pyramid cost: 2 commons → 1 uncommon, 2 uncommons → 1 rare,
    2 rares → 1 legendary. Merge ceiling = legendary.
  - Merged result takes the higher unlock-difficulty of the two
    source instances.
  - Auto-merge + auto-prioritize toggles surface AI recommendations
    to the player.
- **Modifier ownership + modifier_swap action**: modifiers travel
  with their owning tough through retreat/lockup. On owner death,
  modifiers go to Black Market (no orphans). Modifier_swap (1
  action) moves a mod between toughs on the same active turf.
- **Black Market**: shared pool of displaced mods, supports:
  - **Trade** — spend mods (+ optional currency) to pull a higher-
    tier mod from the pool.
  - **Heal** — spend toughs (common floor 1→+2 HP, same-rarity 2→1
    full heal) to restore a wounded tough's HP.
- **Holding + Lockup**: cops take toughs into custody.
  - Per-turn holding-check fires probabilistically, weighted by
    heat.
  - Bribe success = base + rolled-rarity multiplier + bribe amount.
  - Legendary tough offering $500 ≈ common tough offering $2000.
  - Lockup duration: easy/medium 1 turn, hard 2, nightmare 3.
  - **Ultra-Nightmare perma-lockup**: toughs never return.
  - Bail at time of raid: pay $500 (cops pocket the full tribute,
    no change).
- **Heat & Raid system**: shared scalar [0, 1] accumulates from
  stack rarity concentration + currency pressure.
  - Raid probability = heat² × difficulty_coef (0.5/0.7/1.0/1.3/1.5).
  - Raid fires BEFORE combat resolution each turn. Wipes Black
    Market. Sweeps face-up active tops to Lockup.
  - Heat relief: LAUNDER (legendary currency, -0.1/turn),
    LOW_PROFILE (rare drug, halves owner contribution),
    CLEAN_SLATE (Mythic Accountant, one-shot total wipe).
- **Mythic cards** — fixed pool of 10 hand-authored signatures:
  - Silhouette (STRIKE_TWO), Accountant (CLEAN_SLATE),
    Architect (BUILD_TURF), Informer (INSIGHT),
    Ghost (STRIKE_RETREATED), Warlord (CHAIN_THREE),
    Fixer (TRANSCEND), Magistrate (IMMUNITY),
    Phantom (NO_REVEAL), Reaper (ABSOLUTE).
  - Acquired only via Perfect War draws OR by defeating an
    opponent's mythic in combat (mythic moves to victor's
    collection).
  - Never appear in packs. Cannot be merged. Cannot be healed at
    Black Market.
  - Shared gold-ring SVG treatment + per-mythic unique art.
- **Victory rating per turf**: Absolute (1 turn) / Overwhelming
  (2) / Decisive (≤3) / Standard (>3) — each awards a progressively
  smaller pack.
- **War outcome rating**: Perfect (all Absolute, no losses) /
  Flawless (all Decisive+, no losses) / Dominant (no losses) /
  Won — winner earns a Mythic draw / 5-card / 3-card / 1-card
  pack respectively.
- **Unlock-difficulty tag + high-difficulty bonus**: cards tagged
  with the difficulty where they were unlocked; higher-difficulty
  cards earn reward multipliers that diminish at lower tiers.
- **Parallel AI progression**: SQLite-tracked AI collection grows
  the same way the player's does. AI earns identical rewards from
  AI-vs-player matches, never visible to player. AI runs its own
  pre-war collection curation (merge + priority + enable-disable).
- **Probabilistic bribes** at combat resolution: $500=70%,
  $1000=85%, $2000=95%, $5000=99%. Currency spent only on success.
- **Per-card information visibility during AI turns**: opponent's
  draws, plays, retreats, modifier swaps, sends-to-market,
  sends-to-holding all animate visibly. Identities stay hidden per
  face-state.

### Changed
- **RULES.md** rewritten top-to-bottom for v0.3 model.
- **ARCHITECTURE.md** — new module map: `heat.ts`, `market.ts`,
  `holding.ts`, `mythic-pool.ts`, `rewards.ts`, `ai-profile.ts`.
- **Turf.stack** still `StackedCard[]` but now carries
  `StackedCard.owner` (tough id) for modifier attribution.
- **TurfGameState** adds `heat`, `blackMarket`, `holding`, `lockup`,
  `mythicPool`, `mythicAssignments`, `warStats`.
- **PlayerState.turfs**: index 0 = active, 1+ = reserves in
  progression queue order.
- **Strikes target active turf only** (no lane picker). Targeting
  within the stack (top/bottom/anywhere/retreated/long-shot)
  controlled by abilities.

### Removed
- **Sudden Death difficulty tier** — progression + raids cover the
  "fast-end" use case naturally.
- **Parallel N-lane turf model** — single-lane only.
- **Phase `'combat'`** — replaced by `'action' | 'resolve'`.
- **hasStruck** / **turnSide** state fields.
- **Coup mechanic** (briefly designed, dropped) — mythics now flip
  only on combat defeat, matching the loyalty narrative.

### Fixed
- Raid lockup incorrectly swept all turf modifiers into custody instead
  of only those owned by the locked tough — now uses `modifiersByOwner`.
- Lockup duration was hardcoded to 1 turn (except ultra-nightmare);
  now reads per-difficulty values from `heat.lockupDuration` config.
- `turnsOnThatTurf` in war stats recorded the global turn number instead
  of the relative engagement duration since the previous seizure.
- `resolveFundedRecruit` orphaned modifiers on the defender's turf when
  recruiting a tough; now calls `applyKill` to transfer or discard mods.
- `computeDamage` returned `wound` for R=0 attackers with positive P;
  undefended targets are now correctly treated as instant kills.
- Merge threshold in Card Garage required 4 copies (3 duplicates) instead
  of the rules-specified 2 copies (1 duplicate).
- `handleModifierSwap` did not reveal conflict cards moved to the active
  tough — both swapped modifiers are now set `faceUp` when touching active.
- Mythic pool seeded with placeholder ids (`silhouette`, `accountant`, …)
  that didn't match authored cards; updated to canonical `mythic-01…10`.
- `ResolutionOverlay` called `onDone` twice (from `finish()` and from the
  `phase.kind === 'done'` effect branch); consolidated to single call site.
- `StackFanModal` memoized `toughIndexById` on array reference, causing
  stale owner-line arrows after in-place stack mutations; now keyed on
  content identity string.

### Infrastructure
- Task batch driven execution via `docs/plans/v0.3-task-batch.md`
  with 13 specialist-owned epics (Rex/Maya/Kira/Iris/Ollie/Dex/Noa/
  Luna/Vera/Maven).
- Paper playtests captured at `docs/plans/v0.3-paper-playtest.md`
  and `v0.3-paper-playtest-2.md` — design validation before code.
- Mythic design pass with 3 review rounds in
  `config/raw/cards/mythics/` and `public/assets/mythics/`.

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
