import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { LockAnalysisReport } from './locking';
import type { EffectAnalysisReport, CardEffectEstimate } from './effects';
import { TURF_SIM_CONFIG } from '../turf/ai/config';

const AUTOBALANCE_CONFIG = (
  TURF_SIM_CONFIG as { autobalance?: { maxHistoryLength?: number } }
).autobalance ?? {};
const DEFAULT_MAX_HISTORY = AUTOBALANCE_CONFIG.maxHistoryLength ?? 8;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');

export interface AutobalanceEdit {
  cardId: string;
  cardType: 'tough' | 'weapon' | 'drug';
  file: string;
  stat: 'power' | 'resistance';
  from: number;
  to: number;
  direction: 'buff' | 'nerf';
  reason: string;
}

export interface AutobalanceResult {
  edits: AutobalanceEdit[];
  skipped: Array<{ cardId: string; reason: string }>;
  clamped: AutobalanceEdit[];
}

const TOUGH_MIN = 1;
const TOUGH_MAX = 12;
const MODIFIER_MIN = 1;
const MODIFIER_MAX = 8;

function clampTough(value: number): number {
  return Math.max(TOUGH_MIN, Math.min(TOUGH_MAX, value));
}

function clampModifier(value: number): number {
  return Math.max(MODIFIER_MIN, Math.min(MODIFIER_MAX, value));
}

function toughFilePath(cardId: string): string {
  return join(RAW_DIR, 'toughs', `${cardId}.json`);
}

function weaponFilePath(cardId: string): string {
  return join(RAW_DIR, 'weapons', `${cardId}.json`);
}

function drugFilePath(cardId: string): string {
  return join(RAW_DIR, 'drugs', `${cardId}.json`);
}

function resolveCardFile(
  cardId: string,
): { type: 'tough' | 'weapon' | 'drug'; file: string } | null {
  if (cardId.startsWith('card-')) {
    const file = toughFilePath(cardId);
    if (existsSync(file)) return { type: 'tough', file };
  }
  if (cardId.startsWith('weap-')) {
    const file = weaponFilePath(cardId);
    if (existsSync(file)) return { type: 'weapon', file };
  }
  if (cardId.startsWith('drug-')) {
    const file = drugFilePath(cardId);
    if (existsSync(file)) return { type: 'drug', file };
  }
  return null;
}

function appendStat(file: string, statName: string, next: number): void {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const history = raw[statName];
  if (!Array.isArray(history)) {
    throw new Error(
      `${file}: expected ${statName} to be an array, got ${typeof history}`,
    );
  }
  history.push(next);
  raw[statName] = history;
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
}

function planToughEdit(
  effect: CardEffectEstimate,
  file: string,
): { stat: 'power' | 'resistance'; from: number; to: number; direction: 'buff' | 'nerf' } | null {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as {
    power: number[];
    resistance: number[];
  };
  const currentPower = raw.power[raw.power.length - 1];
  const currentRes = raw.resistance[raw.resistance.length - 1];
  const direction: 'buff' | 'nerf' = effect.winRateDelta > 0 ? 'nerf' : 'buff';
  const step = direction === 'buff' ? +1 : -1;
  const offensive = effect.directDelta + effect.fundedDelta + effect.pushedDelta;
  if (offensive >= 0) {
    const to = clampTough(currentPower + step);
    if (to === currentPower) return null;
    return { stat: 'power', from: currentPower, to, direction };
  }
  const to = clampTough(currentRes + step);
  if (to === currentRes) return null;
  return { stat: 'resistance', from: currentRes, to, direction };
}

function planModifierEdit(
  effect: CardEffectEstimate,
  file: string,
): { stat: 'power' | 'resistance'; from: number; to: number; direction: 'buff' | 'nerf' } | null {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as {
    power: number[];
    resistance: number[];
  };
  const currentPower = raw.power[raw.power.length - 1];
  const currentRes = raw.resistance[raw.resistance.length - 1];
  const direction: 'buff' | 'nerf' = effect.winRateDelta > 0 ? 'nerf' : 'buff';
  const step = direction === 'buff' ? +1 : -1;
  // Mirror planToughEdit: tune the offense-oriented stat if the card's
  // contribution shows up on the offensive side of the ledger, otherwise
  // tune resistance. This keeps a defense-oriented weapon/drug from being
  // rebalanced only via its power stat.
  const offensive = effect.directDelta + effect.fundedDelta + effect.pushedDelta;
  if (offensive >= 0) {
    const to = clampModifier(currentPower + step);
    if (to === currentPower) return null;
    return { stat: 'power', from: currentPower, to, direction };
  }
  const to = clampModifier(currentRes + step);
  if (to === currentRes) return null;
  return { stat: 'resistance', from: currentRes, to, direction };
}

export interface AutobalanceOptions {
  dryRun?: boolean;
  maxEdits?: number;
  maxHistoryLength?: number;
}

export function runAutobalanceIteration(
  locks: LockAnalysisReport,
  effects: EffectAnalysisReport,
  opts: AutobalanceOptions = {},
): AutobalanceResult {
  const result: AutobalanceResult = { edits: [], skipped: [], clamped: [] };
  const effectById = new Map<string, CardEffectEstimate>();
  for (const e of effects.cardEffects) effectById.set(e.cardId, e);

  const unstable = locks.recommendations.filter(r => r.state === 'unstable');
  for (const rec of unstable) {
    if (opts.maxEdits !== undefined && result.edits.length >= opts.maxEdits) break;
    const effect = effectById.get(rec.cardId);
    if (!effect) {
      result.skipped.push({ cardId: rec.cardId, reason: 'no effect estimate' });
      continue;
    }
    const resolved = resolveCardFile(rec.cardId);
    if (!resolved) {
      result.skipped.push({ cardId: rec.cardId, reason: 'raw file not found' });
      continue;
    }
    const rawContent = JSON.parse(readFileSync(resolved.file, 'utf8')) as {
      locked?: boolean;
      power?: number[];
      resistance?: number[];
    };
    if (rawContent.locked === true) {
      result.skipped.push({ cardId: rec.cardId, reason: 'locked=true' });
      continue;
    }
    const maxHistory = opts.maxHistoryLength ?? DEFAULT_MAX_HISTORY;
    const longestHistory = Math.max(
      rawContent.power?.length ?? 0,
      rawContent.resistance?.length ?? 0,
    );
    if (longestHistory >= maxHistory) {
      result.skipped.push({
        cardId: rec.cardId,
        reason: `tune-saturated (history >= ${maxHistory})`,
      });
      continue;
    }

    let plan: {
      stat: 'power' | 'resistance';
      from: number;
      to: number;
      direction: 'buff' | 'nerf';
    } | null = null;

    if (resolved.type === 'tough') {
      plan = planToughEdit(effect, resolved.file);
    } else {
      plan = planModifierEdit(effect, resolved.file);
    }

    if (!plan) {
      result.clamped.push({
        cardId: rec.cardId,
        cardType: resolved.type,
        file: resolved.file,
        stat: 'power',
        from: 0,
        to: 0,
        direction: 'buff',
        reason: 'clamped at stat floor/ceiling',
      });
      continue;
    }

    const edit: AutobalanceEdit = {
      cardId: rec.cardId,
      cardType: resolved.type,
      file: resolved.file,
      stat: plan.stat,
      from: plan.from,
      to: plan.to,
      direction: plan.direction,
      reason: rec.reasons.join('; '),
    };
    if (!opts.dryRun) {
      appendStat(resolved.file, plan.stat, plan.to);
    }
    result.edits.push(edit);
  }
  return result;
}

export interface CommitOptions {
  iteration: number;
  dryRun?: boolean;
}

export function commitAutobalanceIteration(
  edits: AutobalanceEdit[],
  opts: CommitOptions,
): { committed: boolean; sha?: string; stderr?: string } {
  if (edits.length === 0) return { committed: false };
  if (opts.dryRun) return { committed: false };

  const add = spawnSync('git', ['add', 'config/raw/cards/'], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (add.status !== 0) {
    return { committed: false, stderr: add.stderr };
  }
  const statusLine = spawnSync('git', ['diff', '--cached', '--name-only'], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (!statusLine.stdout.trim()) {
    return { committed: false, stderr: 'no staged changes' };
  }
  const byCard = edits
    .map(e => `${e.cardId}: ${e.stat} ${e.from}→${e.to} (${e.direction})`)
    .join('\n');
  const subject = `chore(balance): iter ${opts.iteration} tuned ${edits.length} card${edits.length === 1 ? '' : 's'}`;
  const body = `${subject}\n\n${byCard}\n`;
  const commit = spawnSync('git', ['commit', '-m', body], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (commit.status !== 0) {
    return { committed: false, stderr: commit.stderr };
  }
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT, encoding: 'utf8',
  });
  return { committed: true, sha: rev.stdout.trim() };
}

export function gitWorkingTreeClean(): {
  clean: boolean;
  details?: string;
} {
  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (status.status !== 0) {
    return { clean: false, details: status.stderr };
  }
  const out = status.stdout
    .split('\n')
    .filter(line => {
      if (!line.trim()) return false;
      if (line.startsWith('??') && line.includes('sim/reports/')) return false;
      if (line.startsWith('??') && line.includes('config/compiled/')) return false;
      return true;
    })
    .join('\n');
  return { clean: out.length === 0, details: out || undefined };
}
