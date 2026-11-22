import { generateServerForNight } from './board';
import {
  type CampaignState, allocateId, findServer, loadoutDice, spendCharge, withRng,
} from './campaign';
import { isDawn } from './clock';
import type { Rng } from './random';
import {
  type RunState, bounceMiss, flatline, flatlineWithFailsafe, jackOut, rollRun, runMinutes, serverAfterRun,
  spliceRoll, startRun,
} from './run';
import { type Server, isFullyDownloaded } from './server';

export function canJackIn(state: CampaignState): boolean {
  return state.phase === 'net' && state.loadout.diceIds.length > 0 && !isDawn(state.minutes);
}

export function jackIn(state: CampaignState, serverId: string, useProxy: boolean): CampaignState {
  if (!canJackIn(state)) throw new Error('You cannot jack in right now');
  const charged = useProxy ? spendCharge(state, 'proxy') : state;
  return withRng(charged, (rng) => {
    const server = findServer(charged, serverId);
    const revealed: Server = { ...server, isRevealed: true };
    return {
      ...replaceServer(charged, revealed),
      phase: 'run',
      run: startRun(revealed, useProxy, rng),
      lastRunReport: null,
    };
  });
}

export function deepScan(state: CampaignState, serverId: string): CampaignState {
  const charged = spendCharge(state, 'deepScan');
  return replaceServer(charged, { ...findServer(charged, serverId), isRevealed: true });
}

function activeRun(state: CampaignState): RunState {
  if (state.phase !== 'run' || state.run === null) throw new Error('No run in progress');
  return state.run;
}

/** Applies an in-run step, then closes the run out if that step ended it. */
function stepRun(state: CampaignState, step: (run: RunState, server: Server, rng: Rng) => RunState): CampaignState {
  const run = activeRun(state);
  return withRng(state, (rng) => {
    const server = findServer(state, run.serverId);
    const next = step(run, server, rng);
    const updated = { ...state, run: next };
    return next.status === 'over' ? finishRun(updated, rng) : updated;
  });
}

export function roll(state: CampaignState): CampaignState {
  return stepRun(state, (run, server, rng) => rollRun(run, server, loadoutDice(state), rng));
}

export function bankAndJackOut(state: CampaignState): CampaignState {
  return stepRun(state, (run) => jackOut(run));
}

export function acceptFlatline(state: CampaignState): CampaignState {
  return stepRun(state, (run, _server, rng) => flatline(run, rng));
}

export function useBounce(state: CampaignState): CampaignState {
  const charged = spendCharge(state, 'bounce');
  return stepRun(charged, (run, server, rng) => bounceMiss(run, server, loadoutDice(state), rng));
}

export function useFailsafe(state: CampaignState): CampaignState {
  const charged = spendCharge(state, 'failsafe');
  return stepRun(charged, (run, _server, rng) => flatlineWithFailsafe(run, rng));
}

export function useSplice(state: CampaignState): CampaignState {
  const charged = spendCharge(state, 'splice');
  return stepRun(charged, (run, server, rng) => spliceRoll(run, server, loadoutDice(state), rng));
}

function finishRun(state: CampaignState, rng: Rng): CampaignState {
  const run = activeRun(state);
  const server = findServer(state, run.serverId);
  const minutes = runMinutes(run, server);
  const updatedServer = serverAfterRun(server, run);
  const isDownloaded = isFullyDownloaded(updatedServer, updatedServer.tracks.map(() => 0));
  const payout = isDownloaded ? server.reward : 0;
  const isFlatlined = run.ending === 'flatlined';
  const afterServer = isDownloaded
    ? replaceWithFreshServer(state, server.id, rng)
    : replaceServer(state, updatedServer);
  const stats = afterServer.stats;
  return {
    ...afterServer,
    phase: isDawn(state.minutes + minutes) ? 'dawn' : 'net',
    minutes: state.minutes + minutes,
    money: state.money + payout,
    run: null,
    lastRunReport: {
      serverName: `${server.corp} ${server.name}`,
      ending: isDownloaded ? 'downloaded' : (run.ending ?? 'jackedOut'),
      minutes,
      stepsBanked: run.buffer.reduce((sum, steps) => sum + steps, 0),
      payout,
      iceBurned: isFlatlined && server.modifiers.includes('blackIce'),
      finalRun: run,
      serverBefore: server,
    },
    stats: {
      serversCracked: stats.serversCracked + (isDownloaded ? 1 : 0),
      earned: stats.earned + payout,
      runs: stats.runs + 1,
      flatlines: stats.flatlines + (isFlatlined ? 1 : 0),
    },
  };
}

export function replaceServer(state: CampaignState, server: Server): CampaignState {
  return { ...state, board: state.board.map((existing) => (existing.id === server.id ? server : existing)) };
}

export function replaceWithFreshServer(state: CampaignState, serverId: string, rng: Rng): CampaignState {
  const [id, allocated] = allocateId(state, 'srv');
  const fresh = generateServerForNight(id, state.night, rng);
  return { ...allocated, board: allocated.board.map((existing) => (existing.id === serverId ? fresh : existing)) };
}

/** Lets the player call it a night early, e.g. when nothing on the board is worth the time. */
export function waitForDawn(state: CampaignState): CampaignState {
  if (state.phase !== 'net') throw new Error('You can only wait for dawn between runs');
  return { ...state, phase: 'dawn' };
}
