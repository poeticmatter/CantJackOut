import type { Rng } from './random';

export const COLORS = ['red', 'blue', 'green'] as const;
export type Color = (typeof COLORS)[number];
export type FaceColor = Color | 'wild';

export interface Face {
  readonly color: FaceColor;
  /** Progress a matching face adds: 1 normally, 2 once overclocked. */
  readonly boost: 1 | 2;
}

export interface Die {
  readonly id: string;
  readonly faces: readonly Face[];
}

export const FACES_PER_DIE = 6;

/** The 1 / 2 / 3 split is the game's core odds: red is rare, green is common. */
export const STANDARD_FACES: readonly Face[] = [
  { color: 'red', boost: 1 },
  { color: 'blue', boost: 1 },
  { color: 'blue', boost: 1 },
  { color: 'green', boost: 1 },
  { color: 'green', boost: 1 },
  { color: 'green', boost: 1 },
];

export function createStandardDie(id: string): Die {
  return { id, faces: STANDARD_FACES };
}

export function rollFaceIndex(rng: Rng): number {
  return Math.floor(rng.next() * FACES_PER_DIE);
}

export function faceMatchesAny(face: Face, colors: readonly Color[]): boolean {
  if (colors.length === 0) return false;
  return face.color === 'wild' || colors.includes(face.color);
}

/** Exact chance that at least one die shows a face matching one of the colors. */
export function hitProbability(dice: readonly Die[], colors: readonly Color[]): number {
  const missProbability = dice.reduce((product, die) => {
    const misses = die.faces.filter((face) => !faceMatchesAny(face, colors)).length;
    return product * (misses / die.faces.length);
  }, 1);
  return 1 - missProbability;
}

/** Expected progress from one roll, ignoring track caps. */
export function expectedProgress(dice: readonly Die[], colors: readonly Color[]): number {
  return dice.reduce((total, die) => {
    const dieTotal = die.faces
      .filter((face) => faceMatchesAny(face, colors))
      .reduce((sum, face) => sum + face.boost, 0);
    return total + dieTotal / die.faces.length;
  }, 0);
}

export function countFaces(die: Die, color: FaceColor): number {
  return die.faces.filter((face) => face.color === color).length;
}

export function replaceFace(die: Die, faceIndex: number, face: Face): Die {
  if (faceIndex < 0 || faceIndex >= die.faces.length) {
    throw new Error(`Face ${faceIndex} does not exist on die ${die.id}`);
  }
  return { ...die, faces: die.faces.map((existing, index) => (index === faceIndex ? face : existing)) };
}
