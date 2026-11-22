import type { Track } from '../game/server';
import { el } from './dom';
import { COLOR_LABEL, glyph } from './faceStyle';

/** Long files get hairline gaps so a 40-block tower still reads as discrete blocks. */
const DENSE_TOWER_LENGTH = 24;

export interface TowerState {
  readonly track: Track;
  readonly banked: number;
  readonly buffered: number;
  /** Filled blocks shown before this update, to highlight what was just gained or lost. */
  readonly previousFilled: number;
}

function cellClass(index: number, state: TowerState): string {
  const filled = state.banked + state.buffered;
  const classes = ['cell'];
  if (index < state.banked) classes.push('is-banked');
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
    el('div', { className: cellClass(index, state), style: { '--cell-delay': `${(index - state.previousFilled) * 40}ms` } }),
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
      state.buffered > 0 ? el('em', { className: 'tower-stake', text: `+${state.buffered} unbanked` }) : null,
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
