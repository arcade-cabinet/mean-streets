/**
 * Slot accessors — RULES.md §2 semantic names as views over the
 * legacy `drugTop/drugBottom/weaponTop/weaponBottom/cashLeft/cashRight`
 * Position fields.
 *
 * The combat math (attacks.ts) and board helpers (board.ts) still use
 * the legacy field names for affinity-based placement. These accessors
 * give the UI, AI, and docs a RULES-aligned vocabulary:
 *
 *   pocketLeft       ≡ cashLeft       (always-active, pocket)
 *   pocketRight      ≡ cashRight      (always-active, pocket)
 *   backpackTopLeft  ≡ drugTop        (backpack-gated corner)
 *   backpackTopRight ≡ weaponTop      (backpack-gated corner)
 *   backpackBotLeft  ≡ drugBottom     (backpack-gated corner)
 *   backpackBotRight ≡ weaponBottom   (backpack-gated corner)
 *
 * These aliases preserve the affinity heuristic used by the scorer
 * (weapons land right-side, drugs land left-side, cash lands center)
 * while letting callers reason in RULES.md terms.
 *
 * See docs/RULES.md §2 "Anatomy Of A Card" for authoritative semantics.
 */

import type { Position, ModifierCard } from './types';

export type SlotName =
  | 'pocketLeft'
  | 'pocketRight'
  | 'backpackTopLeft'
  | 'backpackTopRight'
  | 'backpackBottomLeft'
  | 'backpackBottomRight';

/**
 * Read a slot by its RULES-aligned name. Returns the occupant card or
 * null. The returned reference is the same object stored on the
 * Position — mutations to the occupant are visible to attack math.
 */
export function getSlot(position: Position, slot: SlotName): ModifierCard | null {
  switch (slot) {
    case 'pocketLeft':
      return position.cashLeft;
    case 'pocketRight':
      return position.cashRight;
    case 'backpackTopLeft':
      return position.drugTop;
    case 'backpackTopRight':
      return position.weaponTop;
    case 'backpackBottomLeft':
      return position.drugBottom;
    case 'backpackBottomRight':
      return position.weaponBottom;
  }
}

/** True if the slot is currently empty on the given position. */
export function isSlotEmpty(position: Position, slot: SlotName): boolean {
  return getSlot(position, slot) === null;
}

/** True when the four backpack-gated corner slots are live for this position. */
export function isBackpackEquipped(position: Position): boolean {
  return position.backpack !== null;
}

/**
 * Return the active slot set on this position per RULES.md §2:
 * - Pocket slots are always live.
 * - Backpack-gated corners only count when a backpack is equipped.
 */
export function liveSlots(position: Position): SlotName[] {
  const slots: SlotName[] = ['pocketLeft', 'pocketRight'];
  if (isBackpackEquipped(position)) {
    slots.push(
      'backpackTopLeft',
      'backpackTopRight',
      'backpackBottomLeft',
      'backpackBottomRight',
    );
  }
  return slots;
}

/**
 * Count of pocket occupants (0..2). Useful for UI and the 2-pocket
 * cap enforcement.
 */
export function pocketCount(position: Position): number {
  let n = 0;
  if (position.cashLeft) n++;
  if (position.cashRight) n++;
  return n;
}

/**
 * Count of backpack-gated slots currently occupied (0..4). Returns 0
 * when no backpack is equipped (regardless of any stale occupants —
 * those become inert per RULES.md §7).
 */
export function backpackGatedCount(position: Position): number {
  if (!isBackpackEquipped(position)) return 0;
  let n = 0;
  if (position.drugTop) n++;
  if (position.weaponTop) n++;
  if (position.drugBottom) n++;
  if (position.weaponBottom) n++;
  return n;
}

/** Total live quarter-card occupants on this position (pocket + backpack). */
export function quarterCardCount(position: Position): number {
  return pocketCount(position) + backpackGatedCount(position);
}
