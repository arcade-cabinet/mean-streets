/**
 * DropTarget — wraps a board position and handles crew/modifier drops.
 * Visual feedback: green glow for valid, red for invalid.
 * Modifier drops use drop Y-position relative to the element to pick orientation.
 */

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

function parsePayload(e: React.DragEvent): DragPayload | null {
  try {
    return JSON.parse(e.dataTransfer.getData('text/plain')) as DragPayload;
  } catch {
    return null;
  }
}

function isValidDrop(payload: DragPayload, position: Position): boolean {
  if (payload.type === 'crew') return !position.crew && !position.seized;
  if (payload.type === 'modifier') return !!position.crew && !position.seized;
  return false;
}

function resolveOrientation(
  e: React.DragEvent<HTMLDivElement>,
  el: HTMLDivElement,
): 'offense' | 'defense' {
  const rect = el.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  return relativeY < rect.height / 2 ? 'offense' : 'defense';
}

export function DropTarget({ positionIdx, position, onCrewDrop, onModifierDrop, children }: DropTargetProps) {
  const { dragging } = useDrag();
  const [validity, setValidity] = useState<DropValidity>('none');
  const containerRef = useRef<HTMLDivElement>(null);

  const showOrientationOverlay = validity !== 'none' && dragging?.type === 'modifier';

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!dragging) return;
    const valid = isValidDrop(dragging, position);
    if (valid) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setValidity('valid');
    } else {
      setValidity('invalid');
    }
  }

  function handleDragLeave() {
    setValidity('none');
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setValidity('none');
    const payload = parsePayload(e);
    if (!payload || !isValidDrop(payload, position)) return;

    if (payload.type === 'crew') {
      onCrewDrop(positionIdx);
    } else if (payload.type === 'modifier' && containerRef.current) {
      const orientation = resolveOrientation(e, containerRef.current);
      onModifierDrop(positionIdx, payload.cardIndex, orientation);
    }
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <OrientationOverlay visible={showOrientationOverlay} />
      {children}
    </div>
  );
}
