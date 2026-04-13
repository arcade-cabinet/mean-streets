/**
 * Game simulation with single-power character cards.
 * Random deck pulls, ability-driven combat, outlier detection.
 */

import type { CharacterCard } from './schemas';
import { createLiveCard, calcDamage, canAttack, applyDamage, rollDie, type LiveCard } from './combat';
import { createEmptyMetrics, type GameMetrics } from '../types';
import { createRng, randomSeed, type Rng } from './rng';

export interface CardGameConfig {
  precisionMult: number;
  handMax: number;
  dieSize: number;
  maxTurns: number;
  deckSize: number;
  reserveSize: number;
}

export const DEFAULT_CARD_CONFIG: CardGameConfig = {
  precisionMult: 3.0,
  handMax: 5,
  dieSize: 6,
  maxTurns: 200,
  deckSize: 20,
  reserveSize: 3,
};

interface PlayerState {
  drawPile: LiveCard[];
  hand: LiveCard[];
  vanguard: LiveCard | null;
  reserves: LiveCard[];
  discard: CharacterCard[];
}

interface GameState {
  config: CardGameConfig;
  players: { A: PlayerState; B: PlayerState };
  turnSide: 'A' | 'B';
  firstPlayer: 'A' | 'B';
  turnNumber: number;
  consecutivePasses: number;
  metrics: GameMetrics;
  winner: 'A' | 'B' | null;
  endReason: string | null;
  rng: Rng;
  gameSeed: number;
}

export interface CardGameResult {
  winner: 'A' | 'B';
  endReason: string;
  firstPlayer: 'A' | 'B';
  turnCount: number;
  metrics: GameMetrics;
  seed: number;
}

function buildRandomDeck(pool: CharacterCard[], deckSize: number, reserveSize: number, rng: Rng) {
  const unlocked = pool.filter(c => c.unlocked);
  const shuffled = rng.shuffle([...unlocked]);
  const picked = shuffled.slice(0, deckSize);
  const reserves = picked.splice(picked.length - reserveSize, reserveSize);
  return { active: picked, reserves };
}

function createState(pool: CharacterCard[], config: CardGameConfig, seed: number): GameState {
  const rng = createRng(seed);
  const deckA = buildRandomDeck(pool, config.deckSize, config.reserveSize, rng);
  const deckB = buildRandomDeck(pool, config.deckSize, config.reserveSize, rng);
  const first: 'A' | 'B' = rng.next() < 0.5 ? 'A' : 'B';

  function initPlayer(deck: { active: CharacterCard[]; reserves: CharacterCard[] }): PlayerState {
    const pile = rng.shuffle(deck.active.map(c => createLiveCard(c)));
    const van = pile.pop()!;
    const hand: LiveCard[] = [];
    for (let i = 0; i < 4 && pile.length > 0; i++) hand.push(pile.pop()!);
    return {
      drawPile: pile,
      hand,
      vanguard: van,
      reserves: deck.reserves.map(c => createLiveCard(c)),
      discard: [],
    };
  }

  return {
    config,
    players: { A: initPlayer(deckA), B: initPlayer(deckB) },
    turnSide: first,
    firstPlayer: first,
    turnNumber: 0,
    consecutivePasses: 0,
    metrics: createEmptyMetrics(),
    winner: null,
    endReason: null,
    rng,
    gameSeed: seed,
  };
}

/** Draw cards. Returns overdraw count. */
function draw(state: GameState, side: 'A' | 'B', count: number): number {
  const p = state.players[side];
  let overdraw = 0;
  for (let i = 0; i < count; i++) {
    let card: LiveCard | undefined;
    if (p.drawPile.length > 0) card = p.drawPile.pop();
    else if (p.reserves.length > 0) card = p.reserves.pop();
    if (!card) break;
    p.hand.push(card);
    if (p.hand.length > state.config.handMax) {
      overdraw++;
      state.metrics.overdrawPenalties++;
      const forced = p.hand.shift()!;
      if (p.vanguard) p.discard.push(p.vanguard.card);
      p.vanguard = createLiveCard(forced.card);
    }
  }
  return overdraw;
}

function handleDeath(state: GameState, deadSide: 'A' | 'B', killerSide: 'A' | 'B'): void {
  const dead = state.players[deadSide];
  const m = state.metrics;
  m.vanguardDeaths++;
  if (killerSide === 'A') m.killsByA++; else m.killsByB++;

  if (dead.vanguard) {
    dead.discard.push(dead.vanguard.card);
    dead.vanguard = null;
  }

  // Kill bounty
  draw(state, killerSide, 2);

  // HUSTLER steal on kill
  const killer = state.players[killerSide];
  if (killer.hand.some(lc => lc.card.archetype === 'hustler') && dead.hand.length > 0) {
    const stealIdx = Math.floor(state.rng.next() * dead.hand.length);
    const stolen = dead.hand.splice(stealIdx, 1)[0];
    killer.hand.push(stolen);
  }

  // Check starvation
  const totalCards = dead.hand.length + dead.drawPile.length + dead.reserves.length;
  if (totalCards === 0) {
    state.winner = killerSide;
    state.endReason = 'starvation';
    return;
  }

  // Promote — highest power from hand, then reserves, then draw pile
  if (dead.hand.length > 0) {
    let bestIdx = 0;
    dead.hand.forEach((lc, i) => { if (lc.card.power > dead.hand[bestIdx].card.power) bestIdx = i; });
    dead.vanguard = createLiveCard(dead.hand.splice(bestIdx, 1)[0].card);
  } else if (dead.reserves.length > 0) {
    dead.vanguard = dead.reserves.pop()!;
  } else if (dead.drawPile.length > 0) {
    dead.vanguard = dead.drawPile.pop()!;
  } else {
    state.winner = killerSide;
    state.endReason = 'starvation';
  }
}

function aiDecide(state: GameState, side: 'A' | 'B') {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  if (!p.vanguard || !opp.vanguard) return { action: 'pass' as const, idx: -1 };

  // Check Ghost in reserves — can attack directly
  const ghostReserve = p.reserves.findIndex(
    lc => lc.card.archetype === 'ghost' && canAttack(lc.card, opp.vanguard!.hp, state.config.precisionMult),
  );
  if (ghostReserve >= 0) {
    return { action: 'ghost_attack' as const, idx: ghostReserve };
  }

  // Find valid attacks
  const attacks: Array<{ idx: number; dmg: number }> = [];
  p.hand.forEach((lc, i) => {
    if (canAttack(lc.card, opp.vanguard!.hp, state.config.precisionMult)) {
      const dmg = calcDamage(lc.card, opp.vanguard!.card, p.hand.length, opp.hand.length, opp.vanguard!.maxHp - opp.vanguard!.hp);
      attacks.push({ idx: i, dmg });
    }
  });

  // Lethal first
  const lethals = attacks.filter(a => a.dmg >= opp.vanguard!.hp);
  if (lethals.length > 0) {
    lethals.sort((a, b) => a.dmg - b.dmg);
    return { action: 'attack' as const, idx: lethals[0].idx };
  }

  // Best damage
  if (attacks.length > 0) {
    attacks.sort((a, b) => b.dmg - a.dmg);
    return { action: 'attack' as const, idx: attacks[0].idx };
  }

  // Precision locked
  if (p.hand.length > 0) state.metrics.precisionLocks++;

  // Sniper — target opponent hand
  const sniper = p.hand.findIndex(lc => lc.card.archetype === 'sniper');
  if (sniper >= 0 && opp.hand.length > 0) {
    return { action: 'sniper' as const, idx: sniper };
  }

  // Fence sacrifice — draw 2 (high priority when locked)
  const fence = p.hand.findIndex(lc => lc.card.archetype === 'fence');
  if (fence >= 0) return { action: 'sacrifice' as const, idx: fence };

  // Die roll when precision-locked and have any cards
  if (p.hand.length > 0 && state.config.dieSize > 0) {
    return { action: 'die' as const, idx: -1 };
  }

  // Sacrifice lowest to heal
  if (p.hand.length > 0 && p.vanguard.hp < p.vanguard.maxHp * 0.7) {
    let worst = 0;
    p.hand.forEach((lc, i) => { if (lc.card.power < p.hand[worst].card.power) worst = i; });
    return { action: 'sacrifice' as const, idx: worst };
  }

  // Hustle — more aggressive: do it if HP > 2 (not 3) and have draw pile
  if (p.vanguard.hp > 2 && p.hand.length < state.config.handMax && (p.drawPile.length > 0 || p.reserves.length > 0)) {
    return { action: 'hustle' as const, idx: -1 };
  }

  // Last resort sacrifice
  if (p.hand.length > 0) {
    return { action: 'sacrifice' as const, idx: 0 };
  }

  return { action: 'pass' as const, idx: -1 };
}

function executeTurn(state: GameState): boolean {
  const side = state.turnSide;
  const opSide: 'A' | 'B' = side === 'A' ? 'B' : 'A';
  const p = state.players[side];
  const opp = state.players[opSide];
  const m = state.metrics;

  state.turnNumber++;
  m.turns++;

  // Exhaustion check
  for (const s of ['A', 'B'] as const) {
    const pl = state.players[s];
    const empty = !pl.vanguard && pl.hand.length === 0 && pl.drawPile.length === 0 && pl.reserves.length === 0;
    if (empty) {
      state.winner = s === 'A' ? 'B' : 'A';
      state.endReason = 'starvation';
      return true;
    }
  }
  // Both exhausted
  const aEmpty = p.drawPile.length === 0 && p.hand.length === 0 && p.reserves.length === 0;
  const bEmpty = opp.drawPile.length === 0 && opp.hand.length === 0 && opp.reserves.length === 0;
  if (aEmpty && bEmpty) {
    const hpA = state.players.A.vanguard?.hp ?? 0;
    const hpB = state.players.B.vanguard?.hp ?? 0;
    state.winner = hpA >= hpB ? 'A' : 'B';
    state.endReason = 'exhaustion';
    return true;
  }

  const d = aiDecide(state, side);

  switch (d.action) {
    case 'attack': {
      m.attacks++;
      state.consecutivePasses = 0;
      const lc = p.hand.splice(d.idx, 1)[0];
      p.discard.push(lc.card);
      if (!opp.vanguard) break;
      const dmg = calcDamage(lc.card, opp.vanguard.card, p.hand.length, opp.hand.length, opp.vanguard.maxHp - opp.vanguard.hp);
      // ARSONIST: also hit top of draw pile
      if (lc.card.archetype === 'arsonist' && opp.drawPile.length > 0) {
        const top = opp.drawPile[opp.drawPile.length - 1];
        top.hp = Math.max(0, top.hp - 2);
      }
      if (applyDamage(opp.vanguard, dmg)) handleDeath(state, opSide, side);
      break;
    }
    case 'ghost_attack': {
      m.attacks++;
      state.consecutivePasses = 0;
      const lc = p.reserves.splice(d.idx, 1)[0];
      p.discard.push(lc.card);
      if (!opp.vanguard) break;
      const dmg = lc.card.power;
      if (applyDamage(opp.vanguard, dmg)) handleDeath(state, opSide, side);
      break;
    }
    case 'sniper': {
      m.attacks++;
      state.consecutivePasses = 0;
      const lc = p.hand.splice(d.idx, 1)[0];
      p.discard.push(lc.card);
      if (opp.hand.length > 0) {
        // Target highest power card in opponent hand
        let bestIdx = 0;
        opp.hand.forEach((h, i) => { if (h.card.power > opp.hand[bestIdx].card.power) bestIdx = i; });
        const target = opp.hand[bestIdx];
        if (applyDamage(target, lc.card.power)) {
          opp.discard.push(opp.hand.splice(bestIdx, 1)[0].card);
        }
      }
      break;
    }
    case 'sacrifice': {
      m.sacrifices++;
      state.consecutivePasses = 0;
      const lc = p.hand.splice(d.idx, 1)[0];
      p.discard.push(lc.card);
      if (lc.card.archetype === 'fence') {
        draw(state, side, 2);
        m.sacrificeDraws += 2;
      } else if (p.vanguard) {
        const heal = lc.card.archetype === 'medic' ? lc.card.power * 2 : lc.card.power;
        p.vanguard.hp = Math.min(p.vanguard.maxHp, p.vanguard.hp + heal);
      }
      break;
    }
    case 'hustle': {
      m.hustles++;
      state.consecutivePasses = 0;
      if (p.vanguard) {
        p.vanguard.hp -= 2;
        if (p.vanguard.hp <= 0) { handleDeath(state, side, opSide); break; }
      }
      draw(state, side, 1);
      break;
    }
    case 'die': {
      m.dieRolls++;
      state.consecutivePasses = 0;
      const hasShield = (p.vanguard?.shield ?? 0) > 0;
      const r = rollDie(state.config.dieSize, p.hand.length, hasShield, state.rng);
      if (r.hit) {
        m.dieHits++;
        if (r.target === 'hand' && r.cardIndex !== undefined) {
          p.discard.push(p.hand.splice(r.cardIndex, 1)[0].card);
        } else if (r.target === 'vanguard' && p.vanguard) {
          p.vanguard.hp = Math.max(0, p.vanguard.hp - 2);
          m.dieVanguardHits++;
        }
      } else { m.dieMisses++; }
      break;
    }
    default: {
      m.passes++;
      state.consecutivePasses++;
      // Passing = you draw 1 (costs your action but restocks)
      const canDraw = p.drawPile.length > 0 || p.reserves.length > 0;
      if (canDraw) {
        draw(state, side, 1);
      }
      // Both pass with nothing to draw = exhaustion
      if (state.consecutivePasses >= 2) {
        const canA = state.players.A.drawPile.length > 0 || state.players.A.reserves.length > 0
          || state.players.A.hand.length > 0;
        const canB = state.players.B.drawPile.length > 0 || state.players.B.reserves.length > 0
          || state.players.B.hand.length > 0;
        if (!canA && !canB) {
          const hpA = state.players.A.vanguard?.hp ?? 0;
          const hpB = state.players.B.vanguard?.hp ?? 0;
          state.winner = hpA >= hpB ? 'A' : 'B';
          state.endReason = 'exhaustion';
          break;
        }
        state.consecutivePasses = 0;
      }
    }
  }

  state.turnSide = opSide;
  return state.winner !== null;
}

export function playCardGame(
  pool: CharacterCard[],
  config = DEFAULT_CARD_CONFIG,
  seed?: number,
): CardGameResult {
  const gameSeed = seed ?? randomSeed();
  const state = createState(pool, config, gameSeed);
  while (!state.winner && state.turnNumber < config.maxTurns) executeTurn(state);
  if (!state.winner) {
    const hpA = state.players.A.vanguard?.hp ?? 0;
    const hpB = state.players.B.vanguard?.hp ?? 0;
    state.winner = hpA >= hpB ? 'A' : 'B';
    state.endReason = 'stall';
  }
  return {
    winner: state.winner,
    endReason: state.endReason!,
    firstPlayer: state.firstPlayer,
    turnCount: state.turnNumber,
    metrics: state.metrics,
    seed: gameSeed,
  };
}
