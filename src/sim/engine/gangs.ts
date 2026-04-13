/**
 * Gang loader — reads JSON gang definitions, validates with Zod,
 * and provides a registry for lookup by ID.
 */

import { GangSchema, type GangData } from '../schemas';

import knucklesData from '../../data/gangs/knuckles.json';
import chainsData from '../../data/gangs/chains.json';

const RAW_GANGS = [knucklesData, chainsData];

/** Validated gang registry indexed by gang ID. */
const gangRegistry = new Map<string, GangData>();

/** Validation errors encountered during loading. */
const validationErrors: string[] = [];

// Validate and register all gangs at module load time.
for (const raw of RAW_GANGS) {
  const result = GangSchema.safeParse(raw);
  if (result.success) {
    gangRegistry.set(result.data.id, result.data);
  } else {
    const id = (raw as Record<string, unknown>).id ?? 'unknown';
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`);
    validationErrors.push(`Gang "${id}" failed validation:\n${issues.join('\n')}`);
  }
}

if (validationErrors.length > 0) {
  console.error('Gang validation errors:');
  validationErrors.forEach(e => console.error(e));
}

/** Get a validated gang definition by ID. Throws if not found. */
export function getGang(id: string): GangData {
  const gang = gangRegistry.get(id);
  if (!gang) {
    const available = [...gangRegistry.keys()].join(', ');
    throw new Error(`Gang "${id}" not found. Available: ${available}`);
  }
  return gang;
}

/** Get all registered gang IDs. */
export function getAllGangIds(): string[] {
  return [...gangRegistry.keys()];
}

/** Get all registered gangs. */
export function getAllGangs(): GangData[] {
  return [...gangRegistry.values()];
}

/** Check if a gang ID is registered. */
export function hasGang(id: string): boolean {
  return gangRegistry.has(id);
}

/** Register or replace a gang in the registry. Used by auto-balancer. */
export function registerGang(gang: GangData): void {
  gangRegistry.set(gang.id, gang);
}
