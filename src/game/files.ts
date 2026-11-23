import type { Color } from './dice';

/** Every server holds one file per two-color combination; the order here is the order on screen. */
export const FILE_IDS = ['RR', 'RB', 'RG', 'BB', 'BG', 'GG'] as const;
export type FileId = (typeof FILE_IDS)[number];

export const FILE_COLORS: Record<FileId, readonly [Color, Color]> = {
  RR: ['red', 'red'],
  RB: ['red', 'blue'],
  RG: ['red', 'green'],
  BB: ['blue', 'blue'],
  BG: ['blue', 'green'],
  GG: ['green', 'green'],
};

const COLOR_ORDER: Record<Color, number> = { red: 0, blue: 1, green: 2 };

/** The file a pair of dice downloads; the order of the two dice doesn't matter. */
export function fileForPair(first: Color, second: Color): FileId {
  const match = FILE_IDS.find((id) => {
    const [low, high] = FILE_COLORS[id];
    const [a, b] = COLOR_ORDER[first] <= COLOR_ORDER[second] ? [first, second] : [second, first];
    return low === a && high === b;
  });
  if (match === undefined) throw new Error(`No file for ${first} + ${second}`);
  return match;
}

export function fileIndex(id: FileId): number {
  return FILE_IDS.indexOf(id);
}
