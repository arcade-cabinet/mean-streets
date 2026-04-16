import { useCallback, useEffect, useReducer, useState } from 'react';
import type { Card } from '../../sim/turf/types';
import {
  loadCollection,
  addCardsToCollection,
} from '../../platform/persistence/collection';

export interface UseCollectionResult {
  cards: Card[];
  loading: boolean;
  addCards: (newCards: Card[]) => Promise<void>;
  refresh: () => void;
}

export function useCollection(): UseCollectionResult {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, bump] = useReducer((n: number) => n + 1, 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers reload on refresh()
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadCollection().then(result => {
      if (!cancelled) {
        setCards(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tick]);

  const addCards = useCallback(async (newCards: Card[]) => {
    const updated = await addCardsToCollection(newCards);
    setCards(updated);
  }, []);

  const refresh = useCallback(() => bump(), []);

  return { cards, loading, addCards, refresh };
}
