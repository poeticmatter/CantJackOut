import type { Die, Face } from '../game/dice';
import { el } from './dom';
import { anchorMark, describeFace, faceClasses, faceGlyph } from './faceStyle';

export function dieLabel(die: Die): string {
  return `Die ${die.id.replace(/^die-/, '')}`;
}

export interface DieNetOptions {
  readonly selectedFace?: number | null;
  readonly onFaceClick?: (faceIndex: number) => void;
}

export function faceContent(face: Face, prefix: string): (Element | null)[] {
  return [
    faceGlyph(face, `${prefix}-glyph`),
    face.kind === 'data' && face.boost === 2 ? el('span', { className: `${prefix}-boost`, text: '×2' }) : null,
    face.kind === 'data' && face.isAnchored ? anchorMark(`${prefix}-anchor`) : null,
  ];
}

/** Flat view of all six faces, used wherever the player inspects or edits a die. */
export function renderDieNet(die: Die, options: DieNetOptions = {}): HTMLElement {
  const faces = die.faces.map((face, index) => {
    const isSelected = options.selectedFace === index;
    const className = `net-face ${faceClasses(face)}${isSelected ? ' is-selected' : ''}`;
    if (options.onFaceClick === undefined) return el('span', { className, attrs: { title: describeFace(face) } }, faceContent(face, 'net'));
    const onFaceClick = options.onFaceClick;
    return el('button', {
      className,
      attrs: { type: 'button', 'aria-pressed': String(isSelected), 'aria-label': `Face ${index + 1}: ${describeFace(face)}` },
      onClick: () => onFaceClick(index),
    }, faceContent(face, 'net'));
  });
  return el('div', { className: 'die-net' }, faces);
}

/** "1 red, 2 blue, 3 green", counting each kind of face once in the order it first appears. */
export function dieSummary(die: Die): string {
  const counts = new Map<string, number>();
  for (const face of die.faces) {
    const label = describeFace(face).toLowerCase();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => `${count} ${label}`).join(', ');
}
