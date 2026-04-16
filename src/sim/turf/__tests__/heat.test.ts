import { describe, expect, it } from 'vitest';
import { computeHeat, lockupDuration, raidProbability } from '../heat';
import {
  mkCurrency,
  mkDrug,
  mkState,
  mkTough,
  mkTurf,
  mkWeapon,
  sc,
} from './state-builder';

describe('computeHeat — breakdown fields', () => {
  it('returns all four component fields plus clamped total', () => {
    const state = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT' }))])],
      [mkTurf('b1', [sc(mkTough({ id: 'bT' }))])],
    );

    const h = computeHeat(state);
    expect(h).toHaveProperty('fromRarity');
    expect(h).toHaveProperty('fromCurrencyConcentration');
    expect(h).toHaveProperty('fromLaunder');
    expect(h).toHaveProperty('fromLowProfile');
    expect(h).toHaveProperty('total');
    expect(h.total).toBeGreaterThanOrEqual(0);
    expect(h.total).toBeLessThanOrEqual(1);
  });

  it('mythics contribute more heat than commons (0.100 vs 0.005 per card)', () => {
    const commonOnly = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT', rarity: 'common' }))])],
      [mkTurf('b1', [sc(mkTough({ id: 'bT', rarity: 'common' }))])],
    );
    const mythicOnly = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT', rarity: 'mythic' }))])],
      [mkTurf('b1', [sc(mkTough({ id: 'bT', rarity: 'mythic' }))])],
    );

    expect(computeHeat(mythicOnly).total).toBeGreaterThan(
      computeHeat(commonOnly).total,
    );
  });

  it('$1000 currency produces concentration heat above the $500 floor', () => {
    const cash = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT' })), sc(mkCurrency(1000))])],
      [mkTurf('b1', [sc(mkTough({ id: 'bT' }))])],
    );
    const h = computeHeat(cash);
    expect(h.fromCurrencyConcentration).toBeGreaterThan(0);
  });

  it('LAUNDER modifier produces negative relief', () => {
    const state = mkState(
      [
        mkTurf('a1', [
          sc(mkTough({ id: 'aT' })),
          sc(mkWeapon({ id: 'w1', abilities: ['LAUNDER'] })),
        ]),
      ],
      [mkTurf('b1', [sc(mkTough({ id: 'bT' }))])],
    );
    const h = computeHeat(state);
    expect(h.fromLaunder).toBeLessThan(0);
  });

  it('LOW_PROFILE drug halves its owner tough heat contribution', () => {
    const without = mkState(
      [mkTurf('a1', [sc(mkTough({ id: 'aT', rarity: 'legendary' }))])],
      [mkTurf('b1', [])],
    );
    const withLP = mkState(
      [
        mkTurf('a1', [
          sc(mkTough({ id: 'aT', rarity: 'legendary' })),
          sc(mkDrug({ id: 'lp', abilities: ['LOW_PROFILE'] })),
        ]),
      ],
      [mkTurf('b1', [])],
    );

    expect(computeHeat(withLP).fromLowProfile).toBeLessThan(0);
    expect(computeHeat(withLP).total).toBeLessThan(computeHeat(without).total);
  });
});

describe('raidProbability', () => {
  it('returns 0 when heat is 0 regardless of difficulty', () => {
    expect(raidProbability(0, 'easy')).toBe(0);
    expect(raidProbability(0, 'ultra-nightmare')).toBe(0);
  });

  it('scales with heat squared × difficulty coefficient', () => {
    // Medium coef = 0.7. heat=0.5 → 0.25 * 0.7 = 0.175.
    expect(raidProbability(0.5, 'medium')).toBeCloseTo(0.175, 3);
  });

  it('clamps to 1.0 when heat² × coef exceeds 1', () => {
    expect(raidProbability(1, 'ultra-nightmare')).toBe(1);
  });

  it('easy difficulty raids less than nightmare at equal heat', () => {
    expect(raidProbability(0.5, 'easy')).toBeLessThan(
      raidProbability(0.5, 'nightmare'),
    );
  });
});

describe('lockupDuration', () => {
  it('easy/medium = 1 turn; hard = 2; nightmare = 3', () => {
    expect(lockupDuration('easy')).toBe(1);
    expect(lockupDuration('medium')).toBe(1);
    expect(lockupDuration('hard')).toBe(2);
    expect(lockupDuration('nightmare')).toBe(3);
  });

  it('ultra-nightmare is perma-lockup (sentinel 999)', () => {
    expect(lockupDuration('ultra-nightmare')).toBe(999);
  });
});
