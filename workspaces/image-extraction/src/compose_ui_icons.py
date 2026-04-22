"""
Compose UI iconography from the same extracted silhouette library used by card art.

The authored manifest lives in config/raw/ui-iconography.json. Each icon is a
small locked stack of explicit silhouette sprites, transforms, and tints; this
keeps UI iconography deterministic without borrowing full card portraits.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps


DEFAULT_CANVAS_W = 180
DEFAULT_CANVAS_H = 120
BOTTOM_MARGIN = 4


@dataclass(frozen=True)
class LayerPlan:
    sprite: str
    scale: float
    x: int
    y: int
    rotation: float
    mirror: bool
    color: tuple[int, int, int, int]
    anchor: str


def fail(message: str) -> None:
    raise SystemExit(f"compose_ui_icons: {message}")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def require_layer(icon_id: str, index: int, raw: Any, sprites_root: Path) -> LayerPlan:
    if not isinstance(raw, dict):
        fail(f"{icon_id}.layers[{index}] must be an object")

    sprite = raw.get("sprite")
    if not isinstance(sprite, str) or not sprite.endswith(".png"):
        fail(f"{icon_id}.layers[{index}].sprite must be a PNG path")
    if sprite.startswith("/") or ".." in Path(sprite).parts:
        fail(f"{icon_id}.layers[{index}].sprite must be relative to raw-assets/sprites")
    if not (sprites_root / sprite).exists():
        fail(f"{icon_id}.layers[{index}].sprite not found: {sprite}")

    color = raw.get("color")
    if (
        not isinstance(color, list)
        or len(color) != 4
        or not all(isinstance(part, int) and 0 <= part <= 255 for part in color)
    ):
        fail(f"{icon_id}.layers[{index}].color must be [r,g,b,a]")

    anchor = raw.get("anchor", "bottom")
    if anchor not in {"bottom", "center"}:
        fail(f"{icon_id}.layers[{index}].anchor must be bottom or center")

    try:
        scale = float(raw.get("scale", 1))
        x = int(raw.get("x", 0))
        y = int(raw.get("y", 0))
        rotation = float(raw.get("rotation", 0))
    except (TypeError, ValueError):
        fail(f"{icon_id}.layers[{index}] transform values must be numeric")

    return LayerPlan(
        sprite=sprite,
        scale=max(0.05, scale),
        x=x,
        y=y,
        rotation=rotation,
        mirror=bool(raw.get("mirror", False)),
        color=(color[0], color[1], color[2], color[3]),
        anchor=anchor,
    )


def tint_alpha(sprite: Image.Image, rgba: tuple[int, int, int, int]) -> Image.Image:
    alpha = sprite.getchannel("A")
    scaled_alpha = alpha.point(lambda px: min(255, round(px * rgba[3] / 255)))
    tinted = Image.new("RGBA", sprite.size, rgba[:3] + (0,))
    tinted.putalpha(scaled_alpha)
    return tinted


def render_layer(
    plan: LayerPlan,
    sprites_root: Path,
    canvas_w: int,
    canvas_h: int,
) -> Image.Image:
    sprite = Image.open(sprites_root / plan.sprite).convert("RGBA")
    if plan.mirror:
        sprite = ImageOps.mirror(sprite)
    sprite = tint_alpha(sprite, plan.color)

    sw, sh = sprite.size
    target_w = canvas_w * 0.82 * plan.scale
    target_h = canvas_h * 0.9 * plan.scale
    scale = min(target_w / max(sw, 1), target_h / max(sh, 1))
    resized = sprite.resize(
        (max(1, int(sw * scale)), max(1, int(sh * scale))),
        Image.LANCZOS,
    )
    if abs(plan.rotation) > 0.01:
        resized = resized.rotate(plan.rotation, resample=Image.BICUBIC, expand=True)
    return resized


def render_icon(
    layers: list[LayerPlan],
    sprites_root: Path,
    canvas_w: int,
    canvas_h: int,
) -> Image.Image:
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    for plan in layers:
        layer = render_layer(plan, sprites_root, canvas_w, canvas_h)
        x = (canvas_w - layer.width) // 2 + plan.x
        if plan.anchor == "center":
            y = (canvas_h - layer.height) // 2 + plan.y
        else:
            y = canvas_h - layer.height - BOTTOM_MARGIN + plan.y
        canvas.alpha_composite(layer, (x, y))
    return canvas


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    manifest_path = root / "config" / "raw" / "ui-iconography.json"
    sprites_root = root / "raw-assets" / "sprites"
    out_dir = root / "public" / "assets" / "ui" / "silhouette-icons"
    manifest = read_json(manifest_path)

    canvas = manifest.get("canvas", {}) if isinstance(manifest, dict) else {}
    canvas_w = int(canvas.get("width", DEFAULT_CANVAS_W))
    canvas_h = int(canvas.get("height", DEFAULT_CANVAS_H))
    icons = manifest.get("icons") if isinstance(manifest, dict) else None
    if not isinstance(icons, dict) or not icons:
        fail("manifest.icons must be a non-empty object")

    out_dir.mkdir(parents=True, exist_ok=True)
    for old_icon in out_dir.glob("*.png"):
        old_icon.unlink()

    for icon_id, icon in sorted(icons.items()):
        if not isinstance(icon, dict):
            fail(f"{icon_id} must be an object")
        layers_raw = icon.get("layers")
        if not isinstance(layers_raw, list) or not layers_raw:
            fail(f"{icon_id}.layers must be a non-empty array")

        layers = [
            require_layer(icon_id, index, layer, sprites_root)
            for index, layer in enumerate(layers_raw)
        ]
        render_icon(layers, sprites_root, canvas_w, canvas_h).save(out_dir / f"{icon_id}.png")

    print(f"Composed {len(icons)} UI silhouette icons → {out_dir}")


if __name__ == "__main__":
    main()
