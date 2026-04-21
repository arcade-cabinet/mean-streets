"""
Non-mythic card art compositor.

Generates deterministic composite silhouette stacks for every non-mythic card.
Each portrait is a locked layer stack seeded by card id and spread across the
available sprite library so the factory uses the full silhouette set instead of
collapsing large card clusters onto identical PNGs.

Mythics are handled separately by compose_mythics.py and stay on their curated
BEST_PICKS path rather than using this composite stack system.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import hashlib
import json

from PIL import Image, ImageOps


CANVAS_W = 120
CANVAS_H = 160
BOTTOM_MARGIN = 4
STACK_MANIFEST = "portrait-stacks.json"
TOUGH_TEMPLATE_NAMES = ("street-left", "street-right", "ambush", "wall-lean")
TOUGH_PALETTE_NAMES = ("ember", "ash", "rust", "smoke")
ITEM_TEMPLATE_NAMES = ("triptych-left", "triptych-right", "totem", "fan")
ITEM_PALETTE_NAMES = {
    "weapon": ("steel", "gunmetal", "slate"),
    "drug": ("violet", "toxic", "haze"),
    "currency": ("brass", "olive", "laundered"),
}


TOUGH_PALETTES: tuple[tuple[tuple[int, int, int, int], ...], ...] = (
    (
        (226, 208, 182, 40),
        (158, 78, 54, 68),
        (102, 44, 30, 116),
        (17, 15, 15, 235),
        (233, 173, 110, 48),
    ),
    (
        (188, 196, 202, 34),
        (176, 96, 68, 72),
        (120, 54, 38, 122),
        (9, 9, 10, 242),
        (219, 194, 148, 44),
    ),
    (
        (214, 186, 150, 36),
        (148, 72, 48, 78),
        (86, 42, 34, 112),
        (11, 10, 10, 240),
        (176, 126, 91, 52),
    ),
    (
        (162, 176, 184, 38),
        (154, 85, 64, 66),
        (111, 51, 42, 118),
        (12, 11, 12, 238),
        (220, 205, 178, 42),
    ),
)

ITEM_PALETTES: dict[str, tuple[tuple[tuple[int, int, int, int], ...], ...]] = {
    "weapon": (
        (
            (170, 187, 205, 44),
            (130, 78, 62, 76),
            (74, 84, 98, 122),
            (15, 18, 24, 242),
        ),
        (
            (194, 181, 170, 40),
            (156, 96, 74, 74),
            (88, 100, 117, 118),
            (16, 18, 22, 242),
        ),
        (
            (156, 176, 194, 42),
            (166, 108, 80, 68),
            (72, 88, 104, 126),
            (10, 12, 18, 244),
        ),
    ),
    "drug": (
        (
            (202, 168, 216, 40),
            (119, 78, 138, 72),
            (76, 40, 92, 124),
            (18, 11, 24, 244),
        ),
        (
            (168, 208, 181, 38),
            (88, 134, 106, 72),
            (60, 84, 74, 120),
            (14, 12, 18, 244),
        ),
        (
            (214, 192, 158, 34),
            (136, 94, 138, 68),
            (86, 52, 92, 122),
            (18, 11, 24, 244),
        ),
    ),
    "currency": (
        (
            (228, 208, 136, 44),
            (164, 126, 60, 74),
            (108, 88, 44, 124),
            (20, 18, 10, 244),
        ),
        (
            (200, 214, 178, 42),
            (142, 120, 74, 74),
            (88, 82, 42, 122),
            (18, 16, 10, 244),
        ),
        (
            (216, 204, 178, 38),
            (124, 134, 92, 72),
            (84, 90, 54, 120),
            (16, 16, 10, 244),
        ),
    ),
}


TOUGH_TEMPLATES: tuple[tuple[dict[str, Any], ...], ...] = (
    (
        {"role": "back", "scale": 0.62, "x": -18, "y": 6, "rotation": -12, "mirror": True, "color": 0},
        {"role": "pose", "scale": 0.74, "x": 16, "y": 8, "rotation": 10, "mirror": False, "color": 1},
        {"role": "torso", "scale": 0.80, "x": -5, "y": 2, "rotation": -6, "mirror": True, "color": 2},
        {"role": "body", "scale": 0.98, "x": 0, "y": 0, "rotation": 0, "mirror": False, "color": 3},
        {"role": "arms", "scale": 0.62, "x": 18, "y": -8, "rotation": -14, "mirror": False, "color": 4},
    ),
    (
        {"role": "back", "scale": 0.58, "x": 18, "y": 10, "rotation": 14, "mirror": False, "color": 0},
        {"role": "pose", "scale": 0.76, "x": -12, "y": 6, "rotation": -10, "mirror": True, "color": 1},
        {"role": "torso", "scale": 0.82, "x": 8, "y": 2, "rotation": 6, "mirror": False, "color": 2},
        {"role": "body", "scale": 0.96, "x": 0, "y": 0, "rotation": 2, "mirror": True, "color": 3},
        {"role": "arms", "scale": 0.60, "x": -18, "y": -6, "rotation": 12, "mirror": True, "color": 4},
    ),
    (
        {"role": "back", "scale": 0.60, "x": -10, "y": 12, "rotation": -8, "mirror": False, "color": 0},
        {"role": "pose", "scale": 0.72, "x": 20, "y": 12, "rotation": 18, "mirror": False, "color": 1},
        {"role": "torso", "scale": 0.84, "x": 0, "y": 2, "rotation": 0, "mirror": False, "color": 2},
        {"role": "body", "scale": 1.00, "x": -2, "y": -2, "rotation": -2, "mirror": False, "color": 3},
        {"role": "arms", "scale": 0.58, "x": 16, "y": -10, "rotation": -18, "mirror": True, "color": 4},
    ),
    (
        {"role": "back", "scale": 0.56, "x": 20, "y": 12, "rotation": 10, "mirror": True, "color": 0},
        {"role": "pose", "scale": 0.78, "x": -18, "y": 4, "rotation": -12, "mirror": False, "color": 1},
        {"role": "torso", "scale": 0.80, "x": 4, "y": 4, "rotation": 4, "mirror": True, "color": 2},
        {"role": "body", "scale": 0.94, "x": 0, "y": 0, "rotation": 0, "mirror": True, "color": 3},
        {"role": "arms", "scale": 0.60, "x": -14, "y": -8, "rotation": 16, "mirror": False, "color": 4},
    ),
)

ITEM_TEMPLATES: tuple[tuple[dict[str, Any], ...], ...] = (
    (
        {"role": "backdrop", "scale": 0.58, "x": -18, "y": 10, "rotation": -18, "mirror": False, "color": 0},
        {"role": "support", "scale": 0.68, "x": 16, "y": 2, "rotation": 14, "mirror": True, "color": 1},
        {"role": "front", "scale": 0.88, "x": 0, "y": -2, "rotation": 0, "mirror": False, "color": 3},
        {"role": "badge", "scale": 0.46, "x": 26, "y": -20, "rotation": 16, "mirror": False, "color": 2},
    ),
    (
        {"role": "backdrop", "scale": 0.56, "x": 20, "y": 12, "rotation": 20, "mirror": True, "color": 0},
        {"role": "support", "scale": 0.70, "x": -14, "y": 6, "rotation": -12, "mirror": False, "color": 1},
        {"role": "front", "scale": 0.84, "x": 0, "y": -4, "rotation": -4, "mirror": True, "color": 3},
        {"role": "badge", "scale": 0.44, "x": -28, "y": -18, "rotation": -18, "mirror": True, "color": 2},
    ),
    (
        {"role": "backdrop", "scale": 0.60, "x": -10, "y": 14, "rotation": -8, "mirror": False, "color": 0},
        {"role": "support", "scale": 0.66, "x": 18, "y": 12, "rotation": 10, "mirror": True, "color": 1},
        {"role": "front", "scale": 0.90, "x": 0, "y": -4, "rotation": 2, "mirror": False, "color": 3},
        {"role": "badge", "scale": 0.42, "x": 0, "y": -28, "rotation": 0, "mirror": False, "color": 2},
    ),
    (
        {"role": "backdrop", "scale": 0.62, "x": 0, "y": 16, "rotation": 0, "mirror": True, "color": 0},
        {"role": "support", "scale": 0.70, "x": -20, "y": 4, "rotation": -20, "mirror": False, "color": 1},
        {"role": "front", "scale": 0.82, "x": 6, "y": -2, "rotation": 8, "mirror": False, "color": 3},
        {"role": "badge", "scale": 0.40, "x": 24, "y": -16, "rotation": 18, "mirror": True, "color": 2},
    ),
)


WEAPON_PRIMARY = {
    "bladed": ["hook-blade", "knife", "chain"],
    "blunt": ["crowbar", "fist-punch", "brass-knuckles"],
    "ranged": ["pistol-compact", "pistol-full", "holster-pistol"],
    "stealth": ["chain", "hook-blade", "knife", "burner-phone"],
    "explosive": ["grenade", "ammo-box", "paper-bag"],
}

WEAPON_SUPPORT = {
    "bladed": ["brass-knuckles", "chain", "fist-small"],
    "blunt": ["fist-small", "fist-front", "fist-raised", "chain"],
    "ranged": ["ammo-box", "burner-phone", "pistol", "holster-pistol"],
    "stealth": ["fist-small", "burner-phone", "chain"],
    "explosive": ["ammo-box", "duffel-bag", "burner-phone", "paper-bag"],
}

DRUG_PRIMARY = {
    "stimulant": ["pill-bottle", "prescription-bottle", "syringe"],
    "narcotic": ["drug-bag", "wrapped-bricks", "brick-kilo", "syringe"],
    "sedative": ["pill-bottle", "herb-bag", "prescription-bottle"],
    "steroid": ["syringe", "prescription-bottle", "pill-bottle"],
    "hallucinogen": ["herb-bag", "drug-bag", "burner-phone"],
}

DRUG_SUPPORT = {
    "stimulant": ["burner-phone", "money-clip", "pill-bottle", "prescription-bottle"],
    "narcotic": ["wrapped-bricks", "brick-kilo", "drug-bag", "paper-bag"],
    "sedative": ["herb-bag", "pill-bottle", "prescription-bottle", "wallet"],
    "steroid": ["syringe", "prescription-bottle", "pill-bottle", "money-clip"],
    "hallucinogen": ["burner-phone", "herb-bag", "drug-bag", "pill-bottle"],
}

CURRENCY_PRIMARY = {
    "100": ["wallet", "money-clip", "paper-bag"],
    "1000": ["cash-stack", "paper-bag", "duffel-bag"],
    "launder": ["cash-stack", "money-clip", "wallet", "paper-bag", "duffel-bag", "burner-phone"],
}

CURRENCY_SUPPORT = {
    "100": ["wallet", "money-clip", "burner-phone"],
    "1000": ["cash-stack", "paper-bag", "duffel-bag", "wallet"],
    "launder": ["burner-phone", "money-clip", "wallet", "cash-stack", "paper-bag"],
}


@dataclass(frozen=True)
class LayerPlan:
    role: str
    sprite: str
    scale: float
    x: int
    y: int
    rotation: float
    mirror: bool
    color: tuple[int, int, int, int]
    fill: float
    anchor: str


def stable_int(*parts: object) -> int:
    payload = "::".join(str(part) for part in parts)
    return int(hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16], 16)


def sprite_key(path: Path) -> str:
    return f"{path.parent.name}/{path.name}"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def stack_portrait(card: dict[str, Any]) -> dict[str, Any]:
    portrait = card.get("portrait")
    if not isinstance(portrait, dict):
        raise RuntimeError(f"{card['id']}: non-mythic card is missing portrait definition")
    if portrait.get("mode") != "stack":
        raise RuntimeError(
            f"{card['id']}: non-mythic portrait mode must be 'stack', got {portrait.get('mode')!r}"
        )
    return portrait


def pattern_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def glob_pngs(d: Path) -> list[Path]:
    return sorted(d.glob("*.png")) if d.exists() else []


def load_sprite_index(sprites_root: Path) -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = {}
    for directory in sorted(sprites_root.iterdir()):
        if directory.is_dir():
            index[directory.name] = glob_pngs(directory)
    return index


def dedupe_paths(paths: list[Path]) -> list[Path]:
    seen: set[str] = set()
    deduped: list[Path] = []
    for path in paths:
        key = sprite_key(path)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(path)
    return deduped


def match_sprites(
    sprite_index: dict[str, list[Path]],
    categories: list[str],
    patterns: list[str],
) -> list[Path]:
    if not patterns:
        return []

    results: list[Path] = []
    lowered = tuple(pattern.lower() for pattern in patterns)
    for category in categories:
        for path in sprite_index.get(category, []):
            stem = path.stem.lower()
            if any(stem == pattern or stem.startswith(f"{pattern}-") for pattern in lowered):
                results.append(path)
    return dedupe_paths(results)


def lookup_pool(
    sprite_index: dict[str, list[Path]],
    categories: list[str],
    patterns: list[str],
    fallback_categories: list[str],
) -> list[Path]:
    matched = match_sprites(sprite_index, categories, patterns)
    if matched:
        return matched

    fallback: list[Path] = []
    for category in fallback_categories:
        fallback.extend(sprite_index.get(category, []))
    return dedupe_paths(fallback)


def choose_sprite(
    pool: list[Path],
    usage: Counter[str],
    taken: set[str],
    token: str,
    salt: int,
) -> Path | None:
    if not pool:
        return None

    ordered = sorted(
        dedupe_paths(pool),
        key=lambda path: (
            usage[sprite_key(path)],
            stable_int(token, sprite_key(path)),
        ),
    )
    available = [path for path in ordered if sprite_key(path) not in taken] or ordered
    return available[salt % len(available)]


def jitter_int(token: str, lo: int, hi: int) -> int:
    if hi <= lo:
        return lo
    return lo + stable_int(token) % (hi - lo + 1)


def jitter_float(token: str, lo: float, hi: float, precision: int = 3) -> float:
    if hi <= lo:
        return round(lo, precision)
    span = hi - lo
    unit = (stable_int(token) % 10_000) / 10_000
    return round(lo + span * unit, precision)


def named_index(override: Any, names: tuple[str, ...], token: str) -> int:
    if isinstance(override, str) and override in names:
        return names.index(override)
    return stable_int(token) % len(names)


def tint_alpha(sprite: Image.Image, rgba: tuple[int, int, int, int]) -> Image.Image:
    alpha = sprite.getchannel("A")
    scaled_alpha = alpha.point(lambda px: min(255, round(px * rgba[3] / 255)))
    tinted = Image.new("RGBA", sprite.size, rgba[:3] + (0,))
    tinted.putalpha(scaled_alpha)
    return tinted


def render_layer(plan: LayerPlan, sprites_root: Path) -> Image.Image:
    sprite = Image.open(sprites_root / plan.sprite).convert("RGBA")
    if plan.mirror:
        sprite = ImageOps.mirror(sprite)
    sprite = tint_alpha(sprite, plan.color)

    sw, sh = sprite.size
    target_w = CANVAS_W * plan.fill * plan.scale
    target_h = CANVAS_H * plan.fill * plan.scale
    scale = min(target_w / max(sw, 1), target_h / max(sh, 1))
    resized = sprite.resize(
        (max(1, int(sw * scale)), max(1, int(sh * scale))),
        Image.LANCZOS,
    )
    if abs(plan.rotation) > 0.01:
        resized = resized.rotate(plan.rotation, resample=Image.BICUBIC, expand=True)
    return resized


def render_stack(layers: list[LayerPlan], sprites_root: Path) -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    for plan in layers:
        layer = render_layer(plan, sprites_root)
        if plan.anchor == "center":
            x = (CANVAS_W - layer.width) // 2 + plan.x
            y = (CANVAS_H - layer.height) // 2 + plan.y
        else:
            x = (CANVAS_W - layer.width) // 2 + plan.x
            y = CANVAS_H - layer.height - BOTTOM_MARGIN + plan.y
        canvas.alpha_composite(layer, (x, y))
    return canvas


def layer_signature(plan: LayerPlan) -> tuple[object, ...]:
    return (
        plan.role,
        plan.sprite,
        plan.scale,
        plan.x,
        plan.y,
        plan.rotation,
        plan.mirror,
        plan.color,
        plan.fill,
        plan.anchor,
    )


def build_layer_plan(
    role: str,
    sprite: Path,
    spec: dict[str, Any],
    palette: tuple[tuple[int, int, int, int], ...],
    token: str,
    *,
    fill: float,
    anchor: str,
) -> LayerPlan:
    mirror = spec["mirror"]
    if stable_int(token, "mirror") % 5 == 0:
        mirror = not mirror

    x = spec["x"] + jitter_int(f"{token}:x", -4, 4)
    y = spec["y"] + jitter_int(f"{token}:y", -4, 4)
    rotation = round(spec["rotation"] + jitter_float(f"{token}:rot", -4.0, 4.0, precision=2), 2)
    scale = round(spec["scale"] + jitter_float(f"{token}:scale", -0.05, 0.05), 3)

    return LayerPlan(
        role=role,
        sprite=sprite.relative_to(sprite.parents[1]).as_posix(),
        scale=max(0.24, scale),
        x=x,
        y=y,
        rotation=rotation,
        mirror=mirror,
        color=palette[spec["color"]],
        fill=fill,
        anchor=anchor,
    )


def select_tough_design(
    card: dict[str, Any],
    sprite_index: dict[str, list[Path]],
    recipes: dict[str, dict[str, list[str]]],
    usage: Counter[str],
    used_signatures: set[tuple[object, ...]],
) -> tuple[list[LayerPlan], dict[str, Any]]:
    portrait = stack_portrait(card)
    layer_overrides = portrait.get("layers", {}) if isinstance(portrait.get("layers"), dict) else {}
    body_patterns = pattern_list(layer_overrides.get("body"))
    head_patterns = pattern_list(layer_overrides.get("head"))
    torso_patterns = pattern_list(layer_overrides.get("torso"))
    leg_patterns = pattern_list(layer_overrides.get("legs"))
    arms_patterns = pattern_list(layer_overrides.get("arms"))
    back_patterns = pattern_list(layer_overrides.get("back"))
    recipe = recipes.get(card.get("archetype", "bruiser"), recipes["bruiser"])
    pools = {
        "body": lookup_pool(
            sprite_index,
            ["bodies"],
            (body_patterns or recipe["body"]) + (head_patterns or recipe.get("head", [])),
            ["bodies"],
        ),
        "torso": lookup_pool(
            sprite_index,
            ["torsos", "bodies"],
            torso_patterns or recipe.get("torso", []),
            ["torsos", "bodies"],
        ),
        "pose": lookup_pool(
            sprite_index,
            ["legs", "torsos", "back"],
            leg_patterns or recipe.get("legs", []),
            ["legs", "torsos"],
        ),
        "arms": lookup_pool(
            sprite_index,
            ["arms", "weapons", "torsos", "contraband"],
            arms_patterns or recipe.get("arms", []),
            ["arms", "weapons", "torsos"],
        ),
        "back": lookup_pool(
            sprite_index,
            ["back", "legs", "contraband", "weapons"],
            back_patterns or recipe.get("back", []),
            ["back", "legs"],
        ) if (back_patterns or recipe.get("back")) else [],
    }

    for nonce in range(64):
        token = f"{card['id']}::{nonce}"
        palette_idx = named_index(portrait.get("palette"), TOUGH_PALETTE_NAMES, f"{token}:palette")
        template_idx = named_index(portrait.get("template"), TOUGH_TEMPLATE_NAMES, f"{token}:template")
        palette = TOUGH_PALETTES[palette_idx]
        template = TOUGH_TEMPLATES[template_idx]

        selected: dict[str, Path] = {}
        taken: set[str] = set()
        for role in ("body", "torso", "pose", "arms", "back"):
            sprite = choose_sprite(
                pools.get(role, []),
                usage,
                taken,
                token=f"{token}:{role}",
                salt=stable_int(token, role, "salt") % 17,
            )
            if sprite is None:
                continue
            selected[role] = sprite
            taken.add(sprite_key(sprite))

        if "body" not in selected or "torso" not in selected or "pose" not in selected:
            continue

        layers: list[LayerPlan] = []
        for spec in template:
            sprite = selected.get(spec["role"])
            if sprite is None:
                continue
            layers.append(
                build_layer_plan(
                    spec["role"],
                    sprite,
                    spec,
                    palette,
                    f"{token}:{spec['role']}",
                    fill=0.88,
                    anchor="bottom",
                ),
            )

        signature = tuple(layer_signature(layer) for layer in layers)
        if signature in used_signatures:
            continue

        used_signatures.add(signature)
        for sprite in selected.values():
            usage[sprite_key(sprite)] += 1

        manifest = {
            "kind": "tough",
            "template": TOUGH_TEMPLATE_NAMES[template_idx],
            "palette": TOUGH_PALETTE_NAMES[palette_idx],
            "layers": [layer.__dict__ for layer in layers],
        }
        return layers, manifest

    raise RuntimeError(f"Could not build unique tough design for {card['id']}")


def select_item_design(
    card: dict[str, Any],
    *,
    kind: str,
    primary_patterns: list[str],
    support_patterns: list[str],
    sprite_index: dict[str, list[Path]],
    usage: Counter[str],
    used_signatures: set[tuple[object, ...]],
    categories: list[str],
) -> tuple[list[LayerPlan], dict[str, Any]]:
    portrait = stack_portrait(card)
    layer_overrides = portrait.get("layers", {}) if isinstance(portrait.get("layers"), dict) else {}
    front_patterns = pattern_list(layer_overrides.get("primary")) or primary_patterns
    support_patterns = pattern_list(layer_overrides.get("support")) or support_patterns
    backdrop_patterns = pattern_list(layer_overrides.get("backdrop")) or support_patterns
    badge_patterns = pattern_list(layer_overrides.get("badge")) or (support_patterns[::-1] + front_patterns)

    front_pool = lookup_pool(sprite_index, categories, front_patterns, categories)
    support_pool = lookup_pool(sprite_index, categories, support_patterns + front_patterns, categories)
    backdrop_pool = lookup_pool(sprite_index, categories, backdrop_patterns, categories)
    badge_pool = lookup_pool(sprite_index, categories, badge_patterns, categories)

    for nonce in range(64):
        token = f"{card['id']}::{nonce}"
        palette_idx = named_index(portrait.get("palette"), ITEM_PALETTE_NAMES[kind], f"{token}:palette")
        template_idx = named_index(portrait.get("template"), ITEM_TEMPLATE_NAMES, f"{token}:template")
        palette = ITEM_PALETTES[kind][palette_idx]
        template = ITEM_TEMPLATES[template_idx]

        taken: set[str] = set()
        selected = {
            "front": choose_sprite(front_pool, usage, taken, f"{token}:front", stable_int(token, "front") % 19),
        }
        if selected["front"] is None:
            continue
        taken.add(sprite_key(selected["front"]))

        selected["support"] = choose_sprite(
            support_pool,
            usage,
            taken,
            f"{token}:support",
            stable_int(token, "support") % 19,
        )
        if selected["support"] is not None:
            taken.add(sprite_key(selected["support"]))

        selected["backdrop"] = choose_sprite(
            backdrop_pool,
            usage,
            taken,
            f"{token}:backdrop",
            stable_int(token, "backdrop") % 19,
        )
        if selected["backdrop"] is not None:
            taken.add(sprite_key(selected["backdrop"]))

        selected["badge"] = choose_sprite(
            badge_pool,
            usage,
            taken,
            f"{token}:badge",
            stable_int(token, "badge") % 19,
        )

        layers: list[LayerPlan] = []
        for spec in template:
            sprite = selected.get(spec["role"])
            if sprite is None:
                continue
            layers.append(
                build_layer_plan(
                    spec["role"],
                    sprite,
                    spec,
                    palette,
                    f"{token}:{spec['role']}",
                    fill=0.72,
                    anchor="center",
                ),
            )

        signature = tuple(layer_signature(layer) for layer in layers)
        if signature in used_signatures:
            continue

        used_signatures.add(signature)
        for sprite in selected.values():
            if sprite is not None:
                usage[sprite_key(sprite)] += 1

        manifest = {
            "kind": kind,
            "template": ITEM_TEMPLATE_NAMES[template_idx],
            "palette": ITEM_PALETTE_NAMES[kind][palette_idx],
            "layers": [layer.__dict__ for layer in layers],
        }
        return layers, manifest

    raise RuntimeError(f"Could not build unique {kind} design for {card['id']}")


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    sprites_root = root / "raw-assets" / "sprites"
    compiled_root = root / "config" / "compiled"
    out_dir = root / "public" / "assets" / "card-art"
    out_dir.mkdir(parents=True, exist_ok=True)

    sprite_index = load_sprite_index(sprites_root)
    recipes = load_json(Path(__file__).parent / "archetype_recipes.json")

    toughs = load_json(compiled_root / "toughs.json")
    weapons = load_json(compiled_root / "weapons.json")
    drugs = load_json(compiled_root / "drugs.json")
    currency = load_json(compiled_root / "currency.json")

    non_mythic_ids = {
        *(card["id"] for card in toughs),
        *(card["id"] for card in weapons),
        *(card["id"] for card in drugs),
        *(card["id"] for card in currency),
    }

    for path in out_dir.glob("*.png"):
        if path.stem in non_mythic_ids:
            path.unlink()

    usage: Counter[str] = Counter()
    used_signatures: set[tuple[object, ...]] = set()
    manifest: dict[str, Any] = {}

    counts = {"tough": 0, "weapon": 0, "drug": 0, "currency": 0}

    for card in sorted(toughs, key=lambda entry: entry["id"]):
        layers, entry = select_tough_design(card, sprite_index, recipes, usage, used_signatures)
        render_stack(layers, sprites_root).save(out_dir / f"{card['id']}.png")
        manifest[card["id"]] = entry
        counts["tough"] += 1

    for card in sorted(weapons, key=lambda entry: entry["id"]):
        patterns = WEAPON_PRIMARY.get(card.get("category", "bladed"), WEAPON_PRIMARY["bladed"])
        support = WEAPON_SUPPORT.get(card.get("category", "bladed"), WEAPON_SUPPORT["bladed"])
        layers, entry = select_item_design(
            card,
            kind="weapon",
            primary_patterns=patterns,
            support_patterns=support,
            sprite_index=sprite_index,
            usage=usage,
            used_signatures=used_signatures,
            categories=["weapons", "contraband", "arms", "torsos"],
        )
        render_stack(layers, sprites_root).save(out_dir / f"{card['id']}.png")
        manifest[card["id"]] = entry
        counts["weapon"] += 1

    for card in sorted(drugs, key=lambda entry: entry["id"]):
        patterns = DRUG_PRIMARY.get(card.get("category", "stimulant"), DRUG_PRIMARY["stimulant"])
        support = DRUG_SUPPORT.get(card.get("category", "stimulant"), DRUG_SUPPORT["stimulant"])
        layers, entry = select_item_design(
            card,
            kind="drug",
            primary_patterns=patterns,
            support_patterns=support,
            sprite_index=sprite_index,
            usage=usage,
            used_signatures=used_signatures,
            categories=["contraband", "weapons"],
        )
        render_stack(layers, sprites_root).save(out_dir / f"{card['id']}.png")
        manifest[card["id"]] = entry
        counts["drug"] += 1

    for card in sorted(currency, key=lambda entry: entry["id"]):
        currency_key = "launder" if "LAUNDER" in card.get("abilities", []) else str(card.get("denomination", 100))
        patterns = CURRENCY_PRIMARY.get(currency_key, CURRENCY_PRIMARY["100"])
        support = CURRENCY_SUPPORT.get(currency_key, CURRENCY_SUPPORT["100"])
        layers, entry = select_item_design(
            card,
            kind="currency",
            primary_patterns=patterns,
            support_patterns=support,
            sprite_index=sprite_index,
            usage=usage,
            used_signatures=used_signatures,
            categories=["contraband", "weapons"],
        )
        render_stack(layers, sprites_root).save(out_dir / f"{card['id']}.png")
        manifest[card["id"]] = entry
        counts["currency"] += 1

    (out_dir / STACK_MANIFEST).write_text(f"{json.dumps(manifest, indent=2)}\n")

    total = sum(counts.values())
    print(
        "Composed "
        f"{total} non-mythic portraits: "
        f"tough={counts['tough']} "
        f"weapon={counts['weapon']} "
        f"drug={counts['drug']} "
        f"currency={counts['currency']}"
    )
    print(f"Locked stack manifest → {out_dir / STACK_MANIFEST}")


if __name__ == "__main__":
    main()
