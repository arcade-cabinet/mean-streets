---
title: Mean Streets
updated: 2026-04-13
status: current
---

# Mean Streets: Turf War

A gritty tactical turf-war card game built for mobile-first release. You run a street crew, push product, arm your fighters, and seize enemy territory through deterministic position control rather than dice rolls.

## Production Shape

- **Primary targets**: iOS and Android via Capacitor
- **Web role**: development, simulation, responsive QA, and browser automation
- **Persistence**: Capacitor SQLite on native and web OPFS
- **Release gate**: seeded simulation benchmarks plus lock-state analysis for every balance-relevant card
- **Runner contract**: lock reports now surface reserve-start runner regressions explicitly

## How It Works

Two players each bring a **crew deck plus a payload economy**: 25 full-size crew cards, staged runner kits, and attached quarter-card payload on the board. Win by seizing all 5 of your opponent's street positions.

- **Crew**: named fighters with Power and Resistance, gang affiliation, and archetype identity
- **Backpacks**: full cards equipped to reserve crew, turning them into runners
- **Weapons / Drugs / Cash**: attached quarter-card payload dispensed from backpacks onto the board

## The Board

Each player has 5 active street positions and 5 reserve positions. You place crew, stack modifiers, and attack from your active positions.

## Phase Flow

1. **Buildup** (up to 10 rounds) — Both players build simultaneously. Place crew, stage reserve runners, equip backpacks, and unpack payload. Either can strike early to start combat.
2. **Combat** (5 actions per round) — Simultaneous rounds. Attack, place crew, stack modifiers, reclaim seized positions.
3. **Game Over** — Win by seizing all 5 opposing active positions.

## Development

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run test
pnpm run test:browser
pnpm run test:e2e
pnpm run test:e2e:smoke
pnpm run test:visual
pnpm run visual:export
pnpm run analysis:benchmark
pnpm run analysis:sweep
pnpm run analysis:lock:quick
pnpm run analysis:lock
pnpm run cap:sync
```

## Tech Stack

React 19, TypeScript, Vite 8, Koota ECS, Yuka.js AI, Capacitor 8, Capacitor SQLite, GSAP, Howler, Tone, Vitest, Playwright, Maestro, Zod

## Project Structure

```
src/
  platform/            # Capacitor shell, layout/device services, SQLite persistence
  sim/
    turf/              # Active game engine
    analysis/          # Dev-only balancing and lock-state tooling
    cards/             # Authored crew loader, legacy generators, seeded PRNG, schemas
  ui/                  # Production React UI
docs/
  DESIGN.md            # Locked gameplay design
  ARCHITECTURE.md      # Technical architecture
  PRODUCTION.md        # Release checklist and remaining work
```

## Source Of Truth

- [docs/DESIGN.md](/Users/jbogaty/src/arcade-cabinet/mean-streets/docs/DESIGN.md)
- [docs/ARCHITECTURE.md](/Users/jbogaty/src/arcade-cabinet/mean-streets/docs/ARCHITECTURE.md)
- [docs/PRODUCTION.md](/Users/jbogaty/src/arcade-cabinet/mean-streets/docs/PRODUCTION.md)
- [docs/VISUAL_REVIEW.md](/Users/jbogaty/src/arcade-cabinet/mean-streets/docs/VISUAL_REVIEW.md)

## Analysis Output

- `analysis:benchmark` writes seeded benchmark reports with runner opening contract rates.
- `analysis:sweep` writes curated forced-permutation sweeps.
- `analysis:focus` drills into selected card ids across the curated sweep set.
- Long-running `analysis:focus` and `analysis:lock` runs now write `.progress.json` sidecars under `sim/reports/analysis/` so heavy standard/release profiles can be monitored while they execute.
- `analysis:lock:quick` is the fast triage lane for lock-state and reserve-start runner regressions.
- Quick-profile `volatility-only` unstable cards are review candidates, not automatic rebalance targets; confirm them with `analysis:focus --profile standard`.
- `analysis:lock` writes benchmark, effects, lock recommendations, and a compact summary that flags cards which regress reserve-start runner usage, and prints that summary to stdout.

## License

TBD
