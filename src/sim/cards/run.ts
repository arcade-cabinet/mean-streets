/**
 * Run character card balance simulation.
 * Usage: npx tsx src/sim/cards/run.ts [--games N]
 */

import { runAndSaveReport } from './balance';

const args = process.argv.slice(2);
const gamesIdx = args.indexOf('--games');
const numGames = gamesIdx >= 0 ? parseInt(args[gamesIdx + 1], 10) : 3000;

runAndSaveReport(numGames);
