import { applyTangibles } from './abilities';
import { TURF_SIM_CONFIG } from './ai/config';
import {
  busted,
  chooseTarget,
  fmt,
  handleKill,
  mk,
  resolvePR,
  type StrikeResult,
} from './attack-helpers';
import {
  addToStack,
  positionPower,
  positionResistance,
  removeFromStack,
  setTopFaceUp,
  turfAffiliationConflict,
  turfCurrency,
  turfToughs,
} from './board';
import { topToughIdx, toughName } from './stack-ops';
import type {
  AttackOutcome,
  PlayerState,
  QueuedAction,
  ToughCard,
  Turf,
  TurfAction,
  TurfGameState,
} from './types';

export type { StrikeOutcome, StrikeResult } from './attack-helpers';

// ── Queue-phase: append to player.queued ───────────────────

/** Pure: validate & append a strike/recruit action to player.queued. */
export function queueStrike(player: PlayerState, action: TurfAction): void {
  if (
    action.kind !== 'direct_strike' &&
    action.kind !== 'pushed_strike' &&
    action.kind !== 'funded_recruit'
  ) {
    throw new Error(`queueStrike: unsupported kind "${action.kind}"`);
  }
  if (action.turfIdx === undefined || action.targetTurfIdx === undefined) {
    throw new Error('queueStrike: missing turfIdx/targetTurfIdx');
  }
  player.queued.push({
    kind: action.kind,
    side: action.side,
    turfIdx: action.turfIdx,
    targetTurfIdx: action.targetTurfIdx,
  });
}

// ── Strike core ────────────────────────────────────────────

function runStrike(
  atk: Turf,
  def: Turf,
  label: 'Strike' | 'Pushed',
  cashBonus: number,
  prefix: string,
): StrikeResult {
  const bonus = applyTangibles(atk, def);
  const P = Math.max(0, positionPower(atk) + cashBonus + bonus.atkPowerDelta);
  const R = bonus.ignoreResistance
    ? 0
    : Math.max(0, positionResistance(def) + bonus.defResistDelta);
  const notes: string[] = [];
  if (bonus.atkPowerDelta) notes.push(`+${bonus.atkPowerDelta} atk`);
  if (bonus.defResistDelta) notes.push(`+${bonus.defResistDelta} def`);
  if (bonus.ignoreResistance) notes.push('IGNORE-RES');

  const targetIdx = chooseTarget(atk, def, bonus.targetOverride);
  if (targetIdx < 0) return busted(`${label}: no tough to target`, notes);

  const name = toughName(def, targetIdx);
  const branch = resolvePR(P, R);

  if (branch === 'kill') {
    const r = handleKill(atk, def, targetIdx, label, bonus.sickOnHit, notes);
    return mk(
      'kill',
      `${prefix}${name} killed (${P} vs ${R})${fmt(notes)}`,
      {
        killedTough: r.k,
        transferredMods: r.transferred,
        discardedMods: r.discarded,
        sickedIdx: r.sickedIdx,
      },
      notes,
    );
  }

  if (branch === 'sick') {
    def.sickTopIdx = targetIdx;
    return mk(
      'sick',
      `${prefix}${name} sicked (${P} vs ${R})${fmt(notes)}`,
      { sickedIdx: targetIdx },
      notes,
    );
  }

  return busted(`${label} busted (${P} vs ${R})${fmt(notes)}`, notes);
}

// ── Direct / Pushed ────────────────────────────────────────

export function resolveDirectStrike(atk: Turf, def: Turf): StrikeResult {
  return runStrike(atk, def, 'Strike', 0, '');
}

export function resolvePushedStrike(atk: Turf, def: Turf): StrikeResult {
  const currency = turfCurrency(atk);
  if (currency.length === 0)
    return busted('No currency to spend on pushed strike');
  const spent = currency[0];
  const spentIdx = atk.stack.findIndex((e) => e.card === spent);
  removeFromStack(atk, spentIdx);
  const cashBonus =
    spent.denomination / TURF_SIM_CONFIG.combat.pushedDenominationScale;
  return runStrike(atk, def, 'Pushed', cashBonus, 'Pushed: ');
}

// ── Funded Recruit ─────────────────────────────────────────

type AffiliationRelation = 'freelance' | 'same' | 'rival' | 'other';

function classifyAffiliation(
  atk: Turf,
  target: ToughCard,
): AffiliationRelation {
  if (target.affiliation === 'freelance') return 'freelance';
  const atkAffs = turfToughs(atk).map((t) => t.affiliation);
  if (atkAffs.includes(target.affiliation)) return 'same';
  if (turfAffiliationConflict(atk, target)) return 'rival';
  return 'other';
}

const AFFILIATION_MULT = TURF_SIM_CONFIG.combat.affiliationMult as Record<
  AffiliationRelation,
  number
>;

export function resolveFundedRecruit(atk: Turf, def: Turf): StrikeResult {
  const currency = turfCurrency(atk);
  const totalCash = currency.reduce((s, c) => s + c.denomination, 0);
  const minCash = TURF_SIM_CONFIG.combat.fundedRecruitMinCash;

  if (totalCash < minCash) {
    return busted(
      `Not enough currency for funded recruit ($${totalCash} < $${minCash})`,
    );
  }

  let spent = 0;
  const toRemove: number[] = [];
  for (let i = 0; i < atk.stack.length && spent < minCash; i++) {
    const entry = atk.stack[i];
    if (entry.card.kind === 'currency') {
      spent += entry.card.denomination;
      toRemove.push(i);
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--)
    removeFromStack(atk, toRemove[i]);

  const targetIdx = topToughIdx(def);
  if (targetIdx < 0) return busted('No tough to recruit');

  const target = def.stack[targetIdx].card as ToughCard;
  const relation = classifyAffiliation(atk, target);
  const mult = AFFILIATION_MULT[relation];
  const threshold = target.resistance * mult;

  if (spent >= threshold) {
    removeFromStack(def, targetIdx);
    if (turfAffiliationConflict(atk, target)) {
      return mk(
        'kill',
        `Recruited ${target.name} but discarded — rival without buffer`,
        { discardedMods: [target] },
      );
    }
    addToStack(atk, target, false);
    return mk(
      'kill',
      `Recruited ${target.name} ($${spent} vs ${threshold}, ${relation} x${mult.toFixed(2)})`,
      { transferredMods: [target] },
    );
  }

  return busted(
    `Funded recruit failed ($${spent} < ${threshold}, ${relation} x${mult.toFixed(2)})`,
  );
}

// ── resolveStrikeNow (resolve-phase entry point) ───────────

/**
 * Resolve a single queued action. Flips defender top face-up, then
 * dispatches by kind. Seizure sweep is the caller's responsibility.
 */
export function resolveStrikeNow(
  state: TurfGameState,
  queued: QueuedAction,
): StrikeResult {
  const player = state.players[queued.side];
  const opp = state.players[queued.side === 'A' ? 'B' : 'A'];
  const aTurf = player.turfs[queued.turfIdx];
  const dTurf = opp.turfs[queued.targetTurfIdx];
  if (!aTurf || !dTurf) return busted('Turf no longer exists');
  setTopFaceUp(dTurf);
  if (queued.kind === 'direct_strike') return resolveDirectStrike(aTurf, dTurf);
  if (queued.kind === 'pushed_strike') return resolvePushedStrike(aTurf, dTurf);
  return resolveFundedRecruit(aTurf, dTurf);
}

// ── Legacy bridge ──────────────────────────────────────────

export function strikeToAttackOutcome(result: StrikeResult): AttackOutcome {
  const typeMap = {
    kill: 'kill' as const,
    sick: 'sick' as const,
    busted: 'busted' as const,
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
