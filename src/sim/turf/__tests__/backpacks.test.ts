import { describe, expect, it } from 'vitest';
import { createRng } from '../../cards/rng';
import { generateBackpacks, generateCash, generateDrugs, generateWeapons } from '../generators';
import { clearBackpack, consumePayload, createBoard, equipBackpack, markRunner } from '../board';
import type { CrewCard } from '../types';

function crew(id: string): CrewCard {
  return {
    type: 'crew',
    id,
    displayName: id,
    archetype: 'runner',
    affiliation: 'freelance',
    power: 3,
    resistance: 3,
    abilityText: '',
    unlocked: true,
    locked: false,
  };
}

describe('backpacks', () => {
  it('generates deterministic backpack kits for a fixed seed', () => {
    const rngA = createRng(42);
    const rngB = createRng(42);
    const weaponsA = generateWeapons(rngA);
    const drugsA = generateDrugs(rngA);
    const cashA = generateCash();
    const weaponsB = generateWeapons(rngB);
    const drugsB = generateDrugs(rngB);
    const cashB = generateCash();

    const packsA = generateBackpacks(rngA, weaponsA, drugsA, cashA);
    const packsB = generateBackpacks(rngB, weaponsB, drugsB, cashB);

    expect(packsA.map(pack => pack.id)).toEqual(packsB.map(pack => pack.id));
    expect(packsA.map(pack => pack.payload.map(card => card.type))).toEqual(
      packsB.map(pack => pack.payload.map(card => card.type)),
    );
  });

  it('equips a backpack onto a reserve crew and consumes runner payload cleanly', () => {
    const rng = createRng(9);
    const weapons = generateWeapons(rng);
    const drugs = generateDrugs(rng);
    const cash = generateCash();
    const backpack = generateBackpacks(rng, weapons, drugs, cash, 1)[0];
    const board = createBoard('A', 5, 5);

    const position = board.reserve[0];
    position.crew = crew('runner-a');

    expect(equipBackpack(position, backpack, true)).toBe(true);
    expect(position.runner).toBe(true);
    expect(position.payloadRemaining).toBe(backpack.payload.length);

    while (position.payloadRemaining > 0) {
      expect(consumePayload(position)).toBe(true);
    }

    expect(position.runner).toBe(false);
    expect(position.payloadRemaining).toBe(0);
    markRunner(position, true);
    expect(position.runner).toBe(false);
    expect(clearBackpack(position)?.id).toBe(backpack.id);
    expect(position.backpack).toBeNull();
  });
});
