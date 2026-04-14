import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAutobalanceIteration } from '../autobalance';
import type { LockAnalysisReport } from '../locking';
import type { EffectAnalysisReport } from '../effects';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const RAW_TOUGHS = join(ROOT, 'config', 'raw', 'cards', 'toughs');
const RAW_WEAPONS = join(ROOT, 'config', 'raw', 'cards', 'weapons');
const RAW_DRUGS = join(ROOT, 'config', 'raw', 'cards', 'drugs');

const FIXTURE_CREW = 'card-zz1';
const FIXTURE_WEAP = 'weap-zz';
const FIXTURE_DRUG = 'drug-zz';

const crewPath = join(RAW_TOUGHS, `${FIXTURE_CREW}.json`);
const weapPath = join(RAW_WEAPONS, `${FIXTURE_WEAP}.json`);
const drugPath = join(RAW_DRUGS, `${FIXTURE_DRUG}.json`);

const CREW_FIXTURE = {
  id: FIXTURE_CREW,
  type: 'crew',
  displayName: 'Test Crew',
  archetype: 'bruiser',
  affiliation: 'kings_row',
  power: [6],
  resistance: [3],
  abilityText: 'Test ability',
  unlocked: true,
  unlockCondition: null,
  locked: false,
  draft: true,
};

const WEAPON_FIXTURE = {
  id: FIXTURE_WEAP,
  type: 'weapon',
  name: 'Test Blade',
  category: 'bladed',
  bonus: [3],
  offenseAbility: 'LACERATE',
  offenseAbilityText: 'test',
  defenseAbility: 'PARRY',
  defenseAbilityText: 'test',
  unlocked: true,
  unlockCondition: null,
  locked: false,
  draft: true,
};

const DRUG_FIXTURE = {
  id: FIXTURE_DRUG,
  type: 'product',
  name: 'Test Drug',
  category: 'stimulant',
  potency: [2],
  offenseAbility: 'RUSH',
  offenseAbilityText: 'test',
  defenseAbility: 'REFLEXES',
  defenseAbilityText: 'test',
  unlocked: true,
  unlockCondition: null,
  locked: false,
  draft: true,
};

function writeFixture(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function removeFixture(path: string): void {
  if (existsSync(path)) rmSync(path);
}

function unstableRec(cardId: string, reasons: string[] = ['unstable']) {
  return { cardId, state: 'unstable' as const, reasons };
}

function effectFor(cardId: string, winRateDelta: number): EffectAnalysisReport['cardEffects'][number] {
  return {
    cardId,
    sampleCount: 100,
    baselineWinRate: 0.5,
    forcedWinRate: 0.5 + winRateDelta,
    winRateDelta,
    winRatePValue: 0.01,
    winRateEffectSize: 0.5,
    winRateConfidence: [0, 0],
    medianTurnDelta: 0,
    turnPValue: 1,
    turnConfidence: [0, 0],
    fundedDelta: winRateDelta > 0 ? 1 : 0,
    pushedDelta: 0,
    directDelta: winRateDelta > 0 ? 0.5 : 0,
    reserveCrewDelta: 0,
    backpacksEquippedDelta: 0,
    runnerDeploymentsDelta: 0,
    payloadDeploymentsDelta: 0,
    runnerOpportunityUseRateDelta: 0,
    runnerReserveStartUseRateDelta: 0,
    volatility: 0.01,
    significant: true,
  };
}

describe('runAutobalanceIteration', () => {
  beforeEach(() => {
    writeFixture(crewPath, CREW_FIXTURE);
    writeFixture(weapPath, WEAPON_FIXTURE);
    writeFixture(drugPath, DRUG_FIXTURE);
  });
  afterEach(() => {
    removeFixture(crewPath);
    removeFixture(weapPath);
    removeFixture(drugPath);
  });

  it('nerfs crew whose winRate delta is positive', () => {
    const locks: LockAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      recommendations: [unstableRec(FIXTURE_CREW)],
    };
    const effects: EffectAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [effectFor(FIXTURE_CREW, 0.15)],
    };
    const result = runAutobalanceIteration(locks, effects);
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0]!.direction).toBe('nerf');
    const updated = JSON.parse(readFileSync(crewPath, 'utf8')) as { power: number[]; resistance: number[] };
    expect(updated.power).toEqual([6, 5]);
    expect(updated.resistance).toEqual([3]);
  });

  it('buffs weapon whose winRate delta is negative', () => {
    const locks: LockAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      recommendations: [unstableRec(FIXTURE_WEAP)],
    };
    const effects: EffectAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [effectFor(FIXTURE_WEAP, -0.2)],
    };
    const result = runAutobalanceIteration(locks, effects);
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0]!.direction).toBe('buff');
    const updated = JSON.parse(readFileSync(weapPath, 'utf8')) as { bonus: number[] };
    expect(updated.bonus).toEqual([3, 4]);
  });

  it('dry-run does not write to disk', () => {
    const locks: LockAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      recommendations: [unstableRec(FIXTURE_DRUG)],
    };
    const effects: EffectAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [effectFor(FIXTURE_DRUG, -0.1)],
    };
    const result = runAutobalanceIteration(locks, effects, { dryRun: true });
    expect(result.edits).toHaveLength(1);
    const unchanged = JSON.parse(readFileSync(drugPath, 'utf8')) as { potency: number[] };
    expect(unchanged.potency).toEqual([2]);
  });

  it('skips locked cards', () => {
    writeFixture(crewPath, { ...CREW_FIXTURE, locked: true });
    const locks: LockAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      recommendations: [unstableRec(FIXTURE_CREW)],
    };
    const effects: EffectAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [effectFor(FIXTURE_CREW, 0.2)],
    };
    const result = runAutobalanceIteration(locks, effects);
    expect(result.edits).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toBe('locked=true');
  });

  it('reports clamped cards that hit the stat floor', () => {
    writeFixture(weapPath, { ...WEAPON_FIXTURE, bonus: [1] });
    const locks: LockAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      recommendations: [unstableRec(FIXTURE_WEAP)],
    };
    const effects: EffectAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [effectFor(FIXTURE_WEAP, -0.3)], // would buff, but floor-clamped? no, +1→2 works
    };
    // Try nerfing from floor instead: make winRateDelta positive, bonus=1
    // The test above is actually a buff from 1→2, which is allowed. Swap
    // to a nerf-from-floor to test clamp.
    const effects2: EffectAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [effectFor(FIXTURE_WEAP, 0.3)],
    };
    // use effects2 so it tries to nerf from 1 (would go to 0, clamped)
    void effects;
    const result = runAutobalanceIteration(locks, effects2);
    expect(result.edits).toHaveLength(0);
    expect(result.clamped).toHaveLength(1);
  });
});
