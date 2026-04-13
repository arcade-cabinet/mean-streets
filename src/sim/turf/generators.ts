/**
 * Generators for product, cash, and weapon card pools.
 * Crew cards use the existing character generator.
 */

import productsPool from '../../data/pools/products.json';
import weaponsPool from '../../data/pools/weapons.json';
import type { ProductCard, CashCard, WeaponCard } from './types';
import type { Rng } from '../cards/rng';

/** Generate 25 product cards from adjective+noun permutations. */
export function generateProducts(rng: Rng): ProductCard[] {
  const { adjectives, nouns, effects } = productsPool;
  const cards: ProductCard[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < 25; i++) {
    let name: string;
    let attempts = 0;
    do {
      name = `${rng.pick(adjectives)} ${rng.pick(nouns)}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 50);
    usedNames.add(name);

    const effect = effects[i % effects.length];
    const potency = Math.min(5, Math.floor(i / 5) + 1);

    cards.push({
      type: 'product',
      id: `prod-${String(i + 1).padStart(2, '0')}`,
      name,
      effect: effect.id,
      effectDesc: effect.desc,
      potency,
    });
  }
  return cards;
}

/**
 * Generate cash card pool.
 * Each denomination has a starting count of unlocked copies.
 */
export function generateCash(): {
  cards: CashCard[];
  denominations: Array<{ value: number; unlocked: number; max: number }>;
} {
  const denoms = [
    { value: 1,    unlocked: 8,  max: 10 },
    { value: 5,    unlocked: 6,  max: 10 },
    { value: 10,   unlocked: 4,  max: 10 },
    { value: 20,   unlocked: 2,  max: 10 },
    { value: 100,  unlocked: 1,  max: 10 },
    { value: 500,  unlocked: 0,  max: 10 },
    { value: 1000, unlocked: 0,  max: 10 },
  ];

  const cards: CashCard[] = [];
  let idx = 0;
  for (const d of denoms) {
    for (let i = 0; i < d.unlocked; i++) {
      cards.push({
        type: 'cash',
        id: `cash-${String(++idx).padStart(3, '0')}`,
        denomination: d.value,
      });
    }
  }
  return { cards, denominations: denoms };
}

/** Generate weapon card pool from weapon definitions. */
export function generateWeapons(): WeaponCard[] {
  return weaponsPool.weapons.map(w => ({
    type: 'weapon' as const,
    id: w.id,
    name: w.name,
    effect: w.effect,
    effectDesc: w.desc,
    bonus: w.bonus,
  }));
}

/** Print summary of generated card pools. */
export function printPoolSummary(
  products: ProductCard[],
  cash: CashCard[],
  weapons: WeaponCard[],
): void {
  console.log(`\nProducts: ${products.length}`);
  const byEffect: Record<string, number> = {};
  for (const p of products) {
    byEffect[p.effect] = (byEffect[p.effect] ?? 0) + 1;
  }
  console.log('  By effect:', Object.entries(byEffect).map(([k, v]) => `${k}:${v}`).join(' '));
  console.log('  Sample:', products.slice(0, 5).map(p => `${p.name} (${p.effect} P${p.potency})`).join(', '));

  console.log(`\nCash: ${cash.length} cards`);
  const byDenom: Record<number, number> = {};
  for (const c of cash) {
    byDenom[c.denomination] = (byDenom[c.denomination] ?? 0) + 1;
  }
  console.log('  By denom:', Object.entries(byDenom).map(([k, v]) => `$${k}:${v}`).join(' '));

  console.log(`\nWeapons: ${weapons.length}`);
  console.log('  Sample:', weapons.slice(0, 5).map(w => `${w.name} (+${w.bonus})`).join(', '));
}
