// @ts-expect-error — Yuka has no TypeScript declarations
import { GoalEvaluator, Think } from 'yuka';
import type { TurfGameState } from './types';
import type { FuzzyEval } from './ai-fuzzy';
import type { AiState } from './ai-states';
import { TURF_AI_CONFIG, type TurfAiGoal } from './ai-config';
import { findDirectReady, findFundedReady, findPushReady } from './board';
import {
  chooseBestDirectAttack,
  chooseBestFundedAttack,
  chooseBestPushedAttack,
} from './ai-policy';

interface ThinkOwner {
  state: TurfGameState;
  side: 'A' | 'B';
  fuzzy: FuzzyEval;
  aiState: AiState;
  selectedGoal: TurfAiGoal | null;
}

class TurfGoalEvaluator extends GoalEvaluator {
  constructor(
    private readonly goal: TurfAiGoal,
    bias: number,
    private readonly scoreFn: (owner: ThinkOwner) => number,
  ) {
    super(bias);
  }

  override calculateDesirability(owner: ThinkOwner): number {
    return this.scoreFn(owner);
  }

  override setGoal(owner: ThinkOwner): void {
    owner.selectedGoal = this.goal;
  }
}

function buildThink(owner: ThinkOwner): Think {
  const think = new Think(owner);
  const player = owner.state.players[owner.side];
  const opponent = owner.state.players[owner.side === 'A' ? 'B' : 'A'];
  const seizedCount = player.board.active.filter(position => position.seized).length;
  const bestPush = chooseBestPushedAttack(player, opponent, owner.state.config);
  const bestFunded = chooseBestFundedAttack(player, opponent);
  const bestDirect = chooseBestDirectAttack(player, opponent, owner.state.config);
  const hasPush = findPushReady(player.board).length > 0;
  const hasFunded = findFundedReady(player.board).length > 0;
  const hasDirect = findDirectReady(player.board).length > 0;
  const emptySlots = player.board.active.filter(position => !position.crew).length;
  const normalizedPushScore = bestPush ? Math.max(0, bestPush.score / 10) : 0;
  const normalizedFundedScore = bestFunded ? Math.max(0, bestFunded.score / 10) : 0;
  const normalizedDirectScore = bestDirect ? Math.max(0, bestDirect.score / 10) : 0;

  think.addEvaluator(new TurfGoalEvaluator(
    'reclaim',
    TURF_AI_CONFIG.goalBias.reclaim,
    () => seizedCount > 0 ? (0.45 + owner.fuzzy.desperation) : 0,
  ));
  think.addEvaluator(new TurfGoalEvaluator(
    'pushed_attack',
    TURF_AI_CONFIG.goalBias.pushed_attack,
    () => hasPush
      ? normalizedPushScore + owner.fuzzy.aggression + (owner.aiState === 'AGGRESSIVE' ? 0.15 : 0)
      : 0,
  ));
  think.addEvaluator(new TurfGoalEvaluator(
    'funded_attack',
    TURF_AI_CONFIG.goalBias.funded_attack,
    () => hasFunded
      ? normalizedFundedScore + owner.fuzzy.aggression + Math.max(0, owner.fuzzy.desperation - 0.2)
      : 0,
  ));
  think.addEvaluator(new TurfGoalEvaluator(
    'direct_attack',
    TURF_AI_CONFIG.goalBias.direct_attack,
    () => hasDirect
      ? normalizedDirectScore + owner.fuzzy.aggression + (owner.aiState === 'DESPERATE' ? 0.15 : 0)
      : 0,
  ));
  think.addEvaluator(new TurfGoalEvaluator(
    'build_board',
    TURF_AI_CONFIG.goalBias.build_board,
    () => emptySlots > 0 || player.hand.modifiers.length > 0
      ? (0.25 + owner.fuzzy.patience + (owner.aiState === 'BUILDING' ? 0.2 : 0))
      : 0,
  ));

  return think;
}

export function getThinkPriorities(
  state: TurfGameState,
  side: 'A' | 'B',
  fuzzy: FuzzyEval,
  aiState: AiState,
): string[] {
  const owner: ThinkOwner = {
    state,
    side,
    fuzzy,
    aiState,
    selectedGoal: null,
  };
  const think = buildThink(owner);
  think.arbitrate();
  const selectedGoal = owner.selectedGoal ?? 'build_board';
  return [...TURF_AI_CONFIG.goalFallbacks[selectedGoal]];
}
