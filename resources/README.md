# Mobile asset generation

This directory is where @capacitor/assets reads source logos and splash
screens from to generate every Android + iOS density in one command.

## Required inputs (for launch)

- `resources/icon.png` — 1024×1024 transparent PNG, square, logo only
- `resources/icon-foreground.png` — 432×432 Android adaptive foreground
- `resources/icon-background.png` — 432×432 Android adaptive background
  (can be a solid color PNG)
- `resources/splash.png` — 2732×2732 center-anchored, dark-tone splash

## Generation command

```bash
pnpm exec cap-assets generate --ios --android
```

(registered as `pnpm run assets:generate` in package.json)

## Status

- [ ] icon.png (waiting on final logo from design)
- [ ] icon-foreground.png
- [ ] icon-background.png
- [ ] splash.png

Until sources land, Android + iOS fall back on the Capacitor default
icons (ic_launcher.png, etc. already present under android/app/src/main/res/).

