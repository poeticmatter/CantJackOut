import { formatClock } from '../game/clock';
import type { RunState } from '../game/run';
import { type Server, hasModifier } from '../game/server';
import { sfx } from './audio';
import { el, prefersReducedMotion } from './dom';

/** On screen, a longer handshake takes longer too, so a bad connection is felt as well as read. */
const BASE_MILLISECONDS = 1300;
const MILLISECONDS_PER_MINUTE = 38;
const GRANTED_MILLISECONDS = 650;

interface Step {
  readonly text: string;
  readonly result: string;
  /** Share of the bar this step fills; stalls make the ICE layers feel like they're fighting back. */
  readonly weight: number;
  readonly isWarning?: boolean;
}

function stepsFor(server: Server, run: RunState): Step[] {
  const proxies = 3 + (run.handshakeMinutes % 5);
  const files = server.files.map((file) => `${file.id} ${file.length}`).join(', ');
  const isReturning = server.files.some((file) => file.banked > 0);
  return [
    { text: `routing through ${proxies} proxies`, result: 'ok', weight: 1 },
    { text: `spoofing ${server.corp} credentials`, result: 'accepted', weight: 1.4 },
    { text: 'ICE layer 1', result: 'bypassed', weight: 1.8 },
    hasModifier(server, 'blackIce')
      ? { text: 'BLACK ICE on the core', result: 'slipped past it', weight: 2.4, isWarning: true }
      : { text: 'ICE layer 2', result: 'bypassed', weight: 1.6 },
    hasModifier(server, 'tracer')
      ? { text: 'tracer on the line', result: 'spoofed, for now', weight: 1.8, isWarning: true }
      : { text: 'mapping file system', result: 'done', weight: 1 },
    { text: isReturning ? `back in: ${files}` : `${server.files.length} files found: ${files}`, result: 'three streams ready', weight: 1 },
  ];
}

export interface HandshakeOptions {
  readonly server: Server;
  readonly run: RunState;
  readonly startMinutes: number;
}

/** Plays the connection sequence over the run screen; resolves when it's done or skipped. */
export function playHandshake(container: HTMLElement, { server, run, startMinutes }: HandshakeOptions): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  const steps = stepsFor(server, run);
  const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);
  const duration = BASE_MILLISECONDS + run.handshakeMinutes * MILLISECONDS_PER_MINUTE;
  const log = el('ol', { className: 'handshake-log' });
  const fill = el('div', { className: 'handshake-fill' });
  const percentLabel = el('span', { className: 'handshake-percent', text: '0%' });
  const clock = el('strong', { className: 'handshake-clock', text: formatClock(startMinutes) });
  const granted = el('div', { className: 'handshake-granted', text: 'Access granted' });
  const overlay = el('div', { className: 'handshake', attrs: { role: 'status', 'aria-label': 'Connecting' } }, [
    el('div', { className: 'handshake-panel' }, [
      el('p', { className: 'handshake-target' }, [el('span', { text: server.corp }), el('strong', { text: server.name })]),
      log,
      el('div', { className: 'handshake-bar' }, [fill]),
      el('div', { className: 'handshake-meta' }, [el('span', { text: 'Handshake' }), percentLabel, clock]),
      el('p', { className: 'handshake-skip', text: 'Click or press any key to skip' }),
    ]),
    granted,
  ]);
  container.append(overlay);

  return new Promise((resolve) => {
    const started = performance.now();
    let shownSteps = 0;
    let isDone = false;
    const finish = () => {
      if (isDone) return;
      isDone = true;
      window.removeEventListener('keydown', skip, true);
      overlay.classList.add('is-granted');
      sfx.accessGranted();
      window.setTimeout(() => {
        overlay.remove();
        resolve();
      }, GRANTED_MILLISECONDS);
    };
    const skip = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      finish();
    };
    overlay.addEventListener('click', skip);
    window.addEventListener('keydown', skip, true);

    const tick = (now: number) => {
      if (isDone) return;
      const progress = Math.min(1, (now - started) / duration);
      let reached = 0;
      let cumulative = 0;
      for (const step of steps) {
        cumulative += step.weight / totalWeight;
        if (progress >= cumulative - 1e-9) reached++;
      }
      while (shownSteps < reached) {
        const step = steps[shownSteps];
        log.append(el('li', { className: step.isWarning ? 'is-warning' : '' }, [el('span', { text: `> ${step.text}` }), el('em', { text: step.result })]));
        sfx.handshakeStep(shownSteps, step.isWarning === true);
        shownSteps++;
      }
      // Stall a little inside each step so the bar climbs in uneven jerks.
      const stutter = progress - Math.sin(progress * Math.PI * steps.length) * 0.015;
      const shown = Math.max(0, Math.min(1, stutter));
      fill.style.width = `${shown * 100}%`;
      percentLabel.textContent = `${Math.round(shown * 100)}%`;
      clock.textContent = formatClock(startMinutes + Math.round(run.handshakeMinutes * shown));
      if (progress >= 1) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
