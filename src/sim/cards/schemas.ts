/**
 * Zod schemas for the character card system.
 *
 * Two views:
 * - `Authored*` schemas: tuning-history form. Stat fields are arrays; last
 *   element is current. Autobalance appends a new value on each adjustment.
 * - Runtime schemas (`CharacterCardSchema`, `WeaponCategorySchema`,
 *   `DrugCategorySchema`): flat scalars. Produced by the build-time
 *   compile step.
 */

import { z } from 'zod';

export const ArchetypeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ability: z.string(),
  abilityText: z.string(),
  targets: z.enum(['vanguard', 'hand', 'reserves', 'draw_pile', 'self', 'any']),
  timing: z.enum(['on_attack', 'on_sacrifice', 'on_play', 'passive']),
  powerMod: z.number().int(),
});

export const AffiliationSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string(),
  atPeaceWith: z.array(z.string()),
  atWarWith: z.array(z.string()),
});

export const CharacterCardSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  archetype: z.string(),
  affiliation: z.string(),
  power: z.number().int().min(1).max(12),
  resistance: z.number().int().min(1).max(12),
  abilityText: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
});

export const WeaponCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  bonusMod: z.number().int().min(-1).max(1),
  names: z.array(z.string()).min(10),
});

export const DrugCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  potencyMod: z.number().int().min(-1).max(1),
  adjectives: z.array(z.string()).min(10),
  nouns: z.array(z.string()).min(10),
});

// ─────────────────────────────────────────────────────────────────────────
// Authored (tuning-history) schemas — the source of truth on disk
// ─────────────────────────────────────────────────────────────────────────

export const StatHistorySchema = z.array(z.number().int().min(1).max(12)).min(1);

export const AuthoredCrewSchema = z.object({
  id: z.string(),
  type: z.literal('crew'),
  displayName: z.string(),
  archetype: z.string(),
  affiliation: z.string(),
  power: StatHistorySchema,
  resistance: StatHistorySchema,
  abilityText: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().nullable().optional(),
  locked: z.boolean(),
  draft: z.boolean().optional(),
  tagline: z.string().optional(),
});

export const AuthoredWeaponSchema = z.object({
  id: z.string(),
  type: z.literal('weapon'),
  name: z.string(),
  category: z.enum(['bladed', 'blunt', 'explosive', 'ranged', 'stealth']),
  bonus: z.array(z.number().int().min(1).max(8)).min(1),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().nullable().optional(),
  locked: z.boolean(),
  draft: z.boolean().optional(),
});

export const AuthoredDrugSchema = z.object({
  id: z.string(),
  type: z.literal('product'),
  name: z.string(),
  category: z.enum(['stimulant', 'sedative', 'hallucinogen', 'steroid', 'narcotic']),
  potency: z.array(z.number().int().min(1).max(8)).min(1),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().nullable().optional(),
  locked: z.boolean(),
  draft: z.boolean().optional(),
});

export const CardSpecialSchema = z.object({
  backpack: z.object({
    id: z.string(),
    type: z.literal('special'),
    slots: z.number().int().positive(),
    deployableTo: z.string(),
    transferRule: z.string(),
    freeSwapOnEquip: z.boolean(),
    description: z.string(),
    draft: z.boolean().optional(),
    locked: z.boolean(),
  }),
  cash: z.object({
    id: z.string(),
    type: z.literal('special'),
    description: z.string(),
    denominations: z
      .array(
        z.object({
          id: z.string(),
          value: z.number().int().positive(),
          displayName: z.string(),
          locked: z.boolean(),
        }),
      )
      .min(1),
    draft: z.boolean().optional(),
    locked: z.boolean(),
  }),
});

// ─────────────────────────────────────────────────────────────────────────
// Compiled schemas (runtime flat scalars)
// ─────────────────────────────────────────────────────────────────────────

export const CompiledCrewSchema = CharacterCardSchema.extend({
  type: z.literal('crew'),
  tagline: z.string().optional(),
});

export const CompiledWeaponSchema = z.object({
  id: z.string(),
  type: z.literal('weapon'),
  name: z.string(),
  category: z.enum(['bladed', 'blunt', 'explosive', 'ranged', 'stealth']),
  bonus: z.number().int().min(1).max(8),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
});

export const CompiledDrugSchema = z.object({
  id: z.string(),
  type: z.literal('product'),
  name: z.string(),
  category: z.enum(['stimulant', 'sedative', 'hallucinogen', 'steroid', 'narcotic']),
  potency: z.number().int().min(1).max(8),
  offenseAbility: z.string(),
  offenseAbilityText: z.string(),
  defenseAbility: z.string(),
  defenseAbilityText: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
  locked: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Return the last element of a tuning-history stat array. */
export function latestStat(history: readonly number[]): number {
  if (history.length === 0) {
    throw new Error('latestStat: history array is empty');
  }
  return history[history.length - 1];
}

export type ArchetypeData = z.infer<typeof ArchetypeSchema>;
export type AffiliationData = z.infer<typeof AffiliationSchema>;
export type CharacterCard = z.infer<typeof CharacterCardSchema>;
export type WeaponCategoryData = z.infer<typeof WeaponCategorySchema>;
export type DrugCategoryData = z.infer<typeof DrugCategorySchema>;

export type AuthoredCrew = z.infer<typeof AuthoredCrewSchema>;
export type AuthoredWeapon = z.infer<typeof AuthoredWeaponSchema>;
export type AuthoredDrug = z.infer<typeof AuthoredDrugSchema>;
export type CardSpecial = z.infer<typeof CardSpecialSchema>;

export type CompiledCrew = z.infer<typeof CompiledCrewSchema>;
export type CompiledWeapon = z.infer<typeof CompiledWeaponSchema>;
export type CompiledDrug = z.infer<typeof CompiledDrugSchema>;
