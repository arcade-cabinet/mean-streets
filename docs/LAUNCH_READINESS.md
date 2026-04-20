---
title: Launch Readiness Checklist
updated: 2026-04-19
status: current
domain: ops
---

# Launch Readiness — Pre-Submission Sweep

This is the manual QA pass to run before clicking submit on Google
Play / App Store. The automated matrix on `main` is assumed green:
- `ci.yml` (PR + push): lint / tsc / node / DOM / browser /
  release-gate / build
- `cd.yml` (push: main): Playwright e2e on 4 device profiles, Pages
  deploy, debug APK
This file covers everything that CI/CD cannot: physical-device behavior,
accessibility on real screen readers, signing keys, store metadata,
sign-off.

Every box below must be checked OR have an explicit owner + ticket
reference before the build moves forward.

## Balance sanity (local)

Run before signing off, even though CI gates the same data:

- [ ] `pnpm run analysis:benchmark` — Medium AI-vs-AI winrate in
      [0.48, 0.52] for ≥ 3 consecutive seeded runs
- [ ] `pnpm run analysis:autobalance:dry` reports 0 unstable cards
      OR every unstable card has a planned tuning step
- [ ] `sim/reports/turf/balance-history.json` committed and shows
      ≥ 70 % of cards locked

## Mobile flows (real device, NOT just emulator)

- [ ] Android physical: golden path — menu → difficulty → card garage
      (merge + toggles) → war start → first turf engagement →
      seize-and-promote → win/loss → quit
- [ ] iOS physical: same golden path
- [ ] Android: kill app → reopen → "Load Game" resumes the same phase
- [ ] iOS: same resume flow
- [ ] Notch / safe-area not clipped on iPhone with notch
- [ ] Status bar contrast OK against menu/game backgrounds
- [ ] Pinch / zoom / browser chrome do NOT activate (PWA-mode only)
- [ ] App icon renders at all densities (`pnpm run assets:generate`
      already ran, mipmap-* + AppIcon-* are committed)
- [ ] Splash screen colour matches brand `#090909`

## Accessibility

- [ ] `e2e/accessibility.spec.ts` green on all 4 device profiles
- [ ] VoiceOver (iOS): main menu announces "Mean Streets …" + each
      menu chip
- [ ] TalkBack (Android): same
- [ ] Tap-only flow (`tap-only` e2e) reaches buildup with no drag
- [ ] System "reduce motion" honoured (no GSAP/Tone bursts on launch)

## Persistence

- [ ] Settings (audio, motion-reduced, rules-seen) survive an app
      restart on physical device
- [ ] Active-run persists across kill+relaunch
- [ ] Profile unlocks recorded in SQLite — verify via
      `adb shell run-as com.arcadecabinet.meanstreets sqlite3 …`
      OR a single in-app debug screen
- [ ] No `localStorage` / `sessionStorage` references in
      `pnpm run lint` (biome rule already enforces — confirm green)

## Visual

- [ ] `pnpm run visual:export:headless` — every fixture renders
      without console errors
- [ ] `docs/VISUAL_REVIEW.md` Gap Analysis Worksheet rows have a
      reviewer signoff or an open ticket
- [ ] `public/assets/logo.png` matches the in-app + store icon set

## Store metadata

- [ ] `docs/store-listing.md` open-questions section is empty
- [ ] Privacy policy URL resolves
- [ ] Support email functional and not full
- [ ] Screenshots at every required size landed in
      `artifacts/store/<platform>/<density>/`
- [ ] Content rating questionnaire answers reviewed by legal/EHC

## Release infrastructure

- [ ] `docs/RELEASE.md` runbook reviewed end-to-end
- [ ] Signing keys present in repo secrets:
      `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
      `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
      `APPLE_APP_STORE_API_KEY_ID`, `APPLE_APP_STORE_API_ISSUER_ID`,
      `APPLE_APP_STORE_API_PRIVATE_KEY`
- [ ] Latest release tag's `Release` workflow run produced both
      `mean-streets-android-vX.Y.Z` (containing the AAB) and
      `mean-streets-ios-vX.Y.Z` (containing the xcarchive) Actions
      artifacts. These attach to the workflow run on the **Actions
      tab**, not to the GitHub Release page.

## Crash + telemetry

- [ ] App boots cleanly with no console errors on Android + iOS
- [ ] `adb logcat` and Xcode console show no Capacitor plugin errors
- [ ] Memory under 100 MB at idle main menu
- [ ] Cold launch < 3 s on Pixel 7 / iPhone 14 baseline

## Sign-off

| Role            | Name      | Date | Notes                       |
|-----------------|-----------|------|-----------------------------|
| Product owner   |           |      |                             |
| Tech lead       |           |      |                             |
| QA lead         |           |      |                             |
| Design lead     |           |      |                             |
| Compliance/Legal|           |      |                             |

When all five sign off and every box above is checked, hand off to
[RELEASE.md](./RELEASE.md) — release-please owns the version bump,
the human just opens / merges the release PR.

## Links

- [RELEASE.md](./RELEASE.md) — what happens after sign-off
- [PRODUCTION.md](./PRODUCTION.md) — partial / post-1.0 tracker
- [STATE.md](./STATE.md) — what's on `main` right now
- [store-listing.md](./store-listing.md) — store copy + metadata draft
- [VISUAL_REVIEW.md](./VISUAL_REVIEW.md) — visual gap-analysis worksheet
