import { describe, expect, it } from 'vitest';
import { REROUTE_MINUTES } from './clock';
import type { Color, Die } from './dice';
import { FILE_IDS, type FileId } from './files';
import { createRng } from './random';
import {
  type RunState, canReroute, chooseJackpotFile, chooseSplit, flatline, flatlineWithFailsafe, jackOut, reroute, rollRun,
  runMinutes, serverAfterRun, startRun,
} from './run';
import type { Server, ServerModifier } from './server';

type FileSetup = Partial<Record<FileId, [length: number, banked?: number]>>;

const DEFAULT_LENGTH = 5;

function makeServer(setup: FileSetup = {}, modifiers: ServerModifier[] = [], alertLimit = 99): Server {
  return {
    id: 'srv',
    name: 'test',
    corp: 'test',
    tier: 1,
    files: FILE_IDS.map((id) => {
      const [length, banked = 0] = setup[id] ?? [DEFAULT_LENGTH];
      return { id, length, banked, payout: 100 };
    }),
    modifiers,
    isRevealed: true,
    alert: 0,
    alertLimit,
  };
}

/** Four dice that always show these colors. */
function riggedDice(colors: [Color, Color, Color, Color]): Die[] {
  return colors.map((color, index) => ({ id: `d${index}`, faces: Array.from({ length: 6 }, () => color) }));
}

const rng = () => createRng(1);
/** Splits into RB + GY, RG + BY, or RY + BG. */
const ONE_OF_EACH = riggedDice(['red', 'blue', 'green', 'yellow']);
/** Only RB + RB works. */
const TWO_RED_TWO_BLUE = riggedDice(['red', 'red', 'blue', 'blue']);
/** Only BY + BY works. */
const TWO_BLUE_TWO_YELLOW = riggedDice(['blue', 'blue', 'yellow', 'yellow']);
const ALL_GREEN = riggedDice(['green', 'green', 'green', 'green']);

function blocksOf(run: RunState, file: FileId): number {
  return run.buffer[FILE_IDS.indexOf(file)];
}

function roll(run: RunState, server: Server, dice: Die[]): RunState {
  return rollRun(run, server, dice, rng());
}

/** Rolls the dice and takes the first usable split. */
function rollAndTake(run: RunState, server: Server, dice: Die[], choice = 0): RunState {
  const rolled = roll(run, server, dice);
  const splitIndex = rolled.lastRoll?.options.findIndex((option) => option.choices.length > 0) ?? -1;
  return chooseSplit(rolled, server, splitIndex, choice);
}

/** RB, GY and RG open: all three streams taken. */
function withStreamsFull(server: Server): RunState {
  const twoOpen = rollAndTake(startRun(server, false, rng()), server, ONE_OF_EACH);
  return chooseSplit(roll(twoOpen, server, ONE_OF_EACH), server, 1, 0);
}

describe('a roll', () => {
  const server = makeServer();

  it('waits for the player to choose a split', () => {
    expect(roll(startRun(server, false, rng()), server, ONE_OF_EACH).status).toBe('choosing');
  });

  it('downloads a block of each file in the chosen split', () => {
    const run = rollAndTake(startRun(server, false, rng()), server, ONE_OF_EACH);
    expect([blocksOf(run, 'RB'), blocksOf(run, 'GY')]).toEqual([1, 1]);
  });

  it('opens a stream for each new file it touches', () => {
    expect(rollAndTake(startRun(server, false, rng()), server, ONE_OF_EACH).streams).toEqual(['RB', 'GY']);
  });

  it('downloads two blocks when both pairs match the same file', () => {
    expect(blocksOf(rollAndTake(startRun(server, false, rng()), server, TWO_RED_TWO_BLUE), 'RB')).toBe(2);
  });

  it('opens at most three streams', () => {
    expect(withStreamsFull(server).streams).toEqual(['RB', 'GY', 'RG']);
  });

  it('misses when every pair needs a fourth stream', () => {
    expect(roll(withStreamsFull(server), server, TWO_BLUE_TWO_YELLOW).status).toBe('missed');
  });

  it('refuses a split that downloads nothing', () => {
    const missed = roll(withStreamsFull(server), server, TWO_BLUE_TWO_YELLOW);
    expect(() => chooseSplit({ ...missed, status: 'choosing' }, server, 1, 0)).toThrow();
  });

  it('stops a file at its length', () => {
    const short = makeServer({ RB: [3, 2] });
    expect(blocksOf(rollAndTake(startRun(short, false, rng()), short, TWO_RED_TWO_BLUE), 'RB')).toBe(1);
  });
});

describe('a jackpot', () => {
  const server = makeServer();

  it('waits for the player to pick a file', () => {
    expect(roll(startRun(server, false, rng()), server, ALL_GREEN).lastRoll?.jackpotFiles).toEqual([...FILE_IDS]);
  });

  it('puts one block in the chosen file', () => {
    const run = chooseJackpotFile(roll(startRun(server, false, rng()), server, ALL_GREEN), server, 'RB');
    expect(blocksOf(run, 'RB')).toBe(1);
  });

  it('opens a stream for a new file', () => {
    expect(chooseJackpotFile(roll(startRun(server, false, rng()), server, ALL_GREEN), server, 'BY').streams).toEqual(['BY']);
  });

  it('only reaches open streams once all three are taken', () => {
    const rolled = roll(withStreamsFull(server), server, ALL_GREEN);
    expect(() => chooseJackpotFile(rolled, server, 'BY')).toThrow();
  });

  it('saves a roll that has no usable pair', () => {
    expect(roll(withStreamsFull(server), server, ALL_GREEN).status).toBe('choosing');
  });
});

describe('ending a run', () => {
  it('banks the download when you jack out', () => {
    const server = makeServer();
    const run = jackOut(rollAndTake(startRun(server, false, rng()), server, TWO_RED_TWO_BLUE));
    expect(serverAfterRun(server, run).files[0].banked).toBe(2);
  });

  it('ends as downloaded when the last open files fill', () => {
    const almostDone = makeServer({ RB: [2, 1], RG: [2, 2], RY: [2, 2], BG: [2, 2], BY: [2, 2], GY: [2, 2] });
    expect(rollAndTake(startRun(almostDone, false, rng()), almostDone, TWO_RED_TWO_BLUE).ending).toBe('downloaded');
  });
});

describe('rerouting', () => {
  const server = makeServer();
  const afterHit = rollAndTake(startRun(server, false, rng()), server, ONE_OF_EACH);

  it('needs something at risk', () => {
    expect(canReroute(startRun(server, false, rng()))).toBe(false);
  });

  it('banks the download', () => {
    expect(reroute(afterHit).banked[FILE_IDS.indexOf('GY')]).toBe(1);
  });

  it('frees every stream', () => {
    expect(reroute(afterHit).streams).toEqual([]);
  });

  it('costs its own time instead of a handshake', () => {
    expect(runMinutes(reroute(afterHit), server) - runMinutes(afterHit, server)).toBe(REROUTE_MINUTES);
  });
});

describe('missed rolls', () => {
  const server = makeServer({ BG: [8, 3] }, ['blackIce']);
  const bgIndex = FILE_IDS.indexOf('BG');
  const missedRun: RunState = {
    ...startRun(server, false, rng()),
    buffer: FILE_IDS.map((id) => (id === 'BG' ? 5 : 0)),
    status: 'missed',
  };

  it('loses the whole unbanked download on a flatline', () => {
    expect(flatline(missedRun, rng()).buffer[bgIndex]).toBe(0);
  });

  it('keeps half the unbanked download with Failsafe', () => {
    expect(flatlineWithFailsafe(missedRun, rng()).buffer[bgIndex]).toBe(2);
  });

  it('lets Black ICE burn a banked block when you flatline', () => {
    expect(serverAfterRun(server, flatline(missedRun, rng())).files[bgIndex].banked).toBe(2);
  });
});

describe('server alert', () => {
  it('rises by one for a visit you jack out of', () => {
    const server = makeServer();
    expect(serverAfterRun(server, jackOut(startRun(server, false, rng()))).alert).toBe(1);
  });

  it('purges unfinished files once it fills', () => {
    const server = { ...makeServer({ BG: [8, 5] }, [], 3), alert: 2 };
    const after = serverAfterRun(server, jackOut(startRun(server, false, rng())));
    expect([after.files[FILE_IDS.indexOf('BG')].banked, after.alert]).toEqual([0, 0]);
  });

  it('leaves finished files alone in a purge, since they are already sold', () => {
    const server = { ...makeServer({ RB: [3, 3] }, [], 3), alert: 2 };
    expect(serverAfterRun(server, jackOut(startRun(server, false, rng()))).files[0].banked).toBe(3);
  });
});
