import type { ServerModifier } from '../game/server';
import { prefersReducedMotion } from './dom';

/**
 * The inside of the server, drawn behind the run: a grid floor running to a glowing horizon,
 * data falling through the dark, and the server's ICE closing in from the edges.
 * Everything speeds up and runs red as the trace climbs.
 */
export interface Cyberspace {
  readonly element: HTMLCanvasElement;
  /** Starts drawing once the canvas is in the page; stops by itself when it leaves. */
  start(modifiers: readonly ServerModifier[]): void;
  setTrace(level: number): void;
}

type Rgb = readonly [number, number, number];

const CALM: Rgb = [110, 92, 200];
const HOT: Rgb = [255, 61, 94];
const DATA_CALM: Rgb = [110, 214, 255];
const MAX_PIXEL_RATIO = 1.5;
const HORIZON = 0.46;
const FLOOR_ROWS = 14;
const FLOOR_COLUMNS = 22;
const DATA_DROPS = 70;
const HEX_RADIUS = 22;
/** How fast the shown trace chases the real one, per second, so changes ease in. */
const TRACE_EASE = 1.6;
const MOUNT_GRACE_MILLISECONDS = 2000;

interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
}

function mix(from: Rgb, to: Rgb, amount: number): string {
  const channel = (index: number) => Math.round(from[index] + (to[index] - from[index]) * amount);
  return `${channel(0)}, ${channel(1)}, ${channel(2)}`;
}

function drawFloor(ctx: CanvasRenderingContext2D, width: number, height: number, scroll: number, trace: number): void {
  const horizon = height * HORIZON;
  const tone = mix(CALM, HOT, trace);
  const glow = ctx.createRadialGradient(width / 2, horizon, 0, width / 2, horizon, width * 0.6);
  glow.addColorStop(0, `rgba(${tone}, ${0.28 + trace * 0.2})`);
  glow.addColorStop(1, `rgba(${tone}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;
  for (let row = 0; row < FLOOR_ROWS; row++) {
    const depth = ((row + scroll) % FLOOR_ROWS) / FLOOR_ROWS;
    const y = horizon + (height - horizon) * depth * depth;
    ctx.strokeStyle = `rgba(${tone}, ${0.05 + depth * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let column = -FLOOR_COLUMNS; column <= FLOOR_COLUMNS; column++) {
    const spread = column / FLOOR_COLUMNS;
    const gradient = ctx.createLinearGradient(0, horizon, 0, height);
    gradient.addColorStop(0, `rgba(${tone}, 0)`);
    gradient.addColorStop(1, `rgba(${tone}, ${0.32 - Math.abs(spread) * 0.18})`);
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(width / 2 + spread * width * 0.08, horizon);
    ctx.lineTo(width / 2 + spread * width * 1.6, height);
    ctx.stroke();
  }
}

function drawData(ctx: CanvasRenderingContext2D, drops: Drop[], height: number, step: number, trace: number): void {
  ctx.strokeStyle = `rgba(${mix(DATA_CALM, HOT, trace)}, ${0.16 + trace * 0.14})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const drop of drops) {
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x, drop.y + drop.length);
    drop.y += drop.speed * step * (1 + trace * 2.6);
    if (drop.y > height * HORIZON + 40) drop.y = -drop.length - Math.random() * 120;
  }
  ctx.stroke();
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  for (let corner = 0; corner < 6; corner++) {
    const angle = (Math.PI / 3) * corner + Math.PI / 6;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (corner === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Black ICE: a red hex lattice growing in from both sides. */
function drawBlackIce(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, trace: number): void {
  const reach = width * (0.1 + trace * 0.16);
  const columnStep = HEX_RADIUS * Math.sqrt(3);
  ctx.lineWidth = 1.2;
  for (let column = 0; column * columnStep < reach; column++) {
    for (let row = 0; row * HEX_RADIUS * 1.5 < height + HEX_RADIUS; row++) {
      const offset = row % 2 === 0 ? 0 : columnStep / 2;
      const inset = column * columnStep + offset;
      const fade = 1 - inset / reach;
      if (fade <= 0) continue;
      const pulse = 0.5 + 0.5 * Math.sin(seconds * 2.2 + row * 0.7 + column);
      ctx.strokeStyle = `rgba(255, 61, 94, ${fade * (0.12 + trace * 0.4) * (0.6 + pulse * 0.4)})`;
      const y = row * HEX_RADIUS * 1.5;
      hexPath(ctx, inset, y, HEX_RADIUS * 0.92);
      ctx.stroke();
      hexPath(ctx, width - inset, y, HEX_RADIUS * 0.92);
      ctx.stroke();
    }
  }
}

/** A Tracer: a searchlight sweeping the room, faster as it closes in. */
function drawTracer(ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number, trace: number): void {
  const angle = Math.sin(seconds * (0.5 + trace * 1.4)) * 0.75;
  const length = height * 1.3;
  const tipX = width / 2 + Math.sin(angle) * length;
  const tipY = Math.cos(angle) * length;
  const spread = 0.13;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(width / 2, 0, tipX, tipY);
  beam.addColorStop(0, `rgba(255, 182, 72, ${0.22 + trace * 0.25})`);
  beam.addColorStop(1, 'rgba(255, 182, 72, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(width / 2, -10);
  ctx.lineTo(width / 2 + Math.sin(angle - spread) * length, Math.cos(angle - spread) * length);
  ctx.lineTo(width / 2 + Math.sin(angle + spread) * length, Math.cos(angle + spread) * length);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createCyberspace(): Cyberspace {
  const element = document.createElement('canvas');
  element.className = 'cyberspace';
  element.setAttribute('aria-hidden', 'true');
  const ctx = element.getContext('2d');
  let modifiers: readonly ServerModifier[] = [];
  let targetTrace = 0;
  let shownTrace = 0;
  let isRunning = false;
  let drops: Drop[] = [];
  let scroll = 0;
  let last = 0;

  const fit = (): { width: number; height: number } => {
    const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(element.clientWidth * ratio));
    const height = Math.max(1, Math.round(element.clientHeight * ratio));
    if (element.width !== width || element.height !== height) {
      element.width = width;
      element.height = height;
      drops = Array.from({ length: DATA_DROPS }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * HORIZON,
        speed: 40 + Math.random() * 90,
        length: 6 + Math.random() * 26,
      }));
    }
    return { width, height };
  };

  const draw = (seconds: number, step: number) => {
    if (ctx === null) return;
    const { width, height } = fit();
    shownTrace += (targetTrace - shownTrace) * Math.min(1, step * TRACE_EASE);
    scroll = (scroll + step * (0.6 + shownTrace * 2.2)) % FLOOR_ROWS;
    ctx.clearRect(0, 0, width, height);
    drawFloor(ctx, width, height, scroll, shownTrace);
    drawData(ctx, drops, height, step, shownTrace);
    if (modifiers.includes('blackIce')) drawBlackIce(ctx, width, height, seconds, shownTrace);
    if (modifiers.includes('tracer')) drawTracer(ctx, width, height, seconds, shownTrace);
  };

  let startedAt = 0;
  const loop = (now: number) => {
    if (!element.isConnected) {
      // The screen may be built a moment before it's attached; give it a little while.
      if (now - startedAt < MOUNT_GRACE_MILLISECONDS) requestAnimationFrame(loop);
      else isRunning = false;
      return;
    }
    const step = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    draw(now / 1000, step);
    requestAnimationFrame(loop);
  };

  return {
    element,
    start(nextModifiers) {
      modifiers = nextModifiers;
      targetTrace = 0;
      shownTrace = 0;
      if (ctx === null) return;
      if (prefersReducedMotion()) {
        requestAnimationFrame(() => draw(0, 0));
        return;
      }
      if (isRunning) return;
      isRunning = true;
      last = 0;
      startedAt = performance.now();
      requestAnimationFrame(loop);
    },
    setTrace(level) {
      targetTrace = level;
      if (prefersReducedMotion()) {
        shownTrace = level;
        draw(0, 0);
      }
    },
  };
}
