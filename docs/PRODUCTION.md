---
title: Production Checklist
updated: 2026-04-13
status: current
domain: release
---

# Production Checklist

## Source Of Truth

- `docs/DESIGN.md` defines the locked gameplay rules.
- `docs/ARCHITECTURE.md` defines the active technical stack.
- This document is the single execution tracker for remaining production work.

## Remaining Work

### 1. Rules Completion

- Replace the loose modifier draw model with the backpack / runner rules now defined in `docs/DESIGN.md`.
- Rebase deckbuilding, buildup, combat, and simulation on backpack kits as the only coherent modifier delivery path.
- Satisfy the runner opening contract from `docs/DESIGN.md` without breaking the seeded benchmark envelope. Current diagnostics show the stable AI misses the reserve-start stage completely.
- Finish visible weapon, drug, and archetype ability resolution in the active runtime/sim path.
- Ensure the runtime app uses the same decision/state transitions as seeded simulation.

### 2. Mobile Productization

- Finish SQLite-backed profile, unlock, and active-run persistence.
- Make Continue real on top of persisted run state.
- Finalize native shell assets, metadata, and simulator/emulator smoke flows.

### 3. Responsive + Visual Finish

- Complete responsive layout adaptations for portrait, landscape, tablet, and fold-aware variants.
- Bring the final visual system fully in line with `public/poc.html`.
- Use the exported screenshot workflow in `docs/VISUAL_REVIEW.md` to review menu, garage, deckbuilder, buildup, and combat captures against the POC before approving final polish.
- Keep accessibility parity between drag/drop and tap-to-arm placement flows.

### 4. Release Governance

- Stabilize browser/E2E/native suites on top of the current async shell/persistence path.
- Drive the dev analysis layer until every balance-relevant card is in `locked` state.
- Keep benchmark, sweep, and lock reports aligned to the runner economy by tracking reserve placements, backpack equips, runner deployments, and payload deployments alongside attack-family metrics.
- Treat runner opening contract diagnostics as release-facing evidence:
  - overall runner opportunity use rate
  - reserve-start use rate
  - stage-level misses
- Keep generated reports and native/test artifacts out of source control.

## Release Blockers

- `pnpm run build` is green.
- `pnpm run test:node` is green.
- `pnpm run test:dom` is green.
- Browser and E2E suites are green across responsive targets.
- Native Android and iOS Capacitor projects sync and boot.
- Maestro smoke flows pass on at least one Android and one iOS simulator/emulator.
- `pnpm run test:release` is green.
- All balance-relevant cards are in `locked` state from the analysis layer.
- Runner opening contract is no longer failing at reserve start under the accepted release benchmark profile.

## Product Completion

- Runtime visuals fully match the noir / black / dark-red direction from `public/poc.html`.
- Runtime rule model uses backpacks/runners instead of loose quarter-card draws.
- All user-visible card rules are implemented in the active sim/runtime path.
- Continue/save/profile/unlock state are persisted through Capacitor SQLite.
- No product-critical path depends on localStorage.
- Touch interaction supports drag/drop and tap-to-arm/tap-to-place accessibility flow.
- Portrait, landscape, tablet, and fold-aware layouts are approved.

## Release Artifacts

- Seeded benchmark report
- Sweep report
- Lock report
  Includes `summary.totalCards`, state counts, and `summary.runnerReserveStartRiskCards`
- Progress sidecars for long-running focus/lock analysis
  `sim/reports/analysis/focus/*.progress.json` and `sim/reports/analysis/locks/*.progress.json`
- Runner-economy summary inside benchmark/sweep artifacts
- Runner opening contract summary with reserve/equip/deploy/payload stage usage
- Replay-seed shortlist for outliers
- Native build instructions
- Store metadata, icons, and splash assets
