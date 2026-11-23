import { prefersReducedMotion } from './dom';

/**
 * Throwaway particles drawn in a layer over the run screen. Everything here is decoration:
 * with reduced motion (or no Web Animations support) each effect is skipped and resolves at once.
 */
export interface Flight {
  readonly from: Element | DOMRect;
  readonly to: Element | DOMRect;
  readonly color: string;
  readonly count: number;
  readonly delay?: number;
}

export interface FxLayer {
  readonly element: HTMLElement;
  flyBlocks(flight: Flight): Promise<void>;
  /** A bolt of light from a die to its tower; resolves as it lands. */
  beam(from: Element, to: DOMRect, color: string): Promise<void>;
  /** A block breaks into shards that fall away. */
  shatter(at: DOMRect, color: string): void;
  floatText(over: Element | DOMRect, text: string, className: string): void;
  burst(at: Element | DOMRect, color: string, count: number): void;
  rain(text: string, color: string, count: number): void;
}

const FLY_MILLISECONDS = 520;
const FLOAT_MILLISECONDS = 1100;
const BURST_MILLISECONDS = 800;
const BEAM_MILLISECONDS = 260;
const SHATTER_MILLISECONDS = 900;
const SHARDS_PER_BLOCK = 4;

function canAnimate(element: HTMLElement): boolean {
  return !prefersReducedMotion() && typeof element.animate === 'function';
}

function centerOf(target: Element | DOMRect): { x: number; y: number } {
  const rect = target instanceof Element ? target.getBoundingClientRect() : target;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function createFxLayer(): FxLayer {
  const element = document.createElement('div');
  element.className = 'fx-layer';
  element.setAttribute('aria-hidden', 'true');

  const local = (point: { x: number; y: number }) => {
    const origin = element.getBoundingClientRect();
    return { x: point.x - origin.left, y: point.y - origin.top };
  };

  const spawn = (className: string, color: string, text = ''): HTMLElement => {
    const particle = document.createElement('div');
    particle.className = className;
    particle.style.setProperty('--fx-color', color);
    particle.textContent = text;
    element.append(particle);
    return particle;
  };

  return {
    element,
    flyBlocks({ from, to, color, count, delay = 0 }) {
      if (!canAnimate(element) || count === 0) return Promise.resolve();
      const start = local(centerOf(from));
      const end = local(centerOf(to));
      const flights = Array.from({ length: count }, (_, index) => {
        const particle = spawn('fx-block', color);
        const lift = 60 + Math.random() * 80;
        const spread = (Math.random() - 0.5) * 60;
        const animation = particle.animate(
          [
            { transform: `translate(${start.x}px, ${start.y}px) scale(0.6)`, opacity: 0 },
            { transform: `translate(${(start.x + end.x) / 2 + spread}px, ${Math.min(start.y, end.y) - lift}px) scale(1.2) rotate(90deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${end.x}px, ${end.y}px) scale(0.8) rotate(180deg)`, opacity: 1 },
          ],
          { duration: FLY_MILLISECONDS, delay: delay + index * 45, easing: 'cubic-bezier(0.3, 0.1, 0.3, 1)', fill: 'backwards' },
        );
        return animation.finished.then(() => particle.remove(), () => particle.remove());
      });
      return Promise.all(flights).then(() => undefined);
    },
    beam(from, to, color) {
      if (!canAnimate(element)) return Promise.resolve();
      const start = local(centerOf(from));
      const end = local(centerOf(to));
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const bolt = spawn('fx-beam', color);
      bolt.style.width = `${length}px`;
      const placed = `translate(${start.x}px, ${start.y}px) rotate(${angle}rad)`;
      bolt.animate(
        [
          { transform: `${placed} scaleX(0)`, opacity: 1 },
          { transform: `${placed} scaleX(1)`, opacity: 1, offset: 0.55 },
          { transform: `${placed} scaleX(1) scaleY(0.2)`, opacity: 0 },
        ],
        { duration: BEAM_MILLISECONDS * 1.8, easing: 'ease-out' },
      ).finished.then(() => bolt.remove(), () => bolt.remove());
      return new Promise((resolve) => window.setTimeout(resolve, BEAM_MILLISECONDS));
    },
    shatter(at, color) {
      if (!canAnimate(element)) return;
      const point = local(centerOf(at));
      for (let index = 0; index < SHARDS_PER_BLOCK; index++) {
        const shard = spawn('fx-shard', color);
        const x = point.x + (Math.random() - 0.5) * at.width;
        const y = point.y + (Math.random() - 0.5) * at.height;
        const drift = (Math.random() - 0.5) * 160;
        const fall = 180 + Math.random() * 220;
        const spin = (Math.random() - 0.5) * 720;
        shard.animate(
          [
            { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${x + drift * 0.3}px, ${y - 20 - Math.random() * 30}px) rotate(${spin * 0.2}deg)`, opacity: 1, offset: 0.2 },
            { transform: `translate(${x + drift}px, ${y + fall}px) rotate(${spin}deg)`, opacity: 0 },
          ],
          { duration: SHATTER_MILLISECONDS * (0.8 + Math.random() * 0.4), easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
        ).finished.then(() => shard.remove(), () => shard.remove());
      }
    },
    floatText(over, text, className) {
      if (!canAnimate(element)) return;
      const point = local(centerOf(over));
      const label = spawn(`fx-text ${className}`, 'currentColor', text);
      label.animate(
        [
          { transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(0.6)`, opacity: 0 },
          { transform: `translate(${point.x}px, ${point.y - 30}px) translate(-50%, -50%) scale(1.25)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${point.x}px, ${point.y - 70}px) translate(-50%, -50%) scale(1)`, opacity: 0 },
        ],
        { duration: FLOAT_MILLISECONDS, easing: 'ease-out' },
      ).finished.then(() => label.remove(), () => label.remove());
    },
    burst(at, color, count) {
      if (!canAnimate(element)) return;
      const point = local(centerOf(at));
      for (let index = 0; index < count; index++) {
        const spark = spawn('fx-spark', color);
        const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 50 + Math.random() * 90;
        spark.animate(
          [
            { transform: `translate(${point.x}px, ${point.y}px) scale(1)`, opacity: 1 },
            { transform: `translate(${point.x + Math.cos(angle) * distance}px, ${point.y + Math.sin(angle) * distance}px) scale(0.2)`, opacity: 0 },
          ],
          { duration: BURST_MILLISECONDS * (0.7 + Math.random() * 0.5), easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' },
        ).finished.then(() => spark.remove(), () => spark.remove());
      }
    },
    rain(text, color, count) {
      if (!canAnimate(element)) return;
      const { width, height } = element.getBoundingClientRect();
      for (let index = 0; index < count; index++) {
        const drop = spawn('fx-rain', color, text);
        const x = Math.random() * width;
        drop.animate(
          [
            { transform: `translate(${x}px, -40px) rotate(0deg)`, opacity: 0 },
            { transform: `translate(${x}px, ${height * 0.2}px) rotate(20deg)`, opacity: 1, offset: 0.15 },
            { transform: `translate(${x + (Math.random() - 0.5) * 80}px, ${height + 40}px) rotate(${(Math.random() - 0.5) * 360}deg)`, opacity: 0.6 },
          ],
          { duration: 1600 + Math.random() * 1400, delay: Math.random() * 900, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)', fill: 'backwards' },
        ).finished.then(() => drop.remove(), () => drop.remove());
      }
    },
  };
}

/** A quick push of the camera toward the action. */
export function punch(element: HTMLElement, strength: number): void {
  if (!canAnimate(element)) return;
  element.animate([{ scale: '1' }, { scale: String(1 + 0.012 * strength) }, { scale: '1' }], { duration: 240, easing: 'ease-out' });
}

/** A short jolt for big moments. */
export function shake(element: HTMLElement, strength: number): void {
  if (!canAnimate(element)) return;
  const jolt = (x: number, y: number) => ({ transform: `translate(${x * strength}px, ${y * strength}px)` });
  element.animate([jolt(0, 0), jolt(-3, 2), jolt(3, -2), jolt(-2, -1), jolt(1, 1), jolt(0, 0)], { duration: 320, easing: 'ease-out' });
}
