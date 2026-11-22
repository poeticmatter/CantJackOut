import { type CampaignState, FINAL_NIGHT, MAX_STRIKES } from '../game/campaign';
import { previewDawn } from '../game/dawn';
import { el, money } from './dom';

function dawnMessage(state: CampaignState): string {
  const { vig, isPaid, isFinalNight } = previewDawn(state);
  if (isPaid && isFinalNight) return `Last payment: ${money(vig)}. Pay it and the deck is yours, free and clear.`;
  if (isPaid) return `Vesna is here for her cut: ${money(vig)}. You have ${money(state.money)}.`;
  if (isFinalNight) return `Vesna wants the last ${money(vig)}. You have ${money(state.money)}. She won’t wait another night.`;
  const strike = state.strikes + 1;
  const warning = strike >= MAX_STRIKES ? ' That is your last strike.' : ` That makes ${strike} of ${MAX_STRIKES} strikes.`;
  return `Vesna wants ${money(vig)}. You have ${money(state.money)}. She’ll take all of it and mark a strike.${warning}`;
}

export function renderDawn(state: CampaignState, onSettle: () => void): HTMLElement {
  const { vig, isPaid } = previewDawn(state);
  return el('section', { className: 'dawn-screen', attrs: { 'aria-label': 'Dawn' } }, [
    el('div', { className: 'dawn-sun', attrs: { 'aria-hidden': 'true' } }),
    el('div', { className: 'dawn-card' }, [
      el('p', { className: 'dawn-time', text: `06:00, night ${state.night} of ${FINAL_NIGHT}` }),
      el('h1', { text: 'Dawn' }),
      el('p', { className: 'dawn-message', text: dawnMessage(state) }),
      el('button', {
        className: `btn ${isPaid ? 'btn-primary' : 'btn-danger'}`,
        text: isPaid ? `Pay Vesna ${money(vig)}` : 'Hand over what you have',
        attrs: { type: 'button', autofocus: '' },
        onClick: onSettle,
      }),
    ]),
  ]);
}

export function renderEnding(state: CampaignState, onNewGame: () => void): HTMLElement {
  const isWon = state.phase === 'won';
  const { stats } = state;
  return el('section', { className: `ending-screen ${isWon ? 'is-won' : 'is-lost'}` }, [
    el('div', { className: 'dawn-card' }, [
      el('h1', { text: isWon ? 'Free and clear' : 'Vesna takes the deck' }),
      el('p', {
        className: 'dawn-message',
        text: isWon
          ? `Ten nights, every payment made. The deck is yours now, and so is ${money(state.money)}.`
          : `You made it to night ${state.night}. Her people unplug the deck while you watch.`,
      }),
      el('dl', { className: 'run-result-facts' }, [
        el('dt', { text: 'Servers cracked' }), el('dd', { text: String(stats.serversCracked) }),
        el('dt', { text: 'Data sold' }), el('dd', { text: money(stats.earned) }),
        el('dt', { text: 'Runs' }), el('dd', { text: String(stats.runs) }),
        el('dt', { text: 'Flatlines' }), el('dd', { text: String(stats.flatlines) }),
      ]),
      el('button', { className: 'btn btn-primary', text: 'Start a new game', attrs: { type: 'button' }, onClick: onNewGame }),
    ]),
  ]);
}
