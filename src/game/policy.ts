import { DUMPSHOCK_MINUTES } from './clock';
import type { Die } from './dice';
import { FILE_IDS, type FileId, fileIndex } from './files';
import { type StreamContext, forEachColorOutcome, splitOptions, streamsAfter, survivalChance } from './pairing';
import { type RunState, blocksAtRisk, liveServer, streamContext } from './run';
import { type Buffer, type Server, fullFiles, hasModifier, remainingSteps } from './server';

/**
 * The reference player drives the balance tools. Its numbers are rough first guesses and
 * have not been tuned: the dice-pairing experiment is being playtested by hand first.
 */
export const REFERENCE_RISK_APPETITE = 0.8;
/** How much the bot values keeping the next roll safe when it picks a split, in blocks. */
const SURVIVAL_WEIGHT_IN_BLOCKS = 2;
/** Rough minutes a block is worth; turns dumpshock time into blocks. */
const MINUTES_PER_BLOCK_ESTIMATE = 12;
const DUMPSHOCK_BLOCK_COST = (DUMPSHOCK_MINUTES.min + DUMPSHOCK_MINUTES.max) / 2 / MINUTES_PER_BLOCK_ESTIMATE;

export interface SplitPick {
  readonly splitIndex: number;
  readonly choiceIndex: number;
}

function bufferAfter(server: Server, buffer: Buffer, files: readonly FileId[]): Buffer {
  return files.reduce((next, file) => {
    const index = fileIndex(file);
    const room = remainingSteps(server.files[index], next[index]);
    return next.map((steps, position) => (position === index ? steps + Math.min(1, room) : steps));
  }, buffer);
}

function contextAfter(server: Server, buffer: Buffer, streams: readonly FileId[]): StreamContext {
  return { streams, fullFiles: fullFiles(server, buffer) };
}

/** Picks the split that adds the most progress (as a share of each file) while keeping the next roll safe. */
export function chooseReferenceSplit(run: RunState, server: Server, dice: readonly Die[]): SplitPick {
  if (run.lastRoll === null) throw new Error('No roll to choose from');
  const live = liveServer(server, run);
  let best: (SplitPick & { score: number }) | null = null;
  run.lastRoll.options.forEach((option, splitIndex) => {
    option.choices.forEach((files, choiceIndex) => {
      const progress = files.reduce((sum, file) => sum + 1 / live.files[fileIndex(file)].length, 0) * FILE_IDS.length;
      const buffer = bufferAfter(live, run.buffer, files);
      const safety = survivalChance(dice, contextAfter(live, buffer, streamsAfter(run.streams, files)));
      const score = progress + safety * SURVIVAL_WEIGHT_IN_BLOCKS;
      if (best === null || score > best.score) best = { splitIndex, choiceIndex, score };
    });
  });
  if (best === null) throw new Error('Asked to choose a split on a missed roll');
  return best;
}

/** Expected blocks from one more roll, taking the best split of each outcome. */
function expectedBlocks(context: StreamContext, dice: readonly Die[]): number {
  let total = 0;
  forEachColorOutcome(dice, (colors, chance) => {
    const most = Math.max(0, ...splitOptions(colors, context).flatMap((option) => option.choices.map((files) => files.length)));
    total += most * chance;
  });
  return total;
}

/** Reference push-your-luck rule used by the balance bots. */
export function shouldKeepRolling(run: RunState, server: Server, dice: readonly Die[], riskAppetite = REFERENCE_RISK_APPETITE): boolean {
  if (blocksAtRisk(run) === 0) return true;
  const context = streamContext(run, server);
  const missChance = 1 - survivalChance(dice, context);
  const iceLoss = hasModifier(server, 'blackIce') ? FILE_IDS.length : 0;
  const missCost = blocksAtRisk(run) + iceLoss + DUMPSHOCK_BLOCK_COST;
  return expectedBlocks(context, dice) * riskAppetite > missChance * missCost;
}
