// v0.3 scoring — draw / play_card(pending) / retreat / queued strike /
// modifier_swap / send_to_market / send_to_holding / black_market_*
// / end_turn. No `hand` anywhere. Queued strikes estimate outcome via
// applyTangibles + positionPower/Resistance. Heat is a shared cost
// multiplier on strikes (higher heat → higher raid probability, which
// punishes the attacker after combat resolves). v0.3 single-lane
// scorers live in scoring-v03.ts.
import { applyTangibles, hasTranscend } from '../abilities';
import {
  hasToughOnTurf,
  positionPower,
  positionResistance,
  toughCombatPower,
  toughCombatResistance,
  turfAffiliationConflict,
  turfCurrency,
  turfToughs,
} from '../board';
import { policyActionKey } from '../env-query';
import { resolveTargetToughIdx } from '../stack-ops';
import { topToughIdx } from '../stack-ops';
import type {
  Card,
  PlannerMemory,
  PlayerState,
  Turf,
  TurfAction,
  TurfGameState,
  TurfObservation,
  TurfPolicyArtifact,
} from '../types';
import { TURF_AI_CONFIG, TURF_SIM_CONFIG } from './config';
import { getPolicyValue, isPolicyPreferredAction } from './policy';
import {
  scoreBlackMarketHeal,
  scoreBlackMarketTrade,
  scoreModifierSwap,
  scoreSendToHolding,
  scoreSendToMarket,
} from './scoring-v03';

export interface ActionScore {
  score: number;
  policyUsed: boolean;
}

const NEG_INF = Number.NEGATIVE_INFINITY;

function pendingCard(
  p: PlayerState,
  cardId: string | undefined,
): Card | undefined {
  const c = p.pending;
  if (!c) return undefined;
  if (cardId && c.id !== cardId) return undefined;
  return c;
}

// Attacker-vs-defender dominance using tangible bonuses (cashBonus is
// the Pushed currency modifier). Uses individual tough combat stats (top
// attacker vs target defender) to match the actual resolveStrikeNow logic,
// avoiding the overestimate from positionPower which sums all toughs.
function strikeDominance(atk: Turf, def: Turf, cashBonus = 0): number {
  const bonus = applyTangibles(atk, def);
  const atkTopIdx = topToughIdx(atk);
  const defTargetIdx = resolveTargetToughIdx(def, atk);
  const P = Math.max(
    0,
    (atkTopIdx >= 0 ? toughCombatPower(atk, atkTopIdx) : 0) +
      cashBonus +
      bonus.atkPowerDelta,
  );
  const R = bonus.ignoreResistance
    ? 0
    : Math.max(
        0,
        (defTargetIdx >= 0 ? toughCombatResistance(def, defTargetIdx) : 0) +
          bonus.defResistDelta,
      );
  return P - R;
}

function resolveAttackTurfs(
  state: TurfGameState,
  action: TurfAction,
): { atk: Turf; def: Turf; atkP: PlayerState; defP: PlayerState } | null {
  if (action.turfIdx === undefined || action.targetTurfIdx === undefined)
    return null;
  const atkP = state.players[action.side];
  const defP = state.players[action.side === 'A' ? 'B' : 'A'];
  const atk = atkP.turfs[action.turfIdx];
  const def = defP.turfs[action.targetTurfIdx];
  if (!atk || !def) return null;
  if (atk.closedRanks) return null;
  if (!hasToughOnTurf(atk) || !hasToughOnTurf(def)) return null;
  return { atk, def, atkP, defP };
}

function scorePlayCard(
  state: TurfGameState,
  observation: TurfObservation,
  action: TurfAction,
): number {
  const sc = TURF_SIM_CONFIG.aiScoring;
  if (action.turfIdx === undefined) return NEG_INF;
  const player = state.players[action.side];
  const card = pendingCard(player, action.cardId);
  if (!card) return NEG_INF;
  const turf = player.turfs[action.turfIdx];
  if (!turf) return NEG_INF;

  if (card.kind === 'tough') {
    if (turfAffiliationConflict(turf, card)) return NEG_INF;
    let s = card.power + card.resistance * sc.placeCrewCrewResistanceWeight;
    s +=
      (observation.opponentToughsInPlay - observation.ownToughsInPlay) *
      sc.placeCrewDesperationWeight;
    if (turfToughs(turf).length === 0) s += sc.emptyTurfBonus;
    if (turfToughs(turf).some((t) => t.affiliation === card.affiliation))
      s += sc.affiliationSynergyBonus;
    return s;
  }

  if (card.kind === 'weapon' || card.kind === 'drug') {
    if (!hasToughOnTurf(turf)) return NEG_INF;
    let s =
      card.power * sc.modPowerWeight + card.resistance * sc.modResistanceWeight;
    if (positionPower(turf) > 0) s += sc.modOnPoweredTurfBonus;
    return s;
  }

  // currency
  if (!hasToughOnTurf(turf)) return NEG_INF;
  const cash =
    turfCurrency(turf).reduce((a, c) => a + c.denomination, 0) +
    card.denomination;
  let s = card.denomination / sc.currencyDenominationScale;
  s += cash >= sc.fundedThreshold ? sc.fundedReadyBonus : sc.currencyBaseScore;
  return s;
}

function scoreRetreat(state: TurfGameState, action: TurfAction): number {
  if (action.turfIdx === undefined || action.stackIdx === undefined)
    return NEG_INF;
  const turf = state.players[action.side].turfs[action.turfIdx];
  if (!turf || turf.stack.length < 2) return NEG_INF;
  const topIdx = turf.stack.length - 1;
  if (action.stackIdx === topIdx) return NEG_INF;
  const old = turf.stack[topIdx]?.card;
  const next = turf.stack[action.stackIdx]?.card;
  if (!old || !next || next.kind !== 'tough') return NEG_INF;
  const oldPow = old.kind === 'currency' ? 0 : old.power;
  const oldRes = old.kind === 'currency' ? 0 : old.resistance;
  // Swap shields weak top with a beefier behind-tough. Small floor keeps
  // a zero-delta lateral swap off the action-bar top. A Fixer Mythic
  // (hasTranscend) already ignores affiliation penalties, so retreat has
  // no strategic upside for it — dampen the score.
  let score = next.resistance - oldRes + (next.power - oldPow) - 0.5;
  const oldTough = old.kind === 'tough' ? old : null;
  if (oldTough && hasTranscend(oldTough)) score -= 1.5;
  return score;
}

function heatStrikePenalty(state: TurfGameState): number {
  // Strikes push the raider toward a post-resolve raid check; weight the
  // cost by shared heat. 0 heat → 0 penalty; 1.0 heat → -3 to any strike.
  return state.heat * 3;
}

function scoreDirect(state: TurfGameState, action: TurfAction): number {
  const sc = TURF_SIM_CONFIG.aiScoring;
  const aw = TURF_AI_CONFIG.tacticalWeights.attack;
  const combat = TURF_SIM_CONFIG.combat;
  const t = resolveAttackTurfs(state, action);
  if (!t) return NEG_INF;
  const margin = strikeDominance(t.atk, t.def);
  // Definite bust (individual P < individual R) → skip; don't queue
  // wasteful strikes that will 100% miss. Abilities (tangibles/intangibles)
  // can only modify the outcome AFTER the queue phase; checking the pre-ability
  // margin here avoids infinite bust loops on bad matchups. Note: abilities
  // that grant atkPowerDelta > 0 are already folded in via strikeDominance.
  if (margin < 0) return NEG_INF;
  let s = margin * aw.killMargin;
  if (margin >= 0) s += aw.seizeBonus;
  else if (
    positionPower(t.atk) >=
    Math.floor(positionResistance(t.def) / combat.sickThresholdDivisor)
  )
    s += sc.sickBonus;
  else s += sc.missPenalty;

  const defTop = topToughIdx(t.def);
  if (defTop >= 0) {
    const tc = t.def.stack[defTop].card;
    if (tc.kind === 'tough' && tc.resistance <= sc.lowResistanceThreshold)
      s += aw.lowResistanceBonus * sc.lowResistanceMultiplier;
  }
  if (t.defP.turfs.length <= 1) s += sc.lastTurfBonus;
  s -= heatStrikePenalty(state);
  return s;
}

function scorePushed(state: TurfGameState, action: TurfAction): number {
  const sc = TURF_SIM_CONFIG.aiScoring;
  const aw = TURF_AI_CONFIG.tacticalWeights.attack;
  const combat = TURF_SIM_CONFIG.combat;
  const t = resolveAttackTurfs(state, action);
  if (!t) return NEG_INF;
  const currency = turfCurrency(t.atk);
  if (currency.length === 0) return NEG_INF;

  const cashBonus = currency[0].denomination / combat.pushedDenominationScale;
  const margin = strikeDominance(t.atk, t.def, cashBonus);
  // Skip definite busts even with currency boost.
  if (margin < 0) return NEG_INF;
  let s = margin * aw.killMargin + aw.flipBonus + aw.splashBonus;
  if (margin >= 0) s += sc.pushedKillBonus;
  if (t.defP.turfs.length <= 1) s += sc.lastTurfBonus;
  s -= heatStrikePenalty(state);
  return s;
}

function scoreRecruit(state: TurfGameState, action: TurfAction): number {
  const sc = TURF_SIM_CONFIG.aiScoring;
  const aw = TURF_AI_CONFIG.tacticalWeights.attack;
  const combat = TURF_SIM_CONFIG.combat;
  const t = resolveAttackTurfs(state, action);
  if (!t) return NEG_INF;
  const totalCash = turfCurrency(t.atk).reduce((x, c) => x + c.denomination, 0);
  if (totalCash < combat.fundedRecruitMinCash) return NEG_INF;
  const tgtIdx = topToughIdx(t.def);
  if (tgtIdx < 0) return -5;
  const target = t.def.stack[tgtIdx].card;
  if (target.kind !== 'tough') return -5;

  const affMult = combat.affiliationMult as Record<string, number>;
  const atkAffs = turfToughs(t.atk).map((tt) => tt.affiliation);
  let mult = affMult.other;
  if (target.affiliation === 'freelance') mult = affMult.freelance;
  else if (atkAffs.includes(target.affiliation)) mult = affMult.same;
  else if (turfAffiliationConflict(t.atk, target)) mult = affMult.rival;

  const threshold = target.resistance * mult;
  let s: number;
  if (totalCash >= threshold) {
    s = aw.flipBonus + sc.fundedSuccessBonus + target.power;
    if (mult <= affMult.same) s += sc.fundedCheapAffinityBonus;
  } else {
    s = sc.fundedFailPenalty;
  }
  if (t.defP.turfs.length <= 1) s += sc.lastTurfBonus;
  s -= heatStrikePenalty(state);
  return s;
}

function scoreDraw(state: TurfGameState, action: TurfAction): number {
  const p = state.players[action.side];
  if (p.pending !== null || p.deck.length === 0) return NEG_INF;
  // Weight deck depth + remaining budget; extra nudge when the board is
  // empty so the AI actually starts a match by drawing.
  const deckTerm = p.deck.length * 0.3;
  const budgetTerm = Math.max(0, p.actionsRemaining - 1) * 0.4;
  const emptyBoardFloor = p.toughsInPlay === 0 ? 1.5 : 0;
  return deckTerm + budgetTerm + emptyBoardFloor;
}

function scoreDiscard(
  state: TurfGameState,
  observation: TurfObservation,
  action: TurfAction,
): number {
  const sc = TURF_SIM_CONFIG.aiScoring;
  const card = pendingCard(state.players[action.side], action.cardId);
  if (!card) return NEG_INF;
  let s = sc.discardBase;
  if (card.kind === 'currency' && card.denomination === 100)
    s += sc.discardCheapCurrencyBonus;
  if (observation.ownToughsInPlay === 0 && card.kind !== 'tough')
    s += sc.discardNoToughsBonus;
  return s;
}

export function scoreAction(
  state: TurfGameState,
  observation: TurfObservation,
  memory: PlannerMemory,
  action: TurfAction,
  policyArtifact?: TurfPolicyArtifact,
): ActionScore {
  const sc = TURF_SIM_CONFIG.aiScoring;
  const k = action.kind;
  let score = 0;
  if (k === 'draw') score = scoreDraw(state, action);
  else if (k === 'play_card') score = scorePlayCard(state, observation, action);
  else if (k === 'retreat') score = scoreRetreat(state, action);
  else if (k === 'direct_strike') score = scoreDirect(state, action);
  else if (k === 'pushed_strike') score = scorePushed(state, action);
  else if (k === 'funded_recruit') score = scoreRecruit(state, action);
  else if (k === 'discard') score = scoreDiscard(state, observation, action);
  else if (k === 'modifier_swap') score = scoreModifierSwap(state, action);
  else if (k === 'send_to_market') score = scoreSendToMarket(state, action);
  else if (k === 'send_to_holding') score = scoreSendToHolding(state, action);
  else if (k === 'black_market_trade')
    score = scoreBlackMarketTrade(state, action);
  else if (k === 'black_market_heal')
    score = scoreBlackMarketHeal(state, action);
  else if (k === 'end_turn') {
    score = sc.endTurnBase;
    if (observation.actionsRemaining <= 0) score += sc.endTurnNoActionsBonus;
  } else if (k === 'pass') {
    score = sc.passBasePenalty - memory.consecutivePasses;
  }
  if (score === NEG_INF) return { score, policyUsed: false };

  const key = policyActionKey(action);
  const learned = getPolicyValue(policyArtifact, observation.stateKey, key);
  const preferred = isPolicyPreferredAction(
    policyArtifact,
    observation.stateKey,
    key,
  );
  const pw = TURF_AI_CONFIG.policyWeights;
  score += learned * pw.valueMultiplier;
  if (preferred) score += pw.preferredBonus;
  return { score, policyUsed: preferred || learned !== 0 };
}

export function describeActionForTrace(action: TurfAction): string {
  const k = action.kind;
  if (k === 'draw' || k === 'end_turn' || k === 'pass') return k;
  if (k === 'play_card') return `play_card@${action.turfIdx}:${action.cardId}`;
  if (k === 'retreat') return `retreat@${action.turfIdx}:${action.stackIdx}`;
  if (k === 'discard') return `discard:${action.cardId}`;
  if (k === 'modifier_swap')
    return `modifier_swap@${action.turfIdx}:${action.toughId}->${action.targetToughId}:${action.cardId}`;
  if (k === 'send_to_market') return `send_to_market:${action.toughId}`;
  if (k === 'send_to_holding') return `send_to_holding:${action.toughId}`;
  if (k === 'black_market_trade')
    return `black_market_trade:${action.targetRarity}`;
  if (k === 'black_market_heal')
    return `black_market_heal:${action.healTarget}`;
  return `${k}@${action.turfIdx}->${action.targetTurfIdx}`;
}
