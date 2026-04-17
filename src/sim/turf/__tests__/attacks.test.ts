import { describe, expect, it } from 'vitest';
import type {
  ToughCard,
  WeaponCard,
  DrugCard,
  CurrencyCard,
  Turf,
} from '../types';
import { createTurf, addToStack } from '../board';
import {
  computeDamage,
  resolveDirectStrike,
  resolvePushedStrike,
  resolveFundedRecruit,
  strikeToAttackOutcome,
} from '../attacks';

function makeTough(overrides: Partial<ToughCard> = {}): ToughCard {
  // Default archetype is `brawler` (plain). The bruiser archetype triggers
  // ignoreResistance in applyTangibles; tests that want to measure raw
  // P/R resolution must not default to bruiser.
  const resistance = overrides.resistance ?? 6;
  const maxHp = overrides.maxHp ?? resistance;
  return {
    kind: 'tough',
    id: overrides.id ?? 'tough-1',
    name: overrides.name ?? 'Brick',
    tagline: 'Test tough',
    archetype: overrides.archetype ?? 'brawler',
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

function turfWith(
  ...cards: (ToughCard | WeaponCard | DrugCard | CurrencyCard)[]
): Turf {
  const turf = createTurf();
  for (const card of cards) addToStack(turf, card);
  return turf;
}

describe('computeDamage — v0.3 damage tiers', () => {
  it('busted when P < R', () => {
    expect(computeDamage(4, 8).outcome).toBe('busted');
    expect(computeDamage(4, 8).damage).toBe(0);
  });

  it('wound when R <= P < 1.5R', () => {
    const r = computeDamage(6, 5);
    expect(r.outcome).toBe('wound');
    expect(r.damage).toBe(2); // (6-5) + woundBonus=1
  });

  it('serious_wound when 1.5R <= P < 2R', () => {
    const r = computeDamage(8, 5); // ratio 1.6
    expect(r.outcome).toBe('serious_wound');
    expect(r.damage).toBe(5); // (8-5) + seriousBonus=2
  });

  it('crushing when 2R <= P < 3R', () => {
    const r = computeDamage(11, 5); // ratio 2.2
    expect(r.outcome).toBe('crushing');
    expect(r.damage).toBe(9); // (11-5) + crushingBonus=3
  });

  it('instant kill when P >= 3R', () => {
    const r = computeDamage(15, 5);
    expect(r.outcome).toBe('kill');
    expect(r.damage).toBe(9999);
  });

  it('clamps damage to at least minDamage on non-bust tiers', () => {
    // P == R, bonus=1; computeDamage: max(1, 0+1) = 1.
    expect(computeDamage(5, 5).damage).toBe(1);
  });
});

describe('resolveDirectStrike', () => {
  it('kills top tough when P >= 3R (instant kill tier)', () => {
    const attacker = turfWith(makeTough({ power: 18 }));
    const defender = turfWith(makeTough({ name: 'Victim', resistance: 6 }));

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.name).toBe('Victim');
    expect(defender.stack).toHaveLength(0);
  });

  it('serious wounds when P >= 1.5R but < 2R (HP chips, survives first hit)', () => {
    const attacker = turfWith(makeTough({ power: 9 }));
    const defender = turfWith(
      makeTough({ name: 'Target', resistance: 6, maxHp: 6, hp: 6 }),
    );
    // P=9 vs R=6. ratio 1.5 → serious_wound. dmg=9-6+2=5. hp 6→1.
    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('serious_wound');
    const target = defender.stack.find((e) => e.card.id === 'tough-1');
    expect((target?.card as ToughCard).hp).toBe(1);
  });

  it('wounds when R <= P < 1.5R (small HP chip)', () => {
    const attacker = turfWith(makeTough({ power: 7 }));
    const defender = turfWith(makeTough({ resistance: 6, maxHp: 6, hp: 6 }));
    // P=7 vs R=6 → wound. dmg=2. hp 6→4.
    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('wound');
  });

  it('busts when P < R', () => {
    const attacker = turfWith(makeTough({ power: 2 }));
    const defender = turfWith(makeTough({ resistance: 10 }));

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
  });

  it('transfers killed toughs modifiers to attacker turf on kill', () => {
    const attacker = turfWith(makeTough({ power: 30 }));
    const weapon = makeWeapon({ id: 'w-transfer' });
    const defender = turfWith(makeTough({ resistance: 5 }), weapon);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.transferredMods).toHaveLength(1);
    expect(result.transferredMods[0].id).toBe('w-transfer');
    expect(attacker.stack.some((c) => c.card.id === 'w-transfer')).toBe(true);
  });

  it('transfers modifiers from killed tough regardless of affiliation', () => {
    // Modifiers carry no affiliation, so they always transfer on direct strike.
    const attacker = turfWith(
      makeTough({ power: 30, affiliation: 'kings_row' }),
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
    expect(attacker.stack.some((c) => c.card.id === 'w-spoil')).toBe(true);
  });

  it('P includes weapon and drug power in stack', () => {
    const attacker = turfWith(
      makeTough({ power: 3 }),
      makeWeapon({ power: 4 }),
      makeDrug({ power: 3 }),
    );
    // Total P = 10. Defender R=3 → ratio 3.33 → kill.
    const defender = turfWith(makeTough({ resistance: 3 }));

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
  });

  it('R includes weapon and drug resistance in stack (busted)', () => {
    const attacker = turfWith(makeTough({ power: 8 }));
    const defender = turfWith(
      makeTough({ resistance: 3 }),
      makeWeapon({ resistance: 3 }),
      makeDrug({ resistance: 3 }),
    );
    // Total R = 9, P = 8 < R → busted.
    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
  });

  it('busts on empty defender stack', () => {
    const attacker = turfWith(makeTough({ power: 10 }));
    const defender = createTurf();

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
    expect(result.description.toLowerCase()).toContain('no tough');
  });
});

describe('resolveDirectStrike — strike-bottom and strike-anywhere', () => {
  it('shark targets the bottom tough (strike-bottom)', () => {
    const attacker = turfWith(makeTough({ archetype: 'shark', power: 30 }));
    const bottomTough = makeTough({
      id: 'bottom',
      name: 'Bottom',
      resistance: 3,
    });
    const topTough = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottomTough, topTough);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('bottom');
    expect(defender.stack.some((c) => c.card.id === 'top')).toBe(true);
  });

  it('ghost targets the lowest-resistance tough (strike-anywhere)', () => {
    // Ghost's strike-anywhere picks lowest resistance, not bottom of stack.
    const attacker = turfWith(makeTough({ archetype: 'ghost', power: 30 }));
    const bottomTough = makeTough({
      id: 'bottom',
      name: 'Bottom',
      resistance: 7,
    });
    const topTough = makeTough({ id: 'top', name: 'Top', resistance: 3 });
    const defender = turfWith(bottomTough, topTough);

    const result = resolveDirectStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('top');
  });
});

describe('resolvePushedStrike', () => {
  it('spends 1 currency and adds denomination/100 power', () => {
    const attacker = turfWith(makeTough({ power: 5 }), makeCurrency(1000));
    // P = 5 + 10 (from $1000/100) = 15 vs R=14 → wound. dmg=15-14+1=2. hp 14→12.
    const defender = turfWith(makeTough({ name: 'Target', resistance: 14 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('wound');
    expect(result.description.toLowerCase()).toContain('pushed');
    expect(attacker.stack.every((c) => c.card.kind !== 'currency')).toBe(true);
  });

  it('kills target tough when pushed P instant-kills against stack R', () => {
    // Stack [beneath(P=1,R=1), top(P=1,R=1)]. Total R=2. Attacker P=10+10=20
    // vs R=2 → 10x → instant kill. target picks top-most first (tough-1
    // for default makeTough id).
    const attacker = turfWith(makeTough({ power: 10 }), makeCurrency(1000));
    const bottomTough = makeTough({
      id: 'beneath',
      name: 'Beneath',
      power: 1,
      resistance: 1,
    });
    const topTough = makeTough({
      id: 'top',
      name: 'Top',
      power: 1,
      resistance: 1,
    });
    const defender = turfWith(bottomTough, topTough);

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.killedTough?.id).toBe('top');
  });

  it('busts when no currency on attacker turf', () => {
    const attacker = turfWith(makeTough({ power: 20 }));
    const defender = turfWith(makeTough({ resistance: 5 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
    expect(result.description).toContain('No currency');
  });

  it('$100 adds +1 power', () => {
    const attacker = turfWith(makeTough({ power: 9 }), makeCurrency(100));
    // P = 10 vs R=10 → wound tier. dmg = (10-10) + 1 = 1. hp 10→9.
    const defender = turfWith(makeTough({ resistance: 10, maxHp: 10, hp: 10 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('wound');
  });

  it('busts when pushed P < R', () => {
    const attacker = turfWith(makeTough({ power: 3 }), makeCurrency(100));
    // P = 3 + 1 = 4 < R = 8 → bust.
    const defender = turfWith(makeTough({ resistance: 8 }));

    const result = resolvePushedStrike(attacker, defender);

    expect(result.outcome).toBe('busted');
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
    expect(
      attacker.stack.some(
        (c) => c.card.kind === 'tough' && c.card.name === 'Merc',
      ),
    ).toBe(true);
    expect(
      defender.stack.every(
        (c) => c.card.kind !== 'tough' || c.card.name !== 'Merc',
      ),
    ).toBe(true);
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
      makeTough({
        name: 'Enemy',
        affiliation: 'iron_devils',
        resistance: 1000,
      }),
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
      makeTough({
        name: 'Stranger',
        affiliation: 'southside_saints',
        resistance: 8,
      }),
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

    expect(attacker.stack.every((c) => c.card.kind !== 'currency')).toBe(true);
  });

  it('discards recruited rival tough when no buffer on attacker turf', () => {
    // Attacker has a kings_row tough; recruited target is iron_devils (rival).
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
    expect(
      defender.stack.every(
        (c) => c.card.kind !== 'tough' || c.card.name !== 'Rival',
      ),
    ).toBe(true);
    expect(
      attacker.stack.every(
        (c) => c.card.kind !== 'tough' || c.card.name !== 'Rival',
      ),
    ).toBe(true);
  });

  it('accepts recruited rival tough when currency buffer remains on attacker turf', () => {
    const attacker = turfWith(
      makeTough({ affiliation: 'kings_row' }),
      makeCurrency(1000), // spent on recruit
      makeCurrency(1000), // remains as buffer
    );
    const defender = turfWith(
      makeTough({ name: 'Rival', affiliation: 'iron_devils', resistance: 500 }),
    );

    const result = resolveFundedRecruit(attacker, defender);

    expect(result.outcome).toBe('kill');
    expect(result.transferredMods).toHaveLength(1);
    expect(result.discardedMods).toHaveLength(0);
    expect(
      attacker.stack.some(
        (c) => c.card.kind === 'tough' && c.card.name === 'Rival',
      ),
    ).toBe(true);
  });
});

describe('strikeToAttackOutcome', () => {
  it('converts kill result to AttackOutcome', () => {
    const result = resolveDirectStrike(
      turfWith(makeTough({ power: 20 })),
      turfWith(makeTough({ name: 'Dead', resistance: 5 })),
    );
    const outcome = strikeToAttackOutcome(result);

    expect(outcome.type).toBe('kill');
    expect(outcome.gainedCards).toHaveLength(1);
    expect(outcome.description).toContain('killed');
  });

  it('converts wound result to AttackOutcome (mapped as sick for legacy UI)', () => {
    const result = resolveDirectStrike(
      turfWith(makeTough({ power: 7 })),
      turfWith(makeTough({ resistance: 6, maxHp: 6, hp: 6 })),
    );
    const outcome = strikeToAttackOutcome(result);
    // Legacy bridge maps wound/serious_wound/crushing → 'sick'.
    expect(outcome.type).toBe('sick');
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
