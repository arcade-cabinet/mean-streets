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

  const deck = buildDeck(crewPool, rng);
  const playerA = initPlayerState('A', config, deck, rng);
  const playerB = initPlayerState('B', config, deck, rng);

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
    rng,
    seed: gameSeed,
    winner: null,
    endReason: null,
    metrics: {
      turns: 0, directAttacks: 0, fundedAttacks: 0, pushedAttacks: 0,
      kills: 0, flips: 0, seizures: 0, busts: 0, weaponsDrawn: 0,
      productPlayed: 0, cashPlayed: 0, crewPlaced: 0,
      positionsReclaimed: 0, passes: 0,
      buildupRoundsA: 0, buildupRoundsB: 0, combatRounds: 0,
      totalActions: 0, firstStrike: null,
    },
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
