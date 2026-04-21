---
title: Production Checklist
updated: 2026-04-20
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

This page tracks only what is **partial** or **explicitly post-1.0**.

### Partial (gating future store submission)

| System                | Status                                            |
|-----------------------|---------------------------------------------------|
| Splash screen         | Background color set; custom splash art pending   |
| Store listing metadata| Draft copy in `docs/store-listing.md`; screenshots TBD |
| Signing keys          | Not yet in repo secrets — see `LAUNCH_READINESS.md` for the full key list |
| iOS release artifact  | Workflow fixed in 1.1.0-beta.1 (SPM, no Podfile); next release tag will produce the first signed-build-eligible archive |

## Post-1.0 Polish (no order, no deadline)

### Rules / sim follow-ups (from the 1.1.0-beta.1 dragon ledger)

### Content / authoring

- [ ] **Mythic art editorial pass** — replace geometric SVG
      placeholders with illustrations.
- [ ] **Mythic balance paper-playtest** — each of the 10 individually.
- [ ] **Tutorial flow** — guided first-war that surfaces market /
      holding / heat / bribes (currently invisible until ~turn 10).
- [ ] **Opponent draw visual animation**.
- [ ] **Visual polish designer pass** — full-surface review.
- [ ] **Writer sign-off** on lore + achievement copy.
- [ ] **Splash screen custom art**.

### Pre-store-submit blockers

- [ ] **Store metadata finalized** — copy + screenshots (`docs/store-listing.md`).
- [ ] **Signing keys** in repo secrets (Android keystore + Apple App
      Store API key — see `LAUNCH_READINESS.md`).
- [ ] **Physical device QA sign-off** on Android + iOS golden path.
- [ ] **`LAUNCH_READINESS.md` walked end-to-end**, with all signoff
      rows filled.

### Engineering hygiene

- [ ] **100% balance-catalog `locked` state** — weekly cron autobalance
      drives this; no manual action unless it stalls.

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
