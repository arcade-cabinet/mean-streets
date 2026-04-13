import type { PolicySample, TurfPolicyArtifact } from '../types';
import { TURF_SIM_CONFIG } from './config';
import { createEmptyPolicyArtifact, ensurePolicyEntry, policyStateKeys } from './policy';

export interface PolicyTrainingOptions {
  alpha?: number;
}

export function trainPolicyArtifact(
  episodes: PolicySample[][],
  configVersion = TURF_SIM_CONFIG.version,
  options: PolicyTrainingOptions = {},
): TurfPolicyArtifact {
  const alpha = options.alpha ?? TURF_SIM_CONFIG.training.alpha;
  const artifact = createEmptyPolicyArtifact(configVersion);

  for (const episode of episodes) {
    const combatEpisode = episode.filter(sample => sample.stateKey.startsWith('combat|'));
    if (combatEpisode.length === 0) continue;
    let returnValue = 0;
    for (let i = combatEpisode.length - 1; i >= 0; i--) {
      const sample = combatEpisode[i];
      if (sample.actionKey === 'pass') continue;
      returnValue += sample.reward;
      for (const stateKey of policyStateKeys(sample.stateKey)) {
        const entry = ensurePolicyEntry(artifact, stateKey, sample.actionKey);
        const action = entry.actions[sample.actionKey];
        action.visits++;
        action.value += alpha * (returnValue - action.value);
        entry.visits++;

        let bestActionKey = entry.bestActionKey;
        let bestValue = Number.NEGATIVE_INFINITY;
        for (const [candidateKey, candidate] of Object.entries(entry.actions)) {
          if (candidate.value > bestValue) {
            bestValue = candidate.value;
            bestActionKey = candidateKey;
          }
        }

        entry.bestActionKey = bestActionKey;
        entry.value = bestValue === Number.NEGATIVE_INFINITY ? 0 : bestValue;
      }
    }
  }

  artifact.generatedAt = new Date().toISOString();
  return artifact;
}
