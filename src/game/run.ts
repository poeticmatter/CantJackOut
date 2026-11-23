import { MINUTES_PER_ROLL, REROUTE_MINUTES, TRACER_EXTRA_MINUTES, rollDumpshockMinutes, rollHandshakeMinutes } from './clock';
import type { Die } from './dice';
import { FILE_IDS, type FileId, fileIndex } from './files';
import { type StreamContext, streamsAfter } from './pairing';
import type { Rng } from './random';
import { type RollChoice, type RollRecord, chosenFiles, isMissedRoll, rollDice } from './roll';
import {
  ALERT_PER_FLATLINE, ALERT_PER_VISIT, type Buffer, type Server, burnBankedStep, emptyBuffer, fullFiles, hasModifier,
  isAlertFull, purgeServer, raiseAlert, remainingSteps, withBanked,
} from './server';

/**
 * connected: jacked in (or just rerouted), ready to roll. choosing: the dice are down and the
 * player picks a split, or a file for a jackpot. hit: the split is applied. missed: no split was usable and the player
 * may still run a rescue program. over: the run has ended.
 */
export type RunStatus = 'connected' | 'choosing' | 'hit' | 'missed' | 'over';
export type RunEnding = 'jackedOut' | 'flatlined' | 'downloaded';

export interface RunState {
  readonly serverId: string;
  /** Banked blocks per file as this run sees them: reroutes add to them. */
  readonly banked: Buffer;
  /** Blocks at risk: a miss loses all of them. */
  readonly buffer: Buffer;
  /** Files this run is working on since it connected or last rerouted. */
  readonly streams: readonly FileId[];
  readonly rolls: number;
  readonly reroutes: number;
  readonly handshakeMinutes: number;
  readonly dumpshockMinutes: number;
  readonly isProxied: boolean;
  readonly status: RunStatus;
  readonly ending: RunEnding | null;
  readonly lastRoll: RollRecord | null;
}

export function startRun(server: Server, isProxied: boolean, rng: Rng): RunState {
  return {
    serverId: server.id,
    banked: server.files.map((file) => file.banked),
    buffer: emptyBuffer(),
    streams: [],
    rolls: 0,
    reroutes: 0,
    handshakeMinutes: rollHandshakeMinutes(rng),
    dumpshockMinutes: 0,
    isProxied,
    status: 'connected',
    ending: null,
    lastRoll: null,
  };
}

/** The server as the run sees it right now, with this run's banked blocks. */
export function liveServer(server: Server, run: RunState): Server {
  return withBanked(server, run.banked);
}

export function streamContext(run: RunState, server: Server): StreamContext {
  return { streams: run.streams, fullFiles: fullFiles(liveServer(server, run), run.buffer) };
}

function addBuffers(a: Buffer, b: Buffer): Buffer {
  return a.map((steps, index) => steps + b[index]);
}

/** Blocks a miss would lose right now. */
export function blocksAtRisk(run: RunState): number {
  return run.buffer.reduce((sum, steps) => sum + steps, 0);
}

export function canRoll(run: RunState): boolean {
  return run.status === 'connected' || run.status === 'hit';
}

export function rollRun(run: RunState, server: Server, dice: readonly Die[], rng: Rng): RunState {
  if (!canRoll(run)) throw new Error(`Cannot roll while the run is ${run.status}`);
  return applyFreshRoll(run, server, dice, rng);
}

/** Bounce: a missed roll is replaced by a full reroll. */
export function bounceMiss(run: RunState, server: Server, dice: readonly Die[], rng: Rng): RunState {
  if (run.status !== 'missed') throw new Error('Bounce only works on a missed roll');
  return applyFreshRoll(run, server, dice, rng);
}

function applyFreshRoll(run: RunState, server: Server, dice: readonly Die[], rng: Rng): RunState {
  const lastRoll = rollDice(dice, rng, streamContext(run, server));
  return { ...run, rolls: run.rolls + 1, lastRoll, status: isMissedRoll(lastRoll) ? 'missed' : 'choosing' };
}

/** Applies the player's choice for the roll: each usable pair, or the jackpot, downloads a block. */
export function applyChoice(run: RunState, server: Server, choice: RollChoice): RunState {
  if (run.status !== 'choosing' || run.lastRoll === null) throw new Error('There is no roll to choose for');
  if (choice.kind === 'jackpot' && !run.lastRoll.jackpotFiles.includes(choice.file)) {
    throw new Error(`The jackpot can’t reach ${choice.file}`);
  }
  const files = chosenFiles(run.lastRoll, choice);
  const live = liveServer(server, run);
  const buffer = files.reduce((next, file) => {
    const index = fileIndex(file);
    const room = remainingSteps(live.files[index], next[index]);
    return next.map((steps, position) => (position === index ? steps + Math.min(1, room) : steps));
  }, run.buffer);
  const next: RunState = {
    ...run,
    buffer,
    streams: streamsAfter(run.streams, files),
    lastRoll: { ...run.lastRoll, chosen: choice },
    status: 'hit',
  };
  const isEverythingFull = fullFiles(live, buffer).length === FILE_IDS.length;
  return isEverythingFull ? { ...next, status: 'over', ending: 'downloaded' } : next;
}

export function chooseSplit(run: RunState, server: Server, splitIndex: number, choiceIndex: number): RunState {
  return applyChoice(run, server, { kind: 'split', splitIndex, choiceIndex });
}

export function chooseJackpotFile(run: RunState, server: Server, file: FileId): RunState {
  return applyChoice(run, server, { kind: 'jackpot', file });
}

export function canReroute(run: RunState): boolean {
  return run.status === 'hit' && blocksAtRisk(run) > 0;
}

/** Banks the download without leaving the server; the run's streams are free again. */
export function reroute(run: RunState): RunState {
  if (!canReroute(run)) throw new Error('There is nothing new to reroute');
  return {
    ...run,
    banked: addBuffers(run.banked, run.buffer),
    buffer: emptyBuffer(),
    streams: [],
    reroutes: run.reroutes + 1,
    status: 'connected',
  };
}

export function canJackOut(run: RunState): boolean {
  return canRoll(run);
}

export function jackOut(run: RunState): RunState {
  if (!canJackOut(run)) throw new Error(`Cannot jack out while the run is ${run.status}`);
  return { ...run, status: 'over', ending: 'jackedOut' };
}

/** Accept the miss: the unbanked download is lost and dumpshock costs extra time. */
export function flatline(run: RunState, rng: Rng): RunState {
  return endMissedRun(run, emptyBuffer(), rng);
}

/** Failsafe: like a flatline, but half of each file's unbanked progress survives. */
export function flatlineWithFailsafe(run: RunState, rng: Rng): RunState {
  return endMissedRun(run, run.buffer.map((steps) => Math.floor(steps / 2)), rng);
}

function endMissedRun(run: RunState, keptBuffer: Buffer, rng: Rng): RunState {
  if (run.status !== 'missed') throw new Error('Only a missed roll can flatline');
  return { ...run, buffer: keptBuffer, status: 'over', ending: 'flatlined', dumpshockMinutes: rollDumpshockMinutes(rng) };
}

export function runMinutes(run: RunState, server: Server): number {
  const tracer = hasModifier(server, 'tracer') ? TRACER_EXTRA_MINUTES : 0;
  const total = run.handshakeMinutes + run.rolls * MINUTES_PER_ROLL + run.reroutes * REROUTE_MINUTES + run.dumpshockMinutes + tracer;
  return run.isProxied ? Math.ceil(total / 2) : total;
}

export interface RunAftermath {
  readonly server: Server;
  readonly isIceBurned: boolean;
  readonly isPurged: boolean;
}

/** What a finished run leaves behind: banked blocks, any Black ICE damage, and the raised alert. */
export function runAftermath(server: Server, run: RunState): RunAftermath {
  if (run.status !== 'over') throw new Error('Only a finished run can be applied to its server');
  const isFlatlined = run.ending === 'flatlined';
  const banked = withBanked(server, addBuffers(run.banked, run.buffer));
  const isIceBurned = isFlatlined && hasModifier(server, 'blackIce');
  const iced = isIceBurned ? burnBankedStep(banked) : banked;
  const alerted = raiseAlert(iced, ALERT_PER_VISIT + (isFlatlined ? ALERT_PER_FLATLINE : 0));
  const isPurged = run.ending !== 'downloaded' && isAlertFull(alerted);
  return { server: isPurged ? purgeServer(alerted) : alerted, isIceBurned, isPurged };
}

export function serverAfterRun(server: Server, run: RunState): Server {
  return runAftermath(server, run).server;
}
