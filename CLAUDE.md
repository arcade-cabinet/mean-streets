---
title: Claude Code Instructions
updated: 2026-04-17
status: current
---

# Mean Streets — Agent Instructions

## What This Is

A gritty tactical single-lane turf war card game. v0.3 design: you and
your opponent each defend ONE active turf at a time; reserves queue
behind. When your active turf falls, the next reserve promotes up —
best of N where N is the difficulty's turf count. Stack-based combat,
HP + damage tiers, heat + raids, Black Market + Holding, 10
hand-authored mythics. No dice.

**Doc pillars** — each file owns exactly one area:
- `docs/DESIGN.md` — vision, identity, philosophy, pivot history
- `docs/RULES.md` — authoritative gameplay mechanics (single-lane, HP,
  heat, market, holding, mythics, damage tiers, progression)
- `docs/ARCHITECTURE.md` — technical stack, directory layout, data flow
- `docs/PRODUCTION.md` — release readiness, platform targets, blockers
- `docs/VISUAL_REVIEW.md` — how to run and review visual fixtures

Archived: `docs/archive/RULES-v0.2.md` for prior design reference.

## Critical Rules

1. **The game design is LOCKED IN.** `docs/RULES.md` v0.3 is the
   authoritative source of truth for mechanics — do not reinvent them.
   Release status tracks in `docs/PRODUCTION.md`.
2. **Balance is simulation-proven.** Any rule change must be validated
   with `pnpm run analysis:benchmark` before committing. Changes to
   `src/sim/turf/**` that shift thresholds must update
   `src/data/ai/turf-sim.json` (not hardcoded constants).
3. **No dice, no coin flip.** Outcomes are deterministic. Only
   randomness is deck draw order, seeded rarity rolls at pack open,
   seeded AI noise, and seeded bribe probabilistic rolls.
4. **The simulation engine runs WITHOUT React.** Pure TypeScript,
   testable independently.
5. **pnpm only.** Do not create `package-lock.json` or `yarn.lock`.
   Use `pnpm` for every install/run.
6. **Biome, not ESLint.** `pnpm run lint` runs Biome.
7. **Single-lane engagement.** Only turfs[0] is active per side; all
   strikes, plays, retreats, etc. operate there. Reserves are shown
   as indicators but are not interactable until promoted.

## Commands

```bash
pnpm dev                    # Vite dev server
pnpm run build              # Production build (tsc + vite)
pnpm run lint               # Biome
pnpm run test               # Node + DOM unit tests (fast)
pnpm run test:node          # Pure node tests (sim, pure logic)
pnpm run test:dom           # jsdom tests (presentational components)
pnpm run test:browser       # Vitest browser-playwright (real Chromium)
pnpm run test:e2e           # Playwright end-to-end (LOCAL ONLY — not in CI)
pnpm run test:visual        # Playwright visual fixture capture
pnpm run test:release       # Release gate (requires RELEASE_GATING=1)
pnpm run analysis:benchmark # Rerun balance benchmark → sim/reports/analysis/
pnpm run analysis:lock      # Curated sweep + balance locking pass (read-only)
pnpm run analysis:lock:persist # Same, but writes sim/reports/turf/balance-history.json
pnpm run cards:compile      # raw/ → compiled/ catalog build
pnpm run cap:sync           # Build + sync web assets to Capacitor
```

## Project Structure (v0.3)

### Sim engine — `src/sim/turf/`
- `types.ts` — Card/StackedCard/Turf/PlayerState/CardInstance/
  ToughInCustody/WarStats + heat/blackMarket/holding/lockup/
  mythicPool state on TurfGameState
- `board.ts` — stack ops, power/resistance with HP clamp,
  promoteReserveTurf, modifiersByOwner
- `attacks.ts` — resolveStrikeNow with tiered damage
  (glance/wound/serious/crushing)
- `abilities.ts` + `abilities-effects.ts` — rarity-scaled tangible +
  intangible effects, probabilistic bribes
- `ability-hooks.ts` — passive hooks: hasImmunity, hasNoReveal,
  hasTranscend, hasInsight, hasStrikeTwo, hasChainThree, hasAbsolute,
  hasLaunder, hasLowProfile
- `ability-handlers.ts` — intangible handler bodies (runCleanSlate,
  runBuildTurf, runStrikeRetreated, maybeBribe, etc.)
- `heat.ts` — `computeHeat(state)`, `raidProbability(heat, difficulty)`
- `market.ts` — `sendToMarket`, `tradeAtMarket`, `healAtMarket`,
  `returnFromMarket`, `wipeMarket`
- `holding.ts` — `sendToHolding`, `holdingCheck`, `bribeSuccess`,
  `returnFromHolding`, `lockupProcess`
- `resolve.ts` — `resolvePhase`: raid → combat pass 1 dominance →
  pass 2 priority chain → seize reconciliation → promoteReserveTurf
- `environment.ts` — `stepAction`: draw, play_card, retreat,
  modifier_swap, send_to_market, send_to_holding, black_market_trade,
  black_market_heal, queued strikes, discard, end_turn
- `env-query.ts` — createObservation + enumerateLegalActions
- `game.ts` — createMatch + runTurn + isGameOver (A/B/draw/timeout)
- `ai/` — planner.ts + planner-goals.ts + scoring.ts + policy.ts +
  curator.ts (pre-war collection curation)

### Cards + packs — `src/sim/cards/` + `src/sim/packs/`
- `cards/catalog.ts` — loadToughCards, loadMythicCards, CardInstance
  compile with hp/maxHp defaulting
- `cards/schemas.ts` — Zod schemas for 5-tier rarity
  (common/uncommon/rare/legendary/mythic)
- `packs/generator.ts` — rolled-rarity pack generator with
  high-difficulty bonus multiplier
- `packs/rewards.ts` — per-turf (Absolute/Overwhelming/Decisive/
  Standard) + war outcome (Perfect/Flawless/Dominant/Won) reward
  classification
- `packs/mythic-pool.ts` — pool of 10 mythics, flip-on-defeat,
  escalating-currency fallback
- `packs/types.ts` — PackKind, PackInstance, RewardBundle

### Data — `config/raw/cards/` + `src/data/`
- `config/raw/cards/toughs/` — 100 toughs (55C/25U/15R/5L)
- `config/raw/cards/weapons/` — 50 weapons (28C/12U/8R/2L)
- `config/raw/cards/drugs/` — 50 drugs (28C/12U/8R/2L)
- `config/raw/cards/currency/` — 2 currency cards
- `config/raw/cards/mythics/` — 10 hand-authored mythics (NOT in packs)
- `public/assets/mythics/` — 10 SVG art placeholders with shared
  gold-ring treatment
- `src/data/ai/turf-sim.json` — ALL tunables (difficulty, damage
  tiers, heat coefficients, bribe thresholds, raid probabilities,
  pack drop rates, reward multipliers)
- `src/data/pools/affiliations.json` — directed loyal/rival/neutral/
  mediator graph

### ECS — `src/ecs/`
- `traits.ts` — GameState, PlayerA/B, ActionBudget, TurnEnded,
  DeckPending, QueuedStrike, Heat, BlackMarket, Holding, Lockup,
  MythicPool
- `actions.ts` — drawAction, playCardAction, retreatAction,
  modifierSwapAction, sendToMarketAction, sendToHoldingAction,
  blackMarketTradeAction, blackMarketHealAction, queueStrikeAction,
  discardPendingAction, endTurnAction, passAction — all take
  `side: 'A'|'B'` first
- `hooks.ts` — useTurfActive, useTurfReserves, useDeckPending,
  useTurnEnded, useQueuedStrikes, useHeat, useBlackMarket, useHolding,
  useLockup, useMythicPool, useActionBudget, useTurfStackComposite
- `world.ts` — createGameWorld(config, seed, deck)

### UI — `src/ui/`
- `screens/` — MainMenu, Difficulty (5 tiers, Sudden Death removed),
  Game (single-lane 1v1 + reserves indicator), CardGarage (merge UI
  + priority sliders + auto-toggles), Collection, PackOpening (rolled
  rarity reveal), GameOver
- `cards/` — Card (5-tier rolled rarity border + unlock-difficulty
  icon + mythic treatment), CardFrame, ModCard
- `board/` — TurfView (single-lane), TurfCompositeCard (HP bar per
  tough), StackFanModal (face-down opponent fan), BlackMarketPanel,
  HoldingPanel, HeatMeter, MythicBadge, StreetDivider
- `affiliations/` — AffiliationSymbol + MythicSymbol (shared gold
  ring)
- `hud/` — GameHUD, heat meter, action budget, queued strikes row

### Platform — `src/platform/`
- `persistence/collection.ts` — CardInstance[] with rolledRarity +
  unlockDifficulty, merge helpers
- `persistence/profile.ts` — PlayerProfile + aiCollection mirror +
  mythicAssignments + warStats
- `persistence/ai-profile.ts` — parallel AI collection tracking
- `AppShell.tsx` + `device.ts` + `layout.ts`

### Tests — `src/**/__tests__/` + `e2e/`
- Node: turf-progression, damage, heat, market, holding, mythic,
  victory-rating, resolve, retreat, closed-ranks, drawing + existing
- DOM: MythicSymbol, Card, TurfView, TurfCompositeCard, StackFanModal,
  HeatMeter, BlackMarketPanel, HoldingPanel, MythicBadge, screens
- Browser: core components under real Chromium
- E2E: app-flow, difficulty-grid, single-lane-flow,
  market-and-holding, mythic-engagement, card-garage, war-outcome,
  retreat-and-closed-ranks, accessibility, responsive-alignment,
  visual-fixtures, layout-classification, fold-posture

## Key Types (v0.3)

- `Rarity` — `'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic'`
- `Card` — Discriminated union on `kind`:
  `ToughCard | WeaponCard | DrugCard | CurrencyCard`
- `ToughCard` — `{ kind: 'tough', id, name, tagline, archetype,
  affiliation, power, resistance, hp, maxHp, rarity, abilities[] }`
  (note: hp/maxHp added in v0.3; default hp=maxHp=resistance at compile)
- `StackedCard` — `{ card: Card; faceUp: boolean; owner?: string }`
  (owner = tough id equipping this modifier)
- `Turf` — `{ id, stack: StackedCard[], closedRanks, rivalBufferSpent?,
  isActive, reserveIndex }`
- `PlayerState` — `{ turfs: Turf[], deck, discard, toughsInPlay,
  actionsRemaining, pending, queued, turnEnded }` (no hand)
- `CardInstance` — `{ cardId, rolledRarity, unlockDifficulty }` —
  the collection unit
- `TurfGameState` — adds `heat`, `blackMarket`, `holding`, `lockup`,
  `mythicPool`, `mythicAssignments`, `warStats`, `phase: 'action' | 'resolve'`
- `TurfAction` — adds `stackIdx`, `toughId`, `targetToughId`,
  `offeredMods`, `targetRarity`, `healTarget`
- `TurfActionKind` — adds `modifier_swap`, `send_to_market`,
  `send_to_holding`, `black_market_trade`, `black_market_heal`
- `positionPower(turf)` — respects HP clamp on wounded toughs
- `positionResistance(turf)` — respects HP clamp
- `stepAction(state, action)` — single entry point for all mutations
- `createMatch(config, opts?) → MatchState` / `runTurn(match, actions)`
  / `isGameOver(match)`

## Testing Conventions

- `*.test.ts` / `*.test.tsx` — Node environment (pure logic, sim, ECS)
- `*.dom.test.tsx` — jsdom for presentational components. **Do not**
  import anything that touches Capacitor, jeep-sqlite, or real browser
  APIs here — move those to `.browser.test.tsx`.
- `*.browser.test.tsx` — Real Chromium via `@vitest/browser-playwright`.
  Use `renderInBrowser` from `src/test/render-browser.tsx`; sets
  `window.__MEAN_STREETS_TEST__ = true` so `AppShellProvider` skips
  native shell configuration.
- `e2e/*.spec.ts` — Playwright end-to-end against the dev server
  (configured in `playwright.config.ts`; runs desktop-chromium,
  iphone-14, pixel-7, ipad-pro-landscape projects). **E2E is NOT in
  PR CI** — it runs in `cd.yml` on push to main (gates deploy) and
  on-demand locally via `pnpm run test:e2e`. Run locally before
  merging large UI changes.
- Integration smoke scaffold: `src/sim/turf/__tests__/v03-integration.test.ts`
  — active test suite.

## Known Gaps (post-v1.0.0)

- AI's pre-war collection curation (`curator.ts`) is active but simple;
  heuristics may benefit from tuning via simulation post-launch.
- Mythic balance must be paper-playtested individually — simulation
  can't tune game-warping signature abilities the same way it tunes
  common stats.
- Mythic art is geometric SVG placeholders — editorial illustration
  pass is a post-1.0 polish task.

## Release Status

v1.0.0 shipped 2026-04-18. See `docs/PRODUCTION.md` for post-1.0 polish
items. Paper playtests: `docs/plans/v0.3-paper-playtest.md` +
`docs/plans/v0.3-paper-playtest-2.md`.
