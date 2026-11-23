import { describe, expect, it } from 'vitest';
import { REROUTE_MINUTES } from './clock';
import { type Die, FIREWALL_FACE, type Face, PAYDAY_FACE, colorFace, createStandardDie, hitProbability, safeProbability } from './dice';
import { createRng } from './random';
import { resolveRoll } from './roll';
import {
  type RunState, canReroute, flatline, flatlineWithFailsafe, jackOut, reroute, rollRun, runMinutes, serverAfterRun,
  startRun,
} from './run';
import type { Color } from './dice';
import type { Server, ServerModifier } from './server';

function makeServer(tracks: [Color, number, number?][], modifiers: ServerModifier[] = [], alertLimit = 99): Server {
  return {
    id: 'srv',
    name: 'test',
    corp: 'test',
    tier: 1,
    reward: 100,
    tracks: tracks.map(([color, length, banked = 0]) => ({ color, length, banked })),
    modifiers,
    isRevealed: true,
    alert: 0,
    alertLimit,
  };
}

function dieOf(id: string, face: Face): Die {
  return { id, faces: Array.from({ length: 6 }, () => face) };
}

const RED = colorFace('red');
const GREEN = colorFace('green');
const WILD = colorFace('red', 'blue', 'green');
const RED_OR_BLUE = colorFace('red', 'blue');
const ANCHORED_GREEN: Face = { ...colorFace('green'), isAnchored: true };

const rng = () => createRng(1);

function start(server: Server): RunState {
  return startRun(server, false, rng());
}

function rollWith(run: RunState, server: Server, dice: Die[]): RunState {
  return rollRun(run, server, dice, rng());
}

describe('odds', () => {
  it('matches the 1/2/3 face split for three standard dice', () => {
    const dice = [0, 1, 2].map((index) => createStandardDie(`d${index}`));
    expect(hitProbability(dice, ['red'])).toBeCloseTo(1 - (5 / 6) ** 3);
  });

  it('counts a Firewall face as safe even though it never hits', () => {
    const die: Die = { id: 'f', faces: [RED, FIREWALL_FACE, GREEN, GREEN, GREEN, GREEN] };
    expect(safeProbability([die], ['red'])).toBeCloseTo(2 / 6);
  });
});

describe('resolveRoll', () => {
  it('stops feeding a file once it is full', () => {
    const server = makeServer([['red', 3, 2]]);
    const outcome = resolveRoll(server, [0], [dieOf('a', RED), dieOf('b', RED)], [0, 0]);
    expect(outcome.buffer).toEqual([1]);
  });

  it('sends wild faces to the file that still needs the most blocks', () => {
    const server = makeServer([['red', 3], ['green', 10]]);
    expect(resolveRoll(server, [0, 0], [dieOf('w', WILD)], [0]).buffer).toEqual([0, 1]);
  });

  it('sends a dual-color face only to files of its two colors', () => {
    const server = makeServer([['red', 3], ['green', 10]]);
    expect(resolveRoll(server, [0, 0], [dieOf('d', RED_OR_BLUE)], [0]).buffer).toEqual([1, 0]);
  });

  it('counts a roll as a miss when only finished files match', () => {
    const server = makeServer([['red', 2, 2], ['blue', 5]]);
    expect(resolveRoll(server, [0, 0], [dieOf('a', RED)], [0]).isHit).toBe(false);
  });

  it('keeps anchored blocks apart from the unbanked download', () => {
    const server = makeServer([['green', 9]]);
    const outcome = resolveRoll(server, [0], [dieOf('a', ANCHORED_GREEN)], [0]);
    expect([outcome.buffer, outcome.anchored]).toEqual([[0], [1]]);
  });

  it('lets a Firewall face block a miss', () => {
    const server = makeServer([['red', 4]]);
    expect(resolveRoll(server, [0], [dieOf('f', FIREWALL_FACE)], [0]).isBlocked).toBe(true);
  });

  it('counts every Payday face that shows', () => {
    const server = makeServer([['red', 4]]);
    expect(resolveRoll(server, [0], [dieOf('p', PAYDAY_FACE), dieOf('q', PAYDAY_FACE)], [0, 0]).paydays).toBe(2);
  });
});

describe('the stake', () => {
  it('puts a free block at risk in each file of an untouched server', () => {
    const run = start(makeServer([['red', 4], ['green', 9]]));
    expect([run.banked, run.buffer]).toEqual([[0, 0], [1, 1]]);
  });

  it('puts the last banked block of each file back at risk on a return visit', () => {
    const run = start(makeServer([['blue', 8, 3]]));
    expect([run.banked, run.buffer]).toEqual([[2], [1]]);
  });

  it('leaves finished files out of the stake', () => {
    const run = start(makeServer([['red', 3, 3], ['blue', 8, 2]]));
    expect(run.buffer).toEqual([0, 1]);
  });

  it('makes the very first roll able to flatline you', () => {
    const server = makeServer([['red', 4]]);
    expect(rollWith(start(server), server, [dieOf('g', GREEN)]).status).toBe('missed');
  });

  it('costs you the stake when you flatline on a return visit', () => {
    const server = makeServer([['red', 4, 2]]);
    const missed = rollWith(start(server), server, [dieOf('g', GREEN)]);
    expect(serverAfterRun(server, flatline(missed, rng())).tracks[0].banked).toBe(1);
  });

  it('gives the stake back when you jack out without rolling', () => {
    const server = makeServer([['red', 4, 2]]);
    expect(serverAfterRun(server, jackOut(start(server))).tracks[0].banked).toBe(2);
  });
});

describe('run flow', () => {
  it('banks the download when you jack out', () => {
    const server = makeServer([['green', 9]]);
    const run = jackOut(rollWith(start(server), server, [dieOf('g', GREEN)]));
    expect(serverAfterRun(server, run).tracks[0].banked).toBe(2);
  });

  it('ends the run as downloaded when every file fills', () => {
    const server = makeServer([['green', 2]]);
    expect(rollWith(start(server), server, [dieOf('g', GREEN)]).ending).toBe('downloaded');
  });

  it('keeps going after a miss a Firewall face blocked', () => {
    const server = makeServer([['red', 4]]);
    expect(rollWith(start(server), server, [dieOf('f', FIREWALL_FACE)]).status).toBe('blocked');
  });

  it('keeps anchored blocks through a flatline', () => {
    const server = makeServer([['red', 4], ['green', 9]]);
    const anchored = rollWith(start(server), server, [dieOf('a', ANCHORED_GREEN)]);
    const missed = rollWith(anchored, server, [dieOf('b', colorFace('blue'))]);
    expect(serverAfterRun(server, flatline(missed, rng())).tracks[1].banked).toBe(1);
  });
});

describe('rerouting', () => {
  const server = makeServer([['green', 9]]);
  const afterHit = rollWith(start(server), server, [dieOf('g', GREEN)]);

  it('needs something downloaded since the stake went down', () => {
    expect(canReroute(start(server))).toBe(false);
  });

  it('banks the download and puts a fresh stake at risk', () => {
    const rerouted = reroute(afterHit, server);
    expect([rerouted.banked, rerouted.buffer]).toEqual([[1], [1]]);
  });

  it('costs its own time instead of a handshake', () => {
    expect(runMinutes(reroute(afterHit, server), server) - runMinutes(afterHit, server)).toBe(REROUTE_MINUTES);
  });
});

describe('missed rolls', () => {
  const server = makeServer([['blue', 8, 3]], ['blackIce']);
  const missedRun: RunState = { ...start(server), buffer: [5], status: 'missed' };

  it('loses the whole unbanked download on a flatline', () => {
    expect(flatline(missedRun, rng()).buffer).toEqual([0]);
  });

  it('keeps half the unbanked download with Failsafe', () => {
    expect(flatlineWithFailsafe(missedRun, rng()).buffer).toEqual([2]);
  });

  it('lets Black ICE burn a banked block when you flatline', () => {
    expect(serverAfterRun(server, flatline(missedRun, rng())).tracks[0].banked).toBe(1);
  });
});

describe('server alert', () => {
  it('rises by one for a visit you jack out of', () => {
    const server = makeServer([['green', 9]]);
    expect(serverAfterRun(server, jackOut(start(server))).alert).toBe(1);
  });

  it('rises by two when you get flatlined', () => {
    const server = makeServer([['red', 4]]);
    const missed = rollWith(start(server), server, [dieOf('g', GREEN)]);
    expect(serverAfterRun(server, flatline(missed, rng())).alert).toBe(2);
  });

  it('purges every banked block once it fills', () => {
    const server = { ...makeServer([['blue', 8, 5]], [], 3), alert: 2 };
    const after = serverAfterRun(server, jackOut(start(server)));
    expect([after.tracks[0].banked, after.alert]).toEqual([0, 0]);
  });
});
