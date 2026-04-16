// Yuka GOAP plumbing for the v0.2 planner. Holds the generic Goal /
// CompositeGoal / GoalEvaluator subclasses plus a shared `scoreAll`.
// @ts-expect-error Yuka does not ship TypeScript declarations
import { CompositeGoal, Goal, GoalEvaluator, Think } from 'yuka';
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
  | 'anti_stall';

export interface PlannerOwner {
  brain: Think;
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
  constructor(
    private readonly goalName: GoalName,
    bias: number,
    private readonly desirabilityFn: (o: PlannerOwner) => number,
    private readonly goalFactory: (o: PlannerOwner) => CompositeGoal,
  ) {
    super(bias);
  }

  override calculateDesirability(owner: PlannerOwner): number {
    const s = this.desirabilityFn(owner);
    owner.consideredGoals.push({ goal: this.goalName, score: s });
    return s;
  }

  override setGoal(owner: PlannerOwner): void {
    const brain = owner.brain;
    const current = brain.currentSubgoal() as CompositeGoal | null;
    const next = this.goalFactory(owner) as OrderedActionGoal;
    const cur =
      current && 'goalName' in current
        ? (current as OrderedActionGoal).goalName
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
  constructor(
    owner: PlannerOwner,
    private readonly gn: GoalName,
    private readonly kinds: TurfActionKind[],
  ) {
    super(owner);
  }

  override activate(): void {
    this.status = Goal.STATUS.ACTIVE;
  }

  override execute(): void {
    const owner = this.owner as PlannerOwner;
    const candidates = owner.legalActions.filter((a) =>
      this.kinds.includes(a.kind),
    );
    if (candidates.length === 0) {
      this.status = Goal.STATUS.FAILED;
      return;
    }
    const scored = scoreAll(owner, candidates);
    const viable = scored.filter((s) => s.score > Number.NEGATIVE_INFINITY);
    if (viable.length === 0) {
      this.status = Goal.STATUS.FAILED;
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
    this.status = Goal.STATUS.COMPLETED;
  }
}

export class OrderedActionGoal extends CompositeGoal {
  constructor(
    owner: PlannerOwner,
    readonly goalName: GoalName,
    private readonly prio: Array<TurfActionKind | TurfActionKind[]>,
  ) {
    super(owner);
  }

  override activate(): void {
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
    this.status = Goal.STATUS.ACTIVE;
  }

  override execute(): void {
    this.activateIfInactive();
    let status = Goal.STATUS.ACTIVE;
    while (this.hasSubgoals() && !(this.owner as PlannerOwner).selectedAction) {
      status = this.executeSubgoals();
      if (status === Goal.STATUS.ACTIVE) break;
    }
    if ((this.owner as PlannerOwner).selectedAction)
      this.status = Goal.STATUS.COMPLETED;
    else
      this.status =
        status === Goal.STATUS.FAILED ? Goal.STATUS.FAILED : Goal.STATUS.ACTIVE;
  }

  override terminate(): void {
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
