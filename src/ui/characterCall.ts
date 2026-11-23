import mothPortrait from '../assets/moth.svg?raw';
import vesnaPortrait from '../assets/vesna.svg?raw';
import { el, prefersReducedMotion } from './dom';

/** Someone on the other end of an encrypted line: a lit silhouette and lines that type out. */
export interface Caller {
  readonly name: string;
  readonly channel: string;
  readonly tone: 'vesna' | 'moth';
  /** SVG markup for the caller's silhouette; characters.css animates its classed parts. */
  readonly portrait: string;
}

const TYPE_MILLISECONDS_PER_CHARACTER = 22;
const PAUSE_BETWEEN_LINES = 320;

export const VESNA: Caller = { name: 'Vesna', channel: 'Encrypted link', tone: 'vesna', portrait: vesnaPortrait };

export const MOTH: Caller = { name: 'Moth', channel: 'Back room', tone: 'moth', portrait: mothPortrait };

function renderPortrait(caller: Caller): HTMLElement {
  const frame = el('div', { className: 'call-portrait', attrs: { 'aria-hidden': 'true' } });
  // The markup is our own bundled artwork, never user input, so inserting it as HTML is safe.
  frame.innerHTML = caller.portrait;
  return frame;
}

/** Tears the picture once, for bad news. */
function glitchOnce(portrait: HTMLElement): void {
  portrait.classList.add('is-glitching');
  portrait.addEventListener('animationend', (event) => {
    // The portrait's own parts animate too; only the frame's glitch ending counts.
    if (event.target === portrait) portrait.classList.remove('is-glitching');
  });
}

/** Types each line in turn; a click anywhere on the panel finishes them at once. */
function typeLines(lines: readonly string[], target: HTMLElement, onTalking: (isTalking: boolean) => void): () => void {
  const paragraphs = lines.map((line) => el('p', { className: 'call-line', attrs: { 'data-full': line } }));
  target.replaceChildren(...paragraphs);
  let isFinished = false;
  const finish = () => {
    if (isFinished) return;
    isFinished = true;
    paragraphs.forEach((paragraph, index) => (paragraph.textContent = lines[index]));
    target.classList.add('is-done');
    onTalking(false);
  };
  if (prefersReducedMotion()) {
    finish();
    return finish;
  }
  let lineIndex = 0;
  let characters = 0;
  onTalking(true);
  const step = () => {
    if (isFinished) return;
    if (!target.isConnected) return finish();
    const line = lines[lineIndex];
    characters++;
    paragraphs[lineIndex].textContent = line.slice(0, characters);
    if (characters < line.length) {
      window.setTimeout(step, TYPE_MILLISECONDS_PER_CHARACTER);
      return;
    }
    lineIndex++;
    characters = 0;
    if (lineIndex >= lines.length) return finish();
    onTalking(false);
    window.setTimeout(() => {
      onTalking(true);
      step();
    }, PAUSE_BETWEEN_LINES);
  };
  window.setTimeout(step, 250);
  return finish;
}

export interface CallOptions {
  readonly lines: readonly string[];
  readonly actions: readonly HTMLElement[];
  /** Glitches the picture on arrival, for bad news. */
  readonly isHostile?: boolean;
  readonly className?: string;
}

export function renderCall(caller: Caller, options: CallOptions): HTMLElement {
  const portrait = renderPortrait(caller);
  if (options.isHostile) glitchOnce(portrait);
  const transcript = el('div', { className: 'call-transcript', attrs: { 'aria-live': 'polite' } });
  const panel = el('section', { className: `call call-${caller.tone} ${options.className ?? ''}`, attrs: { 'aria-label': `${caller.name} on the line` } }, [
    el('header', { className: 'call-head' }, [
      el('span', { className: 'call-rec', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'call-channel', text: `${caller.channel} // ${caller.name}` }),
    ]),
    el('div', { className: 'call-body' }, [
      el('div', { className: 'call-face' }, [portrait]),
      el('div', { className: 'call-words' }, [transcript, el('div', { className: 'call-actions' }, options.actions)]),
    ]),
  ]);
  const finishTyping = typeLines(options.lines, transcript, (isTalking) => panel.classList.toggle('is-talking', isTalking));
  panel.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLButtonElement)) finishTyping();
  });
  return panel;
}
