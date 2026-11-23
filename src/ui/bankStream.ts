import { sfx } from './audio';
import { el, wait } from './dom';
import type { FxLayer } from './fx';
import { cellTone } from './towers';

/** Jacking out: every block you were holding streams up into a "Secured" counter. */
const MAX_STREAMED_BLOCKS = 32;
const STAGGER_MILLISECONDS = 40;
const LINGER_MILLISECONDS = 650;
const FADE_MILLISECONDS = 500;

export async function streamSecuredBlocks(screen: HTMLElement, towers: HTMLElement, fx: FxLayer): Promise<void> {
  const cells = [...towers.querySelectorAll<HTMLElement>('.cell.is-buffered, .cell.is-banking')].slice(0, MAX_STREAMED_BLOCKS);
  if (cells.length === 0) return;
  const count = el('strong', { text: '+0' });
  const badge = el('div', { className: 'secured', attrs: { 'aria-hidden': 'true' } }, [el('span', { text: 'Secured' }), count]);
  screen.append(badge);
  let arrived = 0;
  await Promise.all(cells.map((cell, index) =>
    fx.flyBlocks({ from: cell.getBoundingClientRect(), to: count, color: cellTone(cell, index), count: 1, delay: index * STAGGER_MILLISECONDS }).then(() => {
      arrived++;
      count.textContent = `+${arrived}`;
      sfx.secure(arrived);
      badge.classList.remove('is-bumped');
      void badge.offsetWidth;
      badge.classList.add('is-bumped');
    })));
  await wait(LINGER_MILLISECONDS);
  badge.classList.add('is-leaving');
  window.setTimeout(() => badge.remove(), FADE_MILLISECONDS);
}
