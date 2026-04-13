/**
 * Turf war game loop with buildup phase.
 *
 * Both players build up before combat. Either can strike at any time.
 * The moment someone strikes, buildup ends for both.
 * Win by seizing all 5 opponent positions.
 */

import type {
  TurfGameState, TurfGameConfig, TurfGameResult,
  TurfMetrics, PlayerState, CrewCard, ProductCard, CashCard, WeaponCard,
} from './types';
import { DEFAULT_TURF_CONFIG } from './types';
import { createRng, randomSeed } from '../cards/rng';
import { generateAllCards } from '../cards/generator';
import { generateProducts, generateCash, generateWeapons } from './generators';
import {
  createBoard, findEmptyActive, placeCrew, stackProduct,
  stackCash, armCrew, seizedCount, findPushReady,
  findFundedReady, findDirectReady, findNeedsStacking,
  positionPower, positionDefense, seizePosition, tickPositions,
} from './board';
import {
  resolveDirectAttack, resolveFundedAttack, resolvePushedAttack,
  canPrecisionAttack,
} from './attacks';
import { evaluateFuzzy } from './ai-fuzzy';
import { resolveState, getStatePriorities, type AiState } from './ai-states';

function emptyMetrics(): TurfMetrics {
  return {
    turns: 0, directAttacks: 0, fundedAttacks: 0, pushedAttacks: 0,
    kills: 0, flips: 0, seizures: 0, busts: 0, weaponsDrawn: 0,
    productPlayed: 0, cashPlayed: 0, crewPlaced: 0,
    positionsReclaimed: 0, dieRolls: 0, passes: 0,
    buildupTurnsA: 0, buildupTurnsB: 0, firstStrike: null,
  };
}

/** Shared deck template — identical card selection for both players. */
interface DeckTemplate {
  crew: CrewCard[];
  products: ProductCard[];
  cash: CashCard[];
  weapons: WeaponCard[];
}

/** Generate one shared deck, give both players identical copies shuffled differently. */
function buildSharedDeck(crewPool: CrewCard[], rng: ReturnType<typeof createRng>): DeckTemplate {
  const crew = rng.shuffle([...crewPool]).slice(0, 15);
  const products = rng.shuffle([...generateProducts(rng)]).slice(0, 8);
  const { cards: cashCards } = generateCash();
  const cash = rng.shuffle([...cashCards]).slice(0, 10);
  const weapons = rng.shuffle([...generateWeapons()]).slice(0, 8);
  return { crew, products, cash, weapons };
}

function initPlayer(
  side: 'A' | 'B',
  config: TurfGameConfig,
  template: DeckTemplate,
  rng: ReturnType<typeof createRng>,
): PlayerState {
  // Deep copy the template so each player has independent card instances
  const crewDeck = rng.shuffle(template.crew.map(c => ({ ...c })));
  const productDeck = rng.shuffle(template.products.map(p => ({ ...p })));
  const cashDeck = rng.shuffle(template.cash.map(c => ({ ...c })));
  const weaponDeck = rng.shuffle(template.weapons.map(w => ({ ...w })));

  // Both players start with same hand size: 3 crew, 1 product, 2 cash
  const hand = {
    crew: crewDeck.splice(0, 3),
    product: productDeck.splice(0, 1),
    cash: cashDeck.splice(0, 2),
    weapon: [] as WeaponCard[],
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

  // Shared deck — both players get identical card pools, shuffled independently
  const template = buildSharedDeck(crewPool, rng);

  return {
    config,
    players: {
      A: initPlayer('A', config, template, rng),
      B: initPlayer('B', config, template, rng),
    },
    // Simultaneous turns — no first mover. Both act each round.
    turnSide: 'A', // tracks whose sub-turn it is within a round
    firstPlayer: 'A', // no longer meaningful — both act simultaneously
    turnNumber: 0,
    phase: 'buildup',
    buildupTurns: { A: 0, B: 0 },
    hasStruck: { A: false, B: false },
    aiState: { A: 'BUILDING', B: 'BUILDING' },
    aiTurnsInState: { A: 0, B: 0 },
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
 * During buildup, AI uses fuzzy logic to decide when to strike.
 * Evaluates board state, resources, and threat to determine readiness.
 */
function shouldStrike(state: TurfGameState, side: 'A' | 'B'): boolean {
  const p = state.players[side];
  const buildTurns = state.buildupTurns[side];
  const fuzzy = evaluateFuzzy(state, side);

  // Update AI state based on fuzzy evaluation
  const currentState = state.aiState[side] as AiState;
  const newState = resolveState(fuzzy, currentState, state.aiTurnsInState[side]);
  if (newState !== currentState) {
    state.aiState[side] = newState;
    state.aiTurnsInState[side] = 0;
  }

  // Strike if:
  // 1. Fuzzy aggression is high and patience is low
  if (fuzzy.aggression > 0.6 && fuzzy.patience < 0.3) return true;
  // 2. Desperation is high (must act now)
  if (fuzzy.desperation > 0.5) return true;
  // 3. Have a stacked attack ready
  if (findPushReady(p.board).length > 0) return true;
  if (findFundedReady(p.board).length > 0 && buildTurns >= 3) return true;
  // 4. Been building too long
  if (buildTurns >= 8) return true;
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

  // Update AI state via fuzzy logic
  const fuzzy = evaluateFuzzy(state, side);
  const currentState = state.aiState[side] as AiState;
  const newState = resolveState(fuzzy, currentState, state.aiTurnsInState[side]);
  if (newState !== currentState) {
    state.aiState[side] = newState;
    state.aiTurnsInState[side] = 0;
  }
  state.aiTurnsInState[side]++;

  // Get priority order from state machine
  const priorities = getStatePriorities(newState);

  // Execute first viable action in priority order
  for (const action of priorities) {
    if (tryAction(state, side, action)) return;
  }

  m.passes++;
}

/** Try to execute a single action type. Returns true if action was taken. */
function tryAction(state: TurfGameState, side: 'A' | 'B', action: string): boolean {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const m = state.metrics;

  switch (action) {
    case 'reclaim': {
      const seizedIdx = p.board.active.findIndex(pos => pos.seized);
      if (seizedIdx >= 0 && p.hand.crew.length > 0 && p.hand.cash.length > 0) {
        const crew = p.hand.crew.pop()!;
        p.hand.cash.pop()!; // costs cash
        const weakCrew = { ...crew, power: Math.max(1, Math.floor(crew.power / 2)) };
        p.board.active[seizedIdx].seized = false;
        p.board.active[seizedIdx].crew = weakCrew;
        p.board.active[seizedIdx].turnsActive = 0;
        opp.positionsSeized = Math.max(0, opp.positionsSeized - 1);
        m.positionsReclaimed++;
        m.crewPlaced++;
        m.cashPlayed++;
        return true;
      }
      return false;
    }

    case 'pushed_attack': {
      const ready = findPushReady(p.board);
      if (ready.length === 0) return false;
      const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
      if (targetIdx < 0) return false;
      m.pushedAttacks++;
      m.dieRolls++;
      const outcome = resolvePushedAttack(
        p.board.active[ready[0]], opp.board.active[targetIdx],
        opp.board.active, state.config, state.rng,
      );
      handleOutcome(state, side, outcome, opp, targetIdx);
      return true;
    }

    case 'funded_attack': {
      const ready = findFundedReady(p.board);
      if (ready.length === 0) return false;
      const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
      if (targetIdx < 0) return false;
      m.fundedAttacks++;
      m.dieRolls++;
      const outcome = resolveFundedAttack(
        p.board.active[ready[0]], opp.board.active[targetIdx],
        state.config, state.rng,
      );
      handleOutcome(state, side, outcome, opp, targetIdx);
      return true;
    }

    case 'arm_weapon': {
      if (p.hand.weapon.length === 0) return false;
      const unarmed = p.board.active.findIndex(
        pos => pos.crew && !pos.weapon && !pos.seized && pos.turnsActive >= 1,
      );
      if (unarmed < 0) return false;
      armCrew(p.board, unarmed, p.hand.weapon.pop()!);
      m.weaponsDrawn++;
      return true;
    }

    case 'stack_product': {
      if (p.hand.product.length === 0) return false;
      const target = p.board.active.findIndex(pos => pos.crew && !pos.product && !pos.seized);
      if (target < 0) return false;
      stackProduct(p.board, target, p.hand.product.pop()!);
      m.productPlayed++;
      return true;
    }

    case 'stack_cash': {
      if (p.hand.cash.length === 0) return false;
      const target = p.board.active.findIndex(pos => pos.crew && !pos.cash && !pos.seized);
      if (target < 0) return false;
      stackCash(p.board, target, p.hand.cash.pop()!);
      m.cashPlayed++;
      return true;
    }

    case 'direct_attack': {
      const ready = findDirectReady(p.board);
      if (ready.length === 0) return false;
      const sorted = ready.sort((a, b) =>
        positionPower(p.board.active[b]) - positionPower(p.board.active[a]),
      );
      for (const atkIdx of sorted) {
        const atkPos = p.board.active[atkIdx];
        const targetIdx = opp.board.active.findIndex(pos =>
          pos.crew !== null &&
          canPrecisionAttack(positionPower(atkPos), positionDefense(pos),
            state.config.precisionMult, atkPos.crew!.archetype === 'bruiser'),
        );
        if (targetIdx >= 0) {
          m.directAttacks++;
          const outcome = resolveDirectAttack(atkPos, opp.board.active[targetIdx]);
          handleOutcome(state, side, outcome, opp, targetIdx);
          return true;
        }
      }
      return false;
    }

    case 'place_crew': {
      if (p.hand.crew.length === 0) return false;
      const emptyIdx = findEmptyActive(p.board);
      if (emptyIdx < 0) return false;
      placeCrew(p.board, emptyIdx, p.hand.crew.pop()!);
      m.crewPlaced++;
      return true;
    }

    default:
      return false;
  }
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

// ── Main Loop — Simultaneous Rounds ──────────────────────────

/**
 * Both players act SIMULTANEOUSLY each round. No first mover.
 * Each round: tick → draw → decide → resolve both at once.
 */
export function playTurfGame(
  config: TurfGameConfig = DEFAULT_TURF_CONFIG,
  seed?: number,
): TurfGameResult {
  const gameSeed = seed ?? randomSeed();
  const state = createGame(config, gameSeed);

  while (!state.winner && state.turnNumber < config.maxTurns) {
    state.turnNumber++;
    state.metrics.turns++;

    // Tick BOTH boards simultaneously
    tickPositions(state.players.A.board);
    tickPositions(state.players.B.board);

    // Draw phase for BOTH
    drawPhase(state, 'A');
    drawPhase(state, 'B');

    // Randomize action order each round — eliminates structural bias
    const first = state.rng.next() < 0.5 ? 'A' : 'B';
    const second: 'A' | 'B' = first === 'A' ? 'B' : 'A';

    if (state.phase === 'buildup') {
      state.buildupTurns.A++;
      state.buildupTurns.B++;

      const aStrikes = shouldStrike(state, 'A');
      const bStrikes = shouldStrike(state, 'B');

      if (aStrikes || bStrikes) {
        state.phase = 'combat';
        state.metrics.buildupTurnsA = state.buildupTurns.A;
        state.metrics.buildupTurnsB = state.buildupTurns.B;
        state.metrics.firstStrike = (aStrikes && bStrikes) ? null
          : aStrikes ? 'A' : 'B';

        aiCombatTurn(state, first);
        if (!state.winner) aiCombatTurn(state, second);
      } else {
        aiBuildupTurn(state, first);
        aiBuildupTurn(state, second);
      }
    } else {
      // Combat — randomized order each round
      aiCombatTurn(state, first);
      if (!state.winner) aiCombatTurn(state, second);
    }

    if (checkWin(state)) break;
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
    firstPlayer: 'A', // no first player in simultaneous
    turnCount: state.turnNumber,
    metrics: state.metrics,
    seed: gameSeed,
    finalState: {
      seizedA: seizedCount(state.players.A.board),
      seizedB: seizedCount(state.players.B.board),
    },
  };
}
