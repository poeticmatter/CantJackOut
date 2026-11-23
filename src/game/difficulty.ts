import { type Die, createStandardDie } from './dice';
import { DICE_PER_ROLL } from './pairing';
import { REFERENCE_RISK_APPETITE, chooseReferenceMove, shouldKeepRolling } from './policy';
import { type Rng, createRng } from './random';
import { type RunState, applyChoice, canRoll, flatline, jackOut, rollRun, runMinutes, serverAfterRun, startRun } from './run';
import { type Server, isFullyDownloaded } from './server';

export const REFERENCE_DICE: readonly Die[] = Array.from({ length: DICE_PER_ROLL }, (_, index) =>
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

/** One run by the reference player: roll, take its favorite move, and jack out when the push rule says so. */
export function playReferenceRun(server: Server, dice: readonly Die[], rng: Rng, riskAppetite: number): RunState {
  let run = startRun(server, false, rng);
  for (;;) {
    if (run.status === 'choosing') {
      run = applyChoice(run, server, chooseReferenceMove(run, server, dice));
    } else if (canRoll(run)) {
      run = shouldKeepRolling(run, server, dice, riskAppetite) ? rollRun(run, server, dice, rng) : jackOut(run);
    } else {
      return run.status === 'missed' ? flatline(run, rng) : run;
    }
  }
}

/** Plays a server to completion, or returns null if it takes more runs than any player would spend. */
export function simulateDownload(start: Server, options: DownloadSimulationOptions): DownloadSimulation | null {
  const riskAppetite = options.riskAppetite ?? REFERENCE_RISK_APPETITE;
  let server = start;
  let runs = 0;
  let minutes = 0;
  let flatlines = 0;
  while (!isFullyDownloaded(server)) {
    if (runs >= MAX_SIMULATED_RUNS) return null;
    const run = playReferenceRun(server, options.dice, options.rng, riskAppetite);
    runs++;
    minutes += runMinutes(run, server);
    if (run.ending === 'flatlined') flatlines++;
    server = serverAfterRun(server, run);
  }
  return { runs, minutes, flatlines };
}

/** Averages over many plays. A server that sometimes can't be finished averages to infinity. */
export function averageDownload(server: Server, trials: number, seed: number, riskAppetite?: number): DownloadSimulation {
  const rng = createRng(seed);
  const totals = { runs: 0, minutes: 0, flatlines: 0 };
  for (let trial = 0; trial < trials; trial++) {
    const result = simulateDownload(server, { dice: REFERENCE_DICE, rng, riskAppetite });
    if (result === null) return { runs: Infinity, minutes: Infinity, flatlines: Infinity };
    totals.runs += result.runs;
    totals.minutes += result.minutes;
    totals.flatlines += result.flatlines;
  }
  return { runs: totals.runs / trials, minutes: totals.minutes / trials, flatlines: totals.flatlines / trials };
}
