import { MINUTES_PER_ROLL, TRACER_EXTRA_MINUTES, rollDumpshockMinutes, rollHandshakeMinutes } from './clock';
import type { Die } from './dice';
import type { Rng } from './random';
import { type DieResult, type RollOutcome, resolveRoll, rollDice } from './roll';
import { type Buffer, type Server, bankBuffer, burnBankedStep, emptyBuffer, hasModifier, isFullyDownloaded } from './server';

/**
 * connected: jacked in, nothing rolled yet. hit: last roll scored. missed: last roll scored
 * nothing and the player may still run a rescue program. over: the run has ended.
 */
export type RunStatus = 'connected' | 'hit' | 'missed' | 'over';
export type RunEnding = 'jackedOut' | 'flatlined' | 'downloaded';

export interface RunState {
  readonly serverId: string;
  readonly buffer: Buffer;
  readonly rolls: number;
  readonly handshakeMinutes: number;
  readonly dumpshockMinutes: number;
  readonly isProxied: boolean;
  readonly status: RunStatus;
  readonly ending: RunEnding | null;
  readonly lastRoll: RollOutcome | null;
}

export function startRun(server: Server, isProxied: boolean, rng: Rng): RunState {
  return {
    serverId: server.id,
    buffer: emptyBuffer(server),
    rolls: 0,
    handshakeMinutes: rollHandshakeMinutes(rng),
    dumpshockMinutes: 0,
    isProxied,
    status: 'connected',
    ending: null,
    lastRoll: null,
  };
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
  const outcome = resolveRoll(server, run.buffer, dice, rollDice(dice, rng));
  const rolled = { ...run, rolls: run.rolls + 1, lastRoll: outcome };
  // Mirrors Can't Stop's safe opening roll: with nothing downloaded yet there is nothing
  // for ICE to catch, so a miss only costs the roll's time.
  if (!outcome.isHit && !hasUnbankedProgress(run)) return { ...rolled, status: 'connected' };
  if (!outcome.isHit) return { ...rolled, status: 'missed' };
  return settleHit(rolled, server, outcome.buffer);
}

function settleHit(run: RunState, server: Server, buffer: Buffer): RunState {
  if (isFullyDownloaded(server, buffer)) return { ...run, buffer, status: 'over', ending: 'downloaded' };
  return { ...run, buffer, status: 'hit' };
}

export function hasUnbankedProgress(run: RunState): boolean {
  return run.buffer.some((steps) => steps > 0);
}

export function canSplice(run: RunState): boolean {
  return run.status === 'hit' && run.lastRoll !== null && run.lastRoll.results.some((result) => result.gain === 0);
}

/** Splice: dice that scored nothing on the last hit are rerolled and may add progress. */
export function spliceRoll(run: RunState, server: Server, dice: readonly Die[], rng: Rng): RunState {
  if (!canSplice(run) || run.lastRoll === null) throw new Error('Splice needs a hit with idle dice');
  const idleIds = new Set(run.lastRoll.results.filter((result) => result.gain === 0).map((result) => result.dieId));
  const idleDice = dice.filter((die) => idleIds.has(die.id));
  const spliced = resolveRoll(server, run.buffer, idleDice, rollDice(idleDice, rng));
  const replacement = new Map<string, DieResult>(spliced.results.map((result) => [result.dieId, result]));
  const results = run.lastRoll.results.map((result) => replacement.get(result.dieId) ?? result);
  const lastRoll: RollOutcome = { results, buffer: spliced.buffer, isHit: true };
  return settleHit({ ...run, lastRoll }, server, spliced.buffer);
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
  const total = run.handshakeMinutes + run.rolls * MINUTES_PER_ROLL + run.dumpshockMinutes + tracer;
  return run.isProxied ? Math.ceil(total / 2) : total;
}

/** The server as it stands once a finished run's download is banked (and any ICE has bitten). */
export function serverAfterRun(server: Server, run: RunState): Server {
  if (run.status !== 'over') throw new Error('Only a finished run can be applied to its server');
  const banked = bankBuffer(server, run.buffer);
  const isCaughtByIce = run.ending === 'flatlined' && hasModifier(server, 'blackIce');
  return isCaughtByIce ? burnBankedStep(banked) : banked;
}
