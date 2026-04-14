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
| Per-category weapon abilities (all 5) | Ready (REACH, OVERWATCH, LACERATE, PARRY, SHATTER, BRACE, BLAST, DETERRENT, AMBUSH, EVASION) |
| Per-category drug abilities (all 5)   | Ready (RUSH, REFLEXES, SUPPRESS, NUMB, CONFUSE, PARANOIA, BULK, FORTIFY, BERSERK, PAINKILLERS) |
| Archetype abilities (12)              | Ready (BLOOD_FRENZY, VENDETTA, CALLED_SHOT, SCORCHED_EARTH, PHANTOM_STRIKE, RAT_OUT, SCOUT, EXTRACTION, PATCH_UP, HOT_SWAP) |
| Backpack as mechanical container      | Ready (PackedDeckSnapshot + resolvePackedDeck) |
| Runner free-swap on equip             | Ready          |
| Runner retreat costs the turn         | Ready          |
| Seizure transfers backpack + payload  | Ready          |
| Pocket vs backpack-gated slot model   | Ready (slot-accessors.ts; UI pass pending for frame SVG) |

### Authoring And Tuning

| System                                | Status         |
|---------------------------------------|----------------|
| Tough cards authored as per-card files| Ready (100 files) |
| Weapons authored as per-card files    | Ready (50 files) |
| Drugs authored as per-card files      | Ready (50 files) |
| special.json for backpack + cash      | Ready          |
| Zod schema with tuning-history arrays | Ready          |
| raw/ → compiled/ build step           | Ready          |
| Autobalance loop with auto-commit     | Ready (plus saturation cap) |
| Runtime loaders read compiled output  | Ready          |
| Achievement-driven unlocks            | Ready (DSL + 5 condition patterns + App.tsx wiring) |
| Weekly autobalance drift workflow     | Ready (`.github/workflows/autobalance.yml`) |

### UI / UX

| System                                | Status         |
|---------------------------------------|----------------|
| Screen router (menu → game-over)      | Ready          |
| Drag-and-drop + tap-to-arm            | Ready          |
| Gritty noir SVG filter system         | Ready          |
| Responsive layouts (4 device profiles)| Ready          |
| Visual system vs `public/poc.html`    | Partial (gap-analysis worksheet populated, designer pass pending) |
| Runner symbol overlay on toughs       | Ready (badge + payload count) |
| Main-menu logo                        | Ready          |
| Combat ability-tag flash              | Ready          |
| Accessibility (tap-only + landmark)   | Ready          |
| Player-packed backpack rail           | Partial (BackpackRail component + 7 dom tests; DeckBuilderScreen data-model swap pending dedicated PR) |

### Platform / Mobile

| System                                | Status         |
|---------------------------------------|----------------|
| Capacitor app shell (Android + iOS)   | Ready          |
| SQLite profile + unlock persistence   | Ready          |
| Continue / load-game on saved state   | Ready          |
| Native icons (Android + iOS)          | Ready (sips pipeline, all densities committed) |
| Splash screen                         | Partial (Capacitor background color set; custom splash art pending) |
| Store listing metadata                | Partial (docs/store-listing.md draft — needs final copy + screenshots) |
| Maestro smoke flows (3 scenarios)     | Ready          |
| Mobile release workflow (AAB + IPA)   | Ready          |
| No-localStorage guarantee             | Ready (biome rule) |

### CI / Release Governance

| System                                | Status         |
|---------------------------------------|----------------|
| CI: lint + typecheck + test:node+dom  | Ready          |
| CI: browser tests + e2e (4 profiles)  | Ready          |
| CI: release gate (coverage ≥ 70%)     | Ready          |
| CD: deploy to GitHub Pages            | Ready          |
| Release benchmark profile             | Ready          |
| Lock coverage ≥ 70% in balance-history| Ready          |
| Lock coverage = 100%                  | Tracked via weekly cron autobalance |
| Runner opening contract satisfied     | Ready (reserve-start 100%, equip 0.33, deploy 0.99 on smoke) |
| Concurrency guard on Pages deploy     | Ready          |
| Release runbook                       | Ready (`docs/RELEASE.md`) |
| Pre-launch QA checklist               | Ready (`docs/LAUNCH_READINESS.md`) |

## Release Blockers

These are all required for a store-ready launch:

- [x] `pnpm run build` green
- [x] `pnpm run test` (node + DOM) green — 146 tests
- [x] `pnpm run test:browser` green
- [x] `pnpm run test:e2e` green across all four device profiles (40/40)
- [x] `pnpm run test:release` green (70 % lock coverage floor)
- [ ] 100 % of the balance catalog in `locked` state (weekly cron drives this)
- [x] Backpack / runner engine refactor (see RULES §6–7)
- [x] Runner opening contract satisfied (reserve-start fires)
- [x] Visible weapon / drug / archetype abilities resolved in combat
- [x] SQLite profile + unlock persistence working end-to-end
- [x] Continue / load-game functional on persisted state
- [x] No product path depends on localStorage (biome-enforced)
- [ ] Runtime visuals match `public/poc.html` direction (designer pass)
- [x] Native Android + iOS Capacitor projects sync + Maestro smoke scripts
- [ ] Maestro smoke flows executed on physical devices (K2)
- [x] Touch UX supports drag/drop **and** tap-to-arm / tap-to-place
- [x] Portrait / landscape / tablet / fold-aware layouts (CSS + e2e green)
- [ ] Designer sign-off on visual polish (F2/F3/F4/F5)
- [ ] Writer sign-off on J1/J2/J3 lore + achievement copy
- [ ] Store metadata finalized (`docs/store-listing.md` open questions)
- [ ] Signing keys in repo secrets
- [ ] Physical device QA sign-off (`docs/LAUNCH_READINESS.md`)

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
