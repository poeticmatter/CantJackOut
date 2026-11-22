import { describe, expect, it } from 'vitest';
import { type Die, type Face, createStandardDie, hitProbability } from './dice';
import { createRng } from './random';
import { resolveRoll } from './roll';
import { type RunState, flatline, flatlineWithFailsafe, jackOut, rollRun, serverAfterRun, startRun } from './run';
import type { Server, ServerModifier } from './server';

function makeServer(tracks: [Server['tracks'][number]['color'], number, number?][], modifiers: ServerModifier[] = []): Server {
  return {
    id: 'srv',
    name: 'test',
    corp: 'test',
    tier: 1,
    reward: 100,
    tracks: tracks.map(([color, length, banked = 0]) => ({ color, length, banked })),
    modifiers,
    isRevealed: true,
  };
}

function dieOf(id: string, face: Face): Die {
  return { id, faces: Array.from({ length: 6 }, () => face) };
}

const RED: Face = { color: 'red', boost: 1 };
const GREEN: Face = { color: 'green', boost: 1 };
const WILD: Face = { color: 'wild', boost: 1 };

describe('hit probability', () => {
  it('matches the 1/2/3 face split for three standard dice', () => {
    const dice = [0, 1, 2].map((index) => createStandardDie(`d${index}`));
    expect(hitProbability(dice, ['red'])).toBeCloseTo(1 - (5 / 6) ** 3);
    expect(hitProbability(dice, ['green'])).toBeCloseTo(0.875);
  });
});

describe('resolveRoll', () => {
  it('stops feeding a file once it is full', () => {
    const server = makeServer([['red', 3, 2]]);
    const dice = [dieOf('a', RED), dieOf('b', RED)];
    const outcome = resolveRoll(server, [0], dice, [0, 0]);
    expect(outcome.buffer).toEqual([1]);
  });

  it('sends wild faces to the file that still needs the most steps', () => {
    const server = makeServer([['red', 3], ['green', 10]]);
    const outcome = resolveRoll(server, [0, 0], [dieOf('w', WILD)], [0]);
    expect(outcome.buffer).toEqual([0, 1]);
  });

  it('counts a roll as a miss when only finished files match', () => {
    const server = makeServer([['red', 2, 2], ['blue', 5]]);
    const outcome = resolveRoll(server, [0, 0], [dieOf('a', RED)], [0]);
    expect(outcome.isHit).toBe(false);
  });
});

function runWith(server: Server, dice: Die[], seed = 1): RunState {
  return rollRun(startRun(server, false, createRng(seed)), server, dice, createRng(seed));
}

describe('run flow', () => {
  it('keeps you connected when you miss before downloading anything', () => {
    const server = makeServer([['red', 4]]);
    const run = runWith(server, [dieOf('g', GREEN)]);
    expect(run.status).toBe('connected');
  });

  it('puts you at risk when you miss with an unbanked download', () => {
    const server = makeServer([['red', 4], ['green', 9]]);
    const afterHit = runWith(server, [dieOf('g', GREEN)]);
    const missingServer = makeServer([['red', 4], ['green', 9, 8]]);
    const missed = rollRun(afterHit, missingServer, [dieOf('g', GREEN)], createRng(2));
    expect(missed.status).toBe('missed');
  });

  it('banks the download when you jack out', () => {
    const server = makeServer([['green', 9]]);
    const run = jackOut(runWith(server, [dieOf('g', GREEN)]));
    expect(serverAfterRun(server, run).tracks[0].banked).toBe(1);
  });

  it('ends the run as downloaded when every file fills', () => {
    const server = makeServer([['green', 1]]);
    expect(runWith(server, [dieOf('g', GREEN)]).ending).toBe('downloaded');
  });
});

describe('missed rolls', () => {
  const missedRun: RunState = {
    serverId: 'srv',
    buffer: [5],
    rolls: 3,
    handshakeMinutes: 40,
    dumpshockMinutes: 0,
    isProxied: false,
    status: 'missed',
    ending: null,
    lastRoll: null,
  };

  it('loses the whole unbanked download on a flatline', () => {
    expect(flatline(missedRun, createRng(1)).buffer).toEqual([0]);
  });

  it('keeps half the unbanked download with Failsafe', () => {
    expect(flatlineWithFailsafe(missedRun, createRng(1)).buffer).toEqual([2]);
  });

  it('lets Black ICE burn a banked step when you flatline', () => {
    const server = makeServer([['blue', 8, 3]], ['blackIce']);
    const ended = flatline(missedRun, createRng(1));
    expect(serverAfterRun(server, ended).tracks[0].banked).toBe(2);
  });
});
