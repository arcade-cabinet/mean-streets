"""
Organize extracted sprites into named subdirectories.

Reads the clean labels (OCR-corrected + manual sheet3 labels),
copies each sprite PNG into categorized subdirectories with
descriptive filenames. Outputs a clean manifest.json.
"""
from pathlib import Path
from PIL import Image
import json
import shutil


def load_all_labels(src_dir: Path) -> dict[str, dict[str, str]]:
    """Build sprite_id → (category, label) from all label sources."""
    mapping: dict[str, dict[str, str]] = {}

    # OCR-corrected labels from sheets 1 & 2
    clean_path = src_dir / "sprite_labels_clean.json"
    if clean_path.exists():
        clean = json.loads(clean_path.read_text())
        for sheet_data in clean.values():
            for sprite_id, info in sheet_data.items():
                label = info.get("corrected")
                section = info.get("section", "unknown")
                if label:
                    cat = section_to_category(section)
                    mapping[sprite_id] = {"category": cat, "label": label}

    # Manual sheet 3 labels
    s3_path = src_dir / "sheet3_labels.json"
    if s3_path.exists():
        s3 = json.loads(s3_path.read_text())
        for cat, entries in s3.items():
            if cat.startswith("_"):
                continue
            for sprite_id, label in entries.items():
                mapping[sprite_id] = {"category": cat, "label": label}

    return mapping


def section_to_category(section: str) -> str:
    s = section.lower()
    if "bodies" in s:
        return "bodies"
    if "heads" in s:
        return "heads"
    if "torso" in s:
        return "torsos"
    if "arms" in s:
        return "arms"
    if "legs" in s or "stance" in s:
        return "legs"
    if "back" in s:
        return "back"
    if "crew" in s:
        return "crew-marks"
    return "misc"


def main():
    root = Path(__file__).resolve().parents[3]
    src_dir = Path(__file__).parent
    sprites_flat = root / "raw-assets" / "sprites"
    out_base = root / "raw-assets" / "sprites"

    labels = load_all_labels(src_dir)
    print(f"Labels loaded: {len(labels)}")

    # Category stats
    cats: dict[str, int] = {}
    for info in labels.values():
        c = info["category"]
        cats[c] = cats.get(c, 0) + 1
    for c, n in sorted(cats.items()):
        print(f"  {c}: {n}")

    # Create subdirectories and copy+rename
    manifest = {}
    dupes: dict[str, int] = {}

    for sprite_id, info in sorted(labels.items()):
        cat = info["category"]
        label = info["label"]
        src_file = sprites_flat / f"{sprite_id}.png"
        if not src_file.exists():
            continue

        cat_dir = out_base / cat
        cat_dir.mkdir(parents=True, exist_ok=True)

        # Handle duplicate labels within same category
        key = f"{cat}/{label}"
        if key in dupes:
            dupes[key] += 1
            dest_name = f"{label}-{dupes[key]}.png"
        else:
            dupes[key] = 1
            dest_name = f"{label}.png"

        dest = cat_dir / dest_name
        shutil.copy2(src_file, dest)

        manifest[sprite_id] = {
            "category": cat,
            "label": label,
            "file": f"{cat}/{dest_name}",
        }

    # Save manifest
    manifest_path = out_base / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    organized = len(manifest)
    print(f"\nOrganized: {organized} sprites into {len(cats)} categories")
    print(f"Manifest → {manifest_path}")

    # List the organized tree
    for cat_dir in sorted(out_base.iterdir()):
        if cat_dir.is_dir() and cat_dir.name != ".":
            files = sorted(cat_dir.glob("*.png"))
            if files:
                print(f"\n  {cat_dir.name}/")
                for f in files:
                    print(f"    {f.name}")


if __name__ == "__main__":
    main()
