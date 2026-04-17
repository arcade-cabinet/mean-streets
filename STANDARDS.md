---
title: Standards
updated: 2026-04-17
status: current
domain: quality
---

# Mean Streets — Standards

Code quality, brand rules, and non-negotiable constraints. Testing strategy
lives in [docs/TESTING.md](./docs/TESTING.md). Architecture conventions live
in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Code Quality

### File Length

**300 LOC per file — hard limit.** No exceptions across any language or file
type (`.ts`, `.tsx`, `.mjs`, `.json` data files excluded). When a file
approaches the limit, decompose by responsibility before adding more.

### TypeScript

- Strict mode enforced via `tsconfig.json` (`"strict": true`).
- No `any`. No untyped function parameters. Explicit return types on exported
  functions.
- Discriminated unions preferred over `type | null` where the distinction
  carries semantic weight.
- The simulation engine (`src/sim/turf/`) must compile and run without React
  — no UI imports leak into it.

### Linting and Formatting

- **Biome**, not ESLint. `pnpm run lint` runs Biome checks.
- Biome config owns formatting rules. Do not add `.eslintrc` or Prettier
  config — they will conflict.
- CI fails on lint errors. Fix them before pushing.

### Dependencies

- **pnpm only.** Never create `package-lock.json` or `yarn.lock`. If one
  appears, delete it and add to `.gitignore`.
- Pin dependencies to exact versions in `package.json` for reproducible
  builds.

## Git Conventions

### Commit Messages

Conventional Commits — always:

```
feat:      new user-facing feature
fix:       bug fix
refactor:  internal restructure (no behavior change)
test:      test additions or changes
chore:     tooling, config, housekeeping
docs:      documentation only
perf:      performance improvement
ci:        CI/CD workflow changes
build:     build system changes
```

Scope is optional but encouraged: `feat(sim):`, `fix(ui):`, `test(e2e):`.

### Branch Policy

- Feature branches off `main`. PR to `main`. Squash merge.
- Branch: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`.
- No direct pushes to `main`.

## Balance Discipline

### No Dice, No Coin Flip

The game is deterministic. Randomness is **only** from:
- Deck draw order (seeded PRNG).
- Rolled rarity at pack open (seeded per pack).
- AI noise (difficulty-gated, seeded per match).
- Bribe success rolls (seeded, thresholds fixed in `turf-sim.json`).

**Any PR introducing `Math.random()` directly is blocked.** Use
`createRng(seed)` from `src/sim/cards/rng.ts`.

### Simulation Validation

Any rule change must pass the balance benchmark before merging:

```bash
pnpm run analysis:benchmark    # quick baseline
pnpm run test:release          # release gate (lock coverage + convergence)
```

Changes to `src/sim/turf/` that shift thresholds must update
`src/data/ai/turf-sim.json` — not hardcoded constants. See
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full balance pipeline.

## Card Art Style

### Geometric SVG Placeholders

Current mythic art is intentional geometric SVG placeholders with a shared
**gold-ring treatment** (`public/assets/mythics/`). They share the
`AffiliationSymbol` / `MythicSymbol` gold ring motif from
`src/ui/affiliations/`.

- Do not replace placeholders with rasterized art during development.
- The editorial illustration pass is a post-v0.3 task (tracked in
  [docs/PRODUCTION.md](./docs/PRODUCTION.md)).
- All SVG art uses the noir filter system (`src/ui/filters/GrittyFilters`)
  for the gritty visual treatment.

### Rarity Border Colors

| Rolled Rarity | Border Color |
|---------------|-------------|
| Common        | Grey         |
| Uncommon      | Blue         |
| Rare          | Gold         |
| Legendary     | Red          |
| Mythic        | Custom (card-specific, gold-ring) |

### Tone

Cards are named characters with gang affiliations, archetypes, and taglines.
Tone is **noir, street-level**. No glamorization of violence. Taglines are
terse — one sentence max. See [docs/LORE.md](./docs/LORE.md) for voice
guidance.

## Testing Standards

See [docs/TESTING.md](./docs/TESTING.md) for the full strategy, coverage
goals, and how to run each suite.

The short version:
- Write the test before writing the implementation.
- Node tests for sim logic. DOM tests for presentational React. Browser tests
  for anything that touches real browser APIs. E2E for full user flows.
- Stale tests are worse than no tests — update them when you change behavior.
- Visual screenshots must be reviewed for correctness, not just for
  "it renders."
