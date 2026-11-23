import { prefersReducedMotion } from './dom';

/**
 * Draws a character as a glowing point-cloud mesh, live, from data made by tools/pointcloud.py.
 * Each point is [x, y, depth, brightness, region], with coordinates scaled by coordScale.
 */
export interface PointCloudData {
  readonly pointStride: number;
  readonly coordScale: number;
  readonly points: readonly number[];
  readonly edges: readonly number[];
}

export interface PointCloudLook {
  /** "r, g, b" of the glow. */
  readonly rgb: string;
  /** Fraction of the canvas height the shape's unit radius fills. */
  readonly zoom: number;
  /** How far the head turns side to side, in radians. */
  readonly sway: number;
}

export interface PointCloudView {
  readonly element: HTMLCanvasElement;
  setTalking(isTalking: boolean): void;
  glitch(): void;
}

const REGION_JAW = 1;
const REGION_UPPER_LIP = 2;
const REGION_LEFT_EYE = 3;
const REGION_RIGHT_EYE = 4;
const JAW_DROP = 0.05;
const BLINK_EVERY_SECONDS = 4.5;
const BLINK_SECONDS = 0.16;
const SCAN_SECONDS = 5;
const GLITCH_SECONDS = 0.35;
const EDGE_BUCKETS = 5;
const SPRITE_SIZE = 32;

interface Point {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly glow: number;
  readonly region: number;
}

function unpack(data: PointCloudData): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < data.points.length; index += data.pointStride) {
    points.push({
      x: data.points[index] / data.coordScale,
      y: data.points[index + 1] / data.coordScale,
      depth: data.points[index + 2] / data.coordScale,
      glow: data.points[index + 3] / 100,
      region: data.points[index + 4],
    });
  }
  return points;
}

function regionCenterY(points: readonly Point[], region: number): number {
  const members = points.filter((point) => point.region === region);
  return members.length === 0 ? 0 : members.reduce((sum, point) => sum + point.y, 0) / members.length;
}

function glowSprite(rgb: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE_SIZE;
  sprite.height = SPRITE_SIZE;
  const ctx = sprite.getContext('2d');
  if (ctx === null) return sprite;
  const half = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, `rgba(${rgb},0.95)`);
  gradient.addColorStop(0.5, `rgba(${rgb},0.25)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return sprite;
}

/** Talking is a jittery open-close, so the jaw never settles into an obvious loop. */
function mouthOpening(seconds: number): number {
  return Math.abs(Math.sin(seconds * 17) * Math.sin(seconds * 6.1 + 1)) * 0.8 + Math.abs(Math.sin(seconds * 3.3)) * 0.2;
}

function blinkAmount(seconds: number): number {
  const phase = seconds % BLINK_EVERY_SECONDS;
  return phase < BLINK_SECONDS ? Math.sin((phase / BLINK_SECONDS) * Math.PI) : 0;
}

export function createPointCloudView(data: PointCloudData, look: PointCloudLook, size: { width: number; height: number }): PointCloudView {
  const element = document.createElement('canvas');
  element.className = 'point-cloud';
  element.setAttribute('aria-hidden', 'true');
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  element.width = Math.round(size.width * ratio);
  element.height = Math.round(size.height * ratio);
  element.style.width = `${size.width}px`;
  element.style.height = `${size.height}px`;
  const ctx = element.getContext('2d');
  const points = unpack(data);
  const edgeBuckets: number[][] = Array.from({ length: EDGE_BUCKETS }, () => []);
  for (let index = 0; index < data.edges.length; index += 2) {
    const [a, b] = [data.edges[index], data.edges[index + 1]];
    const glow = (points[a].glow + points[b].glow) / 2;
    edgeBuckets[Math.min(EDGE_BUCKETS - 1, Math.floor(glow * EDGE_BUCKETS))].push(a, b);
  }
  const eyeCenters = new Map([[REGION_LEFT_EYE, regionCenterY(points, REGION_LEFT_EYE)], [REGION_RIGHT_EYE, regionCenterY(points, REGION_RIGHT_EYE)]]);
  const sprite = glowSprite(look.rgb);
  const screenX = new Float32Array(points.length);
  const screenY = new Float32Array(points.length);
  const shine = new Float32Array(points.length);
  let isTalking = false;
  let talkStarted = 0;
  let glitchUntil = -1;
  const started = performance.now();

  const project = (seconds: number) => {
    const unit = element.height * look.zoom;
    const yaw = Math.sin(seconds * 0.35) * look.sway;
    const mouth = isTalking ? mouthOpening(seconds - talkStarted) : 0;
    const blink = blinkAmount(seconds);
    const scanY = ((seconds % SCAN_SECONDS) / SCAN_SECONDS) * 2.6 - 1.3;
    const isGlitching = seconds < glitchUntil;
    const breathe = 1 + Math.sin(seconds * 1.3) * 0.006;
    points.forEach((point, index) => {
      let y = point.y;
      if (point.region === REGION_JAW) y += mouth * JAW_DROP;
      if (point.region === REGION_UPPER_LIP) y -= mouth * JAW_DROP * 0.15;
      const eyeCenter = eyeCenters.get(point.region);
      if (eyeCenter !== undefined) y = eyeCenter + (y - eyeCenter) * (1 - blink * 0.85);
      let x = point.x * Math.cos(yaw) + point.depth * Math.sin(yaw) * 0.55;
      if (isGlitching && Math.sin(y * 23 + seconds * 40) > 0.75) x += Math.sin(seconds * 90) * 0.06;
      screenX[index] = element.width / 2 + x * unit * breathe;
      screenY[index] = element.height / 2 + y * unit * breathe;
      const scanGlow = Math.max(0, 1 - Math.abs(y - scanY) * 9);
      shine[index] = Math.min(1, point.glow * (0.75 + point.depth * 0.35) + scanGlow * 0.6);
    });
  };

  const draw = (now: number) => {
    if (ctx === null) return;
    const seconds = (now - started) / 1000;
    project(seconds);
    ctx.clearRect(0, 0, element.width, element.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(0.6, ratio * 0.55);
    edgeBuckets.forEach((edges, bucket) => {
      ctx.strokeStyle = `rgba(${look.rgb},${0.07 + (bucket / EDGE_BUCKETS) * 0.28})`;
      ctx.beginPath();
      for (let index = 0; index < edges.length; index += 2) {
        ctx.moveTo(screenX[edges[index]], screenY[edges[index]]);
        ctx.lineTo(screenX[edges[index + 1]], screenY[edges[index + 1]]);
      }
      ctx.stroke();
    });
    const base = ratio * 2.2;
    points.forEach((_, index) => {
      const radius = base * (0.5 + shine[index] * 1.1);
      ctx.globalAlpha = 0.3 + shine[index] * 0.5;
      ctx.drawImage(sprite, screenX[index] - radius, screenY[index] - radius, radius * 2, radius * 2);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const loop = (now: number) => {
    draw(now);
    if (element.isConnected) requestAnimationFrame(loop);
  };

  if (prefersReducedMotion()) {
    draw(started);
  } else {
    // The view is usually built before it's attached, so wait for it to land in the page.
    requestAnimationFrame(function waitForMount(now) {
      if (element.isConnected) loop(now);
      else if (performance.now() - started < 2000) requestAnimationFrame(waitForMount);
    });
  }

  return {
    element,
    setTalking(talking) {
      if (talking && !isTalking) talkStarted = (performance.now() - started) / 1000;
      isTalking = talking;
    },
    glitch() {
      glitchUntil = (performance.now() - started) / 1000 + GLITCH_SECONDS;
    },
  };
}
