import { describe, expect, it } from 'vitest';
import {
  createEmptyPolicyArtifact,
  getPolicyValue,
  isPolicyPreferredAction,
  policyStateKeys,
  trainPolicyArtifact,
  TURF_SIM_CONFIG,
} from '../ai';
import type { PolicySample } from '../types';

describe('policy learning', () => {
  it('learns stable best actions from deterministic episodes', () => {
    const episodes: PolicySample[][] = [
      [
        { side: 'A', stateKey: 'combat|lane-1', actionKey: 'direct_attack', goal: 'lane_pressure', reward: 1 },
        { side: 'A', stateKey: 'combat|lane-2', actionKey: 'funded_attack', goal: 'finish_seizure', reward: 3 },
      ],
      [
        { side: 'A', stateKey: 'combat|lane-1', actionKey: 'direct_attack', goal: 'lane_pressure', reward: 2 },
        { side: 'A', stateKey: 'combat|lane-2', actionKey: 'funded_attack', goal: 'finish_seizure', reward: 2 },
      ],
    ];

    const artifact = trainPolicyArtifact(episodes, TURF_SIM_CONFIG.version);

    expect(artifact.entries['combat|lane-1']?.bestActionKey).toBe('direct_attack');
    expect(artifact.entries['combat|lane-2']?.bestActionKey).toBe('funded_attack');
  });

  it('falls back from focused combat states to generic combat policy entries', () => {
    const artifact = createEmptyPolicyArtifact(TURF_SIM_CONFIG.version);
    artifact.entries['combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0'] = {
      stateKey: 'combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0',
      bestActionKey: 'funded_attack',
      value: 1.5,
      visits: 6,
      actions: {
        funded_attack: { value: 1.5, visits: 6 },
      },
    };

    const focusedStateKey = 'combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0|funded:funded:1:0:1';

    expect(getPolicyValue(artifact, focusedStateKey, 'funded_attack')).toBeGreaterThan(0);
    expect(isPolicyPreferredAction(artifact, focusedStateKey, 'funded_attack')).toBe(true);
  });

  it('trains focused combat samples into reusable abstraction levels', () => {
    const focusedStateKey = 'combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0|funded:funded:1:0:1';
    const episodes: PolicySample[][] = [[
      { side: 'A', stateKey: focusedStateKey, actionKey: 'funded_attack', goal: 'funded_pressure', reward: 3 },
    ]];

    const artifact = trainPolicyArtifact(episodes, TURF_SIM_CONFIG.version);

    expect(policyStateKeys(focusedStateKey)).toEqual([
      focusedStateKey,
      'combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0|funded',
      'combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0|none',
      'combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0',
    ]);
    expect(artifact.entries['combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0|funded']?.bestActionKey).toBe('funded_attack');
    expect(artifact.entries['combat|0|0|111|1:1:1:1|0|0|funded:1:0|threat:0:0|none']?.bestActionKey).toBe('funded_attack');
  });
});
