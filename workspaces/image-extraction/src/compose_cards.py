"""
Card art compositor — final version.

Uses organized sprite directories under raw-assets/sprites/.
All 212 cards get real sprite-composed PNGs — no procedural SVG.

Toughs/Mythics: body silhouettes from bodies/
Weapons: weapon sprites from weapons/
Drugs: contraband sprites from contraband/
Currency: cash sprites from contraband/

Output goes to public/assets/card-art/{card-id}.png
Card.tsx loads these as <img> tags at runtime.
"""
from pathlib import Path
from PIL import Image
import json
import hashlib


def seed_from_id(card_id: str) -> int:
    return int(hashlib.md5(card_id.encode()).hexdigest()[:8], 16)


def pick(pool: list, seed: int):
    return pool[seed % len(pool)] if pool else None


def glob_pngs(d: Path) -> list[Path]:
    return sorted(d.glob("*.png")) if d.exists() else []


def match_sprites(base: Path, subdirs: list[str], patterns: list[str]) -> list[Path]:
    results = []
    for sd in subdirs:
        for f in glob_pngs(base / sd):
            for pat in patterns:
                if f.stem == pat or f.stem.startswith(pat):
                    results.append(f)
                    break
    return results


def render(sprite_path: Path, cw: int = 120, ch: int = 160,
           fill: float = 0.85, anchor: str = "bottom") -> Image.Image:
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    spr = Image.open(sprite_path).convert("RGBA")
    sw, sh = spr.size
    scale = min(int(cw * fill) / max(sw, 1), int(ch * fill) / max(sh, 1))
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    spr = spr.resize((nw, nh), Image.LANCZOS)
    x = (cw - nw) // 2
    y = ch - nh - 4 if anchor == "bottom" else (ch - nh) // 2
    canvas.paste(spr, (x, y), spr)
    return canvas


BODY_POOLS = {
    "bruiser":  ["heavy", "average"],
    "enforcer": ["heavy", "tall-longcoat", "average"],
    "snitch":   ["lean", "average", "cap"],
    "lookout":  ["lean", "cap", "hood"],
    "ghost":    ["lean", "tall-longcoat", "hood-mask"],
    "hustler":  ["average", "fedora", "pompadour"],
    "fixer":    ["average", "fedora", "lean"],
    "medic":    ["average", "lean"],
    "arsonist": ["average", "heavy", "hood"],
    "shark":    ["average", "fedora", "slick-femme"],
    "wheelman": ["average", "lean", "cap"],
    "fence":    ["average", "heavy", "tall-longcoat"],
}

WEAPON_POOLS = {
    "bladed":    ["hook-blade"],
    "blunt":     ["crowbar", "fist-punch"],
    "ranged":    ["pistol-compact", "pistol-full", "holster-pistol"],
    "stealth":   ["chain", "hook-blade"],
    "explosive": ["grenade"],
}

DRUG_POOLS = {
    "stimulant":    ["pill-bottle", "prescription-bottle"],
    "narcotic":     ["drug-bag", "syringe", "wrapped-bricks"],
    "sedative":     ["pill-bottle", "herb-bag"],
    "steroid":      ["syringe", "prescription-bottle"],
    "hallucinogen": ["herb-bag", "drug-bag"],
}

CURRENCY_POOLS = {
    100:  ["wallet", "money-clip"],
    1000: ["cash-stack", "paper-bag", "duffel-bag"],
}


def main():
    root = Path(__file__).resolve().parents[3]
    spr = root / "raw-assets" / "sprites"
    cat = root / "config" / "compiled"
    out = root / "public" / "assets" / "card-art"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.png"):
        f.unlink()

    toughs = json.loads((cat / "toughs.json").read_text())
    mythics = json.loads((cat / "mythics.json").read_text())
    weapons = json.loads((cat / "weapons.json").read_text())
    drugs = json.loads((cat / "drugs.json").read_text())
    currency = json.loads((cat / "currency.json").read_text())

    all_bodies = glob_pngs(spr / "bodies")
    n = {"tough": 0, "weapon": 0, "drug": 0, "currency": 0, "fail": 0}

    for card in toughs + mythics:
        pats = BODY_POOLS.get(card.get("archetype", "bruiser"), ["average"])
        cands = match_sprites(spr, ["bodies"], pats) or all_bodies
        c = pick(cands, seed_from_id(card["id"]))
        if c:
            render(c).save(out / f"{card['id']}.png")
            n["tough"] += 1
        else:
            n["fail"] += 1

    for card in weapons:
        pats = WEAPON_POOLS.get(card.get("category", "bladed"), ["pistol-compact"])
        cands = match_sprites(spr, ["weapons"], pats) or glob_pngs(spr / "weapons")
        c = pick(cands, seed_from_id(card["id"]))
        if c:
            render(c, anchor="center").save(out / f"{card['id']}.png")
            n["weapon"] += 1
        else:
            n["fail"] += 1

    for card in drugs:
        pats = DRUG_POOLS.get(card.get("category", "stimulant"), ["drug-bag"])
        cands = match_sprites(spr, ["contraband"], pats) or glob_pngs(spr / "contraband")
        c = pick(cands, seed_from_id(card["id"]))
        if c:
            render(c, anchor="center").save(out / f"{card['id']}.png")
            n["drug"] += 1
        else:
            n["fail"] += 1

    for card in currency:
        pats = CURRENCY_POOLS.get(card.get("denomination", 100), ["cash-stack"])
        cands = match_sprites(spr, ["contraband"], pats) or glob_pngs(spr / "contraband")
        c = pick(cands, seed_from_id(card["id"]))
        if c:
            render(c, anchor="center").save(out / f"{card['id']}.png")
            n["currency"] += 1
        else:
            n["fail"] += 1

    total = sum(n.values()) - n["fail"]
    print(f"Composed {total}: tough={n['tough']} weapon={n['weapon']} drug={n['drug']} currency={n['currency']} fail={n['fail']}")


if __name__ == "__main__":
    main()
