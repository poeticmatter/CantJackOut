import type { Server, Track } from '../game/server';
import { el } from './dom';
import { COLOR_LABEL, glyph } from './faceStyle';

/** Long files get hairline gaps so a 40-block tower still reads as discrete blocks. */
const DENSE_TOWER_LENGTH = 24;

export interface TowerState {
  readonly track: Track;
  readonly banked: number;
  /** Everything at risk, the stake included. */
  readonly buffered: number;
  /** The part of the buffer that was put at risk when the run started. */
  readonly stake: number;
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
  else if (index < state.banked + state.stake) classes.push('is-stake');
  else if (index < filled) classes.push('is-buffered');
  if (index >= state.previousFilled && index < filled) classes.push('is-new');
  if (index >= filled && index < state.previousFilled) classes.push('is-lost');
  return classes.join(' ');
}

export function renderTower(state: TowerState): HTMLElement {
  const { track } = state;
  const filled = Math.min(track.length, state.banked + state.buffered);
  const isComplete = filled >= track.length;
  const cells = Array.from({ length: track.length }, (_, index) =>
    el('div', {
      className: cellClass(index, state),
      style: { '--cell-delay': `${(index - state.previousFilled) * 40}ms`, '--bank-delay': `${(index - (state.banked - state.freshlyBanked)) * 50}ms` },
    }),
  );
  return el('div', { className: `tower tone-${track.color}${isComplete ? ' is-complete' : ''}`, attrs: { role: 'group', 'aria-label': `${COLOR_LABEL[track.color]} file` } }, [
    el('div', { className: 'tower-head' }, [
      glyph(track.color, 'tower-glyph'),
      el('span', { className: 'tower-name', text: `${COLOR_LABEL[track.color]} file` }),
    ]),
    el('div', { className: `tower-shaft${track.length > DENSE_TOWER_LENGTH ? ' is-dense' : ''}` }, cells.reverse()),
    el('div', { className: 'tower-count' }, [
      el('strong', { text: String(filled) }),
      el('span', { text: ` / ${track.length}` }),
      state.buffered > 0 ? el('em', { className: 'tower-stake', text: `${state.buffered} at risk` }) : null,
      isComplete ? el('em', { className: 'tower-done', text: 'Cracked' }) : null,
    ]),
  ]);
}

/** Compact horizontal version for server cards on the net view. */
export function renderFileBar(track: Track): HTMLElement {
  const fill = (track.banked / track.length) * 100;
  return el('div', { className: `file-bar tone-${track.color}` }, [
    glyph(track.color, 'file-bar-glyph'),
    el('div', { className: 'file-bar-track' }, [el('div', { className: 'file-bar-fill', style: { width: `${fill}%` } })]),
    el('span', { className: 'file-bar-count', text: `${track.banked}/${track.length}` }),
  ]);
}

/** How close the sysadmin is to purging what you've banked here. */
export function renderAlertMeter(server: Server, pending = 0): HTMLElement {
  const shown = Math.min(server.alertLimit, server.alert + pending);
  const share = server.alertLimit === 0 ? 0 : shown / server.alertLimit;
  const tone = share >= 0.75 ? 'is-hot' : share >= 0.5 ? 'is-warm' : '';
  return el('div', {
    className: `alert-meter ${tone}`,
    attrs: { role: 'meter', 'aria-label': 'Server alert', 'aria-valuemin': '0', 'aria-valuemax': String(server.alertLimit), 'aria-valuenow': String(shown), title: 'Every visit raises the alert by 1, a flatline by 2. When it fills, the sysadmin wipes your banked blocks here.' },
  }, [
    el('span', { className: 'alert-label', text: 'Alert' }),
    el('div', { className: 'alert-track' }, [
      el('div', { className: 'alert-fill', style: { width: `${(server.alert / server.alertLimit) * 100}%` } }),
      pending > 0 ? el('div', { className: 'alert-pending', style: { left: `${(server.alert / server.alertLimit) * 100}%`, width: `${((shown - server.alert) / server.alertLimit) * 100}%` } }) : null,
    ]),
    el('span', { className: 'alert-count', text: `${shown}/${server.alertLimit}` }),
  ]);
}
