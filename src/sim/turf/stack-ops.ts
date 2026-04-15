import type { Card, Turf, ToughCard } from './types';
import {
  turfToughs,
  turfAffiliationConflict,
  addToStack,
  removeFromStack,
} from './board';

export function topToughIdx(turf: Turf): number {
  for (let i = turf.stack.length - 1; i >= 0; i--) {
    if (turf.stack[i].kind === 'tough') return i;
  }
  return -1;
}

export function bottomToughIdx(turf: Turf): number {
  for (let i = 0; i < turf.stack.length; i++) {
    if (turf.stack[i].kind === 'tough') return i;
  }
  return -1;
}

export function toughBelowIdx(turf: Turf, aboveIdx: number): number {
  for (let i = aboveIdx - 1; i >= 0; i--) {
    if (turf.stack[i].kind === 'tough') return i;
  }
  return -1;
}

function modsBelongingToTough(turf: Turf, toughIdx: number): number[] {
  const nextToughAbove = (() => {
    for (let i = toughIdx + 1; i < turf.stack.length; i++) {
      if (turf.stack[i].kind === 'tough') return i;
    }
    return turf.stack.length;
  })();
  const indices: number[] = [];
  for (let i = toughIdx + 1; i < nextToughAbove; i++) {
    indices.push(i);
  }
  return indices;
}

export function resolveTargetToughIdx(
  defenderTurf: Turf,
  attackerTurf: Turf,
): number {
  const attackerToughs = turfToughs(attackerTurf);
  const hasStrikeBottom = attackerToughs.some(
    (t) => t.archetype === 'shark',
  );
  if (hasStrikeBottom) return bottomToughIdx(defenderTurf);

  const hasStrikeAnywhere = attackerToughs.some(
    (t) => t.archetype === 'ghost',
  );
  if (hasStrikeAnywhere) return bottomToughIdx(defenderTurf);

  return topToughIdx(defenderTurf);
}

export function transferMods(
  modCards: Card[],
  attackerTurf: Turf,
): { transferred: Card[]; discarded: Card[] } {
  const transferred: Card[] = [];
  const discarded: Card[] = [];
  for (const mod of modCards) {
    if (turfAffiliationConflict(attackerTurf, mod)) {
      discarded.push(mod);
    } else {
      addToStack(attackerTurf, mod);
      transferred.push(mod);
    }
  }
  return { transferred, discarded };
}

export function killToughAtIdx(
  turf: Turf,
  idx: number,
): { tough: ToughCard; mods: Card[] } {
  const modIndices = modsBelongingToTough(turf, idx);
  const mods: Card[] = [];
  for (let i = modIndices.length - 1; i >= 0; i--) {
    const removed = removeFromStack(turf, modIndices[i]);
    if (removed) mods.push(removed);
  }
  const tough = removeFromStack(turf, idx) as ToughCard;
  return { tough, mods };
}

export function toughName(turf: Turf, idx: number): string {
  const card = turf.stack[idx];
  if (card?.kind === 'tough') return card.name;
  return 'target';
}
