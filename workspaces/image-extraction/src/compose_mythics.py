"""
Compose mythic card art from the best-picked silhouettes.
Reads extracted sprites from raw-assets/sprites/mythics/
Outputs to public/assets/card-art/mythic-{01..10}.png
"""
from pathlib import Path
from PIL import Image


BEST_PICKS = {
    "mythic-01": "the-silhouette",
    "mythic-02": "the-accountant",
    "mythic-03": "the-architect",
    "mythic-04": "the-informer",
    "mythic-05": "the-ghost-alt2",
    "mythic-06": "the-warlord",
    "mythic-07": "the-fixer-alt",
    "mythic-08": "the-magistrate-alt2",
    "mythic-09": "the-phantom-alt",
    "mythic-10": "unknown-8",
}


def compose(sprite_path: Path, cw: int = 120, ch: int = 160) -> Image.Image:
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    spr = Image.open(sprite_path).convert("RGBA")
    sw, sh = spr.size
    scale = min(int(cw * 0.85) / max(sw, 1), int(ch * 0.85) / max(sh, 1))
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    spr = spr.resize((nw, nh), Image.LANCZOS)
    x = (cw - nw) // 2
    y = ch - nh - 4
    canvas.paste(spr, (x, y), spr)
    return canvas


def main():
    root = Path(__file__).resolve().parents[3]
    sprites_dir = root / "raw-assets" / "sprites" / "mythics"
    card_art_dir = root / "public" / "assets" / "card-art"

    for card_id, sprite_name in BEST_PICKS.items():
        sprite_path = sprites_dir / f"{sprite_name}.png"
        if not sprite_path.exists():
            print(f"  SKIP {card_id}: {sprite_name}.png not found")
            continue

        art = compose(sprite_path)
        out = card_art_dir / f"{card_id}.png"
        art.save(out)
        print(f"  {card_id} ← {sprite_name}")

    print(f"\nDone: {len(BEST_PICKS)} mythic card art PNGs")


if __name__ == "__main__":
    main()
