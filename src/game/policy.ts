import { DUMPSHOCK_MINUTES } from './clock';
import { type Die, expectedProgress, safeProbability } from './dice';
import { type Buffer, type Server, hasModifier, openColors, remainingSteps } from './server';

/**
 * Multiplier on the expected gain of another roll. Above 1 pushes harder than the
 * break-even point, below 1 is cautious. Tuned by `npm run calibrate` to minimise
 * the time a server takes with the starting rig.
 */
export const REFERENCE_RISK_APPETITE = 0.8;

/** Rough minutes a banked step is worth to a starting rig; turns dumpshock time into steps. */
const MINUTES_PER_STEP_ESTIMATE = 25;
const DUMPSHOCK_STEP_COST = (DUMPSHOCK_MINUTES.min + DUMPSHOCK_MINUTES.max) / 2 / MINUTES_PER_STEP_ESTIMATE;

export interface RollDecisionInput {
  /** The server as the run sees it, with the run's own banked blocks. */
  readonly server: Server;
  readonly buffer: Buffer;
  readonly dice: readonly Die[];
}

/** Probability the next roll doesn't get you caught: it scores on an unfinished file, or a Firewall face blocks the miss. */
export function nextSafeProbability({ server, buffer, dice }: RollDecisionInput): number {
  return safeProbability(dice, openColors(server, buffer));
}

/** Expected steps from one more roll, capped by what each file can still take. */
export function expectedCappedGain({ server, buffer, dice }: RollDecisionInput): number {
  return server.tracks.reduce((total, track, index) => {
    const remaining = remainingSteps(track, buffer[index]);
    return total + Math.min(remaining, expectedProgress(dice, remaining > 0 ? [track.color] : []));
  }, 0);
}

/** Everything a miss would cost right now, in steps. */
export function expectedMissCost(input: RollDecisionInput): number {
  const buffered = input.buffer.reduce((sum, steps) => sum + steps, 0);
  const iceLoss = hasModifier(input.server, 'blackIce') ? input.server.tracks.length : 0;
  return buffered + iceLoss + DUMPSHOCK_STEP_COST;
}

/** Reference push-your-luck rule used to price servers and drive the balance bots. */
export function shouldKeepRolling(input: RollDecisionInput, riskAppetite = REFERENCE_RISK_APPETITE): boolean {
  if (input.buffer.every((steps) => steps === 0)) return true;
  const missChance = 1 - nextSafeProbability(input);
  return expectedCappedGain(input) * riskAppetite > missChance * expectedMissCost(input);
}
