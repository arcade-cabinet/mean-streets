"""
Extract mythic silhouettes from sheets 04 and 05.
Uses same threshold-based extraction as the main pipeline.
Outputs extracted sprites to raw-assets/sprites/mythics/{name}.png and then
rebuilds public/assets/card-art/mythic-{01..10}.png from the authored custom
portrait assignments.
"""
from collections import Counter
from pathlib import Path
from PIL import Image
import json

from compose_mythics import assigned_sprite, compose, fail


def extract_sprites_from_sheet(sheet_path: Path, threshold: int = 128) -> list[tuple[Image.Image, tuple[int,int,int,int]]]:
    """Extract individual sprite bounding boxes from a black-on-white sheet."""
    img = Image.open(sheet_path).convert("L")
    w, h = img.size
    pixels = img.load()

    # Binary mask: black pixels = sprite
    visited = [[False] * w for _ in range(h)]
    sprites = []

    for y in range(h):
        for x in range(w):
            if visited[y][x] or pixels[x, y] > threshold:
                continue
            # Flood fill to find connected component
            stack = [(x, y)]
            min_x, min_y, max_x, max_y = x, y, x, y
            count = 0
            while stack:
                cx, cy = stack.pop()
                if cx < 0 or cy < 0 or cx >= w or cy >= h:
                    continue
                if visited[cy][cx] or pixels[cx, cy] > threshold:
                    continue
                visited[cy][cx] = True
                count += 1
                min_x = min(min_x, cx)
                min_y = min(min_y, cy)
                max_x = max(max_x, cx)
                max_y = max(max_y, cy)
                stack.extend([(cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)])

            bw = max_x - min_x
            bh = max_y - min_y
            # Filter: sprites should be reasonably sized (not tiny dots or huge headers)
            if bw > 30 and bh > 50 and bw < w * 0.9 and bh < h * 0.7:
                sprites.append((img.crop((min_x, min_y, max_x + 1, max_y + 1)), (min_x, min_y, max_x, max_y)))

    return sprites


def main():
    root = Path(__file__).resolve().parents[3]
    sheets_dir = root / "raw-assets" / "sprite-sheets"
    out_dir = root / "raw-assets" / "sprites" / "mythics"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Known mythic names and their expected positions (top-to-bottom, left-to-right)
    # Sheet 04 layout: 3 rows of 4
    mythic_names_04 = [
        "the-silhouette", "the-accountant", "the-architect", "the-informer",
        "the-ghost-alt", "the-ghost", "the-fixer", "the-magistrate",
        "the-magistrate-alt", "the-phantom", "the-phantom-alt", "the-reaper",
    ]

    # Sheet 05 layout: 2 rows of 4
    mythic_names_05 = [
        "the-silhouette-alt", "the-accountant-alt", "the-architect-alt", "the-ghost-alt2",
        "the-warlord", "the-fixer-alt", "the-magistrate-alt2", "the-reaper-alt",
    ]

    for sheet_name, names in [
        ("silhouettes04.png", mythic_names_04),
        ("silhouettes05.png", mythic_names_05),
    ]:
        sheet_path = sheets_dir / sheet_name
        if not sheet_path.exists():
            print(f"  skip {sheet_name} (not found)")
            continue

        print(f"Processing {sheet_name}...")
        sprites = extract_sprites_from_sheet(sheet_path)

        # Sort by position: top-to-bottom, left-to-right
        sprites.sort(key=lambda s: (s[1][1] // 80, s[1][0]))

        print(f"  found {len(sprites)} sprites, expected {len(names)}")

        for i, (sprite_img, bbox) in enumerate(sprites):
            if i >= len(names):
                name = f"unknown-{i}"
            else:
                name = names[i]

            # Convert to RGBA with transparency
            rgba = Image.new("RGBA", sprite_img.size, (0, 0, 0, 0))
            for y in range(sprite_img.height):
                for x in range(sprite_img.width):
                    v = sprite_img.getpixel((x, y))
                    if v < 128:
                        rgba.putpixel((x, y), (0, 0, 0, 255))

            out_path = out_dir / f"{name}.png"
            rgba.save(out_path)
            print(f"  {name}: {sprite_img.size[0]}x{sprite_img.size[1]} → {out_path.name}")

    card_art_dir = root / "public" / "assets" / "card-art"
    card_art_dir.mkdir(parents=True, exist_ok=True)
    mythic_dir = root / "config" / "raw" / "cards" / "mythics"
    mythics = [
        json.loads(path.read_text())
        for path in sorted(mythic_dir.glob("*.json"))
    ]

    mythic_ids = {card["id"] for card in mythics}
    for path in card_art_dir.glob("mythic-*.png"):
        if path.stem in mythic_ids:
            path.unlink()

    sprite_names = [assigned_sprite(card) for card in mythics]
    duplicates = sorted(
        sprite_name for sprite_name, count in Counter(sprite_names).items() if count > 1
    )
    if duplicates:
        fail(f"duplicate mythic sprite assignments: {', '.join(duplicates)}")

    composed = 0
    for card in mythics:
        card_id = card["id"]
        sprite_name = assigned_sprite(card)
        sprite_path = out_dir / f"{sprite_name}.png"
        if not sprite_path.exists():
            fail(f"{card_id}: {sprite_name}.png not found in {out_dir}")

        canvas = compose(sprite_path)
        out_path = card_art_dir / f"{card_id}.png"
        canvas.save(out_path)
        composed += 1
        print(f"  composed {card_id} from {sprite_name}")

    print(f"\nDone: {composed} mythic card art PNGs composed")


if __name__ == "__main__":
    main()
