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

### Type Check

```bash
pnpm run typecheck
```

Runs the referenced TypeScript projects in build mode (`app`, `node`, and
`sim`) so CI catches drift in `tsconfig.sim.json` and the other split configs.

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

### E2E Tests

```bash
pnpm run test:e2e      # desktop smoke flow
pnpm run test:e2e:full # full local suite
```

Environment: Playwright against the running dev server
(`playwright.config.ts`). Tests in `e2e/*.spec.ts`.

`pnpm run test:e2e` is the deploy-safe smoke lane used by CI/CD under
`xvfb-run`. It runs only `e2e/app-flow.spec.ts` on `desktop-chromium`.

`pnpm run test:e2e:full` is intentionally split for local release review:
- `test:e2e:core` runs the normal parallel Playwright batch.
- `test:e2e:visual` runs the dedicated visual-capture script
  (`scripts/capture-visual-fixtures.mjs`), which drives Playwright's raw
  browser API directly against the same fixture routes.
- `e2e/visual-fixtures.spec.ts` is now opt-in only
  (`MEAN_STREETS_VISUAL_SPECS=1`) as a fixture-route smoke test; screenshot
  capture lives in `scripts/capture-visual-fixtures.mjs`.
- `test:e2e:governor` runs the long-form `@governor` full-game suite
  separately on `desktop-chromium` with `--workers=1`.

That separation keeps CI/CD on a bounded smoke signal while preserving the
long-lived AI-turn timers and high-memory fixture screenshots for explicit local
full-suite runs.

The harness owns its own dedicated Vite port (`41739`) so it does not
silently attach to another local workspace that happens to already be on
the default preview/dev ports. If you explicitly want to reuse an already
running Mean Streets dev server on that port, set `PW_REUSE_SERVER=1`.

Four device profiles:
- `desktop-chromium` — 1280×720
- `iphone-14` — 390×844
- `pixel-7` — 412×915
- `ipad-pro-landscape` — 1366×1024

Current specs: `app-flow`, `accessibility`, `difficulty-grid`, `pack-opening`,
`war-outcome`, `responsive-alignment`, `visual-fixtures`,
`layout-classification`, `fold-posture`.

### Visual Fixture Capture

```bash
pnpm run test:visual
```

Captures screenshots of UI components for review. Review instructions in
[VISUAL_REVIEW.md](./VISUAL_REVIEW.md).

This uses `scripts/capture-visual-fixtures.mjs`, which launches a headless
Playwright Chromium session directly when `PW_HEADLESS=1`. The default
`pnpm run test:visual` script runs it headed for interactive review; use
`pnpm run test:visual:headless` or set `PW_HEADLESS=1` to capture without a
display. The capture script still covers each fixture root across all four
device profiles.

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

### Slow Analysis Sweep

```bash
pnpm run test:analysis:slow
```

Runs the full sim-backed curated sweep in
`src/sim/analysis/__tests__/analysis.test.ts` with `RUN_SLOW_TESTS=1`.
This lane is intentionally split out of the default PR test matrix so it can
run nightly in its own workflow without slowing every pull request.

## Release Gate

```bash
pnpm run test:release
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

The release gate is skipped unless `RELEASE_GATING=1`. CI's `ci.yml`
core job runs it on every pull request.

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
- E2E: at least one Playwright spec per shipped screen or fixture surface.
  Live app routes should be covered through real navigation flows; fixture-only
  surfaces such as `pack-opening` may be covered through explicit `?fixture=`
  routes instead.
- Balance: 70% lock coverage before release; 100% post-launch (weekly cron).

### Integration Smoke

`src/sim/turf/__tests__/v03-integration.test.ts` contains the v0.3 integration
suite and is active in the node test run. Keep it green when changing
cross-module sim behavior.

### Visual Verification

After any UI change, run `pnpm run test:visual`, capture screenshots, and
review them for both correctness and visual polish — not just "does it render."
See [VISUAL_REVIEW.md](./VISUAL_REVIEW.md) for the review checklist.
