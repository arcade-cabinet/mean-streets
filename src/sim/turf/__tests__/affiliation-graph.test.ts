import { describe, expect, it } from 'vitest';
import type { ToughCard, CurrencyCard, Turf } from '../types';
import { createTurf, addToStack, turfAffiliationConflict } from '../board';

function tough(id: string, affiliation: string): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'bruiser',
    affiliation, power: 5, resistance: 5, rarity: 'common', abilities: [],
  };
}

function currency(id: string): CurrencyCard {
  return { kind: 'currency', id, name: '$100', denomination: 100, rarity: 'common' };
}

function turfWith(...cards: (ToughCard | CurrencyCard)[]): Turf {
  const turf = createTurf();
  for (const c of cards) addToStack(turf, c);
  return turf;
}

describe('affiliation conflict — rival pairs', () => {
  it('kings_row vs iron_devils is a conflict', () => {
    const turf = turfWith(tough('t1', 'kings_row'));
    expect(turfAffiliationConflict(turf, tough('t2', 'iron_devils'))).toBe(true);
  });

  it('iron_devils vs kings_row is a conflict (symmetric)', () => {
    const turf = turfWith(tough('t1', 'iron_devils'));
    expect(turfAffiliationConflict(turf, tough('t2', 'kings_row'))).toBe(true);
  });

  it('kings_row vs los_diablos is a conflict', () => {
    const turf = turfWith(tough('t1', 'kings_row'));
    expect(turfAffiliationConflict(turf, tough('t2', 'los_diablos'))).toBe(true);
  });

  it('jade_dragon vs los_diablos is a conflict', () => {
    const turf = turfWith(tough('t1', 'jade_dragon'));
    expect(turfAffiliationConflict(turf, tough('t2', 'los_diablos'))).toBe(true);
  });

  it('reapers vs southside_saints is a conflict', () => {
    const turf = turfWith(tough('t1', 'reapers'));
    expect(turfAffiliationConflict(turf, tough('t2', 'southside_saints'))).toBe(true);
  });
});

describe('affiliation conflict — non-rival pairs', () => {
  it('kings_row vs cobalt_syndicate (loyal) is no conflict', () => {
    const turf = turfWith(tough('t1', 'kings_row'));
    expect(turfAffiliationConflict(turf, tough('t2', 'cobalt_syndicate'))).toBe(false);
  });

  it('kings_row vs jade_dragon (neutral) is no conflict', () => {
    const turf = turfWith(tough('t1', 'kings_row'));
    expect(turfAffiliationConflict(turf, tough('t2', 'jade_dragon'))).toBe(false);
  });

  it('freelance is never a rival', () => {
    const turf = turfWith(tough('t1', 'kings_row'));
    expect(turfAffiliationConflict(turf, tough('t2', 'freelance'))).toBe(false);
  });

  it('incoming onto empty turf is no conflict', () => {
    const turf = createTurf();
    expect(turfAffiliationConflict(turf, tough('t1', 'kings_row'))).toBe(false);
  });
});

describe('affiliation conflict — currency buffer rule', () => {
  it('currency on turf prevents rival conflict', () => {
    const turf = turfWith(tough('t1', 'kings_row'), currency('c1'));
    expect(turfAffiliationConflict(turf, tough('t2', 'iron_devils'))).toBe(false);
  });

  it('without currency, rival conflict occurs', () => {
    const turf = turfWith(tough('t1', 'kings_row'));
    expect(turfAffiliationConflict(turf, tough('t2', 'iron_devils'))).toBe(true);
  });
});

describe('affiliation conflict — neutral tough mediator rule', () => {
  it('neutral tough mediates between rivals', () => {
    const turf = turfWith(
      tough('kr', 'kings_row'),
      tough('jd', 'jade_dragon'),
    );
    expect(turfAffiliationConflict(turf, tough('id', 'iron_devils'))).toBe(false);
  });

  it('non-mediating neutral does not prevent conflict', () => {
    const turf = turfWith(
      tough('kr', 'kings_row'),
      tough('ns', 'neon_snakes'),
    );
    expect(turfAffiliationConflict(turf, tough('id', 'iron_devils'))).toBe(true);
  });
});

describe('affiliation conflict — multi-rival scenarios', () => {
  it('multiple rivals on turf all trigger conflict', () => {
    const turf = turfWith(
      tough('kr', 'kings_row'),
      tough('ld', 'los_diablos'),
    );
    expect(turfAffiliationConflict(turf, tough('id', 'iron_devils'))).toBe(true);
  });

  it('two factions at war with each other but incoming is neutral to both', () => {
    const turf = turfWith(tough('kr', 'kings_row'));
    expect(turfAffiliationConflict(turf, tough('dr', 'dead_rabbits'))).toBe(false);
  });
});
