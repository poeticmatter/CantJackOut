import type { Die } from '../game/dice';
import { el, prefersReducedMotion } from './dom';
import { faceContent } from './dieNet';
import { describeFace, faceClasses } from './faceStyle';

/** Where each face sits on the cube, and the cube rotation that brings it to the front. */
const FACE_PLACEMENT = ['rotateY(0deg)', 'rotateY(90deg)', 'rotateY(180deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)'];
const SHOW_FACE: readonly (readonly [number, number])[] = [[0, 0], [0, -90], [0, -180], [0, 90], [-90, 0], [90, 0]];
const FULL_TURN = 360;
const ROLL_MILLISECONDS = 950;

export type DieMood = 'idle' | 'hit' | 'dud' | 'special';

export interface DieView {
  readonly element: HTMLElement;
  readonly dieId: string;
  showFace(faceIndex: number): void;
  rollTo(faceIndex: number): Promise<void>;
  /** glow is a CSS color: the file the die fed, or the special face's own tone. */
  setMood(mood: DieMood, glow?: string): void;
}

function nextTurnAbove(angle: number): number {
  return Math.ceil(angle / FULL_TURN) * FULL_TURN;
}

export function createDieView(die: Die): DieView {
  const faces = die.faces.map((face, index) =>
    el('div', { className: `die-face ${faceClasses(face)}`, style: { transform: `${FACE_PLACEMENT[index]} translateZ(var(--die-half))` } }, faceContent(face, 'die')),
  );
  const cube = el('div', { className: 'die' }, faces);
  const element = el('div', { className: 'die-scene', attrs: { role: 'img', 'aria-label': 'Die' } }, [cube, el('div', { className: 'die-shadow' })]);
  let angleX = 0;
  let angleY = 0;
  let shownFace = 0;

  const applyAngles = () => {
    cube.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg)`;
  };

  const label = () => {
    element.setAttribute('aria-label', `Die showing ${describeFace(die.faces[shownFace]).toLowerCase()}`);
  };

  return {
    element,
    dieId: die.id,
    showFace(faceIndex) {
      shownFace = faceIndex;
      [angleX, angleY] = SHOW_FACE[faceIndex];
      cube.classList.add('no-transition');
      applyAngles();
      void cube.offsetWidth;
      cube.classList.remove('no-transition');
      label();
    },
    rollTo(faceIndex) {
      shownFace = faceIndex;
      const [targetX, targetY] = SHOW_FACE[faceIndex];
      const extraTurns = prefersReducedMotion() ? 0 : 1 + Math.floor(Math.random() * 2);
      angleX = nextTurnAbove(angleX) + FULL_TURN * extraTurns + targetX;
      angleY = nextTurnAbove(angleY) + FULL_TURN * (prefersReducedMotion() ? 0 : 1) + targetY;
      element.classList.remove('is-tumbling', 'is-hit', 'is-dud');
      void element.offsetWidth;
      element.classList.add('is-tumbling');
      element.style.setProperty('--tumble-delay', `${Math.floor(Math.random() * 120)}ms`);
      applyAngles();
      label();
      return new Promise((resolve) => window.setTimeout(resolve, prefersReducedMotion() ? 0 : ROLL_MILLISECONDS));
    },
    setMood(mood, glow = 'var(--amber)') {
      element.classList.toggle('is-hit', mood === 'hit');
      element.classList.toggle('is-special', mood === 'special');
      element.classList.toggle('is-dud', mood === 'dud');
      element.style.setProperty('--die-glow', glow);
    },
  };
}
