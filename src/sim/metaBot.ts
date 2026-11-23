/**
 * A competent-but-simple bot that plays whole campaigns, for the balance tools.
 * It never sees hidden server details it hasn't revealed.
 */
import { acceptFlatline, bankAndJackOut, jackIn, roll, takeSplit, useBounce, useFailsafe, waitForDawn } from '../game/actions';
import { type CampaignState, findServer, isProgramReady, newCampaign, vigForNight } from '../game/campaign';
import { isDawn } from '../game/clock';
import { settleDawn } from '../game/dawn';
import { simulateDownload } from '../game/difficulty';
import { chooseReferenceSplit, shouldKeepRolling } from '../game/policy';
import { createRng } from '../game/random';
import { type Server, remainingValue } from '../game/server';
import { buyProgram } from '../game/shop';

const UNREVEALED_PAY_PER_MINUTE_GUESS = 1;
const ESTIMATE_TRIALS = 20;
const BOUNCE_PRICE = 500;

export interface CampaignResult {
  readonly outcome: 'won' | 'lost';
  readonly nightReached: number;
  readonly strikes: number;
  readonly filesSold: number;
}

function estimateMinutes(state: CampaignState, server: Server): number {
  if (!server.isRevealed) return remainingValue(server) / UNREVEALED_PAY_PER_MINUTE_GUESS;
  const rng = createRng(state.rngState ^ 0x5bd1e995);
  let total = 0;
  for (let trial = 0; trial < ESTIMATE_TRIALS; trial++) {
    const result = simulateDownload(server, { dice: state.dice, rng });
    if (result === null) return Infinity;
    total += result.minutes;
  }
  return total / ESTIMATE_TRIALS;
}

function chooseServer(state: CampaignState): Server {
  let best = state.board[0];
  let bestRate = -Infinity;
  for (const server of state.board) {
    const rate = remainingValue(server) / Math.max(30, estimateMinutes(state, server));
    if (rate > bestRate) {
      best = server;
      bestRate = rate;
    }
  }
  return best;
}

function shop(state: CampaignState): CampaignState {
  const reserve = vigForNight(state.night) * 0.6;
  const canAffordBounce = state.money - BOUNCE_PRICE >= reserve;
  return !state.ownedPrograms.includes('bounce') && canAffordBounce ? buyProgram(state, 'bounce') : state;
}

function playRun(state: CampaignState): CampaignState {
  let current = jackIn(state, chooseServer(state).id, false);
  while (current.phase === 'run' && current.run !== null) {
    const run = current.run;
    const server = findServer(current, run.serverId);
    if (run.status === 'missed') {
      if (isProgramReady(current, 'bounce')) current = useBounce(current);
      else if (isProgramReady(current, 'failsafe')) current = useFailsafe(current);
      else current = acceptFlatline(current);
    } else if (run.status === 'choosing') {
      const pick = chooseReferenceSplit(run, server, current.dice);
      current = takeSplit(current, pick.splitIndex, pick.choiceIndex);
    } else if (shouldKeepRolling(run, server, current.dice)) {
      current = roll(current);
    } else {
      current = bankAndJackOut(current);
    }
  }
  return current;
}

export function playCampaign(seed: number): CampaignResult {
  let state = newCampaign(seed);
  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (state.phase === 'dawn') state = settleDawn(state);
    else if (isDawn(state.minutes)) state = waitForDawn(state);
    else state = playRun(shop(state));
  }
  return { outcome: state.phase, nightReached: state.night, strikes: state.strikes, filesSold: state.stats.filesSold };
}
