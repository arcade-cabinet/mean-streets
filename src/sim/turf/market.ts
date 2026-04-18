import { TURF_SIM_CONFIG } from './ai/config';
import { modifiersByOwner } from './board';
import { killToughAtIdx } from './stack-ops';
import type {
  ModifierCard,
  PlayerState,
  Rarity,
  TurfGameState,
} from './types';

const MARKET_CONFIG = TURF_SIM_CONFIG.market;

const RARITY_RANK: Record<Rarity, number> = {
  common: 1, uncommon: 2, rare: 3, legendary: 4, mythic: 5,
};

function findTough(
  player: PlayerState, toughId: string,
): { turfIdx: number; stackIdx: number } | null {
  for (let ti = 0; ti < player.turfs.length; ti++) {
    const turf = player.turfs[ti];
    for (let si = 0; si < turf.stack.length; si++) {
      const entry = turf.stack[si];
      if (entry.card.kind === 'tough' && entry.card.id === toughId)
        return { turfIdx: ti, stackIdx: si };
    }
  }
  return null;
}

/** Send a tough + its modifiers from the active turf to the Black Market.
 *  The tough itself leaves play (no graveyard routing); its modifiers join the pool. */
export function sendToMarket(
  state: TurfGameState, side: 'A' | 'B', toughId: string,
): void {
  const player = state.players[side];
  const located = findTough(player, toughId);
  if (!located) return;
  const turf = player.turfs[located.turfIdx];
  const { mods } = killToughAtIdx(turf, located.stackIdx);
  for (const mod of mods) {
    if (mod.kind !== 'tough') state.blackMarket.push(mod as ModifierCard);
  }
  if (player.toughsInPlay > 0) player.toughsInPlay--;
}

function popMods(
  state: TurfGameState, ids: string[],
): ModifierCard[] {
  const out: ModifierCard[] = [];
  for (const id of ids) {
    const idx = state.blackMarket.findIndex((m) => m.id === id);
    if (idx >= 0) {
      out.push(state.blackMarket[idx]);
      state.blackMarket.splice(idx, 1);
    }
  }
  return out;
}

function nextRarity(r: Rarity): Rarity | null {
  if (r === 'common') return 'uncommon';
  if (r === 'uncommon') return 'rare';
  if (r === 'rare') return 'legendary';
  return null;
}

/**
 * Trade N offered modifiers in the Black Market for one higher-tier mod.
 * Pyramid: 2 commons → uncommon; 2 uncommons → rare; 2 rares → legendary.
 * Adding $1000 bribe currency promotes the result by one extra tier.
 */
export function tradeAtMarket(
  state: TurfGameState, _side: 'A' | 'B',
  offeredModIds: string[], targetRarity: Rarity,
): ModifierCard | null {
  if (offeredModIds.length !== MARKET_CONFIG.tradePairs) return null;
  const consumed = popMods(state, offeredModIds);
  if (consumed.length !== MARKET_CONFIG.tradePairs) {
    for (const m of consumed) state.blackMarket.push(m);
    return null;
  }
  const base = consumed[0].rarity;
  if (!consumed.every((m) => m.rarity === base)) {
    for (const m of consumed) state.blackMarket.push(m);
    return null;
  }
  const oneUp = nextRarity(base);
  if (!oneUp) return null;
  const twoUp = nextRarity(oneUp);
  if (targetRarity !== oneUp && targetRarity !== twoUp) return null;
  const promoted: ModifierCard = {
    ...consumed[0],
    id: `${consumed[0].id}-traded`,
    rarity: targetRarity,
  } as ModifierCard;
  return promoted;
}

/**
 * Heal a wounded tough by sacrificing modifiers at the market.
 *   1 common → +2 HP; 2 matching-rarity commons/uncommons/rares/legendaries
 *   → full heal of a tough of that rarity. Mythics cannot be healed.
 */
export function healAtMarket(
  state: TurfGameState, side: 'A' | 'B',
  toughId: string, offeredModIds: string[],
): boolean {
  const player = state.players[side];
  const located = findTough(player, toughId);
  if (!located) return false;
  const turf = player.turfs[located.turfIdx];
  const entry = turf.stack[located.stackIdx];
  if (entry.card.kind !== 'tough') return false;
  const tough = entry.card;
  if (tough.rarity === 'mythic') return false;

  const consumed = popMods(state, offeredModIds);
  if (consumed.length === 0) return false;

  if (
    consumed.length === MARKET_CONFIG.healCostSmall.sacrificeCount &&
    consumed.every((m) => m.rarity === MARKET_CONFIG.healCostSmall.tierSacrifice)
  ) {
    tough.hp = Math.min(tough.maxHp, tough.hp + MARKET_CONFIG.healCostSmall.hpGain);
    return true;
  }
  if (
    consumed.length === MARKET_CONFIG.healFullSacrifice &&
    consumed.every((m) => m.rarity === tough.rarity)
  ) {
    tough.hp = tough.maxHp;
    return true;
  }
  for (const m of consumed) state.blackMarket.push(m);
  return false;
}

/** Placeholder: market-return is implicit in sendToMarket (routes to discard). */
export function returnFromMarket(
  _state: TurfGameState, _side: 'A' | 'B', _toughId: string,
): void { /* no-op */ }

/** Wipe the shared Black Market pool (triggered by raid). */
export function wipeMarket(state: TurfGameState): void {
  state.blackMarket.length = 0;
}

/** Total currency on a given turf — used for bail/bribe checks. */
export function turfCashTotal(player: PlayerState, turfIdx: number): number {
  const turf = player.turfs[turfIdx];
  if (!turf) return 0;
  let sum = 0;
  for (const sc of turf.stack) {
    if (sc.card.kind === 'currency') sum += sc.card.denomination;
  }
  return sum;
}

/** Modifiers attached to a tough on its home turf. */
export function modsBelongingTo(
  state: TurfGameState, side: 'A' | 'B', toughId: string,
): ModifierCard[] {
  const located = findTough(state.players[side], toughId);
  if (!located) return [];
  return modifiersByOwner(state.players[side].turfs[located.turfIdx], toughId);
}

export { RARITY_RANK };
