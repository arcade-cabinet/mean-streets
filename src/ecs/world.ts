import type { World } from 'koota';
import { createWorld } from 'koota';
import { loadStarterToughCards } from '../sim/cards/catalog';
import { createRng, randomSeed } from '../sim/cards/rng';
import { createTurf, resetTurfIdCounter } from '../sim/turf/board';
import { TURF_SIM_CONFIG } from '../sim/turf/ai/config';
import { actionsForTurn, emptyMetrics, emptyPlannerMemory } from '../sim/turf/environment';
import {
  generateCurrency,
  generateDrugs,
  generateWeapons,
} from '../sim/turf/generators';
import type {
  ToughCard,
  Card,
  PlayerState,
  GameConfig,
} from '../sim/turf/types';
import { DEFAULT_GAME_CONFIG } from '../sim/turf/types';
import {
  ActionBudget,
  GameState,
  PlayerA,
  PlayerB,
  ScreenTrait,
} from './traits';

function buildDeck(
  crewPool: ToughCard[],
  rng: ReturnType<typeof createRng>,
): Card[] {
  const sc = TURF_SIM_CONFIG.starterCollection;
  const weaponPool = generateWeapons(rng);
  const drugPool = generateDrugs(rng);
  const cashPool = generateCurrency();

  const crew = rng.shuffle([...crewPool]).slice(0, sc.deckToughs);
  const weapons = rng.shuffle([...weaponPool]).slice(0, sc.deckWeapons);
  const drugs = rng.shuffle([...drugPool]).slice(0, sc.deckDrugs);
  const cash = rng.shuffle([...cashPool]).slice(0, sc.deckCurrency);
  return rng.shuffle([...crew, ...weapons, ...drugs, ...cash]);
}

function initPlayerState(
  config: GameConfig,
  deck: Card[],
  rng: ReturnType<typeof createRng>,
): PlayerState {
  const shuffled = rng.shuffle(deck.map((c) => ({ ...c })));
  const turfs = Array.from({ length: config.turfCount }, () => createTurf());

  return {
    turfs,
    hand: shuffled.slice(0, TURF_SIM_CONFIG.starterCollection.openingHandSize),
    deck: shuffled.slice(TURF_SIM_CONFIG.starterCollection.openingHandSize),
    discard: [],
    toughsInPlay: 0,
    actionsRemaining: config.firstTurnActions,
  };
}

export function createGameWorld(
  config: GameConfig = DEFAULT_GAME_CONFIG,
  seed?: number,
  playerDeck?: Card[],
): World {
  const gameSeed = seed ?? randomSeed();
  const rng = createRng(gameSeed);
  resetTurfIdCounter();

  const crewPool = loadStarterToughCards(TURF_SIM_CONFIG.starterCollection.toughPoolSize);

  const defaultDeck = buildDeck(crewPool, rng);
  const playerADeck = playerDeck ?? defaultDeck;
  const playerBDeck = buildDeck(crewPool, rng);
  const playerA = initPlayerState(config, playerADeck, rng);
  const playerB = initPlayerState(config, playerBDeck, rng);

  const world = createWorld();

  const initialBudget = actionsForTurn(config, 0, 'A');

  const initialGameState = {
    config,
    players: { A: playerA, B: playerB },
    turnSide: 'A' as const,
    firstPlayer: 'A' as const,
    turnNumber: 0,
    phase: 'combat' as const,
    hasStruck: { A: false, B: false },
    aiState: { A: 'BUILDING', B: 'BUILDING' },
    aiTurnsInState: { A: 0, B: 0 },
    aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
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
    ActionBudget({
      remaining: initialBudget,
      total: initialBudget,
      turnNumber: 0,
    }),
    ScreenTrait({ current: 'menu' }),
  );

  return world;
}
