/**
 * Exact statistics for the original Can't Stop (4d6, pairs summed, 3 runners),
 * used as the calibration target for Can't Jack Out's starting difficulty.
 * Run with: npm run stats
 */

const COLUMN_HEIGHTS: Record<number, number> = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};
const COLUMNS = Object.keys(COLUMN_HEIGHTS).map(Number);
const PAIRINGS: ReadonlyArray<readonly [[number, number], [number, number]]> = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

function allFourDiceRolls(): number[][] {
  const rolls: number[][] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      for (let c = 1; c <= 6; c++)
        for (let d = 1; d <= 6; d++) rolls.push([a, b, c, d]);
  return rolls;
}

function sumsAvailable(roll: number[]): Set<number> {
  const sums = new Set<number>();
  for (const [first, second] of PAIRINGS) {
    sums.add(roll[first[0]] + roll[first[1]]);
    sums.add(roll[second[0]] + roll[second[1]]);
  }
  return sums;
}

const ROLLS = allFourDiceRolls();
const ROLL_SUMS = ROLLS.map(sumsAvailable);

function hitProbability(columns: number[]): number {
  const hits = ROLL_SUMS.filter((sums) => columns.some((column) => sums.has(column))).length;
  return hits / ROLLS.length;
}

function printSingleColumnTable(): void {
  console.log('\nSingle column: chance a roll can advance it, and steps to claim it');
  for (const column of COLUMNS.filter((c) => c <= 7)) {
    const probability = hitProbability([column]);
    console.log(
      `  ${String(column).padStart(2)}/${String(14 - column).padEnd(2)}  ${(probability * 100).toFixed(1).padStart(5)}%   ${COLUMN_HEIGHTS[column]} steps`,
    );
  }
}

function printTripleSurvival(): void {
  const results: { columns: number[]; probability: number }[] = [];
  for (let i = 0; i < COLUMNS.length; i++)
    for (let j = i + 1; j < COLUMNS.length; j++)
      for (let k = j + 1; k < COLUMNS.length; k++) {
        const columns = [COLUMNS[i], COLUMNS[j], COLUMNS[k]];
        results.push({ columns, probability: hitProbability(columns) });
      }
  results.sort((a, b) => a.probability - b.probability);
  const mean = results.reduce((total, r) => total + r.probability, 0) / results.length;
  const median = results[Math.floor(results.length / 2)].probability;
  const describe = (r: { columns: number[]; probability: number }) =>
    `${r.columns.join('-')} ${(r.probability * 100).toFixed(1)}%`;
  console.log('\nThree runners placed: chance the next roll survives');
  console.log(`  worst  ${describe(results[0])}`);
  console.log(`  best   ${describe(results[results.length - 1])}`);
  console.log(`  median ${(median * 100).toFixed(1)}%   mean ${(mean * 100).toFixed(1)}%`);
}

printSingleColumnTable();
printTripleSurvival();
console.log('\nCan\'t Jack Out, 3 standard dice (1 red, 2 blue, 3 green faces):');
for (const [label, missFaces] of [['red', 5], ['blue', 4], ['green', 3], ['red+blue', 3], ['red+green', 2], ['blue+green', 1]] as const) {
  const hit = 1 - Math.pow(missFaces / 6, 3);
  console.log(`  ${label.padEnd(11)} ${(hit * 100).toFixed(1)}%`);
}

/**
 * Solo Can't Stop bot using Michael Keller's "rule of 28" stopping heuristic.
 * Measures how many turns a competent player needs per claimed column.
 */
const RULE_OF_28_LIMIT = 28;

function columnWeight(column: number): number {
  return Math.abs(column - 7) + 1;
}

interface SoloGameResult {
  turns: number;
  busts: number;
}

function playSoloGame(random: () => number): SoloGameResult {
  const banked: Record<number, number> = Object.fromEntries(COLUMNS.map((c) => [c, 0]));
  const isClaimed = (column: number) => banked[column] >= COLUMN_HEIGHTS[column];
  let turns = 0;
  let busts = 0;
  while (COLUMNS.filter(isClaimed).length < 3) {
    turns++;
    const runners = new Map<number, number>();
    let score = 0;
    let isBusted = false;
    for (;;) {
      const roll = [0, 0, 0, 0].map(() => 1 + Math.floor(random() * 6));
      const best = chooseBestPairing(roll, runners, banked);
      if (best.length === 0) {
        isBusted = true;
        break;
      }
      for (const column of best) {
        const isNewRunner = !runners.has(column);
        runners.set(column, (runners.get(column) ?? banked[column]) + 1);
        score += columnWeight(column) * (isNewRunner ? 2 : 1);
      }
      const isAnyRunnerAtTop = [...runners].some(([column, position]) => position >= COLUMN_HEIGHTS[column]);
      if ((runners.size === 3 && score >= RULE_OF_28_LIMIT) || isAnyRunnerAtTop) break;
    }
    if (isBusted) busts++;
    else for (const [column, position] of runners) banked[column] = Math.min(position, COLUMN_HEIGHTS[column]);
  }
  return { turns, busts };
}

function chooseBestPairing(roll: number[], runners: Map<number, number>, banked: Record<number, number>): number[] {
  let best: number[] = [];
  let bestValue = -Infinity;
  for (const pairing of PAIRINGS) {
    const sums = pairing.map(([a, b]) => roll[a] + roll[b]);
    const usable = usableColumns(sums, runners, banked);
    const value = usable.reduce((total, column) => total + (runners.has(column) ? 3 : 1) / COLUMN_HEIGHTS[column], 0);
    if (usable.length > 0 && value > bestValue) {
      best = usable;
      bestValue = value;
    }
  }
  return best;
}

function usableColumns(sums: number[], runners: Map<number, number>, banked: Record<number, number>): number[] {
  const usable: number[] = [];
  const trial = new Map(runners);
  for (const column of sums) {
    const position = trial.get(column) ?? banked[column];
    if (position >= COLUMN_HEIGHTS[column]) continue;
    if (!trial.has(column) && trial.size >= 3) continue;
    trial.set(column, position + 1);
    usable.push(column);
  }
  return usable;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GAMES = 20000;
const random = mulberry32(28);
let totalTurns = 0;
let totalBusts = 0;
for (let game = 0; game < GAMES; game++) {
  const result = playSoloGame(random);
  totalTurns += result.turns;
  totalBusts += result.busts;
}
console.log(`\nSolo rule-of-28 bot over ${GAMES} games:`);
console.log(`  turns to claim 3 columns: ${(totalTurns / GAMES).toFixed(2)}  (${(totalTurns / GAMES / 3).toFixed(2)} turns per column)`);
console.log(`  turns that bust: ${((totalBusts / totalTurns) * 100).toFixed(1)}%`);
