import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Position } from '../../sim/turf/types';
import { useDrag } from './DragContext';
import type { DragPayload } from './DragContext';
import { OrientationOverlay } from './OrientationOverlay';

interface DropTargetProps {
  positionIdx: number;
  position: Position;
  onCrewDrop: (posIdx: number) => void;
  onModifierDrop: (posIdx: number, cardIdx: number, orientation: 'offense' | 'defense') => void;
  children: ReactNode;
}

type DropValidity = 'none' | 'valid' | 'invalid';

function isValidDrop(payload: DragPayload, position: Position): boolean {
  if (payload.type === 'crew') return !position.crew && !position.seized;
  if (payload.type === 'modifier') return !!position.crew && !position.seized;
  return false;
}

function resolveOrientation(
  clientY: number,
  el: HTMLDivElement,
): 'offense' | 'defense' {
  const rect = el.getBoundingClientRect();
  const relativeY = clientY - rect.top;
  return relativeY < rect.height / 2 ? 'offense' : 'defense';
}

export function DropTarget({ positionIdx, position, onCrewDrop, onModifierDrop, children }: DropTargetProps) {
  const { dragging, setDragging } = useDrag();
  const [validity, setValidity] = useState<DropValidity>('none');
  const containerRef = useRef<HTMLDivElement>(null);

  const showOrientationOverlay = validity !== 'none' && dragging?.type === 'modifier';

  function handlePointerEnter() {
    if (!dragging) return;
    const valid = isValidDrop(dragging, position);
    setValidity(valid ? 'valid' : 'invalid');
  }

  function handlePointerLeave() {
    setValidity('none');
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    setValidity('none');
    const payload = dragging;
    if (!payload || !isValidDrop(payload, position)) return;

    if (payload.type === 'crew') {
      onCrewDrop(positionIdx);
    } else if (payload.type === 'modifier' && containerRef.current) {
      const orientation = resolveOrientation(event.clientY, containerRef.current);
      onModifierDrop(positionIdx, payload.cardIndex, orientation);
    }
    setDragging(null);
  }

  function handleClick() {
    if (!dragging || !isValidDrop(dragging, position)) return;
    if (dragging.type === 'crew') {
      onCrewDrop(positionIdx);
    } else {
      onModifierDrop(positionIdx, dragging.cardIndex, 'offense');
    }
    setDragging(null);
  }

  const borderClass =
    validity === 'valid'
      ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-stone-900'
      : validity === 'invalid'
      ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-stone-900'
      : '';

  return (
    <div
      ref={containerRef}
      className={`relative rounded-lg transition-shadow ${borderClass}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      <OrientationOverlay visible={showOrientationOverlay} />
      {children}
    </div>
  );
}
