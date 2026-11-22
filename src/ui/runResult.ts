import { type CampaignState, type RunReport } from '../game/campaign';
import { formatClock } from '../game/clock';
import { el, money } from './dom';

const TITLES: Record<RunReport['ending'], string> = {
  downloaded: 'Download complete',
  jackedOut: 'Jacked out clean',
  flatlined: 'Flatlined',
};

function detail(report: RunReport): string {
  if (report.ending === 'downloaded') return `Every file is yours. The fence paid ${money(report.payout)} for the data.`;
  if (report.ending === 'jackedOut') {
    return report.stepsBanked > 0
      ? `${report.stepsBanked} block${report.stepsBanked === 1 ? '' : 's'} banked. The server keeps your progress for next time.`
      : 'You left without pulling anything. You know what’s on the server now.';
  }
  const kept = report.stepsBanked > 0 ? ` Failsafe saved ${report.stepsBanked} block${report.stepsBanked === 1 ? '' : 's'}.` : ' The unbanked download is gone.';
  const ice = report.iceBurned ? ' Black ICE also burned a banked block from each unfinished file.' : '';
  return `ICE caught you and dumped you out.${kept}${ice}`;
}

export function renderRunResult(report: RunReport, state: CampaignState, onLeave: () => void): HTMLElement {
  const isDawn = state.phase === 'dawn';
  return el('div', { className: `run-result ending-${report.ending}`, attrs: { role: 'dialog', 'aria-label': TITLES[report.ending] } }, [
    el('h2', { className: 'run-result-title', text: TITLES[report.ending], attrs: { 'data-text': TITLES[report.ending] } }),
    el('p', { className: 'run-result-detail', text: detail(report) }),
    el('dl', { className: 'run-result-facts' }, [
      el('dt', { text: 'Time in the net' }),
      el('dd', { text: `${report.minutes} min` }),
      el('dt', { text: 'Clock' }),
      el('dd', { text: formatClock(state.minutes) }),
      report.payout > 0 ? el('dt', { text: 'Paid' }) : null,
      report.payout > 0 ? el('dd', { text: money(report.payout) }) : null,
    ]),
    isDawn ? el('p', { className: 'run-result-dawn', text: 'The sky is going grey. Vesna will be calling.' }) : null,
    el('button', { className: 'btn btn-primary', text: isDawn ? 'Face the dawn' : 'Back to the net', attrs: { type: 'button', autofocus: '' }, onClick: onLeave }),
  ]);
}
