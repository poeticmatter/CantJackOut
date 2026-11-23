import { type Color, type Die, rollFaceIndex } from './dice';
import { type SplitOption, type StreamContext, isMiss, splitOptions } from './pairing';
import type { Rng } from './random';

export interface SplitChoice {
  readonly splitIndex: number;
  readonly choiceIndex: number;
}

export interface RollRecord {
  readonly faceIndexes: readonly number[];
  readonly colors: readonly Color[];
  readonly options: readonly SplitOption[];
  /** The split the player took, once they've chosen. */
  readonly chosen: SplitChoice | null;
}

export function rollDice(dice: readonly Die[], rng: Rng, context: StreamContext): RollRecord {
  const faceIndexes = dice.map(() => rollFaceIndex(rng));
  const colors = dice.map((die, index) => die.faces[faceIndexes[index]]);
  return { faceIndexes, colors, options: splitOptions(colors, context), chosen: null };
}

export function isMissedRoll(roll: RollRecord): boolean {
  return isMiss(roll.options);
}
