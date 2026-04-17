"""
Build clean label mapping from OCR'd manifest.

Uses fuzzy matching to correct OCR errors against known vocabulary,
then saves a clean sprite_labels.json.
"""
import json
from pathlib import Path
from difflib import get_close_matches

# Known vocabulary from the sprite sheets
KNOWN_LABELS = {
    # Bodies
    "lean", "average", "heavy", "fedora", "tall-longcoat",
    # Heads
    "hood", "cap", "shaved", "bandana", "pompadour", "hood-mask",
    "ski-mask", "mohawk", "monocle", "slick-femme", "bandaged-femme",
    "short-femme",
    # Torsos
    "hoodie", "bomber", "tactical-vest", "denim-jacket", "leather-jacket",
    "biker-cut", "runner", "wide-braced", "hunched", "puffer-jacket",
    "suit-coat", "apron", "overcoat",
    # Arms & Items
    "fists", "pistol", "pistol-aim", "knife", "crowbar", "chain", "bat",
    # Legs & Stances
    "plant-tank", "stalk-lunge", "flank-lean", "kneel-recover", "run",
    "casual-slouch",
    # Back accessories
    "backpack", "medbag", "shotgun", "gym-bag", "phone-holster",
    # Crew marks
    "kings_row", "iron_devils", "jade_dragon", "los_diablos",
    "southside_saints", "reapers", "dead_rabbits", "neon_snakes",
    "cobalt_syndicate",
}

# Section boundaries by Y position (approximate from sprite sheet layout)
# These are based on header positions in the 1024x1536 sheets
SECTION_Y_RANGES = [
    (0, 260, "bodies"),
    (260, 290, "heads_row1"),
    (290, 370, "heads_row2"),
    (370, 500, "torsos_head"),
    (500, 640, "torsos_body"),
    (640, 770, "torsos_lower"),
    (770, 900, "torsos_body2"),
    (900, 1000, "arms_items"),
    (1000, 1100, "legs_stances"),
    (1100, 1250, "back_accessories"),
    (1250, 1536, "crew_marks"),
]


def guess_section(y: int) -> str:
    for y0, y1, name in SECTION_Y_RANGES:
        if y0 <= y < y1:
            return name
    return "unknown"


def fuzzy_correct(ocr_text: str) -> str | None:
    """Try to match OCR text to known vocabulary."""
    if not ocr_text or len(ocr_text) < 2:
        return None

    clean = ocr_text.strip().lower().replace(" ", "-")

    # Direct match
    if clean in KNOWN_LABELS:
        return clean

    # Try with common OCR substitutions
    fixes = clean
    for old, new in [("j", "h"), ("1", "l"), ("z", "s"), ("c", "c"),
                     ("0", "o"), ("d", "d"), ("2", "r")]:
        fixes = fixes.replace(old, new)
    if fixes in KNOWN_LABELS:
        return fixes

    # Fuzzy match
    matches = get_close_matches(clean, KNOWN_LABELS, n=1, cutoff=0.5)
    if matches:
        return matches[0]

    # Partial match — OCR often drops first letter
    for known in KNOWN_LABELS:
        if len(clean) >= 3 and known.endswith(clean):
            return known
        if len(clean) >= 3 and clean in known:
            return known

    return None


def main():
    root = Path(__file__).resolve().parents[3]
    manifest_path = root / "public" / "assets" / "sprites" / "manifest.json"
    manifest = json.loads(manifest_path.read_text())

    result = {}

    for sheet_name, sprites in manifest.items():
        sheet_labels = {}
        for sprite in sprites:
            sprite_id = sprite["id"]
            ocr_label = sprite.get("label", "")
            y = sprite["bbox"][1]
            section = guess_section(y)

            corrected = fuzzy_correct(ocr_label)

            sheet_labels[sprite_id] = {
                "ocr": ocr_label,
                "corrected": corrected,
                "section": section,
                "y": y,
            }

            status = "OK" if corrected else "??"
            print(f"  {sprite_id:35s} y={y:4d} sect={section:20s} ocr={ocr_label:20s} → {corrected or '???':20s} {status}")

        result[sheet_name] = sheet_labels

    # Save
    out_path = Path(__file__).parent / "sprite_labels_clean.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(f"\nSaved → {out_path}")

    total = sum(len(v) for v in result.values())
    matched = sum(1 for v in result.values() for s in v.values() if s["corrected"])
    print(f"Total: {total}, Matched: {matched}, Unmatched: {total - matched}")


if __name__ == "__main__":
    main()
