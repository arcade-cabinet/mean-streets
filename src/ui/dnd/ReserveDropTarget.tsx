import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Position } from '../../sim/turf/types';
import { useDrag } from './DragContext';

interface ReserveDropTargetProps {
  reserveIdx: number;
  position: Position;
  onCrewDrop: (reserveIdx: number) => void;
  onBackpackDrop: (reserveIdx: number, backpackIdx: number) => void;
  children: ReactNode;
}

function isValidReserveDrop(type: 'crew' | 'modifier' | 'backpack' | 'runner', position: Position): boolean {
  if (type === 'crew') return !position.crew && !position.seized;
  if (type === 'backpack') return !!position.crew && !position.backpack && !position.seized;
  return false;
}

export function ReserveDropTarget({
  reserveIdx,
  position,
  onCrewDrop,
  onBackpackDrop,
  children,
}: ReserveDropTargetProps) {
  const { dragging, setDragging } = useDrag();
  const [active, setActive] = useState<'none' | 'valid' | 'invalid'>('none');

  function reset() {
    setActive('none');
  }

  function handleEnter() {
    if (!dragging) return;
    setActive(isValidReserveDrop(dragging.type, position) ? 'valid' : 'invalid');
  }

  function handleApply() {
    if (!dragging || !isValidReserveDrop(dragging.type, position)) return;
    if (dragging.type === 'crew') {
      onCrewDrop(reserveIdx);
    } else if (dragging.type === 'backpack') {
      onBackpackDrop(reserveIdx, dragging.cardIndex);
    }
    setDragging(null);
  }

  const borderClass =
    active === 'valid'
      ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-stone-900'
      : active === 'invalid'
        ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-stone-900'
        : '';

  return (
    <div
      className={`relative rounded-lg transition-shadow ${borderClass}`}
      onPointerEnter={handleEnter}
      onPointerLeave={reset}
      onPointerUp={() => {
        handleApply();
        reset();
      }}
      onClick={() => {
        handleApply();
        reset();
      }}
    >
      {children}
    </div>
  );
}
