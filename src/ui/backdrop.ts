import { prefersReducedMotion } from './dom';

/**
 * The city outside the window: a skyline of lit apartment blocks under steady rain.
 * The skyline is painted once per resize; only the rain animates.
 */
const RAIN_DROPS = 140;
const SKYLINE_SEED = 7;

interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function paintSkyline(width: number, height: number): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext('2d');
  if (ctx === null) return layer;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0d0a1f');
  sky.addColorStop(0.65, '#1a1033');
  sky.addColorStop(1, '#2a1636');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const random = seededRandom(SKYLINE_SEED);
  for (const [depth, tint, windowAlpha] of [[0.55, '#160f2c', 0.25], [0.72, '#110b22', 0.45]] as const) {
    let x = -20;
    while (x < width) {
      const blockWidth = 40 + random() * 90;
      const blockHeight = height * (depth - 0.35 + random() * 0.4) * 0.6;
      const top = height - blockHeight;
      ctx.fillStyle = tint;
      ctx.fillRect(x, top, blockWidth, blockHeight);
      for (let wy = top + 8; wy < height - 6; wy += 9) {
        for (let wx = x + 5; wx < x + blockWidth - 5; wx += 8) {
          if (random() > 0.82) {
            ctx.fillStyle = random() > 0.3 ? `rgba(255,182,72,${windowAlpha})` : `rgba(160,120,255,${windowAlpha})`;
            ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
      x += blockWidth + random() * 6;
    }
  }
  const haze = ctx.createLinearGradient(0, height * 0.6, 0, height);
  haze.addColorStop(0, 'rgba(13,10,31,0)');
  haze.addColorStop(1, 'rgba(255,140,60,0.08)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  return layer;
}

export function startBackdrop(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  let skyline = paintSkyline(1, 1);
  let drops: Drop[] = [];

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    skyline = paintSkyline(canvas.width, canvas.height);
    drops = Array.from({ length: RAIN_DROPS }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 6 + Math.random() * 9,
      length: 8 + Math.random() * 18,
    }));
    ctx.drawImage(skyline, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  if (prefersReducedMotion()) return;

  const frame = () => {
    ctx.drawImage(skyline, 0, 0);
    ctx.strokeStyle = 'rgba(190,170,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of drops) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.length * 0.15, drop.y + drop.length);
      drop.y += drop.speed;
      drop.x -= drop.speed * 0.15;
      if (drop.y > canvas.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * (canvas.width + 60);
      }
    }
    ctx.stroke();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
