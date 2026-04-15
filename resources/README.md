# Mobile asset generation

Source asset directory for mobile icon generation. The repo uses a
lightweight macOS-native `sips`-based script (no sharp/libvips
dependency chain) because `@capacitor/assets` requires a sharp
toolchain that does not build cleanly under pnpm.

## Required input

- `resources/icon.png` — 1024×1024 transparent PNG, square, logo only

## Generation command

```bash
pnpm run assets:generate
```

Produces:

- Android mipmap densities (`mdpi 48px`, `hdpi 72px`, `xhdpi 96px`,
  `xxhdpi 144px`, `xxxhdpi 192px`) under
  `android/app/src/main/res/mipmap-*/`
  (`ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`)
- iOS AppIcon slots (`20 29 40 58 60 76 80 87 120 152 167 180 1024`)
  under `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

## Splash screens

Splash generation is not yet wired here — Capacitor's built-in
SplashScreen plugin uses the `backgroundColor` (`#090909`) defined in
`capacitor.config.ts`. When art direction lands a real splash asset,
add `resources/splash.png` and extend `scripts/generate-mobile-icons.sh`
to produce the LaunchScreen.storyboard densities.

## Status

- [x] `resources/icon.png` in place (1024×1024)
- [x] Android mipmap densities
- [x] iOS AppIcon set
- [ ] Splash screen PNG (waiting on final art)

## Source asset updates

The current `icon.png` is a copy of `public/assets/logo.png`. If the
in-app logo changes, re-copy or re-author here and re-run
`pnpm run assets:generate`.
