"""
Compose mythic card art from authored custom silhouette assignments.
Reads extracted sprites from raw-assets/sprites/mythics/
Outputs to public/assets/card-art/mythic-{01..10}.png
"""
from pathlib import Path
from collections import Counter
import json
from PIL import Image


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


def fail(message: str) -> None:
    raise SystemExit(f"compose_mythics: {message}")


def assigned_sprite(card: dict[str, object]) -> str:
    portrait = card.get("portrait")
    if not isinstance(portrait, dict) or portrait.get("mode") != "custom":
        fail(f"{card['id']}: mythics must use portrait.mode='custom'")

    sprite_name = portrait.get("sprite")
    if not isinstance(sprite_name, str) or not sprite_name:
        fail(f"{card['id']}: mythic custom portrait is missing sprite")
    return sprite_name


def main():
    root = Path(__file__).resolve().parents[3]
    sprites_dir = root / "raw-assets" / "sprites" / "mythics"
    card_art_dir = root / "public" / "assets" / "card-art"
    mythics = json.loads((root / "config" / "compiled" / "mythics.json").read_text())
    card_art_dir.mkdir(parents=True, exist_ok=True)

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
        sprite_path = sprites_dir / f"{sprite_name}.png"
        if not sprite_path.exists():
            fail(f"{card_id}: {sprite_name}.png not found in {sprites_dir}")

        art = compose(sprite_path)
        out = card_art_dir / f"{card_id}.png"
        art.save(out)
        print(f"  {card_id} ← {sprite_name}")
        composed += 1

    print(f"\nDone: {composed} mythic card art PNGs")


if __name__ == "__main__":
    main()
