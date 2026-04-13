import { describe, expect, it } from 'vitest';
import { createBoard, placeCrew, placeModifier } from '../board';
import {
  chooseBestDirectAttack,
  chooseBestFundedAttack,
  chooseBestModifierPlacement,
  chooseBestPushedAttack,
} from '../ai-policy';
import type { CashCard, CrewCard, PlayerState, ProductCard, WeaponCard } from '../types';
import { DEFAULT_TURF_CONFIG } from '../types';

function crew(id: string, power: number, resistance: number): CrewCard {
  return {
    type: 'crew',
    id,
    displayName: id,
    archetype: 'bruiser',
    affiliation: 'freelance',
    power,
    resistance,
    abilityText: '',
    unlocked: true,
    locked: false,
  };
}

function weapon(id: string, bonus: number, category = 'bladed'): WeaponCard {
  return {
    type: 'weapon',
    id,
    name: id,
    category,
    bonus,
    offenseAbility: '',
    offenseAbilityText: '',
    defenseAbility: '',
    defenseAbilityText: '',
    unlocked: true,
    locked: false,
  };
}

function drug(id: string, potency: number, category = 'stimulant'): ProductCard {
  return {
    type: 'product',
    id,
    name: id,
    category,
    potency,
    offenseAbility: '',
    offenseAbilityText: '',
    defenseAbility: '',
    defenseAbilityText: '',
    unlocked: true,
    locked: false,
  };
}

function cash(id: string, denomination: 100 | 1000): CashCard {
  return { type: 'cash', id, denomination };
}

function playerState(): PlayerState {
  return {
    board: createBoard('A', 5, 5),
    crewDraw: [],
    modifierDraw: [],
    hand: { crew: [], modifiers: [] },
    discard: [],
    positionsSeized: 0,
  };
}

describe('ai-policy', () => {
  it('prefers the more favorable direct attack target', () => {
    const player = playerState();
    const opponent = playerState();
    placeCrew(player.board, 0, crew('attacker', 7, 5));
    player.board.active[0].turnsActive = 1;
    placeModifier(player.board, 0, weapon('blade', 2), 'offense');

    placeCrew(opponent.board, 0, crew('tank', 5, 9));
    placeCrew(opponent.board, 1, crew('glass', 4, 2));

    const choice = chooseBestDirectAttack(player, opponent, DEFAULT_TURF_CONFIG);
    expect(choice?.targetIdx).toBe(1);
  });

  it('prefers the more efficient funded attack target', () => {
    const player = playerState();
    const opponent = playerState();
    placeCrew(player.board, 0, crew('attacker', 5, 5));
    player.board.active[0].turnsActive = 1;
    placeModifier(player.board, 0, cash('cash-left', 1000), 'offense');

    placeCrew(opponent.board, 0, crew('costly', 4, 8));
    placeModifier(opponent.board, 0, cash('def-cash', 1000), 'defense');
    placeCrew(opponent.board, 1, crew('cheap', 4, 2));

    const choice = chooseBestFundedAttack(player, opponent);
    expect(choice?.targetIdx).toBe(1);
  });

  it('prefers a pushed attack with better payoff', () => {
    const player = playerState();
    const opponent = playerState();
    placeCrew(player.board, 0, crew('attacker', 6, 5));
    player.board.active[0].turnsActive = 1;
    placeModifier(player.board, 0, drug('rush', 3, 'steroid'), 'offense');
    placeModifier(player.board, 0, cash('stack', 1000), 'offense');

    placeCrew(opponent.board, 0, crew('hard', 5, 9));
    placeCrew(opponent.board, 1, crew('soft', 3, 3));
    placeCrew(opponent.board, 2, crew('adjacent', 3, 3));

    const choice = chooseBestPushedAttack(player, opponent, DEFAULT_TURF_CONFIG);
    expect(choice?.targetIdx).toBe(1);
  });

  it('places defensive cash on the tougher position', () => {
    const player = playerState();
    placeCrew(player.board, 0, crew('fragile', 5, 2));
    placeCrew(player.board, 1, crew('tough', 5, 8));

    const choice = chooseBestModifierPlacement(player, cash('stack', 1000));
    expect(choice).toEqual(expect.objectContaining({ index: 1, slot: 'defense' }));
  });
});
