/**
 * Autobalance loop.
 *
 * Given a lock-state report over the card catalog, identifies unstable
 * (non-locked) authored cards and appends one tuning step (-1 or +1) to
 * their stat history arrays in config/raw/cards/. The direction of the
 * step is chosen to push the card toward stability:
 *
 *   - winRateDelta > 0  → card is too strong → nerf (−1)
 *   - winRateDelta < 0  → card is too weak   → buff (+1)
 *
 * Locked cards are never touched. Special cards (backpack, cash) are
 * not autobalanced. Cards that have already drifted to their stat floor
 * (value 1) or ceiling (value 12 for crew; 8 for weapons/drugs) are
 * left alone and reported as "clamped" rather than retried.
 *
 * After edits, the caller is expected to run the compile step and
 * optionally commit the raw-file diffs with `commitAutobalanceIteration`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { LockAnalysisReport } from './locking';
import type { EffectAnalysisReport, CardEffectEstimate } from './effects';
import { TURF_SIM_CONFIG } from '../turf/ai/config';

const AUTOBALANCE_CONFIG = (TURF_SIM_CONFIG as { autobalance?: { maxHistoryLength?: number } }).autobalance ?? {};
const DEFAULT_MAX_HISTORY = AUTOBALANCE_CONFIG.maxHistoryLength ?? 6;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const RAW_DIR = join(ROOT, 'config', 'raw', 'cards');

export interface AutobalanceEdit {
  cardId: string;
  cardType: 'crew' | 'weapon' | 'drug';
  file: string;
  stat: 'power' | 'resistance' | 'bonus' | 'potency';
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

// ── floors/ceilings by card type ─────────────────────────────────────

const CREW_MIN = 1;
const CREW_MAX = 12;
const MODIFIER_MIN = 1;
const MODIFIER_MAX = 8;

function clampCrew(value: number): number {
  return Math.max(CREW_MIN, Math.min(CREW_MAX, value));
}

function clampModifier(value: number): number {
  return Math.max(MODIFIER_MIN, Math.min(MODIFIER_MAX, value));
}

// ── raw-file discovery ───────────────────────────────────────────────

function crewFilePath(cardId: string): string {
  return join(RAW_DIR, 'toughs', `${cardId}.json`);
}

function weaponFilePath(cardId: string): string {
  return join(RAW_DIR, 'weapons', `${cardId}.json`);
}

function drugFilePath(cardId: string): string {
  return join(RAW_DIR, 'drugs', `${cardId}.json`);
}

function resolveCardFile(cardId: string): { type: 'crew' | 'weapon' | 'drug'; file: string } | null {
  if (cardId.startsWith('card-')) {
    const file = crewFilePath(cardId);
    if (existsSync(file)) return { type: 'crew', file };
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

// ── raw-file mutation ────────────────────────────────────────────────

function appendStat(file: string, statName: string, next: number): void {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const history = raw[statName];
  if (!Array.isArray(history)) {
    throw new Error(`${file}: expected ${statName} to be an array, got ${typeof history}`);
  }
  history.push(next);
  raw[statName] = history;
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
}

// ── direction chooser ────────────────────────────────────────────────

/**
 * Pick which primary stat to tune for a given unstable card and the
 * direction to tune it. Returns null if the card is already clamped.
 */
function planCrewEdit(
  effect: CardEffectEstimate,
  file: string,
): { stat: 'power' | 'resistance'; from: number; to: number; direction: 'buff' | 'nerf' } | null {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { power: number[]; resistance: number[] };
  const currentPower = raw.power[raw.power.length - 1];
  const currentRes = raw.resistance[raw.resistance.length - 1];
  const winDelta = effect.winRateDelta;
  const direction: 'buff' | 'nerf' = winDelta > 0 ? 'nerf' : 'buff';
  const step = direction === 'buff' ? +1 : -1;
  // Nudge power if the card fights more than it absorbs (direct + funded
  // deltas net positive); otherwise tune resistance.
  const offensive = effect.directDelta + effect.fundedDelta + effect.pushedDelta;
  if (offensive >= effect.reserveCrewDelta) {
    const to = clampCrew(currentPower + step);
    if (to === currentPower) return null;
    return { stat: 'power', from: currentPower, to, direction };
  }
  const to = clampCrew(currentRes + step);
  if (to === currentRes) return null;
  return { stat: 'resistance', from: currentRes, to, direction };
}

function planModifierEdit(
  effect: CardEffectEstimate,
  file: string,
  statName: 'bonus' | 'potency',
): { stat: 'bonus' | 'potency'; from: number; to: number; direction: 'buff' | 'nerf' } | null {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, number[]>;
  const history = raw[statName];
  const current = history[history.length - 1];
  const direction: 'buff' | 'nerf' = effect.winRateDelta > 0 ? 'nerf' : 'buff';
  const step = direction === 'buff' ? +1 : -1;
  const to = clampModifier(current + step);
  if (to === current) return null;
  return { stat: statName, from: current, to, direction };
}

// ── main tune pass ───────────────────────────────────────────────────

export interface AutobalanceOptions {
  /** When true, compute edits but don't write to disk. */
  dryRun?: boolean;
  /** Maximum number of cards to edit in a single iteration. Defaults to unlimited. */
  maxEdits?: number;
  /**
   * Maximum tuning-history entries per card. Once a card's stat array
   * reaches this length, autobalance stops tuning it (declares it
   * "tune-saturated"). Defaults to 6, matching ~3 buff/nerf cycles
   * before manual review is warranted.
   */
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

  const unstable = locks.recommendations.filter((r) => r.state === 'unstable');
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
    // Respect locked cards: never touch authored files that carry locked: true.
    const rawContent = JSON.parse(readFileSync(resolved.file, 'utf8')) as { locked?: boolean; power?: number[]; resistance?: number[]; bonus?: number[]; potency?: number[] };
    if (rawContent.locked === true) {
      result.skipped.push({ cardId: rec.cardId, reason: 'locked=true' });
      continue;
    }
    // Skip cards that have already been tuned past the saturation
    // threshold this session — prevents runaway buff/nerf loops on
    // cards the simple ±1 heuristic cannot stabilize.
    const maxHistory = opts.maxHistoryLength ?? DEFAULT_MAX_HISTORY;
    const longestHistory = Math.max(
      rawContent.power?.length ?? 0,
      rawContent.resistance?.length ?? 0,
      rawContent.bonus?.length ?? 0,
      rawContent.potency?.length ?? 0,
    );
    if (longestHistory >= maxHistory) {
      result.skipped.push({
        cardId: rec.cardId,
        reason: `tune-saturated (history >= ${maxHistory})`,
      });
      continue;
    }

    let plan: { stat: 'power' | 'resistance' | 'bonus' | 'potency'; from: number; to: number; direction: 'buff' | 'nerf' } | null = null;
    if (resolved.type === 'crew') {
      plan = planCrewEdit(effect, resolved.file);
    } else if (resolved.type === 'weapon') {
      plan = planModifierEdit(effect, resolved.file, 'bonus');
    } else if (resolved.type === 'drug') {
      plan = planModifierEdit(effect, resolved.file, 'potency');
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

// ── git commit helper ────────────────────────────────────────────────

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

  const add = spawnSync('git', ['add', 'config/raw/cards/'], { cwd: ROOT, encoding: 'utf8' });
  if (add.status !== 0) {
    return { committed: false, stderr: add.stderr };
  }
  const statusLine = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8' });
  if (!statusLine.stdout.trim()) {
    return { committed: false, stderr: 'no staged changes (compile step may have reverted edits)' };
  }
  const byCard = edits.map((e) => `${e.cardId}: ${e.stat} ${e.from}→${e.to} (${e.direction})`).join('\n');
  const subject = `chore(balance): iter ${opts.iteration} tuned ${edits.length} card${edits.length === 1 ? '' : 's'}`;
  const body = `${subject}\n\n${byCard}\n`;
  const commit = spawnSync(
    'git',
    ['commit', '-m', body],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (commit.status !== 0) {
    return { committed: false, stderr: commit.stderr };
  }
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return { committed: true, sha: rev.stdout.trim() };
}

// ── dirty-tree guard ─────────────────────────────────────────────────

export function gitWorkingTreeClean(): { clean: boolean; details?: string } {
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (status.status !== 0) {
    return { clean: false, details: status.stderr };
  }
  const out = status.stdout
    .split('\n')
    .filter((line) => {
      if (!line.trim()) return false;
      // Allow untracked analysis artifacts that the sim writes on every run.
      if (line.startsWith('??') && line.includes('sim/reports/')) return false;
      if (line.startsWith('??') && line.includes('config/compiled/')) return false;
      return true;
    })
    .join('\n');
  return { clean: out.length === 0, details: out || undefined };
}
