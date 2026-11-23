import type { Rng } from './random';

export const COLORS = ['red', 'blue', 'green'] as const;
export type Color = (typeof COLORS)[number];

/** A face that downloads data. One color is a normal face, two is dual-color, all three is wild. */
export interface DataFace {
  readonly kind: 'data';
  readonly colors: readonly Color[];
  /** Blocks a matching face adds: 1 normally, 2 once overclocked. */
  readonly boost: 1 | 2;
  /** Blocks an anchored face downloads are banked on the spot. */
  readonly isAnchored: boolean;
}

/** Never downloads; showing on a roll that misses blocks the miss. */
export interface FirewallFace {
  readonly kind: 'firewall';
}

/** Never downloads; pays cash every time it shows. */
export interface PaydayFace {
  readonly kind: 'payday';
}

export type Face = DataFace | FirewallFace | PaydayFace;

export interface Die {
  readonly id: string;
  readonly faces: readonly Face[];
}

export const FACES_PER_DIE = 6;

export function colorFace(...colors: Color[]): DataFace {
  return { kind: 'data', colors, boost: 1, isAnchored: false };
}

export const FIREWALL_FACE: FirewallFace = { kind: 'firewall' };
export const PAYDAY_FACE: PaydayFace = { kind: 'payday' };

/** The 1 / 2 / 3 split is the game's core odds: red is rare, green is common. */
export const STANDARD_FACES: readonly Face[] = [
  colorFace('red'),
  colorFace('blue'),
  colorFace('blue'),
  colorFace('green'),
  colorFace('green'),
  colorFace('green'),
];

export function createStandardDie(id: string): Die {
  return { id, faces: STANDARD_FACES };
}

export function rollFaceIndex(rng: Rng): number {
  return Math.floor(rng.next() * FACES_PER_DIE);
}

export function isWild(face: Face): boolean {
  return face.kind === 'data' && face.colors.length === COLORS.length;
}

export function faceMatchesAny(face: Face, colors: readonly Color[]): boolean {
  return face.kind === 'data' && face.colors.some((color) => colors.includes(color));
}

/** Exact chance that at least one die shows a face matching one of the colors. */
export function hitProbability(dice: readonly Die[], colors: readonly Color[]): number {
  return 1 - chanceEveryDieShows(dice, (face) => !faceMatchesAny(face, colors));
}

/** Exact chance a roll doesn't get you caught: something hits, or a Firewall face blocks the miss. */
export function safeProbability(dice: readonly Die[], colors: readonly Color[]): number {
  return 1 - chanceEveryDieShows(dice, (face) => !faceMatchesAny(face, colors) && face.kind !== 'firewall');
}

function chanceEveryDieShows(dice: readonly Die[], isWanted: (face: Face) => boolean): number {
  return dice.reduce((product, die) => product * (die.faces.filter(isWanted).length / die.faces.length), 1);
}

/** Expected progress from one roll, ignoring track caps and which file a multi-color face picks. */
export function expectedProgress(dice: readonly Die[], colors: readonly Color[]): number {
  return dice.reduce((total, die) => {
    const dieTotal = die.faces.reduce((sum, face) => (face.kind === 'data' && faceMatchesAny(face, colors) ? sum + face.boost : sum), 0);
    return total + dieTotal / die.faces.length;
  }, 0);
}

export function replaceFace(die: Die, faceIndex: number, face: Face): Die {
  if (faceIndex < 0 || faceIndex >= die.faces.length) {
    throw new Error(`Face ${faceIndex} does not exist on die ${die.id}`);
  }
  return { ...die, faces: die.faces.map((existing, index) => (index === faceIndex ? face : existing)) };
}
