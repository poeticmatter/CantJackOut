import { type Die, type Face, rollFaceIndex } from './dice';
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
  readonly buffer: Buffer;
  readonly isHit: boolean;
}

export function rollDice(dice: readonly Die[], rng: Rng): number[] {
  return dice.map(() => rollFaceIndex(rng));
}

/**
 * Applies rolled faces to the server. Colored faces feed their own track first;
 * wild faces then go to whichever open track still needs the most steps.
 * A track that fills up mid-roll stops accepting dice.
 */
export function resolveRoll(
  server: Server,
  buffer: Buffer,
  dice: readonly Die[],
  faceIndexes: readonly number[],
): RollOutcome {
  const nextBuffer = [...buffer];
  const results: (DieResult | null)[] = dice.map(() => null);
  const needOf = (trackIndex: number) => remainingSteps(server.tracks[trackIndex], nextBuffer[trackIndex]);

  const feed = (dieIndex: number, trackIndex: number | null) => {
    const die = dice[dieIndex];
    const face = die.faces[faceIndexes[dieIndex]];
    const gain = trackIndex === null ? 0 : Math.min(face.boost, needOf(trackIndex));
    if (trackIndex !== null) nextBuffer[trackIndex] += gain;
    results[dieIndex] = { dieId: die.id, faceIndex: faceIndexes[dieIndex], face, trackIndex: gain > 0 ? trackIndex : null, gain };
  };

  dice.forEach((die, dieIndex) => {
    const face = die.faces[faceIndexes[dieIndex]];
    if (face.color === 'wild') return;
    const trackIndex = server.tracks.findIndex((track) => track.color === face.color);
    feed(dieIndex, trackIndex >= 0 && needOf(trackIndex) > 0 ? trackIndex : null);
  });

  dice.forEach((die, dieIndex) => {
    if (die.faces[faceIndexes[dieIndex]].color !== 'wild') return;
    feed(dieIndex, neediestTrack(server, nextBuffer));
  });

  const finalResults = results.map((result) => {
    if (result === null) throw new Error('Every die must be resolved');
    return result;
  });
  return { results: finalResults, buffer: nextBuffer, isHit: finalResults.some((result) => result.gain > 0) };
}

function neediestTrack(server: Server, buffer: Buffer): number | null {
  let best: number | null = null;
  let bestNeed = 0;
  server.tracks.forEach((track, index) => {
    const need = remainingSteps(track, buffer[index]);
    if (need > bestNeed) {
      best = index;
      bestNeed = need;
    }
  });
  return best;
}

