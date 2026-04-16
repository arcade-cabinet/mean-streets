// v0.3 single-lane action scorers — modifier_swap, send_to_market,
// send_to_holding, black_market_trade, black_market_heal. Split from
// scoring.ts to honor the 300-LOC cap. These take the same
// (state, action) shape and return raw scores; scoring.ts handles
// policy augmentation and trace serialization.
import { hasImmunity, hasLaunder, hasLowProfile } from '../abilities';
import { modifiersByOwner, turfCurrency } from '../board';
import { combatBribeProbability } from '../holding';
import { RARITY_RANK } from '../market';
import type {
  ModifierCard,
  PlayerState,
  Rarity,
  ToughCard,
  Turf,
  TurfAction,
  TurfGameState,
} from '../types';

const NEG_INF = Number.NEGATIVE_INFINITY;

function findToughLocation(
  player: PlayerState,
  toughId: string,
): { turf: Turf; turfIdx: number; tough: ToughCard } | null {
  for (let ti = 0; ti < player.turfs.length; ti++) {
    const turf = player.turfs[ti];
    for (const sc of turf.stack) {
      if (sc.card.kind === 'tough' && sc.card.id === toughId) {
        return { turf, turfIdx: ti, tough: sc.card };
      }
    }
  }
  return null;
}

function rarityBoost(r: Rarity): number {
  return RARITY_RANK[r] ?? 1;
}

function effectiveToughValue(tough: ToughCard): number {
  return tough.power + tough.resistance;
}

export function scoreSendToMarket(
  state: TurfGameState,
  action: TurfAction,
): number {
  if (!action.toughId) return NEG_INF;
  const player = state.players[action.side];
  const loc = findToughLocation(player, action.toughId);
  if (!loc) return NEG_INF;
  // Immunity mythics cannot be voluntarily displaced — don't even consider.
  if (hasImmunity(loc.tough)) return NEG_INF;

  const mods = modifiersByOwner(loc.turf, action.toughId);
  const modRarityScore = mods.reduce<number>(
    (a, m) => a + rarityBoost(m.rarity),
    0,
  );
  // Sacrificing a healthy, capable tough is expensive. Wounded toughs
  // with strong attached mods are natural market candidates.
  const sacrificeCost =
    effectiveToughValue(loc.tough) *
    (loc.tough.hp / Math.max(1, loc.tough.maxHp));
  return 0.8 * modRarityScore - sacrificeCost;
}

export function scoreSendToHolding(
  state: TurfGameState,
  action: TurfAction,
): number {
  if (!action.toughId) return NEG_INF;
  const player = state.players[action.side];
  const loc = findToughLocation(player, action.toughId);
  if (!loc) return NEG_INF;
  // Immunity mythics bypass custody routes; don't propose.
  if (hasImmunity(loc.tough)) return NEG_INF;

  // Heat contribution estimate: rarity coefficient, halved if LOW_PROFILE
  // sits on the tough or any Launder carrier on the turf.
  const rarityHeat = rarityBoost(loc.tough.rarity) * 0.1;
  const lowProf = hasLowProfile(loc.tough) || hasLaunder(loc.turf);
  const heatContribution = lowProf ? rarityHeat * 0.5 : rarityHeat;

  // Bribe expected-success is a persuasion proxy — higher cash on board
  // feeds the combat-bribe probability curve (RULES §10.3).
  const cash = turfCurrency(loc.turf).reduce((a, c) => a + c.denomination, 0);
  const bribeExpected = combatBribeProbability(cash);
  return heatContribution * 0.6 + bribeExpected * 0.4;
}

export function scoreModifierSwap(
  state: TurfGameState,
  action: TurfAction,
): number {
  if (!action.toughId || !action.targetToughId) return NEG_INF;
  const player = state.players[action.side];
  const fromLoc = findToughLocation(player, action.toughId);
  const toLoc = findToughLocation(player, action.targetToughId);
  if (!fromLoc || !toLoc) return NEG_INF;
  const source = fromLoc.tough;
  const target = toLoc.tough;
  // Crude prior: if destination has a stronger baseline (power+resistance),
  // the mod contributes more there. Refined over time by policy learning.
  const delta =
    target.power + target.resistance - (source.power + source.resistance);
  return delta * 0.1;
}

function findMarketCard(
  state: TurfGameState,
  targetRarity: Rarity | undefined,
): ModifierCard | null {
  if (!targetRarity) return null;
  for (const m of state.blackMarket) {
    if (m.rarity === targetRarity) return m;
  }
  return null;
}

export function scoreBlackMarketTrade(
  state: TurfGameState,
  action: TurfAction,
): number {
  if (!action.offeredMods || action.offeredMods.length === 0) return NEG_INF;
  if (!action.targetRarity) return NEG_INF;
  const offeredCount = action.offeredMods.length;
  const gain = rarityBoost(action.targetRarity);
  // Cost: you give up offeredCount commons/uncommons/etc. If the market
  // actually has a matching target-rarity card, this is a straight upgrade.
  const matchBonus = findMarketCard(state, action.targetRarity) ? 1.5 : 0;
  return gain - offeredCount * 0.6 + matchBonus;
}

export function scoreBlackMarketHeal(
  state: TurfGameState,
  action: TurfAction,
): number {
  if (!action.healTarget) return NEG_INF;
  if (!action.offeredMods || action.offeredMods.length === 0) return NEG_INF;
  const player = state.players[action.side];
  const loc = findToughLocation(player, action.healTarget);
  if (!loc) return NEG_INF;
  const tough = loc.tough;
  if (tough.rarity === 'mythic') return NEG_INF; // mythics cannot be healed
  const missing = 1 - tough.hp / Math.max(1, tough.maxHp);
  return missing * effectiveToughValue(tough) * 0.5;
}
