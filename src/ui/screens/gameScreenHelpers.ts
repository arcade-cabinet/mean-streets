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

export function buildPrompt(
  mode: ActionMode,
  strikePhase: StrikePhase,
  hasPending: boolean,
  retreatTurfIdx: number | null,
): string | null {
  if (hasPending && !isStrikeMode(mode) && mode !== 'retreat')
    return 'Tap one of your turfs to place the pending card';
  if (mode === 'play_card' && !hasPending)
    return 'Draw a card first, then tap a turf';
  if (mode === 'retreat' && retreatTurfIdx === null)
    return 'Tap one of your turfs to open its stack';
  if (mode === 'retreat')
    return 'Tap a face-up card in the fan to retreat it to top';
  if (isStrikeMode(mode)) {
    return strikePhase === 'pick-source'
      ? 'Select your turf to attack from'
      : 'Select opponent turf to target';
  }
  return null;
}
