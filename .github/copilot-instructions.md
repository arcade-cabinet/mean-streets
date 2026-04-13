# Mean Streets Copilot Instructions

## Source Of Truth

- Gameplay rules: `docs/DESIGN.md`
- Technical architecture: `docs/ARCHITECTURE.md`
- Release checklist and remaining work: `docs/PRODUCTION.md`

## Project Expectations

- This is a deterministic turf-war card game. No dice, coin flips, or mid-game randomness outside seeded draw order.
- The active engine is `src/sim/turf/`. Legacy engine code under `src/sim/engine/` is deprecated and must not be treated as production authority.
- Balancing and release gating live in `src/sim/analysis/`.
- Mobile app stores are the release target. Web is the primary development and testing surface.
- Product persistence is SQLite-backed through the Capacitor layer. Do not add localStorage as a product backend.

## Tooling

- Package manager: `pnpm`
- Lint/format: `biome`
- Native shell: `capacitor`
- Browser automation: `playwright`
- Native smoke automation: `maestro`

## Required Verification

- `pnpm run build`
- `pnpm run test:node`
- `pnpm run test:dom`
- Relevant browser/E2E/native checks for the area being changed

## Release Rule

Do not treat the game as release-ready until:

- `pnpm run test:release` is green
- browser/E2E/native smoke surfaces are green
- visuals align with `public/poc.html`
- all balance-relevant cards are locked by the analysis layer
