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

- Finish visible weapon, drug, and archetype ability resolution in the active runtime/sim path.
- Ensure the runtime app uses the same decision/state transitions as seeded simulation.

### 2. Mobile Productization

- Finish SQLite-backed profile, unlock, and active-run persistence.
- Make Continue real on top of persisted run state.
- Finalize native shell assets, metadata, and simulator/emulator smoke flows.

### 3. Responsive + Visual Finish

- Complete responsive layout adaptations for portrait, landscape, tablet, and fold-aware variants.
- Bring the final visual system fully in line with `public/poc.html`.
- Keep accessibility parity between drag/drop and tap-to-arm placement flows.

### 4. Release Governance

- Stabilize browser/E2E/native suites on top of the current async shell/persistence path.
- Drive the dev analysis layer until every balance-relevant card is in `locked` state.
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

## Product Completion

- Runtime visuals fully match the noir / black / dark-red direction from `public/poc.html`.
- All user-visible card rules are implemented in the active sim/runtime path.
- Continue/save/profile/unlock state are persisted through Capacitor SQLite.
- No product-critical path depends on localStorage.
- Touch interaction supports drag/drop and tap-to-arm/tap-to-place accessibility flow.
- Portrait, landscape, tablet, and fold-aware layouts are approved.

## Release Artifacts

- Seeded benchmark report
- Sweep report
- Lock report
- Replay-seed shortlist for outliers
- Native build instructions
- Store metadata, icons, and splash assets
