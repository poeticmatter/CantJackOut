import type { Face, FaceColor } from '../game/dice';
import { svg } from './dom';

export const COLOR_LABEL: Record<FaceColor, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  wild: 'Wild',
};

/** Each color also has a shape, so the game reads without relying on color vision. */
const GLYPH_MARKUP: Record<FaceColor, string> = {
  red: '<polygon points="50,14 88,82 12,82" />',
  blue: '<rect x="18" y="18" width="64" height="64" rx="4" />',
  green: '<circle cx="50" cy="50" r="34" />',
  wild: '<polygon points="50,8 61,38 93,38 67,57 77,89 50,70 23,89 33,57 7,38 39,38" />',
};

export function glyph(color: FaceColor, className = 'glyph'): SVGSVGElement {
  return svg(GLYPH_MARKUP[color], `${className} glyph-${color}`);
}

export function faceGlyph(face: Face, className = 'glyph'): SVGSVGElement {
  const element = glyph(face.color, className);
  if (face.boost === 2) element.classList.add('is-overclocked');
  return element;
}

export function describeFace(face: Face): string {
  return `${COLOR_LABEL[face.color]}${face.boost === 2 ? ' ×2' : ''}`;
}
