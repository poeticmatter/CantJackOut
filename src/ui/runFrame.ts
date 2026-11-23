import { acceptFlatline } from '../game/actions';
import { type CampaignState, type RunReport, findServer, isProgramReady, loadoutDice } from '../game/campaign';
import type { Die } from '../game/dice';
import { type RunState, serverAfterRun } from '../game/run';
import type { Server } from '../game/server';

/** What the run screen is showing: a live run, or the replay of one that just ended. */
export interface RunFrame {
  readonly server: Server;
  readonly run: RunState;
  readonly report: RunReport | null;
  readonly dice: readonly Die[];
}

export interface FileView {
  readonly banked: number;
  readonly buffered: number;
  readonly stake: number;
}

export function frameFor(state: CampaignState): RunFrame | null {
  if (state.run !== null) {
    return { server: findServer(state, state.run.serverId), run: state.run, report: null, dice: loadoutDice(state) };
  }
  const report = state.lastRunReport;
  if (report === null) return null;
  return { server: report.serverBefore, run: report.finalRun, report, dice: loadoutDice(state) };
}

/** Each file as the screen should show it right now. */
export function filesFor(frame: RunFrame): FileView[] {
  if (frame.report !== null) {
    return serverAfterRun(frame.server, frame.run).tracks.map((track) => ({ banked: track.banked, buffered: 0, stake: 0 }));
  }
  return frame.server.tracks.map((_, index) => ({
    banked: frame.run.banked[index],
    buffered: frame.run.buffer[index],
    stake: Math.min(frame.run.stake[index], frame.run.buffer[index]),
  }));
}

/** A miss with no rescue program loaded resolves straight away instead of asking. */
export function autoResolveMiss(state: CampaignState): CampaignState {
  if (state.run?.status !== 'missed') return state;
  const hasRescue = isProgramReady(state, 'bounce') || isProgramReady(state, 'failsafe');
  return hasRescue ? state : acceptFlatline(state);
}
