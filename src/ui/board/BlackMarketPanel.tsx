/**
 * BlackMarketPanel — displaced-modifier shared pool with trade/heal affordances.
 *
 * v0.3 §9: modifiers dropped from seized turfs and market-sent toughs
 * collect here. Either side may:
 *   - trade: offer N mods → receive one of `targetRarity` (free action)
 *   - heal : offer N mods → restore a specific tough's HP (free action)
 *
 * The offered modifier basket is a transient UI state; the sim's action
 * helpers (`blackMarketTradeAction`, `blackMarketHealAction`) take the
 * ids directly. Parent owns "which tough am I healing" by passing
 * `healTargetName` for label clarity.
 */
import { useState } from 'react';
import type { ModifierCard, Rarity } from '../../sim/turf/types';
import { Card as CardComponent } from '../cards';

interface BlackMarketPanelProps {
  pool: ModifierCard[];
  /** Which side is this panel acting on behalf of. */
  side: 'A' | 'B';
  /** Invoked with `(offeredIds, targetRarity)` for a trade. */
  onTrade?: (offeredIds: string[], targetRarity: Rarity) => void;
  /**
   * Invoked with `(offeredIds)` for a heal action. Parent must first
   * pick a heal target via some other UX (tapping a tough) and pass the
   * tough's name in `healTargetName` to light up the Heal button.
   */
  onHeal?: (offeredIds: string[]) => void;
  /** Set by parent when the user has selected a tough to heal. */
  healTargetName?: string;
  /** When true, renders the phone-portrait modal shape. */
  modal?: boolean;
  /** Called when the modal's backdrop/close is tapped (phone only). */
  onClose?: () => void;
}

const RARITY_CHOICES: Rarity[] = ['uncommon', 'rare', 'legendary'];

export function BlackMarketPanel({
  pool,
  side,
  onTrade,
  onHeal,
  healTargetName,
  modal = false,
  onClose,
}: BlackMarketPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetRarity, setTargetRarity] = useState<Rarity>('rare');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const offered = [...selected];

  const handleTrade = () => {
    if (offered.length === 0) return;
    onTrade?.(offered, targetRarity);
    clearSelection();
  };
  const handleHeal = () => {
    if (offered.length === 0) return;
    onHeal?.(offered);
    clearSelection();
  };

  const body = (
    <div className="black-market-body">
      <div className="black-market-pool" data-testid="black-market-pool">
        {pool.length === 0 && (
          <span className="black-market-empty">Market is empty</span>
        )}
        {pool.map((card) => {
          const isSel = selected.has(card.id);
          return (
            <button
              type="button"
              key={card.id}
              className={`black-market-cell ${isSel ? 'black-market-cell-selected' : ''}`}
              onClick={() => toggle(card.id)}
              aria-pressed={isSel}
              data-testid={`black-market-cell-${card.id}`}
              aria-label={`${isSel ? 'Deselect' : 'Select'} ${card.name}`}
            >
              <CardComponent card={card} compact />
            </button>
          );
        })}
      </div>

      <div className="black-market-actions">
        <div className="black-market-target">
          <span className="black-market-target-label">Trade for</span>
          <div className="black-market-rarity-row" role="radiogroup" aria-label="Target rarity">
            {RARITY_CHOICES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={targetRarity === r}
                className={`black-market-rarity-btn ${targetRarity === r ? 'black-market-rarity-btn-active' : ''} black-market-rarity-${r}`}
                onClick={() => setTargetRarity(r)}
                data-testid={`black-market-rarity-${r}`}
              >
                {r[0].toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="black-market-trade-btn"
          onClick={handleTrade}
          disabled={offered.length === 0}
          data-testid="black-market-trade-btn"
        >
          Trade ({offered.length})
        </button>

        <button
          type="button"
          className="black-market-heal-btn"
          onClick={handleHeal}
          disabled={offered.length === 0 || !healTargetName}
          data-testid="black-market-heal-btn"
          title={healTargetName ? `Heal ${healTargetName}` : 'Tap a tough first'}
        >
          {healTargetName ? `Heal ${healTargetName}` : 'Heal'}
        </button>

        {offered.length > 0 && (
          <button
            type="button"
            className="black-market-clear-btn"
            onClick={clearSelection}
            data-testid="black-market-clear-btn"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );

  if (modal) {
    return (
      <div
        className="black-market-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Black market"
        onClick={onClose}
        data-testid={`black-market-modal-${side}`}
      >
        <div
          className="black-market-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="black-market-header">
            <span className="black-market-title">Black Market</span>
            <span className="black-market-count">{pool.length}</span>
            <button
              className="black-market-close"
              onClick={onClose}
              aria-label="Close black market"
            >
              ✕
            </button>
          </header>
          {body}
        </div>
      </div>
    );
  }

  return (
    <section
      className="black-market-panel"
      data-testid={`black-market-panel-${side}`}
      aria-label="Black market"
    >
      <header className="black-market-header">
        <span className="black-market-title">Black Market</span>
        <span className="black-market-count">{pool.length}</span>
      </header>
      {body}
    </section>
  );
}
