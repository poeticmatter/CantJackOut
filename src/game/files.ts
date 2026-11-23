import { COLORS, type Color } from './dice';

/**
 * Every server holds one file per pair of two different colors; the order here is the order on
 * screen. Two dice of the same color never make a pair.
 */
export const FILE_IDS = ['RB', 'RG', 'RY', 'BG', 'BY', 'GY'] as const;
export type FileId = (typeof FILE_IDS)[number];

export const FILE_COLORS: Record<FileId, readonly [Color, Color]> = {
  RB: ['red', 'blue'],
  RG: ['red', 'green'],
  RY: ['red', 'yellow'],
  BG: ['blue', 'green'],
  BY: ['blue', 'yellow'],
  GY: ['green', 'yellow'],
};

/** The file a pair of dice downloads, in either order, or null for two of the same color. */
export function fileForPair(first: Color, second: Color): FileId | null {
  if (first === second) return null;
  const [low, high] = COLORS.indexOf(first) < COLORS.indexOf(second) ? [first, second] : [second, first];
  const match = FILE_IDS.find((id) => FILE_COLORS[id][0] === low && FILE_COLORS[id][1] === high);
  if (match === undefined) throw new Error(`No file for ${first} + ${second}`);
  return match;
}

export function fileIndex(id: FileId): number {
  return FILE_IDS.indexOf(id);
}
