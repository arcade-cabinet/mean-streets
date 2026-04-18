import { describe, expect, it } from 'vitest';
import { applyHealTicks } from '../ability-handlers';
import { resolvePhase } from '../resolve';
import { mkDrug, mkState, mkTough, mkTurf, sc } from './state-builder';

// ── PATCHUP ──────────────────────────────────────────────────

describe('PATCHUP (+1 HP/turn to owning tough)', () => {
  it('heals the owning tough by 1 HP per tick', () => {
    const tough = mkTough({ id: 't1', maxHp: 10, hp: 7 });
    const drug = mkDrug({ id: 'd-patchup', abilities: ['PATCHUP'] });
    const turfA = mkTurf('a1', [sc(tough), sc(drug, true, 't1')]);
    const state = mkState([turfA], [mkTurf('b1', [sc(mkTough({ id: 'bT' }))])]);

    applyHealTicks(state, 'A');

    expect(tough.hp).toBe(8);
  });

  it('does not heal beyond maxHp', () => {
    const tough = mkTough({ id: 't1', maxHp: 10, hp: 10 });
    const drug = mkDrug({ id: 'd-patchup', abilities: ['PATCHUP'] });
    const turfA = mkTurf('a1', [sc(tough), sc(drug, true, 't1')]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    expect(tough.hp).toBe(10);
  });

  it('does not heal a dead tough (hp === 0)', () => {
    const tough = mkTough({ id: 't1', maxHp: 10, hp: 0 });
    const drug = mkDrug({ id: 'd-patchup', abilities: ['PATCHUP'] });
    const turfA = mkTurf('a1', [sc(tough), sc(drug, true, 't1')]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    expect(tough.hp).toBe(0);
  });

  it('accumulates across multiple resolve phases', () => {
    const tough = mkTough({ id: 'aT', maxHp: 10, hp: 5 });
    const drug = mkDrug({ id: 'd-patchup', abilities: ['PATCHUP'] });
    const A = [mkTurf('a1', [sc(tough), sc(drug, true, 'aT')])];
    const B = [mkTurf('b1', [sc(mkTough({ id: 'bT', resistance: 100 }))])];
    const state = mkState(A, B);

    // Two resolve phases (no strikes — just heat/hold/cleanup).
    resolvePhase(state);
    resolvePhase(state);

    // Two heal ticks: 5 + 1 + 1 = 7.
    expect(tough.hp).toBe(7);
  });
});

// ── FIELD_MEDIC ──────────────────────────────────────────────

describe('FIELD_MEDIC (+1 HP to all wounded toughs on turf)', () => {
  it('heals all wounded toughs by 1 HP', () => {
    const medic = mkTough({ id: 'm1', abilities: ['FIELD_MEDIC'] });
    const wounded1 = mkTough({ id: 'w1', maxHp: 10, hp: 6 });
    const wounded2 = mkTough({ id: 'w2', maxHp: 8, hp: 3 });
    const turfA = mkTurf('a1', [sc(medic), sc(wounded1), sc(wounded2)]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    expect(wounded1.hp).toBe(7);
    expect(wounded2.hp).toBe(4);
  });

  it('heals the medic itself if wounded', () => {
    const medic = mkTough({ id: 'm1', abilities: ['FIELD_MEDIC'], maxHp: 8, hp: 5 });
    const turfA = mkTurf('a1', [sc(medic)]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    expect(medic.hp).toBe(6);
  });

  it('does not exceed maxHp', () => {
    const medic = mkTough({ id: 'm1', abilities: ['FIELD_MEDIC'] });
    const fullHp = mkTough({ id: 'f1', maxHp: 5, hp: 5 });
    const turfA = mkTurf('a1', [sc(medic), sc(fullHp)]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    expect(fullHp.hp).toBe(5);
  });

  it('does not heal dead toughs (hp === 0)', () => {
    const medic = mkTough({ id: 'm1', abilities: ['FIELD_MEDIC'] });
    const dead = mkTough({ id: 'd1', maxHp: 5, hp: 0 });
    const turfA = mkTurf('a1', [sc(medic), sc(dead)]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    expect(dead.hp).toBe(0);
  });
});

// ── RESUSCITATE ──────────────────────────────────────────────

describe('RESUSCITATE (one-shot full heal)', () => {
  it('fully heals the owning tough on first tick', () => {
    const tough = mkTough({ id: 't1', maxHp: 10, hp: 3 });
    const drug = mkDrug({ id: 'd-resus', abilities: ['RESUSCITATE'] });
    const turfA = mkTurf('a1', [sc(tough), sc(drug, true, 't1')]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    expect(tough.hp).toBe(10);
    expect(state.resuscitateConsumed.has('d-resus')).toBe(true);
  });

  it('does NOT fire a second time on subsequent ticks (one-shot)', () => {
    const tough = mkTough({ id: 't1', maxHp: 10, hp: 3 });
    const drug = mkDrug({ id: 'd-resus', abilities: ['RESUSCITATE'] });
    const A = [mkTurf('a1', [sc(tough), sc(drug, true, 't1')])];
    const B = [mkTurf('b1', [sc(mkTough({ id: 'bT', resistance: 100 }))])];
    const state = mkState(A, B);

    resolvePhase(state); // first tick → full heal
    tough.hp = 2;        // simulate damage after heal
    resolvePhase(state); // second tick → should NOT heal again

    // Remains at 2 because RESUSCITATE is already consumed.
    expect(tough.hp).toBe(2);
  });

  it('does not fire if the tough is already at full HP', () => {
    const tough = mkTough({ id: 't1', maxHp: 10, hp: 10 });
    const drug = mkDrug({ id: 'd-resus', abilities: ['RESUSCITATE'] });
    const turfA = mkTurf('a1', [sc(tough), sc(drug, true, 't1')]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    // Not consumed — it never needed to fire.
    expect(state.resuscitateConsumed.has('d-resus')).toBe(false);
    expect(tough.hp).toBe(10);
  });

  it('does not heal a dead tough (hp === 0)', () => {
    const tough = mkTough({ id: 't1', maxHp: 10, hp: 0 });
    const drug = mkDrug({ id: 'd-resus', abilities: ['RESUSCITATE'] });
    const turfA = mkTurf('a1', [sc(tough), sc(drug, true, 't1')]);
    const state = mkState([turfA], [mkTurf('b1', [])]);

    applyHealTicks(state, 'A');

    // Dead tough cannot be healed by RESUSCITATE.
    expect(tough.hp).toBe(0);
    expect(state.resuscitateConsumed.has('d-resus')).toBe(false);
  });
});
