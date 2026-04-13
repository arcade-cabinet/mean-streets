import type { ReactNode } from 'react';
import { useDrag } from './DragContext';

interface DraggableCardProps {
  type: 'crew' | 'modifier';
  cardIndex: number;
  children: ReactNode;
}

export function DraggableCard({ type, cardIndex, children }: DraggableCardProps) {
  const { dragging, setDragging } = useDrag();
  const isDragging = dragging?.type === type && dragging?.cardIndex === cardIndex;

  function handleToggle() {
    setDragging(isDragging ? null : { type, cardIndex });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isDragging}
      onClick={handleToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleToggle();
        }
      }}
      className={`cursor-pointer select-none transition-opacity ${isDragging ? 'opacity-70 ring-2 ring-amber-400 ring-offset-2 ring-offset-stone-950 rounded-2xl' : 'opacity-100'}`}
    >
      {children}
    </div>
  );
}
