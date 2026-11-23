import { type Color, type Face, isWild } from '../game/dice';
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
const STAR_MARKUP = '<polygon points="50,8 61,38 93,38 67,57 77,89 50,70 23,89 33,57 7,38 39,38" />';
const SHIELD_MARKUP = '<path d="M50 8 L86 22 V50 C86 72 70 86 50 94 C30 86 14 72 14 50 V22 Z" /><path class="glyph-cut" d="M50 26 V76 M34 46 H66" />';
const PAYDAY_MARKUP = '<polygon points="50,6 90,50 50,94 10,50" /><text class="glyph-cut-text" x="50" y="66" text-anchor="middle">$</text>';
const ANCHOR_MARKUP = '<circle cx="50" cy="18" r="9" fill="none" stroke-width="8" /><path d="M50 27 V88 M28 46 H72 M18 64 C22 82 38 90 50 90 C62 90 78 82 82 64" fill="none" stroke-width="9" stroke-linecap="round" />';

/** What a face looks like: one of the three colors, a split of two, or a special face. */
export type FaceTone = Color | 'dual' | 'wild' | 'firewall' | 'payday';

export function faceTone(face: Face): FaceTone {
  if (face.kind !== 'data') return face.kind;
  if (isWild(face)) return 'wild';
  return face.colors.length === 2 ? 'dual' : face.colors[0];
}

export function glyph(tone: Color | 'wild', className = 'glyph'): SVGSVGElement {
  return svg(tone === 'wild' ? STAR_MARKUP : SHAPE_MARKUP[tone], `${className} glyph-${tone}`);
}

/** A dual-color face shows both shapes, each in its own color. */
function dualGlyph(colors: readonly Color[], className: string): SVGSVGElement {
  const [left, right] = colors;
  const markup =
    `<g class="glyph-part glyph-${left}" transform="translate(-4 20) scale(0.6)">${SHAPE_MARKUP[left]}</g>` +
    `<g class="glyph-part glyph-${right}" transform="translate(44 20) scale(0.6)">${SHAPE_MARKUP[right]}</g>`;
  return svg(markup, `${className} glyph-dual`);
}

export function faceGlyph(face: Face, className = 'glyph'): SVGSVGElement {
  const tone = faceTone(face);
  if (face.kind === 'firewall') return svg(SHIELD_MARKUP, `${className} glyph-firewall`);
  if (face.kind === 'payday') return svg(PAYDAY_MARKUP, `${className} glyph-payday`);
  const element = tone === 'dual' ? dualGlyph(face.colors, className) : glyph(tone === 'wild' ? 'wild' : face.colors[0], className);
  if (face.boost === 2) element.classList.add('is-overclocked');
  return element;
}

export function anchorMark(className: string): SVGSVGElement {
  return svg(ANCHOR_MARKUP, `${className} anchor-mark`);
}

/** Classes that give a face its tone; a dual face carries both colors for gradients. */
export function faceClasses(face: Face): string {
  const tone = faceTone(face);
  if (tone === 'dual' && face.kind === 'data') return `face-dual face-${face.colors[0]}-${face.colors[1]}`;
  return `face-${tone}`;
}

export function describeFace(face: Face): string {
  if (face.kind === 'firewall') return 'Firewall';
  if (face.kind === 'payday') return 'Payday';
  const colors = isWild(face) ? 'Wild' : face.colors.map((color) => COLOR_LABEL[color]).join(' or ');
  const upgrades = [face.boost === 2 ? '×2' : null, face.isAnchored ? 'anchored' : null].filter((upgrade) => upgrade !== null);
  return upgrades.length === 0 ? colors : `${colors} (${upgrades.join(', ')})`;
}
