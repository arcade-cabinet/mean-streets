/**
 * Turf war game loop with buildup phase.
 *
 * Both players build up before combat. Either can strike at any time.
 * The moment someone strikes, buildup ends for both.
 * Win by seizing all 5 opponent positions.
 */

import type {
  TurfGameState, TurfGameConfig, TurfGameResult,
  TurfMetrics, PlayerState, CrewCard,
} from './types';
import { DEFAULT_TURF_CONFIG } from './types';
import { createRng, randomSeed } from '../cards/rng';
import { generateAllCards } from '../cards/generator';
import { generateProducts, generateCash, generateWeapons } from './generators';
import {
  createBoard, findEmptyActive, placeCrew, stackProduct,
  stackCash, armCrew, seizedCount, findPushReady,
  findFundedReady, findDirectReady, positionPower,
  seizePosition,
} from './board';
import {
  resolveDirectAttack, resolveFundedAttack, resolvePushedAttack,
  canPrecisionAttack,
} from './attacks';

function emptyMetrics(): TurfMetrics {
  return {
    turns: 0, directAttacks: 0, fundedAttacks: 0, pushedAttacks: 0,
    kills: 0, flips: 0, seizures: 0, busts: 0, weaponsDrawn: 0,
    productPlayed: 0, cashPlayed: 0, crewPlaced: 0,
    positionsReclaimed: 0, dieRolls: 0, passes: 0,
    buildupTurnsA: 0, buildupTurnsB: 0, firstStrike: null,
  };
}

function initPlayer(
  side: 'A' | 'B',
  config: TurfGameConfig,
  crewPool: CrewCard[],
  rng: ReturnType<typeof createRng>,
  isSecond: boolean,
): PlayerState {
  const shuffledCrew = rng.shuffle([...crewPool]);
  const crewDeck = shuffledCrew.slice(0, 15);
  const products = generateProducts(rng);
  const productDeck = rng.shuffle([...products]).slice(0, 8);
  const { cards: cashCards } = generateCash();
  const cashDeck = rng.shuffle([...cashCards]).slice(0, 10);
  const weapons = generateWeapons();
  const weaponDeck = rng.shuffle([...weapons]).slice(0, 8);

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
  const allCards = generateAllCards(seed, 100);
  const crewPool: CrewCard[] = allCards.map(c => ({
    type: 'crew' as const, id: c.id, displayName: c.displayName,
    archetype: c.archetype, affiliation: c.affiliation,
    power: c.power, abilityText: c.abilityText,
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
    phase: 'buildup',
    buildupTurns: { A: 0, B: 0 },
    hasStruck: { A: false, B: false },
    rng, seed,
    winner: null, endReason: null,
    metrics: emptyMetrics(),
  };
}

// ── Draw Phase ───────────────────────────────────────────────

function drawPhase(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];
  if (p.crewDraw.length > 0 && p.hand.crew.length < 5) {
    p.hand.crew.push(p.crewDraw.pop()!);
  }
  if (p.cashDraw.length > 0 && p.hand.cash.length < 5) {
    p.hand.cash.push(p.cashDraw.pop()!);
  }
  const held = p.board.active.filter(pos => pos.crew && !pos.seized).length;
  if (held >= state.config.productPerPositions && p.productDraw.length > 0) {
    p.hand.product.push(p.productDraw.pop()!);
  }
}

// ── AI: Strike Timing Decision ───────────────────────────────

/**
 * During buildup, AI decides whether to keep building or strike.
 * Factors: crew placed, weapons available, opponent's visible buildup,
 * archetype composition (aggressive archetypes = lower patience).
 */
function shouldStrike(state: TurfGameState, side: 'A' | 'B'): boolean {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const buildTurns = state.buildupTurns[side];

  // Count our active crew
  const ourCrew = p.board.active.filter(pos => pos.crew).length;
  // Count opponent's visible crew
  const theirCrew = opp.board.active.filter(pos => pos.crew).length;

  // Aggressive archetypes lower patience
  const aggroCount = p.board.active
    .filter(pos => pos.crew && ['bruiser', 'enforcer', 'arsonist', 'shark'].includes(pos.crew.archetype))
    .length;

  // Base patience: 3-7 turns depending on hand composition
  const basePat = 5;
  const patience = Math.max(2, basePat - aggroCount + (p.hand.product.length > 0 ? 1 : 0));

  // Strike if:
  // 1. We've built enough (past patience threshold)
  if (buildTurns >= patience) return true;
  // 2. We have a significant crew advantage
  if (ourCrew >= 3 && ourCrew > theirCrew + 1) return true;
  // 3. We have a funded/push stack ready
  if (findPushReady(p.board).length > 0) return true;
  if (findFundedReady(p.board).length > 0 && buildTurns >= 3) return true;
  // 4. We have 4+ crew and at least one weapon
  if (ourCrew >= 4 && p.board.active.some(pos => pos.weapon)) return true;
  // 5. Nothing left to build
  if (p.hand.crew.length === 0 && p.hand.product.length === 0 && p.hand.cash.length === 0) return true;

  return false;
}

// ── AI: Buildup Actions ──────────────────────────────────────

function aiBuildupTurn(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];
  const m = state.metrics;

  // Place crew on empty positions
  if (p.hand.crew.length > 0) {
    const emptyIdx = findEmptyActive(p.board);
    if (emptyIdx >= 0) {
      placeCrew(p.board, emptyIdx, p.hand.crew.pop()!);
      m.crewPlaced++;
      return;
    }
  }

  // Stack product on crew
  if (p.hand.product.length > 0) {
    const target = p.board.active.findIndex(pos => pos.crew && !pos.product);
    if (target >= 0) {
      stackProduct(p.board, target, p.hand.product.pop()!);
      m.productPlayed++;
      return;
    }
  }

  // Stack cash on crew
  if (p.hand.cash.length > 0) {
    const target = p.board.active.findIndex(pos => pos.crew && !pos.cash);
    if (target >= 0) {
      stackCash(p.board, target, p.hand.cash.pop()!);
      m.cashPlayed++;
      return;
    }
  }

  // Arm with weapons
  if (p.hand.weapon.length > 0) {
    const target = p.board.active.findIndex(pos => pos.crew && !pos.weapon);
    if (target >= 0) {
      armCrew(p.board, target, p.hand.weapon.pop()!);
      return;
    }
  }
}

// ── AI: Combat Actions ───────────────────────────────────────

function aiCombatTurn(state: TurfGameState, side: 'A' | 'B'): void {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const m = state.metrics;

  // Priority 1: Pushed attack
  const pushReady = findPushReady(p.board);
  if (pushReady.length > 0) {
    const atkIdx = pushReady[0];
    const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
    if (targetIdx >= 0) {
      m.pushedAttacks++;
      m.dieRolls++;
      const outcome = resolvePushedAttack(
        p.board.active[atkIdx], opp.board.active[targetIdx],
        opp.board.active, state.config, state.rng,
      );
      handleOutcome(state, side, outcome, opp, targetIdx);
      return;
    }
  }

  // Priority 2: Funded attack
  const fundedReady = findFundedReady(p.board);
  if (fundedReady.length > 0) {
    const atkIdx = fundedReady[0];
    const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
    if (targetIdx >= 0) {
      m.fundedAttacks++;
      m.dieRolls++;
      const outcome = resolveFundedAttack(
        p.board.active[atkIdx], opp.board.active[targetIdx],
        state.config, state.rng,
      );
      handleOutcome(state, side, outcome, opp, targetIdx);
      return;
    }
  }

  // Priority 3: Direct attack
  const directReady = findDirectReady(p.board);
  if (directReady.length > 0) {
    for (const atkIdx of directReady) {
      const atkPos = p.board.active[atkIdx];
      const targetIdx = opp.board.active.findIndex(pos =>
        pos.crew !== null &&
        canPrecisionAttack(positionPower(atkPos), pos.crew!.power,
          state.config.precisionMult, atkPos.crew!.archetype === 'bruiser'),
      );
      if (targetIdx >= 0) {
        m.directAttacks++;
        const outcome = resolveDirectAttack(atkPos, opp.board.active[targetIdx]);
        handleOutcome(state, side, outcome, opp, targetIdx);
        return;
      }
    }
  }

  // Priority 4: Build (even during combat)
  aiBuildupTurn(state, side);
}

function handleOutcome(
  state: TurfGameState,
  attackerSide: 'A' | 'B',
  outcome: ReturnType<typeof resolveDirectAttack>,
  opp: PlayerState,
  targetIdx: number,
): void {
  const p = state.players[attackerSide];
  const m = state.metrics;

  if (outcome.type === 'kill') {
    m.kills++;
    // Draw weapon on kill
    if (state.config.weaponOnKill && p.weaponDraw.length > 0) {
      p.hand.weapon.push(p.weaponDraw.pop()!);
      m.weaponsDrawn++;
    }
    // Seize the cleared position
    if (!opp.board.active[targetIdx].crew) {
      seizePosition(opp.board.active[targetIdx]);
      m.seizures++;
      p.positionsSeized++;
    }
  } else if (outcome.type === 'flip') {
    m.flips += outcome.gainedCards.length;
    for (const card of outcome.gainedCards) {
      if (card.type === 'crew') {
        const emptyIdx = findEmptyActive(p.board);
        if (emptyIdx >= 0) placeCrew(p.board, emptyIdx, card);
      }
    }
    if (!opp.board.active[targetIdx].crew) {
      seizePosition(opp.board.active[targetIdx]);
      m.seizures++;
      p.positionsSeized++;
    }
  } else if (outcome.type === 'busted' || outcome.type === 'seized') {
    m.busts++;
  }
}

// ── Win Check ────────────────────────────────────────────────

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

// ── Main Loop ────────────────────────────────────────────────

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

    // Draw phase (always happens)
    drawPhase(state, side);

    if (state.phase === 'buildup') {
      state.buildupTurns[side]++;

      // Check if this player wants to strike
      if (shouldStrike(state, side)) {
        state.hasStruck[side] = true;
        state.metrics.firstStrike = state.metrics.firstStrike ?? side;

        // If EITHER player has struck, combat begins
        if (state.hasStruck.A || state.hasStruck.B) {
          state.phase = 'combat';
          state.metrics.buildupTurnsA = state.buildupTurns.A;
          state.metrics.buildupTurnsB = state.buildupTurns.B;
        }

        // Execute the strike as a combat action
        aiCombatTurn(state, side);
      } else {
        // Still building
        aiBuildupTurn(state, side);
      }
    } else {
      // Combat phase
      aiCombatTurn(state, side);
    }

    if (checkWin(state)) break;
    state.turnSide = state.turnSide === 'A' ? 'B' : 'A';
  }

  if (!state.winner) {
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
