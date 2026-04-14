/**
 * AttackSelector — click-to-target state machine for combat attacks.
 * Flow: IDLE → SELECT_ATTACKER → SELECT_TARGET → resolve → complete.
 */

import { useState, useEffect, useCallback } from 'react';
import type { World } from 'koota';
import type { Position, AttackOutcome } from '../../sim/turf/types';
import {
  findDirectReady,
  findFundedReady,
  findPushReady,
  positionPower,
  positionDefense,
} from '../../sim/turf/board';
import { canPrecisionAttack } from '../../sim/turf/attacks';
import {
  directAttackAction,
  fundedAttackAction,
  pushedAttackAction,
} from '../../ecs/actions';
import { BoardLayout } from '../board';
import { CardFrame } from '../cards';

type Step = 'SELECT_ATTACKER' | 'SELECT_TARGET';

interface AttackSelectorProps {
  world: World;
  attackType: 'direct' | 'funded' | 'pushed';
  playerPositions: Position[];
  opponentPositions: Position[];
  onComplete: (outcome: AttackOutcome | null) => void;
  onCancel: () => void;
}

const PRECISION_MULT = 3.0;

function getValidAttackers(type: AttackSelectorProps['attackType'], positions: Position[]): number[] {
  const board = { active: positions, reserve: [] };
  if (type === 'direct') return findDirectReady(board);
  if (type === 'funded') return findFundedReady(board);
  return findPushReady(board);
}

function getValidTargets(
  type: AttackSelectorProps['attackType'],
  attackerPos: Position,
  opponentPositions: Position[],
): number[] {
  return opponentPositions.reduce<number[]>((acc, pos, i) => {
    if (!pos.crew || pos.seized) return acc;
    if (type === 'direct') {
      const atkPow = positionPower(attackerPos);
      const defPow = positionDefense(pos);
      if (!canPrecisionAttack(atkPow, defPow, PRECISION_MULT, false)) return acc;
    }
    acc.push(i);
    return acc;
  }, []);
}

export function AttackSelector({
  world,
  attackType,
  playerPositions,
  opponentPositions,
  onComplete,
  onCancel,
}: AttackSelectorProps) {
  const [step, setStep] = useState<Step>('SELECT_ATTACKER');
  const [attackerIdx, setAttackerIdx] = useState<number | null>(null);

  const validAttackers = getValidAttackers(attackType, playerPositions);
  const validTargets = attackerIdx !== null
    ? getValidTargets(attackType, playerPositions[attackerIdx], opponentPositions)
    : [];

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCancel]);

  function handlePositionClick(side: 'A' | 'B', index: number) {
    if (step === 'SELECT_ATTACKER' && side === 'A') {
      if (!validAttackers.includes(index)) return;
      setAttackerIdx(index);
      setStep('SELECT_TARGET');
    } else if (step === 'SELECT_TARGET' && side === 'B') {
      if (attackerIdx === null || !validTargets.includes(index)) return;
      let outcome: AttackOutcome | null = null;
      if (attackType === 'direct') outcome = directAttackAction(world, attackerIdx, index);
      else if (attackType === 'funded') outcome = fundedAttackAction(world, attackerIdx, index);
      else outcome = pushedAttackAction(world, attackerIdx, index);
      onComplete(outcome);
    } else if (side === 'A' && step === 'SELECT_TARGET') {
      // Clicked own side during target selection — reset attacker
      setAttackerIdx(null);
      setStep('SELECT_ATTACKER');
    }
  }

  const prompt = step === 'SELECT_ATTACKER' ? 'Select attacker (green = ready)' : 'Select target (red = valid)';
  const typeLabel = attackType.toUpperCase();

  // Build highlight sets for display cues via className injection — handled via onPositionClick wiring
  // The BoardLayout passes onPositionClick, PositionSlot adds cursor-pointer when onClick is set.

  return (
    <div className="attack-selector">
      <div className="attack-selector-header">
        <span className="attack-selector-title">{typeLabel} ATTACK — {prompt}</span>
        <button
          onClick={handleCancel}
          className="attack-selector-cancel"
        >
          <CardFrame variant="button" className="card-frame-svg card-frame-svg-attack-cancel" />
          <span className="attack-selector-cancel-label">Cancel [Esc]</span>
        </button>
      </div>

      <div className="attack-selector-track attack-selector-track-top">
        {opponentPositions.map((_, i) => (
          <div
            key={i}
            className={`attack-selector-marker ${step === 'SELECT_TARGET' && validTargets.includes(i) ? 'attack-selector-marker-target' : ''}`}
          />
        ))}
      </div>

      <BoardLayout
        playerPositions={playerPositions}
        opponentPositions={opponentPositions}
        phase="combat"
        roundNumber={0}
        onPositionClick={handlePositionClick}
      />

      <div className="attack-selector-track attack-selector-track-bottom">
        {playerPositions.map((_, i) => (
          <div
            key={i}
            className={`attack-selector-marker ${
              step === 'SELECT_ATTACKER' && validAttackers.includes(i)
                ? 'attack-selector-marker-attacker'
                : step === 'SELECT_TARGET' && attackerIdx === i
                  ? 'attack-selector-marker-selected'
                  : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
}
