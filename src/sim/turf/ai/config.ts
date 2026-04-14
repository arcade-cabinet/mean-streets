import tacticalConfig from '../../../data/ai/turf-ai.json';
import simConfig from '../../../data/ai/turf-sim.json';

export const TURF_AI_CONFIG = tacticalConfig;
export const TURF_SIM_CONFIG = simConfig;

export type TurfAiGoal = keyof typeof TURF_AI_CONFIG.goalFallbacks;
export type TurfSimConfigVersion = typeof TURF_SIM_CONFIG.version;
