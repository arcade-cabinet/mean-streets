import { describe, expect, it } from 'vitest';
import { computeDamage, resolveDirectStrike } from '../attacks';
import { positionPower, positionResistance } from '../board';
import { mkTough, mkTurf, sc } from './state-builder';

// These tests lock the five v0.3 damage tiers from RULES §7.
// Any change to the tiers should update thresholds in
// src/data/ai/turf-sim.json — these tests pin the behavior.

describe('computeDamage — tier thresholds', () => {
  it('busted: P < R → 0 damage', () => {
    const r = computeDamage(4, 5);
    expect(r.outcome).toBe('busted');
    expect(r.damage).toBe(0);
  });

  it('wound: R <= P < 1.5R → min 1 damage + woundBonus', () => {
    // P=5, R=5 → 0 + bonus 1 = 1 (clamped to minDamage 1)
    expect(computeDamage(5, 5).outcome).toBe('wound');
    expect(computeDamage(5, 5).damage).toBe(1);
    // P=6, R=5 → 1 + 1 = 2
    expect(computeDamage(6, 5).damage).toBe(2);
  });

  it('serious_wound: 1.5R <= P < 2R → damage + seriousBonus 2', () => {
    // P=8, R=5 → ratio 1.6 → serious. dmg = 8-5+2 = 5.
    expect(computeDamage(8, 5).outcome).toBe('serious_wound');
    expect(computeDamage(8, 5).damage).toBe(5);
  });

  it('crushing: 2R <= P < 3R → damage + crushingBonus 3', () => {
    // P=11, R=5 → ratio 2.2 → crushing. dmg = 11-5+3 = 9.
    expect(computeDamage(11, 5).outcome).toBe('crushing');
    expect(computeDamage(11, 5).damage).toBe(9);
  });

  it('instant kill: P >= 3R → kill, damage 9999', () => {
    expect(computeDamage(15, 5).outcome).toBe('kill');
    expect(computeDamage(15, 5).damage).toBe(9999);
  });

  it('threshold precision at tier boundaries', () => {
    // Exactly 1.5R: serious.
    expect(computeDamage(15, 10).outcome).toBe('serious_wound');
    // 1.4R (below threshold): wound.
    expect(computeDamage(14, 10).outcome).toBe('wound');
    // Exactly 2R: crushing.
    expect(computeDamage(20, 10).outcome).toBe('crushing');
    // Exactly 3R: instant kill.
    expect(computeDamage(30, 10).outcome).toBe('kill');
  });

  it('R=0 edge: busted if P is 0, else kill (any P is instant)', () => {
    expect(computeDamage(0, 0).outcome).toBe('wound');
  });
});

describe('HP-ratio clamp on effective P/R', () => {
  it('wounded tough with hp 4/8 scales effective stats to 50%', () => {
    // Build a tough with P=10, R=8, maxHp=8, hp=4.
    const t = mkTough({ power: 10, resistance: 8, maxHp: 8, hp: 4 });
    const turf = mkTurf('t1', [sc(t)]);
    // Effective P = floor(10 * 4/8) = 5. Effective R = floor(8 * 4/8) = 4.
    expect(positionPower(turf)).toBe(5);
    expect(positionResistance(turf)).toBe(4);
  });

  it('min-1 floor for effective stats above 0 HP', () => {
    const t = mkTough({ power: 10, resistance: 10, maxHp: 10, hp: 1 });
    const turf = mkTurf('t1', [sc(t)]);
    // floor(10 * 1/10) = 1, min-clamped to 1.
    expect(positionPower(turf)).toBe(1);
    expect(positionResistance(turf)).toBe(1);
  });

  it('dead tough (hp 0) contributes 0 to power and resistance', () => {
    const t = mkTough({ power: 10, resistance: 10, maxHp: 10, hp: 0 });
    const turf = mkTurf('t1', [sc(t)]);
    expect(positionPower(turf)).toBe(0);
    expect(positionResistance(turf)).toBe(0);
  });
});

describe('resolveDirectStrike — HP chip across multiple turns', () => {
  it('successive wounds eventually kill', () => {
    const attacker = mkTurf('a', [
      sc(mkTough({ id: 'aT', power: 7, archetype: 'ghost' })),
    ]);
    // ghost to sidestep bruiser auto-kill. Victim: R=6, HP=6.
    const defender = mkTurf('d', [
      sc(
        mkTough({
          id: 'dT',
          archetype: 'ghost',
          resistance: 6,
          maxHp: 6,
          hp: 6,
        }),
      ),
    ]);

    // Hit 1: P=7 vs R=6 → wound dmg=2. hp 6→4. Effective R = floor(6*4/6) = 4.
    resolveDirectStrike(attacker, defender);
    let tough = defender.stack[0].card;
    if (tough.kind === 'tough') expect(tough.hp).toBe(4);

    // Hit 2: P=7 vs effective R=4 → serious_wound (7/4=1.75). dmg=7-4+2=5. hp 4→-1=0.
    resolveDirectStrike(attacker, defender);
    // Tough died → removed.
    expect(
      defender.stack.some(
        (e) => e.card.id === 'dT' && (e.card as { hp: number }).hp > 0,
      ),
    ).toBe(false);
  });
});
