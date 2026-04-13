/**
 * Fuzzy logic module for AI decision-making.
 * Uses Yuka's FuzzyModule to evaluate board state in degrees.
 */

// @ts-expect-error — Yuka has no TypeScript declarations
import { FuzzyModule, FuzzyVariable, LeftShoulderFuzzySet, RightShoulderFuzzySet, TriangularFuzzySet, FuzzyRule, FuzzyAND } from 'yuka';
import type { TurfGameState } from './types';
import { positionPower } from './board';

export interface FuzzyEval {
  aggression: number;
  patience: number;
  desperation: number;
}

/** Build the fuzzy inference system. */
function buildFuzzyModule() {
  const fm = new FuzzyModule();

  // ── Input: Crew Strength (0-10) ──
  const crewWeak = new LeftShoulderFuzzySet(0, 2, 4);
  const crewMod = new TriangularFuzzySet(2, 5, 8);
  const crewStrong = new RightShoulderFuzzySet(6, 8, 10);
  const crewStrength = new FuzzyVariable();
  crewStrength.add(crewWeak);
  crewStrength.add(crewMod);
  crewStrength.add(crewStrong);
  fm.addFLV('crewStrength', crewStrength);

  // ── Input: Threat Level (0-10) ──
  const threatLow = new LeftShoulderFuzzySet(0, 2, 4);
  const threatMed = new TriangularFuzzySet(2, 5, 8);
  const threatHigh = new RightShoulderFuzzySet(6, 8, 10);
  const threat = new FuzzyVariable();
  threat.add(threatLow);
  threat.add(threatMed);
  threat.add(threatHigh);
  fm.addFLV('threatLevel', threat);

  // ── Input: Resource Level (0-10) ──
  const resScarce = new LeftShoulderFuzzySet(0, 2, 4);
  const resAdequate = new TriangularFuzzySet(2, 5, 8);
  const resAbundant = new RightShoulderFuzzySet(6, 8, 10);
  const resources = new FuzzyVariable();
  resources.add(resScarce);
  resources.add(resAdequate);
  resources.add(resAbundant);
  fm.addFLV('resourceLevel', resources);

  // ── Input: Danger (0-5) ──
  const dangerSafe = new LeftShoulderFuzzySet(0, 1, 2);
  const dangerThreatened = new TriangularFuzzySet(1, 2.5, 4);
  const dangerCritical = new RightShoulderFuzzySet(3, 4, 5);
  const danger = new FuzzyVariable();
  danger.add(dangerSafe);
  danger.add(dangerThreatened);
  danger.add(dangerCritical);
  fm.addFLV('danger', danger);

  // ── Output: Aggression (0-10) ──
  const agrCautious = new LeftShoulderFuzzySet(0, 2, 4);
  const agrBalanced = new TriangularFuzzySet(3, 5, 7);
  const agrAggressive = new RightShoulderFuzzySet(6, 8, 10);
  const aggression = new FuzzyVariable();
  aggression.add(agrCautious);
  aggression.add(agrBalanced);
  aggression.add(agrAggressive);
  fm.addFLV('aggression', aggression);

  // ── Output: Patience (0-10) ──
  const patImpatient = new LeftShoulderFuzzySet(0, 2, 4);
  const patMeasured = new TriangularFuzzySet(3, 5, 7);
  const patPatient = new RightShoulderFuzzySet(6, 8, 10);
  const patience = new FuzzyVariable();
  patience.add(patImpatient);
  patience.add(patMeasured);
  patience.add(patPatient);
  fm.addFLV('patience', patience);

  // ── Output: Desperation (0-10) ──
  const despCalm = new LeftShoulderFuzzySet(0, 2, 4);
  const despAnxious = new TriangularFuzzySet(3, 5, 7);
  const despDesperate = new RightShoulderFuzzySet(6, 8, 10);
  const desperation = new FuzzyVariable();
  desperation.add(despCalm);
  desperation.add(despAnxious);
  desperation.add(despDesperate);
  fm.addFLV('desperation', desperation);

  // ── Rules ──
  // Strong + low threat = aggressive
  fm.addRule(new FuzzyRule(new FuzzyAND(crewStrong, threatLow), agrAggressive));
  // Strong + high threat = balanced
  fm.addRule(new FuzzyRule(new FuzzyAND(crewStrong, threatHigh), agrBalanced));
  // Weak + low threat = cautious
  fm.addRule(new FuzzyRule(new FuzzyAND(crewWeak, threatLow), agrCautious));
  // Weak + high threat = aggressive (desperation)
  fm.addRule(new FuzzyRule(new FuzzyAND(crewWeak, threatHigh), agrAggressive));
  // Abundant resources = patient
  fm.addRule(new FuzzyRule(resAbundant, patPatient));
  // Scarce resources = impatient
  fm.addRule(new FuzzyRule(resScarce, patImpatient));
  // Critical danger = desperate
  fm.addRule(new FuzzyRule(dangerCritical, despDesperate));
  // Safe = calm
  fm.addRule(new FuzzyRule(dangerSafe, despCalm));
  // Threatened + weak = desperate
  fm.addRule(new FuzzyRule(new FuzzyAND(dangerThreatened, crewWeak), despDesperate));
  // Strong + abundant = very patient
  fm.addRule(new FuzzyRule(new FuzzyAND(crewStrong, resAbundant), patPatient));
  // High threat + scarce = aggressive
  fm.addRule(new FuzzyRule(new FuzzyAND(threatHigh, resScarce), agrAggressive));

  return fm;
}

const fuzzyModule = buildFuzzyModule();

export function evaluateFuzzy(state: TurfGameState, side: 'A' | 'B'): FuzzyEval {
  const p = state.players[side];
  const opp = state.players[side === 'A' ? 'B' : 'A'];

  const totalPower = p.board.active.reduce((s, pos) => s + positionPower(pos), 0);
  const crewCount = p.board.active.filter(pos => pos.crew).length;
  const crewStrength = Math.min(10, (totalPower / 5) + (crewCount * 0.5));

  const oppPower = opp.board.active.reduce((s, pos) => s + positionPower(pos), 0);
  const oppCount = opp.board.active.filter(pos => pos.crew).length;
  const threatLevel = Math.min(10, (oppPower / 5) + (oppCount * 0.5));

  const handTotal = p.hand.crew.length + p.hand.modifiers.length;
  const drawTotal = p.crewDraw.length + p.modifierDraw.length;
  const resourceLevel = Math.min(10, handTotal * 0.8 + drawTotal * 0.2);

  const seizedAgainst = p.board.active.filter(pos => pos.seized).length;

  fuzzyModule.fuzzify('crewStrength', Math.max(0, Math.min(10, crewStrength)));
  fuzzyModule.fuzzify('threatLevel', Math.max(0, Math.min(10, threatLevel)));
  fuzzyModule.fuzzify('resourceLevel', Math.max(0, Math.min(10, resourceLevel)));
  fuzzyModule.fuzzify('danger', Math.max(0, Math.min(5, seizedAgainst)));

  const agg = fuzzyModule.defuzzify('aggression');
  const pat = fuzzyModule.defuzzify('patience');
  const desp = fuzzyModule.defuzzify('desperation');

  return {
    aggression: isNaN(agg) ? 0.5 : agg / 10,
    patience: isNaN(pat) ? 0.5 : pat / 10,
    desperation: isNaN(desp) ? 0 : desp / 10,
  };
}
