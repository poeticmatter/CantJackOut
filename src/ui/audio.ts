import type { Color } from '../game/dice';

/** All sounds are synthesised, so the game ships with no audio files. */
const MUTE_KEY = 'cant-jack-out:muted';
const HIT_PITCH: Record<Color, number> = { red: 880, blue: 660, green: 520 };

let context: AudioContext | null = null;
let isMuted = localStorage.getItem(MUTE_KEY) === 'true';

function audio(): AudioContext | null {
  if (isMuted || typeof AudioContext === 'undefined') return null;
  if (context === null) context = new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function isSoundMuted(): boolean {
  return isMuted;
}

export function toggleMute(): boolean {
  isMuted = !isMuted;
  localStorage.setItem(MUTE_KEY, String(isMuted));
  return isMuted;
}

interface ToneOptions {
  readonly frequency: number;
  readonly endFrequency?: number;
  readonly duration: number;
  readonly type?: OscillatorType;
  readonly volume?: number;
  readonly delay?: number;
}

function tone({ frequency, endFrequency, duration, type = 'sine', volume = 0.08, delay = 0 }: ToneOptions): void {
  const ctx = audio();
  if (ctx === null) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== undefined) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(duration: number, volume: number, delay = 0, highpass = 1200): void {
  const ctx = audio();
  if (ctx === null) return;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

export const sfx = {
  click: () => tone({ frequency: 1400, duration: 0.04, type: 'square', volume: 0.03 }),
  rattle: (diceCount: number) => {
    for (let index = 0; index < diceCount * 3; index++) noise(0.03, 0.05, index * 0.06 + Math.random() * 0.03, 2500);
  },
  hit: (color: Color, order: number) =>
    tone({ frequency: HIT_PITCH[color], duration: 0.18, type: 'triangle', volume: 0.07, delay: order * 0.07 }),
  probeMiss: () => tone({ frequency: 300, endFrequency: 220, duration: 0.15, type: 'sine', volume: 0.05 }),
  bank: () => [523, 659, 784].forEach((frequency, index) => tone({ frequency, duration: 0.22, type: 'triangle', delay: index * 0.08 })),
  flatline: () => {
    tone({ frequency: 420, endFrequency: 40, duration: 0.7, type: 'sawtooth', volume: 0.09 });
    noise(0.5, 0.12, 0, 300);
  },
  download: () =>
    [523, 659, 784, 1047, 1319].forEach((frequency, index) =>
      tone({ frequency, duration: 0.3, type: 'triangle', volume: 0.07, delay: index * 0.09 }),
    ),
  jackIn: () => tone({ frequency: 120, endFrequency: 900, duration: 0.5, type: 'sawtooth', volume: 0.05 }),
  coins: () => [1200, 1600].forEach((frequency, index) => tone({ frequency, duration: 0.1, type: 'square', volume: 0.03, delay: index * 0.07 })),
};
