import { describe, it, expect } from 'vitest';
import { generateWeapons, generateDrugs, generateCurrency } from '../generators';
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

  it('weapons have abilities from their category', () => {
    const rng = createRng(42);
    const weapons = generateWeapons(rng);
    const bladed = weapons.find(w => w.category === 'bladed')!;
    expect(bladed.abilities).toContain('LACERATE');
    expect(bladed.abilities).toContain('PARRY');
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

  it('drugs have abilities from their category', () => {
    const rng = createRng(42);
    const drugs = generateDrugs(rng);
    const stim = drugs.find(d => d.category === 'stimulant')!;
    expect(stim.abilities).toContain('RUSH');
    expect(stim.abilities).toContain('REFLEXES');
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
    const hundreds = cash.filter(c => c.denomination === 100);
    const thousands = cash.filter(c => c.denomination === 1000);
    expect(hundreds).toHaveLength(25);
    expect(thousands).toHaveLength(5);
  });

  it('all currency cards have unique ids', () => {
    const cash = generateCurrency();
    const ids = cash.map(c => c.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('all currency cards have kind=currency', () => {
    const cash = generateCurrency();
    expect(cash.every(c => c.kind === 'currency')).toBe(true);
  });
});
