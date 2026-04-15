import { describe, it, expect } from 'vitest';
import { parseCommand } from '../cli';

/**
 * Regression test for Bug K — `pnpm run analysis:benchmark -- --profile release`
 * previously took `release` (the flag value) as the command, so the default
 * 'benchmark' verb was never applied. parseCommand must skip flags AND their
 * values when looking for a positional verb.
 */
describe('parseCommand (Bug K regression)', () => {
  it('defaults to benchmark when argv is empty', () => {
    expect(parseCommand([])).toBe('benchmark');
  });

  it('defaults to benchmark for flags-only invocation', () => {
    expect(parseCommand(['--profile', 'release'])).toBe('benchmark');
  });

  it('defaults to benchmark for a flag with no value', () => {
    expect(parseCommand(['--dry-run'])).toBe('benchmark');
  });

  it('returns the first non-flag token as the command', () => {
    expect(parseCommand(['sweep', '--shape', 'crew_weapon'])).toBe('sweep');
  });

  it('treats verb-first invocations correctly', () => {
    expect(parseCommand(['lock', '--profile', 'release'])).toBe('lock');
    expect(parseCommand(['autobalance', '--dry-run'])).toBe('autobalance');
    expect(parseCommand(['focus', '--cards', 'card-001,drug-01'])).toBe('focus');
  });

  it('does not treat a flag value as a verb', () => {
    // The fix: `release` must NOT be interpreted as the command.
    expect(parseCommand(['--profile', 'release'])).not.toBe('release');
    expect(parseCommand(['--cards', 'card-001,drug-01'])).not.toBe('card-001,drug-01');
  });
});
