import { describe, expect, it } from 'vitest';
import {
  captureRunnerOnSeize,
  createBoard,
  equipBackpack,
  freeSwapEquippedRunner,
  placeReserveCrew,
  retreatRunner,
} from '../board';
import type { BackpackCard, CrewCard, PayloadCard } from '../types';

function makeCrew(id = 'crew-1'): CrewCard {
  return {
    type: 'crew',
    id,
    displayName: id,
    archetype: 'bruiser',
    affiliation: 'kings-row',
    power: 5,
    resistance: 5,
    abilityText: '',
    unlocked: true,
    locked: false,
  };
}

function makeBackpack(id = 'pk-1', payload: PayloadCard[] = []): BackpackCard {
  return {
    type: 'backpack',
    id,
    name: id,
    icon: 'crate',
    size: Math.max(1, Math.min(4, payload.length || 1)) as 1 | 2 | 3 | 4,
    payload,
    unlocked: true,
    locked: false,
  };
}

describe('runner contract (RULES.md §7)', () => {
  it('freeSwapEquippedRunner moves an equipped reserve to first empty active slot', () => {
    const board = createBoard('A', 5, 5);
    const placed = placeReserveCrew(board, 0, makeCrew());
    expect(placed).toBe(true);
    const reservePos = board.reserve[0]!;
    const equipped = equipBackpack(reservePos, makeBackpack('pk-1', []), true);
    expect(equipped).toBe(true);

    const landed = freeSwapEquippedRunner(board, 0);

    expect(landed).toBeGreaterThanOrEqual(0);
    expect(board.active[landed]?.crew?.id).toBe('crew-1');
    expect(board.active[landed]?.backpack?.id).toBe('pk-1');
    expect(board.reserve[0]?.crew).toBeNull();
  });

  it('freeSwapEquippedRunner returns -1 when no equipped reserve exists', () => {
    const board = createBoard('A', 5, 5);
    placeReserveCrew(board, 0, makeCrew());
    // No backpack equipped → not a runner.
    const landed = freeSwapEquippedRunner(board, 0);
    expect(landed).toBe(-1);
  });

  it('retreatRunner moves an active runner back to reserve and reports the turn was consumed', () => {
    const board = createBoard('A', 5, 5);
    placeReserveCrew(board, 0, makeCrew('runner'));
    equipBackpack(board.reserve[0]!, makeBackpack('pk-1', []), true);
    const landed = freeSwapEquippedRunner(board, 0);
    expect(landed).toBeGreaterThanOrEqual(0);

    const retreat = retreatRunner(board, landed);

    expect(retreat.retreated).toBe(true);
    expect(retreat.consumed).toBe(true);
    expect(retreat.reserveIdx).toBeGreaterThanOrEqual(0);
    expect(board.reserve[retreat.reserveIdx]?.crew?.id).toBe('runner');
    expect(board.active[landed]?.crew).toBeNull();
  });

  it('retreatRunner refuses if the active position has no backpack', () => {
    const board = createBoard('A', 5, 5);
    board.active[0]!.crew = makeCrew(); // crew without backpack
    const result = retreatRunner(board, 0);
    expect(result.retreated).toBe(false);
    expect(result.consumed).toBe(false);
  });

  it('captureRunnerOnSeize returns the runner backpack and clears defender', () => {
    const board = createBoard('B', 5, 5);
    const defender = board.active[0]!;
    defender.crew = makeCrew('victim');
    const cargo: PayloadCard[] = [];
    const pack = makeBackpack('pk-loot', cargo);
    equipBackpack(defender, pack, true);
    expect(defender.runner).toBe(true);

    const captured = captureRunnerOnSeize(defender);

    expect(captured?.id).toBe('pk-loot');
    expect(defender.backpack).toBeNull();
    expect(defender.runner).toBe(false);
    expect(defender.payloadRemaining).toBe(0);
  });

  it('captureRunnerOnSeize returns null when defender is not a runner', () => {
    const board = createBoard('B', 5, 5);
    const defender = board.active[0]!;
    defender.crew = makeCrew('regular');
    const captured = captureRunnerOnSeize(defender);
    expect(captured).toBeNull();
  });
});
