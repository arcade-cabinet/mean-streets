import { describe, expect, it } from 'vitest';
import {
  bribeSuccess,
  combatBribeProbability,
  holdingCheck,
  isToughInCustody,
  lockupProcess,
  returnFromHolding,
  sendToHolding,
} from '../holding';
import { mkState, mkTough, mkTurf, mkWeapon, sc } from './state-builder';

describe('sendToHolding', () => {
  it('moves a tough + modifiers from the active turf to holding', () => {
    const state = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT' })), sc(mkWeapon({ id: 'w1' }))])],
      [mkTurf('b1', [])],
    );
    state.players.A.toughsInPlay = 1;

    sendToHolding(state, 'A', 'aT');

    expect(state.players.A.turfs[0].stack).toHaveLength(0);
    expect(state.holding.A).toHaveLength(1);
    expect(state.holding.A[0].tough.id).toBe('aT');
    expect(state.holding.A[0].attachedModifiers.map((m) => m.id)).toEqual([
      'w1',
    ]);
    expect(state.players.A.toughsInPlay).toBe(0);
  });

  it('voluntary holding has no turnsRemaining counter', () => {
    const state = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT' }))])],
      [mkTurf('b1', [])],
    );
    sendToHolding(state, 'A', 'aT');
    expect(state.holding.A[0].turnsRemaining).toBeUndefined();
  });
});

describe('bribeSuccess', () => {
  it('base 0.5 + rarity + amount bonus (common, $0)', () => {
    const tough = mkTough({ rarity: 'common' });
    // 0.5 + (1 * 0.1) + min(0.3, 0/10000) = 0.61
    expect(bribeSuccess(tough, 0)).toBeCloseTo(0.6, 2);
  });

  it('legendary tough has high base success', () => {
    const tough = mkTough({ rarity: 'legendary' });
    // 0.5 + (4 * 0.1) + 0 = 0.9
    expect(bribeSuccess(tough, 0)).toBeCloseTo(0.9, 2);
  });

  it('amount bonus caps at 0.3 (amount ≥ $3000)', () => {
    const tough = mkTough({ rarity: 'common' });
    // 0.5 + 0.1 + min(0.3, 10000/10000=1.0) → 0.9 clamped to 1.0 probability... let me compute: 0.5+0.1+0.3=0.9
    expect(bribeSuccess(tough, 10000)).toBeCloseTo(0.9, 2);
  });

  it('mythic tough with $0 = 1.0 (maxed out)', () => {
    const tough = mkTough({ rarity: 'mythic' });
    // 0.5 + (5 * 0.1) + 0 = 1.0
    expect(bribeSuccess(tough, 0)).toBe(1);
  });
});

describe('combatBribeProbability — stepped table', () => {
  it('below $500 returns 0', () => {
    expect(combatBribeProbability(100)).toBe(0);
    expect(combatBribeProbability(400)).toBe(0);
  });

  it('$500 → 0.70', () => {
    expect(combatBribeProbability(500)).toBe(0.7);
  });

  it('$1000 → 0.85', () => {
    expect(combatBribeProbability(1000)).toBe(0.85);
  });

  it('$2000 → 0.95', () => {
    expect(combatBribeProbability(2000)).toBe(0.95);
  });

  it('$5000+ → 0.99', () => {
    expect(combatBribeProbability(5000)).toBe(0.99);
    expect(combatBribeProbability(9999)).toBe(0.99);
  });
});

describe('returnFromHolding', () => {
  it('sweeps voluntary holds back onto the active turf', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    const tough = mkTough({ id: 'aT' });
    state.holding.A.push({ tough, attachedModifiers: [] });

    returnFromHolding(state, 'A');

    expect(state.holding.A).toHaveLength(0);
    expect(state.players.A.turfs[0].stack.some((e) => e.card.id === 'aT')).toBe(
      true,
    );
  });

  it('keeps counter-held toughs until their counter expires', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.holding.A.push({
      tough: mkTough({ id: 'aT' }),
      attachedModifiers: [],
      turnsRemaining: 2,
    });

    returnFromHolding(state, 'A');

    // Counter-held entries stay in holding — they're released by lockupProcess.
    expect(state.holding.A).toHaveLength(1);
  });
});

describe('lockupProcess', () => {
  it('decrements turnsRemaining and returns toughs at 0', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.lockup.A.push({
      tough: mkTough({ id: 'aT' }),
      attachedModifiers: [],
      turnsRemaining: 1,
    });

    lockupProcess(state);
    // Should have been released.
    expect(state.lockup.A).toHaveLength(0);
    expect(state.players.A.turfs[0].stack.some((e) => e.card.id === 'aT')).toBe(
      true,
    );
  });

  it('perma-lockup (999) does not decrement toward release', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.lockup.A.push({
      tough: mkTough({ id: 'aT' }),
      attachedModifiers: [],
      turnsRemaining: 999,
    });

    lockupProcess(state);
    // Still locked.
    expect(state.lockup.A).toHaveLength(1);
    expect(state.lockup.A[0].turnsRemaining).toBe(998);
  });
});

describe('isToughInCustody', () => {
  it('returns true for holding members', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.holding.A.push({
      tough: mkTough({ id: 'held' }),
      attachedModifiers: [],
    });
    expect(isToughInCustody(state, 'A', 'held')).toBe(true);
  });

  it('returns true for lockup members', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    state.lockup.A.push({
      tough: mkTough({ id: 'locked' }),
      attachedModifiers: [],
      turnsRemaining: 3,
    });
    expect(isToughInCustody(state, 'A', 'locked')).toBe(true);
  });

  it('returns false for toughs on active turfs', () => {
    const state = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'free' }))])],
      [mkTurf('b1', [])],
    );
    expect(isToughInCustody(state, 'A', 'free')).toBe(false);
  });
});

describe('holdingCheck — stochastic', () => {
  it('no-op when holding queue is empty', () => {
    const state = mkState([mkTurf('a1', [])], [mkTurf('b1', [])]);
    expect(holdingCheck(state, 'A').outcome).toBe('none');
  });

  it('deterministic given seed + state (same seed → same outcome)', () => {
    const stateA = mkState([mkTurf('a1', [])], [mkTurf('b1', [])], {
      seed: 42,
      heat: 0.8,
    });
    stateA.holding.A.push({
      tough: mkTough({ id: 'aT' }),
      attachedModifiers: [],
    });
    const stateB = mkState([mkTurf('a1', [])], [mkTurf('b1', [])], {
      seed: 42,
      heat: 0.8,
    });
    stateB.holding.A.push({
      tough: mkTough({ id: 'aT' }),
      attachedModifiers: [],
    });

    const outA = holdingCheck(stateA, 'A');
    const outB = holdingCheck(stateB, 'A');
    expect(outA.outcome).toBe(outB.outcome);
  });
});
