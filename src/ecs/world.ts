/**
 * Koota world factory — creates and initializes game ECS world.
 * Wraps the sim engine's initialization logic.
 */

import { createWorld } from 'koota';
import type { World } from 'koota';
import type { TurfGameConfig, PlayerState, CrewCard, ModifierCard } from '../sim/turf/types';
import { DEFAULT_TURF_CONFIG } from '../sim/turf/types';
import { createRng, randomSeed } from '../sim/cards/rng';
import { generateAllCards } from '../sim/cards/generator';
import { generateWeapons, generateDrugs, generateCash } from '../sim/turf/generators';
import { createBoard } from '../sim/turf/board';
import { emptyMetrics } from '../sim/turf/environment';
import { GameState, PlayerA, PlayerB, ActionBudget, ScreenTrait } from './traits';

function buildDeck(
  crewPool: CrewCard[],
  rng: ReturnType<typeof createRng>,
): { crew: CrewCard[]; modifiers: ModifierCard[] } {
  const weaponPool = generateWeapons(rng);
  const drugPool = generateDrugs(rng);
  const cashPool = generateCash();

  const crew = rng.shuffle([...crewPool]).slice(0, 25);
  const weapons = rng.shuffle(weaponPool.filter(w => w.unlocked)).slice(0, 8);
  const drugs = rng.shuffle(drugPool.filter(d => d.unlocked)).slice(0, 8);
  const cash = rng.shuffle([...cashPool]).slice(0, 9);
  const modifiers = rng.shuffle([...weapons, ...drugs, ...cash] as ModifierCard[]);
  return { crew, modifiers };
}

function initPlayerState(
  side: 'A' | 'B',
  config: TurfGameConfig,
  deck: { crew: CrewCard[]; modifiers: ModifierCard[] },
  rng: ReturnType<typeof createRng>,
): PlayerState {
  const crewDeck = rng.shuffle(deck.crew.map(c => ({ ...c })));
  const modifierDeck = rng.shuffle(deck.modifiers.map(m => ({ ...m })) as ModifierCard[]);

  return {
    board: createBoard(side, config.positionCount, config.reserveCount),
    crewDraw: crewDeck.slice(3),
    modifierDraw: modifierDeck.slice(3),
    hand: {
      crew: crewDeck.slice(0, 3),
      modifiers: modifierDeck.slice(0, 3) as ModifierCard[],
    },
    discard: [],
    positionsSeized: 0,
  };
}

/** Create a Koota world populated with initial game state. */
export function createGameWorld(
  config: TurfGameConfig = DEFAULT_TURF_CONFIG,
  seed?: number,
  playerDeck?: { crew: CrewCard[]; modifiers: ModifierCard[] },
): World {
  const gameSeed = seed ?? randomSeed();
  const rng = createRng(gameSeed);

  const allCards = generateAllCards(gameSeed, 25);
  const crewPool: CrewCard[] = allCards
    .filter(c => c.unlocked)
    .map(c => ({
      type: 'crew' as const,
      id: c.id,
      displayName: c.displayName,
      archetype: c.archetype,
      affiliation: c.affiliation,
      power: c.power,
      resistance: c.resistance,
      abilityText: c.abilityText,
      unlocked: c.unlocked,
      locked: c.locked,
    }));

  const defaultDeck = buildDeck(crewPool, rng);
  const playerADeck = playerDeck ?? defaultDeck;
  const playerBDeck = buildDeck(crewPool, rng);
  const playerA = initPlayerState('A', config, playerADeck, rng);
  const playerB = initPlayerState('B', config, playerBDeck, rng);

  const world = createWorld();

  const initialGameState = {
    config,
    players: { A: playerA, B: playerB },
    turnSide: 'A' as const,
    firstPlayer: 'A' as const,
    turnNumber: 0,
    phase: 'buildup' as const,
    buildupTurns: { A: 0, B: 0 },
    hasStruck: { A: false, B: false },
    aiState: { A: 'BUILDING', B: 'BUILDING' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: {
      A: { lastGoal: null, lastActionKind: null, consecutivePasses: 0, failedPlans: 0, blockedLanes: {}, pressuredLanes: {}, laneRoles: {}, focusLane: null, focusRole: null },
      B: { lastGoal: null, lastActionKind: null, consecutivePasses: 0, failedPlans: 0, blockedLanes: {}, pressuredLanes: {}, laneRoles: {}, focusLane: null, focusRole: null },
    },
    plannerTrace: [],
    policySamples: [],
    rng,
    seed: gameSeed,
    winner: null,
    endReason: null,
    metrics: emptyMetrics(),
  };

  world.spawn(
    GameState(initialGameState),
    PlayerA(playerA),
    PlayerB(playerB),
    ActionBudget({ remaining: config.actionsPerRound, total: config.actionsPerRound }),
    ScreenTrait({ current: 'menu' }),
  );

  return world;
}
