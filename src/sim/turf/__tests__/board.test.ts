import { describe, expect, it, beforeEach } from 'vitest';
import type {
  ToughCard,
  WeaponCard,
  DrugCard,
  CurrencyCard,
  PlayerState,
  Turf,
} from '../types';
import {
  createTurf,
  resetTurfIdCounter,
  addToStack,
  removeFromStack,
  positionPower,
  positionResistance,
  turfAffiliationConflict,
  turfToughs,
  turfModifiers,
  turfCurrency,
  hasToughOnTurf,
  seizeTurf,
} from '../board';

function tough(
  id: string,
  power = 5,
  resistance = 5,
  affiliation = 'freelance',
): ToughCard {
  return {
    kind: 'tough',
    id,
    name: id,
    tagline: '',
    archetype: 'bruiser',
    affiliation,
    power,
    resistance,
    rarity: 'common',
    abilities: [],
    maxHp: resistance,
    hp: resistance,
  };
}

function weapon(id: string, power = 3, resistance = 1): WeaponCard {
  return {
    kind: 'weapon',
    id,
    name: id,
    category: 'bladed',
    power,
    resistance,
    rarity: 'common',
    abilities: [],
  };
}

function drug(id: string, power = 2, resistance = 1): DrugCard {
  return {
    kind: 'drug',
    id,
    name: id,
    category: 'stimulant',
    power,
    resistance,
    rarity: 'common',
    abilities: [],
  };
}

function currency(id: string, denomination: 100 | 1000 = 100): CurrencyCard {
  return {
    kind: 'currency',
    id,
    name: `$${denomination}`,
    denomination,
    rarity: 'common',
  };
}

function makePlayer(turfs: Turf[]): PlayerState {
  return {
    turfs,
    deck: [],
    toughsInPlay: 0,
    actionsRemaining: 3,
    pending: null,
    queued: [],
    turnEnded: false,
  };
}

describe('createTurf', () => {
  beforeEach(() => resetTurfIdCounter());

  it('creates turfs with incrementing ids', () => {
    const a = createTurf();
    const b = createTurf();
    expect(a.id).toBe('turf-1');
    expect(b.id).toBe('turf-2');
    expect(a.stack).toEqual([]);
  });

  it('resetTurfIdCounter restarts the counter', () => {
    createTurf();
    resetTurfIdCounter();
    const t = createTurf();
    expect(t.id).toBe('turf-1');
  });
});

describe('addToStack / removeFromStack', () => {
  it('adds cards to the end of the stack', () => {
    const turf = createTurf();
    const t = tough('t1');
    const w = weapon('w1');
    addToStack(turf, t);
    addToStack(turf, w);
    expect(turf.stack).toHaveLength(2);
    expect(turf.stack[0].card.id).toBe('t1');
    expect(turf.stack[1].card.id).toBe('w1');
  });

  it('removes a card by index and returns it', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1'));
    addToStack(turf, weapon('w1'));
    const removed = removeFromStack(turf, 0);
    expect(removed?.id).toBe('t1');
    expect(turf.stack).toHaveLength(1);
  });

  it('returns null for out-of-bounds index', () => {
    const turf = createTurf();
    expect(removeFromStack(turf, 0)).toBeNull();
    expect(removeFromStack(turf, -1)).toBeNull();
  });

  it('adjusts sickTopIdx when card below sick index is removed', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1'));
    addToStack(turf, weapon('w1'));
    addToStack(turf, tough('t2'));
    turf.sickTopIdx = 2;
    removeFromStack(turf, 0);
    expect(turf.sickTopIdx).toBe(1);
  });

  it('clears sickTopIdx when the sick card itself is removed', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1'));
    turf.sickTopIdx = 0;
    removeFromStack(turf, 0);
    expect(turf.sickTopIdx).toBeNull();
  });
});

describe('positionPower', () => {
  it('sums power of all non-currency cards', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5));
    addToStack(turf, weapon('w1', 3));
    addToStack(turf, drug('d1', 2));
    expect(positionPower(turf)).toBe(10);
  });

  it('excludes currency from power', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5));
    addToStack(turf, currency('c1', 1000));
    expect(positionPower(turf)).toBe(5);
  });

  it('excludes sicked tough from power', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5));
    turf.sickTopIdx = 0;
    expect(positionPower(turf)).toBe(0);
  });

  it('returns 0 for empty turf', () => {
    expect(positionPower(createTurf())).toBe(0);
  });

  it('treats legacy tough fixtures without hp fields as full power', () => {
    const turf = createTurf();
    const legacy = { ...tough('t1', 7), hp: undefined, maxHp: undefined } as unknown as ToughCard;
    addToStack(turf, legacy);
    expect(positionPower(turf)).toBe(7);
  });
});

describe('positionResistance', () => {
  it('sums resistance of all non-currency cards', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 6));
    addToStack(turf, weapon('w1', 3, 2));
    addToStack(turf, drug('d1', 2, 1));
    expect(positionResistance(turf)).toBe(9);
  });

  it('excludes currency from resistance', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 6));
    addToStack(turf, currency('c1'));
    expect(positionResistance(turf)).toBe(6);
  });

  it('includes sicked tough in resistance', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 6));
    turf.sickTopIdx = 0;
    expect(positionResistance(turf)).toBe(6);
  });

  it('treats legacy tough fixtures without hp fields as full resistance', () => {
    const turf = createTurf();
    const legacy = { ...tough('t1', 5, 6), hp: undefined, maxHp: undefined } as unknown as ToughCard;
    addToStack(turf, legacy);
    expect(positionResistance(turf)).toBe(6);
  });
});

describe('turfToughs / turfModifiers / turfCurrency', () => {
  it('filters cards by kind', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1'));
    addToStack(turf, weapon('w1'));
    addToStack(turf, drug('d1'));
    addToStack(turf, currency('c1'));
    addToStack(turf, tough('t2'));

    expect(turfToughs(turf)).toHaveLength(2);
    expect(turfModifiers(turf)).toHaveLength(3);
    expect(turfCurrency(turf)).toHaveLength(1);
  });
});

describe('hasToughOnTurf', () => {
  it('returns true when stack contains a tough', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1'));
    expect(hasToughOnTurf(turf)).toBe(true);
  });

  it('returns false for empty turf', () => {
    expect(hasToughOnTurf(createTurf())).toBe(false);
  });

  it('returns false when only modifiers present', () => {
    const turf = createTurf();
    addToStack(turf, weapon('w1'));
    addToStack(turf, currency('c1'));
    expect(hasToughOnTurf(turf)).toBe(false);
  });
});

describe('turfAffiliationConflict', () => {
  it('returns false for non-tough incoming cards', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 5, 'kings_row'));
    expect(turfAffiliationConflict(turf, weapon('w1'))).toBe(false);
  });

  it('returns false when no rivals on turf', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 5, 'kings_row'));
    const incoming = tough('t2', 4, 4, 'jade_dragon');
    expect(turfAffiliationConflict(turf, incoming)).toBe(false);
  });

  it('returns true when rival exists and no buffer', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 5, 'kings_row'));
    const incoming = tough('t2', 4, 4, 'iron_devils');
    expect(turfAffiliationConflict(turf, incoming)).toBe(true);
  });

  it('currency on turf acts as buffer', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 5, 'kings_row'));
    addToStack(turf, currency('c1'));
    const incoming = tough('t2', 4, 4, 'iron_devils');
    expect(turfAffiliationConflict(turf, incoming)).toBe(false);
  });

  it('freelance toughs never trigger conflict', () => {
    const turf = createTurf();
    addToStack(turf, tough('t1', 5, 5, 'kings_row'));
    const incoming = tough('t2', 4, 4, 'freelance');
    expect(turfAffiliationConflict(turf, incoming)).toBe(false);
  });
});

describe('dominantAffiliation / loyal stack threshold (RULES §4)', () => {
  it('2 toughs of same affiliation → NO loyal bonus (below 3 threshold)', () => {
    const turf = createTurf();
    // kings_row has atkBonus:1, defBonus:0
    addToStack(turf, tough('k1', 5, 5, 'kings_row'));
    addToStack(turf, tough('k2', 5, 5, 'kings_row'));
    // loyal bonus requires 3+; power should NOT include +1 atkBonus
    expect(positionPower(turf)).toBe(10); // 5+5, no bonus
    expect(positionResistance(turf)).toBe(10); // 5+5, no bonus
  });

  it('3 toughs of same affiliation → loyal bonus applies', () => {
    const turf = createTurf();
    // kings_row: atkBonus:1, defBonus:0
    addToStack(turf, tough('k1', 5, 5, 'kings_row'));
    addToStack(turf, tough('k2', 5, 5, 'kings_row'));
    addToStack(turf, tough('k3', 5, 5, 'kings_row'));
    // 3 kings_row toughs → loyal atkBonus +1
    expect(positionPower(turf)).toBe(16); // 15 + 1
    expect(positionResistance(turf)).toBe(15); // 15, defBonus=0
  });

  it('4 toughs of same affiliation → loyal bonus still applies', () => {
    const turf = createTurf();
    // iron_devils: atkBonus:0, defBonus:1
    addToStack(turf, tough('id1', 5, 5, 'iron_devils'));
    addToStack(turf, tough('id2', 5, 5, 'iron_devils'));
    addToStack(turf, tough('id3', 5, 5, 'iron_devils'));
    addToStack(turf, tough('id4', 5, 5, 'iron_devils'));
    expect(positionPower(turf)).toBe(20); // no atkBonus
    expect(positionResistance(turf)).toBe(21); // 20 + 1 defBonus
  });
});

describe('mediator graph unblocks rival placement (RULES §4)', () => {
  it('mediator in stack → rival placement free (no currency buffer consumed)', () => {
    // kings_row and iron_devils are rivals.
    // jade_dragon.mediator = ["kings_row", "iron_devils"] → mediates the conflict.
    const turf = createTurf();
    addToStack(turf, tough('kr1', 5, 5, 'kings_row'));
    addToStack(turf, tough('jd1', 5, 5, 'jade_dragon')); // mediator
    const incoming = tough('id1', 5, 5, 'iron_devils');
    // With jade_dragon on turf, no conflict should be raised.
    expect(turfAffiliationConflict(turf, incoming)).toBe(false);
  });

  it('no mediator, no currency → rival placement raises conflict', () => {
    const turf = createTurf();
    addToStack(turf, tough('kr1', 5, 5, 'kings_row'));
    const incoming = tough('id1', 5, 5, 'iron_devils');
    expect(turfAffiliationConflict(turf, incoming)).toBe(true);
  });

  it('currency buffer consumed when no mediator present', () => {
    const turf = createTurf();
    addToStack(turf, tough('kr1', 5, 5, 'kings_row'));
    addToStack(turf, currency('c1'));
    const incoming = tough('id1', 5, 5, 'iron_devils');
    // Currency acts as buffer → no conflict.
    expect(turfAffiliationConflict(turf, incoming)).toBe(false);
    // After consuming buffer, placing a second rival should raise conflict.
    turf.rivalBufferSpent = true;
    expect(turfAffiliationConflict(turf, incoming)).toBe(true);
  });

  it('unrelated tough (not a mediator) does not bypass conflict', () => {
    // southside_saints.mediator = ["kings_row", "los_diablos"] — no iron_devils edge
    const turf = createTurf();
    addToStack(turf, tough('kr1', 5, 5, 'kings_row'));
    addToStack(turf, tough('ss1', 5, 5, 'southside_saints')); // not a mediator for iron_devils
    const incoming = tough('id1', 5, 5, 'iron_devils');
    // southside_saints doesn't mediate kings_row↔iron_devils → conflict still raised
    expect(turfAffiliationConflict(turf, incoming)).toBe(true);
  });
});

describe('seizeTurf', () => {
  beforeEach(() => resetTurfIdCounter());

  it('removes turf from defender', () => {
    const defTurf = createTurf();
    addToStack(defTurf, tough('d1'));
    const defender = makePlayer([defTurf, createTurf()]);
    const atkTurf = createTurf();
    addToStack(atkTurf, tough('a1'));
    const attacker = makePlayer([atkTurf]);

    seizeTurf(defender, 0, attacker, 0);

    expect(defender.turfs).toHaveLength(1);
  });

  it("removes the seized turf (modifier cleanup is resolve.ts' responsibility)", () => {
    // v0.3: board.seizeTurf is a pure remove. Modifiers on the seized
    // turf get routed to the Black Market from resolve.ts, not here.
    const defTurf = createTurf();
    addToStack(defTurf, tough('d1'));
    addToStack(defTurf, weapon('w1'));
    addToStack(defTurf, drug('dr1'));
    const defender = makePlayer([defTurf, createTurf()]);

    const atkTurf = createTurf();
    addToStack(atkTurf, tough('a1'));
    const attacker = makePlayer([atkTurf]);

    seizeTurf(defender, 0, attacker, 0);

    // Seized turf removed from defender; attacker turf unchanged.
    expect(defender.turfs).toHaveLength(1);
    expect(atkTurf.stack.some((c) => c.card.id === 'w1')).toBe(false);
    expect(atkTurf.stack.some((c) => c.card.id === 'dr1')).toBe(false);
  });

  it('does nothing if defender turf does not exist', () => {
    const defender = makePlayer([]);
    const atkTurf = createTurf();
    const attacker = makePlayer([atkTurf]);

    seizeTurf(defender, 5, attacker, 0);
    expect(attacker.turfs).toHaveLength(1);
  });
});
