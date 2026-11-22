import { type Rng, randomInt } from './random';

/** A night runs from 22:00 to 06:00. Any run started before dawn is allowed to finish. */
export const NIGHT_MINUTES = 8 * 60;
const NIGHT_START_HOUR = 22;

/**
 * Each run's fixed cost is random so the last run before dawn is never certain.
 * That keeps "this is my final run, so push no matter what" from being a known situation.
 */
export const HANDSHAKE_MINUTES = { min: 30, max: 60 } as const;
export const MINUTES_PER_ROLL = 4;
export const DUMPSHOCK_MINUTES = { min: 20, max: 40 } as const;
export const TRACER_EXTRA_MINUTES = 30;

export function rollHandshakeMinutes(rng: Rng): number {
  return randomInt(rng, HANDSHAKE_MINUTES.min, HANDSHAKE_MINUTES.max);
}

export function rollDumpshockMinutes(rng: Rng): number {
  return randomInt(rng, DUMPSHOCK_MINUTES.min, DUMPSHOCK_MINUTES.max);
}

export function isDawn(minutesElapsed: number): boolean {
  return minutesElapsed >= NIGHT_MINUTES;
}

export function formatClock(minutesElapsed: number): string {
  const totalMinutes = NIGHT_START_HOUR * 60 + Math.min(minutesElapsed, NIGHT_MINUTES);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
