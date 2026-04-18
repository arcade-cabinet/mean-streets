"""
Sprite sheet extractor — black on white masking + OCR labels.

1. Threshold → binary mask → flood-fill → every connected black region
2. Classify by geometry: header / sprite / letter / noise
3. Merge adjacent letters into word groups
4. OCR each word group with pytesseract
5. Pair word labels to silhouettes above by spatial proximity
6. Save sprites as transparent PNGs, labels as text in manifest
"""
from pathlib import Path
from PIL import Image
import pytesseract
import json
from collections import defaultdict


def find_all_regions(img: Image.Image, threshold: int = 180) -> list[dict]:
    gray = img.convert("L")
    w, h = gray.size
    pix = gray.load()
    visited = bytearray(w * h)
    regions = []

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if visited[idx] or pix[x, y] > threshold:
                continue
            stack = [(x, y)]
            points = []
            x0, y0, x1, y1 = x, y, x, y
            while stack:
                cx, cy = stack.pop()
                if cx < 0 or cx >= w or cy < 0 or cy >= h:
                    continue
                ci = cy * w + cx
                if visited[ci] or pix[cx, cy] > threshold:
                    continue
                visited[ci] = 1
                points.append((cx, cy))
                if cx < x0: x0 = cx
                if cy < y0: y0 = cy
                if cx > x1: x1 = cx
                if cy > y1: y1 = cy
                stack.extend([(cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)])

            regions.append({
                "bbox": (x0, y0, x1+1, y1+1),
                "w": x1-x0+1, "h": y1-y0+1,
                "area": len(points),
                "cx": (x0+x1)//2, "cy": (y0+y1)//2,
                "points": points,
            })

    return regions


def classify(r: dict) -> str:
    w, h, area = r["w"], r["h"], r["area"]
    if w > 250 and h < 80:
        return "header"
    if h > 35:
        return "sprite"
    if area < 3:
        return "noise"
    return "letter"


def merge_letters(letters: list[dict], max_gap: int = 14) -> list[dict]:
    """Group horizontally adjacent letter blobs into word regions."""
    if not letters:
        return []
    letters = sorted(letters, key=lambda r: (r["bbox"][1], r["bbox"][0]))
    words = []
    cur = None

    for ltr in letters:
        if cur is None:
            cur = {"bbox": list(ltr["bbox"]), "points": list(ltr["points"]),
                   "cx": ltr["cx"], "cy": ltr["cy"]}
            continue

        y_overlap = cur["bbox"][1] < ltr["bbox"][3] and ltr["bbox"][1] < cur["bbox"][3]
        x_gap = ltr["bbox"][0] - cur["bbox"][2]

        if y_overlap and -2 <= x_gap <= max_gap:
            cur["bbox"][0] = min(cur["bbox"][0], ltr["bbox"][0])
            cur["bbox"][1] = min(cur["bbox"][1], ltr["bbox"][1])
            cur["bbox"][2] = max(cur["bbox"][2], ltr["bbox"][2])
            cur["bbox"][3] = max(cur["bbox"][3], ltr["bbox"][3])
            cur["points"].extend(ltr["points"])
            cur["cx"] = (cur["bbox"][0] + cur["bbox"][2]) // 2
            cur["cy"] = (cur["bbox"][1] + cur["bbox"][3]) // 2
        else:
            cur["w"] = cur["bbox"][2] - cur["bbox"][0]
            cur["h"] = cur["bbox"][3] - cur["bbox"][1]
            cur["area"] = len(cur["points"])
            words.append(cur)
            cur = {"bbox": list(ltr["bbox"]), "points": list(ltr["points"]),
                   "cx": ltr["cx"], "cy": ltr["cy"]}

    if cur:
        cur["w"] = cur["bbox"][2] - cur["bbox"][0]
        cur["h"] = cur["bbox"][3] - cur["bbox"][1]
        cur["area"] = len(cur["points"])
        words.append(cur)

    # Filter tiny fragments (single-pixel debris)
    return [w for w in words if w["w"] > 8]


def ocr_region(img: Image.Image, bbox: tuple, pad: int = 6) -> str:
    """OCR a bounding box region from the source image."""
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(img.width, x1 + pad)
    y1 = min(img.height, y1 + pad)

    crop = img.crop((x0, y0, x1, y1)).convert("L")
    # Scale up for better OCR accuracy on small text
    scale = max(1, 40 // max(crop.height, 1))
    if scale > 1:
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.NEAREST)

    text = pytesseract.image_to_string(
        crop, config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+0123456789"
    ).strip()
    return text


def pair_labels(sprites: list[dict], labels: list[dict]) -> dict[int, int]:
    pairs = {}
    used = set()
    for si, spr in enumerate(sprites):
        best_j, best_d = -1, 9999
        for li, lab in enumerate(labels):
            if li in used:
                continue
            dy = lab["bbox"][1] - spr["bbox"][3]
            if dy < -5 or dy > 35:
                continue
            dx = abs(lab["cx"] - spr["cx"])
            if dx > 50:
                continue
            d = dx + dy
            if d < best_d:
                best_d = d
                best_j = li
        if best_j >= 0:
            pairs[si] = best_j
            used.add(best_j)
    return pairs


def crop_sprite(img: Image.Image, region: dict, pad: int = 2) -> Image.Image:
    x0, y0, x1, y1 = region["bbox"]
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(img.width, x1 + pad)
    y1 = min(img.height, y1 + pad)
    cw, ch = x1 - x0, y1 - y0

    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    src = img.convert("RGBA")
    src_pix = src.load()
    out_pix = out.load()

    for px, py in region["points"]:
        sx, sy = px - x0, py - y0
        if 0 <= sx < cw and 0 <= sy < ch:
            r, g, b, _ = src_pix[px, py]
            out_pix[sx, sy] = (r, g, b, 255)

    return out


def main():
    root = Path(__file__).resolve().parents[3]
    sheet_dir = root / "raw-assets" / "sprite-sheets"
    out_dir = root / "raw-assets" / "sprites"
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {}

    for sheet_path in sorted(sheet_dir.glob("*.png")):
        print(f"\n{'='*50}")
        print(f"{sheet_path.name}")
        img = Image.open(sheet_path)

        regions = find_all_regions(img)
        by_type = defaultdict(list)
        for r in regions:
            r["type"] = classify(r)
            by_type[r["type"]].append(r)

        for t in ("header", "sprite", "letter", "noise"):
            print(f"  {t}: {len(by_type[t])}")

        headers = sorted(by_type["header"], key=lambda r: r["bbox"][1])
        sprites = sorted(by_type["sprite"], key=lambda r: (r["bbox"][1] // 25, r["bbox"][0]))
        labels = merge_letters(by_type["letter"])
        print(f"  merged words: {len(labels)}")

        label_map = pair_labels(sprites, labels)
        print(f"  paired: {len(label_map)}")

        # OCR each paired label
        sheet_name = sheet_path.stem
        entries = []

        for idx, spr in enumerate(sprites):
            sprite_img = crop_sprite(img, spr)
            name = f"{sheet_name}_{idx:03d}"
            sprite_img.save(out_dir / f"{name}.png")

            entry = {
                "id": name,
                "file": f"{name}.png",
                "bbox": list(spr["bbox"]),
                "size": [spr["w"], spr["h"]],
            }

            if idx in label_map:
                lbl = labels[label_map[idx]]
                text = ocr_region(img, tuple(lbl["bbox"]))
                entry["label"] = text
                entry["label_bbox"] = list(lbl["bbox"])

            entries.append(entry)

        # OCR headers too
        header_names = []
        for hdr in headers:
            text = ocr_region(img, tuple(hdr["bbox"]))
            header_names.append(text)
        print(f"  headers: {header_names}")

        # Assign sprites to sections
        for entry in entries:
            ey = entry["bbox"][1]
            section = ""
            for i, hdr in enumerate(headers):
                if ey >= hdr["bbox"][1]:
                    section = header_names[i] if i < len(header_names) else ""
            entry["section"] = section

        manifest[sheet_name] = entries
        print(f"  saved: {len(entries)} sprites")

        # Print labels for review
        for e in entries:
            label = e.get("label", "?")
            section = e.get("section", "")
            print(f"    {e['id']:30s}  section={section:20s}  label={label}")

    out_path = out_dir / "manifest.json"
    out_path.write_text(json.dumps(manifest, indent=2))
    total = sum(len(v) for v in manifest.values())
    labeled = sum(1 for v in manifest.values() for s in v if "label" in s)
    print(f"\nTotal: {total} sprites, {labeled} labeled")
    print(f"Manifest → {out_path}")


if __name__ == "__main__":
    main()
