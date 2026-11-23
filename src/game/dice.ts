import type { Rng } from './random';

export const COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type Color = (typeof COLORS)[number];

/**
 * In the dice-pairing experiment every face is a single color: special faces and custom dice
 * are switched off so the playtest reads the core mechanic on its own.
 */
export type Face = Color;

export interface Die {
  readonly id: string;
  readonly faces: readonly Face[];
}

export const FACES_PER_DIE = 6;

/** Red and blue are rare, green and yellow common: the game's core odds. Every die is the same. */
export const STANDARD_FACES: readonly Face[] = ['red', 'blue', 'green', 'green', 'yellow', 'yellow'];

export function createStandardDie(id: string): Die {
  return { id, faces: STANDARD_FACES };
}

export function rollFaceIndex(rng: Rng): number {
  return Math.floor(rng.next() * FACES_PER_DIE);
}

/** Chance a die shows each color. */
export function colorOdds(die: Die): Record<Color, number> {
  const count = (color: Color) => die.faces.filter((face) => face === color).length / die.faces.length;
  return { red: count('red'), blue: count('blue'), green: count('green'), yellow: count('yellow') };
}
