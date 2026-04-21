// GOAP plumbing — Goal / CompositeGoal / GoalEvaluator subclasses,
// shared `scoreAll`, and evaluator desirability + factory helpers.
//
// Yuka ships JSDoc types that treat `owner` as a strict `GameEntity`
// with ~40 fields we don't use. The imports are re-typed via local
// *Like interfaces so we can extend them with `PlannerOwner`.
// @ts-expect-error Yuka does not ship TypeScript declarations
import { CompositeGoal as RawCompositeGoal, Goal as RawGoal, GoalEvaluator as RawGoalEvaluator } from 'yuka';

type GoalStatusKey = 'INACTIVE' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
interface GoalLike {
  owner: unknown;
  status: number;
  activate(): void;
  execute(): void;
  terminate(): void;
}
interface CompositeGoalLike extends GoalLike {
  addSubgoal(g: GoalLike): this;
  clearSubgoals(): this;
  currentSubgoal(): GoalLike | null;
  executeSubgoals(): number;
  hasSubgoals(): boolean;
  activateIfInactive(): this;
}
interface GoalEvaluatorLike {
  characterBias: number;
  calculateDesirability(owner: unknown): number;
  setGoal(owner: unknown): void;
}

const CompositeGoal = RawCompositeGoal as unknown as new (
  owner?: unknown,
) => CompositeGoalLike;
const Goal = RawGoal as unknown as (new (owner?: unknown) => GoalLike) & {
  STATUS: Record<GoalStatusKey, number>;
};
const GoalEvaluator = RawGoalEvaluator as unknown as new (
  bias?: number,
) => GoalEvaluatorLike;

const STATUS = Goal.STATUS;

import type {
  PlannerMemory,
  TurfAction,
  TurfActionKind,
  TurfGameState,
  TurfObservation,
  TurfPolicyArtifact,
} from '../types';
import { TURF_SIM_CONFIG } from './config';
import { type ScoredAction, selectAction } from './policy';
import { describeActionForTrace, scoreAction } from './scoring';

export type GoalName =
  | 'build_stack'
  | 'direct_pressure'
  | 'funded_pressure'
  | 'pushed_pressure'
  | 'draw_tempo'
  | 'retreat_shield'
  | 'anti_stall'
  | 'heat_management'
  | 'mythic_hunt'
  | 'stack_rebuild';

export interface PlannerOwner {
  brain: CompositeGoalLike;
  state: TurfGameState;
  side: 'A' | 'B';
  observation: TurfObservation;
  memory: PlannerMemory;
  policyArtifact?: TurfPolicyArtifact;
  legalActions: TurfAction[];
  selectedGoal: GoalName | null;
  selectedAction: TurfAction | null;
  policyUsed: boolean;
  consideredGoals: Array<{ goal: GoalName; score: number }>;
  actionScores: Array<{ action: string; score: number }>;
  replanReason: string;
}

export class TurfGoalEvaluator extends GoalEvaluator {
  goalName: GoalName;
  desirabilityFn: (o: PlannerOwner) => number;
  goalFactory: (o: PlannerOwner) => CompositeGoalLike;

  constructor(
    goalName: GoalName,
    bias: number,
    desirabilityFn: (o: PlannerOwner) => number,
    goalFactory: (o: PlannerOwner) => CompositeGoalLike,
  ) {
    super(bias);
    this.goalName = goalName;
    this.desirabilityFn = desirabilityFn;
    this.goalFactory = goalFactory;
  }

  calculateDesirability(owner: PlannerOwner): number {
    const s = this.desirabilityFn(owner) * this.characterBias;
    owner.consideredGoals.push({ goal: this.goalName, score: s });
    return s;
  }

  setGoal(owner: PlannerOwner): void {
    const brain = owner.brain;
    const current = brain.currentSubgoal();
    const next = this.goalFactory(owner) as OrderedActionGoal;
    const cur =
      current && 'goalName' in current
        ? (current as unknown as OrderedActionGoal).goalName
        : null;
    if (!current || cur !== next.goalName) {
      brain.clearSubgoals();
      brain.addSubgoal(next);
      owner.replanReason = current
        ? `switch:${owner.selectedGoal ?? 'none'}->${this.goalName}`
        : `activate:${this.goalName}`;
    } else {
      owner.replanReason = `retain:${this.goalName}`;
    }
    owner.selectedGoal = this.goalName;
  }
}

export function scoreAll(
  owner: PlannerOwner,
  candidates: TurfAction[],
): ScoredAction[] {
  const scored: ScoredAction[] = candidates
    .map((a) => {
      const r = scoreAction(
        owner.state,
        owner.observation,
        owner.memory,
        a,
        owner.policyArtifact,
      );
      return { action: a, score: r.score, policyUsed: r.policyUsed };
    })
    .sort((a, b) => b.score - a.score);
  owner.actionScores.push(
    ...scored.slice(0, TURF_SIM_CONFIG.aiPlanner.traceTopActions).map((e) => ({
      action: describeActionForTrace(e.action),
      score: Number(e.score.toFixed(4)),
    })),
  );
  return scored;
}

export class ChooseActionGoal extends Goal {
  gn: GoalName;
  kinds: TurfActionKind[];

  constructor(owner: PlannerOwner, gn: GoalName, kinds: TurfActionKind[]) {
    super(owner);
    this.gn = gn;
    this.kinds = kinds;
  }

  activate(): void {
    this.status = STATUS.ACTIVE;
  }

  execute(): void {
    const owner = this.owner as PlannerOwner;
    const candidates = owner.legalActions.filter((a) =>
      this.kinds.includes(a.kind),
    );
    if (candidates.length === 0) {
      this.status = STATUS.FAILED;
      return;
    }
    const scored = scoreAll(owner, candidates);
    const viable = scored.filter((s) => s.score > Number.NEGATIVE_INFINITY);
    if (viable.length === 0) {
      this.status = STATUS.FAILED;
      return;
    }
    const best = selectAction(
      viable,
      owner.state.config.difficulty,
      owner.state.rng,
    );
    owner.selectedGoal = this.gn;
    owner.selectedAction = best.action;
    owner.policyUsed = owner.policyUsed || best.policyUsed;
    this.status = STATUS.COMPLETED;
  }
}

export class OrderedActionGoal extends CompositeGoal {
  goalName: GoalName;
  prio: Array<TurfActionKind | TurfActionKind[]>;

  constructor(
    owner: PlannerOwner,
    goalName: GoalName,
    prio: Array<TurfActionKind | TurfActionKind[]>,
  ) {
    super(owner);
    this.goalName = goalName;
    this.prio = prio;
  }

  activate(): void {
    this.clearSubgoals();
    for (const k of this.prio) {
      this.addSubgoal(
        new ChooseActionGoal(
          this.owner as PlannerOwner,
          this.goalName,
          Array.isArray(k) ? k : [k],
        ),
      );
    }
    this.status = STATUS.ACTIVE;
  }

  execute(): void {
    this.activateIfInactive();
    let status = STATUS.ACTIVE;
    while (this.hasSubgoals() && !(this.owner as PlannerOwner).selectedAction) {
      status = this.executeSubgoals();
      if (status === STATUS.ACTIVE) break;
    }
    if ((this.owner as PlannerOwner).selectedAction) {
      this.status = STATUS.COMPLETED;
    } else {
      this.status = status === STATUS.FAILED ? STATUS.FAILED : STATUS.ACTIVE;
    }
  }

  terminate(): void {
    this.clearSubgoals();
  }
}

export function goal(
  owner: PlannerOwner,
  name: GoalName,
  prio: Array<TurfActionKind | TurfActionKind[]>,
): OrderedActionGoal {
  return new OrderedActionGoal(owner, name, prio);
}

// ─── Evaluator desirability + factory helpers ─────────────────────────────────

function activeToughCount(state: TurfGameState, side: 'A' | 'B'): number {
  const active = state.players[side].turfs[0];
  if (!active) return 0;
  let n = 0;
  for (const sc of active.stack) if (sc.card.kind === 'tough') n++;
  return n;
}

function opponentMythicOnActive(
  state: TurfGameState,
  side: 'A' | 'B',
): boolean {
  const oppSide = side === 'A' ? 'B' : 'A';
  const oppActive = state.players[oppSide].turfs[0];
  if (!oppActive) return false;
  for (const sc of oppActive.stack) {
    if (sc.card.kind === 'tough' && sc.card.rarity === 'mythic') {
      const assigned = state.mythicAssignments[sc.card.id];
      if (!assigned || assigned === oppSide) return true;
    }
  }
  return false;
}

// heat_management — fires when shared heat > 0.4.
export function desireHeatMgmt(owner: PlannerOwner): number {
  const h = owner.state.heat;
  if (h <= 0.4) return 0;
  return Math.min(1.2, (h - 0.4) * 2.0);
}

export function buildHeatMgmt(owner: PlannerOwner) {
  return goal(owner, 'heat_management', [
    'send_to_holding',
    'play_card',
    'send_to_market',
    'draw',
    'end_turn',
  ]);
}

// mythic_hunt — fires when opponent's active turf hosts a mythic tough.
export function desireMythicHunt(owner: PlannerOwner): number {
  if (!opponentMythicOnActive(owner.state, owner.side)) return 0;
  return 1.0;
}

export function buildMythicHunt(owner: PlannerOwner) {
  return goal(owner, 'mythic_hunt', [
    ['direct_strike', 'pushed_strike', 'funded_recruit'],
    'play_card',
    'draw',
    'end_turn',
  ]);
}

// stack_rebuild — fires when the active turf's tough count is <= 1.
export function desireStackRebuild(owner: PlannerOwner): number {
  const n = activeToughCount(owner.state, owner.side);
  if (n > 1) return 0;
  return n === 0 ? 1.4 : 0.9;
}

export function buildStackRebuild(owner: PlannerOwner) {
  return goal(owner, 'stack_rebuild', [
    'play_card',
    'draw',
    'discard',
    'end_turn',
  ]);
}
