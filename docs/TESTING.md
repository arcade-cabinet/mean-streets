---
title: Testing
updated: 2026-04-17
status: current
domain: quality
---

# Mean Streets — Testing

This document owns the testing strategy, coverage goals, and how to run each
suite. Code quality rules live in [../STANDARDS.md](../STANDARDS.md).
Architecture context lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Test Suites

### Node Tests — Pure Sim Logic

```bash
pnpm run test:node
```

Environment: Node (no browser, no DOM). Tests in `src/**/__tests__/*.test.ts`.

Covers: simulation engine (`src/sim/turf/`), ECS actions, card compilation,
pack generation, AI planner, balance analysis. The sim must run without React —
any test that imports a UI component is in the wrong file.

Current test files:
- `turf-progression`, `damage`, `heat`, `market`, `holding`, `mythic`,
  `victory-rating`, `resolve`, `retreat`, `closed-ranks`, `drawing`,
  `simulation-benchmarks`, `sweep`, `curated-sweep`

### DOM Tests — Presentational Components

```bash
pnpm run test:dom
```

Environment: jsdom (`vitest.dom.config.ts`). Tests in
`src/**/__tests__/*.dom.test.tsx`.

Covers: React components that don't need real browser APIs.

Do NOT import in DOM tests: Capacitor plugins, `jeep-sqlite`, Web Workers,
or anything that requires a real browser environment. Move those to
`.browser.test.tsx`.

### Browser Tests — Real Chromium

```bash
pnpm run test:browser
```

Environment: Vitest + `@vitest/browser-playwright` running real Chromium.
Tests in `src/**/__tests__/*.browser.test.tsx`.

Use `renderInBrowser` from `src/test/render-browser.tsx`. This sets
`window.__MEAN_STREETS_TEST__ = true` so `AppShellProvider` skips native
shell configuration.

Current test files: `StackFanModal.browser.test.tsx`,
`TurfCompositeCard.browser.test.tsx`, and the core component suite.

### E2E Tests — Full Application Flows

```bash
pnpm run test:e2e
```

Environment: Playwright against the running dev server
(`playwright.config.ts`). Tests in `e2e/*.spec.ts`.

Four device profiles:
- `desktop-chromium` — 1280×720
- `iphone-14` — 390×844
- `pixel-7` — 412×915
- `ipad-pro-landscape` — 1366×1024

Current specs: `app-flow`, `accessibility`, `difficulty-grid`, `pack-opening`,
`responsive-alignment`, `visual-fixtures`, `layout-classification`,
`fold-posture`.

### Visual Fixture Capture

```bash
pnpm run test:visual
```

Captures screenshots of UI components for review. Review instructions in
[VISUAL_REVIEW.md](./VISUAL_REVIEW.md).

### Combined

```bash
pnpm run test        # node + DOM (fast, runs in CI on every PR)
```

## Balance Benchmarks

### Quick Baseline

```bash
pnpm run analysis:benchmark
```

Runs seeded AI-vs-AI games and produces a benchmark summary. Reports saved to
`sim/reports/analysis/`. Use this after any sim rule change.

### Curated Sweep + Lock Pass

```bash
pnpm run analysis:lock          # read-only sweep + lock recommendations
pnpm run analysis:lock:persist  # same, but writes sim/reports/turf/balance-history.json
```

The curated sweep forces individual cards into seeded runs to measure their
per-card winrate delta. Results feed the lock lifecycle — cards with stable
winrate delta are promoted to `locked`.

Timeout: the curated sweep suite has a 600s timeout to accommodate CI runner
pace.

## Release Gate

```bash
pnpm run test:release    # requires RELEASE_GATING=1 (set automatically)
```

The release gate (`src/sim/turf/__tests__/release-gate.test.ts`) runs three
checks:

1. **Lock coverage**: at least 70% of balance catalog cards must be in
   `locked` state. Reads from `sim/reports/turf/balance-history.json`.

2. **Benchmark thresholds**: `ci-release` profile (1000 games) must land
   within the configured bands in `turf-sim.json` for winrate, timeout rate,
   median turns, action mix, and first-mover rate.

3. **Convergence**: winrate across 3 consecutive seeded `ci` runs must all
   fall in the [0.45, 0.65] band. Checked with `checkConvergence()` from
   `src/sim/analysis/benchmarks.ts`.

The release gate is skipped unless `RELEASE_GATING=1`. CI's `cd.yml`
(deploy-to-Pages) runs it unconditionally before building.

### Passing the Release Gate

If coverage is below 70%:
```bash
pnpm run analysis:lock:persist   # accumulate samples
# repeat until coverage >= 70%
```

If convergence fails:
```bash
pnpm run analysis:autobalance    # iterative stat tuning loop
```

## Testing Conventions

### File Naming

| Suffix | Environment | Import rules |
|--------|-------------|-------------|
| `.test.ts` | Node | No React, no browser APIs |
| `.test.tsx` | Node | React/TSX allowed, no browser APIs |
| `.dom.test.tsx` | jsdom | No Capacitor, no jeep-sqlite |
| `.browser.test.tsx` | Real Chromium | Use `renderInBrowser` |
| `.spec.ts` (e2e/) | Playwright | Full app, 4 device profiles |

### Coverage Goals

- Sim engine (`src/sim/turf/`): every public function covered by node tests.
- UI components: DOM tests for render smoke + prop variance; browser tests for
  interaction.
- E2E: at least one full-flow spec per screen (menu → difficulty → game →
  gameover → collection → card-garage → pack-opening).
- Balance: 70% lock coverage before release; 100% post-launch (weekly cron).

### Integration Smoke

`src/sim/turf/__tests__/v03-integration.test.ts` contains the v0.3 integration
suite, currently `describe.skip`-gated. Promote to active as modules stabilize
(tracked in [PRODUCTION.md](./PRODUCTION.md)).

### Visual Verification

After any UI change, run `pnpm run test:visual`, capture screenshots, and
review them for both correctness and visual polish — not just "does it render."
See [VISUAL_REVIEW.md](./VISUAL_REVIEW.md) for the review checklist.
