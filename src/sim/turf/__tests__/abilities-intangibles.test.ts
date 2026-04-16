import { describe, expect, it } from 'vitest';
import {
  applyTangibles,
  hasAbsolute,
  hasChainThree,
  hasImmunity,
  hasInsight,
  hasLaunder,
  hasLowProfile,
  hasNoReveal,
  hasStrikeTwo,
  hasTranscend,
  runIntangiblesPhase,
  stackCardsByRarityDesc,
} from '../abilities';
import type { QueuedAction } from '../types';
import {
  mkCurrency,
  mkDrug,
  mkState,
  mkTough,
  mkTurf,
  mkWeapon,
  up,
} from './fixtures';

const Q: QueuedAction = {
  kind: 'direct_strike',
  side: 'A',
  turfIdx: 0,
  targetTurfIdx: 0,
};

// ── Counter ─────────────────────────────────────────────────
describe('runIntangiblesPhase — counter', () => {
  it('cancels the strike and consumes the PARRY weapon', () => {
    const attacker = mkTurf('a', [up(mkTough({ id: 'ta' }))]);
    const parry = mkWeapon({ id: 'parry', abilities: ['PARRY'] });
    const defender = mkTurf('d', [up(mkTough({ id: 'td' })), up(parry)]);
    const state = mkState([attacker], [defender]);

    const out = runIntangiblesPhase(state, Q);

    expect(out.kind).toBe('canceled');
    if (out.kind === 'canceled') expect(out.reason).toBe('countered');
    expect(defender.stack.some((sc) => sc.card.id === 'parry')).toBe(false);
  });

  it('proceeds when defender has no counter-tagged weapon or currency', () => {
    const attacker = mkTurf('a', [up(mkTough())]);
    const defender = mkTurf('d', [up(mkTough())]);
    expect(runIntangiblesPhase(mkState([attacker], [defender]), Q).kind).toBe(
      'proceed',
    );
  });
});

// ── Probabilistic bribe (RULES §10.3) ──────────────────────
describe('runIntangiblesPhase — probabilistic bribe', () => {
  it('cancels strike deterministically when rng below threshold ($1000 → 85%)', () => {
    // seed=1 → first rng.next() ≈ 0.1366 < 0.85 → bribe succeeds.
    const attacker = mkTurf('a', [up(mkTough())]);
    const defender = mkTurf('d', [up(mkTough()), up(mkCurrency(1000, 'c1k'))]);
    const state = mkState([attacker], [defender], 1);
    const out = runIntangiblesPhase(state, Q);
    expect(out.kind).toBe('canceled');
    if (out.kind === 'canceled') expect(out.reason).toBe('bribed');
    expect(defender.stack.some((sc) => sc.card.id === 'c1k')).toBe(false);
    expect(state.metrics.bribesAccepted).toBe(1);
  });

  it('proceeds when no currency ≥ $500 on defender stack', () => {
    const attacker = mkTurf('a', [up(mkTough())]);
    const defender = mkTurf('d', [up(mkTough()), up(mkCurrency(100, 'c1'))]);
    const state = mkState([attacker], [defender], 1);
    const out = runIntangiblesPhase(state, Q);
    expect(out.kind).toBe('proceed');
    expect(defender.stack.some((sc) => sc.card.id === 'c1')).toBe(true);
  });

  it('failed bribe increments bribesFailed and leaves cash on stack', () => {
    // Rig state.rng to return 0.99 — above $1000's 85% threshold → fail.
    const attacker = mkTurf('a', [up(mkTough())]);
    const defender = mkTurf('d', [up(mkTough()), up(mkCurrency(1000, 'c1k'))]);
    const state = mkState([attacker], [defender], 1);
    state.rng = { ...state.rng, next: () => 0.99 };
    const out = runIntangiblesPhase(state, Q);
    expect(out.kind).toBe('proceed');
    expect(defender.stack.some((sc) => sc.card.id === 'c1k')).toBe(true);
    expect(state.metrics.bribesFailed).toBe(1);
    expect(state.metrics.bribesAccepted).toBe(0);
  });
});

// ── Tangibles — rarity-scaled ───────────────────────────────
describe('applyTangibles — rarity scaling', () => {
  it('common LACERATE = +1 atk', () => {
    const attacker = mkTurf('a', [
      up(mkTough()),
      up(mkWeapon({ abilities: ['LACERATE'] })),
    ]);
    const defender = mkTurf('d', [up(mkTough())]);
    expect(applyTangibles(attacker, defender).atkPowerDelta).toBe(1);
  });

  it('legendary LACERATE scales to +2 atk (round(1 × 1.5))', () => {
    const attacker = mkTurf('a', [
      up(mkTough()),
      up(mkWeapon({ abilities: ['LACERATE'], rarity: 'legendary' })),
    ]);
    const defender = mkTurf('d', [up(mkTough())]);
    expect(applyTangibles(attacker, defender).atkPowerDelta).toBe(2);
  });

  it('mythic BERSERK drug scales to +3 atk + sickOnHit (round(2 × 1.7))', () => {
    const attacker = mkTurf('a', [
      up(mkTough()),
      up(mkDrug({ abilities: ['BERSERK'], rarity: 'mythic' })),
    ]);
    const defender = mkTurf('d', [up(mkTough())]);
    const bonus = applyTangibles(attacker, defender);
    expect(bonus.atkPowerDelta).toBe(3);
    expect(bonus.sickOnHit).toBe(true);
  });

  it('sets ignoreResistance for attacker bruiser', () => {
    const attacker = mkTurf('a', [up(mkTough({ archetype: 'bruiser' }))]);
    const defender = mkTurf('d', [up(mkTough())]);
    expect(applyTangibles(attacker, defender).ignoreResistance).toBe(true);
  });
});

// ── Mythic intangibles ──────────────────────────────────────
describe('runIntangiblesPhase — mythic CLEAN_SLATE', () => {
  it('resets state.heat to 0 when carrier is attacker', () => {
    const cleanSlate = mkTough({
      id: 'accountant',
      rarity: 'mythic',
      abilities: ['CLEAN_SLATE'],
    });
    const attacker = mkTurf('a', [up(cleanSlate)]);
    const defender = mkTurf('d', [up(mkTough())]);
    const state = mkState([attacker], [defender]);
    state.heat = 0.9;
    runIntangiblesPhase(state, Q);
    expect(state.heat).toBe(0);
  });
});

describe('runIntangiblesPhase — mythic BUILD_TURF', () => {
  it('adds a new reserve turf for the attacker side', () => {
    const architect = mkTough({
      id: 'arch',
      rarity: 'mythic',
      abilities: ['BUILD_TURF'],
    });
    const attacker = mkTurf('a', [up(architect)]);
    const defender = mkTurf('d', [up(mkTough())]);
    const state = mkState([attacker], [defender]);
    const before = state.players.A.turfs.length;
    runIntangiblesPhase(state, Q);
    expect(state.players.A.turfs.length).toBe(before + 1);
    expect(state.players.A.turfs.at(-1)!.id).toMatch(/^built-A-/);
  });
});

describe('runIntangiblesPhase — mythic STRIKE_RETREATED', () => {
  it('redirects to a face-up tough below the top when present', () => {
    const ghost = mkTough({
      id: 'ghost',
      rarity: 'mythic',
      abilities: ['STRIKE_RETREATED'],
    });
    const attacker = mkTurf('a', [up(ghost)]);
    const defender = mkTurf('d', [
      { card: mkTough({ id: 'top' }), faceUp: false },
      { card: mkTough({ id: 'retreated' }), faceUp: true },
    ]);
    const state = mkState([attacker], [defender]);
    const out = runIntangiblesPhase(state, Q);
    expect(out.kind).toBe('redirected');
    if (out.kind === 'redirected') {
      expect(out.newTargetStackIdx).toBe(1);
      expect(out.reason).toBe('strike-retreated');
    }
  });

  it('proceeds when no face-up non-top tough exists', () => {
    const ghost = mkTough({
      id: 'ghost',
      rarity: 'mythic',
      abilities: ['STRIKE_RETREATED'],
    });
    const attacker = mkTurf('a', [up(ghost)]);
    const defender = mkTurf('d', [up(mkTough({ id: 'top' }))]);
    expect(runIntangiblesPhase(mkState([attacker], [defender]), Q).kind).toBe(
      'proceed',
    );
  });
});

// ── Passive query hooks ─────────────────────────────────────
describe('passive ability hooks', () => {
  it('tough-scoped predicates (IMMUNITY/TRANSCEND/ABSOLUTE/NO_REVEAL/STRIKE_TWO/CHAIN_THREE)', () => {
    expect(hasImmunity(mkTough({ abilities: ['IMMUNITY'] }))).toBe(true);
    expect(hasTranscend(mkTough({ abilities: ['TRANSCEND'] }))).toBe(true);
    expect(hasAbsolute(mkTough({ abilities: ['ABSOLUTE'] }))).toBe(true);
    expect(hasNoReveal(mkTough({ abilities: ['NO_REVEAL'] }))).toBe(true);
    expect(hasStrikeTwo(mkTough({ abilities: ['STRIKE_TWO'] }))).toBe(true);
    expect(hasChainThree(mkTough({ abilities: ['CHAIN_THREE'] }))).toBe(true);
    expect(hasImmunity(mkTough())).toBe(false);
  });

  it('hasLaunder detects the LAUNDER tag on a non-currency carrier', () => {
    // Currency has no abilities[] in v0.3 types; test stubs via weapon.
    const turf = mkTurf('t', [
      up(mkTough()),
      up(mkWeapon({ abilities: ['LAUNDER'] })),
    ]);
    expect(hasLaunder(turf)).toBe(true);
    expect(hasLaunder(mkTurf('empty', [up(mkTough())]))).toBe(false);
  });

  it('hasLowProfile flag on owning tough', () => {
    expect(hasLowProfile(mkTough({ abilities: ['LOW_PROFILE'] }))).toBe(true);
    expect(hasLowProfile(mkTough())).toBe(false);
  });

  it('hasInsight scans state.players[side] for an INSIGHT tough', () => {
    const informer = mkTough({ abilities: ['INSIGHT'] });
    const attacker = mkTurf('a', [up(informer)]);
    const defender = mkTurf('d', [up(mkTough())]);
    const state = mkState([attacker], [defender]);
    expect(hasInsight(state, 'A')).toBe(true);
    expect(hasInsight(state, 'B')).toBe(false);
  });
});

// ── Helper sanity ────────────────────────────────────────────
describe('stackCardsByRarityDesc', () => {
  it('sorts mythic → legendary → rare → uncommon → common, stable within ties', () => {
    const turf = mkTurf('x', [
      up(mkTough({ id: 't1', rarity: 'common' })),
      up(mkTough({ id: 't2', rarity: 'legendary' })),
      up(mkTough({ id: 't3', rarity: 'rare' })),
      up(mkTough({ id: 't4', rarity: 'common' })),
      up(mkTough({ id: 't5', rarity: 'mythic' })),
      up(mkTough({ id: 't6', rarity: 'uncommon' })),
    ]);
    expect(stackCardsByRarityDesc(turf).map((sc) => sc.card.id)).toEqual([
      't5',
      't2',
      't3',
      't6',
      't1',
      't4',
    ]);
  });
});
