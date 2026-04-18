#!/usr/bin/env bash
set -euo pipefail

cd /Users/jbogaty/src/arcade-cabinet/mean-streets

echo "=== Running benchmark (ci profile, 512 games) ==="
pnpm run analysis:benchmark 2>&1

# The benchmark outputs its own summary; we need to parse the last run.log
# Parse from the output — the CLI prints winRateA, timeoutRate, avgTurns
# Extract from output captured by redirect in outer loop
