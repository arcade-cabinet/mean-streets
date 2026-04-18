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
  TurfGameState,
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
  // v0.3 single-lane: turfs[0] is the active engagement; turfs[1..] are
  // reserves in queue order. `createTurf({ isActive, reserveIndex })`
  // stamps those flags so renderers can distinguish without scanning.
  const turfs = Array.from({ length: config.turfCount }, (_, i) =>
    createTurf({ isActive: i === 0, reserveIndex: i }),
  );

  // Both sides act in parallel; both receive turn-1 action budgets on
  // spawn. No opening hand — players draw via `draw` into `pending`.
  return {
    turfs,
    deck: shuffled,
    toughsInPlay: 0,
    actionsRemaining: actionsForTurn(config, 1, side),
    pending: null,
    queued: [],
    turnEnded: false,
  };
}

/**
 * Ten canonical mythic card ids matching the authored cards in
 * config/raw/cards/mythics/ (mythic-01 … mythic-10). Kept in sync with
 * `sim/turf/game.ts::loadMythicIds`.
 */
function allMythicIds(): string[] {
  return [
    'mythic-01',
    'mythic-02',
    'mythic-03',
    'mythic-04',
    'mythic-05',
    'mythic-06',
    'mythic-07',
    'mythic-08',
    'mythic-09',
    'mythic-10',
  ];
}

export function createGameWorld(
  config: GameConfig = DEFAULT_GAME_CONFIG,
  seed?: number,
  playerDeck?: Card[],
  ownedMythics: { A: string[]; B: string[] } = { A: [], B: [] },
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

  // v0.3 adds shared-resource state: heat, black market, voluntary
  // holding, lockup (N-turn seizure custody), a ten-card mythic pool,
  // and war statistics. Sim is the source of truth; ECS traits just
  // expose these fields to React hooks without duplicating them.
  const initialGameState: TurfGameState = {
    config,
    players: { A: playerA, B: playerB },
    firstPlayer,
    turnNumber: initialTurn,
    phase: 'action',
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
    heat: 0,
    blackMarket: [],
    holding: { A: [], B: [] },
    lockup: { A: [], B: [] },
    mythicPool: (() => {
      const aOwned = new Set(ownedMythics.A);
      const bOwned = new Set(ownedMythics.B);
      return allMythicIds().filter((id) => !aOwned.has(id) && !bOwned.has(id));
    })(),
    mythicAssignments: (() => {
      const assignments: Record<string, 'A' | 'B'> = {};
      for (const id of ownedMythics.A) assignments[id] = 'A';
      for (const id of ownedMythics.B) assignments[id] = 'B';
      return assignments;
    })(),
    warStats: { seizures: [] },
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
