---
title: Deployment
updated: 2026-04-20
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

### Hosting Requirements

If this app is moved off GitHub Pages onto a host with SPA fallback
rewrites, `/assets/*` must still return a real 404 for missing files.
Do not rewrite missing asset requests to `index.html`. Our card and
hero image surfaces already fall back on `<img onError>`, but serving
HTML for a missing PNG wastes a request and obscures the real failure.

Required invariant:

- App routes such as `/cards`, `/collection`, and `/` may rewrite to
  `index.html`.
- Asset routes such as `/assets/card-art/card-001.png` must not rewrite
  to `index.html`.

Reference snippets for common hosts:

**Cloudflare Pages**

Use `_redirects` so SPA fallback excludes the asset tree:

```text
/assets/*  /assets/:splat  200
/*         /index.html     200
```

If custom headers are used, `_headers` should target `/assets/*`
separately from the SPA shell; do not attach HTML-only caching rules to
that asset path.

**Netlify**

Use `_redirects` with the same exclusion order:

```text
/assets/*  /assets/:splat  200
/*         /index.html     200
```

**Vercel**

Use `vercel.json` rewrites that leave `/assets/*` alone and only rewrite
app routes:

```json
{
  "rewrites": [{ "source": "/((?!assets/).*)", "destination": "/index.html" }]
}
```

Any future non-GitHub host config must preserve this rule before launch.

## Mobile Deployment

**Workflow**: `.github/workflows/release.yml` — same workflow that
runs release-please. Mobile build jobs (`android`, `ios`) only fire
when the release-please step's `release_created` output is `true`,
i.e. when a release PR has been merged and a fresh tag exists.

### Android

1. Decode signing keystore from `ANDROID_KEYSTORE_BASE64` secret.
2. Build release AAB: `./gradlew bundleRelease` with signing params.
3. If keystore secret is absent → debug AAB fallback.
4. Upload AAB as artifact: `mean-streets-android-vX.Y.Z`.

### iOS

1. `pnpm run build` → `pnpm exec cap sync ios`
2. `xcodebuild -project App.xcodeproj -scheme App archive` (unsigned —
   `CODE_SIGNING_ALLOWED=NO`). Capacitor 8 uses Swift Package Manager,
   not CocoaPods; there is no `Podfile`.
3. Upload `.xcarchive` as artifact: `mean-streets-ios-vX.Y.Z`.

iOS signing must be done manually from the downloaded archive using
Xcode Organizer with the App Store distribution certificate.

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

Versioning is managed by **release-please**, which runs as the first
job inside `.github/workflows/release.yml`.

- Push to `main` → `release.yml` runs release-please, which opens or
  updates a release PR ("chore(main): release X.Y.Z") with the
  CHANGELOG diff and the manifest bump.
- Approve + squash-merge the release PR (our `automerge.yml` handles
  release-please PRs automatically).
- The merge re-fires `release.yml`; this time `release_created` is
  `true` and the `android` + `ios` build jobs execute against the new
  tag.

Do not manually create version tags. Let release-please manage them.

## Release Pipeline Order

```
ci.yml        (pull_request)   lint + typecheck + test:node + test:dom
                               + test:browser + release-gate + build
↓
release.yml   (push: main)     release-please opens/updates release PR
                               (no artifact build until that PR merges)
↓
release.yml   (push: main, after release PR merge)
                               release-please creates tag → android AAB
                               + iOS archive jobs run
↓
cd.yml        (push: main)     e2e (4 profiles) + deploy Pages + debug APK
```

`cd.yml` and `release.yml` both fire on every push to `main`; they
run in parallel except for the artifact-build jobs in `release.yml`
which only fire on the actual tag-creating push.

## Local Pre-Deploy Checklist

Before tagging a release manually (rare — prefer release-please):

```bash
pnpm run lint                  # must be clean
pnpm run build                 # must succeed
pnpm run test                  # node + DOM
pnpm run test:e2e              # smoke flow
pnpm run test:e2e:full         # full local E2E across 4 profiles
pnpm run analysis:benchmark    # check Medium winrate in [0.48, 0.52]
pnpm run test:release          # release gate
```

See [PRODUCTION.md](./PRODUCTION.md) for the full store-ready checklist.
