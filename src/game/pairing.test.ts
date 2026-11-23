import { describe, expect, it } from 'vitest';
import { createStandardDie } from './dice';
import { choicesForPairs, chanceAnyPairFor, isMiss, splitOptions, survivalChance } from './pairing';

const standardDice = [0, 1, 2, 3].map((index) => createStandardDie(`d${index}`));
const noLimits = { streams: [], fullFiles: [] } as const;

describe('splitting a roll', () => {
  it('offers the three ways to pair four dice', () => {
    const options = splitOptions(['red', 'blue', 'green', 'green'], noLimits);
    expect(options.map((option) => option.files)).toEqual([['RB', 'GG'], ['RG', 'BG'], ['RG', 'BG']]);
  });

  it('names a file the same whichever die comes first', () => {
    const options = splitOptions(['green', 'red', 'blue', 'blue'], noLimits);
    expect(options[0].files).toEqual(['RG', 'BB']);
  });
});

describe('streams', () => {
  it('applies both pairs when they fit in the free streams', () => {
    expect(choicesForPairs('RB', 'GG', noLimits)).toEqual([['RB', 'GG']]);
  });

  it('applies both pairs to the same file using one stream', () => {
    expect(choicesForPairs('GG', 'GG', { streams: ['RR'], fullFiles: [] })).toEqual([['GG', 'GG']]);
  });

  it('lets the player pick one pair when both would need a third stream', () => {
    expect(choicesForPairs('RB', 'GG', { streams: ['RR'], fullFiles: [] })).toEqual([['RB'], ['GG']]);
  });

  it('keeps only the pair on an open stream once both streams are taken', () => {
    expect(choicesForPairs('RB', 'GG', { streams: ['GG', 'BB'], fullFiles: [] })).toEqual([['GG']]);
  });

  it('refuses a pair whose file is full', () => {
    expect(choicesForPairs('RB', 'GG', { streams: [], fullFiles: ['GG'] })).toEqual([['RB']]);
  });

  it('calls it a miss when no split has a usable pair', () => {
    const options = splitOptions(['red', 'red', 'red', 'red'], { streams: ['GG', 'BB'], fullFiles: [] });
    expect(isMiss(options)).toBe(true);
  });
});

describe('odds', () => {
  it('never misses on the first roll of a run with every file open', () => {
    expect(survivalChance(standardDice, noLimits)).toBeCloseTo(1);
  });

  it('offers a red pair in 13.2% of rolls', () => {
    expect(chanceAnyPairFor(standardDice, ['RR'])).toBeCloseTo(0.1319, 4);
  });

  it('matches the pair table for the riskiest two streams', () => {
    expect(survivalChance(standardDice, { streams: ['RR', 'RB'], fullFiles: [] })).toBeCloseTo(0.4344, 4);
  });

  it('can never miss holding all three single-color files', () => {
    expect(chanceAnyPairFor(standardDice, ['RR', 'BB', 'GG'])).toBeCloseTo(1);
  });
});
