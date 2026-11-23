import type { ServerModifier } from '../game/server';
import { sfx } from './audio';
import { type Cyberspace, createCyberspace } from './cyberspace';
import { el } from './dom';
import { type StreamLink, type StreamLines, createStreamLines } from './streamLines';

/**
 * Everything around the run that reacts to the trace: the cyberspace behind it, the stream lines,
 * a red vignette closing in, the camera leaning forward and a heartbeat under it all.
 */
export interface RunAtmosphere {
  /** Layers to place in the run screen, behind its content. */
  readonly layers: readonly Element[];
  readonly trace: number;
  begin(modifiers: readonly ServerModifier[]): void;
  setTrace(level: number): void;
  drawStreams(links: readonly StreamLink[], tray: Element): void;
}

/** Above this the vignette starts to flicker. */
const HOT_TRACE = 0.6;
const HEARTBEAT_FROM = 0.2;
const SLOWEST_BEAT_MILLISECONDS = 1150;
const FASTEST_BEAT_MILLISECONDS = 430;

interface Heartbeat {
  setLevel(level: number): void;
}

/** A heartbeat under the run that starts once the trace is noticeable and quickens as it climbs. */
function createHeartbeat(): Heartbeat {
  let level = 0;
  let timer: number | null = null;

  const beat = () => {
    timer = null;
    if (level < HEARTBEAT_FROM) return;
    sfx.heartbeat(level);
    const share = (level - HEARTBEAT_FROM) / (1 - HEARTBEAT_FROM);
    timer = window.setTimeout(beat, SLOWEST_BEAT_MILLISECONDS - share * (SLOWEST_BEAT_MILLISECONDS - FASTEST_BEAT_MILLISECONDS));
  };

  return {
    setLevel(next) {
      level = next;
      if (level < HEARTBEAT_FROM && timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      } else if (level >= HEARTBEAT_FROM && timer === null) {
        timer = window.setTimeout(beat, 250);
      }
    },
  };
}

export function createRunAtmosphere(screen: HTMLElement): RunAtmosphere {
  const cyberspace: Cyberspace = createCyberspace();
  const streams: StreamLines = createStreamLines();
  const heartbeat: Heartbeat = createHeartbeat();
  const vignette = el('div', { className: 'trace-vignette', attrs: { 'aria-hidden': 'true' } });
  let trace = 0;

  const setTrace = (level: number) => {
    trace = level;
    screen.style.setProperty('--trace', level.toFixed(3));
    screen.classList.toggle('is-hot', level >= HOT_TRACE);
    cyberspace.setTrace(level);
    heartbeat.setLevel(level);
  };

  return {
    layers: [cyberspace.element, streams.element, vignette],
    get trace() {
      return trace;
    },
    begin(modifiers) {
      cyberspace.start(modifiers);
      setTrace(0);
    },
    setTrace,
    drawStreams: (links, tray) => streams.draw(links, tray),
  };
}
