import { type CampaignState, FINAL_NIGHT, MAX_STRIKES, vigForNight } from '../game/campaign';
import { NIGHT_MINUTES, formatClock } from '../game/clock';
import { isSoundMuted } from './audio';
import { el, money } from './dom';

export interface HudActions {
  readonly onOpenMarket: () => void;
  readonly onOpenHelp: () => void;
  readonly onToggleSound: () => void;
  readonly onNewGame: () => void;
}

function nightBar(state: CampaignState): HTMLElement {
  const progress = Math.min(1, state.minutes / NIGHT_MINUTES);
  return el('div', { className: 'night-bar', attrs: { role: 'meter', 'aria-label': 'Time until dawn', 'aria-valuemin': '0', 'aria-valuemax': String(NIGHT_MINUTES), 'aria-valuenow': String(state.minutes) } }, [
    el('span', { className: 'night-bar-end', text: '22:00' }),
    el('div', { className: 'night-bar-track' }, [
      el('div', { className: 'night-bar-fill', style: { width: `${progress * 100}%` } }),
      el('div', { className: 'night-bar-now', style: { left: `${progress * 100}%` } }, [el('span', { text: formatClock(state.minutes) })]),
    ]),
    el('span', { className: 'night-bar-end is-dawn', text: '06:00' }),
  ]);
}

function strikes(state: CampaignState): HTMLElement {
  const marks = Array.from({ length: MAX_STRIKES }, (_, index) =>
    el('span', { className: `strike${index < state.strikes ? ' is-struck' : ''}` }),
  );
  return el('div', { className: 'hud-stat hud-strikes', attrs: { title: 'Miss three of Vesna’s payments and she takes the deck.' } }, [
    el('span', { className: 'hud-label', text: 'Strikes' }),
    el('div', { className: 'strike-marks' }, marks),
  ]);
}

export function renderHud(state: CampaignState, actions: HudActions): HTMLElement {
  const vig = vigForNight(state.night);
  const isShort = state.money < vig;
  return el('header', { className: 'hud' }, [
    el('div', { className: 'wordmark', attrs: { 'aria-label': 'Can’t Jack Out' } }, [
      el('span', { text: 'Can’t' }), el('strong', { text: 'Jack Out' }),
    ]),
    el('div', { className: 'hud-stat' }, [el('span', { className: 'hud-label', text: 'Night' }), el('strong', { text: `${state.night} of ${FINAL_NIGHT}` })]),
    nightBar(state),
    el('div', { className: 'hud-stat' }, [el('span', { className: 'hud-label', text: 'Cash' }), el('strong', { className: 'is-money', text: money(state.money) })]),
    el('div', { className: `hud-stat${isShort ? ' is-short' : ''}`, attrs: { title: 'Vesna collects this at dawn.' } }, [
      el('span', { className: 'hud-label', text: 'Vesna’s cut at dawn' }),
      el('strong', { text: money(vig) }),
    ]),
    strikes(state),
    el('nav', { className: 'hud-actions', attrs: { 'aria-label': 'Game menu' } }, [
      el('button', { className: 'btn btn-market', text: 'Market', attrs: { type: 'button' }, onClick: actions.onOpenMarket, isDisabled: state.phase !== 'net' }),
      el('button', { className: 'btn btn-quiet', text: 'How to play', attrs: { type: 'button' }, onClick: actions.onOpenHelp }),
      el('button', { className: 'btn btn-quiet', text: isSoundMuted() ? 'Sound off' : 'Sound on', attrs: { type: 'button', 'aria-pressed': String(!isSoundMuted()) }, onClick: actions.onToggleSound }),
      el('button', { className: 'btn btn-quiet', text: 'New game', attrs: { type: 'button' }, onClick: actions.onNewGame }),
    ]),
  ]);
}
