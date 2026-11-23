import { type Color, type Die, rollFaceIndex } from './dice';
import type { FileId } from './files';
import { type SplitOption, type StreamContext, isMiss, jackpotFiles, splitOptions } from './pairing';
import type { Rng } from './random';

/** The player took a split, or put a jackpot's block in a file. */
export type RollChoice =
  | { readonly kind: 'split'; readonly splitIndex: number; readonly choiceIndex: number }
  | { readonly kind: 'jackpot'; readonly file: FileId };

export interface RollRecord {
  readonly faceIndexes: readonly number[];
  readonly colors: readonly Color[];
  readonly options: readonly SplitOption[];
  /** Files a jackpot may feed; empty unless all four dice match. */
  readonly jackpotFiles: readonly FileId[];
  readonly chosen: RollChoice | null;
}

export function rollDice(dice: readonly Die[], rng: Rng, context: StreamContext): RollRecord {
  const faceIndexes = dice.map(() => rollFaceIndex(rng));
  const colors = dice.map((die, index) => die.faces[faceIndexes[index]]);
  return { faceIndexes, colors, options: splitOptions(colors, context), jackpotFiles: jackpotFiles(colors, context), chosen: null };
}

export function isMissedRoll(roll: RollRecord): boolean {
  return isMiss(roll.options, roll.jackpotFiles);
}

export function isJackpotRoll(roll: RollRecord): boolean {
  return roll.jackpotFiles.length > 0;
}

/** The files the player's choice put a block in, in order. */
export function chosenFiles(roll: RollRecord, choice: RollChoice): readonly FileId[] {
  if (choice.kind === 'jackpot') return [choice.file];
  const files = roll.options[choice.splitIndex]?.choices[choice.choiceIndex];
  if (files === undefined) throw new Error('That split can’t download anything');
  return files;
}
