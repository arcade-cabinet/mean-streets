---
title: Production Checklist
updated: 2026-04-23
status: current
domain: release
---

# Production Checklist

This document owns **release readiness**: what platforms we target,
where each system sits on the path to launch, and what's still open
post-1.0. Recent-release log lives in [STATE.md](./STATE.md). Vision in
[DESIGN.md](./DESIGN.md), mechanics in [RULES.md](./RULES.md), tech in
[ARCHITECTURE.md](./ARCHITECTURE.md), pre-submit QA in
[LAUNCH_READINESS.md](./LAUNCH_READINESS.md), tag-and-publish flow in
[RELEASE.md](./RELEASE.md).

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

The v0.3 ruleset, the 213-card catalog (100 toughs / 50 weapons /
50 drugs / 3 currency / 10 mythics), the AI planner, the UI surface,
the Capacitor mobile shell, the SQLite persistence layer, the test
matrix (node + DOM + browser + Playwright e2e), the CI/CD pipeline,
the release-please tagging, and the dependabot automerge are all
shipped and live on `main`. Reach for the code, the test suite, and
`docs/STATE.md` for the canonical "what runs today."

This page tracks only what is **partial**, **still blocking store submission**,
or **explicitly post-launch polish**. If work is complete and already true on
`main`, move it to [STATE.md](./STATE.md) instead of leaving stale TODOs here.

### Partial (gating future store submission)

| System                | Status                                            |
|-----------------------|---------------------------------------------------|
| Splash screen         | Background color set; custom splash art pending   |
| Store listing metadata| Draft copy in `docs/store-listing.md`; screenshots TBD |
| Signing keys          | Not yet in repo secrets — see `LAUNCH_READINESS.md` for the full key list |
| iOS release artifact  | Workflow fixed in 1.1.0-beta.1 (SPM, no Podfile); next release tag will produce the first signed-build-eligible archive |

## Current Remaining Work

### Brand / onboarding

- [ ] **Difficulty selector copy + iconography pass** — replace remaining
      placeholder/PoC-feeling labels with branded titles, descriptions, and
      silhouette-derived icon language; keep Ultra Nightmare explicitly forced
      to permadeath while making permadeath legible as a separate modifier.
- [ ] **Permadeath presentation + consequences review** — document and validate
      all intended permadeath implications in the live UX/copy so the mode
      reads as a meaningful rules complication, not just a toggle.
- [ ] **First-run tutorial art direction follow-through** — keep the new street
      brief and first-war coach, but continue improving fantasy, stakes,
      momentum, and visual teaching so onboarding never feels like a thin text
      layer over the game.

### Visual journey / art direction

- [ ] **Desktop whitespace world-stage pass** — continue using atmospheric side
      staging, signage, silhouettes, and prop language so wide layouts feel
      intentional instead of like centered UI on dead black canvas.
- [ ] **Mobile landing identity preservation** — continue pressure-testing the
      hero crop, smoke, logo, and bottom-anchored CTA treatment so small-screen
      layouts never collapse into stacked buttons on black.
- [ ] **Combat surface polish** — keep strengthening combat as the primary
      identity surface: lane ownership, active-state lighting, side-world props,
      and readability on both phone and wide screens.
- [ ] **Pack opening ritual refinement** — continue pushing sealed-drop,
      reveal, and street-spoils summary presentation until the reward loop feels
      fully ceremonial and materially distinct from a generic card reward grid.
- [ ] **Shared world chrome on support screens** — finish carrying the same
      world-treatment language across collection, garage, cards, game-over, and
      remaining support surfaces.
- [ ] **Visual fixture review pass** — regenerate captures and review each
      screen as an art-directed world, not just as functional component layout.

### Content / authoring

- [ ] **Mythic art editorial pass** — replace geometric SVG placeholders with
      authored illustrations.
- [ ] **Mythic paper-playtest review** — review each of the 10 mythics
      individually for UX, readability, and authored identity; mechanics,
      stats, and rules remain locked by `docs/RULES.md` unless explicitly
      approved and validated with `pnpm run analysis:benchmark` before commit.
- [ ] **Writer sign-off** — lore, tutorial copy, difficulty copy, and
      achievement/store copy all need a final brand/voice review.
- [ ] **Splash screen custom art** — replace the temporary color-only splash.

### Release / ship blockers

- [ ] **Store metadata finalized** — copy + screenshots (`docs/store-listing.md`).
- [ ] **Signing keys** in repo secrets (Android keystore + Apple App Store API
      key — see `LAUNCH_READINESS.md`).
- [ ] **Physical device QA sign-off** on Android + iOS golden path.
- [ ] **`LAUNCH_READINESS.md` walked end-to-end**, with all signoff rows
      filled.

### Engineering hygiene

- [ ] **100% balance-catalog `locked` state** — weekly cron autobalance
      drives this; no manual action unless it stalls.

## Recently Landed

- [x] **Visual journey pass** — landing, first-run tutorial, first-war coach,
      combat world staging, pack-opening ritual baseline, and shared world
      chrome all landed across the recent polish PRs on `main`.
- [x] **Smoke-vs-full E2E split** — CI/CD now runs a bounded smoke lane while
      full E2E, governor, and visual-capture runs stay local/explicit.
- [x] **Visual fixture expansion** — tutorial, combat tutorial, pack reveal,
      and pack summary all have stable capture targets for art review.

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
