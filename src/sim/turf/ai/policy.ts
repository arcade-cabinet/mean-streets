import type { TurfPolicyArtifact, TurfPolicyEntry } from '../types';
import { TURF_AI_CONFIG } from './config';

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
