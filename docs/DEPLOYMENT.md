---
title: Deployment
updated: 2026-04-17
status: current
domain: ops
---

# Mean Streets — Deployment

This document owns environments, secrets, and deploy procedures. Release
readiness and blockers live in [PRODUCTION.md](./PRODUCTION.md). CI/CD
pipeline files live in `.github/workflows/`.

## Environments

| Environment | URL / Target | Trigger |
|-------------|-------------|---------|
| Web (GitHub Pages) | Auto-assigned Pages URL | `push` to `main` |
| Android (AAB) | Google Play / CI artifact | `v*.*.*` tag or manual dispatch |
| iOS (unsigned archive) | CI artifact (signed separately) | `v*.*.*` tag or manual dispatch |

## Web Deployment

**Workflow**: `.github/workflows/cd.yml`

Triggered on every push to `main`. Steps:
1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Build (`pnpm run build` → `dist/`)
3. Upload Pages artifact
4. Deploy to GitHub Pages

Concurrency group `pages-${{ github.ref }}` with `cancel-in-progress: true`
prevents stale deploy races.

**No secrets required** for web deployment. GitHub Pages token is injected
automatically via `id-token: write` + `pages: write` permissions.

## Mobile Deployment

**Workflow**: `.github/workflows/mobile-release.yml`

Triggered by `v*.*.*` tag push or manual `workflow_dispatch`. Builds both
Android (AAB) and iOS (archive) in parallel.

### Android

1. Decode signing keystore from `ANDROID_KEYSTORE_BASE64` secret.
2. Build release AAB: `./gradlew bundleRelease` with signing params.
3. If keystore secret is absent → debug AAB fallback.
4. Upload AAB as artifact: `mean-streets-android-<ref>`.

### iOS

1. `pnpm run build` → `pnpm exec cap sync ios`
2. `pod install`
3. `xcodebuild archive` (unsigned — `CODE_SIGNING_ALLOWED=NO`)
4. Upload `.xcarchive` as artifact: `mean-streets-ios-<ref>`.

iOS signing must be done manually from the downloaded archive using Xcode
Organizer with the App Store distribution certificate.

### Capacitor Sync

Before either native build, web assets are synced into the native project:

```bash
pnpm run build           # produces dist/
pnpm exec cap sync       # copies dist/ into android/app/src/main/assets/public
                         # and ios/App/App/public
```

For local development:
```bash
pnpm run cap:sync        # build + sync in one step
```

## Secrets

All secrets are stored in GitHub repository secrets. Never commit secrets to
the codebase.

| Secret | Used for | Required for |
|--------|---------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.jks` signing keystore | Signed Android release |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Signed Android release |
| `ANDROID_KEY_ALIAS` | Key alias within keystore | Signed Android release |
| `ANDROID_KEY_PASSWORD` | Key password | Signed Android release |
| `APPLE_APP_STORE_API_KEY_ID` | App Store Connect API key ID | iOS submission |
| `APPLE_APP_STORE_API_ISSUER_ID` | App Store Connect issuer ID | iOS submission |
| `APPLE_APP_STORE_API_KEY_BASE64` | Base64-encoded `.p8` key | iOS submission |
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded distribution certificate | iOS signing |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate passphrase | iOS signing |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64-encoded mobileprovision | iOS signing |

Apple secrets are not yet wired into the workflow — iOS CI currently produces
an unsigned archive. Signing automation is a post-v0.3 task.

## Versioning

Versioning is managed by **release-please** (`.github/workflows/release-please.yml`).

- Push to `main` → release-please bot opens a release PR with updated
  `CHANGELOG.md` and version bumps.
- Merge the release PR → release-please creates a `v*.*.*` tag.
- The tag triggers `mobile-release.yml`.

Do not manually create version tags. Let release-please manage them.

## Release Pipeline Order

```
ci.yml        (pull_request)   lint + typecheck + test:node + test:dom
                               + test:browser + test:e2e (4 profiles)
↓
cd.yml        (push: main)     build + deploy Pages
↓
release-please.yml             changelog + version bump PR
↓
mobile-release.yml (tag)       Android AAB + iOS archive
```

## Local Pre-Deploy Checklist

Before tagging a release manually (rare — prefer release-please):

```bash
pnpm run lint                  # must be clean
pnpm run build                 # must succeed
pnpm run test                  # node + DOM
pnpm run test:e2e              # 4 profiles
pnpm run analysis:benchmark    # check Medium winrate in [0.48, 0.52]
pnpm run test:release          # release gate
```

See [PRODUCTION.md](./PRODUCTION.md) for the full store-ready checklist.
