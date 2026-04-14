import { createRng } from '../cards/rng';
import { generateTurfCardPools, type TurfCardPools } from './catalog';
import { buildAutoDeck, type AutoDeckPolicy } from './deck-builder';
import {
  createBoard,
  deployRunner,
  equipBackpack,
  findDirectReady,
  findEmptyActive,
  findFundedReady,
  findPushReady,
  offensiveCash,
  placeCrew,
  placeReserveCrew,
  placeModifier,
  positionDefense,
  positionPower,
  takePayload,
  seizePosition,
  seizedCount,
  tickPositions,
} from './board';
import {
  canPrecisionAttack,
  resolveDirectAttack,
  resolveFundedAttack,
  resolvePushedAttack,
} from './attacks';
import type {
  CashCard,
  CrewCard,
  DeckTemplate,
  ModifierCard,
  PlannerMemory,
  PlayerState,
  PolicySample,
  Position,
  ProductCard,
  TurfAction,
  TurfActionKind,
  TurfGameConfig,
  TurfGameState,
  TurfMetrics,
  TurfObservation,
  WeaponCard,
} from './types';

export interface CreateTurfStateOptions {
  pools?: TurfCardPools;
  deckPolicyA?: AutoDeckPolicy;
  deckPolicyB?: AutoDeckPolicy;
}

export interface TurfStepResult {
  reward: number;
  actionKey: string;
  terminal: boolean;
  reason: string;
}

function emptyPlannerMemory(): PlannerMemory {
  return {
    lastGoal: null,
    lastActionKind: null,
    consecutivePasses: 0,
    failedPlans: 0,
    blockedLanes: {},
    pressuredLanes: {},
    laneRoles: {},
    focusLane: null,
    focusRole: null,
  };
}

export function emptyMetrics(): TurfMetrics {
  return {
    turns: 0,
    directAttacks: 0,
    fundedAttacks: 0,
    pushedAttacks: 0,
    kills: 0,
    flips: 0,
    seizures: 0,
    busts: 0,
    weaponsDrawn: 0,
    productPlayed: 0,
    cashPlayed: 0,
    crewPlaced: 0,
    reserveCrewPlaced: 0,
    backpacksEquipped: 0,
    runnerDeployments: 0,
    payloadDeployments: 0,
    runnerOpportunityTurns: 0,
    runnerOpportunityTaken: 0,
    runnerOpportunityMissed: 0,
    runnerReserveOpportunityTurns: 0,
    runnerReserveOpportunityTaken: 0,
    runnerReserveOpportunityMissed: 0,
    runnerEquipOpportunityTurns: 0,
    runnerEquipOpportunityTaken: 0,
    runnerEquipOpportunityMissed: 0,
    runnerDeployOpportunityTurns: 0,
    runnerDeployOpportunityTaken: 0,
    runnerDeployOpportunityMissed: 0,
    runnerPayloadOpportunityTurns: 0,
    runnerPayloadOpportunityTaken: 0,
    runnerPayloadOpportunityMissed: 0,
    positionsReclaimed: 0,
    passes: 0,
    goalSwitches: 0,
    failedPlans: 0,
    stallTurns: 0,
    deadHandTurns: 0,
    laneConversions: 0,
    offensePlacements: 0,
    defensePlacements: 0,
    policyGuidedActions: 0,
    buildupRoundsA: 0,
    buildupRoundsB: 0,
    combatRounds: 0,
    totalActions: 0,
    firstStrike: null,
  };
}

function initPlayer(
  side: 'A' | 'B',
  config: TurfGameConfig,
  template: DeckTemplate,
  rng: ReturnType<typeof createRng>,
): PlayerState {
  const crewDeck = rng.shuffle(template.crew.map(card => ({ ...card })));
  const modifierDeck = rng.shuffle(template.modifiers.map(card => ({ ...card })) as ModifierCard[]);

  return {
    board: createBoard(side, config.positionCount, config.reserveCount),
    crewDraw: crewDeck.slice(3),
    modifierDraw: modifierDeck.slice(3),
    backpackDraw: template.backpacks.slice(2).map(card => ({
      ...card,
      payload: card.payload.map(payload => ({ ...payload })),
    })),
    hand: {
      crew: crewDeck.slice(0, 3),
      modifiers: modifierDeck.slice(0, 3),
      backpacks: template.backpacks.slice(0, 2).map(card => ({
        ...card,
        payload: card.payload.map(payload => ({ ...payload })),
      })),
    },
    discard: [],
    positionsSeized: 0,
  };
}

export function createInitialTurfState(
  config: TurfGameConfig,
  seed: number,
  options: CreateTurfStateOptions = {},
): { state: TurfGameState; templates: { A: DeckTemplate; B: DeckTemplate } } {
  const rng = createRng(seed);
  const pools = options.pools ?? generateTurfCardPools(seed);
  const templates = {
    A: buildAutoDeck(pools, rng, options.deckPolicyA),
    B: buildAutoDeck(pools, rng, options.deckPolicyB),
  };
  const firstPlayer: 'A' | 'B' = rng.next() < 0.5 ? 'A' : 'B';

  return {
    state: {
      config,
      players: {
        A: initPlayer('A', config, templates.A, rng),
        B: initPlayer('B', config, templates.B, rng),
      },
      turnSide: firstPlayer,
      firstPlayer,
      turnNumber: 0,
      phase: 'buildup',
      buildupTurns: { A: 0, B: 0 },
      hasStruck: { A: false, B: false },
      aiState: { A: 'BUILDING', B: 'BUILDING' },
      aiTurnsInState: { A: 0, B: 0 },
      aiMemory: { A: emptyPlannerMemory(), B: emptyPlannerMemory() },
      plannerTrace: [],
      policySamples: [],
      rng,
      seed,
      winner: null,
      endReason: null,
      metrics: emptyMetrics(),
    },
    templates,
  };
}

function handWeapons(player: PlayerState): WeaponCard[] {
  return player.hand.modifiers.filter((card): card is WeaponCard => card.type === 'weapon');
}

function handDrugs(player: PlayerState): ProductCard[] {
  return player.hand.modifiers.filter((card): card is ProductCard => card.type === 'product');
}

function handCash(player: PlayerState): CashCard[] {
  return player.hand.modifiers.filter((card): card is CashCard => card.type === 'cash');
}

function removeModifier(player: PlayerState, cardId: string): ModifierCard | null {
  const idx = player.hand.modifiers.findIndex(card => card.id === cardId);
  if (idx < 0) return null;
  return player.hand.modifiers.splice(idx, 1)[0] ?? null;
}

function removeCrew(player: PlayerState, cardId: string): CrewCard | null {
  const idx = player.hand.crew.findIndex(card => card.id === cardId);
  if (idx < 0) return null;
  return player.hand.crew.splice(idx, 1)[0] ?? null;
}

let bonusCashCounter = 0;

function awardCash(player: PlayerState): void {
  bonusCashCounter++;
  player.hand.modifiers.push({
    type: 'cash',
    id: `cash-bonus-${bonusCashCounter}`,
    denomination: 100,
  });
}

function recordPlacementMetrics(state: TurfGameState, card: ModifierCard, slot: 'offense' | 'defense'): void {
  if (slot === 'offense') state.metrics.offensePlacements++;
  else state.metrics.defensePlacements++;

  if (card.type === 'weapon') state.metrics.weaponsDrawn++;
  if (card.type === 'product') state.metrics.productPlayed++;
  if (card.type === 'cash') state.metrics.cashPlayed++;
}

export function drawPhase(state: TurfGameState, side: 'A' | 'B'): void {
  const player = state.players[side];
  if (player.crewDraw.length > 0 && player.hand.crew.length < 5) {
    const next = player.crewDraw.shift();
    if (next) player.hand.crew.push(next);
  }
  if (player.modifierDraw.length > 0 && player.hand.modifiers.length < 7) {
    const next = player.modifierDraw.shift();
    if (next) player.hand.modifiers.push(next);
  }
  if (player.backpackDraw.length > 0 && player.hand.backpacks.length < 4) {
    const next = player.backpackDraw.shift();
    if (next) player.hand.backpacks.push(next);
  }
}

export function tickRound(state: TurfGameState): void {
  tickPositions(state.players.A.board);
  tickPositions(state.players.B.board);
  drawPhase(state, 'A');
  drawPhase(state, 'B');
}

export function normalizeActionKey(action: TurfAction): string {
  switch (action.kind) {
    case 'place_crew':
      return `place_crew:${action.positionIdx}`;
    case 'place_reserve_crew':
      return `place_reserve_crew:${action.reserveIdx}`;
    case 'equip_backpack':
      return `equip_backpack:${action.reserveIdx}`;
    case 'deploy_runner':
      return `deploy_runner:${action.reserveIdx}->${action.positionIdx}`;
    case 'deploy_payload':
      return `deploy_payload:${action.positionIdx}:${action.modifierCardId}:${action.slot}`;
    case 'arm_weapon':
    case 'stack_product':
    case 'stack_cash':
      return `${action.kind}:${action.positionIdx}:${action.slot}`;
    case 'direct_attack':
    case 'funded_attack':
    case 'pushed_attack':
      return `${action.kind}:${action.attackerIdx}:${action.targetIdx}`;
    case 'reclaim':
      return `reclaim:${action.positionIdx}`;
    case 'pass':
      return 'pass';
  }
}

export function policyActionKey(action: TurfAction): string {
  switch (action.kind) {
    case 'place_crew':
      return 'place_crew';
    case 'place_reserve_crew':
      return 'place_reserve_crew';
    case 'equip_backpack':
      return 'equip_backpack';
    case 'deploy_runner':
      return 'deploy_runner';
    case 'deploy_payload':
      return `deploy_payload:${action.slot ?? 'offense'}`;
    case 'arm_weapon':
    case 'stack_product':
    case 'stack_cash':
      return `${action.kind}:${action.slot ?? 'offense'}`;
    case 'direct_attack':
    case 'funded_attack':
    case 'pushed_attack':
      return action.kind;
    case 'reclaim':
      return 'reclaim';
    case 'pass':
      return 'pass';
  }
}

function bucket(value: number, size: number): number {
  return Math.max(0, Math.floor(value / size));
}

function signedBucket(value: number, size: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, Math.trunc(value / size)));
}

function laneSignature(position: Position): string {
  if (!position.crew) return 'empty';
  const power = bucket(positionPower(position), 3);
  const defense = bucket(positionDefense(position), 3);
  const offenseFlags = `${Number(Boolean(position.weaponTop))}${Number(Boolean(position.drugTop))}${Number(Boolean(position.cashLeft))}`;
  const defenseFlags = `${Number(Boolean(position.weaponBottom))}${Number(Boolean(position.drugBottom))}${Number(Boolean(position.cashRight))}`;
  return `${power}:${defense}:${offenseFlags}:${defenseFlags}`;
}

function lanePosture(position: Position): string {
  if (!position.crew) return 'empty';
  if (position.weaponTop && position.drugTop && position.cashLeft) return 'pushed';
  if (position.weaponTop && position.cashLeft) return 'funded';
  if (position.weaponTop) return 'direct';
  if (position.drugTop || position.cashLeft) return 'setup';
  return 'bare';
}

function lanePressureProfile(position: Position): string {
  if (!position.crew) return 'empty';
  const posture = lanePosture(position);
  const attackMargin = signedBucket(positionPower(position) - positionDefense(position), 3, 2);
  const defenseMods = bucket(
    Number(Boolean(position.weaponBottom)) + Number(Boolean(position.drugBottom)) + Number(Boolean(position.cashRight)),
    2,
  );
  return `${posture}:${attackMargin}:${defenseMods}`;
}

function structuralLaneRole(position: Position): 'funded' | 'pushed' | null {
  if (!position.crew || position.seized) return null;
  if (position.weaponTop && position.drugTop && position.cashLeft) return 'pushed';
  if (position.weaponTop && position.cashLeft) return 'funded';
  return null;
}

function focusedLaneProfile(
  state: TurfGameState,
  side: 'A' | 'B',
  own: PlayerState,
): string {
  const memory = state.aiMemory[side];
  if (memory.focusLane === null || memory.focusRole === null) return 'none';
  const lane = own.board.active[memory.focusLane];
  if (!lane?.crew || lane.seized) return `${memory.focusRole}:lost`;
  const readiness = memory.focusRole === 'pushed'
    ? Number(findPushReady(own.board).includes(memory.focusLane))
    : Number(findFundedReady(own.board).includes(memory.focusLane));
  return `${memory.focusRole}:${lanePressureProfile(lane)}:${readiness}`;
}

function combatStateKey(state: TurfGameState, side: 'A' | 'B', own: PlayerState, opponent: PlayerState): string {
  const ownCrewCount = own.board.active.filter(pos => pos.crew).length;
  const opponentCrewCount = opponent.board.active.filter(pos => pos.crew).length;
  const ownSeized = seizedCount(own.board);
  const opponentSeized = seizedCount(opponent.board);
  const ownReadyDirect = findDirectReady(own.board).length;
  const ownReadyFunded = findFundedReady(own.board).length;
  const ownReadyPushed = findPushReady(own.board).length;
  const handWeaponsCount = handWeapons(own).length;
  const handProductsCount = handDrugs(own).length;
  const handCashCount = handCash(own).length;
  const ownPower = own.board.active.reduce((sum, pos) => sum + positionPower(pos), 0);
  const ownDefense = own.board.active.reduce((sum, pos) => sum + positionDefense(pos), 0);
  const opponentPower = opponent.board.active.reduce((sum, pos) => sum + positionPower(pos), 0);
  const opponentDefense = opponent.board.active.reduce((sum, pos) => sum + positionDefense(pos), 0);
  const hotLane = own.board.active.find(pos => pos.crew && (offensiveCash(pos) > 0 || pos.drugTop || pos.weaponTop)) ??
    own.board.active.find(pos => pos.crew) ??
    null;
  const threatLane = opponent.board.active.find(pos => pos.crew && positionPower(pos) >= positionDefense(pos)) ??
    opponent.board.active.find(pos => pos.crew) ??
    null;
  const focusedLane = focusedLaneProfile(state, side, own);

  return [
    'combat',
    signedBucket(ownCrewCount - opponentCrewCount, 2, 2),
    signedBucket(ownSeized - opponentSeized, 1, 2),
    `${Number(ownReadyDirect > 0)}${Number(ownReadyFunded > 0)}${Number(ownReadyPushed > 0)}`,
    `${Number(own.hand.crew.length > 0)}:${Number(handWeaponsCount > 0)}:${Number(handProductsCount > 0)}:${Number(handCashCount > 0)}`,
    signedBucket(ownPower - opponentDefense, 5, 3),
    signedBucket(opponentPower - ownDefense, 5, 3),
    hotLane ? lanePressureProfile(hotLane) : 'none',
    threatLane ? lanePressureProfile(threatLane) : 'none',
    focusedLane,
  ].join('|');
}

export function createObservation(state: TurfGameState, side: 'A' | 'B'): TurfObservation {
  const own = state.players[side];
  const opponentSide: 'A' | 'B' = side === 'A' ? 'B' : 'A';
  const opponent = state.players[opponentSide];
  const ownCrewCount = own.board.active.filter(pos => pos.crew).length;
  const opponentCrewCount = opponent.board.active.filter(pos => pos.crew).length;
  const ownSeized = seizedCount(own.board);
  const opponentSeized = seizedCount(opponent.board);
  const ownReadyDirect = findDirectReady(own.board).length;
  const ownReadyFunded = findFundedReady(own.board).length;
  const ownReadyPushed = findPushReady(own.board).length;
  const handWeaponsCount = handWeapons(own).length;
  const handProductsCount = handDrugs(own).length;
  const handCashCount = handCash(own).length;
  const handBackpacksCount = own.hand.backpacks.length;
  const activeRunners = own.board.active.filter(pos => pos.runner).length;
  const stagedBackpacks = own.board.reserve.filter(pos => pos.backpack).length;
  const ownPower = own.board.active.reduce((sum, pos) => sum + positionPower(pos), 0);
  const ownDefense = own.board.active.reduce((sum, pos) => sum + positionDefense(pos), 0);
  const opponentPower = opponent.board.active.reduce((sum, pos) => sum + positionPower(pos), 0);
  const opponentDefense = opponent.board.active.reduce((sum, pos) => sum + positionDefense(pos), 0);
  const hotLane = own.board.active.findIndex(pos => pos.crew && (offensiveCash(pos) > 0 || pos.drugTop || pos.weaponTop));
  const threatLane = opponent.board.active.findIndex(pos => pos.crew && positionPower(pos) >= positionDefense(pos));
  const stateKey = state.phase === 'combat'
    ? combatStateKey(state, side, own, opponent)
    : [
      state.phase,
      bucket(ownCrewCount, 2),
      bucket(opponentCrewCount, 2),
      ownSeized,
      opponentSeized,
      ownReadyDirect,
      ownReadyFunded,
      ownReadyPushed,
      bucket(own.hand.crew.length, 2),
      bucket(handWeaponsCount, 2),
      bucket(handProductsCount, 2),
      bucket(handCashCount, 2),
      hotLane >= 0 ? laneSignature(own.board.active[hotLane]) : 'none',
      threatLane >= 0 ? laneSignature(opponent.board.active[threatLane]) : 'none',
    ].join('|');

  return {
    phase: state.phase,
    side,
    turnNumber: state.turnNumber,
    ownCrewCount,
    opponentCrewCount,
    ownSeized,
    opponentSeized,
    ownReadyDirect,
    ownReadyFunded,
    ownReadyPushed,
    handCrew: own.hand.crew.length,
    handWeapons: handWeaponsCount,
    handProducts: handProductsCount,
    handCash: handCashCount,
    handBackpacks: handBackpacksCount,
    activeRunners,
    stagedBackpacks,
    ownPower,
    ownDefense,
    opponentPower,
    opponentDefense,
    stateKey,
  };
}

function legalModifierActions(
  state: TurfGameState,
  side: 'A' | 'B',
  kind: TurfActionKind,
  cards: ModifierCard[],
): TurfAction[] {
  const player = state.players[side];
  const actions: TurfAction[] = [];

  for (const card of cards) {
    for (let positionIdx = 0; positionIdx < player.board.active.length; positionIdx++) {
      const position = player.board.active[positionIdx];
      if (!position.crew || position.seized) continue;
      if (card.type === 'weapon') {
        if (!position.weaponTop) actions.push({ kind, side, positionIdx, slot: 'offense', modifierCardId: card.id });
        if (!position.weaponBottom) actions.push({ kind, side, positionIdx, slot: 'defense', modifierCardId: card.id });
      }
      if (card.type === 'product') {
        if (!position.drugTop) actions.push({ kind, side, positionIdx, slot: 'offense', modifierCardId: card.id });
        if (!position.drugBottom) actions.push({ kind, side, positionIdx, slot: 'defense', modifierCardId: card.id });
      }
      if (card.type === 'cash') {
        if (!position.cashLeft) actions.push({ kind, side, positionIdx, slot: 'offense', modifierCardId: card.id });
        if (!position.cashRight) actions.push({ kind, side, positionIdx, slot: 'defense', modifierCardId: card.id });
      }
    }
  }

  return actions;
}

export function enumerateLegalActions(state: TurfGameState, side: 'A' | 'B'): TurfAction[] {
  const player = state.players[side];
  const opponent = state.players[side === 'A' ? 'B' : 'A'];
  const actions: TurfAction[] = [];

  for (let positionIdx = 0; positionIdx < player.board.active.length; positionIdx++) {
    const position = player.board.active[positionIdx];
    if (position.seized) {
      for (const crew of player.hand.crew) {
        for (const cash of handCash(player)) {
          actions.push({
            kind: 'reclaim',
            side,
            positionIdx,
            crewCardId: crew.id,
            cashCardId: cash.id,
          });
        }
      }
    }
  }

  for (const crew of player.hand.crew) {
    for (let positionIdx = 0; positionIdx < player.board.active.length; positionIdx++) {
      const position = player.board.active[positionIdx];
      if (!position.crew && !position.seized) {
        actions.push({ kind: 'place_crew', side, positionIdx, crewCardId: crew.id });
      }
    }
  }

  if (state.phase === 'buildup') {
    for (const crew of player.hand.crew) {
      for (let reserveIdx = 0; reserveIdx < player.board.reserve.length; reserveIdx++) {
        const reserve = player.board.reserve[reserveIdx];
        if (!reserve.crew && !reserve.seized) {
          actions.push({ kind: 'place_reserve_crew', side, reserveIdx, crewCardId: crew.id });
        }
      }
    }

    for (const backpack of player.hand.backpacks) {
      for (let reserveIdx = 0; reserveIdx < player.board.reserve.length; reserveIdx++) {
        const reserve = player.board.reserve[reserveIdx];
        if (reserve.crew && !reserve.backpack && !reserve.seized) {
          actions.push({ kind: 'equip_backpack', side, reserveIdx, backpackCardId: backpack.id });
        }
      }
    }

    for (let reserveIdx = 0; reserveIdx < player.board.reserve.length; reserveIdx++) {
      const reserve = player.board.reserve[reserveIdx];
      if (!reserve.runner || !reserve.crew || reserve.seized) continue;
      for (let positionIdx = 0; positionIdx < player.board.active.length; positionIdx++) {
        const active = player.board.active[positionIdx];
        if (!active.seized) {
          actions.push({ kind: 'deploy_runner', side, reserveIdx, positionIdx });
        }
      }
    }

    for (let positionIdx = 0; positionIdx < player.board.active.length; positionIdx++) {
      const lane = player.board.active[positionIdx];
      if (!lane.runner || !lane.backpack || !lane.crew || lane.seized) continue;
      for (const payload of lane.backpack.payload) {
        if (payload.type === 'weapon') {
          if (!lane.weaponTop) actions.push({ kind: 'deploy_payload', side, positionIdx, slot: 'offense', modifierCardId: payload.id });
          if (!lane.weaponBottom) actions.push({ kind: 'deploy_payload', side, positionIdx, slot: 'defense', modifierCardId: payload.id });
        } else if (payload.type === 'product') {
          if (!lane.drugTop) actions.push({ kind: 'deploy_payload', side, positionIdx, slot: 'offense', modifierCardId: payload.id });
          if (!lane.drugBottom) actions.push({ kind: 'deploy_payload', side, positionIdx, slot: 'defense', modifierCardId: payload.id });
        } else if (payload.type === 'cash') {
          if (!lane.cashLeft) actions.push({ kind: 'deploy_payload', side, positionIdx, slot: 'offense', modifierCardId: payload.id });
          if (!lane.cashRight) actions.push({ kind: 'deploy_payload', side, positionIdx, slot: 'defense', modifierCardId: payload.id });
        }
      }
    }
  }

  actions.push(...legalModifierActions(state, side, 'arm_weapon', handWeapons(player)));
  actions.push(...legalModifierActions(state, side, 'stack_product', handDrugs(player)));
  actions.push(...legalModifierActions(state, side, 'stack_cash', handCash(player)));

  if (state.phase === 'combat') {
    for (const attackerIdx of findDirectReady(player.board)) {
      const attacker = player.board.active[attackerIdx];
      if (!attacker.crew) continue;
      for (let targetIdx = 0; targetIdx < opponent.board.active.length; targetIdx++) {
        const target = opponent.board.active[targetIdx];
        if (!target.crew) continue;
        if (canPrecisionAttack(
          positionPower(attacker),
          positionDefense(target),
          state.config.precisionMult,
          attacker.crew.archetype === 'bruiser',
        )) {
          actions.push({ kind: 'direct_attack', side, attackerIdx, targetIdx });
        }
      }
    }

    for (const attackerIdx of findFundedReady(player.board)) {
      for (let targetIdx = 0; targetIdx < opponent.board.active.length; targetIdx++) {
        if (opponent.board.active[targetIdx].crew) {
          actions.push({ kind: 'funded_attack', side, attackerIdx, targetIdx });
        }
      }
    }

    for (const attackerIdx of findPushReady(player.board)) {
      for (let targetIdx = 0; targetIdx < opponent.board.active.length; targetIdx++) {
        if (opponent.board.active[targetIdx].crew) {
          actions.push({ kind: 'pushed_attack', side, attackerIdx, targetIdx });
        }
      }
    }
  }

  actions.sort((a, b) => normalizeActionKey(a).localeCompare(normalizeActionKey(b)));
  actions.push({ kind: 'pass', side });
  return actions;
}

function updatePlannerMemoryFromAction(memory: PlannerMemory, action: TurfAction, reward: number): void {
  memory.lastActionKind = action.kind;
  if (action.kind === 'pass') {
    memory.consecutivePasses++;
  } else {
    memory.consecutivePasses = 0;
  }

  if ((action.attackerIdx ?? action.positionIdx) !== undefined) {
    const lane = action.targetIdx ?? action.positionIdx ?? action.attackerIdx ?? 0;
    if (reward <= 0) {
      memory.blockedLanes[lane] = (memory.blockedLanes[lane] ?? 0) + 1;
      memory.failedPlans++;
    } else {
      delete memory.blockedLanes[lane];
      memory.pressuredLanes[lane] = (memory.pressuredLanes[lane] ?? 0) + 1;
    }
  }

  if (action.positionIdx !== undefined) {
    if (action.kind === 'place_crew') {
      delete memory.laneRoles[action.positionIdx];
      if (memory.focusLane === action.positionIdx) {
        memory.focusLane = null;
        memory.focusRole = null;
      }
    }
  }

  if (action.kind === 'reclaim' && action.positionIdx !== undefined) {
    delete memory.laneRoles[action.positionIdx];
    if (memory.focusLane === action.positionIdx) {
      memory.focusLane = null;
      memory.focusRole = null;
    }
  }
}

function syncLaneMemoryFromBoard(
  memory: PlannerMemory,
  board: PlayerState['board'],
  laneIdx: number | undefined,
  preferFocus = false,
): void {
  if (laneIdx === undefined) return;
  const lane = board.active[laneIdx];
  if (!lane) return;
  const role = structuralLaneRole(lane);
  if (role) {
    memory.laneRoles[laneIdx] = role;
    if (preferFocus || memory.focusLane === laneIdx) {
      memory.focusLane = laneIdx;
      memory.focusRole = role;
    }
  } else {
    delete memory.laneRoles[laneIdx];
    if (memory.focusLane === laneIdx) {
      memory.focusLane = null;
      memory.focusRole = null;
    }
  }
}

function resolveOutcome(
  state: TurfGameState,
  side: 'A' | 'B',
  targetIdx: number,
  outcome: ReturnType<typeof resolveDirectAttack>,
): number {
  const player = state.players[side];
  const opponent = state.players[side === 'A' ? 'B' : 'A'];
  let reward = 0;

  if (outcome.type === 'kill') {
    state.metrics.kills++;
    reward += 2;
    awardCash(player);
    if (!opponent.board.active[targetIdx].crew) {
      seizePosition(opponent.board.active[targetIdx]);
      player.positionsSeized++;
      state.metrics.seizures++;
      state.metrics.laneConversions++;
      reward += 4;
    }
  } else if (outcome.type === 'flip') {
    state.metrics.flips += outcome.gainedCards.length;
    reward += 2;
    awardCash(player);
    for (const card of outcome.gainedCards) {
      if (card.type === 'crew') {
        const emptyIdx = findEmptyActive(player.board);
        if (emptyIdx >= 0) {
          placeCrew(player.board, emptyIdx, card as CrewCard);
          reward += 1;
        }
      }
    }
    if (!opponent.board.active[targetIdx].crew) {
      seizePosition(opponent.board.active[targetIdx]);
      player.positionsSeized++;
      state.metrics.seizures++;
      state.metrics.laneConversions++;
      reward += 4;
    }
  } else if (outcome.type === 'busted' || outcome.type === 'seized') {
    state.metrics.busts++;
    reward -= 1;
  } else if (outcome.type === 'miss') {
    reward -= 1;
  }

  return reward;
}

export function stepAction(state: TurfGameState, action: TurfAction): TurfStepResult {
  const player = state.players[action.side];
  let reward = 0;
  let reason: string = action.kind;

  switch (action.kind) {
    case 'pass':
      state.metrics.passes++;
      reward -= 0.5;
      break;

    case 'place_crew': {
      if (action.positionIdx === undefined || !action.crewCardId) throw new Error('Invalid place_crew action');
      const crew = removeCrew(player, action.crewCardId);
      if (!crew || !placeCrew(player.board, action.positionIdx, crew)) throw new Error('Illegal place_crew action');
      state.metrics.crewPlaced++;
      reward += 1;
      break;
    }

    case 'place_reserve_crew': {
      if (action.reserveIdx === undefined || !action.crewCardId) throw new Error('Invalid place_reserve_crew action');
      const crew = removeCrew(player, action.crewCardId);
      if (!crew || !placeReserveCrew(player.board, action.reserveIdx, crew)) throw new Error('Illegal place_reserve_crew action');
      state.metrics.crewPlaced++;
      state.metrics.reserveCrewPlaced++;
      reward += 0.9;
      break;
    }

    case 'equip_backpack': {
      if (action.reserveIdx === undefined || !action.backpackCardId) throw new Error('Invalid equip_backpack action');
      const idx = player.hand.backpacks.findIndex(card => card.id === action.backpackCardId);
      if (idx < 0) throw new Error('Illegal equip_backpack action');
      const backpack = player.hand.backpacks.splice(idx, 1)[0];
      const reserve = player.board.reserve[action.reserveIdx];
      if (!backpack || !reserve || !equipBackpack(reserve, backpack, true)) {
        throw new Error('Illegal equip_backpack action');
      }
      state.metrics.backpacksEquipped++;
      reward += 1.15;
      break;
    }

    case 'deploy_runner': {
      if (action.reserveIdx === undefined || action.positionIdx === undefined) throw new Error('Invalid deploy_runner action');
      if (state.phase !== 'buildup' || !deployRunner(player.board, action.reserveIdx, action.positionIdx)) {
        throw new Error('Illegal deploy_runner action');
      }
      state.metrics.runnerDeployments++;
      reward += 1.35;
      break;
    }

    case 'deploy_payload': {
      if (action.positionIdx === undefined || !action.modifierCardId || !action.slot) {
        throw new Error('Invalid deploy_payload action');
      }
      const lane = player.board.active[action.positionIdx];
      if (!lane?.runner || !lane.backpack || !lane.crew) throw new Error('Illegal deploy_payload action');
      const card = takePayload(lane, action.modifierCardId);
      if (!card || !placeModifier(player.board, action.positionIdx, card, action.slot)) {
        throw new Error('Illegal deploy_payload action');
      }
      recordPlacementMetrics(state, card, action.slot);
      state.metrics.payloadDeployments++;
      reward += action.slot === 'offense' ? 1.45 : 1.15;
      break;
    }

    case 'arm_weapon':
    case 'stack_product':
    case 'stack_cash': {
      if (action.positionIdx === undefined || !action.slot || !action.modifierCardId) throw new Error('Invalid modifier action');
      const card = removeModifier(player, action.modifierCardId);
      if (!card || !placeModifier(player.board, action.positionIdx, card, action.slot)) {
        throw new Error(`Illegal ${action.kind} action`);
      }
      recordPlacementMetrics(state, card, action.slot);
      reward += action.slot === 'offense' ? 1.25 : 1;
      break;
    }

    case 'reclaim': {
      if (action.positionIdx === undefined || !action.crewCardId || !action.cashCardId) throw new Error('Invalid reclaim action');
      const crew = removeCrew(player, action.crewCardId);
      const cash = removeModifier(player, action.cashCardId);
      if (!crew || !cash || cash.type !== 'cash') throw new Error('Illegal reclaim action');
      const position = player.board.active[action.positionIdx];
      if (!position.seized) throw new Error('Cannot reclaim open lane');
      position.seized = false;
      position.crew = {
        ...crew,
        power: Math.max(1, Math.floor(crew.power / 2)),
        resistance: Math.max(1, Math.floor(crew.resistance / 2)),
      };
      position.turnsActive = 0;
      state.metrics.positionsReclaimed++;
      state.metrics.cashPlayed++;
      state.metrics.crewPlaced++;
      reward += 2;
      break;
    }

    case 'direct_attack':
    case 'funded_attack':
    case 'pushed_attack': {
      if (action.attackerIdx === undefined || action.targetIdx === undefined) throw new Error('Invalid attack action');
      const opponent = state.players[action.side === 'A' ? 'B' : 'A'];
      const attacker = player.board.active[action.attackerIdx];
      const target = opponent.board.active[action.targetIdx];
      if (!attacker.crew || !target.crew) throw new Error(`Illegal ${action.kind} action`);
      const outcome = action.kind === 'direct_attack'
        ? resolveDirectAttack(attacker, target)
        : action.kind === 'funded_attack'
          ? resolveFundedAttack(attacker, target, state.config)
          : resolvePushedAttack(attacker, target, opponent.board.active, state.config);
      if (action.kind === 'direct_attack') state.metrics.directAttacks++;
      if (action.kind === 'funded_attack') state.metrics.fundedAttacks++;
      if (action.kind === 'pushed_attack') state.metrics.pushedAttacks++;
      reward += resolveOutcome(state, action.side, action.targetIdx, outcome);
      if (action.kind === 'funded_attack') {
        if (outcome.type === 'flip') reward += 1.25;
        if (outcome.type === 'busted') reward += 0.35;
      } else if (action.kind === 'pushed_attack') {
        if (outcome.type === 'flip') reward += 0.35;
      }
      reason = `${action.kind}:${outcome.type}`;
      break;
    }
  }

  if (player.hand.crew.length === 0 && player.hand.modifiers.length === 0 && player.hand.backpacks.length === 0) {
    state.metrics.deadHandTurns++;
  }

  updatePlannerMemoryFromAction(state.aiMemory[action.side], action, reward);
  if (action.positionIdx !== undefined) {
    const preferFocus = action.slot === 'offense' && (
      action.kind === 'arm_weapon' ||
      action.kind === 'stack_cash' ||
      action.kind === 'stack_product'
    );
    syncLaneMemoryFromBoard(state.aiMemory[action.side], player.board, action.positionIdx, preferFocus);
  }
  if (action.attackerIdx !== undefined) {
    syncLaneMemoryFromBoard(
      state.aiMemory[action.side],
      player.board,
      action.attackerIdx,
      action.kind === 'funded_attack' || action.kind === 'pushed_attack',
    );
  }

  const enemySide: 'A' | 'B' = action.side === 'A' ? 'B' : 'A';
  if (seizedCount(state.players[enemySide].board) >= state.config.positionCount) {
    state.winner = action.side;
    state.endReason = 'total_seizure';
  }

  return {
    reward,
    actionKey: normalizeActionKey(action),
    terminal: Boolean(state.winner),
    reason,
  };
}

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
