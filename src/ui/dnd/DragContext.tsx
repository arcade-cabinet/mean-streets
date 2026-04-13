/**
 * DragContext — supports both pointer drag and tap-to-arm interactions.
 * Armed cards stay active briefly so users can tap a destination without precise dragging.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (!dragging) return;
    const timeout = window.setTimeout(() => setDragging(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [dragging]);

  const value = useMemo(() => ({ dragging, setDragging }), [dragging]);

  return (
    <DragContext.Provider value={value}>
      {children}
    </DragContext.Provider>
  );
}

export function useDrag(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used inside DragProvider');
  return ctx;
}
