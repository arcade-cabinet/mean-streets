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
  kind: 'tough',
  name: 'Test Crew',
  tagline: 'test',
  archetype: 'bruiser',
  affiliation: 'kings_row',
  power: [6],
  resistance: [3],
  rarity: ['common'],
  abilities: [],
  locked: false,
};

const WEAPON_FIXTURE = {
  id: FIXTURE_WEAP,
  kind: 'weapon',
  name: 'Test Blade',
  category: 'bladed',
  power: [3],
  resistance: [1],
  rarity: ['common'],
  abilities: ['LACERATE', 'PARRY'],
  locked: false,
};

const DRUG_FIXTURE = {
  id: FIXTURE_DRUG,
  kind: 'drug',
  name: 'Test Drug',
  category: 'stimulant',
  power: [2],
  resistance: [1],
  rarity: ['common'],
  abilities: ['RUSH', 'REFLEXES'],
  locked: false,
};

function writeFixture(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function removeFixture(path: string): void {
  if (existsSync(path)) rmSync(path);
}

function unstableRec(cardId: string, reasons: string[] = ['unstable']) {
  return { cardId, state: 'unstable' as const, reasons };
}

function effectFor(
  cardId: string,
  winRateDelta: number,
): EffectAnalysisReport['cardEffects'][number] {
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

  it('nerfs tough whose winRate delta is positive', () => {
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
    const updated = JSON.parse(readFileSync(crewPath, 'utf8')) as {
      power: number[];
      resistance: number[];
    };
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
    expect(result.edits[0]!.stat).toBe('power');
    const updated = JSON.parse(readFileSync(weapPath, 'utf8')) as {
      power: number[];
    };
    expect(updated.power).toEqual([3, 4]);
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
    const unchanged = JSON.parse(readFileSync(drugPath, 'utf8')) as {
      power: number[];
    };
    expect(unchanged.power).toEqual([2]);
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
    writeFixture(weapPath, { ...WEAPON_FIXTURE, power: [1] });
    const locks: LockAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      recommendations: [unstableRec(FIXTURE_WEAP)],
    };
    const effects: EffectAnalysisReport = {
      generatedAt: 'now',
      analysisProfile: 'quick',
      baselineProfile: 'smoke',
      cardEffects: [effectFor(FIXTURE_WEAP, 0.3)],
    };
    const result = runAutobalanceIteration(locks, effects);
    expect(result.edits).toHaveLength(0);
    expect(result.clamped).toHaveLength(1);
  });

  it('skips tune-saturated cards at maxHistoryLength', () => {
    writeFixture(crewPath, {
      ...CREW_FIXTURE,
      power: [6, 5, 6, 5, 6, 5, 6, 5],
      resistance: [3],
    });
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
    expect(result.edits).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain('tune-saturated');
  });
});
