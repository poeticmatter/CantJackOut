import type { Color } from './dice';

export interface Track {
  readonly color: Color;
  readonly length: number;
  readonly banked: number;
}

export type ServerModifier = 'blackIce' | 'tracer';

export interface Server {
  readonly id: string;
  readonly name: string;
  readonly corp: string;
  readonly tier: number;
  readonly reward: number;
  readonly tracks: readonly Track[];
  readonly modifiers: readonly ServerModifier[];
  readonly isRevealed: boolean;
}

/** Steps added during the current run, one entry per track (same order as server.tracks). */
export type Buffer = readonly number[];

export function emptyBuffer(server: Server): Buffer {
  return server.tracks.map(() => 0);
}

export function remainingSteps(track: Track, buffered: number): number {
  return Math.max(0, track.length - track.banked - buffered);
}

/** Colors that can still make progress this run. Finished tracks no longer count as hits. */
export function openColors(server: Server, buffer: Buffer): Color[] {
  return server.tracks
    .filter((track, index) => remainingSteps(track, buffer[index]) > 0)
    .map((track) => track.color);
}

export function isFullyDownloaded(server: Server, buffer: Buffer): boolean {
  return openColors(server, buffer).length === 0;
}

export function bankBuffer(server: Server, buffer: Buffer): Server {
  return {
    ...server,
    tracks: server.tracks.map((track, index) => ({
      ...track,
      banked: Math.min(track.length, track.banked + buffer[index]),
    })),
  };
}

export function hasBankedProgress(server: Server): boolean {
  return server.tracks.some((track) => track.banked > 0);
}

/** Black ICE burns one banked step from every track when it catches you. */
export function burnBankedStep(server: Server): Server {
  return {
    ...server,
    tracks: server.tracks.map((track) =>
      track.banked >= track.length ? track : { ...track, banked: Math.max(0, track.banked - 1) },
    ),
  };
}

export function hasModifier(server: Server, modifier: ServerModifier): boolean {
  return server.modifiers.includes(modifier);
}
