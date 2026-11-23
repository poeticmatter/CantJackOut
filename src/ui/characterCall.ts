import { el, prefersReducedMotion } from './dom';
import { type PointCloudData, type PointCloudLook, type PointCloudView, createPointCloudView } from './pointCloud';

/** Someone on the other end of an encrypted line: a live point-cloud face and lines that type out. */
export interface Caller {
  readonly name: string;
  readonly channel: string;
  readonly tone: 'vesna' | 'moth';
  readonly look: PointCloudLook;
  /** CSS pixels of the canvas the face is drawn in. */
  readonly faceSize: { readonly width: number; readonly height: number };
  readonly loadFace: () => Promise<PointCloudData>;
}

const TYPE_MILLISECONDS_PER_CHARACTER = 22;
const PAUSE_BETWEEN_LINES = 320;

export const VESNA: Caller = {
  name: 'Vesna',
  channel: 'Encrypted link',
  tone: 'vesna',
  look: { rgb: '110, 214, 255', zoom: 0.46, sway: 0.2 },
  faceSize: { width: 250, height: 300 },
  loadFace: () => import('../assets/vesna.json').then((module) => module.default),
};

export const MOTH: Caller = {
  name: 'Moth',
  channel: 'Back room',
  tone: 'moth',
  look: { rgb: '255, 182, 72', zoom: 0.36, sway: 0.35 },
  faceSize: { width: 190, height: 130 },
  loadFace: () => import('../assets/moth.json').then((module) => module.default),
};

function mountFace(caller: Caller, slot: HTMLElement): Promise<PointCloudView | null> {
  return caller.loadFace().then(
    (data) => {
      const view = createPointCloudView(data, caller.look, caller.faceSize);
      slot.replaceChildren(view.element);
      return view;
    },
    (error: unknown) => {
      console.error(`Could not load ${caller.name}'s face`, error);
      return null;
    },
  );
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
  /** Tears the face on arrival, for bad news. */
  readonly isHostile?: boolean;
  readonly className?: string;
}

export function renderCall(caller: Caller, options: CallOptions): HTMLElement {
  const faceSlot = el('div', { className: 'call-face' }, [el('div', { className: 'call-face-loading', text: 'Resolving…' })]);
  const transcript = el('div', { className: 'call-transcript', attrs: { 'aria-live': 'polite' } });
  const panel = el('section', { className: `call call-${caller.tone} ${options.className ?? ''}`, attrs: { 'aria-label': `${caller.name} on the line` } }, [
    el('header', { className: 'call-head' }, [
      el('span', { className: 'call-rec', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'call-channel', text: `${caller.channel} // ${caller.name}` }),
    ]),
    el('div', { className: 'call-body' }, [
      faceSlot,
      el('div', { className: 'call-words' }, [transcript, el('div', { className: 'call-actions' }, options.actions)]),
    ]),
  ]);
  let face: PointCloudView | null = null;
  let isTalking = false;
  const setTalking = (talking: boolean) => {
    isTalking = talking;
    face?.setTalking(talking);
  };
  const finishTyping = typeLines(options.lines, transcript, setTalking);
  panel.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLButtonElement)) finishTyping();
  });
  void mountFace(caller, faceSlot).then((view) => {
    face = view;
    view?.setTalking(isTalking);
    if (options.isHostile) view?.glitch();
  });
  return panel;
}
