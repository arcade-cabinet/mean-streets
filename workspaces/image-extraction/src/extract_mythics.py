"""
Extract mythic silhouettes from sheets 04 and 05.
Uses same threshold-based extraction as the main pipeline.
Output: raw-assets/sprites/mythics/{name}.png
"""
from pathlib import Path
from PIL import Image
import json


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

    # Now generate the card art PNGs for the 10 mythics using the best sprites
    card_art_dir = root / "public" / "assets" / "card-art"

    # Map mythic IDs to preferred sprite names
    mythic_mapping = {
        "mythic-01": "the-silhouette",
        "mythic-02": "the-accountant",
        "mythic-03": "the-architect",
        "mythic-04": "the-informer",
        "mythic-05": "the-ghost",
        "mythic-06": "the-warlord",
        "mythic-07": "the-fixer",
        "mythic-08": "the-magistrate",
        "mythic-09": "the-phantom",
        "mythic-10": "the-reaper",
    }

    composed = 0
    for card_id, sprite_name in mythic_mapping.items():
        sprite_path = out_dir / f"{sprite_name}.png"
        if not sprite_path.exists():
            # Try alt version
            sprite_path = out_dir / f"{sprite_name}-alt.png"
        if not sprite_path.exists():
            print(f"  SKIP {card_id}: no sprite for {sprite_name}")
            continue

        # Compose onto 120x160 canvas (same as other card art)
        spr = Image.open(sprite_path).convert("RGBA")
        cw, ch = 120, 160
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))

        sw, sh = spr.size
        scale = min(int(cw * 0.85) / max(sw, 1), int(ch * 0.85) / max(sh, 1))
        nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
        spr = spr.resize((nw, nh), Image.LANCZOS)
        x = (cw - nw) // 2
        y = ch - nh - 4
        canvas.paste(spr, (x, y), spr)

        out_path = card_art_dir / f"{card_id}.png"
        canvas.save(out_path)
        composed += 1
        print(f"  composed {card_id} from {sprite_name}")

    print(f"\nDone: {composed} mythic card art PNGs composed")


if __name__ == "__main__":
    main()
