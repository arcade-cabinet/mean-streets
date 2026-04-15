---
title: Mean Streets
updated: 2026-04-15
status: current
---

# Mean Streets: Turf War

A gritty tactical turf-war card game built for mobile-first release. You run a street crew, arm your fighters, push product, and seize enemy territory through deterministic stack-based combat rather than dice rolls.

## Production Shape

- **Primary targets**: iOS and Android via Capacitor
- **Web role**: development, simulation, responsive QA, and browser automation
- **Persistence**: Capacitor SQLite on native and web OPFS
- **Release gate**: seeded simulation benchmarks plus lock-state analysis for every balance-relevant card

## How It Works

Two players each bring a **50-card deck**: 25 toughs and 25 modifiers (weapons, drugs, currency) shuffled together. Win by seizing all of your opponent's turfs.

- **Toughs**: named fighters with Power and Resistance, gang affiliation, and archetype identity
- **Weapons**: bladed, blunt, explosive, ranged, or stealth — add power and resistance to turfs
- **Drugs**: stimulant, sedative, hallucinogen, steroid, or narcotic — add power and resistance to turfs
- **Currency**: $100 bills and $1000 stacks — fuel pushed strikes and funded recruits

## The Board

Each player has N turfs (varies by difficulty: 5 for Easy, down to 1 for Sudden Death). Turfs are open-ended stacks of cards. You play toughs and modifiers onto turfs, building up their aggregate power and resistance.

## Combat

There is no buildup phase. Combat begins on turn 1:

- **Play card**: place a tough or modifier from hand onto a turf
- **Direct strike**: your turf's power vs. opponent turf's resistance (kill, sick, or bust)
- **Pushed strike**: spend currency for bonus power + sick effect on kill
- **Funded recruit**: spend currency to recruit away opponent's top tough
- **Discard**: free action, remove card from hand
- **End turn**: free action, switch to opponent's turn
- **Pass**: costs an action, does nothing

3-5 actions per turn depending on difficulty. Draw one card per turn. When all toughs on a turf are killed or recruited, the turf is seized. Lose all turfs and you lose the match.

## Development

```bash
pnpm install
pnpm run dev          # Vite dev server
pnpm run build        # Production build (tsc + vite)
pnpm run lint         # Biome
pnpm run test         # Node + DOM unit tests (281 tests)
pnpm run test:browser # Real Chromium tests (20 tests)
pnpm run test:e2e     # Playwright across 4 device profiles (111 tests)
pnpm run analysis:benchmark   # Balance benchmark
pnpm run analysis:lock:persist # Lock state persistence
pnpm run cap:sync     # Build + sync to Capacitor
```

## Tech Stack

React 19, TypeScript 6, Vite 8, Koota ECS, Yuka.js AI, Capacitor 8, SQLite, Zod 4, GSAP, Howler, Tone, Vitest, Playwright, Maestro, Biome

## Project Structure

```
config/
  raw/cards/           # Authored per-card JSON (100 toughs, 50 weapons, 50 drugs, 2 currency)
  compiled/            # Build-time outputs (gitignored)
src/
  sim/turf/            # Game engine: types, board, attacks, environment, game, AI
  sim/cards/           # Zod schemas, compile transforms, catalog loaders, seeded PRNG
  sim/packs/           # Pack generator, rarity stamping, starter grant, match rewards
  sim/analysis/        # Dev-only: benchmark, sweep, lock, autobalance
  ecs/                 # Koota ECS bridge (traits, actions, hooks)
  ui/                  # React screens and components
  platform/            # Capacitor shell, device, SQLite persistence, collection
  data/                # Game tunables (turf-sim.json), affiliation graph
e2e/                   # Playwright specs (9 spec files, 4 device profiles)
docs/                  # Design, rules, architecture, production, visual review
```

## Source of Truth

- [docs/DESIGN.md](./docs/DESIGN.md) — vision and identity
- [docs/RULES.md](./docs/RULES.md) — authoritative gameplay mechanics
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — technical architecture
- [docs/PRODUCTION.md](./docs/PRODUCTION.md) — release checklist + implementation status
- [docs/VISUAL_REVIEW.md](./docs/VISUAL_REVIEW.md) — visual review workflow

## License

TBD
