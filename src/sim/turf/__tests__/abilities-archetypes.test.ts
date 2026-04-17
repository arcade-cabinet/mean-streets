import { describe, expect, it } from 'vitest';
import type { ToughCard, WeaponCard, Turf } from '../types';
import { createTurf, addToStack } from '../board';
import { resolveDirectStrike } from '../attacks';
import { resolveTargetToughIdx } from '../stack-ops';

function makeTough(overrides: Partial<ToughCard> = {}): ToughCard {
  const resistance = overrides.resistance ?? 6;
  const maxHp = overrides.maxHp ?? resistance;
  return {
    kind: 'tough',
    id: overrides.id ?? 'tough-1',
    name: overrides.name ?? 'Tough',
    tagline: 'Test tough',
    archetype: overrides.archetype ?? 'bruiser',
    affiliation: overrides.affiliation ?? 'freelance',
    power: overrides.power ?? 6,
    resistance,
    rarity: 'common',
    abilities: [],
    maxHp,
    hp: overrides.hp ?? maxHp,
    ...overrides,
  };
}

function makeWeapon(id: string, power = 3): WeaponCard {
  return {
    kind: 'weapon',
    id,
    name: id,
    category: 'bladed',
    power,
    resistance: 1,
    rarity: 'common',
    abilities: [],
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
    expect(defender.stack.some((c) => c.card.id === 'top')).toBe(true);
  });

  it('ghost targets the lowest-resistance tough (strike-anywhere)', () => {
    // Updated behavior: ghost's strike-anywhere ("choose which tough to
    // target" per RULES.md §7) picks the easiest kill by resistance, not
    // the bottom of the stack. Prior impl was a copy of strike-bottom,
    // making Ghost indistinguishable from Shark.
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 20 }));
    const bottom = makeTough({ id: 'bottom', name: 'Bottom', resistance: 8 });
    const top = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottom, top);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('top');
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

  it('ghost targeting with interleaved modifiers picks lowest-resistance tough', () => {
    // Updated behavior. Mods between toughs are ignored when scoring
    // target choice — ghost picks the lowest-resistance tough.
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 20 }));
    const w = makeWeapon('w1');
    const bottom = makeTough({ id: 'bottom', resistance: 7 });
    const top = makeTough({ id: 'top', resistance: 3 });
    const defender = turfWith(bottom, w, top);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.killedTough?.id).toBe('top');
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

  it('direct strike busts when power < resistance (v0.3 no partial sick)', () => {
    // v0.3 replaces "sick when P >= R/2" with straight bust when P < R.
    // Ghost has no ignore-resistance, so raw P=5 vs R=10 → busted.
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 5 }));
    const defender = turfWith(makeTough({ resistance: 10 }));

    const result = resolveDirectStrike(attacker, defender);
    expect(result.outcome).toBe('busted');
  });

  it('direct strike wounds when R <= P < 1.5R (HP reduced, tough survives)', () => {
    // v0.3 wound tier. P=7 vs R=6 → wound, dmg=2, hp 6→4. Ghost archetype
    // to skip bruiser's ignoreResistance.
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 7 }));
    const defender = turfWith(makeTough({ resistance: 6, maxHp: 6, hp: 6 }));

    const result = resolveDirectStrike(attacker, defender);
    expect(result.outcome).toBe('wound');
    // Tough still in stack with reduced HP.
    const surviving = defender.stack.find((e) => e.card.kind === 'tough');
    expect(surviving).toBeDefined();
    expect((surviving!.card as ToughCard).hp).toBe(4);
  });
});
