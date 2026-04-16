import { TURF_SIM_CONFIG } from './ai/config';
import {
  addToStack,
  consumeRivalBufferIfNeeded,
  flipCardFaceUp,
  hasToughOnTurf,
  turfAffiliationConflict,
} from './board';
import { isModifierCard } from './env-query';
import type { PlayerState, TurfAction, TurfGameState } from './types';

export function handleDraw(player: PlayerState, state: TurfGameState): void {
  if (player.pending !== null) throw new Error('draw: pending slot occupied');
  const card = player.deck.shift();
  if (!card) throw new Error('draw: deck empty');
  player.pending = card;
  state.metrics.draws++;
}

export function handlePlayCard(
  player: PlayerState,
  action: TurfAction,
  state: TurfGameState,
): { reward: number; reason: string } {
  if (action.turfIdx === undefined || !action.cardId)
    throw new Error('play_card: missing turfIdx or cardId');
  if (!player.pending || player.pending.id !== action.cardId)
    throw new Error('play_card: cardId does not match pending');
  const turf = player.turfs[action.turfIdx];
  if (!turf) throw new Error('play_card: invalid turfIdx');
  const card = player.pending;

  // §4 rule 1: modifiers can't bottom a stack.
  if (isModifierCard(card) && turf.stack.length === 0)
    throw new Error('play_card: cannot play modifier on empty turf');

  // §4 rule 3: rival tough without buffer → discarded on play.
  if (turfAffiliationConflict(turf, card)) {
    player.discard.push(card);
    player.pending = null;
    state.metrics.cardsDiscarded++;
    return {
      reward: TURF_SIM_CONFIG.rewards.discard,
      reason: 'play_card_discarded_rival',
    };
  }

  consumeRivalBufferIfNeeded(turf, card);
  addToStack(turf, card, true);
  player.pending = null;
  state.metrics.cardsPlayed++;

  if (card.kind === 'tough') {
    player.toughsInPlay++;
    state.metrics.toughsPlayed++;
    return {
      reward: TURF_SIM_CONFIG.rewards.playTough,
      reason: 'play_card_tough',
    };
  }
  state.metrics.modifiersPlayed++;
  return {
    reward: TURF_SIM_CONFIG.rewards.playModifier,
    reason: 'play_card_modifier',
  };
}

export function handleRetreat(
  player: PlayerState,
  action: TurfAction,
  state: TurfGameState,
): void {
  if (action.turfIdx === undefined || action.stackIdx === undefined)
    throw new Error('retreat: missing turfIdx or stackIdx');
  const turf = player.turfs[action.turfIdx];
  if (!turf) throw new Error('retreat: invalid turfIdx');
  if (turf.stack.length === 0) throw new Error('retreat: empty turf');
  const target = action.stackIdx;
  if (target < 0 || target >= turf.stack.length)
    throw new Error('retreat: stackIdx out of range');
  if (target === turf.stack.length - 1)
    throw new Error('retreat: cannot retreat to current top');
  // Flip old top and target face-up permanently, then swap positions.
  const topIdx = turf.stack.length - 1;
  flipCardFaceUp(turf, topIdx);
  flipCardFaceUp(turf, target);
  const oldTop = turf.stack[topIdx];
  const newTop = turf.stack[target];
  turf.stack[target] = oldTop;
  turf.stack[topIdx] = newTop;
  state.metrics.retreats++;
}

export function handleEndTurn(player: PlayerState, state: TurfGameState): void {
  // §4 rule 2: modifier-on-top at end-of-turn is popped & discarded.
  for (const turf of player.turfs) {
    while (turf.stack.length > 0) {
      const top = turf.stack[turf.stack.length - 1];
      if (top.card.kind === 'tough') break;
      const popped = turf.stack.pop();
      if (popped) {
        player.discard.push(popped.card);
        state.metrics.cardsDiscarded++;
      }
    }
    if (!hasToughOnTurf(turf)) {
      if (!turf.closedRanks) state.metrics.closedRanksEnds++;
      turf.closedRanks = true;
    } else {
      turf.closedRanks = false;
    }
  }
  player.turnEnded = true;
}
