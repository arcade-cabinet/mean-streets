import { describe, expect, it } from 'vitest';
import type { ToughCard, WeaponCard, Turf } from '../types';
import { createTurf, addToStack } from '../board';
import {
  topToughIdx,
  bottomToughIdx,
  toughBelowIdx,
  resolveTargetToughIdx,
  killToughAtIdx,
  transferMods,
} from '../stack-ops';

function tough(id: string, power = 5, resistance = 5, archetype = 'bruiser'): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype,
    affiliation: 'freelance', power, resistance, rarity: 'common', abilities: [],
  };
}

function weapon(id: string, power = 3): WeaponCard {
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

describe('topToughIdx', () => {
  it('returns highest-index tough in stack', () => {
    const turf = turfWith(tough('bottom'), weapon('w1'), tough('top'));
    expect(topToughIdx(turf)).toBe(2);
  });

  it('returns -1 for empty stack', () => {
    expect(topToughIdx(createTurf())).toBe(-1);
  });

  it('returns -1 when only modifiers', () => {
    expect(topToughIdx(turfWith(weapon('w1')))).toBe(-1);
  });

  it('handles single tough', () => {
    expect(topToughIdx(turfWith(tough('solo')))).toBe(0);
  });
});

describe('bottomToughIdx', () => {
  it('returns lowest-index tough in stack', () => {
    const turf = turfWith(tough('bottom'), weapon('w1'), tough('top'));
    expect(bottomToughIdx(turf)).toBe(0);
  });

  it('returns -1 for empty stack', () => {
    expect(bottomToughIdx(createTurf())).toBe(-1);
  });

  it('handles modifiers before first tough', () => {
    const turf = turfWith(weapon('w1'), tough('t1'));
    expect(bottomToughIdx(turf)).toBe(1);
  });
});

describe('toughBelowIdx', () => {
  it('finds the next tough below a given index', () => {
    const turf = turfWith(tough('t1'), weapon('w1'), tough('t2'));
    expect(toughBelowIdx(turf, 2)).toBe(0);
  });

  it('returns -1 when no tough below', () => {
    const turf = turfWith(tough('t1'), weapon('w1'));
    expect(toughBelowIdx(turf, 0)).toBe(-1);
  });

  it('skips modifiers between toughs', () => {
    const turf = turfWith(tough('t1'), weapon('w1'), weapon('w2'), tough('t2'));
    expect(toughBelowIdx(turf, 3)).toBe(0);
  });
});

describe('resolveTargetToughIdx', () => {
  it('default: targets top tough on defender', () => {
    const defender = turfWith(tough('bottom'), tough('top'));
    const attacker = turfWith(tough('atk'));
    expect(resolveTargetToughIdx(defender, attacker)).toBe(1);
  });

  it('shark archetype: targets bottom tough (strike-bottom)', () => {
    const defender = turfWith(tough('bottom'), tough('top'));
    const attacker = turfWith(tough('shark', 5, 5, 'shark'));
    expect(resolveTargetToughIdx(defender, attacker)).toBe(0);
  });

  it('ghost archetype: strike-anywhere picks lowest-resistance tough', () => {
    // Ghost's strike-anywhere (RULES.md §7: "choose which tough to target")
    // now picks the easiest kill — the tough with the lowest resistance —
    // rather than blindly hitting bottom. "bottom" here has resistance 8;
    // "top" has 3. Ghost targets "top".
    const defender = turfWith(tough('bottom', 4, 8), tough('top', 4, 3));
    const attacker = turfWith(tough('ghost', 5, 5, 'ghost'));
    expect(resolveTargetToughIdx(defender, attacker)).toBe(1);
  });

  it('ghost targets differently from shark when weakest tough is not at the bottom', () => {
    // Regression pin for the prior bug where ghost and shark both
    // hit bottom. Now they diverge: shark hits bottom (oldest
    // reinforcement), ghost hits lowest-resistance anywhere.
    const defender = turfWith(
      tough('bottom', 4, 9), // hardest
      tough('middle', 4, 2), // easiest
      tough('top', 4, 6),
    );
    const shark = turfWith(tough('s', 5, 5, 'shark'));
    const ghost = turfWith(tough('g', 5, 5, 'ghost'));
    expect(resolveTargetToughIdx(defender, shark)).toBe(0);
    expect(resolveTargetToughIdx(defender, ghost)).toBe(1);
  });

  it('ghost falls back to -1 when defender has no toughs', () => {
    const defender = turfWith(weapon('w1'));
    const attacker = turfWith(tough('g', 5, 5, 'ghost'));
    expect(resolveTargetToughIdx(defender, attacker)).toBe(-1);
  });

  it('returns -1 when no toughs on defender', () => {
    const defender = turfWith(weapon('w1'));
    const attacker = turfWith(tough('atk'));
    expect(resolveTargetToughIdx(defender, attacker)).toBe(-1);
  });

  it('shark and ghost priority: shark takes precedence if both present', () => {
    const defender = turfWith(tough('bottom'), tough('top'));
    const attacker = turfWith(tough('shark', 5, 5, 'shark'), tough('normal'));
    expect(resolveTargetToughIdx(defender, attacker)).toBe(0);
  });
});

describe('killToughAtIdx', () => {
  it('removes the tough and its belonging mods', () => {
    const turf = turfWith(tough('t1'), weapon('w1'));
    const { tough: killed, mods } = killToughAtIdx(turf, 0);
    expect(killed.id).toBe('t1');
    expect(mods).toHaveLength(1);
    expect(mods[0].id).toBe('w1');
    expect(turf.stack).toHaveLength(0);
  });

  it('only removes mods belonging to the killed tough', () => {
    const turf = turfWith(tough('t1'), weapon('w-for-t1'), tough('t2'), weapon('w-for-t2'));
    const { mods } = killToughAtIdx(turf, 2);
    expect(mods).toHaveLength(1);
    expect(mods[0].id).toBe('w-for-t2');
    expect(turf.stack.map(c => c.id)).toEqual(['t1', 'w-for-t1']);
  });

  it('handles killing bottom tough with mods above until next tough', () => {
    const turf = turfWith(tough('t1'), weapon('w-between'), tough('t2'));
    const { tough: killed, mods } = killToughAtIdx(turf, 0);
    expect(killed.id).toBe('t1');
    expect(mods).toHaveLength(1);
    expect(mods[0].id).toBe('w-between');
    expect(turf.stack).toHaveLength(1);
    expect(turf.stack[0].id).toBe('t2');
  });

  it('kills tough with no mods', () => {
    const turf = turfWith(tough('t1'), tough('t2'));
    const { tough: killed, mods } = killToughAtIdx(turf, 1);
    expect(killed.id).toBe('t2');
    expect(mods).toHaveLength(0);
    expect(turf.stack).toHaveLength(1);
  });
});

describe('transferMods', () => {
  it('adds compatible mods to attacker turf', () => {
    const attacker = turfWith(tough('a1', 5, 5));
    const mods = [weapon('w1'), weapon('w2')];
    const { transferred, discarded } = transferMods(mods, attacker);
    expect(transferred).toHaveLength(2);
    expect(discarded).toHaveLength(0);
    expect(attacker.stack).toHaveLength(3);
  });

  it('discards mods that cause affiliation conflict (modifiers are never toughs, so no conflict)', () => {
    const attacker = turfWith(tough('a1', 5, 5, 'kings_row'));
    const mods = [weapon('w1')];
    const { transferred, discarded } = transferMods(mods, attacker);
    expect(transferred).toHaveLength(1);
    expect(discarded).toHaveLength(0);
  });

  it('handles empty mods array', () => {
    const attacker = turfWith(tough('a1'));
    const { transferred, discarded } = transferMods([], attacker);
    expect(transferred).toHaveLength(0);
    expect(discarded).toHaveLength(0);
  });
});
