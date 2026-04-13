/**
 * Zod schemas for the character card system.
 * Single power stat + ability text + affiliation.
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

export type ArchetypeData = z.infer<typeof ArchetypeSchema>;
export type AffiliationData = z.infer<typeof AffiliationSchema>;
export type CharacterCard = z.infer<typeof CharacterCardSchema>;
export type WeaponCategoryData = z.infer<typeof WeaponCategorySchema>;
export type DrugCategoryData = z.infer<typeof DrugCategorySchema>;
