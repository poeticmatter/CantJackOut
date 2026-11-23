import { describe, expect, it } from 'vitest';
import { REROUTE_MINUTES } from './clock';
import type { Color, Die } from './dice';
import { FILE_IDS, type FileId } from './files';
import { createRng } from './random';
import {
  type RunState, canReroute, chooseSplit, flatline, flatlineWithFailsafe, jackOut, reroute, rollRun, runMinutes,
  serverAfterRun, startRun,
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
const RED_BLUE_GREEN_GREEN = riggedDice(['red', 'blue', 'green', 'green']);
const ALL_RED = riggedDice(['red', 'red', 'red', 'red']);

function blocksOf(run: RunState, file: FileId): number {
  return run.buffer[FILE_IDS.indexOf(file)];
}

/** Rolls the dice and takes the first split's first choice. */
function rollAndTakeFirst(run: RunState, server: Server, dice: Die[]): RunState {
  return chooseSplit(rollRun(run, server, dice, rng()), server, 0, 0);
}

describe('a roll', () => {
  const server = makeServer();

  it('waits for the player to choose a split', () => {
    expect(rollRun(startRun(server, false, rng()), server, RED_BLUE_GREEN_GREEN, rng()).status).toBe('choosing');
  });

  it('downloads a block of each file in the chosen split', () => {
    const run = rollAndTakeFirst(startRun(server, false, rng()), server, RED_BLUE_GREEN_GREEN);
    expect([blocksOf(run, 'RB'), blocksOf(run, 'GG')]).toEqual([1, 1]);
  });

  it('opens a stream for each new file it touches', () => {
    const run = rollAndTakeFirst(startRun(server, false, rng()), server, RED_BLUE_GREEN_GREEN);
    expect(run.streams).toEqual(['RB', 'GG']);
  });

  it('downloads two blocks when both pairs match the same file', () => {
    const run = rollAndTakeFirst(startRun(server, false, rng()), server, ALL_RED);
    expect(blocksOf(run, 'RR')).toBe(2);
  });

  it('misses when every split needs a third stream', () => {
    const run = rollAndTakeFirst(startRun(server, false, rng()), server, RED_BLUE_GREEN_GREEN);
    expect(rollRun(run, server, ALL_RED, rng()).status).toBe('missed');
  });

  it('refuses a split that downloads nothing', () => {
    const streamsFull = rollAndTakeFirst(startRun(server, false, rng()), server, RED_BLUE_GREEN_GREEN);
    const missed = rollRun(streamsFull, server, ALL_RED, rng());
    expect(() => chooseSplit({ ...missed, status: 'choosing' }, server, 0, 0)).toThrow();
  });

  it('stops a file at its length', () => {
    const short = makeServer({ RR: [3, 2] });
    const run = rollAndTakeFirst(startRun(short, false, rng()), short, ALL_RED);
    expect(blocksOf(run, 'RR')).toBe(1);
  });
});

describe('ending a run', () => {
  it('banks the download when you jack out', () => {
    const server = makeServer();
    const run = jackOut(rollAndTakeFirst(startRun(server, false, rng()), server, ALL_RED));
    expect(serverAfterRun(server, run).files[0].banked).toBe(2);
  });

  it('ends as downloaded when the last open files fill', () => {
    const almostDone = makeServer({ RR: [2, 1], RB: [2, 2], RG: [2, 2], BB: [2, 2], BG: [2, 2], GG: [2, 2] });
    const run = rollAndTakeFirst(startRun(almostDone, false, rng()), almostDone, ALL_RED);
    expect(run.ending).toBe('downloaded');
  });
});

describe('rerouting', () => {
  const server = makeServer();
  const afterHit = rollAndTakeFirst(startRun(server, false, rng()), server, RED_BLUE_GREEN_GREEN);

  it('needs something at risk', () => {
    expect(canReroute(startRun(server, false, rng()))).toBe(false);
  });

  it('banks the download', () => {
    expect(reroute(afterHit).banked[FILE_IDS.indexOf('GG')]).toBe(1);
  });

  it('frees both streams', () => {
    expect(reroute(afterHit).streams).toEqual([]);
  });

  it('costs its own time instead of a handshake', () => {
    expect(runMinutes(reroute(afterHit), server) - runMinutes(afterHit, server)).toBe(REROUTE_MINUTES);
  });
});

describe('missed rolls', () => {
  const server = makeServer({ BB: [8, 3] }, ['blackIce']);
  const bbIndex = FILE_IDS.indexOf('BB');
  const missedRun: RunState = {
    ...startRun(server, false, rng()),
    buffer: FILE_IDS.map((id) => (id === 'BB' ? 5 : 0)),
    status: 'missed',
  };

  it('loses the whole unbanked download on a flatline', () => {
    expect(flatline(missedRun, rng()).buffer[bbIndex]).toBe(0);
  });

  it('keeps half the unbanked download with Failsafe', () => {
    expect(flatlineWithFailsafe(missedRun, rng()).buffer[bbIndex]).toBe(2);
  });

  it('lets Black ICE burn a banked block when you flatline', () => {
    expect(serverAfterRun(server, flatline(missedRun, rng())).files[bbIndex].banked).toBe(2);
  });
});

describe('server alert', () => {
  it('rises by one for a visit you jack out of', () => {
    const server = makeServer();
    expect(serverAfterRun(server, jackOut(startRun(server, false, rng()))).alert).toBe(1);
  });

  it('purges unfinished files once it fills', () => {
    const server = { ...makeServer({ BB: [8, 5] }, [], 3), alert: 2 };
    const after = serverAfterRun(server, jackOut(startRun(server, false, rng())));
    expect([after.files[FILE_IDS.indexOf('BB')].banked, after.alert]).toEqual([0, 0]);
  });

  it('leaves finished files alone in a purge, since they are already sold', () => {
    const server = { ...makeServer({ RR: [3, 3] }, [], 3), alert: 2 };
    expect(serverAfterRun(server, jackOut(startRun(server, false, rng()))).files[0].banked).toBe(3);
  });
});
