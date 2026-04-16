import {
  hasToughOnTurf,
  positionPower,
  positionResistance,
  turfAffiliationConflict,
} from './board';
import type {
  Card,
  PlayerState,
  PolicySample,
  TurfAction,
  TurfGameState,
  TurfObservation,
} from './types';

// ── Action key serialization ──────────────────────────────

export function normalizeActionKey(action: TurfAction): string {
  switch (action.kind) {
    case 'draw':
      return 'draw';
    case 'play_card':
      return `play_card:${action.turfIdx}:${action.cardId}`;
    case 'retreat':
      return `retreat:${action.turfIdx}:${action.stackIdx}`;
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
    case 'draw':
      return 'draw';
    case 'play_card':
      return 'play_card';
    case 'retreat':
      return 'retreat';
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

function countPendingKind(pending: Card | null, kind: Card['kind']): number {
  return pending && pending.kind === kind ? 1 : 0;
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

  // `handToughs/handWeapons/...` legacy observation fields now count the
  // single pending-placement card (if any) plus visible deck-top info is
  // unavailable (cards are hidden until drawn). This preserves the
  // interface shape for the AI planner without lying about hand contents.
  return {
    phase: state.phase,
    side,
    turnNumber: state.turnNumber,
    ownTurfCount: own.turfs.length,
    opponentTurfCount: opp.turfs.length,
    ownToughsInPlay: own.toughsInPlay,
    opponentToughsInPlay: opp.toughsInPlay,
    handToughs: countPendingKind(own.pending, 'tough'),
    handWeapons: countPendingKind(own.pending, 'weapon'),
    handDrugs: countPendingKind(own.pending, 'drug'),
    handCurrency: countPendingKind(own.pending, 'currency'),
    ownPower,
    ownDefense: ownDef,
    opponentPower: oppPower,
    opponentDefense: oppDef,
    actionsRemaining: own.actionsRemaining,
    stateKey: stateKey(state, own, opp),
  };
}

function stateKey(
  state: TurfGameState,
  own: PlayerState,
  opp: PlayerState,
): string {
  const pend = own.pending ? own.pending.kind[0] : '-';
  return [
    state.phase,
    own.turfs.length,
    opp.turfs.length,
    own.toughsInPlay,
    opp.toughsInPlay,
    own.actionsRemaining,
    own.deck.length,
    pend,
  ].join('|');
}

// ── Legal actions ──────────────────────────────────────────

export function enumerateLegalActions(
  state: TurfGameState,
  side: 'A' | 'B',
): TurfAction[] {
  const player = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];
  const actions: TurfAction[] = [];

  // draw (no pending, deck non-empty)
  if (player.pending === null && player.deck.length > 0) {
    actions.push({ kind: 'draw', side });
  }

  // play_card (have pending)
  if (player.pending !== null) {
    const card = player.pending;
    for (let t = 0; t < player.turfs.length; t++) {
      const turf = player.turfs[t];
      if (isModifierCard(card) && turf.stack.length === 0) continue;
      if (card.kind === 'tough' && turfAffiliationConflict(turf, card))
        continue;
      actions.push({ kind: 'play_card', side, turfIdx: t, cardId: card.id });
    }
    // Discard option for stuck modifiers.
    actions.push({ kind: 'discard', side, cardId: card.id });
  }

  // retreat (turf has ≥2 face-up cards, swap to non-top face-up)
  for (let t = 0; t < player.turfs.length; t++) {
    const turf = player.turfs[t];
    if (turf.stack.length < 2) continue;
    for (let s = 0; s < turf.stack.length - 1; s++) {
      if (turf.stack[s].faceUp) {
        actions.push({ kind: 'retreat', side, turfIdx: t, stackIdx: s });
      }
    }
  }

  // strikes (source turf not closed-ranks, has a living tough; target has tough)
  for (let t = 0; t < player.turfs.length; t++) {
    const src = player.turfs[t];
    if (src.closedRanks) continue;
    if (!hasToughOnTurf(src)) continue;
    for (let d = 0; d < opp.turfs.length; d++) {
      if (!hasToughOnTurf(opp.turfs[d])) continue;
      actions.push({
        kind: 'direct_strike',
        side,
        turfIdx: t,
        targetTurfIdx: d,
      });
      actions.push({
        kind: 'pushed_strike',
        side,
        turfIdx: t,
        targetTurfIdx: d,
      });
      actions.push({
        kind: 'funded_recruit',
        side,
        turfIdx: t,
        targetTurfIdx: d,
      });
    }
  }

  actions.sort((a, b) =>
    normalizeActionKey(a).localeCompare(normalizeActionKey(b)),
  );
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
