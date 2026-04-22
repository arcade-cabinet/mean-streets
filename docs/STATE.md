---
title: State
updated: 2026-04-20
status: current
domain: context
---

# Mean Streets — Current State

What is done, what is in flight, and what comes next. Release-readiness
status lives in [PRODUCTION.md](./PRODUCTION.md). Branch history in
`git log`; CHANGELOG.md is the canonical per-version diff.

## Where We Are (2026-04-20)

Latest release tag: `v1.2.1-beta.1`. Most recent balance lock:
`winRateA 0.512` / `timeoutRate 0.000` / `avgTurns 16.3`. No active
feature branches. Post-1.0 polish runway tracked in
[PRODUCTION.md](./PRODUCTION.md). For exact `main` HEAD use
`git log -1 main`.

## Recent Releases

### v1.2.0-beta.1 — 2026-04-19

- Release-please cut (PR #35) following the omnibus rules-alignment merge.
- Android AAB artifact published for the tag.
- iOS artifact: workflow had a stale CocoaPods step that pre-dated the
  Capacitor 8 SPM migration; fixed on `main` in PR #36 but the rerun
  uses the historical workflow file, so the iOS archive for this
  specific tag is missing. The next release tag will produce one.

### v1.2.1-beta.1 — 2026-04-20

- Documentation-only cleanup release.
- Clarified historical versioning: public Git tags jump `v0.7.1 →
  v1.2.0-beta.1`; `v1.0.0` and `v1.1.0-beta.1` remain documented
  milestones, not published tags.

### v1.1.0-beta.1 — 2026-04-19

PR #34 + #36 omnibus, alpha → beta. Closed 13 of 19 surfaced "frozen
shape" dragons; 5 documented as follow-ups in
[PRODUCTION.md](./PRODUCTION.md).

- **Rules fidelity** — 5 advertised v0.3 features that weren't shipping:
  mythic flip-on-kill wired into combat, healing chain (PATCHUP /
  FIELD_MEDIC / RESUSCITATE) with end-of-turn ticks, Closed Ranks
  defensive bonus by difficulty (and the resolve-phase reset that
  was making every game time out), `PackOpeningScreen` routed through
  `generatePack` with seeded RNG, end-of-turn modifiers route to
  Black Market not a per-player discard pile.
- **Economy** — Bribes draw from turf-wide currency pool (was single
  largest denomination), `tradeAtMarket` promoted card lands in
  Black Market (was silently dropped), loyal-stack bonus requires 3+
  toughs of same affiliation, mediator-graph rule fires for rival
  placement, LAUNDER fires on legendary currency cards.
- **Persistence** — Mythic globally-exclusive invariant survives
  across wars (per-side `ownedMythicIds` on profile), `simVersion`
  stamp on active-run save discards stale resumes, AI earns reward
  packs on AI wins.
- **v0.2 holdover purge** — `player.discard` removed entirely,
  `Sudden Death` tier removed everywhere, `usePlayerTurfs` ECS alias
  retired, AI `-v03` shadow files inlined into the canonical names,
  3 dead-code sim files deleted.
- **CI / build** — Order enforced as `ci → release → cd`,
  `automerge.yml` split into dependabot + release-please jobs,
  `sql.js` pinned at 1.11.0 (1.14.1 breaks jeep-sqlite WASM ABI;
  caught by browser CI), iOS release workflow migrated from CocoaPods
  to direct `xcodebuild` against the SPM project.
- **Tooling** — `tsconfig.sim.json` gives `src/sim/` first-class type
  coverage (caught two real latent bugs); `tsconfig.app.json` no
  longer excludes `src/sim`.
- **Docs** — RULES/DESIGN/PRODUCTION/STATE/ARCHITECTURE/CLAUDE/PRDs
  reconciled with v1.0/1.1 reality; 13 P0 RULES.md clarifications
  applied; v0.3 plan documents archived.

### v1.0.0 — 2026-04-18

- **Card art pipeline** — 213 PNG silhouettes, dark red surface, ragged edges, 213 unique flavor text entries.
- **Draw flow redesign** — pending → contextual placement, auto-market for unplayable modifiers, peek button, drawn card modal with flip animation.
- **SFX** — procedural sound via Tone.js, integrated on all game events.
- **Phone layout** — vertical menu, HUD draw button, safe-area aware.
- **Balance gate** — Medium AI-vs-AI win rate 0.5049 for 3 consecutive seeded runs. Medium firstTurnActions bumped 5 → 6.
- **Automerge** — Dependabot automerge workflow added.
- **PRs**: #27 (beta.1), #28 (rc.1), #29 (mythic art), #30 (phone fix), #31 (1.0.0), #32 (changelog).
- **Note**: `v1.0.0` was bumped in `package.json` but never tagged or
  released on GitHub; `v1.1.0-beta.1` likewise remained an internal
  milestone. The release tag history jumps `v0.7.1 →
  v1.2.0-beta.1`. CHANGELOG + STATE entries for those milestones are
  canonical.

### v0.6.0

- Board grid layout (PR #15): 3x2 card-slot board, simplified 3-button main menu.
- Browser test expansion: 95 Vitest browser tests across 15 files.
- E2E spec alignment: specs updated for v0.3 board layout test IDs. E2E moved to cd.yml.

### v0.5.0 / v0.4.0 / earlier

See `CHANGELOG.md`. Pre-v0.6 entries summarize the v0.3 sim rewrite,
mythic abilities, pack simplification, and workflow consolidation.

### Test Coverage

| Suite | Count | Runner |
|-------|-------|--------|
| Node (sim, ECS, pure logic) | 624 pass / 4 skip | `pnpm run test:node` |
| DOM (jsdom presentational) | 116 pass | `pnpm run test:dom` |
| Browser (real Chromium) | 106 pass | `pnpm run test:browser` |
| E2E smoke | App-flow smoke on desktop Chromium | `pnpm run test:e2e` |
| Full E2E (local) | 157 pass / 9 skip + 28 visual captures | `pnpm run test:e2e:full` |

## Current Work

No active feature branches. Beta channel is `v1.2.1-beta.1`.

## What Comes Next

The polish runway and pre-store-submit blockers all live in
[PRODUCTION.md](./PRODUCTION.md) so there's exactly one tracker.
Long-horizon items (mythic art editorial pass, pack-economy expansion,
multiplayer) live in [DESIGN.md](./DESIGN.md) "Future Direction".

## Useful Commands

```bash
git log --oneline -10          # recent commits
gh pr list                     # open PRs
pnpm run analysis:benchmark    # check current balance state
pnpm run test:analysis:slow    # full slow analysis sweep
pnpm run typecheck            # referenced TS projects (app/node/sim)
pnpm run test:node             # node tests (fast)
pnpm run test:browser          # browser tests (real Chromium)
pnpm run test:e2e              # Desktop E2E smoke
pnpm run test:e2e:full         # Full local E2E, visual, and governor suite
pnpm run test:release          # release gate check
```
