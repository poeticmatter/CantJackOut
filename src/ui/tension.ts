/**
 * How close the run feels to going wrong, from 0 (calm) to 1 (about to be caught).
 * Pure presentation: the rules never read it.
 */
export interface TraceInputs {
  readonly blocksAtRisk: number;
  /** Chance the next roll doesn't miss. */
  readonly safeChance: number;
  readonly alert: number;
  readonly alertLimit: number;
}

/** Blocks at risk where the stake term reaches about 63% of its weight. */
const STAKE_SCALE = 5;
const STAKE_WEIGHT = 0.7;
const ALERT_WEIGHT = 0.3;
/** Even a safe-looking roll carries half the stake's tension; a coin flip carries all of it. */
const BASE_DANGER = 0.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function traceLevel(inputs: TraceInputs): number {
  const stake = 1 - Math.exp(-Math.max(0, inputs.blocksAtRisk) / STAKE_SCALE);
  const danger = 1 - clamp01(inputs.safeChance);
  const alert = inputs.alertLimit > 0 ? clamp01(inputs.alert / inputs.alertLimit) : 0;
  return clamp01(STAKE_WEIGHT * stake * (BASE_DANGER + danger) + ALERT_WEIGHT * alert);
}
