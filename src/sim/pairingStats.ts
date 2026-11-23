/**
 * Exact odds for the dice-pairing experiment: 4 dice of 1 red, 1 blue, 2 green and 2 yellow faces,
 * split into two pairs of different colors, at most 3 streams a run, plus the four-of-a-kind jackpot.
 * Compare with `npm run stats` for Can't Stop.
 * Run with: npm run stats:pairing
 */
import { FILE_AVAILABILITY } from '../game/board';
import { REFERENCE_DICE } from '../game/difficulty';
import { FILE_IDS, type FileId } from '../game/files';
import { MAX_STREAMS, chanceAnyPairFor, jackpotChance, survivalChance } from '../game/pairing';

function percent(chance: number): string {
  return `${(chance * 100).toFixed(1).padStart(5)}%`;
}

function combinations(size: number): FileId[][] {
  const pick = (start: number, chosen: FileId[]): FileId[][] =>
    chosen.length === size
      ? [chosen]
      : FILE_IDS.slice(start).flatMap((id, offset) => pick(start + offset + 1, [...chosen, id]));
  return pick(0, []);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[Math.floor(middle)];
}

console.log('Each file: chance it is in at least one of the three splits');
for (const id of FILE_IDS) console.log(`  ${id}  ${percent(FILE_AVAILABILITY[id])}`);
console.log(`\nJackpot (all four dice the same color): ${percent(jackpotChance(REFERENCE_DICE))}`);

console.log(`\n${MAX_STREAMS} open streams: chance the next roll is not a miss (pairs only / with the jackpot)`);
const rows = combinations(MAX_STREAMS)
  .map((files) => ({
    files,
    pairs: chanceAnyPairFor(REFERENCE_DICE, files),
    withJackpot: survivalChance(REFERENCE_DICE, { streams: files, fullFiles: [] }),
  }))
  .sort((a, b) => b.pairs - a.pairs);
for (const row of rows) console.log(`  ${row.files.join(' + ').padEnd(14)} ${percent(row.pairs)}  ${percent(row.withJackpot)}`);
console.log(`  median        ${percent(median(rows.map((row) => row.pairs)))}  ${percent(median(rows.map((row) => row.withJackpot)))}`);
