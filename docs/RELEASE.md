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

## Preconditions (verify before tagging)

- `git status` clean; on `main`
- `RELEASE_GATING=1 pnpm run test:release` green (balance lock
  coverage ≥ `LOCK_COVERAGE_MIN`)
- `pnpm run test` + `pnpm run test:browser` + `pnpm run test:e2e`
  green in CI for the HEAD commit
- `pnpm run build` green
- `pnpm run cap:sync` completes without errors
- `android/app/build/` + `ios/App/build/` do not contain stale
  unsigned artifacts from a previous developer session
- `docs/PRODUCTION.md` "Launch blockers" section has zero open items
  for the target channel
- `docs/store-listing.md` peer-reviewed (titles, descriptions,
  screenshots, privacy policy, content rating)
- Signing keys available in repo secrets:
  - `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
    `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
  - `APPLE_APP_STORE_API_KEY_ID`, `APPLE_APP_STORE_API_ISSUER_ID`,
    `APPLE_APP_STORE_API_PRIVATE_KEY`

## Step 1 — Bump version

```bash
# Sync package.json, android/app/build.gradle, ios/App/App/Info.plist
pnpm version patch   # or minor / major
```

Commit separately so the tag message is clean:

```bash
git commit -am "chore(release): vX.Y.Z"
git tag vX.Y.Z
```

## Step 2 — Push tag, trigger release workflow

```bash
git push origin main
git push origin vX.Y.Z
```

This fires `.github/workflows/release.yml` (or
`mobile-release.yml` — see Epic I5 in the production-polish plan).
The workflow builds:

- Signed Android AAB (`mean-streets-vX.Y.Z.aab`)
- iOS archive (`mean-streets-vX.Y.Z.ipa`)
- Desktop web bundle (`dist/` tarball)

Artifacts land on the GitHub Releases page attached to `vX.Y.Z`.

## Step 3 — Validate artifacts

- Download the Android AAB, install on a physical device via
  `bundletool build-apks` → `adb install`
- Download the iOS IPA, install via TestFlight or `xcrun
  simctl install`
- Smoke-test the golden path: Menu → New Game → Deckbuilder → Start
  Game → first combat round → quit
- Verify saved-game persistence: close + reopen app from cold, tap
  "Load Game", arrive at same phase
- Verify SQLite survives app re-install on at least one platform

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

- `docs/PRODUCTION.md` — gating criteria / launch blockers
- `docs/ARCHITECTURE.md` — tech stack the release must respect
- `docs/plans/production-polish.prq.md` — active runway to launch
- `docs/store-listing.md` — store metadata, screenshots (TBD, Epic I3)
