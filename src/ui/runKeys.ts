import type { RollRecord } from '../game/roll';
import { CHOICE_KEYS, SPLIT_KEYS, jackpotKey } from './splitPicker';

/** What a key press means while the player is choosing what to do with a roll. */
export type ChoiceKeyAction =
  | { readonly kind: 'split'; readonly splitIndex: number; readonly choiceIndex: number }
  | { readonly kind: 'jackpot'; readonly fileIndex: number }
  | { readonly kind: 'pend'; readonly splitIndex: number }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'none' };

/**
 * 1, 2, 3 take a split; a split that can only take one of its pairs waits for A or B.
 * On a jackpot, the number keys pick among the files it can reach, in tower order.
 */
export function choiceKeyAction(key: string, roll: RollRecord, pendingSplit: number | null): ChoiceKeyAction {
  if (roll.jackpotFiles.length > 0) {
    const fileIndex = roll.jackpotFiles.findIndex((_, index) => jackpotKey(index) === key);
    return fileIndex === -1 ? { kind: 'none' } : { kind: 'jackpot', fileIndex };
  }
  const splitIndex = SPLIT_KEYS.findIndex((candidate) => candidate === key);
  if (splitIndex !== -1) {
    const choiceCount = roll.options[splitIndex].choices.length;
    if (choiceCount === 1) return { kind: 'split', splitIndex, choiceIndex: 0 };
    return choiceCount > 1 ? { kind: 'pend', splitIndex } : { kind: 'none' };
  }
  const choiceIndex = CHOICE_KEYS.findIndex((candidate) => candidate === key.toUpperCase());
  if (choiceIndex !== -1 && pendingSplit !== null) return { kind: 'split', splitIndex: pendingSplit, choiceIndex };
  if (key === 'Escape' && pendingSplit !== null) return { kind: 'cancel' };
  return { kind: 'none' };
}
