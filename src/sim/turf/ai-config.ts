import aiConfig from '../../data/ai/turf-ai.json';

export const TURF_AI_CONFIG = aiConfig;

export type TurfAiGoal = keyof typeof TURF_AI_CONFIG.goalFallbacks;
