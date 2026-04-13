---
title: Claude Code Instructions
updated: 2026-04-13
status: current
---

# Mean Streets — Agent Instructions

## What This Is

A gritty tactical turf war card game. 25 crew + 25 modifiers per deck, 5v5 position seizure, simultaneous rounds, no dice. See `docs/DESIGN.md` for full game design and `docs/ARCHITECTURE.md` for technical architecture.

## Critical Rules

1. **The game design is LOCKED IN.** Do not reinvent mechanics. The PRD at `docs/plans/port-to-production.prq.md` is the source of truth.
2. **Balance is simulation-proven.** Any rule change must be validated with `npx tsx src/sim/turf/run.ts --games 10000` before committing.
3. **No dice, no coin flip.** Outcomes are deterministic. Only randomness is draw order.
4. **The simulation engine runs WITHOUT React.** Pure TypeScript, testable independently.

## Commands

```bash
npm run dev              # Vite dev server
npm run build            # Production build
npm run sim              # Balance simulation (default 3000 games)
npx tsx src/sim/turf/run.ts --games 10000  # Custom game count
npm run test             # Vitest
npm run lint             # ESLint
```

## Project Structure

- `src/sim/turf/` — Active game engine (types, board, attacks, game loop, AI)
- `src/sim/cards/` — Card generators, schemas, seeded PRNG
- `src/data/pools/` — JSON card data (names, archetypes, affiliations, products, weapons)
- `src/data/cards.json` — Generated 100-card crew pool
- `docs/` — Design doc, architecture, PRD
- `sim/reports/` — JSON balance reports from simulation runs

## Key Types

- `Position` — A street slot with crew + 6 quarter-card modifier slots (drugTop/Bottom, weaponTop/Bottom, cashLeft/Right)
- `PlayerState` — Board + crewDraw + modifierDraw (unified) + hand (crew + modifiers)
- `WeaponCard` — Has category (bladed/blunt/explosive/ranged/stealth), bonus, dual offense/defense abilities
- `ProductCard` — Has category (stimulant/sedative/hallucinogen/steroid/narcotic), potency, dual offense/defense abilities
- `CashCard` — Two denominations only: $100 or $1000
- `placeModifier(board, idx, card, 'offense'|'defense')` — Unified modifier placement
- `positionPower(pos)` — Effective attack (crew power + top weapon + top drug)
- `positionDefense(pos)` — Effective defense (crew resistance + bottom weapon + bottom drug)

## Known Issues

- Category abilities (LACERATE, PARRY, RUSH, etc.) are tracked on cards but not yet resolved in combat — attacks.ts uses raw bonus/potency values only. Full ability resolution is a future task.
- Archetype abilities (Bruiser OVERWHELM, Ghost PHANTOM_STRIKE, etc.) are partially implemented — only bruiser's precision-ignore is active.
