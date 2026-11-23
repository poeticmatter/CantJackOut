import type { Server, ServerFile } from '../game/server';
import { el, money } from './dom';
import { fileGlyph, fileLabel, fileToneClass } from './faceStyle';

/** Long files get hairline gaps so a tall tower still reads as discrete blocks. */
const DENSE_TOWER_LENGTH = 24;

/** Whether this run can still download a file: it's an open stream, could open one, or can't. */
export type StreamMark = 'stream' | 'open' | 'locked';

export interface TowerState {
  readonly file: ServerFile;
  readonly banked: number;
  /** Everything at risk. */
  readonly buffered: number;
  readonly stream: StreamMark;
  /** Filled blocks shown before this update, to highlight what was just gained or lost. */
  readonly previousFilled: number;
  /** Blocks that became banked in this update, which flash as they lock in. */
  readonly freshlyBanked: number;
}

function cellClass(index: number, state: TowerState): string {
  const filled = state.banked + state.buffered;
  const classes = ['cell'];
  if (index < state.banked) classes.push('is-banked');
  if (index < state.banked && index >= state.banked - state.freshlyBanked) classes.push('is-banking');
  else if (index >= state.banked && index < filled) classes.push('is-buffered');
  if (index >= state.previousFilled && index < filled) classes.push('is-new');
  if (index >= filled && index < state.previousFilled) classes.push('is-lost');
  return classes.join(' ');
}

const STREAM_TEXT: Record<StreamMark, string | null> = { stream: 'Stream', open: null, locked: 'No stream' };

export function renderTower(state: TowerState): HTMLElement {
  const { file } = state;
  const filled = Math.min(file.length, state.banked + state.buffered);
  const isSold = state.banked >= file.length;
  const isComplete = filled >= file.length;
  const cells = Array.from({ length: file.length }, (_, index) =>
    el('div', {
      className: cellClass(index, state),
      style: { '--cell-delay': `${(index - state.previousFilled) * 40}ms`, '--bank-delay': `${(index - (state.banked - state.freshlyBanked)) * 50}ms` },
    }),
  );
  const streamText = isComplete ? null : STREAM_TEXT[state.stream];
  return el('div', {
    className: `tower ${fileToneClass(file.id)} is-${state.stream}${isComplete ? ' is-complete' : ''}`,
    attrs: { role: 'group', 'aria-label': `${fileLabel(file.id)} file`, 'data-file': file.id },
  }, [
    el('div', { className: 'tower-head' }, [
      fileGlyph(file.id, 'tower-glyph'),
      el('span', { className: 'tower-name', text: file.id }),
    ]),
    el('span', { className: `tower-stream${streamText === null ? ' is-hidden' : ''}`, text: streamText ?? '·' }),
    el('div', { className: `tower-shaft${file.length > DENSE_TOWER_LENGTH ? ' is-dense' : ''}` }, cells.reverse()),
    el('div', { className: 'tower-count' }, [
      el('strong', { text: String(filled) }),
      el('span', { text: ` / ${file.length}` }),
      el('em', { className: 'tower-payout', text: isSold ? 'Sold' : money(file.payout) }),
      state.buffered > 0 ? el('em', { className: 'tower-stake', text: `${state.buffered} at risk` }) : null,
    ]),
  ]);
}

/** Compact horizontal version for server cards on the net view. */
export function renderFileBar(file: ServerFile): HTMLElement {
  const fill = (file.banked / file.length) * 100;
  const isSold = file.banked >= file.length;
  return el('div', { className: `file-bar ${fileToneClass(file.id)}${isSold ? ' is-sold' : ''}` }, [
    fileGlyph(file.id, 'file-bar-glyph'),
    el('div', { className: 'file-bar-track' }, [el('div', { className: 'file-bar-fill', style: { width: `${fill}%` } })]),
    el('span', { className: 'file-bar-count', text: `${file.banked}/${file.length}` }),
    el('span', { className: 'file-bar-payout', text: isSold ? 'sold' : money(file.payout) }),
  ]);
}

/** How close the sysadmin is to purging what you've banked here. */
export function renderAlertMeter(server: Server, pending = 0): HTMLElement {
  const shown = Math.min(server.alertLimit, server.alert + pending);
  const share = server.alertLimit === 0 ? 0 : shown / server.alertLimit;
  const tone = share >= 0.75 ? 'is-hot' : share >= 0.5 ? 'is-warm' : '';
  return el('div', {
    className: `alert-meter ${tone}`,
    attrs: { role: 'meter', 'aria-label': 'Server alert', 'aria-valuemin': '0', 'aria-valuemax': String(server.alertLimit), 'aria-valuenow': String(shown), title: 'Every visit raises the alert by 1, a flatline by 2. When it fills, the sysadmin wipes every unfinished file here.' },
  }, [
    el('span', { className: 'alert-label', text: 'Alert' }),
    el('div', { className: 'alert-track' }, [
      el('div', { className: 'alert-fill', style: { width: `${(server.alert / server.alertLimit) * 100}%` } }),
      pending > 0 ? el('div', { className: 'alert-pending', style: { left: `${(server.alert / server.alertLimit) * 100}%`, width: `${((shown - server.alert) / server.alertLimit) * 100}%` } }) : null,
    ]),
    el('span', { className: 'alert-count', text: `${shown}/${server.alertLimit}` }),
  ]);
}
