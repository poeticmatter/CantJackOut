import type { CampaignState } from '../game/campaign';
import { PROGRAMS, PROGRAM_IDS, type ProgramId } from '../game/programs';
import { nextProgramSlotPrice } from '../game/shop';
import { MOTH, renderCall } from './characterCall';
import { el, money } from './dom';

export interface MarketActions {
  readonly onClose: () => void;
  readonly onBuyProgramSlot: () => void;
  readonly onBuyProgram: (program: ProgramId) => void;
}

export interface Market {
  readonly element: HTMLElement;
  update(state: CampaignState): void;
}

function priceButton(label: string, price: number, canAfford: boolean, onBuy: () => void): HTMLButtonElement {
  return el('button', {
    className: 'btn btn-buy',
    text: money(price),
    attrs: { type: 'button', 'aria-label': `Buy ${label} for ${money(price)}` },
    onClick: onBuy,
    isDisabled: !canAfford,
  });
}

function offer(title: string, summary: string, price: number | null, state: CampaignState, onBuy: () => void): HTMLElement {
  return el('div', { className: 'offer' }, [
    el('div', { className: 'offer-text' }, [el('h4', { text: title }), el('p', { text: summary })]),
    price === null ? el('span', { className: 'offer-done', text: 'Maxed' }) : priceButton(title, price, state.money >= price, onBuy),
  ]);
}

function renderHardware(state: CampaignState, actions: MarketActions): HTMLElement {
  return el('section', { className: 'market-section' }, [
    el('h3', { text: 'Deck hardware' }),
    offer('Program slot', 'Load one more program into the deck.', nextProgramSlotPrice(state), state, actions.onBuyProgramSlot),
  ]);
}

function renderProgramChip(state: CampaignState, id: ProgramId, actions: MarketActions): HTMLElement {
  const program = PROGRAMS[id];
  const isOwned = state.ownedPrograms.includes(id);
  const uses = `${program.chargesPerNight} use${program.chargesPerNight === 1 ? '' : 's'} a night`;
  return el('div', { className: `chip-card${isOwned ? ' is-owned' : ''}` }, [
    el('div', { className: 'chip-card-pins', attrs: { 'aria-hidden': 'true' } }),
    el('h4', { text: program.name }),
    el('p', { text: program.summary }),
    el('small', { text: uses }),
    isOwned ? el('span', { className: 'offer-done', text: 'Owned' }) : priceButton(program.name, program.price, state.money >= program.price, () => actions.onBuyProgram(id)),
  ]);
}

function renderPrograms(state: CampaignState, actions: MarketActions): HTMLElement {
  return el('section', { className: 'market-section' }, [
    el('h3', { text: 'Programs' }),
    el('div', { className: 'chip-cabinet' }, PROGRAM_IDS.map((id) => renderProgramChip(state, id, actions))),
  ]);
}

function mothLine(): string[] {
  return ['No dice on the bench this week. Programs, though, I can do.', 'Four standard dice and two hands. Learn to split them before you ask me for anything fancy.'];
}

export function createMarket(actions: MarketActions): Market {
  const cash = el('span', { className: 'market-cash' });
  const body = el('div', { className: 'market-columns' });
  const element = el('div', { className: 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Moth’s back room' } }, [
    el('div', { className: 'overlay-panel market' }, [
      el('header', { className: 'overlay-head' }, [
        el('h2', { text: 'Moth’s back room' }),
        cash,
        el('button', { className: 'btn btn-quiet', text: 'Close', attrs: { type: 'button' }, onClick: actions.onClose }),
      ]),
      renderCall(MOTH, { lines: mothLine(), actions: [], className: 'call-compact' }),
      body,
    ]),
  ]);
  return {
    element,
    update(state) {
      cash.textContent = `Cash ${money(state.money)}`;
      body.replaceChildren(el('div', { className: 'market-side' }, [renderHardware(state, actions), renderPrograms(state, actions)]));
    },
  };
}
