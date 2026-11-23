import type { Color, Face } from '../game/dice';
import { FILE_COLORS, type FileId } from '../game/files';
import { svg } from './dom';

export const COLOR_LABEL: Record<Color, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
};

/** Each color also has a shape, so the game reads without relying on color vision. */
const SHAPE_MARKUP: Record<Color, string> = {
  red: '<polygon points="50,14 88,82 12,82" />',
  blue: '<rect x="18" y="18" width="64" height="64" rx="4" />',
  green: '<circle cx="50" cy="50" r="34" />',
};

export function glyph(color: Color, className = 'glyph'): SVGSVGElement {
  return svg(SHAPE_MARKUP[color], `${className} glyph-${color}`);
}

/** Two shapes side by side, each in its own color: a pair of dice, or the file it downloads. */
export function pairGlyph(colors: readonly [Color, Color], className = 'glyph'): SVGSVGElement {
  const [left, right] = colors;
  const markup =
    `<g class="glyph-part glyph-${left}" transform="translate(-4 20) scale(0.6)">${SHAPE_MARKUP[left]}</g>` +
    `<g class="glyph-part glyph-${right}" transform="translate(44 20) scale(0.6)">${SHAPE_MARKUP[right]}</g>`;
  return svg(markup, `${className} glyph-dual`);
}

export function faceGlyph(face: Face, className = 'glyph'): SVGSVGElement {
  return glyph(face, className);
}

export function faceClasses(face: Face): string {
  return `face-${face}`;
}

export function describeFace(face: Face): string {
  return COLOR_LABEL[face];
}

/** "Red–Blue", or "Red–Red" for a single-color file. */
export function fileLabel(file: FileId): string {
  return FILE_COLORS[file].map((color) => COLOR_LABEL[color]).join('–');
}

export function fileGlyph(file: FileId, className = 'glyph'): SVGSVGElement {
  return pairGlyph(FILE_COLORS[file], className);
}

/** Sets --tone for a file: its color, or the mix of its two colors. */
export function fileToneClass(file: FileId): string {
  return `file-${file}`;
}
