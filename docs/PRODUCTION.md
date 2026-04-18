---
title: Production Checklist
updated: 2026-04-17
status: current
domain: release
---

# Production Checklist

## v1.0.0 Released (2026-04-18)

**PRs**: #27 (beta.1), #28 (rc.1), #29 (mythic art), #30 (phone fix), #31 (1.0.0), #32 (changelog)

### Done
- [x] Card art pipeline (212 PNG silhouettes, dark red surface, ragged edges)
- [x] Flavor text (212 unique entries)
- [x] Draw flow redesign (pending → contextual placement, auto-market for unplayable modifiers)
- [x] Stack position placement (insertIntoStack, modifier-under-tough enforcement)
- [x] Draw pile visual (stacked card-backs with MS monogram)
- [x] Collection screen shows real player collection (owned vs locked)
- [x] Game over rewards displayed ("Spoils of War")
- [x] Pack opening saves to persistence + real NEW detection
- [x] Peek button for reviewing drawn card
- [x] Drawn card modal overlay with flip animation
- [x] All tests green (516 node + 108 DOM)
- [x] Build clean (tsc + vite)
- [x] AI opponent functional with new draw mechanics

### Done since beta.1 (RC work)
- [x] Merge PR #27 to main
- [x] Phone layout — vertical menu, HUD draw button
- [x] Sound integration — procedural SFX via Tone.js
- [x] E2E smoke pass on all 4 device profiles (12/12 green)
- [x] Balance gate convergence — winRateA 0.5049 for 3 runs
- [x] Medium firstTurnActions 5→6 (first-mover balance)

### Remaining for 1.0 Production
- [ ] Card merge persistence (post-1.0)
- [ ] Opponent draw visual animation
- [ ] Tutorial flow
- [ ] Mythic art editorial pass
- [ ] Store metadata + signing keys

---

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

## Implementation Status (v1.0.0 — shipped 2026-04-18)

All systems required for v1.0.0 are shipped. Post-1.0 polish items
are tracked below.

### Rules Engine

| System                                | Status         |
|---------------------------------------|----------------|
| Single-lane turf progression (active + reserves) | Shipped in v1.0.0 |
| HP + damage tiers (glance/wound/serious/crushing) | Shipped in v1.0.0 |
| Wounded P/R clamping by HP ratio      | Shipped in v1.0.0 |
| Queue-and-resolve end-of-turn model   | Shipped in v1.0.0 |
| Raid resolution before combat         | Shipped in v1.0.0 |
| Heat scalar + raid probability curve  | Shipped in v1.0.0 |
| Black Market module (trade + heal)    | Shipped in v1.0.0 |
| Holding + Lockup module               | Shipped in v1.0.0 |
| Probabilistic bribes ($500/1k/2k/5k)  | Shipped in v1.0.0 |
| Modifier ownership + modifier_swap    | Shipped in v1.0.0 |
| Close Ranks (disabled when revealed)  | Shipped in v1.0.0 |
| Base + rolled rarity 5-tier system    | Shipped in v1.0.0 |
| Rarity-scaled tangible/intangible effects | Shipped in v1.0.0 |
| Mythic signature abilities (10 cards) | Shipped in v1.0.0 |
| Mythic flip-on-combat-defeat          | Shipped in v1.0.0 |
| Victory ratings per turf + war outcome | Shipped in v1.0.0 |
| Unlock-difficulty tagging + bonus multiplier | Shipped in v1.0.0 |
| Sudden Death removal                  | Shipped in v1.0.0 |

### Card System

| System                                | Status         |
|---------------------------------------|----------------|
| Tough cards authored (100 files)      | Shipped in v1.0.0 |
| Weapons authored (50 files)           | Shipped in v1.0.0 |
| Drugs authored (50 files)             | Shipped in v1.0.0 |
| Currency cards ($100, $1000)          | Shipped in v1.0.0 |
| Mythic cards authored (10 files + SVG)| Shipped in v1.0.0 |
| Rarity rebalance to 55/25/15/5        | Shipped in v1.0.0 |
| 5-tier Rarity Zod schema              | Shipped in v1.0.0 |
| CardInstance (unlockDifficulty + rolledRarity) | Shipped in v1.0.0 |
| HP/maxHp defaults set at compile time | Shipped in v1.0.0 |
| Pack generator with rolled-rarity roll | Shipped in v1.0.0 |
| Per-turf reward generator             | Shipped in v1.0.0 |
| War-outcome reward generator          | Shipped in v1.0.0 |
| Mythic pool + flip-on-defeat tracker  | Shipped in v1.0.0 |
| AI profile mirror (parallel progression) | Shipped in v1.0.0 |
| Card merging (pyramid cost)           | Post-1.0 polish |

### AI

| System                                | Status         |
|---------------------------------------|----------------|
| Yuka GOAP planner                     | Shipped in v1.0.0 |
| Fuzzy logic context (aggression/patience/desperation) | Shipped in v1.0.0 |
| Difficulty-gated policy (top-K + noise)| Shipped in v1.0.0 |
| v0.3 goal set (10 composite goals)    | Shipped in v1.0.0 |
| Scoring for draw/play/retreat/swap/market/holding/queued-strikes | Shipped in v1.0.0 |
| Heat-aware strike scoring             | Shipped in v1.0.0 |
| Pre-war collection curator            | Shipped in v1.0.0 |

### UI / UX

| System                                | Status         |
|---------------------------------------|----------------|
| Screen flow (menu → difficulty → game → gameover) | Shipped in v1.0.0 |
| Card component (unlock-difficulty icon + rolled-rarity border + mythic treatment) | Shipped in v1.0.0 |
| Single-lane TurfView (1v1 + reserves indicator) | Shipped in v1.0.0 |
| TurfCompositeCard (HP bar per tough)  | Shipped in v1.0.0 |
| StackFanModal (face-down opponent fan)| Shipped in v1.0.0 |
| AffiliationSymbol + MythicSymbol      | Shipped in v1.0.0 |
| Difficulty selection (5 tiers, Sudden Death removed) | Shipped in v1.0.0 |
| CardGarageScreen (merge UI + auto-toggles + unlock-difficulty filter) | Shipped in v1.0.0 |
| PackOpeningScreen (v0.3 rolled-rarity reveal) | Shipped in v1.0.0 |
| GameScreen (single-lane action menu + strike interaction) | Shipped in v1.0.0 |
| HeatMeter panel                       | Shipped in v1.0.0 |
| BlackMarketPanel                      | Shipped in v1.0.0 |
| HoldingPanel (+ Lockup indicator)     | Shipped in v1.0.0 |
| MythicBadge                           | Shipped in v1.0.0 |
| Card movement animations              | Shipped in v1.0.0 |
| Resolution overlay (dominance order)  | Shipped in v1.0.0 |
| Responsive layouts (4 device profiles)| Shipped in v1.0.0 |
| Gritty noir SVG filter system         | Shipped in v1.0.0 |
| Accessibility (tap + keyboard + landmarks) | Shipped in v1.0.0 |
| Visual polish (designer pass)         | Post-1.0 polish |

### Platform / Mobile

| System                                | Status         |
|---------------------------------------|----------------|
| Capacitor app shell (Android + iOS)   | Shipped in v1.0.0 |
| SQLite profile + unlock persistence   | Shipped in v1.0.0 |
| Continue / load-game on saved state   | Shipped in v1.0.0 |
| Native icons (Android + iOS)          | Shipped in v1.0.0 |
| Splash screen                         | Partial (background color set; custom splash art pending) |
| Store listing metadata                | Partial (needs final copy + screenshots) |
| Maestro smoke flows                   | Shipped in v1.0.0 |
| Mobile release workflow (AAB + IPA)   | Shipped in v1.0.0 |

### Testing

| System                                | Status         |
|---------------------------------------|----------------|
| Node tests (sim engine, pure logic)   | Shipped in v1.0.0 (516 passing) |
| DOM tests (jsdom, presentational)     | Shipped in v1.0.0 (108 passing) |
| Browser tests (real Chromium)         | Shipped in v1.0.0 |
| E2E tests (Playwright, 4 profiles)    | Shipped in v1.0.0 (12/12 smoke green) |
| Release gate (winrate convergence)    | Shipped in v1.0.0 (winRateA 0.5049) |
| Integration smoke suite               | Shipped in v1.0.0 (active) |

### CI / Release Governance

| System                                | Status         |
|---------------------------------------|----------------|
| CI: lint + typecheck + test:node+dom  | Shipped in v1.0.0 |
| CI: browser tests + e2e (4 profiles)  | Shipped in v1.0.0 |
| CI: release gate (coverage >= 70%)    | Shipped in v1.0.0 |
| CD: deploy to GitHub Pages            | Shipped in v1.0.0 |
| Release benchmark profile             | Shipped in v1.0.0 |
| Lock coverage = 100%                  | Tracked via weekly cron autobalance |
| Concurrency guard on Pages deploy     | Shipped in v1.0.0 |
| Dependabot automerge                  | Shipped in v1.0.0 |

## Post-1.0 Polish

Items remaining after v1.0.0 ship:

- [ ] Card merge persistence (full UI + storage)
- [ ] Opponent draw visual animation
- [ ] Tutorial flow
- [ ] Mythic art editorial pass (replace geometric SVG placeholders with illustrations)
- [ ] Mythic balance paper-playtest (each of 10 mythics individually)
- [ ] Store metadata finalized (copy + screenshots)
- [ ] Signing keys in repo secrets
- [ ] Splash screen custom art
- [ ] Visual polish designer pass
- [ ] Writer sign-off on lore + achievement copy
- [ ] Physical device QA sign-off
- [ ] 100% balance catalog in `locked` state (weekly cron drives this)

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
