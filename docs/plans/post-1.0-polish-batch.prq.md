---
title: Post-1.0 Polish Batch
updated: 2026-04-20
status: planning
priority: MEDIUM
timeframe: chip-away (no deadline; some items have hard cutoffs)
---

# Post-1.0 Polish Batch

## Overview

Autonomous-batch-eligible polish items extracted from
[`docs/PRODUCTION.md`](../PRODUCTION.md) "Post-1.0 Polish".

**The art pipeline IS the art system.** `pnpm run cards:art` runs
`workspaces/image-extraction/src/compose_cards.py` +
`compose_mythics.py` against the 173 raw sprites in
`raw-assets/sprites/`. Mythic art "editorial pass" means tuning
`BEST_PICKS` in `compose_mythics.py` (each mythic has 2-3 alt
sprites already extracted) and rerunning. Splash custom art runs
through `pnpm run assets:generate` (`scripts/generate-mobile-icons.sh`)
from `branding/icon.svg`. Neither is waiting on an outside illustrator.

Excluded from this batch only the items that genuinely need a human:
playtester (per-mythic balance run), human in repo settings (signing
keys), human + devices (physical-device QA), human writer
(achievement / lore copy review).

16 tasks total (T00 + T00.5 + T01–T14). T01 has the 2026-09-16 hard
cutoff (Node 24 deprecation); T00 is the highest-impact bug
(silhouettes are 79% duplicates). The rest are quality chips that can
land in any order respecting the dependency graph.

Single PR per task is the default; `/task-batch` will auto-commit and
respect dependencies. Each task here meets the "VERIFIED_DONE"
contract: file paths cited, acceptance criteria measurable, tests
specified.

## Constraints

Standard project constraints (CLAUDE.md):
- pnpm only (no npm/yarn lockfile)
- Biome lint clean (`pnpm run lint`)
- All tests green: `pnpm run test:node`, `test:dom`, `test:browser`
- `pnpm run build` clean (catches `tsc -b` project-ref errors that
  `tsc --noEmit` misses)
- `pnpm run analysis:benchmark` stays in `[0.48, 0.52]` for any
  sim-touching change
- No code change to `src/sim/turf/**` thresholds without a JSON tunable
- Every task: small, focused, single-PR squash-merge

## Authoritative specs

- [docs/RULES.md](../RULES.md) — game rules
- [docs/PRODUCTION.md](../PRODUCTION.md) — full polish list (this PRD
  is a subset)
- [docs/STATE.md](../STATE.md) — recent release log
- [docs/RELEASE.md](../RELEASE.md) — release-please flow

## Tasks

### Art pipeline (real bugs, not polish)

#### T00 — Silhouette pipeline assigns duplicates

**Priority:** P1 (213 cards, only 45 unique silhouettes — 16 toughs share
one PNG in the worst cluster)
**Files:** `workspaces/image-extraction/src/compose_cards.py`,
`workspaces/image-extraction/src/compose_mythics.py` (verify mythics
stay 10/10 unique — currently OK)
**Description:** `compose_cards.py` picks `cands = match_sprites(spr,
["bodies"], pats)` where `pats` is filtered by archetype (≈12
archetypes). Then `pick(cands, seed_from_id(card["id"]))` does a
deterministic pick. Result: every tough sharing an archetype +
matching the same first-candidate sprite ends up with byte-identical
art. Empirical: 212 PNGs, 45 unique md5s. Biggest cluster: 16 cards
share one silhouette (card-025/026/035/037/045/049/059/060/062/064/
066/067/071/086/095/096).

Mythics use `BEST_PICKS` (1:1 hand-picked map) and are correctly
10/10 unique — that pattern should be the model.

Fix path:
(a) Track sprites already assigned in a `Set` and re-roll until a
    fresh sprite is picked. With 173 raw sprites and 200 non-mythic
    cards we'll exhaust the pool — fall back to applying a
    transform (mirror, hue shift, contrast) to a re-used base for
    the overflow.
(b) Author a `BEST_PICKS`-style explicit map for all 200 non-mythic
    cards too. Heaviest but cleanest. Probably a follow-up task
    after (a) lands.
(c) Combination: (a) for the bulk + curated overrides for the
    cards whose archetype pool is genuinely thin.

**Recommendation:** (a) first — get to 1:1 unique with deterministic
fallback transforms. (b) is a follow-up "designer-pass-equivalent"
task that's still autonomous-batch-eligible (data file edit).

**Acceptance criteria:**
- After `pnpm run cards:art`, `md5 public/assets/card-art/*.png |
  awk '{print $1}' | sort -u | wc -l` returns **at least 200** (212
  is ideal but 200+ is the real success bar — accounts for
  legitimately-twinned variants if any)
- `currency-launder.png` exists (was missing entirely; T00.5 below
  also fixes this if not bundled here)
- Mythics still all unique (10/10)
- New unit test for the python pipeline OR a CI shell check that
  `unique_hashes >= total_files - 12` (allow tiny tolerance)

**Dependencies:** none. Should ship before any visual regression
baseline (T09) — otherwise the baseline encodes the duplicate state.

#### T00.5 — Generate missing `currency-launder.png`

**Priority:** P1 (1.1.0-beta.1 dragon partially closed)
**Files:** `workspaces/image-extraction/src/compose_cards.py` if
currency loop skipped non-default denominations; or
`raw-assets/sprites/currency/` for source art.
**Description:** When LAUNDER currency was added (PR #34 → 1.1.0-beta.1),
the compose pipeline wasn't rerun, OR the pipeline doesn't iterate
the currency catalog. Either way: `public/assets/card-art/` has
`currency-100.png` + `currency-1000.png` but no `currency-launder.png`.
Currency cards don't render `<img>` in `Card.tsx::renderCurrency`
today, but the asset hole is real (silent until anyone wires
currency portraits). Generate it.

**Acceptance criteria:**
- `pnpm run cards:art` produces `public/assets/card-art/currency-launder.png`
- The currency loop in `compose_cards.py` iterates the full
  compiled `currency.json` array (not just default denominations)
- File parity check passes: `comm -23 <all-card-ids> <art-ids>`
  returns empty

**Dependencies:** can ship as part of T00 if the agent finds the
currency loop is the same broken-pick logic; otherwise standalone.

### Engineering hygiene (short, lowest risk)

#### T01 — Bump `release-please-action` to Node 24

**Priority:** P1 (hard cutoff 2026-09-16)
**Files:** `.github/workflows/release.yml`
**Description:** Action `googleapis/release-please-action@v4.1.3`
runs on Node 20, deprecated by GitHub. Default-removal date:
2026-09-16. Either bump to a published v5+ release that supports
Node 24 OR set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` in the env
for the release-please job as a stop-gap.

**Acceptance criteria:**
- `release.yml` no longer emits the Node 20 deprecation annotation on
  next push to main
- Release-please still successfully opens a release PR when feat/fix
  commits land
- `gh run view <next-release-run>` annotations don't include
  "Node.js 20 actions are deprecated"

**Verification:** push branch → land trivial `chore:` commit on main →
inspect next Release workflow run annotations.

**Dependencies:** none.

#### T02 — Resolve release version gap (v0.7.1 → v1.2.0-beta.1)

**Priority:** P3 (cosmetic)
**Files:** `CHANGELOG.md`
**Description:** `v1.0.0` and `v1.1.0-beta.1` exist as entries in
`CHANGELOG.md` but were never created as Git tags or GitHub Releases.
The release-history list jumps `v0.7.1 → v1.2.0-beta.1`. Pick one of
two paths:

(a) Retroactively tag `v1.0.0` at commit `8820913` and `v1.1.0-beta.1`
    at `1f81242`, then `gh release create` for both with the
    CHANGELOG entries as release notes.
(b) Add a one-paragraph note at the top of `CHANGELOG.md` explaining
    that 1.0.0 and 1.1.0-beta.1 were transient package.json states
    superseded by 1.2.0-beta.1 before tag creation.

**Recommendation:** (b) — retroactive tags risk confusing release-please
state and triggering unwanted artifact builds. The note is
zero-risk and gives the reader an explanation.

**Acceptance criteria:**
- `CHANGELOG.md` top has a clear "Note on version history" section
  citing the gap and the actual ship dates
- `git tag -l "v1*"` still shows only the real tag(s); no retroactive
  tags created (unless option a is chosen)

**Dependencies:** none.

#### T03 — Audit `tsconfig.sim.json` for drift vs `tsconfig.app.json`

**Priority:** P3 (cosmetic; preventative)
**Files:** `tsconfig.sim.json`, `tsconfig.app.json`, `tsconfig.json`
**Description:** `tsconfig.sim.json` was added in 1.1.0-beta.1 and
duplicates ~80% of compiler options from `tsconfig.app.json`. Refactor
to a shared base config (`tsconfig.base.json`) that both extend. This
prevents the two from drifting silently.

**Acceptance criteria:**
- New `tsconfig.base.json` holds shared compiler options
- `tsconfig.app.json` and `tsconfig.sim.json` both `extends` it,
  override only what differs (lib, types, include/exclude)
- `pnpm exec tsc -b --force` clean
- `pnpm run build` clean
- `pnpm run test:node` + `test:dom` + `test:browser` all green

**Dependencies:** none.

### Sim follow-ups (real bugs in shipped code)

#### T04 — LAUNDER currency UX trap

**Priority:** P2
**Files:** `src/sim/turf/types.ts`, `src/sim/turf/resolve.ts`,
`src/sim/turf/ability-handlers.ts`, possibly `src/ui/board/HeatMeter.tsx`
**Description:** `Clean Money` ($1000 LAUNDER) is currently spendable
as a bribe via the turf-wide currency pool. When spent, the LAUNDER
heat-relief effect dies with it — silent UX trap.

Pick one path:
(a) Tag LAUNDER currency cards `nonSpendable: true` on `CurrencyCard`;
    skip them in `resolve.ts::maybeCombatBribe` and
    `ability-handlers.ts::maybeBribe` consumption loops.
(b) Show a confirm prompt before bribe-spend if any consumed currency
    has LAUNDER ability (UI change only).

**Recommendation:** (a) — sim-level enforcement, no UI dependency,
matches the rules-as-code principle.

**Acceptance criteria:**
- New test in `src/sim/turf/__tests__/heat.test.ts` or
  `resolve.test.ts`: bribe attempt that would consume a LAUNDER
  currency card uses other currency first; if only LAUNDER is
  available, bribe attempt fails (or specifically excludes LAUNDER)
- Document the rule in `RULES.md` §10.1 or §10.3 (one-line
  "LAUNDER currency cannot be spent on bribes")
- Existing bribe tests still pass

**Dependencies:** none.

#### T05 — Catalog re-parse caching

**Priority:** P3 (perf, not correctness)
**Files:** `src/ui/screens/CollectionScreen.tsx`,
`src/ui/screens/CardGarageScreen.tsx`, `src/ui/screens/CardsScreen.tsx`
or new `src/sim/cards/full-pool.ts`
**Description:** Each Collection / CardGarage / Cards screen mount
calls `loadFullCatalog()` inside `useMemo([])`, which reparses 213
Zod entries on every screen mount. Cache the parsed pool at module
scope; hand callers a `slice()`.

**Acceptance criteria:**
- One module-level cache (e.g. `src/sim/cards/full-pool.ts` exporting
  `getFullCatalogCached(): readonly Card[]`)
- Each screen replaces `useMemo(loadFullCatalog, [])` with a call to
  the cached version
- New unit test: calling the cached getter twice returns the same
  array reference
- DOM tests still pass

**Dependencies:** none.

#### T06 — AI planner `justPromoted` awareness

**Priority:** P3
**Files:** `src/sim/turf/ai/planner.ts` or `src/sim/turf/ai/scoring.ts`
**Description:** When a turf is promoted (`justPromoted=true`), the
side gets bonus actions on its next turn. Sim awards them; planner
doesn't pre-bias for them. Add a small score bonus for aggressive
plays (queue strikes, play toughs) when the active turf has
`justPromoted=true`. Tunable in `turf-sim.json`.

**Acceptance criteria:**
- New `aiBias.justPromotedAggression` numeric in `turf-sim.json`
  (default 1.2 multiplier on strike/play scoring)
- Planner reads it; adds bonus only when `justPromoted=true`
- New AI behavior test: deterministic seed where promoted turf side
  queues a strike sooner than control
- `pnpm run analysis:benchmark` stays in `[0.48, 0.52]`

**Dependencies:** T03 if it ships first (so JSON loader respects
shared base; otherwise independent).

#### T07 — Perfect War escalating-currency fallback

**Priority:** P3 (only fires once mythic pool exhausted, ~10+ Perfect
Wars)
**Files:** `src/sim/packs/rewards.ts`, `src/platform/persistence/profile.ts`,
`src/platform/persistence/ai-profile.ts`
**Description:** Once all 10 mythics are owned across both sides,
Perfect Wars currently award flat $500. RULES §13.4 specifies
$500 → $1000 → $1500 → … Track per-side perfect-war count
post-pool-exhaustion in profile state; multiply $500 by (count + 1).

**Acceptance criteria:**
- `PlayerProfile` and AI profile both track
  `perfectWarsAfterPoolExhaustion: number`
- `rewards.ts:163` returns `500 * (count + 1)` instead of flat 500
- New test in `src/sim/packs/__tests__/rewards.test.ts`: 1st Perfect
  War after pool empty → $500; 2nd → $1000; 3rd → $1500
- Save migration: existing profiles default to 0 on load (no migration
  needed — optional field, treated as 0 if absent)

**Dependencies:** none.

### UI / interaction

#### T08 — Card merge persistence (UI + storage round-trip)

**Priority:** P2 (advertised in DESIGN.md but not actually persisted)
**Files:** `src/platform/persistence/collection.ts`,
`src/ui/screens/CardGarageScreen.tsx`,
`src/sim/cards/merge.ts` (may need creation)
**Description:** CardGarageScreen has merge UI but currently doesn't
write merge results to profile. Per DESIGN.md "Merging and
Progression": 2 commons → 1 uncommon, 2 uncommons → 1 rare, 2 rares
→ 1 legendary. Mythics cannot be merged. Merged card inherits higher
unlockDifficulty.

**Acceptance criteria:**
- New `mergeCards(profile, [cardId, cardId])` in collection.ts
  returns updated profile with the two source instances removed and
  one new instance added at next rolled rarity
- CardGarageScreen wires its merge button to call the function and
  refresh state
- New tests in `src/platform/persistence/__tests__/collection.test.ts`:
  successful merge of 2 commons → 1 uncommon, blocked merge attempt
  on mythic, blocked merge of 2 cards at different rolled rarities
- Browser test in `CardGarageScreen.browser.test.tsx`: click merge
  button → assert profile state updated

**Dependencies:** none (touches its own slice).

#### T09 — Opponent draw visual animation

**Priority:** P3 (polish)
**Files:** `src/ui/board/StackFanModal.tsx` or new
`src/ui/animations/DrawAnimation.tsx`, `src/ui/screens/GameScreen.tsx`
**Description:** Player sees their own draws animate; opponent draws
just appear. Add a brief card-back slide-in animation when the
opponent's pending slot updates.

**Acceptance criteria:**
- GSAP-animated card-back slides from off-screen into opponent's
  pending position when `players.B.pending` transitions from null to
  non-null
- Respects `prefers-reduced-motion` (no animation, static render)
- DOM test verifies the animated element is present in DOM after a
  draw action; reduced-motion env produces no animation classes

**Dependencies:** none.

### Deploy / config

#### T10 — SPA-fallthrough asset 404

**Priority:** P3 (only matters if we move off GitHub Pages)
**Files:** Currently no config to change — GitHub Pages already returns
real 404s. Document the gotcha for future deploy targets in
`docs/DEPLOYMENT.md`.
**Description:** When deployed to a host with SPA fallback
(Cloudflare Pages, Netlify), missing `/assets/card-art/*.png` returns
HTML not 404. Our `<img onError>` fallback fires correctly but wastes
a network round-trip. Add a `/assets/*` exclusion rule to any future
deploy config.

**Acceptance criteria:**
- `docs/DEPLOYMENT.md` gains a "Hosting requirements" section listing
  the SPA fallback rule (`/assets/*` must return real 404s, not
  index.html)
- For each currently-supported deploy target, the doc states the rule
  in the host's specific config syntax (Cloudflare `_headers` /
  `_redirects` snippet, Netlify `_redirects`, Vercel
  `vercel.json` rewrites)

**Dependencies:** none.

### Pre-store-submit drafts

#### T11 — Store metadata draft completion (writer-ready)

**Priority:** P2 (blocks store submit, but only the draft prep is in
scope here — final copy needs a writer)
**Files:** `docs/store-listing.md`
**Description:** Walk every section in `store-listing.md`. For each
TBD/draft section, either fill it with first-pass copy or convert
the bullet to a clear question for the writer. Goal: hand the writer
a doc where every blocker is either answered or explicitly flagged.

**Acceptance criteria:**
- Zero unresolved TBD lines in `store-listing.md`
- "Open questions" section at the bottom summarizing what the writer
  must decide (length, age rating wording, screenshot order)
- Frontmatter `status` updated `draft` → `writer-review`

**Dependencies:** none.

#### T12 — LAUNCH_READINESS.md walkthrough draft

**Priority:** P2 (gates store submit)
**Files:** `docs/LAUNCH_READINESS.md`
**Description:** Walk every checkbox in `LAUNCH_READINESS.md`. For
items that can be auto-checked (e.g. lint clean, test counts), check
them. For items that need human action (signing keys, sign-off rows),
add a one-line "OWNER: TBD — needs <thing>" annotation in the same
bullet. Goal: when a human reads the doc, the only unchecked items
are the ones that genuinely require their hands.

**Acceptance criteria:**
- Every box in `LAUNCH_READINESS.md` is either `[x]` (verified) or
  `[ ]` with an inline OWNER + blocker note
- The five Sign-off rows at the bottom have "Date: pending" and a
  link to the relevant tracker
- Frontmatter `updated` set to today's date

**Dependencies:** none.

#### T13 — Tutorial flow annotations

**Priority:** P2 (onboarding clarity)
**Files:** `src/ui/screens/GameScreen.tsx`, `src/ui/board/*`,
`src/platform/persistence/profile.ts`, new tutorial-state module if
needed.
**Description:** Add first-war tutorial annotations for the systems
that are easy to miss in a deterministic no-dice game: market,
holding, heat, bribes, pushed strikes, and mythic ownership. Keep copy
short and data-driven so the writer can revise text later without
rewiring the flow.

**Acceptance criteria:**
- First new game shows dismissible annotations for market, holding,
  heat, bribes, and pushed strikes when each system first becomes
  relevant
- Tutorial dismissal state persists through the shared Capacitor SQLite
  profile layer, not localStorage
- Reduced-motion mode disables any tutorial animation
- Browser/DOM test covers first-seen and dismissed states

**Dependencies:** none.

#### T14 — Splash screen custom art refresh

**Priority:** P3 (store polish)
**Files:** `branding/icon.svg`, `scripts/generate-mobile-icons.sh`,
`ios/`, `android/`, generated icon/splash outputs.
**Description:** Replace the placeholder splash/icon treatment with a
Mean Streets-specific mark derived from the existing branding SVG, then
rerun `pnpm run assets:generate`. This stays in-repo: the script is the
asset factory and no outside illustrator is required.

**Acceptance criteria:**
- `branding/icon.svg` contains the final source mark
- `pnpm run assets:generate` regenerates the mobile icon and splash
  outputs without manual edits
- Generated assets are committed only if they differ from the current
  checked-in files
- `pnpm run cap:sync` succeeds after generation

**Dependencies:** none.

## Dependencies summary

```
T00 (silhouette uniqueness) - independent; should precede T09 baselines
T00.5 (currency-launder art) - can ship with T00 or independently
T01 (Node 24) - independent
T02 (version gap doc) - independent
T03 (tsconfig dedupe) - independent
T04 (LAUNDER trap) - independent
T05 (catalog cache) - independent
T06 (justPromoted AI) - prefers T03 first; not blocking
T07 (escalating currency) - independent
T08 (card merge) - independent
T09 (opponent draw anim) - independent
T10 (SPA 404 doc) - independent
T11 (store-listing draft) - independent
T12 (LAUNCH_READINESS draft) - independent
T13 (tutorial annotations) - independent
T14 (splash custom art) - independent
```

15 of 16 are fully parallel. T06 has a soft preference for T03 to
land first.

## Execution config

```yaml
batch:
  stop_on_failure: false       # one task failing shouldn't block the rest
  auto_commit: true
  max_retries_per_task: 3
priority_enabled: true
teammates: [coder, reviewer]    # Default; T08 + T09 may pull in dom/browser tester
```

## Out of scope (tracked elsewhere)

These items are in PRODUCTION.md "Post-1.0 Polish" but genuinely need
humans (not autonomous-batch-eligible):

- **Mythic balance paper-playtest** — needs human playtester per card
  (sim can converge winrate but not catch "this mythic feels broken
  in player hands")
- **Writer sign-off** on lore + achievement copy review
- **Signing keys in repo secrets** — needs human in repo settings
- **Physical device QA** — needs human + devices

The following were **wrongly excluded** in the v1 of this PRD and are
now correctly batch-eligible:

- **Mythic art editorial pass** — `compose_mythics.py::BEST_PICKS`
  is the design recipe; 173 raw sprites already extracted in
  `raw-assets/sprites/`. Editorial = swap picks, rerun pipeline. T00
  fixes the underlying picker; per-mythic curation is a follow-up
  data-file edit task.
- **Tutorial flow** — UI work, not creative work. Surface market /
  holding / heat / bribes panels with first-war annotations. Copy is
  short and writeable. (Listed as T13 below.)
- **Splash screen custom art** — `pnpm run assets:generate` runs
  `scripts/generate-mobile-icons.sh` from `branding/icon.svg`. Same
  factory. (Listed as T14.)
- **Visual polish designer pass** — most of "polish" is data-file
  edits to compose recipes + CSS tokens in
  `src/ui/theme/tokens.css`. Designer judgment is helpful, not
  required for the bulk of the work.

## Run

```bash
/task-batch docs/plans/post-1.0-polish-batch.prq.md --priority
```
