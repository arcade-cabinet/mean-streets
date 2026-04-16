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
    expect(match.game.phase).toBe('action');
    expect(match.game.players.A.turfs).toHaveLength(DEFAULT_GAME_CONFIG.turfCount);
    expect(match.game.players.B.turfs).toHaveLength(DEFAULT_GAME_CONFIG.turfCount);
  });

  it('distributes decks to players (no hand — v0.2 is handless)', () => {
    const deckA = makeDeck('a', 8);
    const deckB = makeDeck('b', 6);
    const match = createMatch(DEFAULT_GAME_CONFIG, { deckA, deckB, seed: 42 });
    expect(match.game.players.A.deck).toHaveLength(8);
    expect(match.game.players.B.deck).toHaveLength(6);
    // Pending slot starts empty; no hand array exists.
    expect(match.game.players.A.pending).toBeNull();
    expect(match.game.players.B.pending).toBeNull();
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

  it('produces a different shuffle for different seeds', () => {
    const deck = makeDeck('x', 20);
    const a = createMatch(DEFAULT_GAME_CONFIG, { deckA: [...deck], deckB: [...deck], seed: 1 });
    const b = createMatch(DEFAULT_GAME_CONFIG, { deckA: [...deck], deckB: [...deck], seed: 99999 });
    const orderA = a.game.players.A.deck.map(c => c.id);
    const orderB = b.game.players.A.deck.map(c => c.id);
    expect(orderA).not.toEqual(orderB);
  });
});

describe('runTurn (parallel-turn signature)', () => {
  let match: MatchState;

  beforeEach(() => {
    resetTurfIdCounter();
    const deckA = makeDeck('a', 10);
    const deckB = makeDeck('b', 10);
    match = createMatch(DEFAULT_GAME_CONFIG, { deckA, deckB, seed: 42 });
  });

  it('accepts actionsA and actionsB in the same call', () => {
    runTurn(
      match,
      [{ kind: 'end_turn', side: 'A' }],
      [{ kind: 'end_turn', side: 'B' }],
    );
    expect(match.turnCount).toBe(1);
  });

  it('executes a draw as a regular action', () => {
    runTurn(
      match,
      [{ kind: 'draw', side: 'A' }, { kind: 'end_turn', side: 'A' }],
      [{ kind: 'end_turn', side: 'B' }],
    );
    expect(match.game.players.A.deck).toHaveLength(9);
    // After resolve, pending should have been consumed by play_card or
    // discarded; since we just drew and ended, pending was left and
    // resolve phase discarded it.
    expect(match.game.players.A.pending).toBeNull();
  });

  it('plays a drawn tough onto a turf in the same turn', () => {
    const id = match.game.players.A.deck[0]?.id;
    expect(id).toBeDefined();
    runTurn(
      match,
      [
        { kind: 'draw', side: 'A' },
        { kind: 'play_card', side: 'A', turfIdx: 0, cardId: id! },
        { kind: 'end_turn', side: 'A' },
      ],
      [{ kind: 'end_turn', side: 'B' }],
    );
    expect(match.game.players.A.turfs.length).toBeGreaterThan(0);
    expect(match.game.players.A.turfs[0].stack).toHaveLength(1);
    expect(match.game.players.A.toughsInPlay).toBe(1);
  });

  it('applies first-turn action budget then advances turn number', () => {
    runTurn(match, [], []);
    // After one full turn, turnNumber has incremented past the opener.
    expect(match.game.turnNumber).toBeGreaterThanOrEqual(2);
  });

  it('stops processing draw actions when budget runs out', () => {
    // Draw costs 1 action; with budget=1 only the first draw runs before the
    // budget-guard in `applySide` halts further actions.
    const config: GameConfig = { ...DEFAULT_GAME_CONFIG, actionsPerTurn: 1, firstTurnActions: 1 };
    resetTurfIdCounter();
    const deck = [tough('t1'), tough('t2'), tough('t3')];
    const m = createMatch(config, { deckA: deck, deckB: [], seed: 1 });
    runTurn(
      m,
      [
        { kind: 'draw', side: 'A' },
        { kind: 'draw', side: 'A' },
        { kind: 'draw', side: 'A' },
      ],
      [],
    );
    // Exactly one draw consumed the single allotted action.
    expect(m.game.metrics.draws).toBe(1);
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
