/**
 * PlayerGovernor — browser-based AI player that operates through DOM clicks.
 *
 * No ECS bypass, no sim shortcuts. Reads the DOM to perceive game state,
 * makes decisions using a simplified scoring heuristic, and executes
 * actions via Playwright clicks on actual UI elements.
 *
 * Perception is limited to what a human player sees:
 * - Own turf (visible), opponent turf (face-down = unknown composition)
 * - Action budget, turn number, heat level, deck count
 * - Pending card (if drawn)
 * - Queued strikes (visible as chips)
 */
import type { Page, TestInfo } from '@playwright/test';
import { activate } from './activate';

export interface PerceivedState {
  turnNumber: number;
  actionsRemaining: number;
  actionsTotal: number;
  deckCount: number;
  hasPending: boolean;
  pendingIsTough: boolean;
  endTurnAvailable: boolean;
  turnEnded: boolean;
  waitingForOpponent: boolean;
  playerTurfEmpty: boolean;
  playerTurfHasTough: boolean;
  opponentTurfEmpty: boolean;
  heat: string;
  turfsPlayer: number;
  turfsOpponent: number;
  queuedStrikeCount: number;
  canDraw: boolean;
  gameOver: boolean;
  stackFanOpen: boolean;
}

async function perceive(page: Page): Promise<PerceivedState> {
  return page.evaluate(() => {
    const qs = (sel: string) => document.querySelector(sel);
    const txt = (sel: string) => qs(sel)?.textContent?.trim() ?? '';

    const gameOver = !!qs('[data-testid="gameover-screen"]');
    if (gameOver) {
      return {
        turnNumber: 0,
        actionsRemaining: 0,
        actionsTotal: 0,
        deckCount: 0,
        hasPending: false,
        pendingIsTough: false,
        endTurnAvailable: false,
        turnEnded: true,
        waitingForOpponent: false,
        playerTurfEmpty: true,
        playerTurfHasTough: false,
        opponentTurfEmpty: true,
        heat: '0%',
        turfsPlayer: 0,
        turfsOpponent: 0,
        queuedStrikeCount: 0,
        canDraw: false,
        gameOver: true,
        stackFanOpen: false,
      } satisfies PerceivedState;
    }

    const budgetText = txt('[data-testid="action-budget"]');
    const budgetMatch = budgetText.match(/(\d+)\/(\d+)/);
    const actionsRemaining = budgetMatch ? parseInt(budgetMatch[1]) : 0;
    const actionsTotal = budgetMatch ? parseInt(budgetMatch[2]) : 0;

    const turnEl = qs('.game-hud-bar-turn');
    const turnMatch = turnEl?.textContent?.match(/(\d+)/);
    const turnNumber = turnMatch ? parseInt(turnMatch[1]) : 1;

    const deckText = txt('[data-testid="slot-player-draw"]');
    const deckMatch = deckText.match(/(\d+)/);
    const deckCount = deckMatch ? parseInt(deckMatch[1]) : 0;

    const hasPending = !!qs('[data-testid="pending-card"]');
    const waitingForOpponent = !!qs('[data-testid="opponent-turn-overlay"]');

    const endTurnBtn = qs(
      '[data-testid="action-end_turn"]',
    ) as HTMLButtonElement | null;
    const endTurnAvailable = !!endTurnBtn && !endTurnBtn.disabled;
    const turnEnded = endTurnBtn?.disabled ?? false;

    const playerTurf = qs('[data-testid="turf-lane-A"]');
    const playerTurfEmpty = !!playerTurf?.querySelector(
      '.turf-composite-empty',
    );
    const playerTurfHasTough = !!playerTurf?.querySelector(
      '.turf-composite-roster-entry, .turf-composite-compact-name',
    );

    const opponentTurf = qs('[data-testid="turf-lane-B"]');
    const opponentTurfEmpty = !!opponentTurf?.querySelector(
      '.turf-composite-empty',
    );

    const turfsText = txt('.game-hud-bar-turfs');
    const turfsMatch = turfsText.match(/(\d+)\s*vs\s*(\d+)/);
    const turfsPlayer = turfsMatch ? parseInt(turfsMatch[1]) : 0;
    const turfsOpponent = turfsMatch ? parseInt(turfsMatch[2]) : 0;

    const heatText = txt('.game-hud-bar');
    const heatMatch = heatText.match(/(\d+)%/);
    const heat = heatMatch ? `${heatMatch[1]}%` : '0%';

    const drawSlot = qs('[data-testid="slot-player-draw"]');
    const hudDraw = qs('[data-testid="hud-draw"]') as HTMLButtonElement | null;
    const hudDrawAvailable =
      !!hudDraw && !hudDraw.disabled && hudDraw.getClientRects().length > 0;
    const canDraw =
      (drawSlot?.classList.contains('board-slot-tappable') ?? false) ||
      hudDrawAvailable;

    const chips = document.querySelectorAll('[data-testid^="queued-chip-"]');
    const queuedStrikeCount = chips.length;

    const pendingEl = qs('[data-testid="pending-card"]');
    const pendingCardEl = pendingEl?.querySelector('.card-tough');
    const pendingIsTough = !!pendingCardEl;

    const stackFanOpen = !!qs('.stack-fan-backdrop');

    return {
      turnNumber,
      actionsRemaining,
      actionsTotal,
      deckCount,
      hasPending,
      pendingIsTough,
      endTurnAvailable,
      turnEnded,
      waitingForOpponent,
      playerTurfEmpty,
      playerTurfHasTough,
      opponentTurfEmpty,
      heat,
      turfsPlayer,
      turfsOpponent,
      queuedStrikeCount,
      canDraw,
      gameOver,
      stackFanOpen,
    } satisfies PerceivedState;
  });
}

type GovernorAction =
  | 'draw'
  | 'place'
  | 'place_pick_slot'
  | 'discard'
  | 'strike_open_fan'
  | 'strike_pick_tough'
  | 'strike_target'
  | 'end_turn'
  | 'wait';

const MAX_DRAWS_PER_TURN = 3;
const MAX_ACTIONS_PER_TURN = 12;

function parseHeat(state: PerceivedState): number {
  const match = state.heat.match(/(\d+)/);
  return match ? parseInt(match[1]) / 100 : 0;
}

interface ScoredCandidate {
  action: GovernorAction;
  score: number;
}

function scoreActions(
  state: PerceivedState,
  strikeBlockedThisTurn: boolean,
  drawsThisTurn: number,
  actionsThisTurn: number,
): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = [];
  const heat = parseHeat(state);
  const canStrike =
    !strikeBlockedThisTurn &&
    state.playerTurfHasTough &&
    !state.opponentTurfEmpty &&
    state.actionsRemaining > 0;
  const lastTurf = state.turfsOpponent <= 1;

  // Draw: valuable when board is empty, diminishes as toughs build
  if (
    state.canDraw &&
    drawsThisTurn < MAX_DRAWS_PER_TURN &&
    actionsThisTurn < MAX_ACTIONS_PER_TURN
  ) {
    let score = 0.3;
    if (state.playerTurfEmpty)
      score += 2.0; // urgent: need toughs on board
    else if (!state.playerTurfHasTough) score += 1.5;
    else score -= 0.5; // already have toughs, drawing is less valuable
    candidates.push({ action: 'draw', score });
  }

  // Strike: high value, especially on last turf
  if (canStrike && state.queuedStrikeCount === 0) {
    let score = 3.0;
    if (lastTurf) score += 5.0;
    score -= heat * 3.0; // heat penalty
    candidates.push({ action: 'strike_open_fan', score });
  } else if (canStrike && state.queuedStrikeCount > 0) {
    // Second strike in same turn — lower priority
    let score = 1.5;
    if (lastTurf) score += 3.0;
    score -= heat * 3.0;
    candidates.push({ action: 'strike_open_fan', score });
  }

  // End turn: only attractive when nothing else is valuable
  if (state.endTurnAvailable) {
    candidates.push({
      action: 'end_turn',
      score: state.actionsRemaining <= 0 ? 5.0 : -0.5,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function decide(
  state: PerceivedState,
  expectingStrikeTarget: boolean,
  strikeBlockedThisTurn: boolean,
  drawsThisTurn: number,
  actionsThisTurn: number,
): GovernorAction {
  if (state.gameOver) return 'wait';
  if (state.waitingForOpponent) return 'wait';
  if (state.turnEnded) return 'wait';
  if (
    state.actionsRemaining <= 0 &&
    !state.hasPending &&
    !state.stackFanOpen &&
    !expectingStrikeTarget
  ) {
    return state.endTurnAvailable ? 'end_turn' : 'wait';
  }

  // In-progress multi-step actions take priority
  if (state.stackFanOpen && state.hasPending) return 'place_pick_slot';
  if (expectingStrikeTarget && !state.stackFanOpen && !state.opponentTurfEmpty)
    return 'strike_target';
  if (state.stackFanOpen) return 'strike_pick_tough';

  // Pending card must be handled before anything else
  if (state.hasPending) {
    if (state.pendingIsTough) return 'place';
    if (state.playerTurfHasTough) return 'place';
    return 'discard';
  }

  // Safety: if we've taken too many actions this turn, end it
  if (
    actionsThisTurn >= MAX_ACTIONS_PER_TURN &&
    !state.hasPending &&
    !state.stackFanOpen &&
    !expectingStrikeTarget
  ) {
    return state.endTurnAvailable ? 'end_turn' : 'wait';
  }

  // Score remaining actions and pick the best
  const ranked = scoreActions(
    state,
    strikeBlockedThisTurn,
    drawsThisTurn,
    actionsThisTurn,
  );
  return ranked.length > 0 ? ranked[0].action : 'wait';
}

async function execute(
  page: Page,
  testInfo: TestInfo,
  action: GovernorAction,
  verbose = false,
): Promise<boolean> {
  switch (action) {
    case 'draw': {
      const compactButton = page.getByTestId('hud-draw');
      const compactVisible = await compactButton
        .isVisible({ timeout: 250 })
        .catch(() => false);
      const compactEnabled = await compactButton.isEnabled().catch(() => false);
      if (compactVisible && compactEnabled) {
        await activate(compactButton, testInfo);
        return true;
      }
      const slot = page.getByTestId('slot-player-draw');
      await activate(slot, testInfo);
      return true;
    }
    case 'place': {
      const turf = page.getByTestId('turf-lane-A');
      await activate(turf, testInfo);
      return true;
    }
    case 'place_pick_slot': {
      const slot = page.locator('[data-testid^="stack-fan-insert-"]').first();
      if (await slot.isVisible({ timeout: 1000 }).catch(() => false)) {
        await activate(slot, testInfo);
        return true;
      } else {
        const close = page.locator('.stack-fan-close');
        if (await close.isVisible({ timeout: 500 }).catch(() => false)) {
          if (verbose) {
            console.log('[Gov] closing stack fan: no visible insert slot');
          }
          await activate(close, testInfo);
        }
      }
      return false;
    }
    case 'discard': {
      const market = page.getByTestId('slot-market');
      await activate(market, testInfo);
      return true;
    }
    case 'strike_open_fan': {
      const turf = page.getByTestId('turf-lane-A');
      await activate(turf, testInfo);
      await page.waitForTimeout(150);
      return true;
    }
    case 'strike_pick_tough': {
      const activeTough = page
        .locator(
          '.stack-fan-card-active.stack-fan-card-pickable[data-card-kind="tough"][data-face-up="true"]',
        )
        .first();
      if (await activeTough.isVisible({ timeout: 250 }).catch(() => false)) {
        await activate(activeTough, testInfo);
        return true;
      }
      const visibleTough = page
        .locator(
          '.stack-fan-card-pickable[data-card-kind="tough"][data-face-up="true"]:visible',
        )
        .first();
      if (await visibleTough.isVisible({ timeout: 750 }).catch(() => false)) {
        await activate(visibleTough, testInfo);
        return true;
      } else {
        const close = page.locator('.stack-fan-close');
        if (await close.isVisible({ timeout: 500 }).catch(() => false)) {
          if (verbose) {
            console.log('[Gov] closing stack fan: no visible strike tough');
          }
          await activate(close, testInfo);
        }
      }
      return false;
    }
    case 'strike_target': {
      const before = await perceive(page);
      const oppTurf = page.getByTestId('turf-lane-B');
      await activate(oppTurf, testInfo);
      let progressed = false;
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(100);
        const after = await perceive(page);
        progressed =
          after.gameOver ||
          after.turnNumber !== before.turnNumber ||
          after.actionsRemaining < before.actionsRemaining ||
          after.queuedStrikeCount > before.queuedStrikeCount ||
          after.waitingForOpponent !== before.waitingForOpponent ||
          after.turnEnded !== before.turnEnded;
        if (progressed) break;
      }
      if (!progressed && verbose) {
        console.log('[Gov] strike target made no visible progress');
      }
      return progressed;
    }
    case 'end_turn': {
      const btn = page.getByTestId('action-end_turn');
      if (await btn.isVisible().catch(() => false)) {
        await activate(btn, testInfo);
        return true;
      }
      return false;
    }
    case 'wait':
      await page.waitForTimeout(300);
      return false;
  }
}

export interface GovernorLog {
  turn: number;
  action: GovernorAction;
  state: PerceivedState;
}

export interface GovernorResult {
  turns: number;
  winner: 'A' | 'B' | 'unknown';
  log: GovernorLog[];
  reason: 'game-over' | 'max-actions' | 'stuck';
}

export interface GovernorOptions {
  maxActions?: number;
  actionDelayMs?: number;
  verbose?: boolean;
}

function logGovernorAction(
  state: PerceivedState,
  action: GovernorAction,
  consecutiveWaits: number,
): void {
  console.log(
    `[Gov] T${state.turnNumber} A${state.actionsRemaining}/${state.actionsTotal}` +
      ` ${action}` +
      ` | pend=${Number(state.hasPending)}/${Number(state.pendingIsTough)}` +
      ` draw=${Number(state.canDraw)}` +
      ` turf=${Number(state.playerTurfEmpty)}/${Number(state.playerTurfHasTough)}` +
      ` wait=${Number(state.waitingForOpponent)}` +
      ` end=${Number(state.turnEnded)}` +
      ` waits=${consecutiveWaits}`,
  );
}

export async function runPlayerGovernor(
  page: Page,
  testInfo: TestInfo,
  options: GovernorOptions = {},
): Promise<GovernorResult> {
  const maxActions = options.maxActions ?? 2000;
  const actionDelayMs = options.actionDelayMs ?? 50;
  const log: GovernorLog[] = [];

  let lastTurn = 0;
  let consecutiveWaits = 0;
  let consecutiveSameAction = 0;
  let prevAction: GovernorAction = 'wait';
  let prevHasPending = false;
  let prevQueuedStrikeCount = 0;
  let expectingStrikeTarget = false;
  let strikeBlockedThisTurn = false;
  let drawsThisTurn = 0;
  let actionsThisTurn = 0;

  for (let i = 0; i < maxActions; i++) {
    const state = await perceive(page);

    if (state.gameOver) {
      const winnerText = await page
        .locator('.gameover-title')
        .textContent()
        .catch(() => '');
      const winner = winnerText?.includes('Victory')
        ? ('A' as const)
        : winnerText?.includes('Defeat')
          ? ('B' as const)
          : ('unknown' as const);
      return {
        turns: state.turnNumber || lastTurn,
        winner,
        log,
        reason: 'game-over',
      };
    }

    if (state.turnNumber > lastTurn) {
      lastTurn = state.turnNumber;
      consecutiveWaits = 0;
      consecutiveSameAction = 0;
      drawsThisTurn = 0;
      actionsThisTurn = 0;
      expectingStrikeTarget = false;
      strikeBlockedThisTurn = false;
    }

    if (
      state.queuedStrikeCount > prevQueuedStrikeCount ||
      state.waitingForOpponent ||
      state.turnEnded
    ) {
      expectingStrikeTarget = false;
    }

    let action = decide(
      state,
      expectingStrikeTarget,
      strikeBlockedThisTurn,
      drawsThisTurn,
      actionsThisTurn,
    );

    if (
      action === prevAction &&
      (action === 'place' ||
        action === 'place_pick_slot' ||
        action === 'discard') &&
      state.hasPending === prevHasPending
    ) {
      consecutiveSameAction++;
      if (consecutiveSameAction > 2) {
        action =
          state.hasPending && action !== 'discard'
            ? 'discard'
            : state.endTurnAvailable
              ? 'end_turn'
              : 'wait';
        consecutiveSameAction = 0;
      }
    } else if (
      action === prevAction &&
      (action === 'strike_open_fan' || action === 'strike_pick_tough')
    ) {
      consecutiveSameAction++;
      if (consecutiveSameAction > 3) {
        strikeBlockedThisTurn = true;
        action = state.endTurnAvailable ? 'end_turn' : 'wait';
        consecutiveSameAction = 0;
      }
    } else {
      consecutiveSameAction = 0;
    }

    if (options.verbose && (action !== 'wait' || consecutiveWaits % 50 === 0)) {
      logGovernorAction(state, action, consecutiveWaits);
    }
    log.push({ turn: state.turnNumber, action, state });
    prevAction = action;
    prevHasPending = state.hasPending;

    if (action === 'wait') {
      consecutiveWaits++;
      if (consecutiveWaits > 500) {
        return { turns: lastTurn, winner: 'unknown', log, reason: 'stuck' };
      }
    } else {
      consecutiveWaits = 0;
    }

    try {
      const activated = await execute(page, testInfo, action, options.verbose);
      if (activated) {
        if (action === 'draw') drawsThisTurn++;
        if (action !== 'wait') actionsThisTurn++;
      }
      if (action === 'strike_pick_tough') {
        expectingStrikeTarget = activated;
        if (!activated) strikeBlockedThisTurn = true;
      } else if (action === 'strike_target') {
        expectingStrikeTarget = false;
        strikeBlockedThisTurn = !activated;
      } else if (action !== 'strike_target' && action !== 'wait') {
        expectingStrikeTarget = false;
      }
    } catch {
      if (action === 'strike_pick_tough' || action === 'strike_target') {
        expectingStrikeTarget = false;
      }
      if (
        action === 'strike_open_fan' ||
        action === 'strike_pick_tough' ||
        action === 'strike_target'
      ) {
        strikeBlockedThisTurn = true;
      }
      if (options.verbose)
        console.log(`[Gov] execute failed for ${action}, skipping`);
    }

    prevQueuedStrikeCount = state.queuedStrikeCount;

    if (actionDelayMs > 0) {
      await page.waitForTimeout(actionDelayMs);
    }
  }

  return { turns: lastTurn, winner: 'unknown', log, reason: 'max-actions' };
}
