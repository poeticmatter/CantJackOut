/**
 * A competent-but-simple bot that plays whole campaigns, used to tune the vig schedule
 * and shop prices. It never sees hidden server details it hasn't revealed.
 */
import { acceptFlatline, bankAndJackOut, jackIn, roll, useBounce, useFailsafe, waitForDawn } from '../game/actions';
import { type CampaignState, isProgramReady, loadoutDice, newCampaign, vigForNight } from '../game/campaign';
import { isDawn } from '../game/clock';
import type { Color, Face } from '../game/dice';
import { simulateDownload } from '../game/difficulty';
import { settleDawn } from '../game/dawn';
import { shouldKeepRolling } from '../game/policy';
import { createRng } from '../game/random';
import { liveServer } from '../game/run';
import type { Server } from '../game/server';
import { buyProgram, buySocket, flashFace, nextSocketPrice } from '../game/shop';

const UNREVEALED_PAY_PER_MINUTE_GUESS = 1.3;
const ESTIMATE_TRIALS = 40;

export interface CampaignResult {
  readonly outcome: 'won' | 'lost';
  readonly nightReached: number;
  readonly strikes: number;
  readonly serversCracked: number;
}

function estimateMinutes(state: CampaignState, server: Server): number {
  if (!server.isRevealed) return server.reward / UNREVEALED_PAY_PER_MINUTE_GUESS;
  const rng = createRng(state.rngState ^ 0x5bd1e995);
  let total = 0;
  for (let trial = 0; trial < ESTIMATE_TRIALS; trial++) {
    const result = simulateDownload(server, { dice: loadoutDice(state), rng });
    if (result === null) return Infinity;
    total += result.minutes;
  }
  return total / ESTIMATE_TRIALS;
}

function chooseServer(state: CampaignState): Server {
  let best = state.board[0];
  let bestRate = -Infinity;
  for (const server of state.board) {
    const rate = server.reward / Math.max(30, estimateMinutes(state, server));
    if (rate > bestRate) {
      best = server;
      bestRate = rate;
    }
  }
  return best;
}

function shop(state: CampaignState): CampaignState {
  let current = state;
  const reserve = vigForNight(state.night) * 0.6;
  const affordable = (price: number) => current.money - price >= reserve;
  for (;;) {
    const socketPrice = nextSocketPrice(current);
    if (socketPrice !== null && affordable(socketPrice)) {
      current = buySocket(current);
    } else if (!current.ownedPrograms.includes('bounce') && affordable(500) && current.diceSockets >= 4) {
      current = buyProgram(current, 'bounce');
    } else if (affordable(250) && current.diceSockets >= 5) {
      const target = findGreenFaceToFlash(current);
      if (target === null) return current;
      current = flashFace(current, target.dieId, target.faceIndex, { kind: 'single', color: 'red' });
    } else {
      return current;
    }
  }
}

function findGreenFaceToFlash(state: CampaignState): { dieId: string; faceIndex: number } | null {
  for (const die of state.dice) {
    const reds = die.faces.filter((face) => isSingleColor(face, 'red')).length;
    const faceIndex = die.faces.findIndex((face) => isSingleColor(face, 'green'));
    if (reds < 2 && faceIndex >= 0) return { dieId: die.id, faceIndex };
  }
  return null;
}

function isSingleColor(face: Face, color: Color): boolean {
  return face.kind === 'data' && face.colors.length === 1 && face.colors[0] === color;
}

function playRun(state: CampaignState): CampaignState {
  let current = jackIn(state, chooseServer(state).id, false);
  while (current.phase === 'run' && current.run !== null) {
    const run = current.run;
    const server = current.board.find((candidate) => candidate.id === run.serverId);
    if (server === undefined) throw new Error('Run server vanished');
    if (run.status === 'missed') {
      if (isProgramReady(current, 'bounce')) current = useBounce(current);
      else if (isProgramReady(current, 'failsafe')) current = useFailsafe(current);
      else current = acceptFlatline(current);
    } else if (run.status === 'connected' || shouldKeepRolling({ server: liveServer(server, run), buffer: run.buffer, dice: loadoutDice(current) })) {
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
  return {
    outcome: state.phase,
    nightReached: state.night,
    strikes: state.strikes,
    serversCracked: state.stats.serversCracked,
  };
}
