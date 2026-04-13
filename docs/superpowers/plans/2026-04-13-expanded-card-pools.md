# Expanded Card Pools & Balance System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand card pools to 100 crew + 50 weapons + 50 drugs + simplified currency, fix broken game engine, and run balance simulations until stable.

**Architecture:** Category-based generation for weapons (5 categories x 10) and drugs (5 categories x 10), mirroring how crew cards use archetypes. Each weapon/drug has dual offense/defense abilities determined by category. Game engine rewritten to use unified modifier API (`placeModifier()` + `hand.modifiers` + `modifierDraw`). Balance lock system tracks per-card stability across simulation runs.

**Tech Stack:** TypeScript, Vitest, Zod validation, seeded Mulberry32 PRNG, Yuka.js fuzzy AI

**Spec:** `docs/superpowers/specs/2026-04-13-expanded-card-pools-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `vitest.config.ts` | CREATE | Vitest configuration |
| `src/data/pools/weapon-categories.json` | CREATE | 5 weapon categories with abilities, bonusMod, name pools |
| `src/data/pools/drug-categories.json` | CREATE | 5 drug categories with abilities, potencyMod, name pools |
| `src/data/pools/weapons.json` | REWRITE | Name pools per category (replace hand-authored list) |
| `src/data/pools/products.json` | REWRITE | Name pools per category (replace adj+noun) |
| `src/sim/cards/schemas.ts` | MODIFY | Add WeaponCategory, DrugCategory, updated card schemas |
| `src/sim/turf/types.ts` | MODIFY | Update WeaponCard, ProductCard, CashCard types |
| `src/sim/cards/generator.ts` | MODIFY | Independent resistance stat, locked field, 25 starters |
| `src/sim/turf/generators.ts` | REWRITE | Category-based 50 weapon + 50 drug generation, simplified cash |
| `src/sim/turf/ai-fuzzy.ts` | MODIFY | Fix resource calc to unified hand/draw |
| `src/sim/turf/game.ts` | REWRITE | drawPhase, aiBuildupTurn, tryAction, handleOutcome for unified modifier API |
| `src/sim/turf/attacks.ts` | MODIFY | Category ability resolution in attack functions |
| `src/sim/turf/run.ts` | MODIFY | Generate expanded pools, balance lock reporting |
| `src/sim/turf/__tests__/generators.test.ts` | CREATE | Tests for weapon/drug/cash generation |
| `src/sim/turf/__tests__/board.test.ts` | CREATE | Tests for placeModifier, position power/defense |
| `src/sim/turf/__tests__/attacks.test.ts` | CREATE | Tests for attack resolution with categories |
| `src/sim/turf/__tests__/game.test.ts` | CREATE | Integration test: full game completes without crash |

---

### Task 1: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    globals: true,
  },
});
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify vitest runs (no tests yet, should exit clean)**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx vitest run`
Expected: "No test files found" or similar clean exit.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: add vitest configuration"
```

---

### Task 2: Updated Type Definitions

**Files:**
- Modify: `src/sim/turf/types.ts`
- Modify: `src/sim/cards/schemas.ts`

- [ ] **Step 1: Update WeaponCard type in types.ts**

Replace the existing `WeaponCard` interface:

```typescript
export interface WeaponCard {
  type: 'weapon';
  id: string;
  name: string;
  category: string;
  bonus: number;
  offenseAbility: string;
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;
}
```

- [ ] **Step 2: Update ProductCard type in types.ts**

Replace the existing `ProductCard` interface:

```typescript
export interface ProductCard {
  type: 'product';
  id: string;
  name: string;
  category: string;
  potency: number;
  offenseAbility: string;
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;
}
```

- [ ] **Step 3: Simplify CashCard type in types.ts**

Replace the existing `CashCard` interface:

```typescript
export interface CashCard {
  type: 'cash';
  id: string;
  denomination: 100 | 1000;
}
```

- [ ] **Step 4: Update CrewCard type to add resistance and locked**

The existing `CrewCard` in types.ts already has `resistance`. Add `locked`:

```typescript
export interface CrewCard {
  type: 'crew';
  id: string;
  displayName: string;
  archetype: string;
  affiliation: string;
  power: number;
  resistance: number;
  abilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;
}
```

- [ ] **Step 5: Add category types to schemas.ts**

Add these Zod schemas after the existing ones in `src/sim/cards/schemas.ts`:

```typescript
export const WeaponCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  bonusMod: z.number().int().min(-1).max(1),
  names: z.array(z.string()).min(10),
});

export const DrugCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  potencyMod: z.number().int().min(-1).max(1),
  adjectives: z.array(z.string()).min(10),
  nouns: z.array(z.string()).min(10),
});

export type WeaponCategoryData = z.infer<typeof WeaponCategorySchema>;
export type DrugCategoryData = z.infer<typeof DrugCategorySchema>;
```

- [ ] **Step 6: Update CharacterCardSchema to include locked**

In `src/sim/cards/schemas.ts`, update:

```typescript
export const CharacterCardSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  archetype: z.string(),
  affiliation: z.string(),
  power: z.number().int().min(1).max(12),
  resistance: z.number().int().min(1).max(12),
  abilityText: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
});
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx tsc --noEmit 2>&1 | head -30`
Expected: Errors from game.ts/generators.ts (expected — they reference old types). No errors from types.ts or schemas.ts.

- [ ] **Step 8: Commit**

```bash
git add src/sim/turf/types.ts src/sim/cards/schemas.ts
git commit -m "feat: update card types for categories, dual abilities, balance lock"
```

---

### Task 3: Weapon & Drug Category Data Files

**Files:**
- Create: `src/data/pools/weapon-categories.json`
- Create: `src/data/pools/drug-categories.json`
- Rewrite: `src/data/pools/weapons.json`
- Rewrite: `src/data/pools/products.json`

- [ ] **Step 1: Create weapon-categories.json**

```json
{
  "categories": [
    {
      "id": "bladed",
      "title": "Bladed",
      "description": "Edged weapons that cause bleeding wounds.",
      "offenseAbility": "LACERATE",
      "offenseAbilityText": "Target bleeds, losing 1 resistance per round for bonus rounds.",
      "defenseAbility": "PARRY",
      "defenseAbilityText": "Attacker takes bonus counter-damage.",
      "bonusMod": 0,
      "names": [
        "Switchblade", "Box Cutter", "Stiletto", "Bowie Knife", "Straight Razor",
        "Butterfly Knife", "Shiv", "Machete", "Hunting Knife", "Karambit",
        "Tanto", "Cleaver"
      ]
    },
    {
      "id": "blunt",
      "title": "Blunt",
      "description": "Heavy impact weapons that shatter defenses.",
      "offenseAbility": "SHATTER",
      "offenseAbilityText": "On kill, destroys one random modifier on target position.",
      "defenseAbility": "BRACE",
      "defenseAbilityText": "Absorb first bonus points of damage before resistance takes hits.",
      "bonusMod": 1,
      "names": [
        "Crowbar", "Baseball Bat", "Pipe Wrench", "Tire Iron", "Claw Hammer",
        "Brick in a Sock", "Nail Bat", "Lead Pipe", "Rebar", "Mace",
        "Blackjack", "Sap Gloves"
      ]
    },
    {
      "id": "explosive",
      "title": "Explosive",
      "description": "Area-of-effect weapons that damage multiple targets.",
      "offenseAbility": "BLAST",
      "offenseAbilityText": "Splash bonus damage to adjacent positions.",
      "defenseAbility": "DETERRENT",
      "defenseAbilityText": "Attackers must exceed defense by bonus extra to kill.",
      "bonusMod": 0,
      "names": [
        "Pipe Bomb", "Molotov Cocktail", "Cherry Bomb", "Flashbang", "Stick of Dynamite",
        "Road Flare", "Firecracker Bundle", "Smoke Bomb", "Thermite Charge", "Nail Bomb",
        "Flash Powder", "Gas Can"
      ]
    },
    {
      "id": "ranged",
      "title": "Ranged",
      "description": "Reach weapons that strike from distance.",
      "offenseAbility": "REACH",
      "offenseAbilityText": "Can target any enemy position, not just front-line.",
      "defenseAbility": "OVERWATCH",
      "defenseAbilityText": "Deal bonus damage to any crew placed on adjacent positions.",
      "bonusMod": -1,
      "names": [
        "Zip Gun", "Slingshot", "Throwing Knife", "Blowgun", "Crossbow Pistol",
        "Derringer", "Wrist Rocket", "Nail Gun", "Staple Gun", "BB Gun",
        "Pellet Rifle", "Dart Gun"
      ]
    },
    {
      "id": "stealth",
      "title": "Stealth",
      "description": "Covert weapons for silent strikes.",
      "offenseAbility": "AMBUSH",
      "offenseAbilityText": "No counter-damage when attacking. Attacker takes zero retaliation.",
      "defenseAbility": "EVASION",
      "defenseAbilityText": "First bonus attacks against this position miss entirely.",
      "bonusMod": -1,
      "names": [
        "Garrote", "Poison Needle", "Silenced Pistol", "Piano Wire", "Ice Pick",
        "Coat Hanger Wire", "Chloroform Rag", "Taser", "Syringe", "Hatpin",
        "Pen Knife", "Wire Saw"
      ]
    }
  ]
}
```

- [ ] **Step 2: Create drug-categories.json**

```json
{
  "categories": [
    {
      "id": "stimulant",
      "title": "Stimulant",
      "description": "Uppers that boost speed and reaction.",
      "offenseAbility": "RUSH",
      "offenseAbilityText": "Crew acts immediately after placement, no setup turn cooldown.",
      "defenseAbility": "REFLEXES",
      "defenseAbilityText": "Crew counter-attacks for potency damage when hit.",
      "potencyMod": 0,
      "adjectives": [
        "Electric", "Lightning", "Turbo", "Hyper", "Surge",
        "Spark", "Bolt", "Flash", "Rapid", "Nitro",
        "Sonic", "Blitz"
      ],
      "nouns": [
        "Rush", "Jolt", "Kick", "Snap", "Crack",
        "Zip", "Pop", "Buzz", "Zing", "Blast",
        "Spike", "Charge"
      ]
    },
    {
      "id": "sedative",
      "title": "Sedative",
      "description": "Downers that suppress and slow.",
      "offenseAbility": "SUPPRESS",
      "offenseAbilityText": "Target crew's power reduced by potency for 2 rounds.",
      "defenseAbility": "NUMB",
      "defenseAbilityText": "Crew ignores first potency points of damage per round.",
      "potencyMod": 1,
      "adjectives": [
        "Midnight", "Velvet", "Smooth", "Deep", "Slow",
        "Dreamy", "Mellow", "Drowsy", "Heavy", "Still",
        "Quiet", "Hush"
      ],
      "nouns": [
        "Haze", "Drift", "Calm", "Fog", "Cloud",
        "Sleep", "Dusk", "Mist", "Shade", "Lull",
        "Peace", "Rest"
      ]
    },
    {
      "id": "hallucinogen",
      "title": "Hallucinogen",
      "description": "Mind-altering substances that confuse and disorient.",
      "offenseAbility": "CONFUSE",
      "offenseAbilityText": "Funded flip threshold reduced by potency.",
      "defenseAbility": "PARANOIA",
      "defenseAbilityText": "Funded flips against this crew cost potency extra cash.",
      "potencyMod": 0,
      "adjectives": [
        "Crystal", "Rainbow", "Spiral", "Fractal", "Cosmic",
        "Neon", "Prismatic", "Kaleidoscope", "Aurora", "Phantom",
        "Warped", "Vivid"
      ],
      "nouns": [
        "Dream", "Trip", "Vision", "Gaze", "Pulse",
        "Echo", "Wave", "Flux", "Bloom", "Mirage",
        "Prism", "Lens"
      ]
    },
    {
      "id": "steroid",
      "title": "Steroid",
      "description": "Performance enhancers that boost raw physical stats.",
      "offenseAbility": "BULK",
      "offenseAbilityText": "Crew gets +potency power for attacks.",
      "defenseAbility": "FORTIFY",
      "defenseAbilityText": "Crew gets +potency resistance.",
      "potencyMod": 1,
      "adjectives": [
        "Iron", "Titan", "Bull", "Raw", "Heavy",
        "Savage", "Brute", "Granite", "Steel", "Gorilla",
        "Tank", "Mammoth"
      ],
      "nouns": [
        "Surge", "Pump", "Mass", "Bulk", "Force",
        "Rage", "Power", "Crush", "Slam", "Drive",
        "Fury", "Might"
      ]
    },
    {
      "id": "narcotic",
      "title": "Narcotic",
      "description": "Heavy painkillers enabling reckless aggression.",
      "offenseAbility": "BERSERK",
      "offenseAbilityText": "Crew power boosted by potency but takes 1 self-damage after attacking.",
      "defenseAbility": "PAINKILLERS",
      "defenseAbilityText": "Crew survives next potency killing blows at 1 resistance instead of dying.",
      "potencyMod": -1,
      "adjectives": [
        "Black", "Shadow", "Ghost", "Numb", "Void",
        "Dark", "Hollow", "Faded", "Blank", "Dead",
        "Cold", "Grey"
      ],
      "nouns": [
        "Out", "Fade", "Dose", "Drop", "Fix",
        "Hit", "Nod", "Smoke", "Dust", "Burn",
        "Haze", "End"
      ]
    }
  ]
}
```

- [ ] **Step 3: Rewrite weapons.json to name-pool format**

Replace the entire file with per-category name pools (the actual names live in weapon-categories.json — this file is now just supplementary/legacy and can be deleted since names moved to categories). Actually, since `weapon-categories.json` already has `names` arrays, `weapons.json` is no longer needed as a separate file. Delete it:

```bash
rm src/data/pools/weapons.json
```

- [ ] **Step 4: Rewrite products.json to category-aware format**

Since `drug-categories.json` already has per-category `adjectives` and `nouns`, the old `products.json` is superseded. Delete it:

```bash
rm src/data/pools/products.json
```

- [ ] **Step 5: Commit**

```bash
git add src/data/pools/weapon-categories.json src/data/pools/drug-categories.json
git rm src/data/pools/weapons.json src/data/pools/products.json
git commit -m "feat: add weapon/drug category data, remove old flat pools"
```

---

### Task 4: Crew Card Generator Updates

**Files:**
- Modify: `src/sim/cards/generator.ts`
- Modify: `src/data/pools/archetypes.json`

- [ ] **Step 1: Add resistanceMod to archetypes.json**

Add a `"resistanceMod"` field to each archetype in `src/data/pools/archetypes.json`. Tanky archetypes get positive, glass cannons get negative:

| Archetype | resistanceMod | Reasoning |
|-----------|--------------|-----------|
| bruiser | +1 | Tank |
| snitch | 0 | Average |
| lookout | 0 | Average |
| enforcer | +1 | Tank |
| ghost | -1 | Glass cannon |
| arsonist | 0 | Average |
| shark | -1 | Glass cannon |
| fence | 0 | Average |
| medic | +2 | Healer, high durability |
| wheelman | 0 | Average |
| hustler | -1 | Glass cannon |
| sniper | -1 | Glass cannon |

For each archetype object, add the field. Example for bruiser:
```json
{
  "id": "bruiser",
  "title": "Bruiser",
  "description": "Raw power. No precision restriction.",
  "ability": "OVERWHELM",
  "abilityText": "Ignores precision rule. Can attack any target regardless of HP.",
  "targets": "vanguard",
  "timing": "on_attack",
  "powerMod": 1,
  "resistanceMod": 1
}
```

- [ ] **Step 2: Update calcPower to also produce calcResistance in generator.ts**

Add a `calcResistance` function after `calcPower`:

```typescript
function calcResistance(index: number, resistanceMod: number): number {
  const base = Math.floor(1 + (index / 99) * 7);
  return Math.max(1, Math.min(12, base + resistanceMod));
}
```

- [ ] **Step 3: Update generateAllCards to use independent resistance and locked**

In `generateAllCards()`, change the card construction (around line 99) to:

```typescript
const resistance = calcResistance(i, archetype.resistanceMod ?? 0);

const card: CharacterCard = {
  id: `card-${String(i + 1).padStart(3, '0')}`,
  displayName,
  archetype: archetype.id,
  affiliation,
  power,
  resistance,
  abilityText: archetype.abilityText,
  unlocked: i < starterCount,
  unlockCondition: i >= starterCount ? unlockCondition(i, rng) : undefined,
  locked: false,
};
```

- [ ] **Step 4: Update starterCount default to 25**

Change the function signature default from `starterCount = 20` to `starterCount = 25`:

```typescript
export function generateAllCards(seed = 42, starterCount = 25): CharacterCard[] {
```

- [ ] **Step 5: Verify generator compiles**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx tsc --noEmit 2>&1 | grep generator`
Expected: No errors from generator.ts.

- [ ] **Step 6: Commit**

```bash
git add src/sim/cards/generator.ts src/data/pools/archetypes.json
git commit -m "feat: crew cards get independent resistance stat, locked field, 25 starters"
```

---

### Task 5: Category-Based Weapon & Drug Generators

**Files:**
- Rewrite: `src/sim/turf/generators.ts`
- Create: `src/sim/turf/__tests__/generators.test.ts`

- [ ] **Step 1: Write failing tests for weapon generation**

Create `src/sim/turf/__tests__/generators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateWeapons, generateDrugs, generateCash } from '../generators';
import { createRng } from '../../cards/rng';

describe('generateWeapons', () => {
  it('generates exactly 50 weapons', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    expect(weapons).toHaveLength(50);
  });

  it('has 10 weapons per category', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const byCat: Record<string, number> = {};
    for (const w of weapons) {
      byCat[w.category] = (byCat[w.category] ?? 0) + 1;
    }
    expect(byCat).toEqual({
      bladed: 10, blunt: 10, explosive: 10, ranged: 10, stealth: 10,
    });
  });

  it('all weapons have unique ids', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const ids = weapons.map(w => w.id);
    expect(new Set(ids).size).toBe(50);
  });

  it('all weapons have unique names', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const names = weapons.map(w => w.name);
    expect(new Set(names).size).toBe(50);
  });

  it('weapons have dual abilities from their category', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const bladed = weapons.find(w => w.category === 'bladed')!;
    expect(bladed.offenseAbility).toBe('LACERATE');
    expect(bladed.defenseAbility).toBe('PARRY');
  });

  it('bonus values are within expected range', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    for (const w of weapons) {
      expect(w.bonus).toBeGreaterThanOrEqual(1);
      expect(w.bonus).toBeLessThanOrEqual(5);
    }
  });

  it('20 weapons are unlocked at start', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const unlocked = weapons.filter(w => w.unlocked).length;
    expect(unlocked).toBe(20);
  });

  it('all weapons start with locked=false', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    expect(weapons.every(w => w.locked === false)).toBe(true);
  });

  it('is deterministic with same seed', () => {
    const a = generateWeapons(createRng(42));
    const b = generateWeapons(createRng(42));
    expect(a.map(w => w.name)).toEqual(b.map(w => w.name));
  });
});

describe('generateDrugs', () => {
  it('generates exactly 50 drugs', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    expect(drugs).toHaveLength(50);
  });

  it('has 10 drugs per category', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    const byCat: Record<string, number> = {};
    for (const d of drugs) {
      byCat[d.category] = (byCat[d.category] ?? 0) + 1;
    }
    expect(byCat).toEqual({
      stimulant: 10, sedative: 10, hallucinogen: 10, steroid: 10, narcotic: 10,
    });
  });

  it('all drugs have unique ids', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    const ids = drugs.map(d => d.id);
    expect(new Set(ids).size).toBe(50);
  });

  it('drugs have dual abilities from their category', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    const stim = drugs.find(d => d.category === 'stimulant')!;
    expect(stim.offenseAbility).toBe('RUSH');
    expect(stim.defenseAbility).toBe('REFLEXES');
  });

  it('potency values are within expected range', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    for (const d of drugs) {
      expect(d.potency).toBeGreaterThanOrEqual(1);
      expect(d.potency).toBeLessThanOrEqual(5);
    }
  });

  it('20 drugs are unlocked at start', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    const unlocked = drugs.filter(d => d.unlocked).length;
    expect(unlocked).toBe(20);
  });
});

describe('generateCash', () => {
  it('generates 30 cash cards total (25x$100 + 5x$1000)', () => {
    const cash = generateCash();
    expect(cash).toHaveLength(30);
  });

  it('has correct denomination breakdown', () => {
    const cash = generateCash();
    const hundreds = cash.filter(c => c.denomination === 100);
    const thousands = cash.filter(c => c.denomination === 1000);
    expect(hundreds).toHaveLength(25);
    expect(thousands).toHaveLength(5);
  });

  it('all cash cards have unique ids', () => {
    const cash = generateCash();
    const ids = cash.map(c => c.id);
    expect(new Set(ids).size).toBe(30);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx vitest run src/sim/turf/__tests__/generators.test.ts`
Expected: FAIL — functions don't match new signatures yet.

- [ ] **Step 3: Rewrite generators.ts**

Replace the entire content of `src/sim/turf/generators.ts`:

```typescript
/**
 * Category-based generators for weapon, drug, and cash card pools.
 * Weapons: 5 categories x 10 = 50 unique cards.
 * Drugs: 5 categories x 10 = 50 unique cards.
 * Cash: 25x $100 + 5x $1000 = 30 cards.
 */

import weaponCategoriesPool from '../../data/pools/weapon-categories.json';
import drugCategoriesPool from '../../data/pools/drug-categories.json';
import type { WeaponCard, ProductCard, CashCard } from './types';
import type { Rng } from '../cards/rng';

const WEAPONS_PER_CATEGORY = 10;
const DRUGS_PER_CATEGORY = 10;
const UNLOCKED_PER_CATEGORY = 4;

function calcBonus(index: number, min: number, max: number, mod: number): number {
  const range = max - min;
  const base = min + Math.round((index / (WEAPONS_PER_CATEGORY - 1)) * range);
  return Math.max(1, Math.min(5, base + mod));
}

function weaponUnlockCondition(catIdx: number, cardIdx: number, rng: Rng): string {
  const conds = [
    `Win ${rng.int(3, 7)} games`,
    `Kill ${rng.int(5, 15)} enemies total`,
    `Win a game using only bladed weapons`,
    `Win a game in under ${rng.int(12, 16)} rounds`,
    `Seize ${rng.int(10, 20)} positions total`,
    `Win without losing a position`,
    `Kill ${rng.int(3, 5)} enemies in a single game`,
    `Win with all 5 weapon categories in your deck`,
  ];
  return rng.pick(conds);
}

function drugUnlockCondition(catIdx: number, cardIdx: number, rng: Rng): string {
  const conds = [
    `Win ${rng.int(3, 7)} games`,
    `Use ${rng.int(10, 20)} drugs in total across games`,
    `Win a game using only stimulants`,
    `Flip ${rng.int(5, 10)} enemies total`,
    `Win without using steroids`,
    `Win a game with all 5 drug categories in your deck`,
    `Win a game in under ${rng.int(12, 16)} rounds`,
    `Survive ${rng.int(3, 5)} killing blows using painkillers`,
  ];
  return rng.pick(conds);
}

/** Generate 50 weapon cards from 5 categories x 10. */
export function generateWeapons(rng: Rng): WeaponCard[] {
  const cards: WeaponCard[] = [];
  let globalIdx = 0;

  for (const cat of weaponCategoriesPool.categories) {
    const names = rng.shuffle([...cat.names]);
    const bonusRange = getBonusRange(cat.id);

    for (let i = 0; i < WEAPONS_PER_CATEGORY; i++) {
      const name = names[i % names.length];
      const bonus = calcBonus(i, bonusRange.min, bonusRange.max, cat.bonusMod);
      const isUnlocked = i < UNLOCKED_PER_CATEGORY;

      cards.push({
        type: 'weapon',
        id: `weap-${String(globalIdx + 1).padStart(2, '0')}`,
        name,
        category: cat.id,
        bonus,
        offenseAbility: cat.offenseAbility,
        offenseAbilityText: cat.offenseAbilityText,
        defenseAbility: cat.defenseAbility,
        defenseAbilityText: cat.defenseAbilityText,
        unlocked: isUnlocked,
        unlockCondition: isUnlocked ? undefined : weaponUnlockCondition(0, globalIdx, rng),
        locked: false,
      });
      globalIdx++;
    }
  }
  return cards;
}

function getBonusRange(categoryId: string): { min: number; max: number } {
  switch (categoryId) {
    case 'bladed': return { min: 1, max: 3 };
    case 'blunt': return { min: 2, max: 4 };
    case 'explosive': return { min: 2, max: 4 };
    case 'ranged': return { min: 1, max: 2 };
    case 'stealth': return { min: 1, max: 2 };
    default: return { min: 1, max: 3 };
  }
}

function getPotencyRange(categoryId: string): { min: number; max: number } {
  switch (categoryId) {
    case 'stimulant': return { min: 1, max: 3 };
    case 'sedative': return { min: 2, max: 4 };
    case 'hallucinogen': return { min: 1, max: 3 };
    case 'steroid': return { min: 2, max: 4 };
    case 'narcotic': return { min: 1, max: 2 };
    default: return { min: 1, max: 3 };
  }
}

/** Generate 50 drug cards from 5 categories x 10. */
export function generateDrugs(rng: Rng): ProductCard[] {
  const cards: ProductCard[] = [];
  let globalIdx = 0;
  const usedNames = new Set<string>();

  for (const cat of drugCategoriesPool.categories) {
    const adjectives = rng.shuffle([...cat.adjectives]);
    const nouns = rng.shuffle([...cat.nouns]);
    const potencyRange = getPotencyRange(cat.id);

    for (let i = 0; i < DRUGS_PER_CATEGORY; i++) {
      let name: string;
      let attempts = 0;
      do {
        const adj = adjectives[i % adjectives.length];
        const noun = nouns[(i + attempts) % nouns.length];
        name = `${adj} ${noun}`;
        attempts++;
      } while (usedNames.has(name) && attempts < 50);
      usedNames.add(name);

      const potency = calcBonus(i, potencyRange.min, potencyRange.max, cat.potencyMod);
      const isUnlocked = i < UNLOCKED_PER_CATEGORY;

      cards.push({
        type: 'product',
        id: `drug-${String(globalIdx + 1).padStart(2, '0')}`,
        name,
        category: cat.id,
        potency,
        offenseAbility: cat.offenseAbility,
        offenseAbilityText: cat.offenseAbilityText,
        defenseAbility: cat.defenseAbility,
        defenseAbilityText: cat.defenseAbilityText,
        unlocked: isUnlocked,
        unlockCondition: isUnlocked ? undefined : drugUnlockCondition(0, globalIdx, rng),
        locked: false,
      });
      globalIdx++;
    }
  }
  return cards;
}

/** Generate base cash pool: 25x $100 + 5x $1000. */
export function generateCash(): CashCard[] {
  const cards: CashCard[] = [];
  for (let i = 0; i < 25; i++) {
    cards.push({
      type: 'cash',
      id: `cash-${String(i + 1).padStart(3, '0')}`,
      denomination: 100,
    });
  }
  for (let i = 0; i < 5; i++) {
    cards.push({
      type: 'cash',
      id: `cash-${String(26 + i).padStart(3, '0')}`,
      denomination: 1000,
    });
  }
  return cards;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx vitest run src/sim/turf/__tests__/generators.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/turf/generators.ts src/sim/turf/__tests__/generators.test.ts
git commit -m "feat: category-based weapon/drug generators (50 each), simplified cash"
```

---

### Task 6: Fix ai-fuzzy.ts for Unified API

**Files:**
- Modify: `src/sim/turf/ai-fuzzy.ts`

- [ ] **Step 1: Fix resource calculation in evaluateFuzzy**

In `src/sim/turf/ai-fuzzy.ts`, replace lines 132-136:

```typescript
// OLD:
const handTotal = p.hand.crew.length + p.hand.product.length +
  p.hand.cash.length + p.hand.weapon.length;
const drawTotal = p.crewDraw.length + p.productDraw.length +
  p.cashDraw.length + p.weaponDraw.length;

// NEW:
const handTotal = p.hand.crew.length + p.hand.modifiers.length;
const drawTotal = p.crewDraw.length + p.modifierDraw.length;
```

- [ ] **Step 2: Verify ai-fuzzy.ts compiles**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx tsc --noEmit 2>&1 | grep ai-fuzzy`
Expected: No errors from ai-fuzzy.ts.

- [ ] **Step 3: Commit**

```bash
git add src/sim/turf/ai-fuzzy.ts
git commit -m "fix: ai-fuzzy uses unified hand.modifiers and modifierDraw"
```

---

### Task 7: Rewrite game.ts for Unified Modifier API

**Files:**
- Rewrite: `src/sim/turf/game.ts`
- Create: `src/sim/turf/__tests__/game.test.ts`

This is the largest task. The entire `drawPhase()`, `aiBuildupTurn()`, `tryAction()`, `handleOutcome()`, and `buildSharedDeck()` functions need rewriting.

- [ ] **Step 1: Write integration test — a game completes without crashing**

Create `src/sim/turf/__tests__/game.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { playTurfGame } from '../game';
import { DEFAULT_TURF_CONFIG } from '../types';

describe('playTurfGame', () => {
  it('completes a game without crashing', () => {
    const result = playTurfGame(DEFAULT_TURF_CONFIG, 42);
    expect(result.winner).toMatch(/^[AB]$/);
    expect(result.turnCount).toBeGreaterThan(0);
    expect(result.metrics.turns).toBeGreaterThan(0);
  });

  it('is deterministic with same seed', () => {
    const a = playTurfGame(DEFAULT_TURF_CONFIG, 12345);
    const b = playTurfGame(DEFAULT_TURF_CONFIG, 12345);
    expect(a.winner).toBe(b.winner);
    expect(a.turnCount).toBe(b.turnCount);
    expect(a.metrics).toEqual(b.metrics);
  });

  it('uses all card types', () => {
    const result = playTurfGame(DEFAULT_TURF_CONFIG, 42);
    expect(result.metrics.crewPlaced).toBeGreaterThan(0);
    expect(result.metrics.cashPlayed + result.metrics.productPlayed).toBeGreaterThan(0);
  });

  it('ends by seizure or timeout', () => {
    const result = playTurfGame(DEFAULT_TURF_CONFIG, 42);
    expect(['total_seizure', 'timeout']).toContain(result.endReason);
  });

  it('completes 10 games with different seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const result = playTurfGame(DEFAULT_TURF_CONFIG, seed * 1000);
      expect(result.winner).toMatch(/^[AB]$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx vitest run src/sim/turf/__tests__/game.test.ts`
Expected: FAIL — game.ts references old API.

- [ ] **Step 3: Rewrite game.ts**

Replace the entire content of `src/sim/turf/game.ts`. Key changes:
- `buildSharedDeck()` generates 50 weapons + 50 drugs + 30 cash, picks 25 crew + 25 modifiers (8 weapons + 8 drugs + 9 cash)
- `initPlayer()` already works (uses unified modifierDraw + hand.modifiers)
- `drawPhase()` draws from `crewDraw` and `modifierDraw` only
- `aiBuildupTurn()` reads from `p.hand.modifiers`, filters by type, uses `placeModifier()`
- `tryAction()` reads from `p.hand.modifiers`, filters by type, uses `placeModifier()`
- `handleOutcome()` uses `p.modifierDraw` for weapon-on-kill rewards
- `shouldStrike()` reads `p.hand.modifiers` and `p.hand.crew`
- In-game currency events: award $100 CashCard to hand on kill-with-fence, seize, funded-flip-win

```typescript
/**
 * Turf war game loop — buildup + combat phases.
 * Unified modifier API: all quarter-cards in hand.modifiers / modifierDraw.
 */

import type {
  TurfGameState, TurfGameConfig, TurfGameResult,
  TurfMetrics, PlayerState, CrewCard, ModifierCard,
  ProductCard, CashCard, WeaponCard,
} from './types';
import { DEFAULT_TURF_CONFIG } from './types';
import { createRng, randomSeed } from '../cards/rng';
import { generateAllCards } from '../cards/generator';
import { generateWeapons, generateDrugs, generateCash } from './generators';
import {
  createBoard, findEmptyActive, placeCrew, placeModifier,
  seizedCount, findPushReady, findFundedReady, findDirectReady,
  positionPower, positionDefense, seizePosition, tickPositions,
  hasEmptySlot,
} from './board';
import {
  resolveDirectAttack, resolveFundedAttack, resolvePushedAttack,
  canPrecisionAttack,
} from './attacks';
import { evaluateFuzzy } from './ai-fuzzy';
import { resolveState, getStatePriorities, type AiState } from './ai-states';

function emptyMetrics(): TurfMetrics {
  return {
    turns: 0, directAttacks: 0, fundedAttacks: 0, pushedAttacks: 0,
    kills: 0, flips: 0, seizures: 0, busts: 0, weaponsDrawn: 0,
    productPlayed: 0, cashPlayed: 0, crewPlaced: 0,
    positionsReclaimed: 0, passes: 0,
    buildupRoundsA: 0, buildupRoundsB: 0, combatRounds: 0,
    totalActions: 0, firstStrike: null,
  };
}

interface DeckTemplate {
  crew: CrewCard[];
  modifiers: ModifierCard[];
}

function buildSharedDeck(crewPool: CrewCard[], rng: ReturnType<typeof createRng>): DeckTemplate {
  const weaponPool = generateWeapons(rng);
  const drugPool = generateDrugs(rng);
  const cashPool = generateCash();

  const crew = rng.shuffle([...crewPool]).slice(0, 25);
  const weapons = rng.shuffle([...weaponPool.filter(w => w.unlocked)]).slice(0, 8);
  const drugs = rng.shuffle([...drugPool.filter(d => d.unlocked)]).slice(0, 8);
  const cash = rng.shuffle([...cashPool]).slice(0, 9);
  const modifiers = rng.shuffle([...weapons, ...drugs, ...cash] as ModifierCard[]);

  return { crew, modifiers };
}

function initPlayer(
  side: 'A' | 'B',
  config: TurfGameConfig,
  template: DeckTemplate,
  rng: ReturnType<typeof createRng>,
): PlayerState {
  const crewDeck = rng.shuffle(template.crew.map(c => ({ ...c })));
  const modifierDeck = rng.shuffle(
    template.modifiers.map(m => ({ ...m })) as ModifierCard[],
  );

  const hand = {
    crew: crewDeck.splice(0, 3),
    modifiers: modifierDeck.splice(0, 3) as ModifierCard[],
  };

  return {
    board: createBoard(side, config.positionCount, config.reserveCount),
    crewDraw: crewDeck,
    modifierDraw: modifierDeck,
    hand,
    discard: [],
    positionsSeized: 0,
  };
}

function createGame(config: TurfGameConfig, seed: number): TurfGameState {
  const rng = createRng(seed);
  const allCards = generateAllCards(seed, 25);
  const crewPool: CrewCard[] = allCards
    .filter(c => c.unlocked)
    .map(c => ({
      type: 'crew' as const,
      id: c.id,
      displayName: c.displayName,
      archetype: c.archetype,
      affiliation: c.affiliation,
      power: c.power,
      resistance: c.resistance,
      abilityText: c.abilityText,
      unlocked: c.unlocked,
      locked: c.locked,
    }));

  const template = buildSharedDeck(crewPool, rng);

  return {
    config,
    players: {
      A: initPlayer('A', config, template, rng),
      B: initPlayer('B', config, template, rng),
    },
    turnSide: 'A',
    firstPlayer: 'A',
    turnNumber: 0,
    phase: 'buildup',
    buildupTurns: { A: 0, B: 0 },
    hasStruck: { A: false, B: false },
    aiState: { A: 'BUILDING', B: 'BUILDING' },
    aiTurnsInState: { A: 0, B: 0 },
    rng, seed,
    winner: null, endReason: null,
    metrics: emptyMetrics(),
  };
}

// ── Helpers: filter hand by modifier type ──────────────────

function handWeapons(p: PlayerState): WeaponCard[] {
  return p.hand.modifiers.filter((m): m is WeaponCard => m.type === 'weapon');
}

function handDrugs(p: PlayerState): ProductCard[] {
  return p.hand.modifiers.filter((m): m is ProductCard => m.type === 'product');
}

function handCash(p: PlayerState): CashCard[] {
  return p.hand.modifiers.filter((m): m is CashCard => m.type === 'cash');
}

function removeFromHand(p: PlayerState, card: ModifierCard): void {
  const idx = p.hand.modifiers.indexOf(card);
  if (idx >= 0) p.hand.modifiers.splice(idx, 1);
}

function awardCash(p: PlayerState): void {
  const bonus: CashCard = {
    type: 'cash',
    id: `cash-bonus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    denomination: 100,
  };
  p.hand.modifiers.push(bonus);
}

// ── Draw Phase ──────────────────────────────────────────────

function drawPhase(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];
  if (p.crewDraw.length > 0 && p.hand.crew.length < 5) {
    p.hand.crew.push(p.crewDraw.pop()!);
  }
  if (p.modifierDraw.length > 0 && p.hand.modifiers.length < 7) {
    p.hand.modifiers.push(p.modifierDraw.pop()!);
  }
}

// ── AI: Strike Timing ───────────────────────────────────────

function shouldStrike(state: TurfGameState, side: 'A' | 'B'): boolean {
  const p = state.players[side];
  const buildTurns = state.buildupTurns[side];
  const fuzzy = evaluateFuzzy(state, side);

  const currentState = state.aiState[side] as AiState;
  const newState = resolveState(fuzzy, currentState, state.aiTurnsInState[side]);
  if (newState !== currentState) {
    state.aiState[side] = newState;
    state.aiTurnsInState[side] = 0;
  }

  if (fuzzy.aggression > 0.6 && fuzzy.patience < 0.3) return true;
  if (fuzzy.desperation > 0.5) return true;
  if (findPushReady(p.board).length > 0) return true;
  if (findFundedReady(p.board).length > 0 && buildTurns >= 3) return true;
  if (buildTurns >= 8) return true;
  if (p.hand.crew.length === 0 && p.hand.modifiers.length === 0) return true;

  return false;
}

// ── AI: Buildup Actions ─────────────────────────────────────

function aiBuildupTurn(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];
  const m = state.metrics;

  // Place crew on empty positions
  if (p.hand.crew.length > 0) {
    const emptyIdx = findEmptyActive(p.board);
    if (emptyIdx >= 0) {
      placeCrew(p.board, emptyIdx, p.hand.crew.pop()!);
      m.crewPlaced++;
      return;
    }
  }

  // Place a modifier on a crew position (prefer offense slots first)
  const mod = p.hand.modifiers[0];
  if (mod) {
    for (const pos of p.board.active) {
      if (!pos.crew || pos.seized) continue;
      if (placeModifier(p.board, p.board.active.indexOf(pos), mod, 'offense')) {
        removeFromHand(p, mod);
        if (mod.type === 'product') m.productPlayed++;
        else if (mod.type === 'cash') m.cashPlayed++;
        else if (mod.type === 'weapon') m.weaponsDrawn++;
        return;
      }
      if (placeModifier(p.board, p.board.active.indexOf(pos), mod, 'defense')) {
        removeFromHand(p, mod);
        if (mod.type === 'product') m.productPlayed++;
        else if (mod.type === 'cash') m.cashPlayed++;
        else if (mod.type === 'weapon') m.weaponsDrawn++;
        return;
      }
    }
  }
}

// ── AI: Combat Actions ──────────────────────────────────────

function aiCombatTurn(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];
  const m = state.metrics;

  const fuzzy = evaluateFuzzy(state, side);
  const currentState = state.aiState[side] as AiState;
  const newState = resolveState(fuzzy, currentState, state.aiTurnsInState[side]);
  if (newState !== currentState) {
    state.aiState[side] = newState;
    state.aiTurnsInState[side] = 0;
  }
  state.aiTurnsInState[side]++;

  const priorities = getStatePriorities(newState);

  for (const action of priorities) {
    if (tryAction(state, side, action)) return;
  }

  m.passes++;
}

function tryAction(state: TurfGameState, side: 'A' | 'B', action: string): boolean {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const m = state.metrics;

  switch (action) {
    case 'reclaim': {
      const seizedIdx = p.board.active.findIndex(pos => pos.seized);
      if (seizedIdx < 0) return false;
      if (p.hand.crew.length === 0) return false;
      const cash = handCash(p);
      if (cash.length === 0) return false;
      const crew = p.hand.crew.pop()!;
      removeFromHand(p, cash[0]);
      const weakCrew: CrewCard = {
        ...crew,
        power: Math.max(1, Math.floor(crew.power / 2)),
        resistance: Math.max(1, Math.floor(crew.resistance / 2)),
      };
      p.board.active[seizedIdx].seized = false;
      p.board.active[seizedIdx].crew = weakCrew;
      p.board.active[seizedIdx].turnsActive = 0;
      opp.positionsSeized = Math.max(0, opp.positionsSeized - 1);
      m.positionsReclaimed++;
      m.crewPlaced++;
      m.cashPlayed++;
      return true;
    }

    case 'pushed_attack': {
      const ready = findPushReady(p.board);
      if (ready.length === 0) return false;
      const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
      if (targetIdx < 0) return false;
      m.pushedAttacks++;
      const outcome = resolvePushedAttack(
        p.board.active[ready[0]], opp.board.active[targetIdx],
        opp.board.active, state.config,
      );
      handleOutcome(state, side, outcome, opp, targetIdx);
      return true;
    }

    case 'funded_attack': {
      const ready = findFundedReady(p.board);
      if (ready.length === 0) return false;
      const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
      if (targetIdx < 0) return false;
      m.fundedAttacks++;
      const outcome = resolveFundedAttack(
        p.board.active[ready[0]], opp.board.active[targetIdx],
        state.config,
      );
      handleOutcome(state, side, outcome, opp, targetIdx);
      return true;
    }

    case 'arm_weapon': {
      const weapons = handWeapons(p);
      if (weapons.length === 0) return false;
      for (let i = 0; i < p.board.active.length; i++) {
        const pos = p.board.active[i];
        if (!pos.crew || pos.seized || pos.turnsActive < 1) continue;
        if (!pos.weaponTop && placeModifier(p.board, i, weapons[0], 'offense')) {
          removeFromHand(p, weapons[0]);
          m.weaponsDrawn++;
          return true;
        }
        if (!pos.weaponBottom && placeModifier(p.board, i, weapons[0], 'defense')) {
          removeFromHand(p, weapons[0]);
          m.weaponsDrawn++;
          return true;
        }
      }
      return false;
    }

    case 'stack_product': {
      const drugs = handDrugs(p);
      if (drugs.length === 0) return false;
      for (let i = 0; i < p.board.active.length; i++) {
        const pos = p.board.active[i];
        if (!pos.crew || pos.seized) continue;
        if (!pos.drugTop && placeModifier(p.board, i, drugs[0], 'offense')) {
          removeFromHand(p, drugs[0]);
          m.productPlayed++;
          return true;
        }
        if (!pos.drugBottom && placeModifier(p.board, i, drugs[0], 'defense')) {
          removeFromHand(p, drugs[0]);
          m.productPlayed++;
          return true;
        }
      }
      return false;
    }

    case 'stack_cash': {
      const cash = handCash(p);
      if (cash.length === 0) return false;
      for (let i = 0; i < p.board.active.length; i++) {
        const pos = p.board.active[i];
        if (!pos.crew || pos.seized) continue;
        if (!pos.cashLeft && placeModifier(p.board, i, cash[0], 'offense')) {
          removeFromHand(p, cash[0]);
          m.cashPlayed++;
          return true;
        }
        if (!pos.cashRight && placeModifier(p.board, i, cash[0], 'defense')) {
          removeFromHand(p, cash[0]);
          m.cashPlayed++;
          return true;
        }
      }
      return false;
    }

    case 'direct_attack': {
      const ready = findDirectReady(p.board);
      if (ready.length === 0) return false;
      const sorted = ready.sort((a, b) =>
        positionPower(p.board.active[b]) - positionPower(p.board.active[a]),
      );
      for (const atkIdx of sorted) {
        const atkPos = p.board.active[atkIdx];
        const targetIdx = opp.board.active.findIndex(pos =>
          pos.crew !== null &&
          canPrecisionAttack(positionPower(atkPos), positionDefense(pos),
            state.config.precisionMult, atkPos.crew!.archetype === 'bruiser'),
        );
        if (targetIdx >= 0) {
          m.directAttacks++;
          const outcome = resolveDirectAttack(atkPos, opp.board.active[targetIdx]);
          handleOutcome(state, side, outcome, opp, targetIdx);
          return true;
        }
      }
      return false;
    }

    case 'place_crew': {
      if (p.hand.crew.length === 0) return false;
      const emptyIdx = findEmptyActive(p.board);
      if (emptyIdx < 0) return false;
      placeCrew(p.board, emptyIdx, p.hand.crew.pop()!);
      m.crewPlaced++;
      return true;
    }

    default:
      return false;
  }
}

function handleOutcome(
  state: TurfGameState,
  attackerSide: 'A' | 'B',
  outcome: ReturnType<typeof resolveDirectAttack>,
  opp: PlayerState,
  targetIdx: number,
): void {
  const p = state.players[attackerSide];
  const m = state.metrics;

  if (outcome.type === 'kill') {
    m.kills++;
    // In-game currency event: seize awards $100
    awardCash(p);
    // Check for fence archetype kill bonus
    const atkPositions = p.board.active.filter(pos => pos.crew?.archetype === 'fence');
    if (atkPositions.length > 0) awardCash(p);

    if (!opp.board.active[targetIdx].crew) {
      seizePosition(opp.board.active[targetIdx]);
      m.seizures++;
      p.positionsSeized++;
    }
  } else if (outcome.type === 'flip') {
    m.flips += outcome.gainedCards.length;
    // In-game currency event: funded flip win awards $100
    awardCash(p);
    for (const card of outcome.gainedCards) {
      if (card.type === 'crew') {
        const emptyIdx = findEmptyActive(p.board);
        if (emptyIdx >= 0) placeCrew(p.board, emptyIdx, card as CrewCard);
      }
    }
    if (!opp.board.active[targetIdx].crew) {
      seizePosition(opp.board.active[targetIdx]);
      m.seizures++;
      p.positionsSeized++;
    }
  } else if (outcome.type === 'busted' || outcome.type === 'seized') {
    m.busts++;
  }
}

// ── Win Check ───────────────────────────────────────────────

function checkWin(state: TurfGameState): boolean {
  for (const side of ['A', 'B'] as const) {
    const opp = side === 'A' ? 'B' : 'A';
    if (seizedCount(state.players[opp].board) >= state.config.positionCount) {
      state.winner = side;
      state.endReason = 'total_seizure';
      return true;
    }
  }
  return false;
}

// ── Main Loop ───────────────────────────────────────────────

export function playTurfGame(
  config: TurfGameConfig = DEFAULT_TURF_CONFIG,
  seed?: number,
): TurfGameResult {
  const gameSeed = seed ?? randomSeed();
  const state = createGame(config, gameSeed);
  let roundNumber = 0;

  // ── BUILDUP PHASE ──
  while (state.phase === 'buildup' && roundNumber < config.maxBuildupRounds) {
    roundNumber++;
    state.turnNumber++;
    state.metrics.turns++;
    state.buildupTurns.A++;
    state.buildupTurns.B++;

    tickPositions(state.players.A.board);
    tickPositions(state.players.B.board);
    drawPhase(state, 'A');
    drawPhase(state, 'B');

    const aStrikes = shouldStrike(state, 'A');
    const bStrikes = shouldStrike(state, 'B');

    if (aStrikes || bStrikes) {
      state.phase = 'combat';
      state.metrics.buildupRoundsA = state.buildupTurns.A;
      state.metrics.buildupRoundsB = state.buildupTurns.B;
      state.metrics.firstStrike = (aStrikes && bStrikes) ? null
        : aStrikes ? 'A' : 'B';
      break;
    }

    const first = state.rng.next() < 0.5 ? 'A' : 'B';
    const second: 'A' | 'B' = first === 'A' ? 'B' : 'A';
    aiBuildupTurn(state, first);
    aiBuildupTurn(state, second);
  }

  if (state.phase === 'buildup') {
    state.phase = 'combat';
    state.metrics.buildupRoundsA = state.buildupTurns.A;
    state.metrics.buildupRoundsB = state.buildupTurns.B;
  }

  // ── COMBAT PHASE ──
  while (!state.winner && roundNumber < config.maxRounds) {
    roundNumber++;
    state.metrics.combatRounds++;
    state.metrics.turns++;

    tickPositions(state.players.A.board);
    tickPositions(state.players.B.board);
    drawPhase(state, 'A');
    drawPhase(state, 'B');

    let actionsA = config.actionsPerRound;
    let actionsB = config.actionsPerRound;

    while ((actionsA > 0 || actionsB > 0) && !state.winner) {
      const aGoesFirst = state.rng.next() < 0.5;

      if (aGoesFirst) {
        if (actionsA > 0) { aiCombatTurn(state, 'A'); actionsA--; state.metrics.totalActions++; }
        if (actionsB > 0 && !state.winner) { aiCombatTurn(state, 'B'); actionsB--; state.metrics.totalActions++; }
      } else {
        if (actionsB > 0) { aiCombatTurn(state, 'B'); actionsB--; state.metrics.totalActions++; }
        if (actionsA > 0 && !state.winner) { aiCombatTurn(state, 'A'); actionsA--; state.metrics.totalActions++; }
      }

      if (checkWin(state)) break;
    }

    if (checkWin(state)) break;
  }

  if (!state.winner) {
    const seizedA = state.players.A.positionsSeized;
    const seizedB = state.players.B.positionsSeized;
    state.winner = seizedA >= seizedB ? 'A' : 'B';
    state.endReason = 'timeout';
  }

  return {
    winner: state.winner,
    endReason: state.endReason!,
    firstPlayer: 'A',
    turnCount: roundNumber,
    metrics: state.metrics,
    seed: gameSeed,
    finalState: {
      seizedA: seizedCount(state.players.A.board),
      seizedB: seizedCount(state.players.B.board),
    },
  };
}
```

- [ ] **Step 4: Run the game test**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx vitest run src/sim/turf/__tests__/game.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run ALL tests to check nothing broke**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/turf/game.ts src/sim/turf/__tests__/game.test.ts
git commit -m "feat: rewrite game.ts for unified modifier API"
```

---

### Task 8: Update run.ts for Expanded Pools

**Files:**
- Modify: `src/sim/turf/run.ts`

- [ ] **Step 1: Update run.ts to report on expanded card pools**

The existing run.ts works with `playTurfGame()` which now internally generates the expanded pools. The runner itself just needs minor updates to remove references to old pool functions (if any imports remain from `generateProducts`/old `generateWeapons`) and add category usage tracking.

Add after the existing metrics output (around line 95, before the issues section):

```typescript
// ── Category Usage ──────────────────────────────────────────
// (Category tracking will be added when attacks.ts resolves abilities)
```

No breaking changes needed — `playTurfGame()` encapsulates everything. Verify it runs.

- [ ] **Step 2: Run a quick simulation to verify the full loop**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx tsx src/sim/turf/run.ts --games 100`
Expected: Completes without errors. Reports win rates, turn counts, etc.

- [ ] **Step 3: Run a larger simulation**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx tsx src/sim/turf/run.ts --games 3000`
Expected: Completes. Win rate within 45-55%. No issues flagged.

- [ ] **Step 4: Commit**

```bash
git add src/sim/turf/run.ts
git commit -m "chore: update run.ts for expanded card pools"
```

---

### Task 9: Balance Simulation Run

**Files:**
- No file changes — this task runs simulations and evaluates results.

- [ ] **Step 1: Run 10k game balance test**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx tsx src/sim/turf/run.ts --games 10000`

Expected: Completes. Check these metrics against targets:
- Win rate A/B: 45-55%
- Stall/timeout rate: <5%
- Pass rate: <20% per game
- Avg rounds: 12-20
- All card types used (crewPlaced, cashPlayed, productPlayed, weaponsDrawn all > 0)

- [ ] **Step 2: If balance is off, diagnose and adjust**

If win rate is outside 45-55% or timeout rate is high, the likely causes are:
1. Modifier stat ranges too high/low — adjust `getBonusRange()`/`getPotencyRange()` in generators.ts
2. Draw rates too fast/slow — adjust hand size limits in `drawPhase()`
3. Crew power/resistance scaling — adjust `calcPower()`/`calcResistance()` in generator.ts

Make adjustments, re-run, iterate until targets are met.

- [ ] **Step 3: Run final validation at 10k**

Run: `cd /Users/jbogaty/src/arcade-cabinet/mean-streets && npx tsx src/sim/turf/run.ts --games 10000`
Expected: All metrics within targets.

- [ ] **Step 4: Commit the balance report**

```bash
git add sim/reports/turf/
git commit -m "chore: balance report — 10k games with expanded card pools"
```

---

### Task 10: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/plans/port-to-production.prq.md`

- [ ] **Step 1: Update CLAUDE.md key types section**

Update the Key Types section to reflect the new card types:

```markdown
## Key Types

- `Position` — A street slot with crew + 6 quarter-card modifier slots (drugTop/Bottom, weaponTop/Bottom, cashLeft/Right)
- `PlayerState` — Board + crewDraw + modifierDraw (unified) + hand (crew + modifiers)
- `WeaponCard` — Has category (bladed/blunt/explosive/ranged/stealth), bonus, dual offense/defense abilities
- `ProductCard` — Has category (stimulant/sedative/hallucinogen/steroid/narcotic), potency, dual offense/defense abilities
- `CashCard` — Two denominations only: $100 or $1000
- `placeModifier(board, idx, card, 'offense'|'defense')` — Unified modifier placement
- `positionPower(pos)` — Effective attack (crew power + top weapon + top drug)
- `positionDefense(pos)` — Effective defense (crew resistance + bottom weapon + bottom drug)
```

- [ ] **Step 2: Update CLAUDE.md known issues section**

Remove the old broken API note. Replace with current state:

```markdown
## Known Issues

- Category abilities (LACERATE, PARRY, RUSH, etc.) are tracked on cards but not yet resolved in combat — attacks.ts uses raw bonus/potency values only. Full ability resolution is a future task.
- Archetype abilities (Bruiser OVERWHELM, Ghost PHANTOM_STRIKE, etc.) are partially implemented — only bruiser's precision-ignore is active.
```

- [ ] **Step 3: Update docs/DESIGN.md with weapon/drug categories**

Add the weapon and drug category tables from the spec to the design doc.

- [ ] **Step 4: Update docs/ARCHITECTURE.md with new file map**

Update the directory structure to show `weapon-categories.json`, `drug-categories.json`, and the removed files.

- [ ] **Step 5: Update PRD checklist**

In `docs/plans/port-to-production.prq.md`, mark Phase 1 items as done:
```markdown
### Phase 1: Fix Simulation Engine
- [x] Rewrite game.ts for unified modifier system
- [x] Update ai-fuzzy.ts for unified hand
- [x] Expand weapon pool to 50 (5 categories x 10)
- [x] Expand drug pool to 50 (5 categories x 10)
- [x] Simplify cash to $100/$1000
- [x] Run 10k balance test, verify 45-55%
- [x] Commit clean
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/DESIGN.md docs/ARCHITECTURE.md docs/plans/port-to-production.prq.md
git commit -m "docs: update all docs for expanded card pools and fixed engine"
```

---

## Execution Order & Dependencies

```
Task 1 (vitest config) ─── no dependencies
Task 2 (types) ─────────── no dependencies
Task 3 (data files) ────── depends on Task 2 (types must exist for JSON shape)
Task 4 (crew generator) ── depends on Task 2 (CharacterCard schema)
Task 5 (generators) ────── depends on Task 2 + 3 (types + JSON pools)
Task 6 (ai-fuzzy fix) ──── depends on Task 2 (PlayerState type)
Task 7 (game.ts rewrite) ─ depends on Task 2 + 5 + 6 (all types, generators, ai-fuzzy)
Task 8 (run.ts update) ─── depends on Task 7 (game.ts must work)
Task 9 (balance run) ───── depends on Task 8 (runner must work)
Task 10 (docs) ──────────── depends on Task 9 (final metrics)
```

**Parallelizable:** Tasks 1, 2 can run in parallel. Tasks 3, 4 can run in parallel (both depend on 2). Task 5 depends on 3. Task 6 depends on 2 only. Tasks 5 and 6 can run in parallel.
