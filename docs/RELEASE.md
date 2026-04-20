---
title: Release Runbook
updated: 2026-04-14
status: current
domain: ops
---

# Mean Streets — Release Runbook

Step-by-step procedure for cutting a new release. Every pre-store
build goes through this runbook. For day-to-day feature work see
`docs/ARCHITECTURE.md` and `docs/PRODUCTION.md`; this file is only
about getting a build onto the stores.

## Release channels

| Channel          | Target                                        | Audience           |
| ---------------- | --------------------------------------------- | ------------------ |
| `internal`       | Google Play internal track + TestFlight IT    | Team only          |
| `beta`           | Google Play closed testing + TestFlight beta  | Opt-in testers     |
| `production`     | Google Play production + App Store production | Public             |

All three follow the same runbook; only the final store-submit step
differs.

## Preconditions

For the **automated channel** (every push to `main`), CI is the only
gate: `ci.yml` must be green for the HEAD commit. Release-please then
opens / updates a release PR automatically.

For a **store-submit channel** (`internal` / `beta` / `production`),
walk `docs/LAUNCH_READINESS.md` end-to-end. That checklist owns the
manual QA + signing-key + accessibility + persistence pre-submit sweep.
This runbook only covers what happens after Launch Readiness is signed
off.

## Step 1 — Let release-please cut the version

We use **release-please** (see `release-please-config.json` +
`.release-please-manifest.json`). On every push to `main`, the
`Release` workflow runs `release-please-action`, which inspects the
conventional-commits log and either opens / updates a release PR
("chore(main): release X.Y.Z") or, if such a PR is already merged,
creates the GitHub Release + tag.

Do **not** run `pnpm version` or `git tag` by hand. The contract is:

- Land your commits on `main` using Conventional Commits (`feat:`,
  `fix:`, `chore:`, `docs:` …). The commit verb determines the bump
  (feat → minor, fix → patch, breaking footer → major).
- Wait for the release-please PR to update on top of the new commits.
- Approve + squash-merge the release-please PR (our `automerge.yml`
  handles release-please PRs automatically — verify it ran; if it
  didn't, merge manually with `gh pr merge <pr> --squash`).
- The merge fires another `Release` run; this time `release_created`
  is `true` and the `android` + `ios` build jobs execute.

If you must override the version (rare — e.g. force a beta channel),
edit `.release-please-manifest.json` directly in a PR and let
release-please pick it up.

## Step 2 — Watch the release workflow build artifacts

This fires `.github/workflows/release.yml`. The `android` and `ios`
build jobs each upload a GitHub **Actions artifact**:

- `mean-streets-android-vX.Y.Z` — directory containing `app-*.aab`
- `mean-streets-ios-vX.Y.Z` — directory containing `App.xcarchive`

These artifacts attach to the workflow run on the **Actions tab**, not
to the GitHub Release page. Download from `gh run download <run-id>`
or the workflow run UI. Web bundle deployment is owned by `cd.yml`
(push to `main`), not the release tag.

## Step 3 — Validate artifacts

- Download `mean-streets-android-vX.Y.Z`, extract the AAB, install on
  a physical device via `bundletool build-apks` → `adb install`.
- Download `mean-streets-ios-vX.Y.Z` — note this is an **unsigned
  xcarchive**, not an IPA. To install on a real device or submit, open
  it in Xcode Organizer and re-sign with the App Store distribution
  certificate (signing automation is a post-1.0 task — see
  `LAUNCH_READINESS.md`).
- Smoke-test the golden path: Menu → New Game → Deckbuilder → Start
  Game → first combat round → quit.
- Verify saved-game persistence: close + reopen app from cold, tap
  "Load Game", arrive at same phase.
- Verify SQLite survives app re-install on at least one platform.

## Step 4 — Submit to stores

### Google Play

1. Play Console → Internal testing → Create new release
2. Upload AAB
3. Release notes: paste the `CHANGELOG.md` entry for `vX.Y.Z`
4. Review → Rollout

### Apple App Store

1. TestFlight → Internal testing group → `+` → Select build
2. Submit for review (for production channel only)
3. App Store Connect → My Apps → Version `X.Y.Z` → What to Test
   (paste changelog)

## Step 5 — Monitor

- First 24 h: watch Play Console ANR/crash dashboard and App Store
  Connect crash reports
- First 72 h: track reviews, respond to crash-inducing reviews with
  a patch plan
- First 7 d: diff aggregated metrics (session length, d1 retention)
  against the prior release baseline

## Step 6 — Tag regression point, merge changelog

```bash
gh release edit vX.Y.Z --notes-file CHANGELOG.md
```

## Rollback

If the release breaks in the first 2 h:

1. Play Console → Releases → Halt rollout (90 % of installs are
   paused within 10 min)
2. App Store Connect → Pause manual release
3. Revert offending commit on `main`
4. Follow this runbook from Step 1 with the patch version

If the release ships with a content bug but no crash:

- Hold at the current store build, push the fix in the next
  scheduled release cycle.

## Release cadence target

| Phase               | Cadence                    |
| ------------------- | -------------------------- |
| Pre-launch beta     | Weekly internal builds     |
| Soft launch         | Bi-weekly minor releases   |
| Global launch       | Monthly minor; hotfix AOE  |
| Post-launch         | Monthly minor + ad-hoc     |

## Related

- `docs/PRODUCTION.md` — implementation status + post-1.0 polish list
- `docs/LAUNCH_READINESS.md` — pre-store-submit manual QA sweep
- `docs/STATE.md` — current branch state + recent releases
- `docs/ARCHITECTURE.md` — tech stack the release must respect
- `docs/store-listing.md` — store metadata, screenshots (draft)
