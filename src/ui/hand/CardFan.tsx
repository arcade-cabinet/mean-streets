/**
 * CardFan — horizontal fan layout for hand cards with hover lift and rotation spread.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { DraggableCard } from '../dnd';

interface FanItem {
  card: unknown;
  type: 'crew' | 'modifier';
  index: number;
}

interface CardFanProps {
  cards: FanItem[];
  renderCard: (card: unknown, index: number) => ReactNode;
}

/** Maps a card position to a slight rotation in degrees (-3 to +3). */
function fanRotation(i: number, total: number): number {
  if (total <= 1) return 0;
  const mid = (total - 1) / 2;
  return ((i - mid) / mid) * 3;
}

export function CardFan({ cards, renderCard }: CardFanProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-end px-2" style={{ minHeight: '96px' }}>
      {cards.map((item, i) => {
        const rotation = fanRotation(i, cards.length);
        const isHovered = hovered === i;

        return (
          <div
            key={item.index}
            className="transition-transform duration-150 ease-out"
            style={{
              transform: isHovered
                ? `rotate(${rotation}deg) translateY(-8px) scale(1.05)`
                : `rotate(${rotation}deg)`,
              marginLeft: i === 0 ? 0 : '-8px',
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
