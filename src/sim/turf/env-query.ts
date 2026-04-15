import type {
  Card,
  PlayerState,
  PolicySample,
  TurfAction,
  TurfGameState,
  TurfObservation,
} from './types';
import {
  hasToughOnTurf,
  positionPower,
  positionResistance,
  turfAffiliationConflict,
} from './board';

// ── Action key serialization ──────────────────────────────

export function normalizeActionKey(action: TurfAction): string {
  switch (action.kind) {
    case 'play_card':
      return `play_card:${action.turfIdx}:${action.cardId}`;
    case 'direct_strike':
    case 'pushed_strike':
    case 'funded_recruit':
      return `${action.kind}:${action.turfIdx}:${action.targetTurfIdx}`;
    case 'discard':
      return `discard:${action.cardId}`;
    case 'end_turn':
      return 'end_turn';
    case 'pass':
      return 'pass';
  }
}

export function policyActionKey(action: TurfAction): string {
  switch (action.kind) {
    case 'play_card':
      return 'play_card';
    case 'direct_strike':
    case 'pushed_strike':
    case 'funded_recruit':
      return action.kind;
    case 'discard':
      return 'discard';
    case 'end_turn':
      return 'end_turn';
    case 'pass':
      return 'pass';
  }
}

// ── Draw-gate helpers ─────────────────────────────────────

export function playerHasToughInPlay(player: PlayerState): boolean {
  return player.turfs.some(hasToughOnTurf);
}

export function isModifierCard(card: Card): boolean {
  return card.kind !== 'tough';
}

// ── Observation ────────────────────────────────────────────

function countKind(hand: Card[], kind: Card['kind']): number {
  return hand.filter((c) => c.kind === kind).length;
}

export function createObservation(
  state: TurfGameState,
  side: 'A' | 'B',
): TurfObservation {
  const own = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const ownPower = own.turfs.reduce((s, t) => s + positionPower(t), 0);
  const ownDef = own.turfs.reduce((s, t) => s + positionResistance(t), 0);
  const oppPower = opp.turfs.reduce((s, t) => s + positionPower(t), 0);
  const oppDef = opp.turfs.reduce((s, t) => s + positionResistance(t), 0);

  return {
    phase: state.phase,
    side,
    turnNumber: state.turnNumber,
    ownTurfCount: own.turfs.length,
    opponentTurfCount: opp.turfs.length,
    ownToughsInPlay: own.toughsInPlay,
    opponentToughsInPlay: opp.toughsInPlay,
    handToughs: countKind(own.hand, 'tough'),
    handWeapons: countKind(own.hand, 'weapon'),
    handDrugs: countKind(own.hand, 'drug'),
    handCurrency: countKind(own.hand, 'currency'),
    ownPower,
    ownDefense: ownDef,
    opponentPower: oppPower,
    opponentDefense: oppDef,
    actionsRemaining: own.actionsRemaining,
    stateKey: `combat|${own.turfs.length}|${opp.turfs.length}|${own.toughsInPlay}|${opp.toughsInPlay}|${own.actionsRemaining}`,
  };
}

// ── Legal actions ──────────────────────────────────────────

export function enumerateLegalActions(
  state: TurfGameState,
  side: 'A' | 'B',
): TurfAction[] {
  const player = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const actions: TurfAction[] = [];
  const hasTough = playerHasToughInPlay(player);

  for (const card of player.hand) {
    if (isModifierCard(card) && !hasTough) continue;
    for (let t = 0; t < player.turfs.length; t++) {
      if (isModifierCard(card) && !hasToughOnTurf(player.turfs[t])) continue;
      if (card.kind === 'tough' && turfAffiliationConflict(player.turfs[t], card)) continue;
      actions.push({ kind: 'play_card', side, turfIdx: t, cardId: card.id });
    }
  }

  for (let t = 0; t < player.turfs.length; t++) {
    if (!hasToughOnTurf(player.turfs[t])) continue;
    for (let d = 0; d < opp.turfs.length; d++) {
      if (!hasToughOnTurf(opp.turfs[d])) continue;
      actions.push({ kind: 'direct_strike', side, turfIdx: t, targetTurfIdx: d });
      actions.push({ kind: 'pushed_strike', side, turfIdx: t, targetTurfIdx: d });
      actions.push({ kind: 'funded_recruit', side, turfIdx: t, targetTurfIdx: d });
    }
  }

  for (const card of player.hand) {
    actions.push({ kind: 'discard', side, cardId: card.id });
  }

  actions.sort((a, b) => normalizeActionKey(a).localeCompare(normalizeActionKey(b)));
  actions.push({ kind: 'end_turn', side });
  return actions;
}

// ── Policy sample ──────────────────────────────────────────

export function createPolicySample(
  state: TurfGameState,
  side: 'A' | 'B',
  action: TurfAction,
  goal: string,
  reward: number,
): PolicySample {
  return {
    side,
    stateKey: createObservation(state, side).stateKey,
    actionKey: policyActionKey(action),
    goal,
    reward,
  };
}
