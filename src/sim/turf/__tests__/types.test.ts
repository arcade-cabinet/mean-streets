import { describe, expect, it } from 'vitest';
import type {
  ToughCard,
  WeaponCard,
  DrugCard,
  CurrencyCard,
  Card,
  ModifierCard,
  Turf,
  PlayerState,
  GameConfig,
  TurfAction,
  TurfMetrics,
  DeckSnapshot,
  TurfGameResult,
} from '../types';
import { DEFAULT_GAME_CONFIG } from '../types';

describe('card type construction', () => {
  it('ToughCard uses kind:"tough" discriminant', () => {
    const card: ToughCard = {
      kind: 'tough', id: 'tough-1', name: 'Brick', tagline: 'Hard hitter',
      archetype: 'bruiser', affiliation: 'kings_row',
      power: 6, resistance: 6, rarity: 'common', abilities: [],
    };
    expect(card.kind).toBe('tough');
    expect(card.power).toBe(6);
    expect(card.abilities).toEqual([]);
  });

  it('WeaponCard uses kind:"weapon" discriminant', () => {
    const card: WeaponCard = {
      kind: 'weapon', id: 'w-1', name: 'Knife', category: 'bladed',
      power: 3, resistance: 1, rarity: 'rare', abilities: ['LACERATE'],
    };
    expect(card.kind).toBe('weapon');
    expect(card.category).toBe('bladed');
  });

  it('DrugCard uses kind:"drug" discriminant', () => {
    const card: DrugCard = {
      kind: 'drug', id: 'd-1', name: 'Stim', category: 'stimulant',
      power: 2, resistance: 1, rarity: 'common', abilities: [],
    };
    expect(card.kind).toBe('drug');
  });

  it('CurrencyCard uses kind:"currency" with denomination 100 or 1000', () => {
    const bill: CurrencyCard = {
      kind: 'currency', id: 'c-100', name: '$100', denomination: 100, rarity: 'common',
    };
    const stack: CurrencyCard = {
      kind: 'currency', id: 'c-1000', name: '$1000', denomination: 1000, rarity: 'rare',
    };
    expect(bill.denomination).toBe(100);
    expect(stack.denomination).toBe(1000);
  });
});

describe('Card union type', () => {
  it('discriminates on kind field', () => {
    const cards: Card[] = [
      { kind: 'tough', id: 't1', name: 'T', tagline: '', archetype: 'bruiser', affiliation: 'freelance', power: 5, resistance: 5, rarity: 'common', abilities: [] },
      { kind: 'weapon', id: 'w1', name: 'W', category: 'bladed', power: 3, resistance: 1, rarity: 'common', abilities: [] },
      { kind: 'drug', id: 'd1', name: 'D', category: 'stimulant', power: 2, resistance: 1, rarity: 'common', abilities: [] },
      { kind: 'currency', id: 'c1', name: 'C', denomination: 100, rarity: 'common' },
    ];
    const kinds = cards.map(c => c.kind);
    expect(kinds).toEqual(['tough', 'weapon', 'drug', 'currency']);
  });

  it('ModifierCard excludes tough', () => {
    const mod: ModifierCard = { kind: 'weapon', id: 'w1', name: 'W', category: 'bladed', power: 3, resistance: 1, rarity: 'common', abilities: [] };
    expect(mod.kind).not.toBe('tough');
  });
});

describe('Turf structure', () => {
  it('has an id, stack, and optional sickTopIdx', () => {
    const turf: Turf = { id: 'turf-1', stack: [] };
    expect(turf.stack).toEqual([]);
    expect(turf.sickTopIdx).toBeUndefined();
  });

  it('sickTopIdx can be a number or null', () => {
    const turf: Turf = { id: 'turf-1', stack: [], sickTopIdx: 2 };
    expect(turf.sickTopIdx).toBe(2);
    turf.sickTopIdx = null;
    expect(turf.sickTopIdx).toBeNull();
  });
});

describe('PlayerState structure', () => {
  it('has flat turfs/hand/deck/discard arrays', () => {
    const player: PlayerState = {
      turfs: [], hand: [], deck: [], discard: [],
      toughsInPlay: 0, actionsRemaining: 3,
    };
    expect(player.turfs).toEqual([]);
    expect(player.actionsRemaining).toBe(3);
  });
});

describe('DEFAULT_GAME_CONFIG', () => {
  it('provides a valid GameConfig', () => {
    const cfg: GameConfig = DEFAULT_GAME_CONFIG;
    expect(cfg.difficulty).toBeDefined();
    expect(cfg.turfCount).toBeGreaterThan(0);
    expect(cfg.actionsPerTurn).toBeGreaterThan(0);
    expect(cfg.firstTurnActions).toBeGreaterThan(0);
    expect(typeof cfg.suddenDeath).toBe('boolean');
  });

  it('medium difficulty defaults to 4 turfs', () => {
    expect(DEFAULT_GAME_CONFIG.difficulty).toBe('medium');
    expect(DEFAULT_GAME_CONFIG.turfCount).toBe(4);
  });
});

describe('TurfAction structure', () => {
  it('supports all v0.2 action kinds', () => {
    const kinds: TurfAction['kind'][] = [
      'play_card', 'direct_strike', 'pushed_strike',
      'funded_recruit', 'discard', 'end_turn', 'pass',
    ];
    expect(kinds).toHaveLength(7);
  });

  it('play_card includes side, turfIdx, cardId', () => {
    const action: TurfAction = { kind: 'play_card', side: 'A', turfIdx: 0, cardId: 'card-1' };
    expect(action.turfIdx).toBe(0);
    expect(action.cardId).toBe('card-1');
  });

  it('strike includes turfIdx and targetTurfIdx', () => {
    const action: TurfAction = { kind: 'direct_strike', side: 'A', turfIdx: 0, targetTurfIdx: 1 };
    expect(action.targetTurfIdx).toBe(1);
  });
});

describe('TurfMetrics', () => {
  it('initializes with all zero fields', () => {
    const m: TurfMetrics = {
      turns: 0, directStrikes: 0, pushedStrikes: 0, fundedRecruits: 0,
      kills: 0, spiked: 0, seizures: 0, busts: 0,
      cardsPlayed: 0, cardsDiscarded: 0, toughsPlayed: 0, modifiersPlayed: 0,
      passes: 0, goalSwitches: 0, failedPlans: 0, stallTurns: 0,
      deadHandTurns: 0, policyGuidedActions: 0, totalActions: 0, firstStrike: null,
    };
    const numericValues = Object.entries(m)
      .filter(([k]) => k !== 'firstStrike')
      .map(([, v]) => v);
    expect(numericValues.every(v => v === 0)).toBe(true);
    expect(m.firstStrike).toBeNull();
  });
});

describe('TurfGameResult', () => {
  it('has v0.2 deck snapshot shape (flat cardIds)', () => {
    const snapshot: DeckSnapshot = { cardIds: ['t1', 'w1', 'd1'] };
    expect(snapshot.cardIds).toHaveLength(3);
  });

  it('finalState has turfsA and turfsB counts', () => {
    const result: TurfGameResult = {
      winner: 'A', endReason: 'total_seizure', firstPlayer: 'A',
      turnCount: 10, seed: 42,
      metrics: {
        turns: 10, directStrikes: 3, pushedStrikes: 1, fundedRecruits: 0,
        kills: 3, spiked: 1, seizures: 2, busts: 0,
        cardsPlayed: 8, cardsDiscarded: 2, toughsPlayed: 4, modifiersPlayed: 4,
        passes: 1, goalSwitches: 0, failedPlans: 0, stallTurns: 0,
        deadHandTurns: 0, policyGuidedActions: 0, totalActions: 15, firstStrike: 'A',
      },
      plannerTrace: [],
      finalState: { turfsA: 4, turfsB: 0 },
      decks: { A: { cardIds: ['t1'] }, B: { cardIds: ['t2'] } },
    };
    expect(result.finalState.turfsA).toBe(4);
    expect(result.finalState.turfsB).toBe(0);
  });
});
