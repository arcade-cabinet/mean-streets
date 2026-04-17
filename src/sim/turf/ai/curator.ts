// v0.3 pre-war collection curator. Runs before each war to:
//   1. Enable / disable CardInstances for the war's deck pool.
//   2. Assign 1-10 priority scores (higher = more likely early draw).
//   3. Recommend merges (two same-cardId same-rarity → next tier).
// Pure function: takes the player's owned instances + opponent tier +
// pool reference, returns a CurationResult. No state mutation here.
import type { TurfCardPools } from '../catalog';
import type {
  CardInstance,
  DifficultyTier,
  Rarity,
  ToughCard,
} from '../types';

export interface CurationMergeRecommendation {
  from: [string, string]; // two CardInstance ids to consume
  toRarity: Rarity;
  toUnlockDifficulty: DifficultyTier;
}

export interface CurationResult {
  enabled: string[]; // CardInstance ids to include in this war's deck
  disabled: string[]; // CardInstance ids to exclude
  priorities: Record<string, number>; // instanceId -> 1..10 priority
  mergeRecommendations: CurationMergeRecommendation[];
}

const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'legendary',
  'mythic',
];

function nextRarity(r: Rarity): Rarity | null {
  const idx = RARITY_ORDER.indexOf(r);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

// Instance ids are assumed unique; callers (pack opener, collection)
// must stamp them. We use `${cardId}#${rolledRarity}#${n}` in the ECS.
function instanceId(inst: CardInstance, idx: number): string {
  return `${inst.cardId}#${inst.rolledRarity}#${idx}`;
}

function basePriorityFromRarity(rarity: Rarity): number {
  switch (rarity) {
    case 'mythic':
      return 10;
    case 'legendary':
      return 8;
    case 'rare':
      return 6;
    case 'uncommon':
      return 4;
    default:
      return 2;
  }
}

function findInPool(
  pools: TurfCardPools,
  cardId: string,
): ToughCard | null {
  for (const t of pools.crew) if (t.id === cardId) return t;
  return null;
}

// A tough with a known signature ability gets +1 priority.
const SIGNATURE_ABILITIES = new Set<string>([
  'IMMUNITY',
  'TRANSCEND',
  'STRIKE_TWO',
  'CHAIN_THREE',
  'ABSOLUTE',
  'INSIGHT',
  'LAUNDER',
  'LOW_PROFILE',
  'NO_REVEAL',
]);

function priorityBump(inst: CardInstance, pools: TurfCardPools): number {
  const tough = findInPool(pools, inst.cardId);
  if (!tough) return 0;
  return tough.abilities.some((a) => SIGNATURE_ABILITIES.has(a)) ? 1 : 0;
}

// Greedy merge pairs: same cardId + same rolledRarity, not mythic.
function collectMerges(
  instances: CardInstance[],
  opponentDifficulty: DifficultyTier,
): { consumedIdx: Set<number>; recs: CurationMergeRecommendation[] } {
  const byKey = new Map<string, number[]>(); // key=id+rarity → indices
  for (let i = 0; i < instances.length; i++) {
    const ins = instances[i];
    if (ins.rolledRarity === 'mythic') continue;
    const key = `${ins.cardId}|${ins.rolledRarity}`;
    const arr = byKey.get(key);
    if (arr) arr.push(i);
    else byKey.set(key, [i]);
  }
  const consumedIdx = new Set<number>();
  const recs: CurationMergeRecommendation[] = [];
  for (const [_key, idxs] of byKey.entries()) {
    let i = 0;
    while (i + 1 < idxs.length) {
      const a = idxs[i];
      const b = idxs[i + 1];
      const aInst = instances[a];
      const next = nextRarity(aInst.rolledRarity);
      if (!next) break;
      consumedIdx.add(a);
      consumedIdx.add(b);
      recs.push({
        from: [instanceId(aInst, a), instanceId(instances[b], b)],
        toRarity: next,
        toUnlockDifficulty: opponentDifficulty,
      });
      i += 2;
    }
  }
  return { consumedIdx, recs };
}

export function curateCollection(
  collection: CardInstance[],
  opponentDifficulty: DifficultyTier,
  pools: TurfCardPools,
): CurationResult {
  const enabled: string[] = [];
  const disabled: string[] = [];
  const priorities: Record<string, number> = {};

  // 1. Merge pass first — consumed instances are auto-disabled.
  const merges = collectMerges(collection, opponentDifficulty);

  // 2. Per-instance enable/disable + priority.
  for (let i = 0; i < collection.length; i++) {
    const inst = collection[i];
    const id = instanceId(inst, i);
    if (merges.consumedIdx.has(i)) {
      disabled.push(id);
      priorities[id] = 0;
      continue;
    }
    // Enable everything else; priority scales with rolled rarity + ability.
    enabled.push(id);
    const base = basePriorityFromRarity(inst.rolledRarity);
    priorities[id] = Math.min(10, base + priorityBump(inst, pools));
  }

  return {
    enabled,
    disabled,
    priorities,
    mergeRecommendations: merges.recs,
  };
}
