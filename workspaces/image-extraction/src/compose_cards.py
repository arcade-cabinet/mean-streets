"""
Card silhouette compositor v3.

Uses the cleaned OCR labels with section awareness.
Toughs: full-body silhouette from "bodies" section
Weapons: arm+item silhouette from "arms_items" section
"""
from pathlib import Path
from PIL import Image
import json
import hashlib


def seed_from_id(card_id: str) -> int:
    return int(hashlib.md5(card_id.encode()).hexdigest()[:8], 16)


def find_sprites_by_label_and_section(
    label: str,
    section_prefix: str,
    clean_labels: dict,
    sprites_dir: Path,
) -> list[Path]:
    """Find all sprite files matching a corrected label within a section."""
    results = []
    for sheet_data in clean_labels.values():
        for sprite_id, info in sheet_data.items():
            if info.get("corrected") != label:
                continue
            if section_prefix and not info.get("section", "").startswith(section_prefix):
                continue
            path = sprites_dir / f"{sprite_id}.png"
            if path.exists():
                results.append(path)
    return results


ARCHETYPE_BODIES = {
    "bruiser":   ["heavy", "average"],
    "enforcer":  ["heavy", "tall-longcoat", "average"],
    "snitch":    ["lean", "average"],
    "lookout":   ["lean", "average"],
    "ghost":     ["lean", "tall-longcoat"],
    "hustler":   ["average", "lean"],
    "fixer":     ["average", "lean"],
    "medic":     ["average", "lean"],
    "arsonist":  ["average", "heavy"],
    "shark":     ["average", "lean"],
    "wheelman":  ["average", "lean"],
    "fence":     ["average", "heavy"],
}

WEAPON_ITEMS = {
    "bladed":    ["knife"],
    "blunt":     ["bat", "crowbar"],
    "ranged":    ["pistol", "pistol-aim"],
    "stealth":   ["knife", "chain"],
    "explosive": ["crowbar", "fists"],
}


def render_sprite(sprite_path: Path, canvas_w: int = 120, canvas_h: int = 160) -> Image.Image:
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sprite = Image.open(sprite_path).convert("RGBA")
    sw, sh = sprite.size
    max_w = int(canvas_w * 0.9)
    max_h = int(canvas_h * 0.9)
    scale = min(max_w / sw, max_h / sh)
    new_w = max(1, int(sw * scale))
    new_h = max(1, int(sh * scale))
    sprite = sprite.resize((new_w, new_h), Image.LANCZOS)
    x = (canvas_w - new_w) // 2
    y = canvas_h - new_h - 4
    canvas.paste(sprite, (x, y), sprite)
    return canvas


def main():
    root = Path(__file__).resolve().parents[3]
    sprites_dir = root / "raw-assets" / "sprites"
    clean_labels_path = Path(__file__).parent / "sprite_labels_clean.json"
    catalog_dir = root / "config" / "compiled"
    out_dir = root / "public" / "assets" / "card-art"
    out_dir.mkdir(parents=True, exist_ok=True)

    clean_labels = json.loads(clean_labels_path.read_text())
    toughs = json.loads((catalog_dir / "toughs.json").read_text())
    mythics = json.loads((catalog_dir / "mythics.json").read_text())
    weapons = json.loads((catalog_dir / "weapons.json").read_text())

    composed = 0
    failed = 0

    # Toughs + Mythics
    for card in toughs + mythics:
        card_id = card["id"]
        archetype = card.get("archetype", "bruiser")
        body_pool = ARCHETYPE_BODIES.get(archetype, ["average"])
        seed = seed_from_id(card_id)
        body_label = body_pool[seed % len(body_pool)]

        candidates = find_sprites_by_label_and_section(body_label, "bodies", clean_labels, sprites_dir)
        if candidates:
            chosen = candidates[seed % len(candidates)]
            result = render_sprite(chosen)
            result.save(out_dir / f"{card_id}.png")
            composed += 1
        else:
            failed += 1
            print(f"  MISS tough {card_id} body={body_label}")

    # Weapons
    for card in weapons:
        card_id = card["id"]
        category = card.get("category", "bladed")
        item_pool = WEAPON_ITEMS.get(category, ["knife"])
        seed = seed_from_id(card_id)
        item_label = item_pool[seed % len(item_pool)]

        candidates = find_sprites_by_label_and_section(item_label, "arms", clean_labels, sprites_dir)
        if candidates:
            chosen = candidates[seed % len(candidates)]
            result = render_sprite(chosen, 120, 120)
            final = Image.new("RGBA", (120, 160), (0, 0, 0, 0))
            final.paste(result, (0, 20), result)
            final.save(out_dir / f"{card_id}.png")
            composed += 1
        else:
            failed += 1
            print(f"  MISS weapon {card_id} item={item_label}")

    print(f"\nComposed: {composed}, Failed: {failed}")
    print(f"Output → {out_dir}")


if __name__ == "__main__":
    main()
