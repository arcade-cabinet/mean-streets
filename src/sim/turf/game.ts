/**
 * Turf war game loop — buildup + combat phases.
 * Unified modifier API: all quarter-cards in hand.modifiers / modifierDraw.
 */

import type {
  TurfGameState, TurfGameConfig, TurfGameResult,
  TurfMetrics, PlayerState, CrewCard, ModifierCard,
  ProductCard, CashCard, WeaponCard,
} from './types';
import { DEFAULT_TURF_CONFIG } from './types';
import { createRng, randomSeed } from '../cards/rng';
import { generateAllCards } from '../cards/generator';
import { generateWeapons, generateDrugs, generateCash } from './generators';
import {
  createBoard, findEmptyActive, placeCrew, placeModifier,
  seizedCount, findPushReady, findFundedReady, findDirectReady,
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
    positionsReclaimed: 0, passes: 0,
    buildupRoundsA: 0, buildupRoundsB: 0, combatRounds: 0,
    totalActions: 0, firstStrike: null,
  };
}

interface DeckTemplate {
  crew: CrewCard[];
  modifiers: ModifierCard[];
}

function buildSharedDeck(crewPool: CrewCard[], rng: ReturnType<typeof createRng>): DeckTemplate {
  const weaponPool = generateWeapons(rng);
  const drugPool = generateDrugs(rng);
  const cashPool = generateCash();

  const crew = rng.shuffle([...crewPool]).slice(0, 25);
  const weapons = rng.shuffle([...weaponPool.filter(w => w.unlocked)]).slice(0, 8);
  const drugs = rng.shuffle([...drugPool.filter(d => d.unlocked)]).slice(0, 8);
  const cash = rng.shuffle([...cashPool]).slice(0, 9);
  const modifiers = rng.shuffle([...weapons, ...drugs, ...cash] as ModifierCard[]);

  return { crew, modifiers };
}

function initPlayer(
  side: 'A' | 'B',
  config: TurfGameConfig,
  template: DeckTemplate,
  rng: ReturnType<typeof createRng>,
): PlayerState {
  const crewDeck = rng.shuffle(template.crew.map(c => ({ ...c })));
  const modifierDeck = rng.shuffle(
    template.modifiers.map(m => ({ ...m })) as ModifierCard[],
  );

  const hand = {
    crew: crewDeck.splice(0, 3),
    modifiers: modifierDeck.splice(0, 3) as ModifierCard[],
  };

  return {
    board: createBoard(side, config.positionCount, config.reserveCount),
    crewDraw: crewDeck,
    modifierDraw: modifierDeck,
    hand,
    discard: [],
    positionsSeized: 0,
  };
}

function createGame(config: TurfGameConfig, seed: number): TurfGameState {
  const rng = createRng(seed);
  const allCards = generateAllCards(seed, 25);
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

  const template = buildSharedDeck(crewPool, rng);

  return {
    config,
    players: {
      A: initPlayer('A', config, template, rng),
      B: initPlayer('B', config, template, rng),
    },
    turnSide: 'A',
    firstPlayer: 'A',
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

// ── Helpers: filter hand by modifier type ──────────────────

function handWeapons(p: PlayerState): WeaponCard[] {
  return p.hand.modifiers.filter((m): m is WeaponCard => m.type === 'weapon');
}

function handDrugs(p: PlayerState): ProductCard[] {
  return p.hand.modifiers.filter((m): m is ProductCard => m.type === 'product');
}

function handCash(p: PlayerState): CashCard[] {
  return p.hand.modifiers.filter((m): m is CashCard => m.type === 'cash');
}

function removeFromHand(p: PlayerState, card: ModifierCard): void {
  const idx = p.hand.modifiers.indexOf(card);
  if (idx >= 0) p.hand.modifiers.splice(idx, 1);
}

let bonusCashCounter = 0;

function awardCash(p: PlayerState): void {
  bonusCashCounter++;
  const bonus: CashCard = {
    type: 'cash',
    id: `cash-bonus-${bonusCashCounter}`,
    denomination: 100,
  };
  p.hand.modifiers.push(bonus);
}

// ── Draw Phase ──────────────────────────────────────────────

function drawPhase(_state: TurfGameState, side: 'A' | 'B'): void {
  const p = _state.players[side];
  if (p.crewDraw.length > 0 && p.hand.crew.length < 5) {
    p.hand.crew.push(p.crewDraw.pop()!);
  }
  if (p.modifierDraw.length > 0 && p.hand.modifiers.length < 7) {
    p.hand.modifiers.push(p.modifierDraw.pop()!);
  }
}

// ── AI: Strike Timing ───────────────────────────────────────

function shouldStrike(state: TurfGameState, side: 'A' | 'B'): boolean {
  const p = state.players[side];
  const buildTurns = state.buildupTurns[side];
  const fuzzy = evaluateFuzzy(state, side);

  const currentState = state.aiState[side] as AiState;
  const newState = resolveState(fuzzy, currentState, state.aiTurnsInState[side]);
  if (newState !== currentState) {
    state.aiState[side] = newState;
    state.aiTurnsInState[side] = 0;
  }

  if (fuzzy.aggression > 0.6 && fuzzy.patience < 0.3) return true;
  if (fuzzy.desperation > 0.5) return true;
  if (findPushReady(p.board).length > 0) return true;
  if (findFundedReady(p.board).length > 0 && buildTurns >= 3) return true;
  if (buildTurns >= 8) return true;
  if (p.hand.crew.length === 0 && p.hand.modifiers.length === 0) return true;

  return false;
}

// ── AI: Buildup Actions ─────────────────────────────────────

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

  // Place a modifier on a crew position (prefer offense slots first)
  const mod = p.hand.modifiers[0];
  if (mod) {
    for (let i = 0; i < p.board.active.length; i++) {
      const pos = p.board.active[i];
      if (!pos.crew || pos.seized) continue;
      if (placeModifier(p.board, i, mod, 'offense')) {
        removeFromHand(p, mod);
        if (mod.type === 'product') m.productPlayed++;
        else if (mod.type === 'cash') m.cashPlayed++;
        else if (mod.type === 'weapon') m.weaponsDrawn++;
        return;
      }
      if (placeModifier(p.board, i, mod, 'defense')) {
        removeFromHand(p, mod);
        if (mod.type === 'product') m.productPlayed++;
        else if (mod.type === 'cash') m.cashPlayed++;
        else if (mod.type === 'weapon') m.weaponsDrawn++;
        return;
      }
    }
  }
}

// ── AI: Combat Actions ──────────────────────────────────────

function aiCombatTurn(state: TurfGameState, side: 'A' | 'B'): void {
  const m = state.metrics;

  const fuzzy = evaluateFuzzy(state, side);
  const currentState = state.aiState[side] as AiState;
  const newState = resolveState(fuzzy, currentState, state.aiTurnsInState[side]);
  if (newState !== currentState) {
    state.aiState[side] = newState;
    state.aiTurnsInState[side] = 0;
  }
  state.aiTurnsInState[side]++;

  const priorities = getStatePriorities(newState);

  for (const action of priorities) {
    if (tryAction(state, side, action)) return;
  }

  m.passes++;
}

function tryAction(state: TurfGameState, side: 'A' | 'B', action: string): boolean {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const m = state.metrics;

  switch (action) {
    case 'reclaim': {
      const seizedIdx = p.board.active.findIndex(pos => pos.seized);
      if (seizedIdx < 0) return false;
      if (p.hand.crew.length === 0) return false;
      const cash = handCash(p);
      if (cash.length === 0) return false;
      const crew = p.hand.crew.pop()!;
      removeFromHand(p, cash[0]);
      const weakCrew: CrewCard = {
        ...crew,
        power: Math.max(1, Math.floor(crew.power / 2)),
        resistance: Math.max(1, Math.floor(crew.resistance / 2)),
      };
      p.board.active[seizedIdx].seized = false;
      p.board.active[seizedIdx].crew = weakCrew;
      p.board.active[seizedIdx].turnsActive = 0;
      opp.positionsSeized = Math.max(0, opp.positionsSeized - 1);
      m.positionsReclaimed++;
      m.crewPlaced++;
      m.cashPlayed++;
      return true;
    }

    case 'pushed_attack': {
      const ready = findPushReady(p.board);
      if (ready.length === 0) return false;
      const targetIdx = opp.board.active.findIndex(pos => pos.crew !== null);
      if (targetIdx < 0) return false;
      m.pushedAttacks++;
      const outcome = resolvePushedAttack(
        p.board.active[ready[0]], opp.board.active[targetIdx],
        opp.board.active, state.config,
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
      const outcome = resolveFundedAttack(
        p.board.active[ready[0]], opp.board.active[targetIdx],
        state.config,
      );
      handleOutcome(state, side, outcome, opp, targetIdx);
      return true;
    }

    case 'arm_weapon': {
      const weapons = handWeapons(p);
      if (weapons.length === 0) return false;
      for (let i = 0; i < p.board.active.length; i++) {
        const pos = p.board.active[i];
        if (!pos.crew || pos.seized || pos.turnsActive < 1) continue;
        if (!pos.weaponTop && placeModifier(p.board, i, weapons[0], 'offense')) {
          removeFromHand(p, weapons[0]);
          m.weaponsDrawn++;
          return true;
        }
        if (!pos.weaponBottom && placeModifier(p.board, i, weapons[0], 'defense')) {
          removeFromHand(p, weapons[0]);
          m.weaponsDrawn++;
          return true;
        }
      }
      return false;
    }

    case 'stack_product': {
      const drugs = handDrugs(p);
      if (drugs.length === 0) return false;
      for (let i = 0; i < p.board.active.length; i++) {
        const pos = p.board.active[i];
        if (!pos.crew || pos.seized) continue;
        if (!pos.drugTop && placeModifier(p.board, i, drugs[0], 'offense')) {
          removeFromHand(p, drugs[0]);
          m.productPlayed++;
          return true;
        }
        if (!pos.drugBottom && placeModifier(p.board, i, drugs[0], 'defense')) {
          removeFromHand(p, drugs[0]);
          m.productPlayed++;
          return true;
        }
      }
      return false;
    }

    case 'stack_cash': {
      const cash = handCash(p);
      if (cash.length === 0) return false;
      for (let i = 0; i < p.board.active.length; i++) {
        const pos = p.board.active[i];
        if (!pos.crew || pos.seized) continue;
        if (!pos.cashLeft && placeModifier(p.board, i, cash[0], 'offense')) {
          removeFromHand(p, cash[0]);
          m.cashPlayed++;
          return true;
        }
        if (!pos.cashRight && placeModifier(p.board, i, cash[0], 'defense')) {
          removeFromHand(p, cash[0]);
          m.cashPlayed++;
          return true;
        }
      }
      return false;
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
    awardCash(p);
    const hasFence = p.board.active.some(pos => pos.crew?.archetype === 'fence');
    if (hasFence) awardCash(p);

    if (!opp.board.active[targetIdx].crew) {
      seizePosition(opp.board.active[targetIdx]);
      m.seizures++;
      p.positionsSeized++;
    }
  } else if (outcome.type === 'flip') {
    m.flips += outcome.gainedCards.length;
    awardCash(p);
    for (const card of outcome.gainedCards) {
      if (card.type === 'crew') {
        const emptyIdx = findEmptyActive(p.board);
        if (emptyIdx >= 0) placeCrew(p.board, emptyIdx, card as CrewCard);
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

// ── Win Check ───────────────────────────────────────────────

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

// ── Main Loop ───────────────────────────────────────────────

export function playTurfGame(
  config: TurfGameConfig = DEFAULT_TURF_CONFIG,
  seed?: number,
): TurfGameResult {
  const gameSeed = seed ?? randomSeed();
  bonusCashCounter = 0;
  const state = createGame(config, gameSeed);
  let roundNumber = 0;

  // ── BUILDUP PHASE ──
  while (state.phase === 'buildup' && roundNumber < config.maxBuildupRounds) {
    roundNumber++;
    state.turnNumber++;
    state.metrics.turns++;
    state.buildupTurns.A++;
    state.buildupTurns.B++;

    tickPositions(state.players.A.board);
    tickPositions(state.players.B.board);
    drawPhase(state, 'A');
    drawPhase(state, 'B');

    const aStrikes = shouldStrike(state, 'A');
    const bStrikes = shouldStrike(state, 'B');

    if (aStrikes || bStrikes) {
      state.phase = 'combat';
      state.metrics.buildupRoundsA = state.buildupTurns.A;
      state.metrics.buildupRoundsB = state.buildupTurns.B;
      state.metrics.firstStrike = (aStrikes && bStrikes) ? null
        : aStrikes ? 'A' : 'B';
      break;
    }

    const first = state.rng.next() < 0.5 ? 'A' : 'B';
    const second: 'A' | 'B' = first === 'A' ? 'B' : 'A';
    aiBuildupTurn(state, first);
    aiBuildupTurn(state, second);
  }

  if (state.phase === 'buildup') {
    state.phase = 'combat';
    state.metrics.buildupRoundsA = state.buildupTurns.A;
    state.metrics.buildupRoundsB = state.buildupTurns.B;
  }

  // ── COMBAT PHASE ──
  while (!state.winner && roundNumber < config.maxRounds) {
    roundNumber++;
    state.metrics.combatRounds++;
    state.metrics.turns++;

    tickPositions(state.players.A.board);
    tickPositions(state.players.B.board);
    drawPhase(state, 'A');
    drawPhase(state, 'B');

    let actionsA = config.actionsPerRound;
    let actionsB = config.actionsPerRound;

    while ((actionsA > 0 || actionsB > 0) && !state.winner) {
      const aGoesFirst = state.rng.next() < 0.5;

      if (aGoesFirst) {
        if (actionsA > 0) { aiCombatTurn(state, 'A'); actionsA--; state.metrics.totalActions++; }
        if (actionsB > 0 && !state.winner) { aiCombatTurn(state, 'B'); actionsB--; state.metrics.totalActions++; }
      } else {
        if (actionsB > 0) { aiCombatTurn(state, 'B'); actionsB--; state.metrics.totalActions++; }
        if (actionsA > 0 && !state.winner) { aiCombatTurn(state, 'A'); actionsA--; state.metrics.totalActions++; }
      }

      if (checkWin(state)) break;
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
    firstPlayer: 'A',
    turnCount: roundNumber,
    metrics: state.metrics,
    seed: gameSeed,
    finalState: {
      seizedA: seizedCount(state.players.A.board),
      seizedB: seizedCount(state.players.B.board),
    },
  };
}
