/**
 * Live data lines from each open stream's tower down to the dice tray, so you can see what the run
 * is holding. Each line is two strands, one per color of the file, with data pulsing up them.
 */
export interface StreamLink {
  readonly tower: Element;
  readonly colors: readonly [string, string];
}

export interface StreamLines {
  readonly element: SVGSVGElement;
  draw(links: readonly StreamLink[], tray: Element): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const STRAND_GAP = 3;
/** How far apart the lines land on the tray, so they don't all meet at one point. */
const LANDING_SPREAD = 70;

function strand(d: string, color: string, className: string): SVGPathElement {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', className);
  path.style.setProperty('--strand-color', color);
  return path;
}

function curve(fromX: number, fromY: number, toX: number, toY: number): string {
  const bend = Math.max(30, (toY - fromY) * 0.55);
  return `M${fromX},${fromY} C${fromX},${fromY + bend} ${toX},${toY - bend} ${toX},${toY}`;
}

export function createStreamLines(): StreamLines {
  const element = document.createElementNS(SVG_NS, 'svg');
  element.setAttribute('class', 'stream-lines');
  element.setAttribute('aria-hidden', 'true');

  return {
    element,
    draw(links, tray) {
      const origin = element.getBoundingClientRect();
      const trayRect = tray.getBoundingClientRect();
      const paths = links.flatMap((link, index) => {
        const shaft = (link.tower.querySelector('.tower-shaft') ?? link.tower).getBoundingClientRect();
        const fromX = shaft.left + shaft.width / 2 - origin.left;
        const fromY = shaft.bottom - origin.top;
        const toX = trayRect.left + trayRect.width / 2 - origin.left + (index - (links.length - 1) / 2) * LANDING_SPREAD;
        const toY = trayRect.top - origin.top + 2;
        return link.colors.flatMap((color, side) => {
          const shift = (side === 0 ? -1 : 1) * STRAND_GAP;
          const d = curve(fromX + shift, fromY, toX + shift, toY);
          return [strand(d, color, 'stream-glow'), strand(d, color, 'stream-strand')];
        });
      });
      element.replaceChildren(...paths);
    },
  };
}
