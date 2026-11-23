import { acceptFlatline } from '../game/actions';
import { type CampaignState, type RunReport, findServer, isProgramReady } from '../game/campaign';
import type { Die } from '../game/dice';
import { MAX_STREAMS } from '../game/pairing';
import { type RunState, serverAfterRun, streamContext } from '../game/run';
import type { Server } from '../game/server';
import type { StreamMark } from './towers';

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
  readonly stream: StreamMark;
}

export function frameFor(state: CampaignState): RunFrame | null {
  if (state.run !== null) {
    return { server: findServer(state, state.run.serverId), run: state.run, report: null, dice: state.dice };
  }
  const report = state.lastRunReport;
  if (report === null) return null;
  return { server: report.serverBefore, run: report.finalRun, report, dice: state.dice };
}

/** Each file as the screen should show it right now. */
export function filesFor(frame: RunFrame): FileView[] {
  if (frame.report !== null) {
    return serverAfterRun(frame.server, frame.run).files.map((file) => ({ banked: file.banked, buffered: 0, stream: 'open' }));
  }
  const { streams, fullFiles } = streamContext(frame.run, frame.server);
  return frame.server.files.map((file, index) => {
    const isStream = streams.includes(file.id);
    const canOpen = streams.length < MAX_STREAMS && !fullFiles.includes(file.id);
    return {
      banked: frame.run.banked[index],
      buffered: frame.run.buffer[index],
      stream: isStream ? 'stream' : canOpen ? 'open' : 'locked',
    };
  });
}

/** A miss with no rescue program loaded resolves straight away instead of asking. */
export function autoResolveMiss(state: CampaignState): CampaignState {
  if (state.run?.status !== 'missed') return state;
  const hasRescue = isProgramReady(state, 'bounce') || isProgramReady(state, 'failsafe');
  return hasRescue ? state : acceptFlatline(state);
}
