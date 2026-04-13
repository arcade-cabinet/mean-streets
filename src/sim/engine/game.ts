/**
 * Game simulation runner.
 * Creates game state, executes turns via AI decisions, collects metrics.
 */

import type { GameConfigData } from '../schemas';
import type { GameResult } from '../types';
import { createEmptyMetrics } from '../types';
import { getGang } from './gangs';
import { buildDeck, getEffectiveAtk, getDef } from './deck';
import {
  applyDamage, healVanguard, rollDie, drawCards,
  createVanguard, promoteFromHand,
  type PlayerState,
} from './combat';
import type { AiDecision } from '../ai/types';
import { makeDecision } from '../ai/brain';

export interface GameState {
  config: GameConfigData;
  turnSide: 'A' | 'B';
  firstPlayer: 'A' | 'B';
  isNight: boolean;
  nightShiftCounter: number;
  turnNumber: number;
  consecutivePasses: number;
  forcedDie: { A: boolean; B: boolean };
  players: { A: PlayerState; B: PlayerState };
  metrics: GameMetrics;
  winner: 'A' | 'B' | null;
  endReason: 'starvation' | 'stall' | null;
}

/** Create initial game state from config. */
export function createGame(config: GameConfigData): GameState {
  const gangA = getGang(config.gangA);
  const gangB = getGang(config.gangB);
  const deckA = buildDeck(gangA);
  const deckB = buildDeck(gangB);

  const firstPlayer: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';

  // Draw vanguards
  const vanCardA = deckA.pop()!;
  const vanCardB = deckB.pop()!;

  const playerA: PlayerState = {
    gangId: gangA.id,
    passiveType: gangA.passive.type,
    passiveValue: gangA.passive.value,
    deck: deckA,
    hand: [],
    vanguard: createVanguard(vanCardA, false, gangA.passive.type, gangA.passive.value),
    discard: [],
  };

  const playerB: PlayerState = {
    gangId: gangB.id,
    passiveType: gangB.passive.type,
    passiveValue: gangB.passive.value,
    deck: deckB,
    hand: [],
    vanguard: createVanguard(vanCardB, false, gangB.passive.type, gangB.passive.value),
    discard: [],
  };

  // Deal hands — second player gets +1 card
  const firstCount = 4;
  const secondCount = config.secondPlayerBonus ? 5 : 4;
  const countA = firstPlayer === 'A' ? firstCount : secondCount;
  const countB = firstPlayer === 'B' ? firstCount : secondCount;

  drawCards(playerA, countA, config.handMax, false);
  drawCards(playerB, countB, config.handMax, false);

  return {
    config,
    turnSide: firstPlayer,
    firstPlayer,
    isNight: false,
    nightShiftCounter: 0,
    turnNumber: 0,
    consecutivePasses: 0,
    forcedDie: { A: false, B: false },
    players: { A: playerA, B: playerB },
    metrics: createEmptyMetrics(),
    winner: null,
    endReason: null,
  };
}

/** Execute a single turn. Returns true if game is over. */
export function executeTurn(state: GameState): boolean {
  const side = state.turnSide;
  const opSide: 'A' | 'B' = side === 'A' ? 'B' : 'A';
  const player = state.players[side];
  const opponent = state.players[opSide];

  state.turnNumber++;
  state.metrics.turns++;

  // Win check
  if (checkWin(state)) return true;

  const decision = makeDecision(state, side);
  executeDecision(state, side, opSide, decision);

  // Swap turn
  state.turnSide = opSide;
  return state.winner !== null;
}

/** Check for win/loss conditions. */
function checkWin(state: GameState): boolean {
  for (const side of ['A', 'B'] as const) {
    const p = state.players[side];
    if (!p.vanguard && p.hand.length === 0) {
      state.winner = side === 'A' ? 'B' : 'A';
      state.endReason = 'starvation';
      return true;
    }
  }
  return false;
}

/** Execute a single AI decision. */
function executeDecision(
  state: GameState,
  side: 'A' | 'B',
  opSide: 'A' | 'B',
  decision: AiDecision,
): void {
  const player = state.players[side];
  const opponent = state.players[opSide];
  const m = state.metrics;

  switch (decision.action) {
    case 'attack':
      executeAttack(state, side, opSide, decision.cardIndices);
      break;

    case 'sacrifice':
      executeSacrifice(state, side, decision.cardIndex!);
      break;

    case 'hustle':
      executeHustle(state, side, opSide);
      break;

    case 'roll_die':
      executeRollDie(state, side);
      break;

    case 'pass':
      executePass(state);
      break;
  }
}

function executeAttack(
  state: GameState,
  side: 'A' | 'B',
  opSide: 'A' | 'B',
  cardIndices: number[],
): void {
  const player = state.players[side];
  const opponent = state.players[opSide];
  const m = state.metrics;

  m.attacks++;
  state.consecutivePasses = 0;

  if (cardIndices.length > 1) {
    m.runsPlayed++; // counts runs and sets
  }

  // Remove cards from hand (reverse order for safe splice)
  const cards: CardData[] = [];
  const sorted = [...cardIndices].sort((a, b) => b - a);
  for (const idx of sorted) {
    const card = player.hand.splice(idx, 1)[0];
    player.discard.push(card);
    cards.push(card);
  }

  // Calculate total damage
  let totalDmg = 0;
  for (const card of cards) {
    totalDmg += getEffectiveAtk(card, state.isNight, player.passiveType, player.passiveValue);
  }

  // Apply damage
  if (!opponent.vanguard) return;
  const result = applyDamage(opponent.vanguard, totalDmg);
  opponent.vanguard.hp = result.newHp;
  opponent.vanguard.shield = result.newShield;

  if (result.killed) {
    handleVanguardDeath(state, opSide, side);
  }
}

function executeSacrifice(state: GameState, side: 'A' | 'B', cardIndex: number): void {
  const player = state.players[side];
  const m = state.metrics;

  m.sacrifices++;
  state.consecutivePasses = 0;

  const card = player.hand.splice(cardIndex, 1)[0];
  player.discard.push(card);

  if (player.vanguard) {
    const healAmt = getDef(card, state.isNight);
    healVanguard(player.vanguard, healAmt);
  }

  // SCAVENGE passive: draw 1 on sacrifice
  if (player.passiveType === 'SCAVENGE') {
    const result = drawCards(player, player.passiveValue, state.config.handMax, state.isNight);
    m.sacrificeDraws += result.drawn;
    if (result.overdrawTriggered) m.overdrawPenalties++;
    if (result.shieldSaved) m.shieldSaves++;
  }
}

function executeHustle(state: GameState, side: 'A' | 'B', opSide: 'A' | 'B'): void {
  const player = state.players[side];
  const m = state.metrics;

  m.hustles++;
  state.consecutivePasses = 0;

  if (player.vanguard) {
    player.vanguard.hp = Math.max(0, player.vanguard.hp - 2);
    if (player.vanguard.hp <= 0) {
      handleVanguardDeath(state, side, opSide);
      return;
    }
  }

  const result = drawCards(player, 1, state.config.handMax, state.isNight);
  if (result.overdrawTriggered) m.overdrawPenalties++;
  if (result.shieldSaved) m.shieldSaves++;
}

function executeRollDie(state: GameState, side: 'A' | 'B'): void {
  const player = state.players[side];
  const m = state.metrics;

  state.consecutivePasses = 0;
  m.dieRolls++;

  if (state.forcedDie[side]) {
    state.forcedDie[side] = false;
    m.forcedDieRolls++;
  }

  const hasShield = (player.vanguard?.shield ?? 0) > 0;
  const result = rollDie(state.config.dieSize, player.hand.length, hasShield);

  if (!result.hit) {
    if (result.target === 'shield_absorbed') {
      m.shieldSaves++;
      if (player.vanguard) player.vanguard.shield--;
    } else {
      m.dieMisses++;
    }
    return;
  }

  m.dieHits++;
  if (result.target === 'hand' && result.cardIndex !== undefined) {
    const card = player.hand.splice(result.cardIndex, 1)[0];
    player.discard.push(card);
  } else if (result.target === 'vanguard' && player.vanguard) {
    player.vanguard.hp = Math.max(0, player.vanguard.hp - 2);
    m.dieVanguardHits++;
  }
}

function executePass(state: GameState): void {
  state.metrics.passes++;
  state.consecutivePasses++;

  if (state.consecutivePasses >= 2) {
    state.metrics.stallBreakers++;
    for (const side of ['A', 'B'] as const) {
      const result = drawCards(
        state.players[side], 1, state.config.handMax, state.isNight,
      );
      if (result.overdrawTriggered) state.metrics.overdrawPenalties++;
      if (result.shieldSaved) state.metrics.shieldSaves++;
    }
    state.consecutivePasses = 0;
  }
}

function handleVanguardDeath(
  state: GameState,
  deadSide: 'A' | 'B',
  killerSide: 'A' | 'B',
): void {
  const dead = state.players[deadSide];
  const killer = state.players[killerSide];
  const m = state.metrics;

  m.vanguardDeaths++;
  if (killerSide === 'A') m.killsByA++;
  else m.killsByB++;

  // Discard dead vanguard
  if (dead.vanguard) {
    dead.discard.push(dead.vanguard.card);
    dead.vanguard = null;
  }

  // Kill bounty: killer draws 2
  const bounty = drawCards(killer, 2, state.config.handMax, state.isNight);
  if (bounty.overdrawTriggered) m.overdrawPenalties++;
  if (bounty.shieldSaved) m.shieldSaves++;

  // BLEED passive: enemy discards on kill
  if (killer.passiveType === 'BLEED' && dead.hand.length > 0) {
    const count = Math.min(killer.passiveValue, dead.hand.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * dead.hand.length);
      dead.discard.push(dead.hand.splice(idx, 1)[0]);
      m.bleedDiscards++;
    }
  }

  // Check starvation
  if (dead.hand.length === 0) {
    state.winner = killerSide;
    state.endReason = 'starvation';
    return;
  }

  // Night shift counter
  state.nightShiftCounter++;
  if (state.nightShiftCounter >= state.config.nightShiftEvery) {
    state.isNight = !state.isNight;
    state.nightShiftCounter = 0;
    m.nightShifts++;
    updateVanguardPhase(state);
  }

  // Promote best defender from hand
  let bestIdx = 0;
  let bestDef = -1;
  dead.hand.forEach((c, i) => {
    const d = getDef(c, state.isNight);
    if (d > bestDef) { bestDef = d; bestIdx = i; }
  });
  promoteFromHand(dead, bestIdx, state.isNight);
}

/** Update vanguard maxHp/hp when day/night shifts. */
function updateVanguardPhase(state: GameState): void {
  for (const side of ['A', 'B'] as const) {
    const van = state.players[side].vanguard;
    if (!van) continue;
    const newDef = getDef(van.card, state.isNight);
    const ratio = van.hp / van.maxHp;
    van.maxHp = newDef;
    van.hp = Math.max(1, Math.round(ratio * newDef));
  }
}

/** Run a complete game and return the result. */
export function playGame(config: GameConfigData): GameResult {
  const state = createGame(config);

  while (!state.winner && state.turnNumber < config.maxTurns) {
    executeTurn(state);
  }

  if (!state.winner) {
    state.endReason = 'stall';
    const scoreA = state.players.A.hand.length * 2 +
      (state.players.A.vanguard?.hp ?? 0);
    const scoreB = state.players.B.hand.length * 2 +
      (state.players.B.vanguard?.hp ?? 0);
    state.winner = scoreA >= scoreB ? 'A' : 'B';
  }

  state.metrics.cardsRemainingInDeck =
    state.players.A.deck.length + state.players.B.deck.length;

  return {
    winner: state.winner,
    endReason: state.endReason!,
    firstPlayer: state.firstPlayer,
    metrics: state.metrics,
  };
}
