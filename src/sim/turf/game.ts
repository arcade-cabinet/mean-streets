/**
 * Turf war game loop.
 * 5v5 position seizure with 4 deck types.
 */

import type {
  TurfGameState, TurfGameConfig, TurfGameResult,
  TurfMetrics, PlayerState, CrewCard,
} from './types';
import { createRng, randomSeed } from '../cards/rng';
import { generateAllCards } from '../cards/generator';
import { generateProducts, generateCash, generateWeapons } from './generators';
import {
  createBoard, findEmptyActive, placeCrew, stackProduct,
  stackCash, armCrew, seizedCount, findPushReady,
  findFundedReady, findDirectReady, positionPower, clearPosition,
  seizePosition,
} from './board';
import {
  resolveDirectAttack, resolveFundedAttack, resolvePushedAttack,
  canPrecisionAttack,
} from './attacks';
import { DEFAULT_TURF_CONFIG } from './types';

function emptyMetrics(): TurfMetrics {
  return {
    turns: 0, directAttacks: 0, fundedAttacks: 0, pushedAttacks: 0,
    kills: 0, flips: 0, seizures: 0, busts: 0, weaponsDrawn: 0,
    productPlayed: 0, cashPlayed: 0, crewPlaced: 0,
    positionsReclaimed: 0, dieRolls: 0, passes: 0,
  };
}

/** Build random decks for both players from shared pools. */
function initPlayer(
  side: 'A' | 'B',
  config: TurfGameConfig,
  crewPool: CrewCard[],
  rng: ReturnType<typeof createRng>,
  isSecond = false,
): PlayerState {
  const shuffledCrew = rng.shuffle([...crewPool]);
  const crewDeck = shuffledCrew.slice(0, 15);

  const products = generateProducts(rng);
  const productDeck = rng.shuffle([...products]).slice(0, 8);

  const { cards: cashCards } = generateCash();
  const cashDeck = rng.shuffle([...cashCards]).slice(0, 10);

  const weapons = generateWeapons();
  const weaponDeck = rng.shuffle([...weapons]).slice(0, 8);

  // Second player gets +1 crew to compensate initiative
  const crewCount = isSecond ? 4 : 3;
  const hand = {
    crew: crewDeck.splice(0, crewCount),
    product: productDeck.splice(0, 1),
    cash: cashDeck.splice(0, 2),
    weapon: [] as typeof weapons,
  };

  return {
    board: createBoard(side, config.positionCount, config.reserveCount),
    crewDraw: crewDeck,
    productDraw: productDeck,
    cashDraw: cashDeck,
    weaponDraw: weaponDeck,
    hand,
    discard: [],
    positionsSeized: 0,
  };
}

function createGame(config: TurfGameConfig, seed: number): TurfGameState {
  const rng = createRng(seed);
  const allCards = generateAllCards(seed, 100); // all unlocked for sim
  const crewPool: CrewCard[] = allCards.map(c => ({
    type: 'crew' as const,
    id: c.id,
    displayName: c.displayName,
    archetype: c.archetype,
    affiliation: c.affiliation,
    power: c.power,
    abilityText: c.abilityText,
  }));

  const first: 'A' | 'B' = rng.next() < 0.5 ? 'A' : 'B';

  return {
    config,
    players: {
      A: initPlayer('A', config, crewPool, rng, first !== 'A'),
      B: initPlayer('B', config, crewPool, rng, first !== 'B'),
    },
    turnSide: first,
    firstPlayer: first,
    turnNumber: 0,
    rng,
    seed,
    winner: null,
    endReason: null,
    metrics: emptyMetrics(),
  };
}

/** Draw phase: crew + cash per turn, product per positions held. */
function drawPhase(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];

  // Draw 1 crew
  if (p.crewDraw.length > 0 && p.hand.crew.length < 5) {
    p.hand.crew.push(p.crewDraw.pop()!);
  }

  // Draw 1 cash
  if (p.cashDraw.length > 0 && p.hand.cash.length < 5) {
    p.hand.cash.push(p.cashDraw.pop()!);
  }

  // Draw product based on positions held
  const held = p.board.active.filter(pos => pos.crew && !pos.seized).length;
  if (held >= state.config.productPerPositions && p.productDraw.length > 0) {
    p.hand.product.push(p.productDraw.pop()!);
  }
}

/** AI decision making. */
function aiTurn(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const m = state.metrics;

  // Priority 1: Push attack if ready (crew + product + cash)
  const pushReady = findPushReady(p.board);
  if (pushReady.length > 0) {
    const atkIdx = pushReady[0];
    const atkPos = p.board.active[atkIdx];
    // Find target: occupied position on opponent's active board
    const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
    if (targetIdx >= 0) {
      m.pushedAttacks++;
      m.dieRolls++;
      const outcome = resolvePushedAttack(
        atkPos, opp.board.active[targetIdx], opp.board.active,
        state.config, state.rng,
      );
      if (outcome.type === 'flip') {
        m.flips += outcome.gainedCards.length;
        // Place flipped crew on our empty positions
        for (const card of outcome.gainedCards) {
          if (card.type === 'crew') {
            const emptyIdx = findEmptyActive(p.board);
            if (emptyIdx >= 0) placeCrew(p.board, emptyIdx, card);
          }
        }
        // Try to seize the cleared position
        if (!opp.board.active[targetIdx].crew) {
          seizePosition(opp.board.active[targetIdx]);
          m.seizures++;
          p.positionsSeized++;
        }
      } else if (outcome.type === 'seized') {
        m.busts++;
      }
      return;
    }
  }

  // Priority 2: Funded attack if ready
  const fundedReady = findFundedReady(p.board);
  if (fundedReady.length > 0) {
    const atkIdx = fundedReady[0];
    const atkPos = p.board.active[atkIdx];
    const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
    if (targetIdx >= 0) {
      m.fundedAttacks++;
      m.dieRolls++;
      const outcome = resolveFundedAttack(
        atkPos, opp.board.active[targetIdx], state.config, state.rng,
      );
      if (outcome.type === 'flip') {
        m.flips++;
        for (const card of outcome.gainedCards) {
          if (card.type === 'crew') {
            const emptyIdx = findEmptyActive(p.board);
            if (emptyIdx >= 0) placeCrew(p.board, emptyIdx, card);
          }
        }
      } else if (outcome.type === 'busted') {
        m.busts++;
      }
      return;
    }
  }

  // Priority 3: Direct attack
  const directReady = findDirectReady(p.board);
  if (directReady.length > 0) {
    const atkIdx = directReady[0];
    const atkPos = p.board.active[atkIdx];
    const targetIdx = opp.board.active.findIndex(pos =>
      pos.crew !== null &&
      canPrecisionAttack(
        positionPower(atkPos), pos.crew!.power,
        state.config.precisionMult,
        atkPos.crew!.archetype === 'bruiser',
      ),
    );
    if (targetIdx >= 0) {
      m.directAttacks++;
      const outcome = resolveDirectAttack(atkPos, opp.board.active[targetIdx]);
      if (outcome.type === 'kill') {
        m.kills++;
        // Draw weapon on kill
        if (state.config.weaponOnKill && p.weaponDraw.length > 0) {
          p.hand.weapon.push(p.weaponDraw.pop()!);
          m.weaponsDrawn++;
        }
        // Try to seize cleared position
        if (!opp.board.active[targetIdx].crew) {
          seizePosition(opp.board.active[targetIdx]);
          m.seizures++;
          p.positionsSeized++;
        }
      }
      // Attacker crew stays — direct attacks don't consume crew
      return;
    }
  }

  // Priority 4: Build up — stack product or cash on crew
  if (p.hand.product.length > 0) {
    const crewPositions = p.board.active
      .map((pos, i) => ({ pos, i }))
      .filter(({ pos }) => pos.crew && !pos.product && !pos.seized);
    if (crewPositions.length > 0) {
      const target = crewPositions[0];
      stackProduct(p.board, target.i, p.hand.product.pop()!);
      m.productPlayed++;
      return;
    }
  }

  if (p.hand.cash.length > 0) {
    const crewPositions = p.board.active
      .map((pos, i) => ({ pos, i }))
      .filter(({ pos }) => pos.crew && !pos.cash && !pos.seized);
    if (crewPositions.length > 0) {
      const target = crewPositions[0];
      stackCash(p.board, target.i, p.hand.cash.pop()!);
      m.cashPlayed++;
      return;
    }
  }

  // Priority 5: Arm crew with weapons
  if (p.hand.weapon.length > 0) {
    const unarmed = p.board.active
      .map((pos, i) => ({ pos, i }))
      .filter(({ pos }) => pos.crew && !pos.weapon && !pos.seized);
    if (unarmed.length > 0) {
      armCrew(p.board, unarmed[0].i, p.hand.weapon.pop()!);
      return;
    }
  }

  // Priority 6: Place crew on empty positions
  if (p.hand.crew.length > 0) {
    const emptyIdx = findEmptyActive(p.board);
    if (emptyIdx >= 0) {
      placeCrew(p.board, emptyIdx, p.hand.crew.pop()!);
      m.crewPlaced++;
      return;
    }
    // Try to reclaim seized positions
    const seizedIdx = p.board.active.findIndex(pos => pos.seized);
    if (seizedIdx >= 0) {
      const crew = p.hand.crew.pop()!;
      p.board.active[seizedIdx].seized = false;
      p.board.active[seizedIdx].crew = crew;
      opp.positionsSeized--;
      m.positionsReclaimed++;
      m.crewPlaced++;
      return;
    }
  }

  m.passes++;
}

/** Check win condition: all 5 opponent positions seized. */
function checkWin(state: TurfGameState): boolean {
  for (const side of ['A', 'B'] as const) {
    const opp = side === 'A' ? 'B' : 'A';
    if (seizedCount(state.players[opp].board) >= state.config.positionCount) {
      state.winner = side;
      state.endReason = 'total_seizure';
      return true;
    }
  }
  return false;
}

export function playTurfGame(
  config: TurfGameConfig = DEFAULT_TURF_CONFIG,
  seed?: number,
): TurfGameResult {
  const gameSeed = seed ?? randomSeed();
  const state = createGame(config, gameSeed);

  while (!state.winner && state.turnNumber < config.maxTurns) {
    state.turnNumber++;
    state.metrics.turns++;

    const side = state.turnSide;
    drawPhase(state, side);
    aiTurn(state, side);

    if (checkWin(state)) break;

    state.turnSide = state.turnSide === 'A' ? 'B' : 'A';
  }

  if (!state.winner) {
    // Tie-break: whoever seized more positions
    const seizedA = state.players.A.positionsSeized;
    const seizedB = state.players.B.positionsSeized;
    state.winner = seizedA >= seizedB ? 'A' : 'B';
    state.endReason = 'timeout';
  }

  return {
    winner: state.winner,
    endReason: state.endReason!,
    firstPlayer: state.firstPlayer,
    turnCount: state.turnNumber,
    metrics: state.metrics,
    seed: gameSeed,
    finalState: {
      seizedA: seizedCount(state.players.A.board),
      seizedB: seizedCount(state.players.B.board),
    },
  };
}
