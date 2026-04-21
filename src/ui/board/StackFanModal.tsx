import { useCallback, useEffect, useRef, useState } from 'react';
import type { StackedCard, ToughCard, Turf } from '../../sim/turf/types';
import { Card } from '../cards';

interface StackFanModalProps {
  turf: Turf;
  open: boolean;
  onClose: () => void;
  /** When true (default), every card renders face-up. When false, any
   * StackedCard with faceUp === false renders as a face-down back. */
  isOwn?: boolean;
  /** Called when a face-up card in the stack is tapped. Pass in retreat
   * flow; undefined otherwise. */
  onCardPick?: (stackIdx: number) => void;
  /** When true, render HP bars beneath each tough. v0.3 §4. */
  showHp?: boolean;
  /** When true, render owner-line arrows from each modifier to its parent
   * tough in the stack. Useful during modifier-swap mode. */
  showOwnerLines?: boolean;
  /** Placement mode: when set, shows insertion-point slots between cards.
   * Tapping an insertion slot calls this with the target stack index. */
  onPlaceAt?: (stackIdx: number) => void;
  /** When true, restricts insertion slots to positions below the top tough
   * (modifiers can never be placed on top of the stack). */
  placingIsModifier?: boolean;
}

/** Face-down back tile. Simple CSS-driven placeholder — no asset art. */
function CardBack({ position }: { position: string }) {
  return (
    <div className="card-shell card-back" data-testid="card-back">
      <div className="card-back-inner">
        <div className="card-back-mark">MS</div>
        <div className="card-back-subtext">{position}</div>
      </div>
    </div>
  );
}

/** Render a compact HP pip row for a tough card. */
function ToughHp({ tough }: { tough: ToughCard }) {
  const max = tough.maxHp ?? 0;
  const cur = typeof tough.hp === 'number' ? tough.hp : max;
  if (max <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  return (
    <div className="stack-fan-hp" data-testid={`stack-fan-hp-${tough.id}`}>
      <span className="stack-fan-hp-label">HP</span>
      <div className="stack-fan-hp-bar">
        <div className="stack-fan-hp-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="stack-fan-hp-value">
        {cur}/{max}
      </span>
    </div>
  );
}

export function StackFanModal({
  turf,
  open,
  onClose,
  isOwn = true,
  onCardPick,
  showHp = false,
  showOwnerLines = false,
  onPlaceAt,
  placingIsModifier = false,
}: StackFanModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const stackLen = turf.stack.length;

  useEffect(() => {
    if (open) setCurrentIdx(stackLen - 1);
  }, [open, stackLen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight')
        setCurrentIdx((i) => Math.min(stackLen - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, stackLen, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) {
        setCurrentIdx((i) => Math.min(stackLen - 1, i + 1));
      } else {
        setCurrentIdx((i) => Math.max(0, i - 1));
      }
    },
    [stackLen],
  );

  // Map tough.id → stackIdx so we can draw owner-line arrows from a
  // modifier's position toward its owning tough. Declared before the
  // early-return so hooks run in a stable order.
  // Computed per-render (not memoized) because the sim mutates
  // turf.stack in-place, keeping the array reference stable while
  // indices change — memoizing on the array ref would return stale data.
  const toughIndexById = new Map<string, number>();
  for (let i = 0; i < turf.stack.length; i++) {
    const c = turf.stack[i].card;
    if (c.kind === 'tough') toughIndexById.set(c.id, i);
  }

  if (!open || stackLen === 0) return null;

  function renderStacked(sc: StackedCard, i: number, positionLabel: string) {
    const showFace = isOwn || sc.faceUp;
    const pickable = !!onCardPick && showFace;
    const handleClick = pickable
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          onCardPick?.(i);
        }
      : undefined;
    const isTough = sc.card.kind === 'tough';
    const ownerIdx =
      !isTough && sc.owner ? (toughIndexById.get(sc.owner) ?? null) : null;
    const arrowDir =
      ownerIdx == null
        ? null
        : ownerIdx < i
          ? 'left'
          : ownerIdx > i
            ? 'right'
            : null;
    return (
      <div
        key={`${sc.card.id}-${i}`}
        className={`stack-fan-card ${i === currentIdx ? 'stack-fan-card-active' : 'stack-fan-card-inactive'} ${pickable ? 'stack-fan-card-pickable' : ''}`}
        style={{
          transform: `translateX(${(i - currentIdx) * 110}%) scale(${i === currentIdx ? 1 : 0.85})`,
          zIndex: i === currentIdx ? 10 : stackLen - Math.abs(i - currentIdx),
          opacity:
            Math.abs(i - currentIdx) > 2 ? 0 : i === currentIdx ? 1 : 0.6,
        }}
        onClick={handleClick}
        role={pickable ? 'button' : undefined}
        tabIndex={pickable ? 0 : undefined}
        aria-label={pickable ? `Pick ${sc.card.id}` : undefined}
        data-card-kind={sc.card.kind}
        data-face-up={String(sc.faceUp)}
        data-testid={`stack-fan-card-${i}`}
      >
        {showFace ? (
          <Card card={sc.card} />
        ) : (
          <CardBack position={positionLabel} />
        )}
        {showHp && showFace && isTough && (
          <ToughHp tough={sc.card as ToughCard} />
        )}
        {showOwnerLines && arrowDir && (
          <span
            className={`stack-fan-owner-arrow stack-fan-owner-arrow-${arrowDir}`}
            aria-hidden="true"
            data-testid={`stack-fan-owner-arrow-${i}`}
          >
            {arrowDir === 'left' ? '←' : '→'}
          </span>
        )}
        <div className="stack-fan-card-position">{positionLabel}</div>
      </div>
    );
  }

  return (
    <div
      className="stack-fan-backdrop"
      onClick={onClose}
      role="dialog"
      aria-label={`Stack fan for turf ${turf.id}`}
      aria-modal="true"
      data-testid={`stack-fan-${turf.id}`}
    >
      <div
        className="stack-fan-container"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="stack-fan-header">
          <span className="stack-fan-title">Stack ({stackLen} cards)</span>
          <button
            className="stack-fan-close"
            onClick={onClose}
            aria-label="Close stack fan"
          >
            ✕
          </button>
        </div>

        <div className="stack-fan-cards">
          {onPlaceAt && (
            <button
              type="button"
              className={`stack-fan-insert-slot ${currentIdx === -1 ? 'stack-fan-insert-slot-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onPlaceAt(0);
              }}
              data-testid="stack-fan-insert-0"
              aria-label="Place at bottom"
            >
              <span className="stack-fan-insert-label">Place bottom</span>
            </button>
          )}
          {turf.stack.map((sc, i) => {
            const positionLabel =
              i === 0 ? 'Bottom' : i === stackLen - 1 ? 'Top' : `#${i + 1}`;
            return (
              <div
                key={`slot-${sc.card.id}-${i}`}
                className="stack-fan-slot-group"
              >
                {renderStacked(sc, i, positionLabel)}
                {onPlaceAt && !(placingIsModifier && i === stackLen - 1) && (
                  <button
                    type="button"
                    className="stack-fan-insert-slot"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceAt(i + 1);
                    }}
                    data-testid={`stack-fan-insert-${i + 1}`}
                    aria-label={
                      i === stackLen - 1
                        ? 'Place on top'
                        : `Place after ${positionLabel}`
                    }
                  >
                    <span className="stack-fan-insert-label">
                      {i === stackLen - 1 ? 'Place on top' : `Place here`}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="stack-fan-pips">
          {turf.stack.map((sc, i) => (
            <button
              key={`pip-${sc.card.id}-${i}`}
              className={`stack-fan-pip ${i === currentIdx ? 'stack-fan-pip-active' : ''}`}
              onClick={() => setCurrentIdx(i)}
              aria-label={`View card ${i + 1}`}
            />
          ))}
        </div>

        <div className="stack-fan-nav">
          <button
            className="stack-fan-nav-btn"
            disabled={currentIdx <= 0}
            onClick={() => setCurrentIdx((i) => i - 1)}
            aria-label="Previous card"
          >
            ◀
          </button>
          <span className="stack-fan-counter">
            {currentIdx + 1} / {stackLen}
          </span>
          <button
            className="stack-fan-nav-btn"
            disabled={currentIdx >= stackLen - 1}
            onClick={() => setCurrentIdx((i) => i + 1)}
            aria-label="Next card"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
