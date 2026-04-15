import type { AttackOutcome, Card, Turf, ToughCard } from './types';
import {
  positionPower,
  positionResistance,
  turfToughs,
  turfCurrency,
  turfAffiliationConflict,
  addToStack,
  removeFromStack,
} from './board';
import {
  topToughIdx,
  toughBelowIdx,
  resolveTargetToughIdx,
  transferMods,
  killToughAtIdx,
  toughName,
} from './stack-ops';
import { TURF_SIM_CONFIG } from './ai/config';

// ── Result type ────────────────────────────────────────────

export type StrikeOutcome = 'kill' | 'sick' | 'busted';

export interface StrikeResult {
  outcome: StrikeOutcome;
  killedTough: ToughCard | null;
  transferredMods: Card[];
  discardedMods: Card[];
  sickedIdx: number | null;
  description: string;
}

// ── Direct Strike ──────────────────────────────────────────

export function resolveDirectStrike(
  attackerTurf: Turf,
  defenderTurf: Turf,
): StrikeResult {
  const P = positionPower(attackerTurf);
  const R = positionResistance(defenderTurf);
  const targetIdx = resolveTargetToughIdx(defenderTurf, attackerTurf);

  if (targetIdx < 0) {
    return {
      outcome: 'busted',
      killedTough: null,
      transferredMods: [],
      discardedMods: [],
      sickedIdx: null,
      description: 'No tough to target',
    };
  }

  const name = toughName(defenderTurf, targetIdx);

  if (P >= R) {
    const { tough, mods } = killToughAtIdx(defenderTurf, targetIdx);
    const { transferred, discarded } = transferMods(mods, attackerTurf);
    return {
      outcome: 'kill',
      killedTough: tough,
      transferredMods: transferred,
      discardedMods: discarded,
      sickedIdx: null,
      description: `${name} killed (${P} vs ${R})`,
    };
  }

  if (P >= Math.floor(R / TURF_SIM_CONFIG.combat.sickThresholdDivisor)) {
    defenderTurf.sickTopIdx = targetIdx;
    return {
      outcome: 'sick',
      killedTough: null,
      transferredMods: [],
      discardedMods: [],
      sickedIdx: targetIdx,
      description: `${name} sicked (${P} vs ${R})`,
    };
  }

  return {
    outcome: 'busted',
    killedTough: null,
    transferredMods: [],
    discardedMods: [],
    sickedIdx: null,
    description: `Strike busted (${P} vs ${R})`,
  };
}

// ── Pushed Strike ──────────────────────────────────────────

export function resolvePushedStrike(
  attackerTurf: Turf,
  defenderTurf: Turf,
): StrikeResult {
  const currency = turfCurrency(attackerTurf);
  if (currency.length === 0) {
    return {
      outcome: 'busted',
      killedTough: null,
      transferredMods: [],
      discardedMods: [],
      sickedIdx: null,
      description: 'No currency to spend on pushed strike',
    };
  }

  const spent = currency[0];
  const spentIdx = attackerTurf.stack.indexOf(spent);
  removeFromStack(attackerTurf, spentIdx);

  const cashBonus = spent.denomination / TURF_SIM_CONFIG.combat.pushedDenominationScale;
  const P = positionPower(attackerTurf) + cashBonus;
  const R = positionResistance(defenderTurf);
  const targetIdx = resolveTargetToughIdx(defenderTurf, attackerTurf);

  if (targetIdx < 0) {
    return {
      outcome: 'busted',
      killedTough: null,
      transferredMods: [],
      discardedMods: [],
      sickedIdx: null,
      description: 'No tough to target',
    };
  }

  const name = toughName(defenderTurf, targetIdx);

  if (P >= R) {
    const { tough, mods } = killToughAtIdx(defenderTurf, targetIdx);
    const { transferred, discarded } = transferMods(mods, attackerTurf);

    const beneathIdx = toughBelowIdx(defenderTurf, targetIdx);
    let sickedIdx: number | null = null;
    if (beneathIdx >= 0) {
      defenderTurf.sickTopIdx = beneathIdx;
      sickedIdx = beneathIdx;
    }

    return {
      outcome: 'kill',
      killedTough: tough,
      transferredMods: transferred,
      discardedMods: discarded,
      sickedIdx,
      description: `Pushed: ${name} killed (${P} vs ${R}), +${cashBonus} from $${spent.denomination}`,
    };
  }

  if (P >= Math.floor(R / TURF_SIM_CONFIG.combat.sickThresholdDivisor)) {
    defenderTurf.sickTopIdx = targetIdx;
    return {
      outcome: 'sick',
      killedTough: null,
      transferredMods: [],
      discardedMods: [],
      sickedIdx: targetIdx,
      description: `Pushed: ${name} sicked (${P} vs ${R})`,
    };
  }

  return {
    outcome: 'busted',
    killedTough: null,
    transferredMods: [],
    discardedMods: [],
    sickedIdx: null,
    description: `Pushed strike busted (${P} vs ${R})`,
  };
}

// ── Funded Recruit ─────────────────────────────────────────

type AffiliationRelation = 'freelance' | 'same' | 'rival' | 'other';

function classifyAffiliation(
  attackerTurf: Turf,
  targetTough: ToughCard,
): AffiliationRelation {
  if (targetTough.affiliation === 'freelance') return 'freelance';
  const attackerAffs = turfToughs(attackerTurf).map((t) => t.affiliation);
  if (attackerAffs.includes(targetTough.affiliation)) return 'same';
  if (turfAffiliationConflict(attackerTurf, targetTough)) return 'rival';
  return 'other';
}

const AFFILIATION_MULT = TURF_SIM_CONFIG.combat.affiliationMult as Record<AffiliationRelation, number>;

export function resolveFundedRecruit(
  attackerTurf: Turf,
  defenderTurf: Turf,
): StrikeResult {
  const currency = turfCurrency(attackerTurf);
  const totalCash = currency.reduce((sum, c) => sum + c.denomination, 0);

  const minCash = TURF_SIM_CONFIG.combat.fundedRecruitMinCash;
  if (totalCash < minCash) {
    return {
      outcome: 'busted',
      killedTough: null,
      transferredMods: [],
      discardedMods: [],
      sickedIdx: null,
      description: `Not enough currency for funded recruit ($${totalCash} < $${minCash})`,
    };
  }

  let spent = 0;
  const toRemove: number[] = [];
  for (let i = 0; i < attackerTurf.stack.length && spent < minCash; i++) {
    const card = attackerTurf.stack[i];
    if (card.kind === 'currency') {
      spent += card.denomination;
      toRemove.push(i);
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--) {
    removeFromStack(attackerTurf, toRemove[i]);
  }

  const targetIdx = topToughIdx(defenderTurf);
  if (targetIdx < 0) {
    return {
      outcome: 'busted',
      killedTough: null,
      transferredMods: [],
      discardedMods: [],
      sickedIdx: null,
      description: 'No tough to recruit',
    };
  }

  const targetTough = defenderTurf.stack[targetIdx] as ToughCard;
  const relation = classifyAffiliation(attackerTurf, targetTough);
  const mult = AFFILIATION_MULT[relation];
  const threshold = targetTough.resistance * mult;

  if (spent >= threshold) {
    removeFromStack(defenderTurf, targetIdx);
    addToStack(attackerTurf, targetTough);
    return {
      outcome: 'kill',
      killedTough: null,
      transferredMods: [targetTough],
      discardedMods: [],
      sickedIdx: null,
      description: `Recruited ${targetTough.name} ($${spent} vs ${threshold}, ${relation} ×${mult})`,
    };
  }

  return {
    outcome: 'busted',
    killedTough: null,
    transferredMods: [],
    discardedMods: [],
    sickedIdx: null,
    description: `Funded recruit failed ($${spent} < ${threshold}, ${relation} ×${mult})`,
  };
}

// ── Legacy bridge (AttackOutcome adapter) ──────────────────

export function strikeToAttackOutcome(result: StrikeResult): AttackOutcome {
  const typeMap: Record<StrikeOutcome, AttackOutcome['type']> = {
    kill: 'kill',
    sick: 'sick',
    busted: 'busted',
  };
  return {
    type: typeMap[result.outcome],
    targetIndices: result.sickedIdx != null ? [result.sickedIdx] : [],
    lostCards: result.discardedMods,
    gainedCards: [
      ...(result.killedTough ? [result.killedTough] : []),
      ...result.transferredMods,
    ],
    description: result.description,
  };
}
