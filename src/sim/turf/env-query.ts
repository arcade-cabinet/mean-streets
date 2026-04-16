import {
  hasToughOnTurf,
  positionPower,
  positionResistance,
  turfAffiliationConflict,
} from './board';
import { isToughInCustody } from './holding';
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
    case 'modifier_swap':
      return `modifier_swap:${action.turfIdx}:${action.toughId}:${action.targetToughId}:${action.cardId}`;
    case 'send_to_market':
      return `send_to_market:${action.toughId}`;
    case 'send_to_holding':
      return `send_to_holding:${action.toughId}`;
    case 'black_market_trade':
      return `black_market_trade:${action.targetRarity}:${(action.offeredMods ?? []).join(',')}`;
    case 'black_market_heal':
      return `black_market_heal:${action.healTarget}:${(action.offeredMods ?? []).join(',')}`;
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
    default: {
      // Exhaustiveness guard + safe fallback for forward-compat.
      const _exhaustive: never = action.kind;
      return `unknown:${String(_exhaustive)}`;
    }
  }
}

export function policyActionKey(action: TurfAction): string {
  switch (action.kind) {
    case 'draw':
    case 'play_card':
    case 'retreat':
    case 'modifier_swap':
    case 'send_to_market':
    case 'send_to_holding':
    case 'black_market_trade':
    case 'black_market_heal':
    case 'direct_strike':
    case 'pushed_strike':
    case 'funded_recruit':
    case 'discard':
    case 'end_turn':
    case 'pass':
      return action.kind;
    default: {
      const _exhaustive: never = action.kind;
      return `unknown:${String(_exhaustive)}`;
    }
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
    stateKey: stateKey(state, side, own, opp),
  };
}

function stateKey(
  state: TurfGameState,
  side: 'A' | 'B',
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
    Math.round(state.heat * 10),
    state.blackMarket.length,
    state.holding[side].length,
    state.lockup[side].length,
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
  const activeIdx = 0;
  const active = player.turfs[activeIdx];

  // draw (no pending, deck non-empty)
  if (player.pending === null && player.deck.length > 0) {
    actions.push({ kind: 'draw', side });
  }

  // play_card (have pending; active turf only)
  if (player.pending !== null && active) {
    const card = player.pending;
    if (!(isModifierCard(card) && active.stack.length === 0)) {
      if (!(card.kind === 'tough' && turfAffiliationConflict(active, card))) {
        actions.push({
          kind: 'play_card',
          side,
          turfIdx: activeIdx,
          cardId: card.id,
        });
      }
    }
    actions.push({ kind: 'discard', side, cardId: card.id });
  }

  // retreat — active turf, stack size ≥ 2, swap to any face-up non-top.
  if (active && active.stack.length >= 2) {
    for (let s = 0; s < active.stack.length - 1; s++) {
      if (active.stack[s].faceUp) {
        actions.push({ kind: 'retreat', side, turfIdx: activeIdx, stackIdx: s });
      }
    }
  }

  // modifier_swap — active turf only, between two different toughs.
  if (active) {
    const toughIds: string[] = [];
    for (const sc of active.stack) {
      if (sc.card.kind === 'tough') toughIds.push(sc.card.id);
    }
    for (const from of toughIds) {
      if (isToughInCustody(state, side, from)) continue;
      for (const to of toughIds) {
        if (from === to) continue;
        for (const sc of active.stack) {
          if (sc.card.kind === 'tough' || sc.owner !== from) continue;
          actions.push({
            kind: 'modifier_swap',
            side,
            turfIdx: activeIdx,
            toughId: from,
            targetToughId: to,
            cardId: sc.card.id,
          });
        }
      }
    }
    // send_to_market / send_to_holding per tough.
    for (const id of toughIds) {
      if (isToughInCustody(state, side, id)) continue;
      actions.push({ kind: 'send_to_market', side, toughId: id });
      actions.push({ kind: 'send_to_holding', side, toughId: id });
    }
  }

  // strikes (source = active turf not closed-ranks, has a living tough;
  // target = opponent active turf with a living tough).
  const oppActive = opp.turfs[0];
  if (active && !active.closedRanks && hasToughOnTurf(active) && oppActive && hasToughOnTurf(oppActive)) {
    actions.push({ kind: 'direct_strike', side, turfIdx: 0, targetTurfIdx: 0 });
    actions.push({ kind: 'pushed_strike', side, turfIdx: 0, targetTurfIdx: 0 });
    actions.push({ kind: 'funded_recruit', side, turfIdx: 0, targetTurfIdx: 0 });
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
