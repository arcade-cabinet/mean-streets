/**
 * DraggableCard — wraps a card component and makes it draggable via native HTML5 drag events.
 * On invalid drop, GSAP snaps the ghost image back (browser handles ghost automatically).
 */

import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useDrag } from './DragContext';
import type { DragPayload } from './DragContext';

interface DraggableCardProps {
  type: 'crew' | 'modifier';
  cardIndex: number;
  children: ReactNode;
}

export function DraggableCard({ type, cardIndex, children }: DraggableCardProps) {
  const { dragging, setDragging } = useDrag();
  const isDragging = dragging?.type === type && dragging?.cardIndex === cardIndex;
  const wrapperRef = useRef<HTMLDivElement>(null);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    const payload: DragPayload = { type, cardIndex };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
    setDragging(payload);
  }

  function handleDragEnd() {
    setDragging(null);
  }

  return (
    <div
      ref={wrapperRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`cursor-grab select-none transition-opacity ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      {children}
    </div>
  );
}
