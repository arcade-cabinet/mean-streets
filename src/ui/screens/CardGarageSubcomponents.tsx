/**
 * Row / bulk-bar subcomponents for CardGarageScreen.
 * Extracted to keep the screen file under 300 LOC.
 */
import { Shuffle } from 'lucide-react';
import type { Card as CardType, Rarity } from '../../sim/turf/types';
import type { CardPreference } from '../../platform/persistence/collection';

export interface CardRow {
  id: string;
  card: CardType;
  pref: CardPreference;
}

export const RARITY_CLASS: Record<Rarity, string> = {
  mythic: 'garage-rarity-mythic',
  legendary: 'garage-rarity-legendary',
  rare: 'garage-rarity-rare',
  uncommon: 'garage-rarity-uncommon',
  common: 'garage-rarity-common',
};

const RARITY_LABELS: Record<Rarity, string> = {
  mythic: 'Mythic', legendary: 'Legendary', rare: 'Rare', uncommon: 'Uncommon', common: 'Common',
};

interface BulkRarityBarProps {
  rarity: Rarity;
  count: number;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export function BulkRarityBar({ rarity, count, onEnableAll, onDisableAll }: BulkRarityBarProps) {
  return (
    <div className={`garage-bulk-bar ${RARITY_CLASS[rarity]}`} data-testid={`garage-bulk-${rarity}`}>
      <span className="garage-bulk-label">
        {RARITY_LABELS[rarity]} <span className="garage-bulk-count">({count})</span>
      </span>
      <div className="garage-bulk-actions">
        <button className="garage-bulk-btn" onClick={onEnableAll}
          aria-label={`Enable all ${rarity} cards`} data-testid={`garage-enable-all-${rarity}`}>
          Enable all
        </button>
        <button className="garage-bulk-btn" onClick={onDisableAll}
          aria-label={`Disable all ${rarity} cards`} data-testid={`garage-disable-all-${rarity}`}>
          Disable all
        </button>
      </div>
    </div>
  );
}

interface CardRowItemProps {
  row: CardRow;
  onChange: (pref: CardPreference) => void;
  /** Extra copies in this cardId+rarity bucket (0 = only one copy owned). */
  duplicateCount?: number;
  /** Fired when the user confirms a merge for this row bucket. */
  onMerge?: (row: CardRow) => void;
}

export function CardRowItem({
  row,
  onChange,
  duplicateCount = 0,
  onMerge,
}: CardRowItemProps) {
  const { id, card, pref } = row;
  const canMerge =
    duplicateCount >= 1 &&
    card.rarity !== 'legendary' &&
    card.rarity !== 'mythic';
  return (
    <div
      className={`garage-row ${!pref.enabled ? 'garage-row-disabled' : ''}`}
      data-testid={`garage-row-${id}`}
    >
      <div className={`garage-row-rarity-pip ${RARITY_CLASS[card.rarity]}`} aria-hidden="true" />
      <span className="garage-row-name">{card.name}</span>
      <span className="garage-row-kind">{card.kind}</span>
      {duplicateCount > 0 && (
        <span
          className={`garage-row-dupes ${canMerge ? 'garage-row-dupes-mergeable' : ''}`}
          data-testid={`garage-dupes-${id}`}
          title={canMerge ? 'Merge 2 copies to roll one tier higher' : 'Legendary and mythic cannot merge'}
        >
          ×{duplicateCount + 1}
        </span>
      )}
      <button
        type="button"
        className={`garage-row-merge ${canMerge ? '' : 'garage-row-merge-disabled'}`}
        onClick={() => canMerge && onMerge?.(row)}
        disabled={!canMerge}
        aria-label={canMerge ? `Merge two copies of ${card.name}` : 'Merge locked'}
        data-testid={`garage-merge-${id}`}
      >
        <Shuffle size={14} />
        <span>Merge</span>
      </button>
      <label className="garage-toggle" aria-label={`${pref.enabled ? 'Disable' : 'Enable'} ${card.name}`}>
        <input
          type="checkbox"
          className="garage-toggle-input"
          checked={pref.enabled}
          onChange={() => onChange({ ...pref, enabled: !pref.enabled })}
          data-testid={`garage-toggle-${card.id}`}
        />
        <span className="garage-toggle-track" aria-hidden="true" />
      </label>
      <div className="garage-priority" aria-label={`Priority for ${card.name}: ${pref.priority}`}>
        <span className="garage-priority-value">{pref.priority}</span>
        <input
          type="range"
          className="garage-priority-slider"
          min={1} max={10} value={pref.priority}
          onChange={(e) => onChange({ ...pref, priority: Number(e.target.value) })}
          disabled={!pref.enabled}
          data-testid={`garage-priority-${card.id}`}
          aria-label={`Priority ${pref.priority} of 10`}
        />
      </div>
    </div>
  );
}
