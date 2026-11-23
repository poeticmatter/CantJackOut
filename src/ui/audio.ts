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
  /** A modem-ish chirp per line of the connection log; warnings drop to a low buzz. */
  handshakeStep: (step: number, isWarning: boolean) => {
    if (isWarning) {
      tone({ frequency: 180, endFrequency: 120, duration: 0.22, type: 'sawtooth', volume: 0.05 });
      return;
    }
    tone({ frequency: 700 + step * 140, endFrequency: 1100 + step * 160, duration: 0.07, type: 'square', volume: 0.025 });
    noise(0.05, 0.03, 0.05, 3500);
  },
  accessGranted: () => [392, 523, 784].forEach((frequency, index) => tone({ frequency, duration: 0.35, type: 'sawtooth', volume: 0.035, delay: index * 0.05 })),
  /** A file filled up: a bright arpeggio in that file's register. */
  fileCracked: (color: Color) =>
    [1, 1.25, 1.5, 2].forEach((ratio, index) => tone({ frequency: HIT_PITCH[color] * ratio, duration: 0.25, type: 'triangle', volume: 0.06, delay: index * 0.06 })),
  tick: () => tone({ frequency: 2200, duration: 0.03, type: 'square', volume: 0.02 }),
  firewall: () => {
    tone({ frequency: 240, endFrequency: 480, duration: 0.25, type: 'triangle', volume: 0.07 });
    noise(0.2, 0.05, 0, 600);
  },
  payday: () => [1568, 2093].forEach((frequency, index) => tone({ frequency, duration: 0.12, type: 'square', volume: 0.03, delay: index * 0.06 })),
  reroute: () => {
    tone({ frequency: 300, endFrequency: 1200, duration: 0.3, type: 'sawtooth', volume: 0.04 });
    [523, 784].forEach((frequency, index) => tone({ frequency, duration: 0.2, type: 'triangle', delay: 0.25 + index * 0.08 }));
  },
  flash: () => {
    noise(0.12, 0.06, 0, 4000);
    tone({ frequency: 900, endFrequency: 1800, duration: 0.18, type: 'triangle', volume: 0.05, delay: 0.05 });
  },
  purge: () => tone({ frequency: 600, endFrequency: 60, duration: 1, type: 'square', volume: 0.05 }),
};
