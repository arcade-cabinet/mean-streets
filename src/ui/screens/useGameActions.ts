/**
 * useGameActions — stateless action handlers factory.
 *
 * Returns a bundle of "on*" handlers that wrap the ECS action helpers
 * with the bookkeeping shared by GameScreen (flash messages, mode
 * reset, modal transitions). Keeping this outside GameScreen.tsx keeps
 * the screen file under 300 LOC without obscuring the state machine.
 */
import type { World } from 'koota';
import type { Card, Rarity, Turf } from '../../sim/turf/types';
import {
  blackMarketHealAction, blackMarketTradeAction,
  discardPendingAction, drawAction, endTurnAction,
  modifierSwapAction, playCardAction, queueStrikeAction,
  retreatAction, sendToHoldingAction, sendToMarketAction,
} from '../../ecs/actions';
import { hasToughOnTurf, turfCurrency, turfModifiers } from '../../sim/turf/board';
import type { ActionMode } from './GameScreenActionBar';
import { isStrikeMode, type StrikeKind, type StrikePhase } from './gameScreenHelpers';
import type { ModalView } from './GameScreen';

interface BuildArgs {
  world: World;
  pending: Card | null;
  playerActive: Turf | null;
  opponentActive: Turf | null;
  mode: ActionMode;
  strikePhase: StrikePhase;
  modal: ModalView;
  healTarget: { id: string; name: string } | null;
  setMode: (m: ActionMode) => void;
  setStrikePhase: (p: StrikePhase) => void;
  setModal: (m: ModalView) => void;
  setHealTarget: (t: { id: string; name: string } | null) => void;
  flash: (msg: string, durationMs?: number) => void;
  checkWin: () => boolean;
}

export function buildGameActions(a: BuildArgs) {
  const reset = () => {
    a.setMode(null);
    a.setStrikePhase('pick-source');
    a.setModal({ kind: 'none' });
    a.setHealTarget(null);
  };

  const placePending = () => {
    if (!a.pending || !a.playerActive) return;
    const r = playCardAction(a.world, 'A', 0, a.pending.id);
    reset();
    if (r?.reason === 'play_card_discarded_rival')
      a.flash('RIVAL DISCARDED — no buffer', 1800);
    a.checkWin();
  };

  const onModeSelect = (kind: 'draw' | NonNullable<ActionMode>) => {
    if (kind === 'draw') { drawAction(a.world, 'A'); a.flash('Drew', 700); return; }
    if (kind === a.mode) { reset(); return; }
    reset();
    a.setMode(kind);
    if (kind === 'retreat' && a.playerActive)
      a.setModal({ kind: 'stack', turf: a.playerActive, isOwn: true });
  };

  const onLaneClick = (side: 'A' | 'B') => {
    const m = a.mode;
    const stackModes: ActionMode[] = ['retreat', 'modifier_swap', 'send_to_market', 'send_to_holding'];
    if (a.pending && side === 'A' && !isStrikeMode(m) && !stackModes.includes(m)) {
      placePending(); return;
    }
    if (!m && side === 'A' && a.playerActive && a.playerActive.stack.length > 0 && !a.pending) {
      a.setModal({ kind: 'stack', turf: a.playerActive, isOwn: true });
      return;
    }
    if (!m && side === 'B' && a.opponentActive && a.opponentActive.stack.length > 0) {
      a.setModal({ kind: 'stack', turf: a.opponentActive, isOwn: false });
      return;
    }
    if (!m) return;
    if (m === 'play_card' && side === 'A') { placePending(); return; }
    if (stackModes.includes(m) && side === 'A' && a.playerActive) {
      a.setModal({ kind: 'stack', turf: a.playerActive, isOwn: true }); return;
    }
    if (!isStrikeMode(m)) return;
    if (a.strikePhase === 'pick-source' && side === 'A' && a.playerActive) {
      if (!hasToughOnTurf(a.playerActive)) return;
      if (m === 'pushed_strike' && (turfCurrency(a.playerActive).length === 0 || a.playerActive.closedRanks)) return;
      a.setStrikePhase('pick-target');
    } else if (a.strikePhase === 'pick-target' && side === 'B' && a.opponentActive) {
      const kind = m as StrikeKind;
      const r = queueStrikeAction(a.world, 'A', kind, 0, 0);
      reset();
      if (r) a.flash(`${kind.replace('_', ' ').toUpperCase()} QUEUED`, 1200);
    }
  };

  const onStackPick = (stackIdx: number) => {
    if (!a.playerActive) return;
    const m = a.mode;
    if (m === 'retreat') {
      const r = retreatAction(a.world, 'A', 0, stackIdx);
      reset(); if (r) a.flash('RETREAT', 700); return;
    }
    const sc = a.playerActive.stack[stackIdx];
    if (!sc) return;
    if (m === 'send_to_market' && sc.card.kind === 'tough') {
      const r = sendToMarketAction(a.world, 'A', sc.card.id);
      reset(); if (r) a.flash('SENT TO MARKET', 900); return;
    }
    if (m === 'send_to_holding' && sc.card.kind === 'tough') {
      const r = sendToHoldingAction(a.world, 'A', sc.card.id);
      reset(); if (r) a.flash('SENT TO HOLDING', 900); return;
    }
    if (!m && sc.card.kind === 'tough' && sc.faceUp && a.opponentActive && hasToughOnTurf(a.opponentActive)) {
      a.setMode('direct_strike');
      a.setStrikePhase('pick-target');
      a.setModal({ kind: 'none' });
      a.flash('Tap opponent turf to strike', 1500);
      return;
    }
    if (m !== 'modifier_swap') return;
    if (a.modal.kind === 'swap' && sc.card.kind === 'tough' && sc.card.id !== a.modal.sourceToughId) {
      const r = modifierSwapAction(a.world, 'A', 0, a.modal.sourceToughId, sc.card.id, a.modal.modId);
      reset(); if (r) a.flash('MODIFIER SWAPPED', 900); return;
    }
    if (sc.card.kind === 'tough' && sc.owner) {
      const pa = a.playerActive;
      const mods = turfModifiers(pa).filter((mod) =>
        pa.stack.some((e) => e.card.id === mod.id && e.owner === sc.card.id),
      );
      if (mods.length > 0 && a.modal.kind === 'stack') {
        a.setModal({ kind: 'swap', turf: pa, sourceToughId: sc.card.id, modId: mods[0].id });
      }
    }
  };

  const onEndTurn = () => { endTurnAction(a.world, 'A'); reset(); };
  const onDiscardPending = () => {
    discardPendingAction(a.world, 'A'); reset(); a.flash('DISCARDED', 700);
  };

  const onMarketTrade = (ids: string[], rarity: Rarity) => {
    blackMarketTradeAction(a.world, 'A', ids, rarity);
    a.flash(`TRADED ${ids.length} → ${rarity}`, 1000);
  };
  const onMarketHeal = (ids: string[]) => {
    if (!a.healTarget) return;
    blackMarketHealAction(a.world, 'A', a.healTarget.id, ids);
    a.setHealTarget(null);
    a.flash(`HEALED ${a.healTarget.name}`, 1000);
  };

  return {
    reset, onModeSelect, onLaneClick, onStackPick,
    onEndTurn, onDiscardPending, onMarketTrade, onMarketHeal,
  };
}
