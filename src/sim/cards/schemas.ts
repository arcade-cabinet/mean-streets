/**
 * Zod schemas for the character card system.
 * Individual named characters with archetypes and affiliations.
 */

import { z } from 'zod';

export const ArchetypeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ability: z.string(),
  abilityDesc: z.string(),
  statBias: z.object({
    atkMod: z.number().int(),
    defMod: z.number().int(),
  }),
  dayNightShift: z.enum(['neutral', 'day_strong', 'night_strong']),
});

export const AffiliationModSchema = z.object({
  atkBonus: z.number().int(),
  defBonus: z.number().int(),
  special: z.string().optional(),
});

export const AffiliationSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string(),
  atPeaceWith: z.array(z.string()),
  atWarWith: z.array(z.string()),
  modifier: AffiliationModSchema,
});

export const CharacterCardSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  nickname: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string(),
  archetype: z.string(),
  affiliation: z.string(),
  tier: z.number().int().min(1).max(5),
  dayAtk: z.number().int().min(0).max(15),
  dayDef: z.number().int().min(1).max(15),
  nightAtk: z.number().int().min(0).max(15),
  nightDef: z.number().int().min(1).max(15),
  ability: z.string(),
  abilityDesc: z.string(),
  unlocked: z.boolean(),
  unlockCondition: z.string().optional(),
});

export type ArchetypeData = z.infer<typeof ArchetypeSchema>;
export type AffiliationData = z.infer<typeof AffiliationSchema>;
export type CharacterCard = z.infer<typeof CharacterCardSchema>;
