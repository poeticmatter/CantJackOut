import type { Die, Face } from '../game/dice';
import { el } from './dom';
import { describeFace, faceClasses, faceGlyph } from './faceStyle';

export function dieLabel(die: Die): string {
  return `Die ${die.id.replace(/^die-/, '')}`;
}

export function faceContent(face: Face, prefix: string): Element[] {
  return [faceGlyph(face, `${prefix}-glyph`)];
}

/** Flat view of all six faces, used wherever the player inspects a die. */
export function renderDieNet(die: Die): HTMLElement {
  const faces = die.faces.map((face) =>
    el('span', { className: `net-face ${faceClasses(face)}`, attrs: { title: describeFace(face) } }, faceContent(face, 'net')));
  return el('div', { className: 'die-net' }, faces);
}

/** "1 red, 1 blue, 2 green, 2 yellow", counting each kind of face once in the order it first appears. */
export function dieSummary(die: Die): string {
  const counts = new Map<string, number>();
  for (const face of die.faces) {
    const label = describeFace(face).toLowerCase();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => `${count} ${label}`).join(', ');
}
