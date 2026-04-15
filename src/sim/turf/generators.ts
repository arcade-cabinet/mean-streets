/**
 * Runtime card pool loaders and generators.
 *
 * Weapons, drugs, and special (backpack/cash) definitions come from the
 * compiled card catalog at config/compiled/, which is produced by
 * scripts/compile-cards.mjs from the authored tuning-history JSON under
 * config/raw/cards/.
 *
 * Cash cards are cloned into a pool at runtime from the two authored
 * denominations. Backpacks are player-packed at deckbuild time (see
 * src/sim/turf/deck-builder.ts); the legacy 30-kit generator has been
 * removed.
 */

import compiledWeapons from '../../../config/compiled/weapons.json';
import compiledDrugs from '../../../config/compiled/drugs.json';
import compiledSpecial from '../../../config/compiled/special.json';
import {
  CompiledWeaponSchema,
  CompiledDrugSchema,
  CardSpecialSchema,
  type CompiledWeapon,
  type CompiledDrug,
} from '../cards/schemas';
import type { BackpackCard, CashCard, PayloadCard, ProductCard, WeaponCard } from './types';
import type { Rng } from '../cards/rng';

const parsedWeapons = (compiledWeapons as unknown[]).map((e) => CompiledWeaponSchema.parse(e));
const parsedDrugs = (compiledDrugs as unknown[]).map((e) => CompiledDrugSchema.parse(e));
const parsedSpecial = CardSpecialSchema.parse(compiledSpecial);

function toWeaponCard(card: CompiledWeapon): WeaponCard {
  return {
    type: 'weapon',
    id: card.id,
    name: card.name,
    category: card.category,
    bonus: card.bonus,
    offenseAbility: card.offenseAbility,
    offenseAbilityText: card.offenseAbilityText,
    defenseAbility: card.defenseAbility,
    defenseAbilityText: card.defenseAbilityText,
    unlocked: card.unlocked,
    ...(card.unlockCondition ? { unlockCondition: card.unlockCondition } : {}),
    locked: card.locked,
  };
}

function toDrugCard(card: CompiledDrug): ProductCard {
  return {
    type: 'product',
    id: card.id,
    name: card.name,
    category: card.category,
    potency: card.potency,
    offenseAbility: card.offenseAbility,
    offenseAbilityText: card.offenseAbilityText,
    defenseAbility: card.defenseAbility,
    defenseAbilityText: card.defenseAbilityText,
    unlocked: card.unlocked,
    ...(card.unlockCondition ? { unlockCondition: card.unlockCondition } : {}),
    locked: card.locked,
  };
}

/** Load all 50 authored weapon cards from compiled catalog. */
export function generateWeapons(_rng?: Rng): WeaponCard[] {
  return parsedWeapons.map(toWeaponCard);
}

/** Load all 50 authored drug cards from compiled catalog. */
export function generateDrugs(_rng?: Rng): ProductCard[] {
  return parsedDrugs.map(toDrugCard);
}

/**
 * Generate the runtime cash pool from authored denominations.
 * Defaults to 25 × $100 + 5 × $1000 = 30 cards.
 */
export function generateCash(): CashCard[] {
  const dens = parsedSpecial.cash.denominations;
  const hundred = dens.find((d) => d.value === 100) ?? { id: 'cash-100', value: 100 };
  const grand = dens.find((d) => d.value === 1000) ?? { id: 'cash-1000', value: 1000 };
  const cards: CashCard[] = [];
  for (let i = 0; i < 25; i++) {
    cards.push({
      type: 'cash',
      id: `cash-${String(i + 1).padStart(3, '0')}`,
      denomination: hundred.value as 100,
    });
  }
  for (let i = 0; i < 5; i++) {
    cards.push({
      type: 'cash',
      id: `cash-${String(26 + i).padStart(3, '0')}`,
      denomination: grand.value as 1000,
    });
  }
  return cards;
}

function clonePayload(card: PayloadCard, backpackId: string, slot: number): PayloadCard {
  return {
    ...card,
    id: `${backpackId}::slot-${slot + 1}::${card.id}`,
  };
}

const BACKPACK_ICONS = ['knife', 'vial', 'cash', 'mask', 'bolt', 'crosshair', 'crate', 'flame'] as const;
const BACKPACK_PREFIXES = ['Runner', 'Drop', 'Ghost', 'Street', 'Stash', 'Courier', 'Night', 'Hotshot'] as const;
const BACKPACK_SUFFIXES = ['Pack', 'Kit', 'Loadout', 'Bag', 'Rig', 'Bundle', 'Satchel', 'Cache'] as const;

/**
 * Legacy synthetic backpack generator preserved during the player-packed
 * backpack migration (Epic C). Once deckbuilder packing lands, callers
 * should build `BackpackCard`s directly from player-selected payload.
 *
 * The authored `special.backpack` record is the source of truth for
 * `slots` and `freeSwapOnEquip`; this helper simply fills kits from the
 * provided pools.
 */
export function generateBackpacks(
  rng: Rng,
  weapons: WeaponCard[],
  drugs: ProductCard[],
  cash: CashCard[],
  count = 30,
): BackpackCard[] {
  const unlockedWeapons = weapons.filter((card) => card.unlocked);
  const unlockedDrugs = drugs.filter((card) => card.unlocked);
  const allWeapons = unlockedWeapons.length > 0 ? unlockedWeapons : weapons;
  const allDrugs = unlockedDrugs.length > 0 ? unlockedDrugs : drugs;
  const allCash = cash;
  const backpacks: BackpackCard[] = [];

  for (let i = 0; i < count; i++) {
    const id = `pack-${String(i + 1).padStart(2, '0')}`;
    const size = (2 + (i % 3)) as 2 | 3 | 4;
    const pattern = i % 5;
    const payload: PayloadCard[] = [];

    if (pattern === 0) {
      payload.push(allCash[i % allCash.length], allWeapons[i % allWeapons.length]);
      if (size >= 3) payload.push(allCash[(i + 7) % allCash.length]);
      if (size >= 4) payload.push(allDrugs[i % allDrugs.length]);
    } else if (pattern === 1) {
      payload.push(allCash[i % allCash.length], allDrugs[i % allDrugs.length]);
      if (size >= 3) payload.push(allWeapons[(i + 5) % allWeapons.length]);
      if (size >= 4) payload.push(allCash[(i + 11) % allCash.length]);
    } else if (pattern === 2) {
      payload.push(allWeapons[i % allWeapons.length], allDrugs[i % allDrugs.length]);
      if (size >= 3) payload.push(allCash[(i + 13) % allCash.length]);
      if (size >= 4) payload.push(allWeapons[(i + 3) % allWeapons.length]);
    } else if (pattern === 3) {
      payload.push(allCash[i % allCash.length], allCash[(i + 3) % allCash.length]);
      if (size >= 3) payload.push(allDrugs[(i + 9) % allDrugs.length]);
      if (size >= 4) payload.push(allWeapons[(i + 9) % allWeapons.length]);
    } else {
      payload.push(allDrugs[i % allDrugs.length], allWeapons[(i + 1) % allWeapons.length]);
      if (size >= 3) payload.push(allDrugs[(i + 7) % allDrugs.length]);
      if (size >= 4) payload.push(allCash[(i + 17) % allCash.length]);
    }

    const unlocked = i < 8;
    backpacks.push({
      type: 'backpack',
      id,
      name: `${BACKPACK_PREFIXES[i % BACKPACK_PREFIXES.length]} ${BACKPACK_SUFFIXES[(i + 2) % BACKPACK_SUFFIXES.length]}`,
      icon: BACKPACK_ICONS[i % BACKPACK_ICONS.length],
      size,
      payload: payload.slice(0, size).map((card, slot) => clonePayload(card, id, slot)),
      unlocked,
      unlockCondition: unlocked ? undefined : `Win ${3 + (i % 5)} games with a runner in your deck`,
      locked: false,
    });
  }

  return rng.shuffle(backpacks);
}
