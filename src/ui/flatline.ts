import { sfx } from './audio';
import { el, prefersReducedMotion, wait } from './dom';
import type { FxLayer } from './fx';
import { cellTone } from './towers';

/**
 * Getting caught: the blocks you were holding shatter, the picture tears and collapses like an old CRT
 * switching off, and an ECG trace beats twice and goes flat.
 */
const TEAR_MILLISECONDS = 550;
const COLLAPSE_MILLISECONDS = 520;
const ECG_MILLISECONDS = 1500;
const POWER_ON_MILLISECONDS = 260;
const MAX_SHATTERED_BLOCKS = 40;
/** Heartbeat spikes, then nothing: points across a 400 x 100 box. */
const ECG_POINTS = '0,50 70,50 85,40 95,50 110,50 120,8 132,92 142,50 165,50 180,40 190,50 205,50 215,8 227,92 237,50 400,50';
const SPIKE_TIMES = [0.33, 0.56];

function heldBlocks(screen: HTMLElement): HTMLElement[] {
  return [...screen.querySelectorAll<HTMLElement>('.cell.is-buffered')].slice(0, MAX_SHATTERED_BLOCKS);
}

function ecgTrace(): HTMLElement {
  const svgMarkup = `<svg viewBox="0 0 400 100" preserveAspectRatio="none"><polyline points="${ECG_POINTS}" pathLength="1"/></svg>`;
  const trace = el('div', { className: 'flatline-ecg' }, [el('strong', { className: 'flatline-stamp', text: 'Flatline' })]);
  // Static markup defined above, not user input.
  trace.insertAdjacentHTML('afterbegin', svgMarkup);
  return trace;
}

export async function playFlatline(screen: HTMLElement, fx: FxLayer): Promise<void> {
  if (prefersReducedMotion()) {
    sfx.flatline();
    return;
  }
  sfx.flatline();
  sfx.shatter();
  screen.classList.add('is-flatlining');
  heldBlocks(screen).forEach((cell, index) => {
    fx.shatter(cell.getBoundingClientRect(), cellTone(cell, index));
    cell.classList.add('is-shattered');
  });
  await wait(TEAR_MILLISECONDS);

  sfx.crtOff();
  const crt = el('div', { className: 'crt', attrs: { 'aria-hidden': 'true' } }, [el('div', { className: 'crt-line' })]);
  screen.append(crt);
  await wait(COLLAPSE_MILLISECONDS);
  screen.classList.remove('is-flatlining');

  crt.append(ecgTrace());
  const seconds = ECG_MILLISECONDS / 1000;
  SPIKE_TIMES.forEach((share) => sfx.ecgBeep(share * seconds * 0.7));
  sfx.ecgFlat(seconds * 0.7);
  await wait(ECG_MILLISECONDS);

  crt.classList.add('is-on');
  await wait(POWER_ON_MILLISECONDS);
  crt.remove();
}
