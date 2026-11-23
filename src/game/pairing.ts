import { COLORS, type Color, type Die, colorOdds } from './dice';
import { FILE_IDS, type FileId, fileForPair } from './files';

/** Like Can't Stop's runners: the files one run can work on. */
export const MAX_STREAMS = 3;
export const DICE_PER_ROLL = 4;

type DiePair = readonly [number, number];

/** The three ways to split four dice into two pairs. */
export const SPLIT_PATTERNS: readonly (readonly [DiePair, DiePair])[] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

/** What the run allows right now: its open streams, and files that can't take another block. */
export interface StreamContext {
  readonly streams: readonly FileId[];
  readonly fullFiles: readonly FileId[];
}

export interface SplitOption {
  /** Die indexes in each pair, in the same order as files. */
  readonly dicePairs: readonly [DiePair, DiePair];
  /** The file each pair matches, or null for two dice of the same color. */
  readonly files: readonly [FileId | null, FileId | null];
  /**
   * The ways this split can be applied: usually one, none if neither pair is usable, and two
   * when both pairs are usable alone but together would need more streams than the run has.
   * Each choice lists the files that get a block, the same file twice if both pairs match it.
   */
  readonly choices: readonly (readonly FileId[])[];
}

/** Whether the run could put a block in this file now: it's an open stream or a stream is free. */
export function canTakeBlock(file: FileId, context: StreamContext): boolean {
  if (context.fullFiles.includes(file)) return false;
  return context.streams.includes(file) || context.streams.length < MAX_STREAMS;
}

export function streamsAfter(streams: readonly FileId[], files: readonly FileId[]): FileId[] {
  return files.reduce<FileId[]>((open, file) => (open.includes(file) ? open : [...open, file]), [...streams]);
}

/** Files in a choice that would open a new stream. */
export function newStreams(streams: readonly FileId[], files: readonly FileId[]): FileId[] {
  return streamsAfter(streams, files).filter((file) => !streams.includes(file));
}

export function choicesForPairs(first: FileId | null, second: FileId | null, context: StreamContext): FileId[][] {
  const usable = [first, second].filter((file): file is FileId => file !== null && canTakeBlock(file, context));
  if (usable.length < 2) return usable.map((file) => [file]);
  const isBothAllowed = streamsAfter(context.streams, usable).length <= MAX_STREAMS;
  return isBothAllowed ? [usable] : usable.map((file) => [file]);
}

export function splitOptions(colors: readonly Color[], context: StreamContext): SplitOption[] {
  if (colors.length !== DICE_PER_ROLL) throw new Error(`A roll needs ${DICE_PER_ROLL} dice, got ${colors.length}`);
  return SPLIT_PATTERNS.map((dicePairs) => {
    const [[a, b], [c, d]] = dicePairs;
    const files = [fileForPair(colors[a], colors[b]), fileForPair(colors[c], colors[d])] as const;
    return { dicePairs, files, choices: choicesForPairs(files[0], files[1], context) };
  });
}

/** All four dice the same color: no pair works, but the player may put a block in any file they could reach. */
export function isJackpot(colors: readonly Color[]): boolean {
  return colors.every((color) => color === colors[0]);
}

/** The files a jackpot can feed: open streams that aren't full, and any other file if a stream is free. */
export function jackpotFiles(colors: readonly Color[], context: StreamContext): FileId[] {
  return isJackpot(colors) ? FILE_IDS.filter((file) => canTakeBlock(file, context)) : [];
}

export function isMiss(options: readonly SplitOption[], jackpot: readonly FileId[]): boolean {
  return jackpot.length === 0 && options.every((option) => option.choices.length === 0);
}

/** Calls visit once for every color each die could show, with that outcome's exact chance. */
export function forEachColorOutcome(dice: readonly Die[], visit: (colors: Color[], chance: number) => void): void {
  const odds = dice.map(colorOdds);
  const walk = (dieIndex: number, colors: Color[], chance: number) => {
    if (chance === 0) return;
    if (dieIndex === dice.length) {
      visit(colors, chance);
      return;
    }
    for (const color of COLORS) walk(dieIndex + 1, [...colors, color], chance * odds[dieIndex][color]);
  };
  walk(0, [], 1);
}

function exactChance(dice: readonly Die[], isWanted: (colors: Color[]) => boolean): number {
  let total = 0;
  forEachColorOutcome(dice, (colors, chance) => {
    if (isWanted(colors)) total += chance;
  });
  return total;
}

/** Exact chance the next roll isn't a miss, counting jackpots. */
export function survivalChance(dice: readonly Die[], context: StreamContext): number {
  return exactChance(dice, (colors) => !isMiss(splitOptions(colors, context), jackpotFiles(colors, context)));
}

/** Exact chance at least one split of a roll has a pair for any of these files. Jackpots not counted. */
export function chanceAnyPairFor(dice: readonly Die[], files: readonly FileId[]): number {
  return exactChance(dice, (colors) =>
    SPLIT_PATTERNS.some((pattern) => pattern.some(([a, b]) => {
      const file = fileForPair(colors[a], colors[b]);
      return file !== null && files.includes(file);
    })));
}

export function jackpotChance(dice: readonly Die[]): number {
  return exactChance(dice, isJackpot);
}
