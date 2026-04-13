/**
 * DragContext — provides drag state to the component tree.
 * Tracks which card (crew or modifier) is currently being dragged.
 */

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface DragPayload {
  type: 'crew' | 'modifier';
  cardIndex: number;
}

interface DragContextValue {
  dragging: DragPayload | null;
  setDragging: (state: DragPayload | null) => void;
}

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  return (
    <DragContext.Provider value={{ dragging, setDragging }}>
      {children}
    </DragContext.Provider>
  );
}

export function useDrag(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used inside DragProvider');
  return ctx;
}
