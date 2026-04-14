import { describe, it, expect } from 'vitest';
import { playTurfGame } from '../game';
import { DEFAULT_TURF_CONFIG } from '../types';

describe('playTurfGame', () => {
  it('completes a game without crashing', () => {
    const result = playTurfGame(DEFAULT_TURF_CONFIG, 42);
    expect(result.winner).toMatch(/^[AB]$/);
    expect(result.turnCount).toBeGreaterThan(0);
    expect(result.metrics.turns).toBeGreaterThan(0);
  });

  it('is deterministic with same seed', () => {
    const a = playTurfGame(DEFAULT_TURF_CONFIG, 12345);
    const b = playTurfGame(DEFAULT_TURF_CONFIG, 12345);
    expect(a.winner).toBe(b.winner);
    expect(a.turnCount).toBe(b.turnCount);
    expect(a.metrics).toEqual(b.metrics);
  });

  it('records planner decisions throughout the game', () => {
    const result = playTurfGame(DEFAULT_TURF_CONFIG, 42);
    expect(result.metrics.crewPlaced).toBeGreaterThan(0);
    expect(result.plannerTrace.length).toBeGreaterThan(0);
  });

  it('tracks runner opener opportunities during buildup', () => {
    const result = playTurfGame(DEFAULT_TURF_CONFIG, 42);
    expect(result.metrics.runnerOpportunityTurns).toBeGreaterThanOrEqual(0);
    expect(result.metrics.runnerOpportunityTaken).toBeGreaterThanOrEqual(0);
    expect(result.metrics.runnerOpportunityMissed).toBeGreaterThanOrEqual(0);
    expect(result.metrics.runnerOpportunityTaken + result.metrics.runnerOpportunityMissed)
      .toBe(result.metrics.runnerOpportunityTurns);
    expect(
      result.metrics.runnerReserveOpportunityTurns
      + result.metrics.runnerEquipOpportunityTurns
      + result.metrics.runnerDeployOpportunityTurns
      + result.metrics.runnerPayloadOpportunityTurns,
    ).toBe(result.metrics.runnerOpportunityTurns);
    expect(
      result.metrics.runnerReserveOpportunityTaken
      + result.metrics.runnerEquipOpportunityTaken
      + result.metrics.runnerDeployOpportunityTaken
      + result.metrics.runnerPayloadOpportunityTaken,
    ).toBe(result.metrics.runnerOpportunityTaken);
    expect(
      result.metrics.runnerReserveOpportunityMissed
      + result.metrics.runnerEquipOpportunityMissed
      + result.metrics.runnerDeployOpportunityMissed
      + result.metrics.runnerPayloadOpportunityMissed,
    ).toBe(result.metrics.runnerOpportunityMissed);
  });

  it('ends by seizure or timeout', () => {
    const result = playTurfGame(DEFAULT_TURF_CONFIG, 42);
    expect(['total_seizure', 'timeout']).toContain(result.endReason);
  });

  it('completes 10 games with different seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const result = playTurfGame(DEFAULT_TURF_CONFIG, seed * 1000);
      expect(result.winner).toMatch(/^[AB]$/);
    }
  });
});
