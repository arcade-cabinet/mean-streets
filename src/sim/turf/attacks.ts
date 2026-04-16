import { applyTangibles } from './abilities';
import { TURF_SIM_CONFIG } from './ai/config';
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
import { resolveTargetToughIdx, topToughIdx, toughName } from './stack-ops';
import type {
  AttackOutcome,
  Card,
  PlayerState,
  QueuedAction,
  ToughCard,
  Turf,
  TurfAction,
  TurfGameState,
} from './types';

// ── Outcome model (v0.3 tiered damage) ─────────────────────
export type StrikeOutcome =
  | 'kill' | 'wound' | 'serious_wound' | 'crushing' | 'busted';

export interface StrikeResult {
  outcome: StrikeOutcome;
  killedTough: ToughCard | null;
  transferredMods: Card[];
  discardedMods: Card[];
  damage: number;
  targetToughId: string | null;
  sickedIdx: number | null;
  description: string;
  abilityNotes?: string[];
}

const D = TURF_SIM_CONFIG.damageTiers;

function mk(
  outcome: StrikeOutcome,
  description: string,
  extra: Partial<StrikeResult> = {},
  notes: string[] = [],
): StrikeResult {
  return {
    outcome,
    killedTough: extra.killedTough ?? null,
    transferredMods: extra.transferredMods ?? [],
    discardedMods: extra.discardedMods ?? [],
    damage: extra.damage ?? 0,
    targetToughId: extra.targetToughId ?? null,
    sickedIdx: extra.sickedIdx ?? null,
    description,
    abilityNotes: notes.length ? notes : undefined,
  };
}

const busted = (d: string, n: string[] = []) => mk('busted', d, {}, n);

// ── Queue-phase ────────────────────────────────────────────
export function queueStrike(player: PlayerState, action: TurfAction): void {
  if (action.kind !== 'direct_strike' && action.kind !== 'pushed_strike' &&
      action.kind !== 'funded_recruit') {
    throw new Error(`queueStrike: unsupported kind "${action.kind}"`);
  }
  if (action.turfIdx === undefined || action.targetTurfIdx === undefined)
    throw new Error('queueStrike: missing turfIdx/targetTurfIdx');
  player.queued.push({
    kind: action.kind, side: action.side,
    turfIdx: action.turfIdx, targetTurfIdx: action.targetTurfIdx,
  });
}

// ── Damage calculation per RULES §7 ────────────────────────
export function computeDamage(P: number, R: number): {
  outcome: StrikeOutcome; damage: number;
} {
  if (P < R) return { outcome: 'busted', damage: 0 };
  if (R > 0 && P >= R * D.instantKillRatio) return { outcome: 'kill', damage: 9999 };
  if (R > 0 && P >= R * D.crushingRatio)
    return { outcome: 'crushing', damage: Math.max(D.minDamage, P - R + D.crushingBonus) };
  if (R > 0 && P >= R * D.seriousRatio)
    return { outcome: 'serious_wound', damage: Math.max(D.minDamage, P - R + D.seriousBonus) };
  return { outcome: 'wound', damage: Math.max(D.minDamage, P - R + D.woundBonus) };
}

function chooseTarget(
  atk: Turf, def: Turf, override: 'bottom' | 'anywhere' | null,
): number {
  if (override === 'bottom') {
    for (let i = 0; i < def.stack.length; i++) {
      const c = def.stack[i].card;
      if (c.kind === 'tough' && c.hp > 0) return i;
    }
    return -1;
  }
  if (override === 'anywhere') {
    let bestIdx = -1; let bestR = Number.POSITIVE_INFINITY;
    for (let i = def.stack.length - 1; i >= 0; i--) {
      const c = def.stack[i].card;
      if (c.kind === 'tough' && c.hp > 0 && c.resistance < bestR) {
        bestR = c.resistance; bestIdx = i;
      }
    }
    return bestIdx;
  }
  return resolveTargetToughIdx(def, atk);
}

// ── Strike core ────────────────────────────────────────────
function runStrike(
  atk: Turf, def: Turf, label: string, cashBonus: number,
): StrikeResult {
  const bonus = applyTangibles(atk, def);
  const P = Math.max(0, positionPower(atk) + cashBonus + bonus.atkPowerDelta);
  const R = bonus.ignoreResistance ? 0
    : Math.max(0, positionResistance(def) + bonus.defResistDelta);
  const notes: string[] = [];
  if (bonus.atkPowerDelta) notes.push(`+${bonus.atkPowerDelta} atk`);
  if (bonus.defResistDelta) notes.push(`+${bonus.defResistDelta} def`);
  if (bonus.ignoreResistance) notes.push('IGNORE-RES');

  const targetIdx = chooseTarget(atk, def, bonus.targetOverride);
  if (targetIdx < 0) return busted(`${label}: no tough to target`, notes);
  const targetEntry = def.stack[targetIdx];
  if (!targetEntry || targetEntry.card.kind !== 'tough')
    return busted(`${label}: target slot empty`, notes);
  const target = targetEntry.card;
  const name = toughName(def, targetIdx);

  const { outcome, damage } = computeDamage(P, R);
  if (outcome === 'busted')
    return busted(`${label} busted (${P} vs ${R})`, notes);

  target.hp = Math.max(0, target.hp - damage);
  if (target.hp <= 0 || outcome === 'kill') {
    const k = applyKill(atk, def, targetIdx, bonus.sickOnHit, notes);
    return mk('kill',
      `${label}: ${name} killed (${P} vs ${R}, ${damage} dmg)`,
      {
        killedTough: k.k,
        transferredMods: k.transferred,
        discardedMods: k.discarded,
        sickedIdx: k.sickedIdx,
        damage, targetToughId: target.id,
      },
      notes,
    );
  }
  return mk(outcome,
    `${label}: ${name} ${outcome} (${P} vs ${R}, ${damage} dmg, HP ${target.hp}/${target.maxHp})`,
    { damage, targetToughId: target.id },
    notes,
  );
}

interface KillOutput { k: ToughCard; transferred: Card[]; discarded: Card[]; sickedIdx: number | null; }

function applyKill(
  atk: Turf, def: Turf, targetIdx: number,
  sickOnHit: boolean, notes: string[],
): KillOutput {
  const targetEntry = def.stack[targetIdx];
  const tough = targetEntry.card as ToughCard;
  const modIndices: number[] = [];
  for (let i = 0; i < def.stack.length; i++) {
    if (i === targetIdx) continue;
    const sc = def.stack[i];
    if (sc.card.kind === 'tough') continue;
    if (sc.owner === tough.id) modIndices.push(i);
  }
  const mods: Card[] = [];
  for (let i = modIndices.length - 1; i >= 0; i--) {
    const removed = removeFromStack(def, modIndices[i]);
    if (removed) mods.push(removed);
  }
  const newIdx = def.stack.findIndex(
    (sc) => sc.card.kind === 'tough' && sc.card === tough,
  );
  if (newIdx >= 0) removeFromStack(def, newIdx);

  const transferred: Card[] = [];
  const discarded: Card[] = [];
  for (const mod of mods) {
    if (turfAffiliationConflict(atk, mod)) discarded.push(mod);
    else {
      addToStack(atk, mod, { faceUp: false });
      transferred.push(mod);
    }
  }
  if (sickOnHit) notes.push('sickOnHit');
  return { k: tough, transferred, discarded, sickedIdx: null };
}

// ── Direct / Pushed / Funded ──────────────────────────────
export function resolveDirectStrike(atk: Turf, def: Turf): StrikeResult {
  return runStrike(atk, def, 'Strike', 0);
}

export function resolvePushedStrike(atk: Turf, def: Turf): StrikeResult {
  const currency = turfCurrency(atk);
  if (currency.length === 0) return busted('No currency to spend on pushed strike');
  const spent = currency[0];
  const spentIdx = atk.stack.findIndex((e) => e.card === spent);
  removeFromStack(atk, spentIdx);
  const cashBonus =
    spent.denomination / TURF_SIM_CONFIG.combat.pushedDenominationScale;
  return runStrike(atk, def, 'Pushed', cashBonus);
}

type AffiliationRelation = 'freelance' | 'same' | 'rival' | 'other';
function classifyAffiliation(atk: Turf, target: ToughCard): AffiliationRelation {
  if (target.affiliation === 'freelance') return 'freelance';
  const atkAffs = turfToughs(atk).map((t) => t.affiliation);
  if (atkAffs.includes(target.affiliation)) return 'same';
  if (turfAffiliationConflict(atk, target)) return 'rival';
  return 'other';
}
const AFFILIATION_MULT = TURF_SIM_CONFIG.combat.affiliationMult as Record<AffiliationRelation, number>;

export function resolveFundedRecruit(atk: Turf, def: Turf): StrikeResult {
  const currency = turfCurrency(atk);
  const totalCash = currency.reduce((s, c) => s + c.denomination, 0);
  const minCash = TURF_SIM_CONFIG.combat.fundedRecruitMinCash;
  if (totalCash < minCash)
    return busted(`Not enough currency ($${totalCash} < $${minCash})`);

  let spent = 0;
  const toRemove: number[] = [];
  for (let i = 0; i < atk.stack.length && spent < minCash; i++) {
    const entry = atk.stack[i];
    if (entry.card.kind === 'currency') {
      spent += entry.card.denomination;
      toRemove.push(i);
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--) removeFromStack(atk, toRemove[i]);

  const targetIdx = topToughIdx(def);
  if (targetIdx < 0) return busted('No tough to recruit');
  const target = def.stack[targetIdx].card as ToughCard;
  const relation = classifyAffiliation(atk, target);
  const mult = AFFILIATION_MULT[relation];
  const threshold = target.resistance * mult;

  if (spent >= threshold) {
    removeFromStack(def, targetIdx);
    if (turfAffiliationConflict(atk, target)) {
      return mk('kill', `Recruited ${target.name} but discarded — rival without buffer`,
        { discardedMods: [target], killedTough: target, targetToughId: target.id });
    }
    addToStack(atk, target, { faceUp: false });
    return mk('kill',
      `Recruited ${target.name} ($${spent} vs ${threshold}, ${relation} x${mult.toFixed(2)})`,
      { transferredMods: [target], killedTough: target, targetToughId: target.id });
  }
  return busted(`Funded recruit failed ($${spent} < ${threshold}, ${relation} x${mult.toFixed(2)})`);
}

// ── resolveStrikeNow ──────────────────────────────────────
export function resolveStrikeNow(
  state: TurfGameState, queued: QueuedAction,
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

// ── Legacy bridge ─────────────────────────────────────────
export function strikeToAttackOutcome(result: StrikeResult): AttackOutcome {
  const type: AttackOutcome['type'] =
    result.outcome === 'kill' ? 'kill'
    : result.outcome === 'busted' ? 'busted' : 'sick';
  return {
    type,
    targetIndices: result.sickedIdx != null ? [result.sickedIdx] : [],
    lostCards: result.discardedMods,
    gainedCards: [
      ...(result.killedTough ? [result.killedTough] : []),
      ...result.transferredMods,
    ],
    description: result.description,
  };
}

export { mk, busted };
