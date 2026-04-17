import { describe, expect, it } from 'vitest';
import { promoteReserveTurf } from '../board';
import { createMatch, isGameOver } from '../game';
import { resolvePhase } from '../resolve';
import { mkState, mkTough, mkTurf, sc } from './state-builder';

describe('promoteReserveTurf — active/reserve shift', () => {
  it('removes the current active turf and promotes turfs[1] to active', () => {
    const state = mkState(
      [
        mkTurf('a1', [sc(mkTough({ id: 'aT1' }))], { reserveIndex: 0 }),
        mkTurf('a2', [sc(mkTough({ id: 'aT2' }))], { reserveIndex: 1 }),
        mkTurf('a3', [sc(mkTough({ id: 'aT3' }))], { reserveIndex: 2 }),
      ],
      [mkTurf('b1', [])],
    );

    promoteReserveTurf(state.players.A);

    expect(state.players.A.turfs).toHaveLength(2);
    expect(state.players.A.turfs[0].id).toBe('a2');
    expect(state.players.A.turfs[0].reserveIndex).toBe(0);
    expect(state.players.A.turfs[0].isActive).toBe(true);
    expect(state.players.A.turfs[1].id).toBe('a3');
    expect(state.players.A.turfs[1].reserveIndex).toBe(1);
    expect(state.players.A.turfs[1].isActive).toBe(false);
  });

  it('no-op on empty turfs list', () => {
    const state = mkState([], [mkTurf('b1', [])]);
    expect(() => promoteReserveTurf(state.players.A)).not.toThrow();
    expect(state.players.A.turfs).toHaveLength(0);
  });
});

describe('resolvePhase — seize triggers reserve promotion', () => {
  it("A seizes B's only active turf → B empty → A wins", () => {
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [mkTurf('b1', [sc(mkTough({ id: 'bT', resistance: 1 }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.players.B.turfs).toHaveLength(0);
    expect(state.winner).toBe('A');
    expect(state.endReason).toBe('total_seizure');
  });

  it("A seizes B's active turf with reserves → B promotes", () => {
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [
      mkTurf('b1', [sc(mkTough({ id: 'bT1', resistance: 1 }))], {
        reserveIndex: 0,
      }),
      mkTurf('b2', [sc(mkTough({ id: 'bT2' }))], { reserveIndex: 1 }),
    ];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.players.B.turfs).toHaveLength(1);
    expect(state.players.B.turfs[0].id).toBe('b2');
    expect(state.winner).toBeNull(); // war continues
  });

  it('records seizure into warStats when a turf falls', () => {
    const A = [mkTurf('a1', [sc(mkTough({ id: 'aT', power: 50 }))])];
    const B = [mkTurf('b1', [sc(mkTough({ id: 'bT', resistance: 1 }))])];
    const state = mkState(A, B);
    state.players.A.queued.push({
      kind: 'direct_strike',
      side: 'A',
      turfIdx: 0,
      targetTurfIdx: 0,
    });

    resolvePhase(state);

    expect(state.warStats.seizures).toHaveLength(1);
    expect(state.warStats.seizures[0].seizedBy).toBe('A');
    expect(state.warStats.seizures[0].turnsOnThatTurf).toBe(1);
  });
});

describe('isGameOver — win / loss / draw', () => {
  it('returns null while both sides retain at least one turf', () => {
    const match = createMatch(
      {
        difficulty: 'medium',
        suddenDeath: false,
        turfCount: 2,
        actionsPerTurn: 3,
        firstTurnActions: 5,
      },
      { seed: 7 },
    );
    expect(isGameOver(match)).toBeNull();
  });

  it('returns A when B runs out of turfs', () => {
    const match = createMatch(
      {
        difficulty: 'medium',
        suddenDeath: false,
        turfCount: 2,
        actionsPerTurn: 3,
        firstTurnActions: 5,
      },
      { seed: 7 },
    );
    match.game.players.B.turfs = [];
    expect(isGameOver(match)).toBe('A');
    expect(match.game.endReason).toBe('total_seizure');
  });

  it('returns null for a draw state (both empty)', () => {
    const match = createMatch(
      {
        difficulty: 'medium',
        suddenDeath: false,
        turfCount: 2,
        actionsPerTurn: 3,
        firstTurnActions: 5,
      },
      { seed: 7 },
    );
    match.game.players.A.turfs = [];
    match.game.players.B.turfs = [];
    expect(isGameOver(match)).toBeNull();
    expect(match.game.endReason).toBe('draw');
  });

  it('timeout resolves by whoever has more turfs remaining', () => {
    const match = createMatch(
      {
        difficulty: 'medium',
        suddenDeath: false,
        turfCount: 3,
        actionsPerTurn: 3,
        firstTurnActions: 5,
      },
      { seed: 7, maxTurns: 1 },
    );
    match.turnCount = 2; // past timeout
    // A has 2 turfs, B has 1 → A wins timeout.
    match.game.players.B.turfs = match.game.players.B.turfs.slice(0, 1);
    expect(isGameOver(match)).toBe('A');
    expect(match.game.endReason).toBe('timeout');
  });
});
