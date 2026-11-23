import type { CampaignState, RunReport } from '../game/campaign';
import { formatClock } from '../game/clock';
import { sfx } from './audio';
import { el, money, prefersReducedMotion } from './dom';

const TITLES: Record<RunReport['ending'], string> = {
  downloaded: 'Server cracked',
  jackedOut: 'Jacked out clean',
  flatlined: 'Flatlined',
};

const COUNT_UP_MILLISECONDS = 1300;
const TICKS_DURING_COUNT = 14;

function blocks(count: number): string {
  return `${count} block${count === 1 ? '' : 's'}`;
}

function detail(report: RunReport): string {
  if (report.ending === 'downloaded') return 'Every file on this server is yours. The fence took the lot.';
  const purge = report.isPurged ? ' The alert maxed out and the sysadmin purged everything you’d banked here.' : '';
  if (report.ending === 'jackedOut') {
    const sold = report.filesSold.length > 0 ? `Sold ${report.filesSold.join(', ')}. ` : '';
    const progress = report.blocksGained > 0 ? `${sold}${blocks(report.blocksGained)} more banked. The server keeps your progress for next time.` : 'You left with nothing new banked.';
    return progress + purge;
  }
  const loss = report.blocksGained < 0 ? ` You lost ${blocks(-report.blocksGained)} you’d banked here.` : ' Everything at risk is gone. Anything you rerouted is safe.';
  const ice = report.iceBurned ? ' Black ICE burned a banked block from each unfinished file.' : '';
  return `ICE caught you and dumped you out.${loss}${ice}${purge}`;
}

/** Counts the payout up from zero with a tick per step, so a big score lands as a moment. */
function countUp(target: number): HTMLElement {
  const display = el('strong', { className: 'payout-count', text: money(prefersReducedMotion() ? target : 0) });
  if (prefersReducedMotion()) return display;
  const started = performance.now();
  let ticks = 0;
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / COUNT_UP_MILLISECONDS);
    const eased = 1 - (1 - progress) ** 3;
    display.textContent = money(Math.round((target * eased) / 10) * 10);
    if (progress * TICKS_DURING_COUNT > ticks) {
      ticks++;
      sfx.tick();
    }
    if (progress < 1 && display.isConnected) requestAnimationFrame(step);
    else display.textContent = money(target);
  };
  requestAnimationFrame(step);
  return display;
}

function renderPayout(report: RunReport): HTMLElement | null {
  if (report.payout <= 0) return null;
  return el('div', { className: 'payout' }, [el('span', { className: 'payout-label', text: `Sold to the fence: ${report.filesSold.join(', ')}` }), countUp(report.payout)]);
}

export function renderRunResult(report: RunReport, state: CampaignState, onLeave: () => void): HTMLElement {
  const isDawn = state.phase === 'dawn';
  return el('div', { className: `run-result ending-${report.ending}${report.isPurged ? ' is-purged' : ''}`, attrs: { role: 'dialog', 'aria-label': TITLES[report.ending] } }, [
    el('h2', { className: 'run-result-title', text: TITLES[report.ending], attrs: { 'data-text': TITLES[report.ending] } }),
    renderPayout(report),
    el('p', { className: 'run-result-detail', text: detail(report) }),
    el('dl', { className: 'run-result-facts' }, [
      el('dt', { text: 'Time in the net' }),
      el('dd', { text: `${report.minutes} min` }),
      el('dt', { text: 'Clock' }),
      el('dd', { text: formatClock(state.minutes) }),
    ]),
    isDawn ? el('p', { className: 'run-result-dawn', text: 'The sky is going grey. Vesna will be calling.' }) : null,
    el('button', { className: 'btn btn-primary', text: isDawn ? 'Face the dawn' : 'Back to the net', attrs: { type: 'button', autofocus: '' }, onClick: onLeave }),
  ]);
}
