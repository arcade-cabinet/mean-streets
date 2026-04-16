import { TURF_SIM_CONFIG } from './ai/config';
import {
  killToughAtIdx,
  resolveTargetToughIdx,
  toughBelowIdx,
  transferMods,
} from './stack-ops';
import type { Card, ToughCard, Turf } from './types';

export type StrikeOutcome = 'kill' | 'sick' | 'busted';

export interface StrikeResult {
  outcome: StrikeOutcome;
  killedTough: ToughCard | null;
  transferredMods: Card[];
  discardedMods: Card[];
  sickedIdx: number | null;
  description: string;
  abilityNotes?: string[];
}

export function fmt(n: string[]): string {
  return n.length ? ` [${n.join(', ')}]` : '';
}

export function mk(
  outcome: StrikeOutcome,
  description: string,
  e: Partial<StrikeResult> = {},
  notes: string[] = [],
): StrikeResult {
  return {
    outcome,
    killedTough: e.killedTough ?? null,
    transferredMods: e.transferredMods ?? [],
    discardedMods: e.discardedMods ?? [],
    sickedIdx: e.sickedIdx ?? null,
    description,
    abilityNotes: notes.length ? notes : undefined,
  };
}

export const busted = (desc: string, notes: string[] = []) =>
  mk('busted', desc, {}, notes);

export function resolvePR(P: number, R: number): StrikeOutcome {
  if (P >= R) return 'kill';
  if (P >= Math.floor(R / TURF_SIM_CONFIG.combat.sickThresholdDivisor))
    return 'sick';
  return 'busted';
}

/** Target idx — tangible override wins; fallback to attacker archetype. */
export function chooseTarget(
  atk: Turf,
  def: Turf,
  override: 'bottom' | 'anywhere' | null,
): number {
  if (override === 'bottom') {
    for (let i = 0; i < def.stack.length; i++) {
      if (def.stack[i].card.kind === 'tough') return i;
    }
    return -1;
  }
  if (override === 'anywhere') {
    let bestIdx = -1;
    let bestR = Number.POSITIVE_INFINITY;
    for (let i = def.stack.length - 1; i >= 0; i--) {
      const c = def.stack[i].card;
      if (c.kind === 'tough' && c.resistance < bestR) {
        bestR = c.resistance;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
  return resolveTargetToughIdx(def, atk);
}

export interface KillOutput {
  k: ToughCard;
  transferred: Card[];
  discarded: Card[];
  sickedIdx: number | null;
}

export function handleKill(
  atk: Turf,
  def: Turf,
  targetIdx: number,
  label: 'Strike' | 'Pushed',
  sickOnHit: boolean,
  notes: string[],
): KillOutput {
  const { tough, mods } = killToughAtIdx(def, targetIdx);
  const { transferred, discarded } = transferMods(mods, atk);
  let sickedIdx: number | null = null;
  if (label === 'Pushed') {
    const beneath = toughBelowIdx(def, targetIdx);
    if (beneath >= 0) {
      def.sickTopIdx = beneath;
      sickedIdx = beneath;
    }
  }
  if (sickOnHit) {
    for (let i = atk.stack.length - 1; i >= 0; i--) {
      if (atk.stack[i].card.kind === 'tough') {
        atk.sickTopIdx = i;
        break;
      }
    }
    notes.push('sickOnHit');
  }
  return { k: tough, transferred, discarded, sickedIdx };
}
