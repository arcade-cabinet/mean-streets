import type { Turf } from '../../sim/turf/types';
import type { ActionMode } from './GameScreenActionBar';

export type StrikeKind = 'direct_strike' | 'pushed_strike' | 'funded_recruit';
export type StrikePhase = 'pick-source' | 'pick-target';

export function isStrikeMode(m: ActionMode): m is StrikeKind {
  return m === 'direct_strike' || m === 'pushed_strike' || m === 'funded_recruit';
}

/** A retreat is only viable when another face-up tough exists below the
 * current top tough. Matches the sim's own pre-condition (see RULES §7). */
export function retreatViable(turf: Turf): boolean {
  if (turf.stack.length < 2) return false;
  const top = turf.stack[turf.stack.length - 1];
  if (top.card.kind !== 'tough') return false;
  for (let i = 0; i < turf.stack.length - 1; i++) {
    if (turf.stack[i].faceUp && turf.stack[i].card.kind === 'tough') return true;
  }
  return false;
}

/** At least two toughs on turf + at least one modifier to swap. */
export function modifierSwapViable(turf: Turf): boolean {
  let toughs = 0;
  let mods = 0;
  for (const sc of turf.stack) {
    if (sc.card.kind === 'tough' && sc.card.hp > 0) toughs++;
    else if (sc.card.kind === 'weapon' || sc.card.kind === 'drug') mods++;
  }
  return toughs >= 2 && mods >= 1;
}

export function buildPrompt(
  mode: ActionMode,
  strikePhase: StrikePhase,
  retreatTurfIdx: number | null,
): string | null {
  if (mode === 'retreat' && retreatTurfIdx === null)
    return 'Tap your active turf to open its stack';
  if (mode === 'retreat')
    return 'Tap a face-up tough in the fan to retreat it to top';
  if (mode === 'modifier_swap')
    return 'Tap your active turf, then pick a modifier and destination tough';
  if (mode === 'send_to_market')
    return 'Tap your active turf, then pick a tough to send to the market';
  if (mode === 'send_to_holding')
    return 'Tap your active turf, then pick a tough to send to holding';
  if (isStrikeMode(mode)) {
    return strikePhase === 'pick-source'
      ? 'Select your active turf to attack from'
      : 'Select opponent turf to target';
  }
  return null;
}
