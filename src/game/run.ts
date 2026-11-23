import { MINUTES_PER_ROLL, REROUTE_MINUTES, TRACER_EXTRA_MINUTES, rollDumpshockMinutes, rollHandshakeMinutes } from './clock';
import type { Die } from './dice';
import type { Rng } from './random';
import { type DieResult, type RollOutcome, resolveRoll, rollDice } from './roll';
import {
  ALERT_PER_FLATLINE, ALERT_PER_VISIT, type Buffer, type Server, burnBankedStep, hasModifier, isAlertFull,
  isFullyDownloaded, purgeServer, raiseAlert, withBanked,
} from './server';

/**
 * connected: jacked in (or just rerouted), ready to roll. hit: last roll scored. blocked: last roll
 * missed but a Firewall face stopped it. missed: last roll scored nothing and the player may still
 * run a rescue program. over: the run has ended.
 */
export type RunStatus = 'connected' | 'hit' | 'blocked' | 'missed' | 'over';
export type RunEnding = 'jackedOut' | 'flatlined' | 'downloaded';

export interface RunState {
  readonly serverId: string;
  /** Banked blocks per track as this run sees them: the stake is taken out, anchors and reroutes go in. */
  readonly banked: Buffer;
  /** Blocks at risk: a miss loses all of them. */
  readonly buffer: Buffer;
  /** The blocks put at risk when the run started or was last rerouted. */
  readonly stake: Buffer;
  readonly rolls: number;
  readonly reroutes: number;
  readonly handshakeMinutes: number;
  readonly dumpshockMinutes: number;
  readonly isProxied: boolean;
  readonly status: RunStatus;
  readonly ending: RunEnding | null;
  readonly lastRoll: RollOutcome | null;
  readonly paydays: number;
}

/**
 * Every unfinished file starts a run with one block at risk: its last banked block, or a free one
 * from the handshake if nothing is banked. So even a run's first roll has something to lose.
 */
export function placeStake(server: Server, banked: Buffer): { banked: Buffer; stake: Buffer } {
  const tracks = server.tracks.map((track, index) => {
    const isFinished = banked[index] >= track.length;
    if (isFinished) return { banked: banked[index], stake: 0 };
    return { banked: Math.max(0, banked[index] - 1), stake: 1 };
  });
  return { banked: tracks.map((track) => track.banked), stake: tracks.map((track) => track.stake) };
}

export function startRun(server: Server, isProxied: boolean, rng: Rng): RunState {
  const { banked, stake } = placeStake(server, server.tracks.map((track) => track.banked));
  return {
    serverId: server.id,
    banked,
    buffer: stake,
    stake,
    rolls: 0,
    reroutes: 0,
    handshakeMinutes: rollHandshakeMinutes(rng),
    dumpshockMinutes: 0,
    isProxied,
    status: 'connected',
    ending: null,
    lastRoll: null,
    paydays: 0,
  };
}

/** The server as the run sees it right now, with this run's banked blocks. */
export function liveServer(server: Server, run: RunState): Server {
  return withBanked(server, run.banked);
}

function addBuffers(a: Buffer, b: Buffer): Buffer {
  return a.map((steps, index) => steps + b[index]);
}

function total(buffer: Buffer): number {
  return buffer.reduce((sum, steps) => sum + steps, 0);
}

export function canRoll(run: RunState): boolean {
  return run.status === 'connected' || run.status === 'hit' || run.status === 'blocked';
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
  const outcome = resolveRoll(liveServer(server, run), run.buffer, dice, rollDice(dice, rng));
  return applyOutcome({ ...run, rolls: run.rolls + 1 }, server, outcome);
}

function applyOutcome(run: RunState, server: Server, outcome: RollOutcome): RunState {
  const next: RunState = {
    ...run,
    banked: addBuffers(run.banked, outcome.anchored),
    buffer: outcome.buffer,
    lastRoll: outcome,
    paydays: run.paydays + outcome.paydays,
  };
  if (outcome.isHit) return settleHit(next, server);
  return { ...next, status: outcome.isBlocked ? 'blocked' : 'missed' };
}

function settleHit(run: RunState, server: Server): RunState {
  if (isFullyDownloaded(liveServer(server, run), run.buffer)) return { ...run, status: 'over', ending: 'downloaded' };
  return { ...run, status: 'hit' };
}

export function canSplice(run: RunState): boolean {
  return run.status === 'hit' && run.lastRoll !== null && run.lastRoll.results.some((result) => result.gain === 0);
}

/** Splice: dice that scored nothing on the last hit are rerolled and may add progress. */
export function spliceRoll(run: RunState, server: Server, dice: readonly Die[], rng: Rng): RunState {
  if (!canSplice(run) || run.lastRoll === null) throw new Error('Splice needs a hit with idle dice');
  const idleIds = new Set(run.lastRoll.results.filter((result) => result.gain === 0).map((result) => result.dieId));
  const idleDice = dice.filter((die) => idleIds.has(die.id));
  const spliced = resolveRoll(liveServer(server, run), run.buffer, idleDice, rollDice(idleDice, rng));
  const replacement = new Map<string, DieResult>(spliced.results.map((result) => [result.dieId, result]));
  const results = run.lastRoll.results.map((result) => replacement.get(result.dieId) ?? result);
  return applyOutcome(run, server, { ...spliced, results, isHit: true, isBlocked: false });
}

/** Blocks downloaded since the stake was placed, which a reroute would secure. */
export function downloadedSinceStake(run: RunState): number {
  return total(run.buffer) - total(run.stake);
}

export function canReroute(run: RunState): boolean {
  return (run.status === 'hit' || run.status === 'blocked') && downloadedSinceStake(run) > 0;
}

/** Banks the download without leaving the server; a fresh stake goes at risk as if you'd just connected. */
export function reroute(run: RunState, server: Server): RunState {
  if (!canReroute(run)) throw new Error('There is nothing new to reroute');
  const { banked, stake } = placeStake(server, addBuffers(run.banked, run.buffer));
  return { ...run, banked, buffer: stake, stake, reroutes: run.reroutes + 1, status: 'connected' };
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
  return endMissedRun(run, run.buffer.map(() => 0), rng);
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
