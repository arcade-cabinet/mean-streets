import type { Rng } from '../../cards/rng';
import type { DifficultyTier, TurfAction, TurfPolicyArtifact, TurfPolicyEntry } from '../types';
import { TURF_AI_CONFIG, TURF_SIM_CONFIG } from './config';

export interface ScoredAction {
  action: TurfAction;
  score: number;
  policyUsed: boolean;
}

export function policyStateKeys(stateKey: string): string[] {
  if (!stateKey.startsWith('combat|')) return [stateKey];
  const lastSeparator = stateKey.lastIndexOf('|');
  if (lastSeparator <= 'combat'.length) return [stateKey];
  const base = stateKey.slice(0, lastSeparator);
  const focus = stateKey.slice(lastSeparator + 1);
  const keys = [stateKey];
  if (focus !== 'none') {
    const focusRole = focus.split(':', 1)[0];
    keys.push(`${base}|${focusRole}`);
  }
  keys.push(`${base}|none`);
  keys.push(base);
  return [...new Set(keys)];
}

function findActionEntry(
  artifact: TurfPolicyArtifact | undefined,
  stateKey: string,
  actionKey: string,
): { entry: TurfPolicyEntry; value: { value: number; visits: number } } | undefined {
  if (!artifact) return undefined;
  const policyWeights = TURF_AI_CONFIG.policyWeights;
  for (const candidate of policyStateKeys(stateKey)) {
    const entry = artifact.entries[candidate];
    const action = entry?.actions[actionKey];
    if (entry && action && action.visits >= policyWeights.minActionVisits) {
      return { entry, value: action };
    }
  }
  return undefined;
}

function findPreferredEntry(
  artifact: TurfPolicyArtifact | undefined,
  stateKey: string,
): TurfPolicyEntry | undefined {
  if (!artifact) return undefined;
  const policyWeights = TURF_AI_CONFIG.policyWeights;
  for (const candidate of policyStateKeys(stateKey)) {
    const entry = artifact.entries[candidate];
    if (entry && entry.visits >= policyWeights.minPreferredVisits) return entry;
  }
  return undefined;
}

export function createEmptyPolicyArtifact(configVersion: string): TurfPolicyArtifact {
  return {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    configVersion,
    entries: {},
  };
}

export function getPolicyValue(
  artifact: TurfPolicyArtifact | undefined,
  stateKey: string,
  actionKey: string,
): number {
  const policyWeights = TURF_AI_CONFIG.policyWeights;
  const match = findActionEntry(artifact, stateKey, actionKey);
  if (!match) return 0;
  const confidence = Math.min(1, match.value.visits / policyWeights.confidenceSaturation);
  return match.value.value * confidence;
}

export function isPolicyPreferredAction(
  artifact: TurfPolicyArtifact | undefined,
  stateKey: string,
  actionKey: string,
): boolean {
  const entry = findPreferredEntry(artifact, stateKey);
  if (!entry) return false;
  return entry.bestActionKey === actionKey;
}

export function ensurePolicyEntry(
  artifact: TurfPolicyArtifact,
  stateKey: string,
  actionKey: string,
): TurfPolicyEntry {
  let entry = artifact.entries[stateKey];
  if (!entry) {
    entry = {
      stateKey,
      bestActionKey: actionKey,
      value: 0,
      visits: 0,
      actions: {},
    };
    artifact.entries[stateKey] = entry;
  }

  if (!entry.actions[actionKey]) {
    entry.actions[actionKey] = { value: 0, visits: 0 };
  }

  return entry;
}

// ── Difficulty-gated action selection ──────────────────────

type DifficultyProfile = {
  topK: number;
  noise: number;
  actionBonus: number;
  playerActionPenalty: number;
  lookahead: boolean;
};

function getProfile(difficulty: DifficultyTier): DifficultyProfile {
  const profiles = TURF_SIM_CONFIG.difficultyProfiles;
  return profiles[difficulty] as DifficultyProfile;
}

export function selectAction(
  scored: ScoredAction[],
  difficulty: DifficultyTier,
  rng: Rng,
): ScoredAction {
  if (scored.length === 0) throw new Error('No scored actions to select from');
  if (scored.length === 1) return scored[0];

  const profile = getProfile(difficulty);
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const candidates = sorted.slice(0, Math.min(profile.topK, sorted.length));

  if (profile.noise === 0) return candidates[0];

  const noised = candidates.map((c) => ({
    ...c,
    score: c.score + (rng.next() - 0.5) * 2 * profile.noise * Math.abs(c.score || 1),
  }));
  noised.sort((a, b) => b.score - a.score);
  return noised[0];
}
