import { BOARD_SIZE, generateServerForNight } from './board';
import { type Die, createStandardDie } from './dice';
import type { FileId } from './files';
import { DICE_PER_ROLL } from './pairing';
import { PROGRAMS, PROGRAM_IDS, type ProgramId } from './programs';
import { type Rng, createRng } from './random';
import type { RunEnding, RunState } from './run';
import type { Server } from './server';

export const FINAL_NIGHT = 10;
export const MAX_STRIKES = 3;
const STARTING_MONEY = 100;
const STARTING_PROGRAM_SLOTS = 1;

/** Vesna's cut, due at each dawn. Tuned for the one-file-per-color game; not yet retuned for dice pairing. */
export const VIG_BY_NIGHT: readonly number[] = [200, 325, 500, 750, 1075, 1400, 1775, 2175, 2600, 3125];

export type Phase = 'net' | 'run' | 'dawn' | 'won' | 'lost';

export interface Loadout {
  readonly programIds: readonly ProgramId[];
}

export interface RunReport {
  readonly serverName: string;
  readonly ending: RunEnding;
  readonly minutes: number;
  /** Change in banked blocks across the server; negative when Black ICE or a purge took some. */
  readonly blocksGained: number;
  /** Files finished on this run, each sold to the fence. */
  readonly filesSold: readonly FileId[];
  readonly payout: number;
  readonly iceBurned: boolean;
  readonly isPurged: boolean;
  /** Kept so the run screen can replay the final roll after the run has closed. */
  readonly finalRun: RunState;
  /** The server as it was when the run started; a fully downloaded server leaves the board. */
  readonly serverBefore: Server;
}

export interface CampaignStats {
  readonly filesSold: number;
  readonly serversCracked: number;
  readonly earned: number;
  readonly runs: number;
  readonly flatlines: number;
}

export interface CampaignState {
  readonly rngState: number;
  readonly phase: Phase;
  readonly night: number;
  readonly minutes: number;
  readonly money: number;
  readonly strikes: number;
  readonly board: readonly Server[];
  readonly nextId: number;
  /** The dice-pairing experiment has no dice upgrades: always four standard dice. */
  readonly dice: readonly Die[];
  readonly programSlots: number;
  readonly ownedPrograms: readonly ProgramId[];
  readonly loadout: Loadout;
  readonly charges: Readonly<Record<ProgramId, number>>;
  readonly run: RunState | null;
  readonly lastRunReport: RunReport | null;
  readonly stats: CampaignStats;
}

export function vigForNight(night: number): number {
  return VIG_BY_NIGHT[Math.min(night, VIG_BY_NIGHT.length) - 1];
}

export function fullCharges(): Record<ProgramId, number> {
  return Object.fromEntries(PROGRAM_IDS.map((id) => [id, PROGRAMS[id].chargesPerNight])) as Record<ProgramId, number>;
}

export function newCampaign(seed: number): CampaignState {
  const rng = createRng(seed);
  const dice = Array.from({ length: DICE_PER_ROLL }, (_, index) => createStandardDie(`die-${index + 1}`));
  const board = Array.from({ length: BOARD_SIZE }, (_, index) => generateServerForNight(`srv-${index + 1}`, 1, rng));
  return {
    rngState: rng.state,
    phase: 'net',
    night: 1,
    minutes: 0,
    money: STARTING_MONEY,
    strikes: 0,
    board,
    nextId: BOARD_SIZE + 1,
    dice,
    programSlots: STARTING_PROGRAM_SLOTS,
    ownedPrograms: [],
    loadout: { programIds: [] },
    charges: fullCharges(),
    run: null,
    lastRunReport: null,
    stats: { filesSold: 0, serversCracked: 0, earned: 0, runs: 0, flatlines: 0 },
  };
}

/** Runs a state transition with the campaign's own RNG and stores the advanced RNG state. */
export function withRng(state: CampaignState, transition: (rng: Rng) => CampaignState): CampaignState {
  const rng = createRng(state.rngState);
  const next = transition(rng);
  return { ...next, rngState: rng.state };
}

export function findServer(state: CampaignState, serverId: string): Server {
  const server = state.board.find((candidate) => candidate.id === serverId);
  if (server === undefined) throw new Error(`No server ${serverId} on the board`);
  return server;
}

export function isProgramReady(state: CampaignState, program: ProgramId): boolean {
  return state.loadout.programIds.includes(program) && state.charges[program] > 0;
}

export function spendCharge(state: CampaignState, program: ProgramId): CampaignState {
  if (!isProgramReady(state, program)) throw new Error(`${PROGRAMS[program].name} is not loaded or has no charges`);
  return { ...state, charges: { ...state.charges, [program]: state.charges[program] - 1 } };
}

export function allocateId(state: CampaignState, prefix: string): [string, CampaignState] {
  return [`${prefix}-${state.nextId}`, { ...state, nextId: state.nextId + 1 }];
}
