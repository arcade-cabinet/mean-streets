/**
 * AI decision-making brain using Yuka.js Goal-Driven Agent Design.
 *
 * Each turn, evaluators score possible strategies based on game state.
 * The highest-scoring evaluator's goal is executed to produce a decision.
 *
 * Evaluators:
 * - LethalAttack: exact-kill or near-kill opportunities
 * - PressureAttack: chip damage when safe to do so
 * - ComboAttack: runs/sets for multiplied effect
 * - SacrificeHeal: heal vanguard when low
 * - Hustle: draw when hand is thin and vanguard can afford HP
 * - DieRoll: gamble when precision-locked
 * - Pass: last resort
 */

// @ts-expect-error — Yuka has no TypeScript declarations
import { GoalEvaluator, Think } from 'yuka';
import type { AiDecision } from './types';
import type { GameState } from '../engine/game';
import { getEffectiveAtk, canPrecisionAttack } from '../engine/deck';
import type { PlayerState } from '../engine/combat';

/** Context object passed to evaluators instead of a GameEntity. */
interface AiContext {
  state: GameState;
  side: 'A' | 'B';
  player: PlayerState;
  opponent: PlayerState;
  decision: AiDecision | null;
}

/** Find all valid single-card attacks. */
function findValidAttacks(ctx: AiContext): Array<{
  idx: number; atk: number; isLethal: boolean;
}> {
  const { player, opponent, state } = ctx;
  if (!opponent.vanguard) return [];

  const results: Array<{ idx: number; atk: number; isLethal: boolean }> = [];
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    const atk = getEffectiveAtk(
      card, state.isNight, player.passiveType, player.passiveValue,
    );
    if (canPrecisionAttack(atk, opponent.vanguard.hp, state.config.precisionMult)) {
      results.push({ idx: i, atk, isLethal: atk >= opponent.vanguard.hp });
    }
  }
  return results;
}

/** Find ascending runs in hand (same gang, ascending ATK). */
function findRuns(ctx: AiContext): Array<Array<{ idx: number; atk: number }>> {
  const { player, state } = ctx;
  if (player.hand.length < 2) return [];

  const indexed = player.hand.map((c, i) => ({
    idx: i,
    atk: getEffectiveAtk(c, state.isNight, player.passiveType, player.passiveValue),
  }));
  indexed.sort((a, b) => a.atk - b.atk);

  const runs: Array<Array<{ idx: number; atk: number }>> = [];
  let current = [indexed[0]];

  for (let i = 1; i < indexed.length; i++) {
    if (indexed[i].atk === current[current.length - 1].atk + 1) {
      current.push(indexed[i]);
    } else {
      if (current.length >= 2) runs.push([...current]);
      current = [indexed[i]];
    }
  }
  if (current.length >= 2) runs.push([...current]);
  return runs;
}

/** Find sets (same ATK value, different cards). */
function findSets(ctx: AiContext): Array<Array<{ idx: number; atk: number }>> {
  const { player, state } = ctx;
  if (player.hand.length < 2) return [];

  const byAtk: Record<number, Array<{ idx: number; atk: number }>> = {};
  for (let i = 0; i < player.hand.length; i++) {
    const atk = getEffectiveAtk(
      player.hand[i], state.isNight, player.passiveType, player.passiveValue,
    );
    if (!byAtk[atk]) byAtk[atk] = [];
    byAtk[atk].push({ idx: i, atk });
  }
  return Object.values(byAtk).filter(g => g.length >= 2);
}

// ── Evaluators ───────────────────────────────────────────────

class LethalEvaluator extends GoalEvaluator {
  calculateDesirability(owner: AiContext): number {
    const attacks = findValidAttacks(owner);
    const lethals = attacks.filter(a => a.isLethal);
    if (lethals.length === 0) return 0;
    return 0.95; // highest priority — kill when possible
  }

  setGoal(owner: AiContext): void {
    const attacks = findValidAttacks(owner);
    const lethals = attacks.filter(a => a.isLethal);
    lethals.sort((a, b) => a.atk - b.atk); // prefer lowest ATK lethal
    owner.decision = {
      action: 'attack',
      cardIndices: [lethals[0].idx],
      reason: `lethal attack with ATK ${lethals[0].atk}`,
    };
  }
}

class PressureEvaluator extends GoalEvaluator {
  calculateDesirability(owner: AiContext): number {
    const attacks = findValidAttacks(owner);
    if (attacks.length === 0) return 0;
    // More desirable when opponent vanguard is high HP (chip it down)
    const oppHp = owner.opponent.vanguard?.hp ?? 0;
    return Math.min(0.7, 0.3 + (oppHp / 15) * 0.4);
  }

  setGoal(owner: AiContext): void {
    const attacks = findValidAttacks(owner);
    attacks.sort((a, b) => b.atk - a.atk); // prefer highest damage
    owner.decision = {
      action: 'attack',
      cardIndices: [attacks[0].idx],
      reason: `pressure attack with ATK ${attacks[0].atk}`,
    };
  }
}

class ComboEvaluator extends GoalEvaluator {
  calculateDesirability(owner: AiContext): number {
    if (!owner.state.config.runsEnabled && !owner.state.config.setsEnabled) return 0;
    if (!owner.opponent.vanguard) return 0;

    const runs = owner.state.config.runsEnabled ? findRuns(owner) : [];
    const sets = owner.state.config.setsEnabled ? findSets(owner) : [];

    const bestRun = runs.reduce((best, r) => r.length > best ? r.length : best, 0);
    const bestSet = sets.reduce((best, s) => s.length > best ? s.length : best, 0);

    if (bestRun >= 3) return 0.85;
    if (bestSet >= 3) return 0.8;
    if (bestRun >= 2 || bestSet >= 2) return 0.5;
    return 0;
  }

  setGoal(owner: AiContext): void {
    const runs = owner.state.config.runsEnabled ? findRuns(owner) : [];
    const sets = owner.state.config.setsEnabled ? findSets(owner) : [];

    // Prefer longest run, then longest set
    let best: Array<{ idx: number; atk: number }> = [];
    for (const r of runs) { if (r.length > best.length) best = r; }
    for (const s of sets) { if (s.length > best.length) best = s; }

    if (best.length >= 2) {
      // Verify precision for each card individually
      const oppHp = owner.opponent.vanguard?.hp ?? 0;
      const valid = best.every(c =>
        canPrecisionAttack(c.atk, oppHp, owner.state.config.precisionMult),
      );
      if (valid) {
        owner.decision = {
          action: 'attack',
          cardIndices: best.map(c => c.idx),
          reason: `combo attack (${best.length} cards)`,
        };
        return;
      }
    }
    // Fallback — shouldn't reach here but safety
    owner.decision = { action: 'pass', cardIndices: [], reason: 'combo fallback' };
  }
}

class SacrificeEvaluator extends GoalEvaluator {
  calculateDesirability(owner: AiContext): number {
    const van = owner.player.vanguard;
    if (!van || owner.player.hand.length === 0) return 0;
    const hpRatio = van.hp / van.maxHp;
    if (hpRatio > 0.7) return 0; // healthy enough
    return 0.3 + (1 - hpRatio) * 0.4; // more desperate = higher desire
  }

  setGoal(owner: AiContext): void {
    const { player, state } = owner;
    // Sacrifice lowest ATK card
    let bestIdx = 0;
    let lowestAtk = Infinity;
    for (let i = 0; i < player.hand.length; i++) {
      const atk = getEffectiveAtk(
        player.hand[i], state.isNight, player.passiveType, player.passiveValue,
      );
      if (atk < lowestAtk) { lowestAtk = atk; bestIdx = i; }
    }
    owner.decision = {
      action: 'sacrifice',
      cardIndices: [],
      cardIndex: bestIdx,
      reason: `sacrifice card with ATK ${lowestAtk} to heal`,
    };
  }
}

class HustleEvaluator extends GoalEvaluator {
  calculateDesirability(owner: AiContext): number {
    const van = owner.player.vanguard;
    if (!van || van.hp <= 3) return 0; // can't afford HP cost
    if (owner.player.hand.length >= owner.state.config.handMax) return 0;
    if (owner.player.deck.length === 0) return 0;
    // More desirable when hand is small
    const handRatio = owner.player.hand.length / owner.state.config.handMax;
    return 0.2 + (1 - handRatio) * 0.3;
  }

  setGoal(owner: AiContext): void {
    owner.decision = {
      action: 'hustle',
      cardIndices: [],
      reason: 'hustle for cards',
    };
  }
}

class DieRollEvaluator extends GoalEvaluator {
  calculateDesirability(owner: AiContext): number {
    // Forced die roll from opponent
    if (owner.state.forcedDie[owner.side]) return 0.99;
    // Only roll when precision-locked with enough cards
    if (owner.player.hand.length <= 2) return 0;
    if (owner.state.config.dieSize === 0) return 0;
    const attacks = findValidAttacks(owner);
    if (attacks.length > 0) return 0; // can attack, don't roll
    return 0.4; // moderate desire when locked
  }

  setGoal(owner: AiContext): void {
    owner.decision = {
      action: 'roll_die',
      cardIndices: [],
      reason: owner.state.forcedDie[owner.side]
        ? 'forced die roll'
        : 'precision-locked, rolling die',
    };
  }
}

class PassEvaluator extends GoalEvaluator {
  calculateDesirability(): number {
    return 0.05; // absolute last resort
  }

  setGoal(owner: AiContext): void {
    owner.decision = {
      action: 'pass',
      cardIndices: [],
      reason: 'no better option',
    };
  }
}

// ── Brain factory ────────────────────────────────────────────

function createBrain(): Think {
  const brain = new Think();
  brain.addEvaluator(new LethalEvaluator(1.0));
  brain.addEvaluator(new ComboEvaluator(1.0));
  brain.addEvaluator(new PressureEvaluator(1.0));
  brain.addEvaluator(new DieRollEvaluator(1.0));
  brain.addEvaluator(new SacrificeEvaluator(1.0));
  brain.addEvaluator(new HustleEvaluator(1.0));
  brain.addEvaluator(new PassEvaluator(1.0));
  return brain;
}

// Singleton brain — evaluators are stateless, safe to share.
const sharedBrain = createBrain();

/** Make an AI decision for the given side. */
export function makeDecision(state: GameState, side: 'A' | 'B'): AiDecision {
  const opSide: 'A' | 'B' = side === 'A' ? 'B' : 'A';
  const ctx: AiContext = {
    state,
    side,
    player: state.players[side],
    opponent: state.players[opSide],
    decision: null,
  };

  // Track precision lock
  if (ctx.player.hand.length > 0 && findValidAttacks(ctx).length === 0) {
    state.metrics.precisionLocks++;
  }

  // Yuka's Think.arbitrate() reads this.owner, so set it before calling
  sharedBrain.owner = ctx;
  sharedBrain.arbitrate();

  return ctx.decision ?? {
    action: 'pass',
    cardIndices: [],
    reason: 'brain produced no decision',
  };
}
