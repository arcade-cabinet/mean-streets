#!/usr/bin/env bash
#
# generate-mobile-icons.sh
#
# Generates Android mipmap + iOS AppIcon densities from resources/icon.png
# using macOS-native `sips`. Produces the same output layout @capacitor/assets
# would, but without the sharp/libvips dependency chain.
#
# Usage: pnpm run assets:generate  (or ./scripts/generate-mobile-icons.sh)
#
# Inputs:
#   resources/icon.png                  (1024x1024 source)
#
# Outputs:
#   android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png
#   android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_round.png
#   ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-<size>.png

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/resources/icon.png"

if [[ ! -f "$SOURCE" ]]; then
  echo "error: $SOURCE does not exist"
  echo "       copy a 1024x1024 PNG to resources/icon.png first"
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "error: this script requires macOS sips"
  exit 1
fi

echo "[icons] source: $SOURCE"

# ── Android mipmap densities ─────────────────────────────────────────
# From Material Design: 48 (mdpi) 72 (hdpi) 96 (xhdpi) 144 (xxhdpi) 192 (xxxhdpi)
ANDROID_DENSITIES=("mdpi:48" "hdpi:72" "xhdpi:96" "xxhdpi:144" "xxxhdpi:192")

for entry in "${ANDROID_DENSITIES[@]}"; do
  density="${entry%%:*}"
  size="${entry##*:}"
  dir="$ROOT/android/app/src/main/res/mipmap-${density}"
  mkdir -p "$dir"
  sips -s format png -Z "$size" "$SOURCE" --out "$dir/ic_launcher.png" >/dev/null
  sips -s format png -Z "$size" "$SOURCE" --out "$dir/ic_launcher_round.png" >/dev/null
  sips -s format png -Z "$size" "$SOURCE" --out "$dir/ic_launcher_foreground.png" >/dev/null
  echo "[icons] android ${density} (${size}px) -> $dir"
done

# ── iOS AppIcon.appiconset ───────────────────────────────────────────
# AppIcon sizes (Contents.json drives slot assignment; we produce the files)
IOS_SIZES=(20 29 40 58 60 76 80 87 120 152 167 180 1024)
IOS_DIR="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$IOS_DIR"

for size in "${IOS_SIZES[@]}"; do
  sips -s format png -Z "$size" "$SOURCE" --out "$IOS_DIR/AppIcon-${size}.png" >/dev/null
done
echo "[icons] ios AppIcon @ ${#IOS_SIZES[@]} densities -> $IOS_DIR"

echo "[icons] done."
