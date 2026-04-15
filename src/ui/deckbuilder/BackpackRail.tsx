/**
 * BackpackRail — player-packed backpacks (RULES.md §6, Epic C3).
 *
 * Renders N empty backpack slots; each slot has up to 4 drop targets
 * for quarter-cards. The player drags/taps a weapon/drug/cash from
 * their collection into a specific backpack + position.
 *
 * Stateless: the parent (DeckBuilderScreen) owns the PackedBackpack[]
 * list and passes edit callbacks. Works with tap-to-arm
 * (`src/ui/dnd/DragContext`) and drag-drop identically.
 */

import type { ModifierCard } from '../../sim/turf/types';

export interface PackedBackpackSlot {
  /** Quarter-card id occupying this slot, or null if empty. */
  cardId: string | null;
}

export interface PackedBackpackDraft {
  /** Stable id for the pack within the deck (e.g. "pack-1"..."pack-N"). */
  id: string;
  /** Length 4 — fixed per authored special.backpack.slots. */
  slots: PackedBackpackSlot[];
}

export interface BackpackRailProps {
  /** Packs the player has opened so far. Length equals starting quota. */
  packs: PackedBackpackDraft[];
  /** Live look-up for card metadata. */
  cardIndex: Map<string, ModifierCard>;
  /** Remaining quarter-card budget (total allowed − already packed). */
  quarterCardBudgetRemaining: number;
  /**
   * Fires when the player removes a card from a slot (clears it).
   * Parent is responsible for recomputing pack state.
   */
  onClearSlot?: (packIndex: number, slotIndex: number) => void;
  /**
   * Fires when the player drops/taps a card onto a slot. Parent
   * validates the budget + slot capacity and either accepts or
   * rejects the placement.
   */
  onAssignCard?: (packIndex: number, slotIndex: number, cardId: string) => void;
}

function describeCard(card: ModifierCard | undefined): string {
  if (!card) return '';
  switch (card.type) {
    case 'weapon':
      return `${card.name} (+${card.bonus})`;
    case 'product':
      return `${card.name} (${card.potency})`;
    case 'cash':
      return `$${card.denomination}`;
  }
}

function packFillLevel(pack: PackedBackpackDraft): 'empty' | 'partial' | 'full' {
  const occupied = pack.slots.filter((s) => s.cardId !== null).length;
  if (occupied === 0) return 'empty';
  if (occupied === pack.slots.length) return 'full';
  return 'partial';
}

export function BackpackRail({
  packs,
  cardIndex,
  quarterCardBudgetRemaining,
  onClearSlot,
  onAssignCard,
}: BackpackRailProps) {
  return (
    <div className="backpack-rail" data-testid="backpack-rail">
      <header className="backpack-rail-header">
        <h3 className="backpack-rail-title">Backpacks</h3>
        <span
          className="backpack-rail-budget"
          data-testid="backpack-rail-budget"
          aria-label={`${quarterCardBudgetRemaining} quarter-cards remaining`}
        >
          {quarterCardBudgetRemaining} / 25 quarter-cards remaining
        </span>
      </header>

      <ul className="backpack-rail-list">
        {packs.map((pack, packIdx) => {
          const fill = packFillLevel(pack);
          return (
            <li
              key={pack.id}
              className={`backpack-rail-pack backpack-rail-pack-${fill}`}
              data-pack-id={pack.id}
              data-testid={`backpack-rail-pack-${packIdx}`}
              data-fill={fill}
            >
              <div className="backpack-rail-pack-label">Pack {packIdx + 1}</div>
              <div className="backpack-rail-slots">
                {pack.slots.map((slot, slotIdx) => {
                  const card = slot.cardId ? cardIndex.get(slot.cardId) : undefined;
                  const occupied = slot.cardId !== null;
                  return (
                    <button
                      key={`${pack.id}-${slotIdx}`}
                      type="button"
                      className={`backpack-rail-slot backpack-rail-slot-${occupied ? 'filled' : 'empty'}`}
                      data-testid={`backpack-slot-${packIdx}-${slotIdx}`}
                      onClick={() => {
                        if (occupied && onClearSlot) {
                          onClearSlot(packIdx, slotIdx);
                        } else if (!occupied && onAssignCard && window.__MEAN_STREETS_ARMED_CARD__) {
                          onAssignCard(packIdx, slotIdx, window.__MEAN_STREETS_ARMED_CARD__);
                        }
                      }}
                      aria-label={
                        occupied
                          ? `Pack ${packIdx + 1} slot ${slotIdx + 1}: ${describeCard(card)} — tap to remove`
                          : `Pack ${packIdx + 1} slot ${slotIdx + 1}: empty — tap to place armed card`
                      }
                    >
                      {occupied ? describeCard(card) : '·'}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

declare global {
  interface Window {
    /**
     * Legacy "armed card" channel used by tap-to-arm during the
     * Epic C3 migration. Replace with DragContext integration once
     * DeckBuilderScreen fully adopts the PackedBackpack data model.
     */
    __MEAN_STREETS_ARMED_CARD__?: string | undefined;
  }
}
