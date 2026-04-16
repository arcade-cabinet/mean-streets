---
title: Production Checklist
updated: 2026-04-17
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

### Rules Engine (v0.3 Single-Lane)

| System                                | Status         |
|---------------------------------------|----------------|
| Single-lane turf progression (active + reserves) | In progress (Epic B) |
| HP + damage tiers (glance/wound/serious/crushing) | In progress (Epic B) |
| Wounded P/R clamping by HP ratio      | In progress (Epic B) |
| Queue-and-resolve end-of-turn model   | In progress (Epic B) |
| Raid resolution before combat         | In progress (Epic B) |
| Heat scalar + raid probability curve  | In progress (Epic B: heat.ts) |
| Black Market module (trade + heal)    | In progress (Epic B: market.ts) |
| Holding + Lockup module               | In progress (Epic B: holding.ts) |
| Probabilistic bribes ($500/1k/2k/5k)  | In progress (Epic C) |
| Modifier ownership + modifier_swap    | In progress (Epic B + E) |
| Close Ranks (disabled when revealed)  | Done (v0.2 carried forward) |
| Base + rolled rarity 5-tier system    | In progress (Epic A + F) |
| Rarity-scaled tangible/intangible effects | Done (Epic C: b543a24) |
| Mythic signature abilities (10 cards) | Done (pre-batch + Epic C: abilities registered) |
| Mythic flip-on-combat-defeat          | In progress (Epic B + H) |
| Victory ratings per turf + war outcome | In progress (Epic H) |
| Unlock-difficulty tagging + bonus multiplier | In progress (Epic F) |
| Sudden Death removal                  | Done (RULES.md v0.3) |

### Card System

| System                                | Status         |
|---------------------------------------|----------------|
| Tough cards authored (100 files)      | Ready          |
| Weapons authored (50 files)           | Ready          |
| Drugs authored (50 files)             | Ready          |
| Currency cards ($100, $1000)          | Ready          |
| Mythic cards authored (10 files + SVG)| Done (commit 2942179) |
| Rarity rebalance to 55/25/15/5        | In progress (Epic F) |
| 5-tier Rarity Zod schema              | In progress (Epic F) |
| CardInstance migration (unlockDifficulty + rolledRarity) | In progress (Epic F) |
| HP/maxHp defaults set at compile time | In progress (Epic F) |
| Pack generator with rolled-rarity roll | In progress (Epic H) |
| Per-turf reward generator             | In progress (Epic H) |
| War-outcome reward generator          | In progress (Epic H) |
| Mythic pool + flip-on-defeat tracker  | In progress (Epic H) |
| AI profile mirror (parallel progression) | In progress (Epic H) |
| Card merging (pyramid cost)           | In progress (Epic F + G) |

### AI

| System                                | Status         |
|---------------------------------------|----------------|
| Yuka GOAP planner                     | In progress (Epic D) |
| Fuzzy logic context (aggression/patience/desperation) | Ready (carried from v0.2) |
| Difficulty-gated policy (top-K + noise)| In progress (Epic D: minor) |
| v0.3 goal set (10 composite goals)    | In progress (Epic D) |
| Scoring for draw/play/retreat/swap/market/holding/queued-strikes | In progress (Epic D) |
| Heat-aware strike scoring             | In progress (Epic D) |
| Pre-war collection curator            | In progress (Epic D: curator.ts) |

### UI / UX

| System                                | Status         |
|---------------------------------------|----------------|
| Screen flow (menu → difficulty → game → gameover) | In progress (Epic G) |
| Card component (unlock-difficulty icon + rolled-rarity border + mythic treatment) | In progress (Epic G) |
| Single-lane TurfView (1v1 + reserves indicator) | In progress (Epic G) |
| TurfCompositeCard (HP bar per tough)  | In progress (Epic G) |
| StackFanModal (face-down opponent fan)| Ready (v0.2 carried) |
| AffiliationSymbol + MythicSymbol      | Done (MythicSymbol commit 2942179) |
| Difficulty selection (Sudden Death removed) | In progress (Epic G) |
| CardGarageScreen (merge UI + auto-toggles + unlock-difficulty filter) | In progress (Epic G) |
| PackOpeningScreen (v0.3 rolled-rarity reveal) | In progress (Epic G) |
| GameScreen (single-lane action menu + strike interaction) | In progress (Epic G) |
| HeatMeter panel                       | In progress (Epic G) |
| BlackMarketPanel                      | In progress (Epic G) |
| HoldingPanel (+ Lockup indicator)     | In progress (Epic G) |
| MythicBadge                           | In progress (Epic G) |
| Card movement animations              | In progress (Epic G) |
| Resolution overlay (dominance order)  | In progress (Epic G) |
| Responsive layouts (4 device profiles)| In progress (Epic G) |
| Gritty noir SVG filter system         | Ready (carried)|
| Accessibility (tap + keyboard + landmarks) | In progress (Epic G) |
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
| Node tests (sim engine, pure logic)   | In progress (Epic I — v0.3 rewrite) |
| New test files: heat / market / holding / damage / turf-progression / mythic / victory-rating | In progress (Epic I) |
| DOM tests (jsdom, presentational)     | Partial — MythicSymbol 8/8 green; rest pending Epic G + I |
| Browser tests (real Chromium)         | In progress (Epic I) |
| E2E tests (Playwright, 4 profiles)    | In progress (Epic I) — new specs: single-lane-flow, market-and-holding, mythic-engagement, card-garage, war-outcome |
| Release gate (lock coverage + winrate convergence) | Blocked by Epic I-benchmark |
| Integration smoke skeleton            | Done (v03-integration.test.ts, describe.skip gated) |

### CI / Release Governance

| System                                | Status         |
|---------------------------------------|----------------|
| CI: lint + typecheck + test:node+dom  | Ready (v0.2 green; will re-green with Epic I) |
| CI: browser tests + e2e (4 profiles)  | Ready          |
| CI: release gate (coverage >= 70%)    | Blocked by Epic I-benchmark re-baseline |
| CD: deploy to GitHub Pages            | Ready          |
| Release benchmark profile             | Ready          |
| Lock coverage >= 70% in balance-history| Blocked by Epic I-benchmark |
| Lock coverage = 100%                  | Tracked via weekly cron autobalance |
| Concurrency guard on Pages deploy     | Ready          |
| curated-sweep test split (fast config + slow sim gate) | Ready (commit cacc7e2) |

## Release Blockers

These are all required for a store-ready launch of **v0.3**:

### Merge blockers
- [ ] `pnpm run lint` clean
- [ ] `pnpm run build` green
- [ ] `pnpm run test` green on all three suites (node + DOM + browser)
- [ ] `pnpm run test:e2e` green on all 4 device profiles (desktop-chromium, iphone-14, pixel-7, ipad-pro-landscape)
- [ ] `pnpm run analysis:benchmark` Medium AI-vs-AI winrate in [0.48, 0.52] for 3 consecutive seeded runs
- [ ] `pnpm run test:release` green with updated lock-coverage bar
- [ ] `pnpm run cards:compile` emits `mythics.json` alongside existing compiled outputs
- [ ] v0.3 e2e smoke: fresh profile → curate collection → play a 4-turf Medium war → earn rewards → merge duplicates → confirm state persists

### Post-merge
- [ ] 100% of the balance catalog in `locked` state (weekly cron drives this)
- [ ] v0.3 integration suite promoted from describe.skip → active (Vera follow-up)
- [ ] Mythic balance manually validated (each of 10 mythics through paper playtesting)
- [ ] Runtime visuals match design direction (designer pass)
- [ ] Mythic art replaced from geometric SVG placeholders with editorial illustration pass
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
