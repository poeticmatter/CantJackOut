import { type DataFace, type Die, type Face, rollFaceIndex } from './dice';
import type { Rng } from './random';
import { type Buffer, type Server, remainingSteps } from './server';

export interface DieResult {
  readonly dieId: string;
  readonly faceIndex: number;
  readonly face: Face;
  /** Index into server.tracks that this die fed, or null if it hit nothing. */
  readonly trackIndex: number | null;
  readonly gain: number;
}

export interface RollOutcome {
  readonly results: readonly DieResult[];
  /** Unbanked blocks per track after the roll. */
  readonly buffer: Buffer;
  /** Blocks anchored faces banked on the spot this roll, per track. */
  readonly anchored: Buffer;
  readonly isHit: boolean;
  /** A miss that a Firewall face blocked. */
  readonly isBlocked: boolean;
  readonly paydays: number;
}

export function rollDice(dice: readonly Die[], rng: Rng): number[] {
  return dice.map(() => rollFaceIndex(rng));
}

/**
 * Applies rolled faces to the server. Faces with fewer colors place first, so a single-color
 * face feeds its own file before dual-color and wild faces pick the neediest file they match.
 * A track that fills up mid-roll stops accepting dice.
 */
export function resolveRoll(server: Server, buffer: Buffer, dice: readonly Die[], faceIndexes: readonly number[]): RollOutcome {
  const nextBuffer = [...buffer];
  const anchored = server.tracks.map(() => 0);
  const results: (DieResult | null)[] = dice.map(() => null);
  const needOf = (trackIndex: number) => remainingSteps(server.tracks[trackIndex], nextBuffer[trackIndex] + anchored[trackIndex]);
  const faceOf = (dieIndex: number) => dice[dieIndex].faces[faceIndexes[dieIndex]];

  const neediestMatch = (face: DataFace): number | null => {
    let best: number | null = null;
    server.tracks.forEach((track, index) => {
      if (!face.colors.includes(track.color) || needOf(index) === 0) return;
      if (best === null || needOf(index) > needOf(best)) best = index;
    });
    return best;
  };

  const placementOrder = dice
    .map((_, dieIndex) => dieIndex)
    .sort((a, b) => colorCount(faceOf(a)) - colorCount(faceOf(b)));
  for (const dieIndex of placementOrder) {
    const face = faceOf(dieIndex);
    const trackIndex = face.kind === 'data' ? neediestMatch(face) : null;
    const gain = face.kind === 'data' && trackIndex !== null ? Math.min(face.boost, needOf(trackIndex)) : 0;
    if (face.kind === 'data' && trackIndex !== null) {
      if (face.isAnchored) anchored[trackIndex] += gain;
      else nextBuffer[trackIndex] += gain;
    }
    results[dieIndex] = { dieId: dice[dieIndex].id, faceIndex: faceIndexes[dieIndex], face, trackIndex: gain > 0 ? trackIndex : null, gain };
  }

  const finalResults = results.map((result) => {
    if (result === null) throw new Error('Every die must be resolved');
    return result;
  });
  const isHit = finalResults.some((result) => result.gain > 0);
  return {
    results: finalResults,
    buffer: nextBuffer,
    anchored,
    isHit,
    isBlocked: !isHit && finalResults.some((result) => result.face.kind === 'firewall'),
    paydays: finalResults.filter((result) => result.face.kind === 'payday').length,
  };
}

/** Faces that never download place last; any number above three colors does. */
const NON_DATA_PLACEMENT = 99;

function colorCount(face: Face): number {
  return face.kind === 'data' ? face.colors.length : NON_DATA_PLACEMENT;
}
