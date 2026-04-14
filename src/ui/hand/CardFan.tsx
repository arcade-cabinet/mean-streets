/**
 * CardFan — horizontal fan layout for hand cards with hover lift and rotation spread.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { DraggableCard } from '../dnd';

interface FanItem {
  card: unknown;
  type: 'crew' | 'modifier' | 'backpack' | 'runner';
  index: number;
}

interface CardFanProps {
  cards: FanItem[];
  renderCard: (card: unknown, index: number) => ReactNode;
  presentation?: 'fan' | 'stack';
  compact?: boolean;
}

/** Maps a card position to a slight rotation in degrees (-3 to +3). */
function fanRotation(i: number, total: number): number {
  if (total <= 1) return 0;
  const mid = (total - 1) / 2;
  return ((i - mid) / mid) * 3;
}

export function CardFan({ cards, renderCard, presentation = 'fan', compact = false }: CardFanProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className={`card-fan ${presentation === 'fan' ? 'card-fan-fan' : 'card-fan-stack'} ${compact ? 'card-fan-compact' : ''}`}>
      {cards.map((item, i) => {
        const rotation = presentation === 'fan' ? fanRotation(i, cards.length) : 0;
        const isHovered = hovered === i;

        return (
          <div
            key={item.index}
            className="card-fan-item"
            style={{
              transform: isHovered
                ? `rotate(${rotation}deg) translateY(-8px) scale(1.05)`
                : `rotate(${rotation}deg)`,
              marginLeft: i === 0 ? 0 : presentation === 'fan' ? '-8px' : compact ? '4px' : '6px',
              zIndex: isHovered ? 50 : i,
              position: 'relative',
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <DraggableCard type={item.type} cardIndex={item.index}>
              {renderCard(item.card, item.index)}
            </DraggableCard>
          </div>
        );
      })}
    </div>
  );
}
