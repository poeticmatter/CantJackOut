import { type Die, createStandardDie } from './dice';
import { REFERENCE_RISK_APPETITE, shouldKeepRolling } from './policy';
import { type Rng, createRng } from './random';
import { type RunState, canRoll, flatline, jackOut, rollRun, runMinutes, serverAfterRun, startRun } from './run';
import { type Server, isFullyDownloaded } from './server';

export const STARTING_DICE_COUNT = 3;

/** Rewards are always priced against the starting rig, so upgrades make every server pay better per hour. */
export const REFERENCE_DICE: readonly Die[] = Array.from({ length: STARTING_DICE_COUNT }, (_, index) =>
  createStandardDie(`reference-${index}`),
);

const MAX_SIMULATED_RUNS = 400;

export interface DownloadSimulation {
  readonly runs: number;
  readonly minutes: number;
  readonly flatlines: number;
}

export interface DownloadSimulationOptions {
  readonly dice: readonly Die[];
  readonly rng: Rng;
  readonly riskAppetite?: number;
}

export function playReferenceRun(server: Server, dice: readonly Die[], rng: Rng, riskAppetite: number): RunState {
  let run = startRun(server, false, rng);
  while (canRoll(run)) {
    const isPushing = run.status === 'connected' || shouldKeepRolling({ server, buffer: run.buffer, dice }, riskAppetite);
    run = isPushing ? rollRun(run, server, dice, rng) : jackOut(run);
  }
  return run.status === 'missed' ? flatline(run, rng) : run;
}

export function simulateDownload(start: Server, options: DownloadSimulationOptions): DownloadSimulation {
  const riskAppetite = options.riskAppetite ?? REFERENCE_RISK_APPETITE;
  let server = start;
  let runs = 0;
  let minutes = 0;
  let flatlines = 0;
  while (!isFullyDownloaded(server, server.tracks.map(() => 0))) {
    if (runs >= MAX_SIMULATED_RUNS) throw new Error(`Server ${server.id} did not finish in ${MAX_SIMULATED_RUNS} runs`);
    const run = playReferenceRun(server, options.dice, options.rng, riskAppetite);
    runs++;
    minutes += runMinutes(run, server);
    if (run.ending === 'flatlined') flatlines++;
    server = serverAfterRun(server, run);
  }
  return { runs, minutes, flatlines };
}

export function averageDownload(server: Server, trials: number, seed: number, riskAppetite?: number): DownloadSimulation {
  const rng = createRng(seed);
  const totals = { runs: 0, minutes: 0, flatlines: 0 };
  for (let trial = 0; trial < trials; trial++) {
    const result = simulateDownload(server, { dice: REFERENCE_DICE, rng, riskAppetite });
    totals.runs += result.runs;
    totals.minutes += result.minutes;
    totals.flatlines += result.flatlines;
  }
  return { runs: totals.runs / trials, minutes: totals.minutes / trials, flatlines: totals.flatlines / trials };
}
