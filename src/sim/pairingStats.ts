/**
 * Exact odds for the dice-pairing experiment: 4 standard dice (1 red, 2 blue, 3 green),
 * split into two pairs, at most 2 streams a run. Compare with `npm run stats` for Can't Stop.
 * Run with: npm run stats:pairing
 */
import { FILE_AVAILABILITY, MAX_TIER } from '../game/board';
import { REFERENCE_DICE } from '../game/difficulty';
import { FILE_IDS, type FileId } from '../game/files';
import { chanceAnyPairFor } from '../game/pairing';

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

function printSurvival(size: number, title: string): void {
  console.log(`\n${title}`);
  const rows = combinations(size)
    .map((files) => ({ files, chance: chanceAnyPairFor(REFERENCE_DICE, files) }))
    .sort((a, b) => b.chance - a.chance);
  for (const row of rows) console.log(`  ${row.files.join(' + ').padEnd(14)} ${percent(row.chance)}`);
}

console.log('Each file: chance it is in at least one of the three splits');
for (const id of FILE_IDS) console.log(`  ${id}  ${percent(FILE_AVAILABILITY[id])}`);
printSurvival(2, 'Two open streams (the rule): chance the next roll is not a miss');
printSurvival(3, 'Three files, for comparison with Can’t Stop’s three runners');
console.log(`\nTiers 1-${MAX_TIER}: see the length and price tables in docs/design-log.md`);
