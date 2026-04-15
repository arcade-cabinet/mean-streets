---
title: Production Checklist
updated: 2026-04-15
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
| Persistence  | Capacitor SQLite, shared web (OPFS) and native     |
| Accessibility| Tap-to-arm / tap-to-place + keyboard navigation    |
| Layout       | Portrait, landscape, tablet, fold-aware            |

## Implementation Status

Tracks every system named in the other docs. When `Status` is anything
other than `Ready`, the release is blocked.

### Rules Engine (v0.2 Stack Redesign)

| System                                | Status         |
|---------------------------------------|----------------|
| Stack-based turf model (no named slots)| Ready         |
| Seeded draw order, deterministic      | Ready          |
| 3 strike types (direct/pushed/funded recruit)| Ready   |
| Draw-gate (modifiers require tough in play)| Ready     |
| Affiliation conflict (rival graph + currency buffer + mediator)| Ready |
| Seizure (last tough killed → turf seized)| Ready       |
| 6 difficulty tiers with turf/action scaling| Ready     |
| Sudden death toggle                   | Ready          |
| Free actions (discard, end_turn cost 0)| Ready         |
| Per-category weapon abilities (5 categories)| Partial (tracked on cards, not resolved in combat) |
| Per-category drug abilities (5 categories)| Partial (tracked on cards, not resolved in combat) |
| Archetype abilities (12)              | Partial (shark/ghost targeting active, bruiser precision-ignore active, others tracked but not resolved) |

### Card System

| System                                | Status         |
|---------------------------------------|----------------|
| Tough cards authored as per-card files| Ready (100 files) |
| Weapons authored as per-card files    | Ready (50 files) |
| Drugs authored as per-card files      | Ready (50 files) |
| Currency cards (2: $100, $1000)       | Ready          |
| Zod schemas with tuning-history arrays| Ready (Authored* + Compiled* schemas) |
| raw/ → compiled/ build step           | Ready (compile-cards.mjs, 4 categories) |
| Autobalance loop with auto-commit     | Ready (plus saturation cap + convergence check) |
| Runtime loaders read compiled output  | Ready          |
| Pack generator (rarity stamping 70/25/5)| Ready        |
| Collection persistence (unlockedCardIds)| Ready        |
| Starter collection grant              | Ready          |
| Match reward packs (per-difficulty)   | Ready          |

### AI

| System                                | Status         |
|---------------------------------------|----------------|
| Yuka GOAP planner (5 goals)           | Ready          |
| Fuzzy logic context (aggression/patience/desperation)| Ready |
| Difficulty-gated policy (top-K + noise)| Ready (6 tiers) |
| All v0.2 action kinds scored          | Ready          |
| AI memory (goal switching heuristics) | Ready          |

### UI / UX

| System                                | Status         |
|---------------------------------------|----------------|
| Screen flow (menu → difficulty → game → gameover)| Ready |
| Card component (unified MTG-style, 4 kinds)| Ready    |
| TurfView + TurfCompositeCard          | Ready          |
| StackFanModal (carousel per-card inspection)| Ready   |
| AffiliationSymbol (per-affiliation SVG + glow)| Ready |
| DifficultyScreen (2x3 grid, 6 tiers) | Ready          |
| CollectionScreen (category + rarity filters)| Ready   |
| PackOpeningScreen (sealed → reveal → summary)| Ready  |
| GameScreen (action menu + strike interaction)| Ready  |
| Responsive layouts (4 device profiles)| Ready          |
| Gritty noir SVG filter system         | Ready          |
| Accessibility (tap-only + landmark)   | Ready          |
| Visual polish (designer pass)         | Pending        |

### Platform / Mobile

| System                                | Status         |
|---------------------------------------|----------------|
| Capacitor app shell (Android + iOS)   | Ready          |
| SQLite profile + unlock persistence   | Ready          |
| Continue / load-game on saved state   | Ready          |
| Native icons (Android + iOS)          | Ready          |
| Splash screen                         | Partial (background color set; custom splash art pending) |
| Store listing metadata                | Partial (needs final copy + screenshots) |
| Maestro smoke flows                   | Ready          |
| Mobile release workflow (AAB + IPA)   | Ready          |

### Testing

| System                                | Status         |
|---------------------------------------|----------------|
| Node tests (sim engine, pure logic)   | Ready (182 tests, 15 files) |
| DOM tests (jsdom, presentational)     | Ready (99 tests, 8 files) |
| Browser tests (real Chromium)         | Ready (20 tests, 4 files) |
| E2E tests (Playwright, 4 profiles)   | Ready (111 passed across 9 specs) |
| Release gate (lock coverage >= 70%)   | Ready          |

### CI / Release Governance

| System                                | Status         |
|---------------------------------------|----------------|
| CI: lint + typecheck + test:node+dom  | Ready          |
| CI: browser tests + e2e (4 profiles)  | Ready          |
| CI: release gate (coverage >= 70%)    | Ready          |
| CD: deploy to GitHub Pages            | Ready          |
| Release benchmark profile             | Ready          |
| Lock coverage >= 70% in balance-history| Ready         |
| Lock coverage = 100%                  | Tracked via weekly cron autobalance |
| Concurrency guard on Pages deploy     | Ready          |

## Release Blockers

These are all required for a store-ready launch:

- [x] `pnpm run build` green
- [x] `pnpm run test` (node + DOM) green — 281 tests
- [x] `pnpm run test:browser` green — 20 tests
- [x] `pnpm run test:e2e` green — 111 tests across 4 device profiles
- [x] `pnpm run test:release` green (70% lock coverage floor)
- [ ] 100% of the balance catalog in `locked` state (weekly cron drives this)
- [ ] Category abilities fully resolved in combat (weapons + drugs)
- [ ] Remaining archetype abilities resolved in combat
- [ ] Runtime visuals match design direction (designer pass)
- [ ] Maestro smoke flows executed on physical devices
- [ ] Designer sign-off on visual polish
- [ ] Writer sign-off on lore + achievement copy
- [ ] Store metadata finalized
- [ ] Signing keys in repo secrets
- [ ] Physical device QA sign-off

## Release Artifacts

Each release ships with:

- Seeded benchmark report (`sim/reports/analysis/benchmarks/`)
- Sweep report (`sim/reports/analysis/sweeps/`)
- Lock report with card state counts and convergence status
- Balance-history.json (tracked in git)
- Replay-seed shortlist for outliers
- Native build notes, store metadata, icons, splash assets

## Ship / Re-tune Policy

Once a card is shipped in `locked` state, its stats never change. Future
balance work ships as **net-new expansions** (additional cards, not
revisions). This is the Brawl Stars model: every shipped identity stays
authoritative.
