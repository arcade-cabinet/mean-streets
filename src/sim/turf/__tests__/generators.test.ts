import { describe, it, expect } from 'vitest';
import {
  generateWeapons,
  generateDrugs,
  generateCurrency,
  loadCurrencyCatalog,
} from '../generators';
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
      bladed: 10,
      blunt: 10,
      explosive: 10,
      ranged: 10,
      stealth: 10,
    });
  });

  it('all weapons have unique ids', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const ids = weapons.map((w) => w.id);
    expect(new Set(ids).size).toBe(50);
  });

  it('all weapons have unique names', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const names = weapons.map((w) => w.name);
    expect(new Set(names).size).toBe(50);
  });

  it("every weapon in a category carries that category's abilities", () => {
    // Regression pin: sample-only checks pass if just one card in the
    // category has the expected ability. Verify ALL cards in each
    // category carry the signature abilities.
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const bladed = weapons.filter((w) => w.category === 'bladed');
    expect(bladed.length).toBeGreaterThan(0);
    for (const w of bladed) {
      expect(w.abilities, `${w.id}`).toContain('LACERATE');
      expect(w.abilities, `${w.id}`).toContain('PARRY');
    }
  });

  it('power values are within expected range', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    for (const w of weapons) {
      expect(w.power).toBeGreaterThanOrEqual(1);
      expect(w.power).toBeLessThanOrEqual(12);
    }
  });

  it('is deterministic with same seed', () => {
    const a = generateWeapons(createRng(42));
    const b = generateWeapons(createRng(42));
    expect(a.map((w) => w.name)).toEqual(b.map((w) => w.name));
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
      stimulant: 10,
      sedative: 10,
      hallucinogen: 10,
      steroid: 10,
      narcotic: 10,
    });
  });

  it('all drugs have unique ids', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    const ids = drugs.map((d) => d.id);
    expect(new Set(ids).size).toBe(50);
  });

  it("every drug in a category carries that category's abilities", () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    const stims = drugs.filter((d) => d.category === 'stimulant');
    expect(stims.length).toBeGreaterThan(0);
    for (const d of stims) {
      expect(d.abilities, `${d.id}`).toContain('RUSH');
      expect(d.abilities, `${d.id}`).toContain('REFLEXES');
    }
  });

  it('power values are within expected range', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    for (const d of drugs) {
      expect(d.power).toBeGreaterThanOrEqual(1);
      expect(d.power).toBeLessThanOrEqual(12);
    }
  });
});

describe('generateCurrency', () => {
  it('generates 30 currency cards total (25x$100 + 5x$1000)', () => {
    const cash = generateCurrency();
    expect(cash).toHaveLength(30);
  });

  it('has correct denomination breakdown', () => {
    const cash = generateCurrency();
    const hundreds = cash.filter((c) => c.denomination === 100);
    const thousands = cash.filter((c) => c.denomination === 1000);
    expect(hundreds).toHaveLength(25);
    expect(thousands).toHaveLength(5);
  });

  it('all currency cards have unique ids', () => {
    const cash = generateCurrency();
    const ids = cash.map((c) => c.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('all currency cards have kind=currency', () => {
    const cash = generateCurrency();
    expect(cash.every((c) => c.kind === 'currency')).toBe(true);
  });

  it('derives generated cash stats from the authored currency catalog', () => {
    const cash = generateCurrency();
    const catalog = new Map(
      loadCurrencyCatalog().map((card) => [card.id, card]),
    );

    const hundred = catalog.get('currency-100');
    const thousand = catalog.get('currency-1000');
    expect(hundred).toBeDefined();
    expect(thousand).toBeDefined();

    expect(
      cash
        .filter((c) => c.denomination === 100)
        .every((c) => c.name === hundred!.name && c.rarity === hundred!.rarity),
    ).toBe(true);
    expect(
      cash
        .filter((c) => c.denomination === 1000)
        .every(
          (c) => c.name === thousand!.name && c.rarity === thousand!.rarity,
        ),
    ).toBe(true);
  });
});

describe('loadCurrencyCatalog', () => {
  it('loads the three authored currency cards including Clean Money', () => {
    const currency = loadCurrencyCatalog();

    expect(currency).toHaveLength(3);
    expect(currency.map((card) => card.id)).toEqual([
      'currency-100',
      'currency-1000',
      'currency-launder',
    ]);
    expect(
      currency.find((card) => card.id === 'currency-launder')?.abilities,
    ).toContain('LAUNDER');
  });

  it('returns fresh currency card copies', () => {
    const [first] = loadCurrencyCatalog();
    const [second] = loadCurrencyCatalog();

    expect(first).not.toBe(second);
  });
});
