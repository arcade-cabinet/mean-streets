---
title: Mean Streets — Production Build PRD
updated: 2026-04-13
status: current
domain: product
---

# Mean Streets: Turf War

**Created**: 2026-04-12 | **Updated**: 2026-04-13
**Timeframe**: Autonomous batch execution
**Repo**: arcade-cabinet/mean-streets
**Branch**: feat/character-card-system

## Overview

Mean Streets is a gritty tactical turf war card game. Two players run street crews, push product, arm fighters, and seize enemy territory. Win by taking all 5 opponent street positions. No dice, no coin flip — outcomes are deterministic based on card stats and positioning. The only randomness is draw order.

This PRD covers building the playable game from the proven simulation engine.

## Game Design (Locked In)

### Card System — 50-Card Deck

Each player brings 25 full-size crew cards + 25 quarter-size modifier cards (any mix of weapons, drugs, cash).

**Crew cards** have two stats:
- POWER (center top) — attack strength
- RESISTANCE (center bottom) — damage absorption

Plus an archetype ability and gang affiliation.

**Quarter-size modifiers** slot onto crew cards in 6 positions:
- Top-left: Drug (offensive), Bottom-left: Drug (defensive)
- Top-right: Weapon (offensive), Bottom-right: Weapon (defensive)
- Center-left: Cash (offensive), Center-right: Cash (defensive)

Top = buffs attacks. Bottom = buffs defense. Same card, different effect based on placement.

### Board — 5v5 Positions

Each player has 5 active street positions + 5 reserve positions. Positions hold a crew card with up to 6 modifier slots. Seized positions require crew + cash to reclaim, and reclaimed crew starts at half power.

### Phases

1. **Buildup** (up to 10 rounds): Simultaneous setup. Place crew, stack modifiers. Either player can strike early — Yuka fuzzy logic decides when.
2. **Combat** (5 actions/player/round): Simultaneous rounds, randomized initiative per action pair.

### Attack Types

- **Direct**: Crew power vs target defense. Kill or wound.
- **Funded**: Crew + offensive cash. Flip attempt — cash value vs target resistance + defensive cash. Affiliation modifies threshold (freelancers flip easy, same-affiliation easier).
- **Pushed**: Crew + offensive drug + offensive cash. Drug potency + cash vs defense, with splash damage to adjacent positions.

### Card Pools

| Pool | Count | Source |
|------|-------|--------|
| Crew | 100 (25 unlocked at start) | Generated from name pools + 12 archetypes + 10 affiliations |
| Weapons | 25 | Brass Knuckles, Switchblade, Crowbar, Machete, etc. |
| Products | 25 | Generated from adjective+noun (Purple Haze, Crystal Rush, etc.) |
| Cash | 7 denominations ($1-$1000) with varying copy counts | Fixed pool |

### Archetypes (12)

Bruiser (ignores precision), Snitch (reveals cards), Lookout (accesses reserves), Enforcer (double vs rivals), Ghost (attacks from reserves), Arsonist (splash damage), Shark (bonus vs weak), Fence (sacrifice=draw), Medic (double heal), Wheelman (swap vanguard), Hustler (steal cards), Sniper (target hand)

### Affiliations (10 + Freelance)

Kings Row, Iron Devils, Jade Dragon, Los Diablos, Southside Saints, The Reapers, Dead Rabbits, Neon Snakes, Black Market, Cobalt Syndicate. Each has at-war/at-peace relationships affecting funded flip thresholds and adjacency.

### AI

Yuka.js fuzzy logic (crewStrength, threatLevel, resourceLevel, danger → aggression, patience, desperation) driving a state machine (BUILDING, AGGRESSIVE, DEFENSIVE, DESPERATE) that sets action priorities per round.

## Tech Stack

| Concern | Library |
|---------|---------|
| UI | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| Game State | Koota ECS |
| AI | Yuka.js (FuzzyModule + StateMachine) |
| Animation | GSAP 3.x (Draggable, Timeline, FLIP) |
| Audio | Tone.js (music) + Howler.js (SFX) |
| Icons | Lucide React |
| Testing | Vitest + browser plugin |
| Validation | Zod |
| Lint | ESLint 9 + Prettier |

## Current State

### Done
- [x] GitHub repo created (arcade-cabinet/mean-streets, public)
- [x] Vite + React + TS project scaffolded
- [x] Koota, Yuka, Zod installed
- [x] JSON data pools: names, archetypes, affiliations, products, weapons
- [x] 100-card crew generator with seeded PRNG
- [x] 25 product cards (adjective+noun generator)
- [x] 25 weapon cards (all actual weapons)
- [x] Cash denomination system
- [x] Zod schemas for all card types
- [x] Yuka fuzzy logic AI with 11 rules
- [x] Yuka state machine (4 states)
- [x] Turf war game engine (buildup + combat phases)
- [x] 3 attack types (direct, funded, pushed)
- [x] Balance simulation runner with JSON reports
- [x] Seeded PRNG (Mulberry32) for reproducible games
- [x] Balance proven at 50/50 across 10k games

### Broken (Must Fix First)
- [ ] `src/sim/turf/game.ts` — references old API (stackCash, armCrew, p.hand.product/cash/weapon). Must rewrite to use `placeModifier()` and unified `hand.modifiers`/`modifierDraw`
- [ ] `src/sim/turf/ai-fuzzy.ts` — references p.hand.product/cashDraw/weaponDraw
- [ ] Run simulation to verify balance holds after the unified modifier refactor

### Phase 1: Fix Simulation Engine
- [ ] Rewrite game.ts for unified modifier system
- [ ] Update ai-fuzzy.ts for unified hand
- [ ] Run 10k balance test, verify 50/50
- [ ] Commit clean

### Phase 2: Project Foundation
- [ ] CI workflow (.github/workflows/ci.yml) — lint, typecheck, test, build on PRs
- [ ] CD workflow (.github/workflows/cd.yml) — deploy to GitHub Pages on push to main
- [ ] Enable GitHub Pages via gh api
- [ ] ESLint 9 + Prettier config
- [ ] Vitest config with browser plugin

### Phase 3: Game UI
- [ ] Card component (crew card with 6 modifier slots, power/resistance display)
- [ ] Quarter-card component (weapon/drug/cash with top/bottom orientation)
- [ ] Board layout (5 active + 5 reserve positions per player)
- [ ] Drag-and-drop via GSAP Draggable (place crew, stack modifiers, choose orientation)
- [ ] Deck builder screen (select 25 crew + 25 modifiers from collection)
- [ ] Game HUD (round counter, action budget, phase indicator)
- [ ] Attack resolution animations
- [ ] Win/loss screen
- [ ] SVG filters for gritty noir aesthetic

### Phase 4: Audio
- [ ] Tone.js ambient noir loop
- [ ] Howler.js SFX (card play, impact, seize, flip, bust)

### Phase 5: Meta-Progression
- [ ] Unlock system (earn crew/weapons/drugs through achievements)
- [ ] Collection screen (view all cards, locked/unlocked)
- [ ] Achievement tracking

### Phase 6: Documentation
- [ ] README.md (game overview, how to play, dev setup)
- [ ] CLAUDE.md (project-specific agent instructions)
- [ ] docs/ARCHITECTURE.md
- [ ] docs/DESIGN.md (this game design, expanded)
- [ ] docs/TESTING.md

### Phase 7: Governance
- [ ] .github/dependabot.yml
- [ ] .github/copilot-instructions.md
- [ ] CHANGELOG.md

## Security

No innerHTML, no unsafe HTML injection. All rendering through React JSX. Proper CSS files for animations. Strict CSP compatible.

## Data Files

```
src/data/
  pools/
    names.json          — Western/Eastern/Hispanic name pools + nicknames
    archetypes.json     — 12 archetypes with abilities
    affiliations.json   — 10 gangs + freelance with relationships
    products.json       — Drug adjective/noun pools + effects
    weapons.json        — 25 weapons with stats
  cards.json            — Generated 100-card crew pool
  gangs/                — Legacy gang deck JSON (deprecated)
```

## Simulation Engine

```
src/sim/
  turf/
    types.ts            — All game types (Position, PlayerState, Config, Metrics)
    board.ts            — Board management, placeModifier(), position power/defense
    attacks.ts          — Direct/funded/pushed attack resolution
    game.ts             — Game loop (NEEDS REWRITE for unified modifiers)
    generators.ts       — Product/cash/weapon card generators
    ai-fuzzy.ts         — Yuka FuzzyModule (NEEDS UPDATE for unified hand)
    ai-states.ts        — State machine (BUILDING/AGGRESSIVE/DEFENSIVE/DESPERATE)
    run.ts              — CLI runner, balance reporting
  cards/
    generator.ts        — 100-card crew generator
    schemas.ts          — Zod schemas
    rng.ts              — Seeded Mulberry32 PRNG
```

## Balance Targets

| Metric | Target | Last Measured |
|--------|--------|---------------|
| Win rate A/B | 45-55% | 50.2/49.8% |
| Stall rate | <5% | 0% |
| Pass rate | <20% | 0.9/game |
| Avg rounds | 12-20 | 14.3 |
| Seizure wins | >95% | 99.6% |
| All card types used | Yes | Yes |
