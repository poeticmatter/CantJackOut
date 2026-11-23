import { generateServerForNight } from './board';
import { type CampaignState, allocateId, findServer, spendCharge, withRng } from './campaign';
import { isDawn } from './clock';
import type { Rng } from './random';
import {
  type RunState, bounceMiss, chooseSplit, flatline, flatlineWithFailsafe, jackOut, reroute, rollRun, runAftermath,
  runMinutes, startRun,
} from './run';
import { type Server, isFileFinished, isFullyDownloaded } from './server';

/** Roughly what the half hour a reroute saves over a fresh handshake is worth at each tier. */
const REROUTE_PRICE_BY_TIER: Record<number, number> = { 1: 30, 2: 40, 3: 50, 4: 60, 5: 70 };

export function canJackIn(state: CampaignState): boolean {
  return state.phase === 'net' && !isDawn(state.minutes);
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
  return stepRun(state, (run, server, rng) => rollRun(run, server, state.dice, rng));
}

export function takeSplit(state: CampaignState, splitIndex: number, choiceIndex: number): CampaignState {
  return stepRun(state, (run, server) => chooseSplit(run, server, splitIndex, choiceIndex));
}

export function bankAndJackOut(state: CampaignState): CampaignState {
  return stepRun(state, (run) => jackOut(run));
}

export function acceptFlatline(state: CampaignState): CampaignState {
  return stepRun(state, (run, _server, rng) => flatline(run, rng));
}

export function useBounce(state: CampaignState): CampaignState {
  const charged = spendCharge(state, 'bounce');
  return stepRun(charged, (run, server, rng) => bounceMiss(run, server, state.dice, rng));
}

export function useFailsafe(state: CampaignState): CampaignState {
  const charged = spendCharge(state, 'failsafe');
  return stepRun(charged, (run, _server, rng) => flatlineWithFailsafe(run, rng));
}

export function reroutePrice(server: Server): number {
  return REROUTE_PRICE_BY_TIER[server.tier];
}

/** Pay to bank this run's download in place and free the streams, without a fresh handshake. */
export function rerouteRun(state: CampaignState): CampaignState {
  const price = reroutePrice(findServer(state, activeRun(state).serverId));
  if (state.money < price) throw new Error(`Rerouting costs $${price}; you have $${state.money}`);
  return stepRun({ ...state, money: state.money - price }, (run) => reroute(run));
}

function finishRun(state: CampaignState, rng: Rng): CampaignState {
  const run = activeRun(state);
  const server = findServer(state, run.serverId);
  const minutes = runMinutes(run, server);
  const aftermath = runAftermath(server, run);
  const soldFiles = aftermath.server.files.filter((file, index) => isFileFinished(file) && !isFileFinished(server.files[index]));
  const payout = soldFiles.reduce((sum, file) => sum + file.payout, 0);
  const isCracked = isFullyDownloaded(aftermath.server);
  const afterServer = isCracked ? replaceWithFreshServer(state, server.id, rng) : replaceServer(state, aftermath.server);
  const stats = afterServer.stats;
  return {
    ...afterServer,
    phase: isDawn(state.minutes + minutes) ? 'dawn' : 'net',
    minutes: state.minutes + minutes,
    money: state.money + payout,
    run: null,
    lastRunReport: {
      serverName: `${server.corp} ${server.name}`,
      ending: run.ending ?? 'jackedOut',
      minutes,
      blocksGained: bankedTotal(aftermath.server) - bankedTotal(server),
      filesSold: soldFiles.map((file) => file.id),
      payout,
      iceBurned: aftermath.isIceBurned,
      isPurged: aftermath.isPurged,
      finalRun: run,
      serverBefore: server,
    },
    stats: {
      filesSold: stats.filesSold + soldFiles.length,
      serversCracked: stats.serversCracked + (isCracked ? 1 : 0),
      earned: stats.earned + payout,
      runs: stats.runs + 1,
      flatlines: stats.flatlines + (run.ending === 'flatlined' ? 1 : 0),
    },
  };
}

function bankedTotal(server: Server): number {
  return server.files.reduce((sum, file) => sum + file.banked, 0);
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
