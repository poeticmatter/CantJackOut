import { DUMPSHOCK_MINUTES } from './clock';
import type { Die } from './dice';
import { FILE_IDS, type FileId, fileIndex } from './files';
import { type StreamContext, forEachColorOutcome, jackpotFiles, splitOptions, streamsAfter, survivalChance } from './pairing';
import { type RollChoice, type RollRecord, chosenFiles } from './roll';
import { type RunState, blocksAtRisk, liveServer, streamContext } from './run';
import { type Buffer, type Server, fullFiles, hasModifier, remainingSteps } from './server';

/**
 * The reference player drives the balance tools. Its numbers are rough first guesses and
 * have not been tuned: the dice-pairing experiment is being playtested by hand first.
 */
export const REFERENCE_RISK_APPETITE = 0.8;
/** How much the bot values keeping the next roll safe when it picks a move, in blocks. */
const SURVIVAL_WEIGHT_IN_BLOCKS = 2;
/** Rough minutes a block is worth; turns dumpshock time into blocks. */
const MINUTES_PER_BLOCK_ESTIMATE = 12;
const DUMPSHOCK_BLOCK_COST = (DUMPSHOCK_MINUTES.min + DUMPSHOCK_MINUTES.max) / 2 / MINUTES_PER_BLOCK_ESTIMATE;

function bufferAfter(server: Server, buffer: Buffer, files: readonly FileId[]): Buffer {
  return files.reduce((next, file) => {
    const index = fileIndex(file);
    const room = remainingSteps(server.files[index], next[index]);
    return next.map((steps, position) => (position === index ? steps + Math.min(1, room) : steps));
  }, buffer);
}

/** Every move the roll allows: each way to take each split, or each file a jackpot can feed. */
export function legalChoices(roll: RollRecord): RollChoice[] {
  const splits = roll.options.flatMap((option, splitIndex) =>
    option.choices.map((_, choiceIndex): RollChoice => ({ kind: 'split', splitIndex, choiceIndex })));
  const jackpots = roll.jackpotFiles.map((file): RollChoice => ({ kind: 'jackpot', file }));
  return [...splits, ...jackpots];
}

/** Picks the move that adds the most progress (as a share of each file) while keeping the next roll safe. */
export function chooseReferenceMove(run: RunState, server: Server, dice: readonly Die[]): RollChoice {
  const roll = run.lastRoll;
  if (roll === null) throw new Error('No roll to choose from');
  const live = liveServer(server, run);
  const scored = legalChoices(roll).map((choice) => {
    const files = chosenFiles(roll, choice);
    const progress = files.reduce((sum, file) => sum + 1 / live.files[fileIndex(file)].length, 0) * FILE_IDS.length;
    const buffer = bufferAfter(live, run.buffer, files);
    const context: StreamContext = { streams: streamsAfter(run.streams, files), fullFiles: fullFiles(live, buffer) };
    return { choice, score: progress + survivalChance(dice, context) * SURVIVAL_WEIGHT_IN_BLOCKS };
  });
  const best = scored.reduce<(typeof scored)[number] | null>((top, entry) => (top === null || entry.score > top.score ? entry : top), null);
  if (best === null) throw new Error('Asked to choose a move on a missed roll');
  return best.choice;
}

/** Expected blocks from one more roll, taking the biggest move each outcome allows. */
function expectedBlocks(context: StreamContext, dice: readonly Die[]): number {
  let total = 0;
  forEachColorOutcome(dice, (colors, chance) => {
    const splitBlocks = splitOptions(colors, context).flatMap((option) => option.choices.map((files) => files.length));
    const jackpotBlocks = jackpotFiles(colors, context).length > 0 ? 1 : 0;
    total += Math.max(0, jackpotBlocks, ...splitBlocks) * chance;
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
