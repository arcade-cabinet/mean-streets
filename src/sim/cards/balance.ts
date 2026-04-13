/**
 * Balance analysis for the character card system.
 * Runs Monte Carlo simulations and produces JSON diagnostic reports.
 */

import { generateAllCards, printCardPoolSummary } from './generator';
import { playCardGame, DEFAULT_CARD_CONFIG, type CardGameConfig } from './game';
import type { CharacterCard } from './schemas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

interface BalanceMetrics {
  games: number;
  winRateA: number;
  firstMoverWinRate: number;
  stallRate: number;
  avgTurns: number;
  medianTurns: number;
  avgPassRate: number;
  avgPrecisionLockRate: number;
  avgAttacks: number;
  avgSacrifices: number;
  avgHustles: number;
  avgDieRolls: number;
  avgDieHitRate: number;
  avgVanguardDeaths: number;
  avgOverdraw: number;
  avgShieldSaves: number;
  avgNightShifts: number;
  avgDeckConflicts: number;
  avgDeckSynergies: number;
}

interface ArchetypeReport {
  archetype: string;
  totalPlayed: number;
  avgWinContribution: number;
  avgAtk: number;
  avgDef: number;
}

interface AffiliationReport {
  affiliation: string;
  totalInDecks: number;
  avgConflicts: number;
}

export interface CardBalanceReport {
  timestamp: string;
  config: CardGameConfig;
  poolSize: number;
  overall: BalanceMetrics;
  archetypes: ArchetypeReport[];
  affiliations: AffiliationReport[];
  tierDistribution: Record<number, { avgAtk: number; avgDef: number }>;
  issues: string[];
  recommendations: string[];
}

/** Run N games and produce a balance report. */
export function runCardBalance(
  numGames: number,
  config: CardGameConfig = DEFAULT_CARD_CONFIG,
  seed = 42,
): CardBalanceReport {
  const pool = generateAllCards(seed, 20);

  let winsA = 0;
  let firstMoverWins = 0;
  let stalls = 0;
  const allTurns: number[] = [];
  let totalPassRate = 0;
  let totalLockRate = 0;
  let totalAttacks = 0;
  let totalSacrifices = 0;
  let totalHustles = 0;
  let totalDieRolls = 0;
  let totalDieHits = 0;
  let totalVanDeaths = 0;
  let totalOverdraw = 0;
  let totalShieldSaves = 0;
  let totalNightShifts = 0;
  let totalConflicts = 0;
  let totalSynergies = 0;

  for (let i = 0; i < numGames; i++) {
    const result = playCardGame(pool, config);
    const m = result.metrics;

    if (result.winner === 'A') winsA++;
    if (result.winner === result.firstPlayer) firstMoverWins++;
    if (result.endReason === 'stall') stalls++;

    allTurns.push(m.turns);
    if (m.turns > 0) {
      totalPassRate += m.passes / m.turns;
      totalLockRate += m.precisionLocks / m.turns;
    }
    totalAttacks += m.attacks;
    totalSacrifices += m.sacrifices;
    totalHustles += m.hustles;
    totalDieRolls += m.dieRolls;
    totalDieHits += m.dieHits;
    totalVanDeaths += m.vanguardDeaths;
    totalOverdraw += m.overdrawPenalties;
    totalShieldSaves += m.shieldSaves;
    totalNightShifts += m.nightShifts;
    totalConflicts += result.deckA.conflicts + result.deckB.conflicts;
    totalSynergies += result.deckA.synergies + result.deckB.synergies;
  }

  allTurns.sort((a, b) => a - b);
  const n = numGames;

  const overall: BalanceMetrics = {
    games: n,
    winRateA: +(winsA / n * 100).toFixed(1),
    firstMoverWinRate: +(firstMoverWins / n * 100).toFixed(1),
    stallRate: +(stalls / n * 100).toFixed(1),
    avgTurns: +(allTurns.reduce((a, b) => a + b, 0) / n).toFixed(1),
    medianTurns: allTurns[Math.floor(n / 2)],
    avgPassRate: +(totalPassRate / n * 100).toFixed(1),
    avgPrecisionLockRate: +(totalLockRate / n * 100).toFixed(1),
    avgAttacks: +(totalAttacks / n).toFixed(1),
    avgSacrifices: +(totalSacrifices / n).toFixed(1),
    avgHustles: +(totalHustles / n).toFixed(1),
    avgDieRolls: +(totalDieRolls / n).toFixed(1),
    avgDieHitRate: totalDieRolls > 0
      ? +(totalDieHits / totalDieRolls * 100).toFixed(1)
      : 0,
    avgVanguardDeaths: +(totalVanDeaths / n).toFixed(1),
    avgOverdraw: +(totalOverdraw / n).toFixed(2),
    avgShieldSaves: +(totalShieldSaves / n).toFixed(2),
    avgNightShifts: +(totalNightShifts / n).toFixed(1),
    avgDeckConflicts: +(totalConflicts / (n * 2)).toFixed(2),
    avgDeckSynergies: +(totalSynergies / (n * 2)).toFixed(2),
  };

  // Analyze pool stats by archetype and tier
  const archetypes = analyzeArchetypes(pool);
  const affiliations = analyzeAffiliations(pool);
  const tierDist = analyzeTiers(pool);

  // Generate issues and recommendations
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (overall.stallRate > 5) {
    issues.push(`Stall rate ${overall.stallRate}% exceeds 5% threshold`);
    recommendations.push('Reduce precision multiplier or increase stat range');
  }
  if (overall.avgPassRate > 20) {
    issues.push(`Pass rate ${overall.avgPassRate}% exceeds 20% threshold`);
    recommendations.push('Lower high-tier card ATK or increase die penalty');
  }
  if (overall.avgPrecisionLockRate > 25) {
    issues.push(`Precision lock rate ${overall.avgPrecisionLockRate}%`);
    recommendations.push('Increase precision multiplier from current value');
  }
  if (overall.firstMoverWinRate > 55 || overall.firstMoverWinRate < 45) {
    issues.push(`First mover advantage ${overall.firstMoverWinRate}%`);
    recommendations.push('Adjust second player bonus');
  }
  if (overall.avgTurns < 10) {
    issues.push(`Games too short: avg ${overall.avgTurns} turns`);
    recommendations.push('Increase DEF stats across the board');
  }
  if (overall.avgTurns > 40) {
    issues.push(`Games too long: avg ${overall.avgTurns} turns`);
    recommendations.push('Increase ATK stats or reduce DEF');
  }

  return {
    timestamp: new Date().toISOString(),
    config,
    poolSize: pool.length,
    overall,
    archetypes,
    affiliations,
    tierDistribution: tierDist,
    issues,
    recommendations,
  };
}

function analyzeArchetypes(pool: CharacterCard[]): ArchetypeReport[] {
  const byArch: Record<string, CharacterCard[]> = {};
  for (const c of pool) {
    if (!byArch[c.archetype]) byArch[c.archetype] = [];
    byArch[c.archetype].push(c);
  }

  return Object.entries(byArch).map(([arch, cards]) => ({
    archetype: arch,
    totalPlayed: cards.length,
    avgWinContribution: 0, // would need per-card tracking
    avgAtk: +(cards.reduce((s, c) => s + c.dayAtk, 0) / cards.length).toFixed(1),
    avgDef: +(cards.reduce((s, c) => s + c.dayDef, 0) / cards.length).toFixed(1),
  }));
}

function analyzeAffiliations(pool: CharacterCard[]): AffiliationReport[] {
  const byAff: Record<string, CharacterCard[]> = {};
  for (const c of pool) {
    if (!byAff[c.affiliation]) byAff[c.affiliation] = [];
    byAff[c.affiliation].push(c);
  }

  return Object.entries(byAff).map(([aff, cards]) => ({
    affiliation: aff,
    totalInDecks: cards.length,
    avgConflicts: 0,
  }));
}

function analyzeTiers(
  pool: CharacterCard[],
): Record<number, { avgAtk: number; avgDef: number }> {
  const result: Record<number, { avgAtk: number; avgDef: number }> = {};
  for (let t = 1; t <= 5; t++) {
    const cards = pool.filter(c => c.tier === t);
    if (cards.length === 0) continue;
    result[t] = {
      avgAtk: +(cards.reduce((s, c) => s + c.dayAtk, 0) / cards.length).toFixed(1),
      avgDef: +(cards.reduce((s, c) => s + c.dayDef, 0) / cards.length).toFixed(1),
    };
  }
  return result;
}

/** Run balance and save report. */
export function runAndSaveReport(
  numGames: number,
  config?: Partial<CardGameConfig>,
): CardBalanceReport {
  const fullConfig = { ...DEFAULT_CARD_CONFIG, ...config };

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  MEAN STREETS — Character Card Balance Test  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\nGames: ${numGames}`);
  console.log(`Config: precision=${fullConfig.precisionMult}x die=d${fullConfig.dieSize}`);

  const start = Date.now();
  const report = runCardBalance(numGames, fullConfig);
  const elapsed = Date.now() - start;

  // Print summary
  console.log(`\nCompleted in ${elapsed}ms`);
  console.log('\n── OVERALL ──');
  console.log(`  Win Rate A/B:    ${report.overall.winRateA}/${(100 - report.overall.winRateA).toFixed(1)}%`);
  console.log(`  1st Mover Win:   ${report.overall.firstMoverWinRate}%`);
  console.log(`  Avg Turns:       ${report.overall.avgTurns}`);
  console.log(`  Median Turns:    ${report.overall.medianTurns}`);
  console.log(`  Pass Rate:       ${report.overall.avgPassRate}%`);
  console.log(`  Precision Lock:  ${report.overall.avgPrecisionLockRate}%`);
  console.log(`  Stall Rate:      ${report.overall.stallRate}%`);
  console.log(`  Avg Attacks:     ${report.overall.avgAttacks}`);
  console.log(`  Avg Sacrifices:  ${report.overall.avgSacrifices}`);
  console.log(`  Avg Die Rolls:   ${report.overall.avgDieRolls}`);
  console.log(`  Avg Van Deaths:  ${report.overall.avgVanguardDeaths}`);
  console.log(`  Night Shifts:    ${report.overall.avgNightShifts}`);
  console.log(`  Deck Conflicts:  ${report.overall.avgDeckConflicts}`);
  console.log(`  Deck Synergies:  ${report.overall.avgDeckSynergies}`);

  console.log('\n── TIER STATS ──');
  for (const [tier, stats] of Object.entries(report.tierDistribution)) {
    console.log(`  Tier ${tier}: avg ATK ${stats.avgAtk} DEF ${stats.avgDef}`);
  }

  if (report.issues.length > 0) {
    console.log('\n── ISSUES ──');
    report.issues.forEach(i => console.log(`  ✗ ${i}`));
  }
  if (report.recommendations.length > 0) {
    console.log('\n── RECOMMENDATIONS ──');
    report.recommendations.forEach(r => console.log(`  → ${r}`));
  }

  // Save JSON
  const reportDir = join(process.cwd(), 'sim', 'reports', 'cards');
  mkdirSync(reportDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(reportDir, `balance-${ts}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path}\n`);

  return report;
}
