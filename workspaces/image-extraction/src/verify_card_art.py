"""
Verify generated card art coverage and uniqueness.

This is intended to run immediately after the art pipeline so duplicate portrait
regressions fail loudly instead of silently shipping back into the repo.
"""

from __future__ import annotations

from pathlib import Path

import hashlib
import json
import sys


STACK_MANIFEST = "portrait-stacks.json"


def md5sum(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text())


def fail(message: str) -> None:
    print(f"card-art verify: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    compiled_root = root / "config" / "compiled"
    art_root = root / "public" / "assets" / "card-art"

    toughs = load_json(compiled_root / "toughs.json")
    mythics = load_json(compiled_root / "mythics.json")
    weapons = load_json(compiled_root / "weapons.json")
    drugs = load_json(compiled_root / "drugs.json")
    currency = load_json(compiled_root / "currency.json")

    for label, cards in (
        ("toughs", toughs),
        ("weapons", weapons),
        ("drugs", drugs),
        ("currency", currency),
    ):
        invalid_portrait = [
            card["id"]
            for card in cards
            if card.get("portrait", {}).get("mode") != "stack"
        ]
        if invalid_portrait:
            fail(f"{label} missing locked stack portraits: {', '.join(invalid_portrait)}")

    invalid_mythics = [
        card["id"]
        for card in mythics
        if card.get("portrait", {}).get("mode") != "custom"
    ]
    if invalid_mythics:
        fail(f"mythics missing custom portrait assignments: {', '.join(invalid_mythics)}")

    non_mythic_ids = [
        *(card["id"] for card in toughs),
        *(card["id"] for card in weapons),
        *(card["id"] for card in drugs),
        *(card["id"] for card in currency),
    ]
    mythic_ids = [card["id"] for card in mythics]
    expected_ids = [*non_mythic_ids, *mythic_ids]

    actual_ids = sorted(path.stem for path in art_root.glob("*.png"))
    missing = sorted(set(expected_ids) - set(actual_ids))
    unexpected = sorted(set(actual_ids) - set(expected_ids))
    if missing:
        fail(f"missing PNGs for: {', '.join(missing)}")
    if unexpected:
        fail(f"unexpected PNGs present: {', '.join(unexpected)}")

    manifest_path = art_root / STACK_MANIFEST
    if not manifest_path.exists():
        fail(f"missing locked stack manifest: {STACK_MANIFEST}")
    manifest = load_json(manifest_path)
    manifest_ids = sorted(manifest.keys())
    if manifest_ids != sorted(non_mythic_ids):
        fail("locked stack manifest does not exactly match the non-mythic card pool")

    total_hashes = {md5sum(art_root / f"{card_id}.png") for card_id in expected_ids}
    non_mythic_hashes = {md5sum(art_root / f"{card_id}.png") for card_id in non_mythic_ids}
    mythic_hashes = {md5sum(art_root / f"{card_id}.png") for card_id in mythic_ids}

    if len(non_mythic_hashes) != len(non_mythic_ids):
        fail(
            "non-mythic portraits are not all unique "
            f"({len(non_mythic_hashes)}/{len(non_mythic_ids)})"
        )
    if len(mythic_hashes) != len(mythic_ids):
        fail(
            "mythic portraits are not all unique "
            f"({len(mythic_hashes)}/{len(mythic_ids)})"
        )
    if len(total_hashes) != len(expected_ids):
        fail(
            "total portrait set is not fully unique "
            f"({len(total_hashes)}/{len(expected_ids)})"
        )

    print(
        "card-art verify: ok "
        f"total={len(expected_ids)} "
        f"non_mythic={len(non_mythic_ids)} "
        f"mythic={len(mythic_ids)} "
        f"manifest={len(manifest_ids)}"
    )


if __name__ == "__main__":
    main()
