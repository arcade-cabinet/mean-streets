/**
 * Character card game simulation loop.
 * Two AI players build decks from the shared pool, then fight.
 */

import type { CharacterCard } from './schemas';
import {
  createLiveCard, getAtk, getDef, calcEffectiveAtk,
  applyDamage, healCard, canPrecisionAttack, rollDie,
  type LiveCard,
} from './combat';
import { buildAiDeck, type BuiltDeck } from './deckbuilder';
import { createEmptyMetrics, type GameMetrics } from '../types';

export interface CardGameConfig {
  precisionMult: number;
  handMax: number;
  dieSize: number;
  nightShiftEvery: number;
  maxTurns: number;
  deckSize: number;
  activeSize: number;
  reserveSize: number;
}

export const DEFAULT_CARD_CONFIG: CardGameConfig = {
  precisionMult: 3.0,
  handMax: 5,
  dieSize: 6,
  nightShiftEvery: 2,
  maxTurns: 200,
  deckSize: 20,
  activeSize: 6,
  reserveSize: 3,
};

interface PlayerState {
  deck: BuiltDeck;
  drawPile: CharacterCard[];
  hand: LiveCard[];
  vanguard: LiveCard | null;
  reserves: LiveCard[];
  discard: CharacterCard[];
}

export interface CardGameState {
  config: CardGameConfig;
  players: { A: PlayerState; B: PlayerState };
  turnSide: 'A' | 'B';
  firstPlayer: 'A' | 'B';
  isNight: boolean;
  nightCounter: number;
  turnNumber: number;
  consecutivePasses: number;
  metrics: GameMetrics;
  winner: 'A' | 'B' | null;
  endReason: string | null;
}

export interface CardGameResult {
  winner: 'A' | 'B';
  endReason: string;
  firstPlayer: 'A' | 'B';
  metrics: GameMetrics;
  deckA: { conflicts: number; synergies: number };
  deckB: { conflicts: number; synergies: number };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Create initial game state from two built decks. */
function createState(
  deckA: BuiltDeck,
  deckB: BuiltDeck,
  config: CardGameConfig,
): CardGameState {
  const firstPlayer: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';

  function initPlayer(deck: BuiltDeck, isFirst: boolean): PlayerState {
    const drawPile = shuffle([...deck.active]);
    const reserveLive = deck.reserves.map(c => createLiveCard(c, false));

    // Draw vanguard
    const vanCard = drawPile.pop()!;
    const vanguard = createLiveCard(vanCard, false);

    // Both players start with 4 cards
    const handSize = 4;
    const hand: LiveCard[] = [];
    for (let i = 0; i < handSize && drawPile.length > 0; i++) {
      hand.push(createLiveCard(drawPile.pop()!, false));
    }

    return {
      deck,
      drawPile,
      hand,
      vanguard,
      reserves: reserveLive,
      discard: [],
    };
  }

  return {
    config,
    players: {
      A: initPlayer(deckA, firstPlayer === 'A'),
      B: initPlayer(deckB, firstPlayer === 'B'),
    },
    turnSide: firstPlayer,
    firstPlayer,
    isNight: false,
    nightCounter: 0,
    turnNumber: 0,
    consecutivePasses: 0,
    metrics: createEmptyMetrics(),
    winner: null,
    endReason: null,
  };
}

/** Draw cards into a player's hand, handle overdraw. */
function drawCards(
  state: CardGameState,
  side: 'A' | 'B',
  count: number,
): { overdraw: boolean; shieldSave: boolean } {
  const p = state.players[side];
  let overdraw = false;
  let shieldSave = false;

  for (let i = 0; i < count; i++) {
    // Try draw pile first, then reserves
    let card: CharacterCard | undefined;
    if (p.drawPile.length > 0) {
      card = p.drawPile.pop();
    } else if (p.reserves.length > 0) {
      const r = p.reserves.pop()!;
      card = r.card;
    }
    if (!card) break;

    p.hand.push(createLiveCard(card, state.isNight));

    // Overdraw check
    if (p.hand.length > state.config.handMax) {
      if (p.vanguard && p.vanguard.shield > 0) {
        p.vanguard.shield--;
        const overflow = p.hand.pop()!;
        p.discard.push(overflow.card);
        shieldSave = true;
        state.metrics.shieldSaves++;
      } else {
        overdraw = true;
        state.metrics.overdrawPenalties++;
        const forced = p.hand.shift()!;
        if (p.vanguard) p.discard.push(p.vanguard.card);
        p.vanguard = createLiveCard(forced.card, state.isNight);
      }
    }
  }

  return { overdraw, shieldSave };
}

/** Handle vanguard death — bounty, promote, check starvation. */
function handleDeath(
  state: CardGameState,
  deadSide: 'A' | 'B',
  killerSide: 'A' | 'B',
): void {
  const dead = state.players[deadSide];
  const m = state.metrics;

  m.vanguardDeaths++;
  if (killerSide === 'A') m.killsByA++;
  else m.killsByB++;

  if (dead.vanguard) {
    dead.discard.push(dead.vanguard.card);
    dead.vanguard = null;
  }

  // Kill bounty: +2
  drawCards(state, killerSide, 2);

  // Check starvation
  if (dead.hand.length === 0 && dead.reserves.length === 0) {
    state.winner = killerSide;
    state.endReason = 'starvation';
    return;
  }

  // Night shift
  state.nightCounter++;
  if (state.nightCounter >= state.config.nightShiftEvery) {
    state.isNight = !state.isNight;
    state.nightCounter = 0;
    state.metrics.nightShifts++;
    // Update surviving vanguards
    for (const s of ['A', 'B'] as const) {
      const van = state.players[s].vanguard;
      if (!van) continue;
      const newDef = getDef(van.card, state.isNight);
      const ratio = van.hp / van.maxHp;
      van.maxHp = newDef;
      van.hp = Math.max(1, Math.round(ratio * newDef));
    }
  }

  // Promote — pick highest DEF
  if (dead.hand.length > 0) {
    let bestIdx = 0;
    let bestDef = -1;
    dead.hand.forEach((lc, i) => {
      const d = getDef(lc.card, state.isNight);
      if (d > bestDef) { bestDef = d; bestIdx = i; }
    });
    const promoted = dead.hand.splice(bestIdx, 1)[0];
    dead.vanguard = createLiveCard(promoted.card, state.isNight);
  } else if (dead.reserves.length > 0) {
    const promoted = dead.reserves.pop()!;
    dead.vanguard = createLiveCard(promoted.card, state.isNight);
  } else {
    state.winner = killerSide;
    state.endReason = 'starvation';
  }
}

// ── AI Decision ──────────────────────────────────────────────

interface Decision {
  action: string;
  indices: number[];
  reason: string;
}

function aiDecide(state: CardGameState, side: 'A' | 'B'): Decision {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];

  if (!p.vanguard || !opp.vanguard) {
    return { action: 'pass', indices: [], reason: 'no vanguard' };
  }

  const oppVan = opp.vanguard;

  // Find valid attacks
  const attacks: Array<{ idx: number; atk: number; lethal: boolean }> = [];
  p.hand.forEach((lc, i) => {
    if (oppVan.vanished) return; // ghost ability
    let atk = calcEffectiveAtk(lc.card, oppVan.card, state.isNight);
    // SHARK bonus: +1 per damage already on target
    if (lc.card.archetype === 'shark') {
      atk += (oppVan.maxHp - oppVan.hp);
    }
    if (canPrecisionAttack(atk, oppVan.hp, state.config.precisionMult)) {
      attacks.push({ idx: i, atk, lethal: atk >= oppVan.hp });
    }
  });

  // 1. Lethal attack
  const lethals = attacks.filter(a => a.lethal);
  if (lethals.length > 0) {
    lethals.sort((a, b) => a.atk - b.atk);
    return { action: 'attack', indices: [lethals[0].idx], reason: 'lethal' };
  }

  // 2. Best attack
  if (attacks.length > 0) {
    attacks.sort((a, b) => b.atk - a.atk);
    return { action: 'attack', indices: [attacks[0].idx], reason: 'pressure' };
  }

  // Track precision lock
  if (p.hand.length > 0) {
    state.metrics.precisionLocks++;
  }

  // 3. Die roll if precision-locked with cards
  if (p.hand.length > 2 && state.config.dieSize > 0) {
    return { action: 'die', indices: [], reason: 'precision-locked' };
  }

  // 4. Sacrifice to heal
  if (p.hand.length > 0 && p.vanguard.hp < p.vanguard.maxHp * 0.7) {
    let worstIdx = 0;
    let worstAtk = Infinity;
    p.hand.forEach((lc, i) => {
      const a = getAtk(lc.card, state.isNight);
      if (a < worstAtk) { worstAtk = a; worstIdx = i; }
    });
    return { action: 'sacrifice', indices: [worstIdx], reason: 'heal' };
  }

  // 5. Hustle
  if (p.vanguard.hp > 3 && p.hand.length < state.config.handMax) {
    if (p.drawPile.length > 0 || p.reserves.length > 0) {
      return { action: 'hustle', indices: [], reason: 'draw' };
    }
  }

  // 6. Sacrifice anyway
  if (p.hand.length > 0) {
    return { action: 'sacrifice', indices: [0], reason: 'dump' };
  }

  return { action: 'pass', indices: [], reason: 'stuck' };
}

// ── Turn Execution ───────────────────────────────────────────

function executeTurn(state: CardGameState): boolean {
  const side = state.turnSide;
  const opSide: 'A' | 'B' = side === 'A' ? 'B' : 'A';
  const p = state.players[side];
  const opp = state.players[opSide];
  const m = state.metrics;

  state.turnNumber++;
  m.turns++;

  // Clear vanish from previous turn
  if (p.vanguard) p.vanguard.vanished = false;

  // No automatic draws — you earn cards through kills, hustle, and abilities

  // Win check: starvation
  if (!p.vanguard && p.hand.length === 0 && p.reserves.length === 0) {
    state.winner = opSide;
    state.endReason = 'starvation';
    return true;
  }

  // Win check: exhaustion — both sides out of draw pile AND hand
  const pEmpty = p.drawPile.length === 0 && p.hand.length === 0 && p.reserves.length === 0;
  const oppEmpty = opp.drawPile.length === 0 && opp.hand.length === 0 && opp.reserves.length === 0;
  if (pEmpty && oppEmpty) {
    // Both exhausted — higher vanguard HP wins
    const hpA = state.players.A.vanguard?.hp ?? 0;
    const hpB = state.players.B.vanguard?.hp ?? 0;
    state.winner = hpA >= hpB ? 'A' : 'B';
    state.endReason = 'exhaustion';
    return true;
  }

  const decision = aiDecide(state, side);

  switch (decision.action) {
    case 'attack': {
      m.attacks++;
      state.consecutivePasses = 0;
      const idx = decision.indices[0];
      const lc = p.hand.splice(idx, 1)[0];
      p.discard.push(lc.card);

      if (!opp.vanguard) break;

      let atk = calcEffectiveAtk(lc.card, opp.vanguard.card, state.isNight);
      if (lc.card.archetype === 'shark') {
        atk += (opp.vanguard.maxHp - opp.vanguard.hp);
      }

      const result = applyDamage(opp.vanguard, atk);

      // Archetype on-attack abilities
      if (lc.card.archetype === 'snitch' && opp.hand.length > 0) {
        const revIdx = Math.floor(Math.random() * opp.hand.length);
        opp.hand[revIdx].revealed = true;
      }
      if (lc.card.archetype === 'ghost' && p.vanguard) {
        p.vanguard.vanished = true;
      }
      if (lc.card.archetype === 'arsonist' && opp.hand.length > 0) {
        // 1 damage to next card in line
        const nextCard = opp.hand[0];
        nextCard.hp = Math.max(0, nextCard.hp - 1);
      }

      if (result.killed) {
        handleDeath(state, opSide, side);
      }
      break;
    }

    case 'sacrifice': {
      m.sacrifices++;
      state.consecutivePasses = 0;
      const idx = decision.indices[0];
      const lc = p.hand.splice(idx, 1)[0];
      p.discard.push(lc.card);

      if (p.vanguard) {
        const healAmt = getDef(lc.card, state.isNight);
        healCard(p.vanguard, healAmt, lc.card.archetype);
      }

      // FENCE: draw 2 instead of healing
      if (lc.card.archetype === 'fence') {
        drawCards(state, side, 2);
        m.sacrificeDraws += 2;
      }
      break;
    }

    case 'hustle': {
      m.hustles++;
      state.consecutivePasses = 0;
      if (p.vanguard) {
        p.vanguard.hp = Math.max(0, p.vanguard.hp - 2);
        if (p.vanguard.hp <= 0) {
          handleDeath(state, side, opSide);
          break;
        }
      }
      drawCards(state, side, 1);
      break;
    }

    case 'die': {
      m.dieRolls++;
      state.consecutivePasses = 0;
      const hasShield = (p.vanguard?.shield ?? 0) > 0;
      const result = rollDie(state.config.dieSize, p.hand.length, hasShield);
      if (result.hit) {
        m.dieHits++;
        if (result.target === 'hand' && result.cardIndex !== undefined) {
          const removed = p.hand.splice(result.cardIndex, 1)[0];
          p.discard.push(removed.card);
        } else if (result.target === 'vanguard' && p.vanguard) {
          p.vanguard.hp = Math.max(0, p.vanguard.hp - 2);
          m.dieVanguardHits++;
        }
      } else {
        if (result.target === 'shield_absorbed') {
          m.shieldSaves++;
          if (p.vanguard) p.vanguard.shield--;
        } else {
          m.dieMisses++;
        }
      }
      break;
    }

    default: {
      m.passes++;
      state.consecutivePasses++;
      if (state.consecutivePasses >= 2) {
        m.stallBreakers++;
        drawCards(state, 'A', 1);
        drawCards(state, 'B', 1);
        state.consecutivePasses = 0;
      }
    }
  }

  // Swap turn
  state.turnSide = opSide;
  return state.winner !== null;
}

// ── Public API ───────────────────────────────────────────────

/** Play a complete game between two AI-built decks. */
export function playCardGame(
  pool: CharacterCard[],
  config: CardGameConfig = DEFAULT_CARD_CONFIG,
): CardGameResult {
  const rngA = Math.random;
  const rngB = Math.random;

  const deckA = buildAiDeck(
    pool, config.deckSize, config.activeSize, config.reserveSize, rngA,
  );
  const deckB = buildAiDeck(
    pool, config.deckSize, config.activeSize, config.reserveSize, rngB,
  );

  const state = createState(deckA, deckB, config);

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

  return {
    winner: state.winner,
    endReason: state.endReason!,
    firstPlayer: state.firstPlayer,
    metrics: state.metrics,
    deckA: { conflicts: deckA.conflicts, synergies: deckA.synergies },
    deckB: { conflicts: deckB.conflicts, synergies: deckB.synergies },
  };
}
