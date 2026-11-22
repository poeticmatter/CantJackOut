import { type Die, countFaces } from '../game/dice';
import { el } from './dom';
import { describeFace, faceGlyph } from './faceStyle';

export function dieLabel(die: Die): string {
  return `Die ${die.id.replace(/^die-/, '')}`;
}

export interface DieNetOptions {
  readonly selectedFace?: number | null;
  readonly onFaceClick?: (faceIndex: number) => void;
}

/** Flat view of all six faces, used wherever the player inspects or edits a die. */
export function renderDieNet(die: Die, options: DieNetOptions = {}): HTMLElement {
  const faces = die.faces.map((face, index) => {
    const isSelected = options.selectedFace === index;
    const content = [faceGlyph(face, 'net-glyph'), face.boost === 2 ? el('span', { className: 'net-boost', text: '×2' }) : null];
    const className = `net-face face-${face.color}${isSelected ? ' is-selected' : ''}`;
    if (options.onFaceClick === undefined) return el('span', { className, attrs: { title: describeFace(face) } }, content);
    const onFaceClick = options.onFaceClick;
    return el('button', {
      className,
      attrs: { type: 'button', 'aria-pressed': String(isSelected), 'aria-label': `Face ${index + 1}: ${describeFace(face)}` },
      onClick: () => onFaceClick(index),
    }, content);
  });
  return el('div', { className: 'die-net' }, faces);
}

export function dieSummary(die: Die): string {
  return `${countFaces(die, 'red')} red, ${countFaces(die, 'blue')} blue, ${countFaces(die, 'green')} green` +
    (countFaces(die, 'wild') > 0 ? `, ${countFaces(die, 'wild')} wild` : '');
}
