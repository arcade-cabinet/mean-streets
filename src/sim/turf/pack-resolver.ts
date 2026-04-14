/**
 * pack-resolver.ts
 *
 * Converts a PackedDeckSnapshot (RULES.md §6 shape — crew ids +
 * player-packed backpacks whose slots reference quarter-card ids)
 * into a runtime DeckTemplate by looking up every referenced card
 * in the TurfCardPools catalog and assembling concrete BackpackCards
 * with live payloads.
 *
 * Unknown ids are silently skipped; empty backpacks are dropped. If
 * a snapshot resolves to zero crew, the caller is expected to treat
 * that as a deckbuild error.
 */

import type {
  BackpackCard,
  DeckTemplate,
  ModifierCard,
  PackedBackpack,
  PackedDeckSnapshot,
  PayloadCard,
} from './types';
import type { TurfCardPools } from './catalog';

function indexBy<T extends { id: string }>(cards: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const card of cards) map.set(card.id, card);
  return map;
}

function clonePayloadInto(
  card: PayloadCard,
  backpackId: string,
  slotIndex: number,
): PayloadCard {
  return { ...card, id: `${backpackId}::slot-${slotIndex + 1}::${card.id}` };
}

/**
 * Resolve a packed backpack into a runtime BackpackCard, wiring the
 * referenced payload cards (weapon/drug/cash) into the backpack's
 * payload array.
 */
export function resolvePackedBackpack(
  packed: PackedBackpack,
  packIndex: number,
  pools: TurfCardPools,
): BackpackCard | null {
  const weaponIndex = indexBy(pools.weapons);
  const drugIndex = indexBy(pools.drugs);
  const cashIndex = indexBy(pools.cash);
  const backpackId = `player-pack-${String(packIndex + 1).padStart(2, '0')}`;

  const payload: PayloadCard[] = [];
  for (let i = 0; i < packed.slots.length; i++) {
    const id = packed.slots[i];
    if (!id) continue;
    const resolved =
      weaponIndex.get(id) ??
      drugIndex.get(id) ??
      cashIndex.get(id) ??
      null;
    if (resolved) {
      payload.push(clonePayloadInto(resolved, backpackId, payload.length));
    }
  }

  if (payload.length === 0) return null;

  // Clamp size to the allowed 1..4 range defined in special.json.
  const size = Math.min(4, Math.max(1, payload.length)) as 1 | 2 | 3 | 4;

  return {
    type: 'backpack',
    id: backpackId,
    name: 'Packed Backpack',
    icon: 'crate',
    size,
    payload,
    unlocked: true,
    locked: false,
  };
}

/**
 * Resolve a full PackedDeckSnapshot into a runtime DeckTemplate.
 * Modifiers end up inside their backpacks' payloads; the top-level
 * modifiers[] list is the concatenated view for legacy callers that
 * still want a flat list.
 */
export function resolvePackedDeck(
  snapshot: PackedDeckSnapshot,
  pools: TurfCardPools,
): DeckTemplate {
  const crewIndex = indexBy(pools.crew);
  const crew = snapshot.crewIds
    .map((id) => crewIndex.get(id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  const backpacks = snapshot.backpacks
    .map((packed, idx) => resolvePackedBackpack(packed, idx, pools))
    .filter((card): card is BackpackCard => card !== null);

  // Legacy flat modifier list: every payload from every resolved
  // backpack. Keeps the DeckTemplate contract stable while packed
  // backpacks migrate in.
  const modifiers: ModifierCard[] = backpacks.flatMap(
    (pack): ModifierCard[] =>
      pack.payload.filter(
        (card): card is ModifierCard =>
          card.type === 'weapon' || card.type === 'product' || card.type === 'cash',
      ),
  );

  return { crew, modifiers, backpacks };
}
