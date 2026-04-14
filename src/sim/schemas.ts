/**
 * Zod schemas for validating gang and game config JSON files.
 * All game data flows through these schemas before entering the engine.
 */

import { z } from 'zod';

// ── Card Schema ──────────────────────────────────────────────

export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tier: z.number().int().min(1),
  dayAtk: z.number().int().min(0).max(15),
  dayDef: z.number().int().min(1).max(15),
  nightAtk: z.number().int().min(0).max(15),
  nightDef: z.number().int().min(1).max(15),
});

// ── Gang Schema ──────────────────────────────────────────────

export const GangPassiveSchema = z.enum([
  'BRUTAL',   // +N damage on attacks
  'ANCHOR',   // +N shield on vanguard promotion
  'BLEED',    // enemy discards N on kill
  'SCAVENGE', // draw N on sacrifice
]);

export const PassiveConfigSchema = z.object({
  type: GangPassiveSchema,
  value: z.number().int().min(1).max(5),
  description: z.string(),
});

export const GangSchema = z.object({
  id: z.string().min(1).max(20),
  name: z.string().min(1).max(30),
  tagline: z.string().max(100),
  passive: PassiveConfigSchema,
  unlockCondition: z.string().optional(),
  cards: z.array(CardSchema).min(10).max(40),
}).refine(
  (gang) => {
    // Ensure card IDs are unique within the gang
    const ids = gang.cards.map(c => c.id);
    return new Set(ids).size === ids.length;
  },
  { message: 'Card IDs must be unique within a gang' },
).refine(
  (gang) => {
    // Ensure card tiers are sequential starting from 1
    const tiers = gang.cards.map(c => c.tier).sort((a, b) => a - b);
    return tiers.every((t, i) => t === i + 1);
  },
  { message: 'Card tiers must be sequential starting from 1' },
).refine(
  (gang) => {
    // Ensure every card has dayDef >= 1 (must survive as vanguard)
    return gang.cards.every(c => c.dayDef >= 1 && c.nightDef >= 1);
  },
  { message: 'All cards must have dayDef and nightDef >= 1' },
);

// ── Game Config Schema ───────────────────────────────────────

export const GameConfigSchema = z.object({
  gangA: z.string().min(1),
  gangB: z.string().min(1),
  dieSize: z.number().int().min(0).max(20),
  precisionMult: z.number().min(0.5).max(5.0),
  handMax: z.number().int().min(3).max(10),
  runsEnabled: z.boolean(),
  setsEnabled: z.boolean(),
  secondPlayerBonus: z.boolean(),
  nightShiftEvery: z.number().int().min(1).max(99),
  maxTurns: z.number().int().min(10).max(1000),
});

// ── Balance Report Schema ────────────────────────────────────

export const MatchupResultSchema = z.object({
  gangA: z.string(),
  gangB: z.string(),
  games: z.number().int(),
  winRateA: z.number(),
  winRateB: z.number(),
  firstMoverWinRate: z.number(),
  stallRate: z.number(),
  avgTurns: z.number(),
  medianTurns: z.number(),
  avgPassRate: z.number(),
  avgPrecisionLockRate: z.number(),
  metrics: z.record(z.number()),
});

export const BalanceReportSchema = z.object({
  timestamp: z.string(),
  config: GameConfigSchema.partial(),
  gangs: z.array(z.string()),
  matchups: z.array(MatchupResultSchema),
  gangRatings: z.record(z.number()),
  worstMatchup: z.object({
    gangA: z.string(),
    gangB: z.string(),
    winRate: z.number(),
  }),
  balanced: z.boolean(),
  issues: z.array(z.string()),
});

// ── Inferred types ───────────────────────────────────────────

export type CardData = z.infer<typeof CardSchema>;
export type GangData = z.infer<typeof GangSchema>;
export type PassiveConfig = z.infer<typeof PassiveConfigSchema>;
export type GameConfigData = z.infer<typeof GameConfigSchema>;
export type MatchupResultData = z.infer<typeof MatchupResultSchema>;
export type BalanceReportData = z.infer<typeof BalanceReportSchema>;
