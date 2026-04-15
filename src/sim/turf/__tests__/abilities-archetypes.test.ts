import { describe, expect, it } from 'vitest';
import type { ToughCard, WeaponCard, Turf } from '../types';
import { createTurf, addToStack } from '../board';
import { resolveDirectStrike } from '../attacks';
import { resolveTargetToughIdx } from '../stack-ops';

function makeTough(overrides: Partial<ToughCard> = {}): ToughCard {
  return {
    kind: 'tough',
    id: overrides.id ?? 'tough-1',
    name: overrides.name ?? 'Tough',
    tagline: 'Test tough',
    archetype: overrides.archetype ?? 'bruiser',
    affiliation: overrides.affiliation ?? 'freelance',
    power: overrides.power ?? 6,
    resistance: overrides.resistance ?? 6,
    rarity: 'common',
    abilities: [],
    ...overrides,
  };
}

function makeWeapon(id: string, power = 3): WeaponCard {
  return {
    kind: 'weapon', id, name: id, category: 'bladed',
    power, resistance: 1, rarity: 'common', abilities: [],
  };
}

function turfWith(...cards: (ToughCard | WeaponCard)[]): Turf {
  const turf = createTurf();
  for (const c of cards) addToStack(turf, c);
  return turf;
}

describe('archetype abilities — strike targeting', () => {
  it('shark targets bottom tough (strike-bottom)', () => {
    const attacker = turfWith(makeTough({ archetype: 'shark', power: 20 }));
    const bottom = makeTough({ id: 'bottom', name: 'Bottom', resistance: 3 });
    const top = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottom, top);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('bottom');
    expect(defender.stack.some(c => c.id === 'top')).toBe(true);
  });

  it('ghost targets bottom tough (strike-anywhere)', () => {
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 20 }));
    const bottom = makeTough({ id: 'bottom', name: 'Bottom', resistance: 3 });
    const top = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottom, top);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('bottom');
  });

  it('bruiser targets top tough (default)', () => {
    const attacker = turfWith(makeTough({ archetype: 'bruiser', power: 20 }));
    const bottom = makeTough({ id: 'bottom', name: 'Bottom', resistance: 3 });
    const top = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottom, top);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('top');
  });

  it('brawler targets top tough (default)', () => {
    const attacker = turfWith(makeTough({ archetype: 'brawler', power: 20 }));
    const bottom = makeTough({ id: 'bottom', resistance: 3 });
    const top = makeTough({ id: 'top', resistance: 3 });
    const defender = turfWith(bottom, top);

    expect(resolveTargetToughIdx(defender, attacker)).toBe(1);
  });

  it('shark targeting with multiple toughs still gets bottom', () => {
    const attacker = turfWith(makeTough({ archetype: 'shark', power: 20 }));
    const t1 = makeTough({ id: 't1', resistance: 3 });
    const t2 = makeTough({ id: 't2', resistance: 3 });
    const t3 = makeTough({ id: 't3', resistance: 3 });
    const defender = turfWith(t1, t2, t3);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.killedTough?.id).toBe('t1');
  });

  it('ghost targeting with interleaved modifiers still gets bottom tough', () => {
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 20 }));
    const w = makeWeapon('w1');
    const bottom = makeTough({ id: 'bottom', resistance: 3 });
    const top = makeTough({ id: 'top', resistance: 3 });
    const defender = turfWith(bottom, w, top);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.killedTough?.id).toBe('bottom');
  });
});

describe('archetype abilities — combat outcomes', () => {
  it('direct strike kills when power >= resistance', () => {
    const attacker = turfWith(
      makeTough({ archetype: 'bruiser', power: 8 }),
      makeWeapon('blade', 2),
    );
    const defender = turfWith(makeTough({ resistance: 10 }));

    const result = resolveDirectStrike(attacker, defender);
    expect(result.outcome).toBe('kill');
  });

  it('direct strike sicks when power < resistance but >= R/2', () => {
    const attacker = turfWith(makeTough({ power: 5 }));
    const defender = turfWith(makeTough({ resistance: 10 }));

    const result = resolveDirectStrike(attacker, defender);
    expect(result.outcome).toBe('sick');
    expect(defender.sickTopIdx).toBe(0);
  });
});
