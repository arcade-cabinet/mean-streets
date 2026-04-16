import { describe, it, expect, beforeEach } from 'vitest';
import { createMatch, runTurn, isGameOver } from '../game';
import type { MatchState } from '../game';
import type { GameConfig, ToughCard } from '../types';
import { DEFAULT_GAME_CONFIG } from '../types';
import { resetTurfIdCounter } from '../board';

function tough(id: string, power = 5, resistance = 5): ToughCard {
  return {
    kind: 'tough', id, name: id, tagline: '', archetype: 'brawler',
    affiliation: 'freelance', power, resistance, rarity: 'common', abilities: [],
  };
}


function makeDeck(prefix: string, count = 10): ToughCard[] {
  return Array.from({ length: count }, (_, i) => tough(`${prefix}-t${i + 1}`));
}

describe('createMatch', () => {
  beforeEach(() => resetTurfIdCounter());

  it('creates a match with default config', () => {
    const match = createMatch();
    expect(match.turnCount).toBe(0);
    expect(match.game.winner).toBeNull();
    expect(match.game.phase).toBe('combat');
    expect(match.game.players.A.turfs).toHaveLength(DEFAULT_GAME_CONFIG.turfCount);
    expect(match.game.players.B.turfs).toHaveLength(DEFAULT_GAME_CONFIG.turfCount);
  });

  it('distributes decks to players', () => {
    const deckA = makeDeck('a', 8);
    const deckB = makeDeck('b', 6);
    const match = createMatch(DEFAULT_GAME_CONFIG, { deckA, deckB, seed: 42 });
    expect(match.game.players.A.deck).toHaveLength(8);
    expect(match.game.players.B.deck).toHaveLength(6);
    expect(match.game.players.A.hand).toHaveLength(0);
    expect(match.game.players.B.hand).toHaveLength(0);
  });

  it('accepts custom config', () => {
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG, turfCount: 2, actionsPerTurn: 5 };
    const match = createMatch(config);
    expect(match.game.players.A.turfs).toHaveLength(2);
    expect(match.game.config.actionsPerTurn).toBe(5);
  });

  it('is deterministic with same seed', () => {
    const deck = makeDeck('x', 10);
    const a = createMatch(DEFAULT_GAME_CONFIG, { deckA: [...deck], deckB: [...deck], seed: 99 });
    const b = createMatch(DEFAULT_GAME_CONFIG, { deckA: [...deck], deckB: [...deck], seed: 99 });
    expect(a.game.players.A.deck.map(c => c.id)).toEqual(b.game.players.A.deck.map(c => c.id));
  });

  it('produces a different shuffle for different seeds (seed actually drives order)', () => {
    // Regression pin: this catches a class of bugs where the seed is
    // silently ignored and the shuffle defaults to Math.random or a
    // fixed permutation. Without this, the same-seed determinism test
    // passes trivially on any two identical decks.
    const deck = makeDeck('x', 20);
    const a = createMatch(DEFAULT_GAME_CONFIG, { deckA: [...deck], deckB: [...deck], seed: 1 });
    const b = createMatch(DEFAULT_GAME_CONFIG, { deckA: [...deck], deckB: [...deck], seed: 99999 });
    const orderA = a.game.players.A.deck.map(c => c.id);
    const orderB = b.game.players.A.deck.map(c => c.id);
    expect(orderA).not.toEqual(orderB);
  });
});

describe('runTurn', () => {
  let match: MatchState;

  beforeEach(() => {
    resetTurfIdCounter();
    const deckA = makeDeck('a', 10);
    const deckB = makeDeck('b', 10);
    match = createMatch(DEFAULT_GAME_CONFIG, { deckA, deckB, seed: 42 });
  });

  it('draws one card at turn start', () => {
    expect(match.game.players.A.hand).toHaveLength(0);
    runTurn(match, [{ kind: 'end_turn', side: 'A' }]);
    expect(match.game.players.A.hand).toHaveLength(1);
    expect(match.game.players.A.deck).toHaveLength(9);
  });

  it('increments turn counters', () => {
    runTurn(match, [{ kind: 'end_turn', side: 'A' }]);
    expect(match.turnCount).toBe(1);
    expect(match.game.turnNumber).toBe(1);
    expect(match.game.metrics.turns).toBe(1);
  });

  it('draws for both sides on alternating turns', () => {
    runTurn(match, [{ kind: 'end_turn', side: 'A' }]);
    expect(match.game.players.A.hand).toHaveLength(1);
    runTurn(match, [{ kind: 'end_turn', side: 'B' }]);
    expect(match.game.players.B.hand).toHaveLength(1);
  });

  it('plays a tough onto a turf', () => {
    runTurn(match, [{ kind: 'end_turn', side: 'A' }]);
    const drawnCard = match.game.players.A.hand[0];
    expect(drawnCard).toBeDefined();
    expect(drawnCard.kind).toBe('tough');
    const id = drawnCard.id;
    runTurn(match, [{ kind: 'end_turn', side: 'B' }]);
    runTurn(match, [{ kind: 'play_card', side: 'A', turfIdx: 0, cardId: id }]);
    expect(match.game.players.A.turfs[0].stack).toHaveLength(1);
    expect(match.game.players.A.toughsInPlay).toBe(1);
  });

  it('alternates turn side', () => {
    expect(match.game.turnSide).toBe('A');
    runTurn(match, [{ kind: 'end_turn', side: 'A' }]);
    expect(match.game.turnSide).toBe('B');
    runTurn(match, [{ kind: 'end_turn', side: 'B' }]);
    expect(match.game.turnSide).toBe('A');
  });

  it('applies first-turn action budget', () => {
    runTurn(match, []);
    expect(match.game.turnNumber).toBe(1);
  });

  it('stops processing actions when budget runs out', () => {
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG, actionsPerTurn: 1, firstTurnActions: 1 };
    resetTurfIdCounter();
    const deck = [tough('t1'), tough('t2'), tough('t3')];
    const m = createMatch(config, { deckA: deck, deckB: [], seed: 1 });
    runTurn(m, [
      { kind: 'pass', side: 'A' },
      { kind: 'pass', side: 'A' },
      { kind: 'pass', side: 'A' },
    ]);
    expect(m.game.metrics.passes).toBe(1);
  });
});

describe('isGameOver', () => {
  beforeEach(() => resetTurfIdCounter());

  it('returns null when game is in progress', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, { seed: 1 });
    expect(isGameOver(match)).toBeNull();
  });

  it('detects winner when opponent has 0 turfs', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, { seed: 1 });
    match.game.players.B.turfs = [];
    expect(isGameOver(match)).toBe('A');
    expect(match.game.endReason).toBe('total_seizure');
  });

  it('detects timeout at maxTurns', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, { seed: 1, maxTurns: 5 });
    match.turnCount = 5;
    expect(isGameOver(match)).not.toBeNull();
    expect(match.game.endReason).toBe('timeout');
  });

  it('timeout favors player with more turfs', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, { seed: 1, maxTurns: 1 });
    match.turnCount = 1;
    match.game.players.A.turfs = match.game.players.A.turfs.slice(0, 3);
    match.game.players.B.turfs = match.game.players.B.turfs.slice(0, 1);
    expect(isGameOver(match)).toBe('A');
  });

  it('returns existing winner without re-evaluating', () => {
    const match = createMatch(DEFAULT_GAME_CONFIG, { seed: 1 });
    match.game.winner = 'B';
    match.game.endReason = 'total_seizure';
    expect(isGameOver(match)).toBe('B');
  });
});
