---
title: Production Checklist
updated: 2026-04-14
status: current
domain: release
---

# Production Checklist

This document owns **release readiness**. It is the single tracker for
what blocks the game from shipping, what platforms it targets, and where
each system sits on the path to launch. Vision lives in
[DESIGN.md](./DESIGN.md), mechanics in [RULES.md](./RULES.md), tech in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Release Targets

| Target       | Requirement                                        |
|--------------|----------------------------------------------------|
| Web          | Primary development, simulation, and QA surface    |
| Android      | Store-ready Capacitor build                        |
| iOS          | Store-ready Capacitor build                        |
| Persistence  | Capacitor SQLite, shared web ↔ native              |
| Accessibility| Pointer drag/drop **and** tap-to-arm / tap-to-place|
| Layout       | Portrait, landscape, tablet, fold-aware            |

## Implementation Status

Tracks every system named in the other docs. When `Status` is anything
other than `Ready`, the release is blocked.

### Rules Engine

| System                                | Status         |
|---------------------------------------|----------------|
| Turf war simulation (buildup + combat)| Ready          |
| Seeded draw order, deterministic      | Ready          |
| 3 attack types (direct/funded/pushed) | Ready          |
| Per-category weapon abilities         | Partial (stats resolved, ability text not yet enforced in combat) |
| Per-category drug abilities           | Partial        |
| Archetype abilities                   | Partial (only Bruiser precision-ignore active) |
| Backpack as mechanical container      | Pending refactor (currently 30 authored kits) |
| Runner free-swap                      | Partial (sim engine only, UI work pending) |
| Pocket vs backpack-gated slot model   | Pending slot rename (see RULES §2) |
| Seizure transfers backpack + payload  | Pending        |
| Empty-backpack pickup / redistribution| Pending        |

### Authoring And Tuning

| System                                | Status         |
|---------------------------------------|----------------|
| Tough cards authored as per-card files| In progress (Task 19 done)|
| Weapons authored as per-card files    | In progress (Task 20 done)|
| Drugs authored as per-card files      | In progress (Task 20 done)|
| special.json for backpack + cash      | Pending        |
| Zod schema with tuning-history arrays | Pending (Task 22)|
| raw/ → compiled/ build step           | Pending (Task 23)|
| Autobalance loop with auto-commit     | Pending (Task 24)|
| Runtime loaders read compiled output  | Pending (Task 25)|
| Achievement-driven unlocks            | Pending (creative pass)|

### UI / UX

| System                                | Status         |
|---------------------------------------|----------------|
| Screen router (menu → game-over)      | Ready          |
| Drag-and-drop + tap-to-arm            | Ready          |
| Gritty noir SVG filter system         | Ready          |
| Responsive layouts (portrait/tablet)  | In progress    |
| Visual system vs `public/poc.html`    | In progress    |
| Runner symbol overlay on toughs       | Pending        |
| Pocket vs backpack-gated slot visuals | Pending        |

### Platform / Mobile

| System                                | Status         |
|---------------------------------------|----------------|
| Capacitor app shell (Android + iOS)   | In progress    |
| SQLite profile + unlock persistence   | In progress    |
| Continue / load-game on saved state   | In progress    |
| Native icons / splash / store metadata| In progress    |
| Maestro smoke flows                   | In progress    |

### CI / Release Governance

| System                                | Status         |
|---------------------------------------|----------------|
| CI: lint + typecheck + test:node+dom  | Ready          |
| CI: browser tests + e2e (4 profiles)  | Ready          |
| CI: release gate (coverage ≥ 70%)     | Ready          |
| CD: deploy to GitHub Pages            | Ready          |
| Release benchmark profile             | Ready          |
| Lock coverage ≥ 70% in balance-history| Ready (75% current)|
| Lock coverage = 100%                  | Pending autobalance loop|
| Runner opening contract satisfied     | Failing (sim diagnostics show reserve-start misses)|
| Concurrency guard on Pages deploy     | Ready          |

## Release Blockers

These are all required for a store-ready launch:

- [x] `pnpm run build` green
- [x] `pnpm run test` (node + DOM) green
- [x] `pnpm run test:browser` green
- [x] `pnpm run test:e2e` green across all four device profiles
- [x] `pnpm run test:release` green (currently 75% lock coverage)
- [ ] 100% of the balance catalog in `locked` state
- [ ] Backpack / runner refactor complete (see RULES §6–7)
- [ ] Runner opening contract no longer fails at reserve-start
- [ ] Visible weapon / drug / archetype abilities fully resolved in combat
- [ ] SQLite profile + unlock persistence working end-to-end
- [ ] Continue / load-game functional on persisted state
- [ ] No product path depends on localStorage
- [ ] Runtime visuals match `public/poc.html` direction
- [ ] Native Android + iOS Capacitor projects sync, boot, and pass Maestro smoke
- [ ] Touch UX supports drag/drop **and** tap-to-arm / tap-to-place
- [ ] Portrait / landscape / tablet / fold-aware layouts approved

## Release Artifacts

Each release ships with:

- Seeded benchmark report (`sim/reports/analysis/benchmarks/`)
- Sweep report (`sim/reports/analysis/sweeps/`)
- Lock report with `summary.totalCards`, state counts, and
  `summary.runnerReserveStartRiskCards`
- Progress sidecars for long-running focus/lock analysis
  (`*.progress.json`)
- Runner-economy summary inside benchmark/sweep artifacts
- Runner opening contract summary with reserve/equip/deploy/payload
  stage usage
- Replay-seed shortlist for outliers
- Native build notes, store metadata, icons, splash assets

## Ship / Re-tune Policy

Once a card is shipped in `locked` state, its stats never change. Future
balance work ships as **net-new expansions** (additional cards, not
revisions). This is the Brawl Stars model: every shipped identity stays
authoritative.
