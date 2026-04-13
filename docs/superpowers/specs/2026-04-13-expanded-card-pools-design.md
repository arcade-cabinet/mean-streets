---
title: Expanded Card Pools & Balance System
updated: 2026-04-13
status: current
domain: product
---

# Expanded Card Pools & Balance System

## Summary

Expand Mean Streets from the current shortcut card pools to the full design:
- 100 crew cards (exists, needs balance pass)
- 50 unique weapons (currently 25, needs expansion + category system)
- 50 unique drugs (currently 25 permutations, needs full rework + category system)
- Simplified currency (2 tiers only: $100 and $1000)
- Balance lock system for iterative simulation-driven balancing
- Fix broken game.ts/ai-fuzzy.ts to use unified modifier API

## Card Pools

### Crew Cards (100 total, 25 per deck)

**Already implemented.** 100 named characters generated from name pools + 12 archetypes + 10 affiliations. Power scales 1-10 across the pool, adjusted by archetype `powerMod`. 20 unlocked at start (increased to 25 to match deck size).

**Changes needed:**
- Add `resistance` as an independent stat (currently derived as `power - 1`)
- Resistance should scale independently: tanky archetypes (Medic, Enforcer) get higher resistance, glass cannon archetypes (Sniper, Ghost) get lower
- Add `locked: boolean` for balance iteration tracking
- Increase starter unlock count from 20 to 25

### Weapon Cards (50 total, generated from categories)

**5 weapon categories, 10 weapons each.**

Each weapon has a `bonus` stat (raw damage/effect magnitude) and dual abilities based on placement orientation (offensive top slot vs defensive bottom slot).

| Category | Offense Ability (top) | Defense Ability (bottom) | Bonus Range | bonusMod |
|----------|----------------------|-------------------------|-------------|----------|
| Bladed | LACERATE: target bleeds, -1 resistance/round for `bonus` rounds | PARRY: attacker takes `bonus` counter-damage | 1-3 | 0 |
| Blunt | SHATTER: on kill, destroys one modifier on target position | BRACE: absorb first `bonus` damage before resistance takes hits | 2-4 | +1 |
| Explosive | BLAST: splash `bonus` damage to adjacent positions | DETERRENT: attackers must exceed defense by `bonus` extra to kill | 2-4 | 0 |
| Ranged | REACH: can target any enemy position, not just front-line | OVERWATCH: deal `bonus` damage to crew placed on adjacent positions | 1-2 | -1 |
| Stealth | AMBUSH: no counter-damage, attacker takes 0 retaliation | EVASION: first `bonus` attacks against this position miss | 1-2 | -1 |

**Generation:**
- Each category has its own name pool (Bladed: Switchblade, Box Cutter, Stiletto...; Blunt: Crowbar, Baseball Bat, Pipe Wrench...; etc.)
- Seeded PRNG generates 10 unique weapons per category
- Bonus scales within category: cards 1-2 get min bonus, 9-10 get max, smooth curve between
- `bonusMod` adjusts final bonus like crew `powerMod`
- 20 unlocked at start (4 per category), 30 locked behind achievements
- Each card has `locked: boolean` for balance tracking

**Type definition:**
```typescript
interface WeaponCategory {
  id: string;           // 'bladed' | 'blunt' | 'explosive' | 'ranged' | 'stealth'
  title: string;
  description: string;
  offenseAbility: string;    // ability ID
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  bonusMod: number;     // -1 to +1
}

interface WeaponCard {
  type: 'weapon';
  id: string;
  name: string;
  category: string;     // references WeaponCategory.id
  bonus: number;        // 1-5, adjusted by bonusMod
  offenseAbility: string;
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;      // balance lock
}
```

### Drug Cards (50 total, generated from categories)

**5 drug categories, 10 drugs each.**

Each drug has a `potency` stat and dual abilities based on placement orientation.

| Category | Offense Ability (top) | Defense Ability (bottom) | Potency Range | potencyMod |
|----------|----------------------|-------------------------|---------------|------------|
| Stimulant | RUSH: crew acts immediately, no setup turn cooldown | REFLEXES: crew counter-attacks for `potency` damage when hit | 1-3 | 0 |
| Sedative | SUPPRESS: target crew's power reduced by `potency` for 2 rounds | NUMB: crew ignores first `potency` points of damage per round | 2-4 | +1 |
| Hallucinogen | CONFUSE: funded flip threshold reduced by `potency` | PARANOIA: funded flips against this crew cost `potency` extra cash | 1-3 | 0 |
| Steroid | BULK: crew gets +`potency` power for attacks | FORTIFY: crew gets +`potency` resistance | 2-4 | +1 |
| Narcotic | BERSERK: crew power boosted by `potency` but takes 1 self-damage after attacking | PAINKILLERS: crew survives next `potency` killing blows at 1 resistance | 1-2 | -1 |

**Generation:**
- Drug names use adjective+noun pools, partitioned by category:
  - Stimulant adjectives: Electric, Lightning, Turbo, Hyper, Surge...
  - Sedative adjectives: Midnight, Velvet, Smooth, Deep, Slow...
  - Hallucinogen adjectives: Crystal, Rainbow, Spiral, Fractal, Cosmic...
  - Steroid adjectives: Iron, Titan, Bull, Raw, Heavy...
  - Narcotic adjectives: Black, Shadow, Ghost, Numb, Void...
- Shared nouns per category (Rush, Haze, Cloud, Dust, etc.)
- Seeded PRNG generates 10 unique drugs per category
- Potency scales 1-5 within category, adjusted by `potencyMod`
- 20 unlocked at start (4 per category), 30 locked behind achievements
- Each card has `locked: boolean` for balance tracking

**Type definition:**
```typescript
interface DrugCategory {
  id: string;           // 'stimulant' | 'sedative' | 'hallucinogen' | 'steroid' | 'narcotic'
  title: string;
  description: string;
  offenseAbility: string;
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  potencyMod: number;   // -1 to +1
}

interface ProductCard {
  type: 'product';
  id: string;
  name: string;
  category: string;     // references DrugCategory.id
  potency: number;      // 1-5, adjusted by potencyMod
  offenseAbility: string;
  offenseAbilityText: string;
  defenseAbility: string;
  defenseAbilityText: string;
  unlocked: boolean;
  unlockCondition?: string;
  locked: boolean;      // balance lock
}
```

### Currency (Simplified)

**Two denominations only. No categories, no abilities. Just money.**

| Card | Value | Base Count | Max (via achievements) |
|------|-------|-----------|----------------------|
| $100 bill | 100 | 25 | 35 |
| $1000 stack | 1000 | 5 | 10 |

**Rules:**
- Players always have at least 25x $100 + 5x $1000 available for deck building
- Achievement unlocks grant additional copies (ephemeral: the unlock persists, the bonus copies reset to the achievement-granted count each game session, not cumulative)
- During games, events can award bonus cash cards (one-game-only, don't persist)
- Cash cards have no special abilities. $100 offensive pays for small funded attacks; $1000 offensive is a big play. Defensive cash resists flips.
- Strategy: loading cash into your 25-card modifier deck means fewer weapons/drugs, but more funded attack/defense capability

**Type definition (simplified):**
```typescript
interface CashCard {
  type: 'cash';
  id: string;
  denomination: 100 | 1000;  // only two values
}
```

**In-game currency events (awarded automatically during gameplay, don't persist):**
- Kill with Fence archetype: +1 $100 added to hand
- Control 4+ positions: +1 $100 added to hand per round
- Seize a position: +1 $100 added to hand
- Win a funded flip: +1 $100 added to hand (attacker keeps excess)

These trigger automatically in the sim (AI uses them like any other cash). In the future UI, they trigger on the game event and the player can place them immediately.

## Deck Composition

Each player builds a 50-card deck:

| Deck | Count | Source |
|------|-------|--------|
| Crew | 25 | Picked from unlocked crew pool (up to 100) |
| Modifiers | 25 | Any mix of weapons, drugs, cash from unlocked pools |

**Modifier deck constraints:**
- Minimum 3 weapons
- Minimum 3 drugs
- Minimum 3 cash cards
- Remaining 16 slots: free choice

This prevents degenerate all-weapon or all-drug decks while allowing heavy specialization.

## Balance Lock System

**Every crew, weapon, and drug card gets a `locked` boolean.**

### How It Works

1. **Initial run**: All cards unlocked. Sim runs 10k games, analyzes per-card performance metrics (win rate when included, damage dealt, damage absorbed, times picked by AI, etc.)
2. **Recommendations**: Sim outputs stat adjustment recommendations for underperforming/overperforming cards
3. **Apply & re-run**: Apply recommendations, run again
4. **Auto-lock criteria**: A card is locked when it meets ALL of:
   - 3 consecutive balance runs with no recommended changes
   - Win rate delta < 2% when included vs excluded
   - Usage rate within 1 standard deviation of category mean
5. **Locked cards**: Excluded from future balance recommendations. Still used in simulation. Displayed in reports as locked count.
6. **Manual unlock**: Any card can be force-unlocked if systemic issues are discovered

### Report Format

```
=== BALANCE REPORT (seed: 42, games: 10000) ===
LOCKED: 47/100 crew | 38/50 weapons | 41/50 drugs
UNLOCKED: 53 crew | 12 weapons | 9 drugs — recommendations below

CREW RECOMMENDATIONS:
  card-042 "Brick the Bruiser" — power 7→6 (win rate 58% when included)
  card-087 "Silent the Ghost" — power 3→4 (win rate 41% when included)
  ...

WEAPON RECOMMENDATIONS:
  weap-23 "Serrated Blade" (bladed) — bonus 3→2 (LACERATE stacking too strong)
  ...

DRUG RECOMMENDATIONS:
  drug-15 "Iron Surge" (steroid) — potency 4→3 (FORTIFY+BULK too dominant)
  ...
```

## Fixing the Broken Engine

### game.ts Rewrite

The `drawPhase()`, `aiBuildupTurn()`, `tryAction()`, and `handleOutcome()` functions reference the old split-hand API:
- `p.hand.product`, `p.hand.cash`, `p.hand.weapon` → `p.hand.modifiers` (unified)
- `p.cashDraw`, `p.productDraw`, `p.weaponDraw` → `p.modifierDraw` (unified)
- `stackCash()`, `stackDrug()`, `armCrew()` → `placeModifier(board, idx, card, 'offense'|'defense')`
- `pos.weaponOffense`, `pos.drugOffense`, `pos.cash` → `pos.weaponTop`, `pos.drugTop`, `pos.cashLeft` etc.

### ai-fuzzy.ts Rewrite

Lines 132-136 reference split hand/draw piles:
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

### buildSharedDeck() Update

Current: slices to 15 crew, 8 products, 10 cash, 8 weapons = 41 cards.
New: Both players get 25 crew + 25 modifiers from the full generated pools.

```typescript
function buildSharedDeck(crewPool, weaponPool, drugPool, cashPool, rng): DeckTemplate {
  const crew = rng.shuffle([...crewPool]).slice(0, 25);
  // For sim: AI picks a balanced modifier mix
  const weapons = rng.shuffle([...weaponPool]).slice(0, 8);
  const drugs = rng.shuffle([...drugPool]).slice(0, 8);
  const cash = rng.shuffle([...cashPool]).slice(0, 9);  // 8+8+9 = 25
  const modifiers = rng.shuffle([...weapons, ...drugs, ...cash]);
  return { crew, modifiers };
}
```

### Category Ability Resolution

Attacks.ts needs updating to resolve weapon/drug category abilities based on slot placement:
- Check `pos.weaponTop?.category` to determine which offense ability fires
- Check `pos.weaponBottom?.category` to determine which defense ability fires
- Same for drugs: `pos.drugTop?.category` for offense, `pos.drugBottom?.category` for defense
- Ability resolution is deterministic (no dice)

## Data Files

### New/Modified JSON Pools

| File | Change |
|------|--------|
| `src/data/pools/weapon-categories.json` | NEW: 5 categories with abilities, bonusMod, name pools |
| `src/data/pools/drug-categories.json` | NEW: 5 categories with abilities, potencyMod, name pools |
| `src/data/pools/weapons.json` | REWRITE: name pools per category (replace hand-authored 25) |
| `src/data/pools/products.json` | REWRITE: name pools per category (replace adjective+noun) |

### New/Modified Source Files

| File | Change |
|------|--------|
| `src/sim/turf/types.ts` | Update WeaponCard, ProductCard, CashCard types. Add category fields, dual abilities, balance lock |
| `src/sim/turf/generators.ts` | Rewrite weapon/drug generators for category-based pool generation (50 each). Simplify cash to $100/$1000 |
| `src/sim/turf/board.ts` | No changes needed (already uses unified placeModifier API) |
| `src/sim/turf/attacks.ts` | Add category ability resolution for offense/defense slots |
| `src/sim/turf/game.ts` | Full rewrite of drawPhase, aiBuildupTurn, tryAction, handleOutcome for unified modifier API |
| `src/sim/turf/ai-fuzzy.ts` | Fix resource calculation to use unified hand/draw |
| `src/sim/turf/run.ts` | Update to generate 50 weapons + 50 drugs, add balance lock reporting |
| `src/sim/cards/generator.ts` | Add resistance as independent stat, add locked field, increase starter unlocks to 25 |
| `src/sim/cards/schemas.ts` | Add Zod schemas for WeaponCategory, DrugCategory, updated card types |

## Balance Targets

| Metric | Target |
|--------|--------|
| Win rate A/B | 45-55% |
| Stall rate | <5% |
| Pass rate | <20% per game |
| Avg rounds | 12-20 |
| Seizure wins | >95% |
| All card types actively used | Yes |
| No single weapon category >30% usage | Yes |
| No single drug category >30% usage | Yes |
| Per-card win rate delta | <5% when included vs excluded |

## Out of Scope

- UI components (Phase 3 in PRD)
- Audio (Phase 4)
- Meta-progression/achievement system implementation (Phase 5)
- Archetype ability IMPLEMENTATION in combat (many abilities are tracked as text but not yet resolved in code — that's a separate task)
