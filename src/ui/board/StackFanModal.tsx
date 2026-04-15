import { useCallback, useEffect, useRef, useState } from 'react';
import type { Turf } from '../../sim/turf/types';
import { Card } from '../cards';

interface StackFanModalProps {
  turf: Turf;
  open: boolean;
  onClose: () => void;
}

export function StackFanModal({ turf, open, onClose }: StackFanModalProps) {
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
      if (e.key === 'ArrowRight') setCurrentIdx((i) => Math.min(stackLen - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, stackLen, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) {
      setCurrentIdx((i) => Math.min(stackLen - 1, i + 1));
    } else {
      setCurrentIdx((i) => Math.max(0, i - 1));
    }
  }, [stackLen]);

  if (!open || stackLen === 0) return null;

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
          {turf.stack.map((card, i) => (
            <div
              key={card.id}
              className={`stack-fan-card ${i === currentIdx ? 'stack-fan-card-active' : 'stack-fan-card-inactive'}`}
              style={{
                transform: `translateX(${(i - currentIdx) * 110}%) scale(${i === currentIdx ? 1 : 0.85})`,
                zIndex: i === currentIdx ? 10 : stackLen - Math.abs(i - currentIdx),
                opacity: Math.abs(i - currentIdx) > 2 ? 0 : i === currentIdx ? 1 : 0.6,
              }}
            >
              <Card card={card} />
              <div className="stack-fan-card-position">
                {i === 0 ? 'Bottom' : i === stackLen - 1 ? 'Top' : `#${i + 1}`}
              </div>
            </div>
          ))}
        </div>

        <div className="stack-fan-pips">
          {turf.stack.map((_, i) => (
            <button
              key={i}
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
          <span className="stack-fan-counter">{currentIdx + 1} / {stackLen}</span>
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
