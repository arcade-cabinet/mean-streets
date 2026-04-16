import { describe, expect, it } from 'vitest';
import type { ToughCard, WeaponCard, DrugCard, CurrencyCard, Turf } from '../types';
import { createTurf, addToStack } from '../board';
import {
  resolveDirectStrike,
  resolvePushedStrike,
  resolveFundedRecruit,
  strikeToAttackOutcome,
} from '../attacks';

function makeTough(overrides: Partial<ToughCard> = {}): ToughCard {
  return {
    kind: 'tough',
    id: overrides.id ?? 'tough-1',
    name: overrides.name ?? 'Brick',
    tagline: 'Test tough',
    archetype: overrides.archetype ?? 'bruiser',
    affiliation: overrides.affiliation ?? 'kings_row',
    power: overrides.power ?? 6,
    resistance: overrides.resistance ?? 6,
    rarity: 'common',
    abilities: [],
    ...overrides,
  };
}

function makeWeapon(overrides: Partial<WeaponCard> = {}): WeaponCard {
  return {
    kind: 'weapon',
    id: overrides.id ?? 'weapon-1',
    name: overrides.name ?? 'Knife',
    category: overrides.category ?? 'bladed',
    power: overrides.power ?? 3,
    resistance: overrides.resistance ?? 1,
    rarity: 'common',
    abilities: [],
    ...overrides,
  };
}

function makeDrug(overrides: Partial<DrugCard> = {}): DrugCard {
  return {
    kind: 'drug',
    id: overrides.id ?? 'drug-1',
    name: overrides.name ?? 'Stim',
    category: overrides.category ?? 'stimulant',
    power: overrides.power ?? 2,
    resistance: overrides.resistance ?? 1,
    rarity: 'common',
    abilities: [],
    ...overrides,
  };
}

function makeCurrency(denomination: 100 | 1000): CurrencyCard {
  return {
    kind: 'currency',
    id: `currency-${denomination}-${Math.random()}`,
    name: `$${denomination}`,
    denomination,
    rarity: 'common',
  };
}

function turfWith(...cards: (ToughCard | WeaponCard | DrugCard | CurrencyCard)[]): Turf {
  const turf = createTurf();
  for (const card of cards) addToStack(turf, card);
  return turf;
}

describe('resolveDirectStrike', () => {
  it('kills top tough when P >= R', () => {
    const attacker = turfWith(makeTough({ power: 8 }));
    const defender = turfWith(makeTough({ name: 'Victim', resistance: 6 }));

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.name).toBe('Victim');
    expect(defender.stack).toHaveLength(0);
  });

  it('sicks top tough when P >= R/2 but P < R', () => {
    const attacker = turfWith(makeTough({ power: 4 }));
    const defender = turfWith(makeTough({ name: 'Target', resistance: 8 }));

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('sick');
    expect(result.sickedIdx).toBe(0);
    expect(defender.sickTopIdx).toBe(0);
  });

  it('busts when P < R/2', () => {
    const attacker = turfWith(makeTough({ power: 2 }));
    const defender = turfWith(makeTough({ resistance: 10 }));

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
  });

  it('transfers killed toughs modifiers to attacker turf', () => {
    const attacker = turfWith(makeTough({ power: 10 }));
    const weapon = makeWeapon({ id: 'w-transfer' });
    const defender = turfWith(makeTough({ resistance: 5 }), weapon);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.transferredMods).toHaveLength(1);
    expect(result.transferredMods[0].id).toBe('w-transfer');
    expect(attacker.stack.some((c) => c.id === 'w-transfer')).toBe(true);
  });

  it('transfers modifiers from killed tough regardless of affiliation (mods have no affiliation)', () => {
    // Modifiers carry no affiliation, so they always transfer on direct strike.
    // Affiliation conflicts only gate incoming toughs (see funded-recruit test).
    const attacker = turfWith(
      makeTough({ power: 10, affiliation: 'kings_row' }),
    );
    const rivalTough = makeTough({
      id: 'rival-tough',
      affiliation: 'iron_devils',
      resistance: 5,
    });
    const weapon = makeWeapon({ id: 'w-spoil' });
    const defender = turfWith(rivalTough, weapon);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.transferredMods).toHaveLength(1);
    expect(result.transferredMods[0].id).toBe('w-spoil');
    expect(result.discardedMods).toHaveLength(0);
    expect(attacker.stack.some((c) => c.id === 'w-spoil')).toBe(true);
  });

  it('P includes weapon and drug power in stack', () => {
    const attacker = turfWith(
      makeTough({ power: 3 }),
      makeWeapon({ power: 4 }),
      makeDrug({ power: 3 }),
    );
    // Total P = 3 + 4 + 3 = 10
    const defender = turfWith(makeTough({ resistance: 10 }));

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
  });

  it('R includes weapon and drug resistance in stack', () => {
    const attacker = turfWith(makeTough({ power: 8 }));
    const defender = turfWith(
      makeTough({ resistance: 3 }),
      makeWeapon({ resistance: 3 }),
      makeDrug({ resistance: 3 }),
    );
    // Total R = 3 + 3 + 3 = 9, P = 8 < R → sick
    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('sick');
  });

  it('busts on empty defender stack', () => {
    const attacker = turfWith(makeTough({ power: 10 }));
    const defender = createTurf();

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
    expect(result.description).toContain('No tough');
  });
});

describe('resolveDirectStrike — strike-bottom and strike-anywhere', () => {
  it('shark targets the bottom tough (strike-bottom)', () => {
    const attacker = turfWith(makeTough({ archetype: 'shark', power: 20 }));
    const bottomTough = makeTough({ id: 'bottom', name: 'Bottom', resistance: 3 });
    const topTough = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottomTough, topTough);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('bottom');
    expect(defender.stack.some((c) => c.id === 'top')).toBe(true);
  });

  it('ghost targets the bottom tough (strike-anywhere)', () => {
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 20 }));
    const bottomTough = makeTough({ id: 'bottom', name: 'Bottom', resistance: 3 });
    const topTough = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottomTough, topTough);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('bottom');
  });
});

describe('resolvePushedStrike', () => {
  it('spends 1 currency and adds denomination/100 power', () => {
    const attacker = turfWith(
      makeTough({ power: 5 }),
      makeCurrency(1000),
    );
    // P = 5 + 10 (from $1000/100) = 15
    const defender = turfWith(makeTough({ name: 'Target', resistance: 14 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.description).toContain('$1000');
    expect(attacker.stack.every((c) => c.kind !== 'currency')).toBe(true);
  });

  it('sicks tough directly beneath the killed tough', () => {
    const attacker = turfWith(
      makeTough({ power: 10 }),
      makeCurrency(100),
    );
    const bottomTough = makeTough({ id: 'beneath', name: 'Beneath' });
    const topTough = makeTough({ id: 'top', name: 'Top', resistance: 5 });
    const defender = turfWith(bottomTough, topTough);

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('top');
    expect(result.sickedIdx).toBe(0);
    expect(defender.sickTopIdx).toBe(0);
  });

  it('busts when no currency on attacker turf', () => {
    const attacker = turfWith(makeTough({ power: 20 }));
    const defender = turfWith(makeTough({ resistance: 5 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
    expect(result.description).toContain('No currency');
  });

  it('$100 adds +1 power', () => {
    const attacker = turfWith(
      makeTough({ power: 9 }),
      makeCurrency(100),
    );
    // P = 9 + 1 = 10
    const defender = turfWith(makeTough({ resistance: 10 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
  });

  it('sicks when pushed P >= R/2 but < R', () => {
    const attacker = turfWith(
      makeTough({ power: 3 }),
      makeCurrency(100),
    );
    // P = 3 + 1 = 4; R = 8; R/2 = 4; P >= R/2 → sick
    const defender = turfWith(makeTough({ resistance: 8 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('sick');
  });
});

describe('resolveFundedRecruit', () => {
  it('freelance target uses 0.5 multiplier', () => {
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000),
    );
    // Target resistance = 10, threshold = 10 * 0.5 = 5, spent = 1000 >= 5 → success
    const defender = turfWith(
      makeTough({ name: 'Merc', affiliation: 'freelance', resistance: 10 }),
    );

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.description).toContain('Recruited');
    expect(result.description).toContain('freelance');
    expect(attacker.stack.some((c) => c.kind === 'tough' && c.name === 'Merc')).toBe(true);
    expect(defender.stack.every((c) => c.kind !== 'tough' || c.name !== 'Merc')).toBe(true);
  });

  it('same affiliation uses 0.7 multiplier', () => {
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000),
    );
    // Target resistance = 10, threshold = 10 * 0.7 = 7, spent = 1000 >= 7
    const defender = turfWith(
      makeTough({ name: 'Ally', affiliation: 'kings_row', resistance: 10 }),
    );

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.description).toContain('same');
  });

  it('rival affiliation uses 1.5 multiplier', () => {
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000),
    );
    // Target resistance = 1000, threshold = 1000 * 1.5 = 1500, spent = 1000 < 1500 → fail
    const defender = turfWith(
      makeTough({ name: 'Enemy', affiliation: 'iron_devils', resistance: 1000 }),
    );

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('busted');
    expect(result.description).toContain('rival');
  });

  it('other affiliation uses 1.0 multiplier', () => {
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000),
    );
    // Target resistance = 8, threshold = 8 * 1.0 = 8, spent = 1000 >= 8
    const defender = turfWith(
      makeTough({ name: 'Stranger', affiliation: 'southside_saints', resistance: 8 }),
    );

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.description).toContain('other');
  });

  it('fails when total currency < $1000', () => {
    const attacker = turfWith(
      makeTough(),
      makeCurrency(100),
      makeCurrency(100),
    );
    const defender = turfWith(makeTough({ resistance: 1 }));

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('busted');
    expect(result.description).toContain('Not enough');
  });

  it('sums multiple currency cards to meet threshold', () => {
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
      makeCurrency(100),
    );
    // 10 × $100 = $1000
    const defender = turfWith(
      makeTough({ name: 'Target', affiliation: 'freelance', resistance: 4 }),
    );
    // threshold = 4 * 0.5 = 2, spent = 1000 >= 2

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('kill');
  });

  it('spends currency from attacker turf', () => {
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000),
    );
    const defender = turfWith(
      makeTough({ affiliation: 'freelance', resistance: 1 }),
    );

    resolveFundedRecruit(attacker, defender);

    expect(attacker.stack.every((c) => c.kind !== 'currency')).toBe(true);
  });

  it('discards recruited rival tough when no buffer on attacker turf', () => {
    // Attacker has a kings_row tough; recruited target is iron_devils (rival).
    // No currency buffer remains (all spent on recruit), no neutral buffer.
    // Rule per RULES.md §4: rival affiliations cannot coexist without buffer.
    // Expected: kill succeeds (target removed from defender), but the recruited
    // tough is discarded instead of joining the attacker stack.
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000),
    );
    const defender = turfWith(
      makeTough({ name: 'Rival', affiliation: 'iron_devils', resistance: 500 }),
    );
    // threshold = 500 * 1.5 (rival) = 750, spent = 1000 >= 750 → success

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.transferredMods).toHaveLength(0);
    expect(result.discardedMods).toHaveLength(1);
    expect((result.discardedMods[0] as ToughCard).name).toBe('Rival');
    // Defender is cleared of the target
    expect(defender.stack.every((c) => c.kind !== 'tough' || c.name !== 'Rival')).toBe(true);
    // Attacker did NOT gain the rival tough
    expect(attacker.stack.every((c) => c.kind !== 'tough' || c.name !== 'Rival')).toBe(true);
  });

  it('accepts recruited rival tough when currency buffer remains on attacker turf', () => {
    // Attacker has kings_row + extra currency beyond the recruit cost, providing
    // a buffer for the incoming iron_devils tough per the affiliation rule.
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000), // spent on recruit
      makeCurrency(1000), // remains as buffer
    );
    const defender = turfWith(
      makeTough({ name: 'Rival', affiliation: 'iron_devils', resistance: 500 }),
    );
    // threshold = 500 * 1.5 = 750, spent = 1000 >= 750 → success; buffer present

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.transferredMods).toHaveLength(1);
    expect(result.discardedMods).toHaveLength(0);
    expect(attacker.stack.some((c) => c.kind === 'tough' && c.name === 'Rival')).toBe(true);
  });
});

describe('strikeToAttackOutcome', () => {
  it('converts kill result to AttackOutcome', () => {
    const result = resolveDirectStrike(
      turfWith(makeTough({ power: 10 })),
      turfWith(makeTough({ name: 'Dead', resistance: 5 })),
    );
    const outcome = strikeToAttackOutcome(result);

    expect(outcome.type).toBe('kill');
    expect(outcome.gainedCards).toHaveLength(1);
    expect(outcome.description).toContain('killed');
  });

  it('converts sick result to AttackOutcome', () => {
    const result = resolveDirectStrike(
      turfWith(makeTough({ power: 4 })),
      turfWith(makeTough({ resistance: 8 })),
    );
    const outcome = strikeToAttackOutcome(result);

    expect(outcome.type).toBe('sick');
    expect(outcome.targetIndices).toHaveLength(1);
  });

  it('converts busted result to AttackOutcome', () => {
    const result = resolveDirectStrike(
      turfWith(makeTough({ power: 1 })),
      turfWith(makeTough({ resistance: 10 })),
    );
    const outcome = strikeToAttackOutcome(result);

    expect(outcome.type).toBe('busted');
    expect(outcome.targetIndices).toHaveLength(0);
  });
});
