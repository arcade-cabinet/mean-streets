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
  side: 'A' | 'B',
): PlayerState {
  const shuffled = rng.shuffle(deck.map((c) => ({ ...c })));
  const turfs = Array.from({ length: config.turfCount }, () => createTurf());

  // v0.2 handless model: both sides act in parallel each turn; both
  // receive turn-1 action budgets on spawn. No opening hand — players
  // draw via the `draw` action into `pending`.
  return {
    turfs,
    deck: shuffled,
    discard: [],
    toughsInPlay: 0,
    actionsRemaining: actionsForTurn(config, 1, side),
    pending: null,
    queued: [],
    turnEnded: false,
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
  const firstPlayer: 'A' | 'B' = 'A';
  const playerA = initPlayerState(config, playerADeck, rng, 'A');
  const playerB = initPlayerState(config, playerBDeck, rng, 'B');

  const world = createWorld();

  // Turn numbering is 1-based. ActionBudget mirrors player A (the local
  // human seat). In the handless model both players have live budgets,
  // so UI reads its own side through `useActionBudget` / sim state.
  const initialTurn = 1;
  const initialBudget = playerA.actionsRemaining;

  const initialGameState = {
    config,
    players: { A: playerA, B: playerB },
    firstPlayer,
    turnNumber: initialTurn,
    phase: 'action' as const,
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
      turnNumber: initialTurn,
    }),
    ScreenTrait({ current: 'menu' }),
  );

  return world;
}
