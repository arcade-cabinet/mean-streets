// @ts-expect-error Yuka does not ship TypeScript declarations
import { CompositeGoal, Goal, GoalEvaluator, Think } from 'yuka';
import { createObservation, enumerateLegalActions } from '../environment';
import type {
  PlannerMemory, PlannerTrace, TurfAction, TurfActionKind,
  TurfGameState, TurfObservation, TurfPolicyArtifact,
} from '../types';
import { selectAction, type ScoredAction } from './policy';
import { scoreAction, describeActionForTrace } from './scoring';
import { TURF_SIM_CONFIG } from './config';

type GoalName = 'build_stack' | 'direct_pressure' | 'funded_pressure' | 'pushed_pressure' | 'anti_stall';

interface PlannerOwner {
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

class TurfGoalEvaluator extends GoalEvaluator {
  constructor(
    private readonly goalName: GoalName, bias: number,
    private readonly desirabilityFn: (owner: PlannerOwner) => number,
    private readonly goalFactory: (owner: PlannerOwner) => CompositeGoal,
  ) { super(bias); }

  override calculateDesirability(owner: PlannerOwner): number {
    const score = this.desirabilityFn(owner);
    owner.consideredGoals.push({ goal: this.goalName, score });
    return score;
  }

  override setGoal(owner: PlannerOwner): void {
    const brain = owner.brain;
    const current = brain.currentSubgoal() as CompositeGoal | null;
    const next = this.goalFactory(owner) as OrderedActionGoal;
    const curName = current && 'goalName' in current ? (current as OrderedActionGoal).goalName : null;
    if (!current || curName !== next.goalName) {
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

function scoreAll(owner: PlannerOwner, candidates: TurfAction[]): ScoredAction[] {
  const scored: ScoredAction[] = candidates
    .map((action: TurfAction) => {
      const r = scoreAction(owner.state, owner.observation, owner.memory, action, owner.policyArtifact);
      return { action, score: r.score, policyUsed: r.policyUsed };
    })
    .sort((a, b) => b.score - a.score);
  owner.actionScores.push(
    ...scored.slice(0, TURF_SIM_CONFIG.aiPlanner.traceTopActions).map((e) => ({
      action: describeActionForTrace(e.action), score: Number(e.score.toFixed(4)),
    })),
  );
  return scored;
}

class ChooseActionGoal extends Goal {
  constructor(owner: PlannerOwner, private readonly gn: GoalName, private readonly kinds: TurfActionKind[]) {
    super(owner);
  }

  override activate(): void { this.status = Goal.STATUS.ACTIVE; }

  override execute(): void {
    const owner = this.owner as PlannerOwner;
    const candidates = owner.legalActions.filter((a: TurfAction) => this.kinds.includes(a.kind));
    if (candidates.length === 0) { this.status = Goal.STATUS.FAILED; return; }
    const scored = scoreAll(owner, candidates);
    const viable = scored.filter((s) => s.score > Number.NEGATIVE_INFINITY);
    if (viable.length === 0) { this.status = Goal.STATUS.FAILED; return; }
    const best = selectAction(viable, owner.state.config.difficulty, owner.state.rng);
    owner.selectedGoal = this.gn;
    owner.selectedAction = best.action;
    owner.policyUsed = owner.policyUsed || best.policyUsed;
    this.status = Goal.STATUS.COMPLETED;
  }
}

class OrderedActionGoal extends CompositeGoal {
  constructor(owner: PlannerOwner, readonly goalName: GoalName, private readonly prio: Array<TurfActionKind | TurfActionKind[]>) {
    super(owner);
  }

  override activate(): void {
    this.clearSubgoals();
    for (const k of this.prio) {
      this.addSubgoal(new ChooseActionGoal(this.owner as PlannerOwner, this.goalName, Array.isArray(k) ? k : [k]));
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
    if ((this.owner as PlannerOwner).selectedAction) this.status = Goal.STATUS.COMPLETED;
    else this.status = status === Goal.STATUS.FAILED ? Goal.STATUS.FAILED : Goal.STATUS.ACTIVE;
  }

  override terminate(): void { this.clearSubgoals(); }
}

function goal(owner: PlannerOwner, name: GoalName, prio: Array<TurfActionKind | TurfActionKind[]>) {
  return new OrderedActionGoal(owner, name, prio);
}

function buildThink(owner: PlannerOwner): Think {
  const brain = new Think(owner);
  owner.brain = brain;
  const obs = owner.observation;

  const pl = TURF_SIM_CONFIG.aiPlanner;

  brain.addEvaluator(new TurfGoalEvaluator('build_stack', pl.buildStack.bias, () => {
    const hand = obs.handToughs + obs.handWeapons + obs.handDrugs + obs.handCurrency;
    if (hand === 0) return pl.buildStack.emptyHandFloor;
    return pl.buildStack.base + obs.handToughs * pl.buildStack.perToughWeight + (obs.ownToughsInPlay === 0 ? pl.buildStack.noToughsDesperation : 0);
  }, () => goal(owner, 'build_stack', ['play_card', 'discard', 'end_turn'])));

  brain.addEvaluator(new TurfGoalEvaluator('direct_pressure', pl.directPressure.bias, () => {
    if (obs.ownToughsInPlay === 0 || obs.opponentToughsInPlay === 0) return 0;
    const margin = obs.ownPower - obs.opponentDefense;
    return pl.directPressure.base + Math.max(0, margin) * pl.directPressure.marginScale + (obs.opponentTurfCount <= 1 ? pl.directPressure.lastTurfBonus : 0);
  }, () => goal(owner, 'direct_pressure', [
    ['direct_strike', 'pushed_strike', 'funded_recruit'], 'play_card', 'end_turn',
  ])));

  brain.addEvaluator(new TurfGoalEvaluator('funded_pressure', pl.fundedPressure.bias, () => {
    if (obs.ownToughsInPlay === 0 || obs.opponentToughsInPlay === 0) return 0;
    return obs.handCurrency > 0 ? pl.fundedPressure.baseWithCurrency + obs.handCurrency * pl.fundedPressure.perCurrencyWeight : pl.fundedPressure.floor;
  }, () => goal(owner, 'funded_pressure', [['funded_recruit', 'direct_strike'], 'play_card', 'end_turn'])));

  brain.addEvaluator(new TurfGoalEvaluator('pushed_pressure', pl.pushedPressure.bias, () => {
    if (obs.ownToughsInPlay === 0 || obs.opponentToughsInPlay === 0) return 0;
    return pl.pushedPressure.base;
  }, () => goal(owner, 'pushed_pressure', [['pushed_strike', 'direct_strike'], 'play_card', 'end_turn'])));

  brain.addEvaluator(new TurfGoalEvaluator('anti_stall', pl.antiStall.bias, (o) => {
    if (o.memory.consecutivePasses >= pl.antiStall.consecutivePassThreshold) return pl.antiStall.base + o.memory.consecutivePasses * pl.antiStall.perPassEscalation;
    return pl.antiStall.idleFloor;
  }, () => goal(owner, 'anti_stall', ['play_card', 'direct_strike', 'discard', 'pass'])));

  return brain;
}

export function decideAction(
  state: TurfGameState, side: 'A' | 'B', policyArtifact?: TurfPolicyArtifact,
): { action: TurfAction; trace: PlannerTrace } {
  const observation = createObservation(state, side);
  const legalActions = enumerateLegalActions(state, side);
  const memory = state.aiMemory[side];
  const owner: PlannerOwner = {
    brain: null as unknown as Think, state, side, observation, memory, policyArtifact,
    legalActions, selectedGoal: null, selectedAction: null, policyUsed: false,
    consideredGoals: [], actionScores: [], replanReason: 'initial',
  };

  const brain = buildThink(owner);
  owner.brain = brain;
  brain.execute();

  if (!owner.selectedAction) {
    const candidates = legalActions.filter((a) => a.kind !== 'pass' && a.kind !== 'end_turn');
    const scored = scoreAll(owner, candidates);
    const viable = scored.filter((s) => s.score > Number.NEGATIVE_INFINITY);
    if (viable.length > 0) {
      const best = selectAction(viable, state.config.difficulty, state.rng);
      owner.selectedAction = best.action;
      owner.selectedGoal = owner.selectedGoal ?? 'anti_stall';
      owner.policyUsed = owner.policyUsed || best.policyUsed;
      owner.replanReason = owner.replanReason === 'initial'
        ? 'global-fallback' : `${owner.replanReason}|global-fallback`;
    }
  }

  const action = owner.selectedAction ?? { kind: 'end_turn' as const, side };
  const trace: PlannerTrace = {
    side, phase: state.phase,
    chosenGoal: owner.selectedGoal ?? 'anti_stall',
    previousGoal: memory.lastGoal,
    switchedGoal: memory.lastGoal !== owner.selectedGoal,
    stateKey: observation.stateKey,
    legalActionCount: legalActions.length,
    chosenAction: action,
    consideredGoals: owner.consideredGoals.sort((a, b) => b.score - a.score),
    actionScores: owner.actionScores.slice(0, TURF_SIM_CONFIG.aiPlanner.traceMaxActions),
    policyUsed: owner.policyUsed,
    replanReason: owner.replanReason,
  };

  memory.lastGoal = trace.chosenGoal;
  return { action, trace };
}
