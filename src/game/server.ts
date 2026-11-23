import { FILE_IDS, type FileId } from './files';

export interface ServerFile {
  readonly id: FileId;
  readonly length: number;
  readonly banked: number;
  /** What the fence pays once every block of this file is banked. */
  readonly payout: number;
}

export type ServerModifier = 'blackIce' | 'tracer';

export interface Server {
  readonly id: string;
  readonly name: string;
  readonly corp: string;
  readonly tier: number;
  /** One file per two-color combination, in FILE_IDS order. */
  readonly files: readonly ServerFile[];
  readonly modifiers: readonly ServerModifier[];
  readonly isRevealed: boolean;
  /** Rises with every visit; when it reaches alertLimit the sysadmin purges what you've banked. */
  readonly alert: number;
  readonly alertLimit: number;
}

/** Blocks per file, in FILE_IDS order. */
export type Buffer = readonly number[];

/** A visit raises the alert by one; getting flatlined raises it by one more. */
export const ALERT_PER_VISIT = 1;
export const ALERT_PER_FLATLINE = 1;

export function emptyBuffer(): Buffer {
  return FILE_IDS.map(() => 0);
}

export function remainingSteps(file: ServerFile, buffered: number): number {
  return Math.max(0, file.length - file.banked - buffered);
}

export function isFileFinished(file: ServerFile): boolean {
  return file.banked >= file.length;
}

/** Files that can't take another block this run: finished, or filled by what's at risk. */
export function fullFiles(server: Server, buffer: Buffer): FileId[] {
  return server.files.filter((file, index) => remainingSteps(file, buffer[index]) === 0).map((file) => file.id);
}

export function isFullyDownloaded(server: Server): boolean {
  return server.files.every(isFileFinished);
}

/** What the fence still owes on this server: every file not yet finished. */
export function remainingValue(server: Server): number {
  return server.files.filter((file) => !isFileFinished(file)).reduce((sum, file) => sum + file.payout, 0);
}

export function withBanked(server: Server, banked: Buffer): Server {
  return { ...server, files: server.files.map((file, index) => ({ ...file, banked: Math.min(file.length, banked[index]) })) };
}

export function hasBankedProgress(server: Server): boolean {
  return server.files.some((file) => file.banked > 0);
}

/** Black ICE burns one banked block from every unfinished file when it catches you. */
export function burnBankedStep(server: Server): Server {
  return {
    ...server,
    files: server.files.map((file) => (isFileFinished(file) ? file : { ...file, banked: Math.max(0, file.banked - 1) })),
  };
}

export function raiseAlert(server: Server, amount: number): Server {
  return { ...server, alert: server.alert + amount };
}

export function isAlertFull(server: Server): boolean {
  return server.alert >= server.alertLimit;
}

/** The sysadmin wipes every unfinished file and the alert starts over. Finished files are already sold. */
export function purgeServer(server: Server): Server {
  return {
    ...server,
    alert: 0,
    files: server.files.map((file) => (isFileFinished(file) ? file : { ...file, banked: 0 })),
  };
}

export function hasModifier(server: Server, modifier: ServerModifier): boolean {
  return server.modifiers.includes(modifier);
}
