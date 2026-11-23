import { describe, expect, it } from 'vitest';
import type { Color } from '../game/dice';
import { jackpotFiles, splitOptions } from '../game/pairing';
import type { RollRecord } from '../game/roll';
import { choiceKeyAction } from './runKeys';

function rollOf(colors: [Color, Color, Color, Color], streams: RollRecord['jackpotFiles'] = []): RollRecord {
  const context = { streams, fullFiles: [] };
  return { faceIndexes: [0, 0, 0, 0], colors, options: splitOptions(colors, context), jackpotFiles: jackpotFiles(colors, context), chosen: null };
}

describe('choice keys', () => {
  it('takes a split with its number key', () => {
    expect(choiceKeyAction('2', rollOf(['red', 'blue', 'green', 'yellow']), null)).toEqual({ kind: 'split', splitIndex: 1, choiceIndex: 0 });
  });

  it('waits for A or B on a split that can only take one pair', () => {
    const forked = rollOf(['red', 'blue', 'green', 'yellow'], ['RG', 'BY']);
    expect(choiceKeyAction('1', forked, null)).toEqual({ kind: 'pend', splitIndex: 0 });
  });

  it('takes the second pair of a pending split with B', () => {
    const forked = rollOf(['red', 'blue', 'green', 'yellow'], ['RG', 'BY']);
    expect(choiceKeyAction('b', forked, 0)).toEqual({ kind: 'split', splitIndex: 0, choiceIndex: 1 });
  });

  it('ignores the number of a split with nothing usable', () => {
    expect(choiceKeyAction('1', rollOf(['green', 'green', 'red', 'red']), null)).toEqual({ kind: 'none' });
  });

  it('picks a jackpot file by its place in the list', () => {
    expect(choiceKeyAction('6', rollOf(['green', 'green', 'green', 'green']), null)).toEqual({ kind: 'jackpot', fileIndex: 5 });
  });
});
