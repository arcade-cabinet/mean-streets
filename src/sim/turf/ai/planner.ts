// @ts-expect-error Yuka does not ship TypeScript declarations
import { CompositeGoal, Goal, GoalEvaluator, Think } from 'yuka';
import { createObservation, enumerateLegalActions } from '../environment';
import type {
  PlannerMemory,
  PlannerTrace,
  TurfAction,
  TurfGameState,
  TurfObservation,
  TurfPolicyArtifact,
} from '../types';
import { scoreAction, describeActionForTrace } from './scoring';

type GoalName =
  | 'recover_flank'
  | 'finish_seizure'
  | 'funded_pressure'
  | 'lane_pressure'
  | 'economy_setup'
  | 'hold_defense'
  | 'anti_stall';

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
    private readonly goalName: GoalName,
    bias: number,
    private readonly desirabilityFn: (owner: PlannerOwner) => number,
    private readonly goalFactory: (owner: PlannerOwner) => CompositeGoal,
  ) {
    super(bias);
  }

  override calculateDesirability(owner: PlannerOwner): number {
    const score = this.desirabilityFn(owner);
    owner.consideredGoals.push({ goal: this.goalName, score });
    return score;
  }

  override setGoal(owner: PlannerOwner): void {
    const brain = owner.brain;
    const current = brain.currentSubgoal() as CompositeGoal | null;
    const nextGoal = this.goalFactory(owner) as OrderedActionGoal;
    const currentName = current && 'goalName' in current ? (current as OrderedActionGoal).goalName : null;
    if (!current || currentName !== nextGoal.goalName) {
      brain.clearSubgoals();
      brain.addSubgoal(nextGoal);
      owner.replanReason = current ? `switch:${owner.selectedGoal ?? 'none'}->${this.goalName}` : `activate:${this.goalName}`;
    } else {
      owner.replanReason = `retain:${this.goalName}`;
    }
    owner.selectedGoal = this.goalName;
  }
}

class ChooseActionGoal extends Goal {
  constructor(
    owner: PlannerOwner,
    private readonly goalName: GoalName,
    private readonly allowedKinds: TurfAction['kind'][],
  ) {
    super(owner);
  }

  override activate(): void {
    this.status = Goal.STATUS.ACTIVE;
  }

  override execute(): void {
    const owner = this.owner as PlannerOwner;
    const candidates = owner.legalActions.filter(action => this.allowedKinds.includes(action.kind));
    if (candidates.length === 0) {
      this.status = Goal.STATUS.FAILED;
      return;
    }

    const scored = candidates
      .map(action => {
        const result = scoreAction(owner.state, owner.observation, owner.memory, action, owner.policyArtifact);
        return {
          action,
          score: result.score,
          policyUsed: result.policyUsed,
        };
      })
      .sort((a, b) => b.score - a.score);

    owner.actionScores.push(...scored.slice(0, 4).map(entry => ({
      action: describeActionForTrace(entry.action),
      score: Number(entry.score.toFixed(4)),
    })));

    const best = scored[0];
    if (!best) {
      this.status = Goal.STATUS.FAILED;
      return;
    }

    owner.selectedGoal = this.goalName;
    owner.selectedAction = best.action;
    owner.policyUsed = owner.policyUsed || best.policyUsed;
    this.status = Goal.STATUS.COMPLETED;
  }
}

class OrderedActionGoal extends CompositeGoal {
  constructor(
    owner: PlannerOwner,
    readonly goalName: GoalName,
    private readonly priorities: Array<TurfAction['kind'] | TurfAction['kind'][]>,
  ) {
    super(owner);
  }

  override activate(): void {
    this.clearSubgoals();
    for (const kinds of this.priorities) {
      this.addSubgoal(new ChooseActionGoal(
        this.owner as PlannerOwner,
        this.goalName,
        Array.isArray(kinds) ? kinds : [kinds],
      ));
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
    if ((this.owner as PlannerOwner).selectedAction) {
      this.status = Goal.STATUS.COMPLETED;
    } else {
      this.status = status === Goal.STATUS.FAILED ? Goal.STATUS.FAILED : Goal.STATUS.ACTIVE;
    }
  }

  override terminate(): void {
    this.clearSubgoals();
  }
}

function buildThink(owner: PlannerOwner): Think {
  const brain = new Think(owner);
  owner.brain = brain;
  const setupNeedsModifiers = owner.observation.ownCrewCount >= 2
    && (owner.observation.handCash + owner.observation.handProducts + owner.observation.handWeapons > 0);
  const bias = {
    recover_flank: 1.15,
    finish_seizure: 1.25,
    funded_pressure: 1.24,
    lane_pressure: 1.1,
    economy_setup: 1.0,
    hold_defense: 1.05,
    anti_stall: 1.2,
  };
  const factories: Record<GoalName, () => OrderedActionGoal> = {
    recover_flank: () => new OrderedActionGoal(owner, 'recover_flank', ['reclaim', 'stack_cash', 'place_crew', 'stack_product', 'direct_attack']),
    finish_seizure: () => new OrderedActionGoal(owner, 'finish_seizure', [['pushed_attack', 'funded_attack', 'direct_attack']]),
    funded_pressure: () => new OrderedActionGoal(
      owner,
      'funded_pressure',
      owner.observation.ownReadyPushed === 0 && owner.observation.handProducts > 0
        ? [['stack_product', 'funded_attack', 'direct_attack'], 'arm_weapon', 'stack_cash', 'reclaim']
        : [['funded_attack', 'direct_attack'], 'arm_weapon', 'stack_cash', 'reclaim'],
    ),
    lane_pressure: () => new OrderedActionGoal(owner, 'lane_pressure', [['pushed_attack', 'funded_attack', 'direct_attack'], 'arm_weapon', 'stack_product', 'stack_cash']),
    economy_setup: () => new OrderedActionGoal(
      owner,
      'economy_setup',
      setupNeedsModifiers
        ? owner.observation.ownReadyFunded > 0
          && owner.observation.ownReadyPushed === 0
          && owner.observation.handProducts > 0
          ? ['stack_product', 'stack_cash', 'arm_weapon', 'place_crew']
          : ['stack_cash', 'stack_product', 'arm_weapon', 'place_crew']
        : ['place_crew', 'stack_cash', 'stack_product', 'arm_weapon'],
    ),
    hold_defense: () => new OrderedActionGoal(owner, 'hold_defense', ['stack_product', 'arm_weapon', 'stack_cash', 'reclaim', 'direct_attack']),
    anti_stall: () => new OrderedActionGoal(owner, 'anti_stall', ['place_crew', 'stack_cash', 'stack_product', 'direct_attack', 'pass']),
  };

  brain.addEvaluator(new TurfGoalEvaluator(
    'recover_flank',
    bias.recover_flank,
    currentOwner => currentOwner.observation.ownSeized > 0 ? 0.8 + currentOwner.observation.ownSeized + currentOwner.memory.consecutivePasses * 0.2 : 0,
    () => factories.recover_flank(),
  ));
  brain.addEvaluator(new TurfGoalEvaluator(
    'finish_seizure',
    bias.finish_seizure,
    currentOwner => currentOwner.observation.opponentSeized >= currentOwner.state.config.positionCount - 1
      || currentOwner.observation.ownReadyPushed > 0
      ? 0.9 + currentOwner.observation.ownReadyPushed + currentOwner.observation.ownReadyFunded * 0.5
      : 0.2,
    () => factories.finish_seizure(),
  ));
  brain.addEvaluator(new TurfGoalEvaluator(
    'funded_pressure',
    bias.funded_pressure,
    currentOwner => currentOwner.observation.ownReadyFunded > 0 && currentOwner.observation.ownReadyPushed === 0
      ? 1.1
        + currentOwner.observation.ownReadyFunded * 1.1
        + currentOwner.observation.handWeapons * 0.2
        + (currentOwner.memory.focusRole === 'funded' ? 0.45 : 0)
      : 0.05,
    () => factories.funded_pressure(),
  ));
  brain.addEvaluator(new TurfGoalEvaluator(
    'lane_pressure',
    bias.lane_pressure,
    currentOwner => currentOwner.state.phase === 'buildup'
      ? 0.15 + currentOwner.observation.ownReadyFunded * 0.8 + currentOwner.observation.ownReadyDirect * 0.3
      : 0.35
        + currentOwner.observation.ownReadyDirect * 0.5
        + currentOwner.observation.handCash * 0.1
        + (currentOwner.observation.ownReadyPushed > 0 ? currentOwner.observation.ownReadyFunded * 0.5 : 0),
    () => factories.lane_pressure(),
  ));
  brain.addEvaluator(new TurfGoalEvaluator(
    'economy_setup',
    bias.economy_setup,
    currentOwner => currentOwner.state.phase === 'buildup'
      ? 0.8
        + currentOwner.observation.handCrew * 0.15
        + currentOwner.observation.handCash * 0.18
        + currentOwner.observation.handProducts * 0.22
        + currentOwner.observation.handWeapons * 0.2
        + (currentOwner.observation.ownCrewCount >= 2 ? 0.45 : 0)
        + (currentOwner.state.buildupTurns[currentOwner.side] <= 4 ? 0.35 : 0)
      : 0.2 + currentOwner.observation.handCrew * 0.1,
    () => factories.economy_setup(),
  ));
  brain.addEvaluator(new TurfGoalEvaluator(
    'hold_defense',
    bias.hold_defense,
    currentOwner => currentOwner.observation.opponentPower > currentOwner.observation.ownDefense
      ? Math.max(
        0.1,
        0.6
          + (currentOwner.observation.opponentPower - currentOwner.observation.ownDefense) / 5
          - (
            currentOwner.memory.focusRole === 'funded'
            && currentOwner.observation.ownReadyFunded > 0
            && currentOwner.observation.ownReadyPushed === 0
              ? 0.45
              : 0
          ),
      )
      : 0.1,
    () => factories.hold_defense(),
  ));
  brain.addEvaluator(new TurfGoalEvaluator(
    'anti_stall',
    bias.anti_stall,
    currentOwner => currentOwner.memory.consecutivePasses >= 1 || Object.keys(currentOwner.memory.blockedLanes).length >= 2
      ? 1 + currentOwner.memory.consecutivePasses * 0.4
      : 0.15,
    () => factories.anti_stall(),
  ));

  return brain;
}

export function decideAction(
  state: TurfGameState,
  side: 'A' | 'B',
  policyArtifact?: TurfPolicyArtifact,
): { action: TurfAction; trace: PlannerTrace } {
  const observation = createObservation(state, side);
  const legalActions = enumerateLegalActions(state, side);
  const memory = state.aiMemory[side];
  const owner: PlannerOwner = {
    brain: null as unknown as Think,
    state,
    side,
    observation,
    memory,
    policyArtifact,
    legalActions,
    selectedGoal: null,
    selectedAction: null,
    policyUsed: false,
    consideredGoals: [],
    actionScores: [],
    replanReason: 'initial',
  };

  const brain = buildThink(owner);
  owner.brain = brain;
  brain.execute();

  if (!owner.selectedAction) {
    const fallbackCandidates = legalActions
      .filter(action => action.kind !== 'pass')
      .map(action => {
        const scored = scoreAction(state, observation, memory, action, policyArtifact);
        return { action, score: scored.score, policyUsed: scored.policyUsed };
      })
      .sort((a, b) => b.score - a.score);

    if (fallbackCandidates.length > 0) {
      const best = fallbackCandidates[0];
      owner.selectedAction = best.action;
      owner.selectedGoal = owner.selectedGoal ?? 'anti_stall';
      owner.policyUsed = owner.policyUsed || best.policyUsed;
      if (owner.actionScores.length === 0) {
        owner.actionScores.push(...fallbackCandidates.slice(0, 4).map(entry => ({
          action: describeActionForTrace(entry.action),
          score: Number(entry.score.toFixed(4)),
        })));
      }
      owner.replanReason = owner.replanReason === 'initial'
        ? 'global-fallback'
        : `${owner.replanReason}|global-fallback`;
    }
  }

  const action = owner.selectedAction ?? { kind: 'pass', side };
  const switchedGoal = memory.lastGoal !== owner.selectedGoal;
  const trace: PlannerTrace = {
    side,
    phase: state.phase,
    chosenGoal: owner.selectedGoal ?? 'anti_stall',
    previousGoal: memory.lastGoal,
    switchedGoal,
    stateKey: observation.stateKey,
    legalActionCount: legalActions.length,
    chosenAction: action,
    consideredGoals: owner.consideredGoals.sort((a, b) => b.score - a.score),
    actionScores: owner.actionScores.slice(0, 6),
    policyUsed: owner.policyUsed,
    replanReason: owner.replanReason,
  };

  memory.lastGoal = trace.chosenGoal;
  return { action, trace };
}
