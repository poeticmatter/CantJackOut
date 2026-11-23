import { describe, expect, it } from 'vitest';
import { createStandardDie } from './dice';
import { FILE_IDS } from './files';
import {
  chanceAnyPairFor, choicesForPairs, isMiss, jackpotChance, jackpotFiles, splitOptions, survivalChance,
} from './pairing';

const standardDice = [0, 1, 2, 3].map((index) => createStandardDie(`d${index}`));
const noLimits = { streams: [], fullFiles: [] } as const;

describe('splitting a roll', () => {
  it('offers the three ways to pair four dice', () => {
    const options = splitOptions(['red', 'blue', 'green', 'yellow'], noLimits);
    expect(options.map((option) => option.files)).toEqual([['RB', 'GY'], ['RG', 'BY'], ['RY', 'BG']]);
  });

  it('names a file the same whichever die comes first', () => {
    expect(splitOptions(['yellow', 'red', 'blue', 'green'], noLimits)[0].files).toEqual(['RY', 'BG']);
  });

  it('never pairs two dice of the same color', () => {
    expect(splitOptions(['green', 'green', 'red', 'blue'], noLimits)[0].files).toEqual([null, 'RB']);
  });
});

describe('streams', () => {
  it('applies both pairs when they fit in the free streams', () => {
    expect(choicesForPairs('RB', 'GY', { streams: ['RG'], fullFiles: [] })).toEqual([['RB', 'GY']]);
  });

  it('applies both pairs to the same file using one stream', () => {
    expect(choicesForPairs('GY', 'GY', { streams: ['RB', 'RG'], fullFiles: [] })).toEqual([['GY', 'GY']]);
  });

  it('lets the player pick one pair when both would need a fourth stream', () => {
    expect(choicesForPairs('RB', 'GY', { streams: ['RG', 'BY'], fullFiles: [] })).toEqual([['RB'], ['GY']]);
  });

  it('keeps only the pair on an open stream once all three are taken', () => {
    expect(choicesForPairs('RB', 'GY', { streams: ['GY', 'RG', 'BY'], fullFiles: [] })).toEqual([['GY']]);
  });

  it('refuses a pair whose file is full', () => {
    expect(choicesForPairs('RB', 'GY', { streams: [], fullFiles: ['GY'] })).toEqual([['RB']]);
  });

  it('calls it a miss when no split has a usable pair', () => {
    const context = { streams: ['RB', 'RG', 'RY'] as const, fullFiles: [] };
    expect(isMiss(splitOptions(['green', 'green', 'yellow', 'yellow'], context), [])).toBe(true);
  });
});

describe('jackpot', () => {
  it('lets a free stream take any file', () => {
    expect(jackpotFiles(['green', 'green', 'green', 'green'], noLimits)).toEqual([...FILE_IDS]);
  });

  it('only reaches open streams once all three are taken', () => {
    expect(jackpotFiles(['red', 'red', 'red', 'red'], { streams: ['RB', 'GY', 'BG'], fullFiles: ['BG'] })).toEqual(['RB', 'GY']);
  });

  it('offers nothing when the dice are not all the same', () => {
    expect(jackpotFiles(['red', 'red', 'red', 'blue'], noLimits)).toEqual([]);
  });

  it('saves a roll with no usable pair', () => {
    const context = { streams: ['RB', 'RG', 'RY'] as const, fullFiles: [] };
    const colors = ['yellow', 'yellow', 'yellow', 'yellow'] as const;
    expect(isMiss(splitOptions(colors, context), jackpotFiles(colors, context))).toBe(false);
  });

  it('comes up in 2.62% of rolls', () => {
    expect(jackpotChance(standardDice)).toBeCloseTo(34 / 1296, 6);
  });
});

describe('odds', () => {
  it('never misses on the first roll of a run with every file open', () => {
    expect(survivalChance(standardDice, noLimits)).toBeCloseTo(1);
  });

  it('offers red and blue together in 23.3% of rolls', () => {
    expect(chanceAnyPairFor(standardDice, ['RB'])).toBeCloseTo(0.233, 3);
  });

  it('offers a file with one rare color in 38.3% of rolls', () => {
    expect(chanceAnyPairFor(standardDice, ['RG'])).toBeCloseTo(0.3827, 4);
  });

  it('offers green and yellow together in 61.7% of rolls', () => {
    expect(chanceAnyPairFor(standardDice, ['GY'])).toBeCloseTo(0.6173, 4);
  });

  it('survives the riskiest three streams 51.7% of the time from pairs alone', () => {
    expect(chanceAnyPairFor(standardDice, ['RB', 'RG', 'RY'])).toBeCloseTo(0.517, 3);
  });

  it('adds the jackpot to the survival chance', () => {
    expect(survivalChance(standardDice, { streams: ['RB', 'RG', 'RY'], fullFiles: [] })).toBeCloseTo(0.517 + 34 / 1296, 3);
  });
});
