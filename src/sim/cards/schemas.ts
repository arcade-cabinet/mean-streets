import { z } from 'zod';

// ── Shared enums & helpers ─────────────────────────────────────

export const RaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'legendary',
  'mythic',
]);

export const WeaponCategoryEnum = z.enum([
  'bladed',
  'blunt',
  'explosive',
  'ranged',
  'stealth',
]);

export const DrugCategoryEnum = z.enum([
  'stimulant',
  'sedative',
  'hallucinogen',
  'steroid',
  'narcotic',
]);

export const StatHistorySchema = z
  .array(z.number().int().min(1).max(12))
  .min(1);

export const RarityHistorySchema = z.array(RaritySchema).min(1);

export const PortraitLayerPoolSchema = z.union([
  z.string(),
  z.array(z.string()).min(1),
]);

export const PortraitLayersSchema = z.object({
  body: PortraitLayerPoolSchema.optional(),
  head: PortraitLayerPoolSchema.optional(),
  torso: PortraitLayerPoolSchema.optional(),
  arms: PortraitLayerPoolSchema.optional(),
  legs: PortraitLayerPoolSchema.optional(),
  back: PortraitLayerPoolSchema.optional(),
  primary: PortraitLayerPoolSchema.optional(),
  support: PortraitLayerPoolSchema.optional(),
  backdrop: PortraitLayerPoolSchema.optional(),
  badge: PortraitLayerPoolSchema.optional(),
});

export const PortraitStackSchema = z.object({
  mode: z.literal('stack'),
  template: z.string().optional(),
  palette: z.string().optional(),
  layers: PortraitLayersSchema.optional(),
});

export const PortraitCustomSchema = z.object({
  mode: z.literal('custom'),
  sprite: z.string(),
});

export const PortraitSchema = z.union([
  PortraitStackSchema,
  PortraitCustomSchema,
]);

export const NonMythicPortraitSchema = PortraitStackSchema;
export const MythicPortraitSchema = PortraitCustomSchema;

// ── Authored schemas (tuning-history on disk) ──────────────────

export const AuthoredToughSchema = z.object({
  id: z.string(),
  kind: z.literal('tough'),
  name: z.string(),
  tagline: z.string().optional(),
  archetype: z.string(),
  affiliation: z.string(),
  power: StatHistorySchema,
  resistance: StatHistorySchema,
  maxHp: z.number().int().min(1).max(12),
  hp: z.number().int().min(1).max(12),
  rarity: RarityHistorySchema,
  abilities: z.array(z.string()),
  unlocked: z.boolean(),
  unlockCondition: z.string().nullable().optional(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
  draft: z.boolean().optional(),
});

export const AuthoredWeaponSchema = z.object({
  id: z.string(),
  kind: z.literal('weapon'),
  name: z.string(),
  category: WeaponCategoryEnum,
  power: StatHistorySchema,
  resistance: StatHistorySchema,
  rarity: RarityHistorySchema,
  abilities: z.array(z.string()),
  unlocked: z.boolean(),
  unlockCondition: z.string().nullable().optional(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
  draft: z.boolean().optional(),
});

export const AuthoredDrugSchema = z.object({
  id: z.string(),
  kind: z.literal('drug'),
  name: z.string(),
  category: DrugCategoryEnum,
  power: StatHistorySchema,
  resistance: StatHistorySchema,
  rarity: RarityHistorySchema,
  abilities: z.array(z.string()),
  unlocked: z.boolean(),
  unlockCondition: z.string().nullable().optional(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
  draft: z.boolean().optional(),
});

export const AuthoredCurrencySchema = z.object({
  id: z.string(),
  kind: z.literal('currency'),
  name: z.string(),
  denomination: z.union([z.literal(100), z.literal(1000)]),
  rarity: RarityHistorySchema,
  abilities: z.array(z.string()).optional(),
  unlocked: z.boolean(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
  draft: z.boolean().optional(),
});

// ── Compiled schemas (runtime flat values) ─────────────────────

export const CompiledToughSchema = z.object({
  kind: z.literal('tough'),
  id: z.string(),
  name: z.string(),
  tagline: z.string().optional(),
  archetype: z.string(),
  affiliation: z.string(),
  power: z.number().int().min(1).max(12),
  resistance: z.number().int().min(1).max(12),
  maxHp: z.number().int().min(1).max(12),
  hp: z.number().int().min(1).max(12),
  rarity: RaritySchema,
  abilities: z.array(z.string()),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
});

export const CompiledWeaponSchema = z.object({
  kind: z.literal('weapon'),
  id: z.string(),
  name: z.string(),
  category: WeaponCategoryEnum,
  power: z.number().int().min(1).max(12),
  resistance: z.number().int().min(1).max(12),
  rarity: RaritySchema,
  abilities: z.array(z.string()),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
});

export const CompiledDrugSchema = z.object({
  kind: z.literal('drug'),
  id: z.string(),
  name: z.string(),
  category: DrugCategoryEnum,
  power: z.number().int().min(1).max(12),
  resistance: z.number().int().min(1).max(12),
  rarity: RaritySchema,
  abilities: z.array(z.string()),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
});

export const CompiledCurrencySchema = z.object({
  kind: z.literal('currency'),
  id: z.string(),
  name: z.string(),
  denomination: z.union([z.literal(100), z.literal(1000)]),
  rarity: RaritySchema,
  abilities: z.array(z.string()).optional(),
  unlocked: z.boolean(),
  locked: z.boolean(),
  portrait: NonMythicPortraitSchema,
});

// ── Mythic schemas (§11) ──────────────────────────────────────
//
// Mythics mirror ToughCard but lock rarity at 'mythic'. Authored via the
// same tuning-history format as other toughs; compiled to flat values.
// `mythic_signature` carries design-side documentation (description +
// balance notes) and is preserved onto the compiled record so tooling
// and UI can surface it without re-reading raw JSON.

export const MythicSignatureSchema = z.object({
  description: z.string(),
  balance_note: z.string().optional(),
});

export const AuthoredMythicSchema = z.object({
  id: z.string(),
  kind: z.literal('tough'),
  name: z.string(),
  tagline: z.string().optional(),
  archetype: z.string(),
  affiliation: z.string(),
  power: StatHistorySchema,
  resistance: StatHistorySchema,
  maxHp: z.number().int().min(1).max(12),
  hp: z.number().int().min(1).max(12),
  rarity: z.array(z.literal('mythic')).min(1),
  abilities: z.array(z.string()),
  mythic_signature: MythicSignatureSchema.optional(),
  unlocked: z.boolean(),
  unlockCondition: z.string().nullable().optional(),
  locked: z.boolean(),
  portrait: MythicPortraitSchema,
  draft: z.boolean().optional(),
});

export const CompiledMythicSchema = z.object({
  kind: z.literal('tough'),
  id: z.string(),
  name: z.string(),
  tagline: z.string().optional(),
  archetype: z.string(),
  affiliation: z.string(),
  power: z.number().int().min(1).max(12),
  resistance: z.number().int().min(1).max(12),
  maxHp: z.number().int().min(1).max(12),
  hp: z.number().int().min(1).max(12),
  rarity: z.literal('mythic'),
  abilities: z.array(z.string()),
  mythic_signature: MythicSignatureSchema.optional(),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
  portrait: MythicPortraitSchema,
});

export const CompiledCardSchema = z.discriminatedUnion('kind', [
  CompiledToughSchema,
  CompiledWeaponSchema,
  CompiledDrugSchema,
  CompiledCurrencySchema,
]);

// ── Legacy compatibility schemas ───────────────────────────────
// Used by archetype/affiliation pool loaders — unchanged from v0.1

export const ArchetypeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ability: z.string(),
  abilityText: z.string(),
  targets: z.enum(['vanguard', 'hand', 'draw_pile', 'self', 'any']),
  timing: z.enum(['on_attack', 'on_sacrifice', 'on_play', 'passive']),
  powerMod: z.number().int(),
});

export const AffiliationSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string(),
  loyal: z.array(z.string()),
  rival: z.array(z.string()),
  neutral: z.array(z.string()),
  mediator: z.array(z.string()),
});

// ── Helpers ────────────────────────────────────────────────────

export function latestStat(history: readonly number[]): number {
  if (history.length === 0) {
    throw new Error('latestStat: history array is empty');
  }
  return history[history.length - 1];
}

export type Rarity = z.infer<typeof RaritySchema>;

export function latestRarity(history: readonly Rarity[]): Rarity {
  const rarity = history[history.length - 1];
  if (rarity === undefined) {
    throw new Error('latestRarity: history array is empty');
  }
  return rarity;
}

// ── Inferred types ─────────────────────────────────────────────

export type ArchetypeData = z.infer<typeof ArchetypeSchema>;
export type AffiliationData = z.infer<typeof AffiliationSchema>;

export type AuthoredTough = z.infer<typeof AuthoredToughSchema>;
export type AuthoredWeapon = z.infer<typeof AuthoredWeaponSchema>;
export type AuthoredDrug = z.infer<typeof AuthoredDrugSchema>;
export type AuthoredCurrency = z.infer<typeof AuthoredCurrencySchema>;
export type AuthoredMythic = z.infer<typeof AuthoredMythicSchema>;
export type PortraitConfig = z.infer<typeof PortraitSchema>;

export type CompiledTough = z.infer<typeof CompiledToughSchema>;
export type CompiledWeapon = z.infer<typeof CompiledWeaponSchema>;
export type CompiledDrug = z.infer<typeof CompiledDrugSchema>;
export type CompiledCurrency = z.infer<typeof CompiledCurrencySchema>;
export type CompiledMythic = z.infer<typeof CompiledMythicSchema>;
export type CompiledCard = z.infer<typeof CompiledCardSchema>;
export type MythicSignature = z.infer<typeof MythicSignatureSchema>;
