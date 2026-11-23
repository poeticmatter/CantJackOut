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
  /** Rises with every visit; when it reaches alertLimit the sysadmin purges what you've banked. */
  readonly alert: number;
  readonly alertLimit: number;
}

/** Blocks per track, in the same order as server.tracks. */
export type Buffer = readonly number[];

/** A visit raises the alert by one; getting flatlined raises it by one more. */
export const ALERT_PER_VISIT = 1;
export const ALERT_PER_FLATLINE = 1;

export function emptyBuffer(server: Server): Buffer {
  return server.tracks.map(() => 0);
}

export function remainingSteps(track: Track, buffered: number): number {
  return Math.max(0, track.length - track.banked - buffered);
}

export function isTrackFinished(track: Track): boolean {
  return track.banked >= track.length;
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

export function withBanked(server: Server, banked: Buffer): Server {
  return { ...server, tracks: server.tracks.map((track, index) => ({ ...track, banked: Math.min(track.length, banked[index]) })) };
}

export function hasBankedProgress(server: Server): boolean {
  return server.tracks.some((track) => track.banked > 0);
}

/** Black ICE burns one banked step from every unfinished track when it catches you. */
export function burnBankedStep(server: Server): Server {
  return {
    ...server,
    tracks: server.tracks.map((track) =>
      isTrackFinished(track) ? track : { ...track, banked: Math.max(0, track.banked - 1) },
    ),
  };
}

export function raiseAlert(server: Server, amount: number): Server {
  return { ...server, alert: server.alert + amount };
}

export function isAlertFull(server: Server): boolean {
  return server.alert >= server.alertLimit;
}

/** The sysadmin wipes every banked block and the alert starts over. */
export function purgeServer(server: Server): Server {
  return { ...server, alert: 0, tracks: server.tracks.map((track) => ({ ...track, banked: 0 })) };
}

export function hasModifier(server: Server, modifier: ServerModifier): boolean {
  return server.modifiers.includes(modifier);
}
