import type { CampaignState } from '../game/campaign';
import type { FaceColor } from '../game/dice';
import { PROGRAMS, PROGRAM_IDS, type ProgramId } from '../game/programs';
import {
  OVERCLOCK_PRICE, RECOLOR_PRICES, SPARE_DIE_PRICE, nextProgramSlotPrice, nextSocketPrice,
} from '../game/shop';
import { el, money } from './dom';
import { dieLabel, dieSummary, renderDieNet } from './dieNet';
import { COLOR_LABEL, glyph } from './faceStyle';

export interface MarketSelection {
  readonly dieId: string | null;
  readonly faceIndex: number | null;
}

export interface MarketActions {
  readonly onClose: () => void;
  readonly onBuySocket: () => void;
  readonly onBuyProgramSlot: () => void;
  readonly onBuyProgram: (program: ProgramId) => void;
  readonly onBuySpareDie: () => void;
  readonly onSelect: (selection: MarketSelection) => void;
  readonly onRecolor: (dieId: string, faceIndex: number, color: FaceColor) => void;
  readonly onOverclock: (dieId: string, faceIndex: number) => void;
}

const FLASH_ORDER: readonly FaceColor[] = ['red', 'blue', 'green', 'wild'];

function offer(title: string, summary: string, price: number | null, canAfford: boolean, onBuy: () => void): HTMLElement {
  return el('div', { className: 'offer' }, [
    el('div', { className: 'offer-text' }, [el('h4', { text: title }), el('p', { text: summary })]),
    price === null
      ? el('span', { className: 'offer-done', text: 'Maxed' })
      : el('button', { className: 'btn btn-buy', text: money(price), attrs: { type: 'button', 'aria-label': `Buy ${title} for ${money(price)}` }, onClick: onBuy, isDisabled: !canAfford }),
  ]);
}

function renderHardware(state: CampaignState, actions: MarketActions): HTMLElement {
  const socketPrice = nextSocketPrice(state);
  const slotPrice = nextProgramSlotPrice(state);
  return el('section', { className: 'market-section' }, [
    el('h3', { text: 'Deck hardware' }),
    offer('Dice socket', 'Roll one more die every time. Comes with a standard die seated in it.', socketPrice, socketPrice !== null && state.money >= socketPrice, actions.onBuySocket),
    offer('Program slot', 'Load one more program into the deck.', slotPrice, slotPrice !== null && state.money >= slotPrice, actions.onBuyProgramSlot),
  ]);
}

function renderPrograms(state: CampaignState, actions: MarketActions): HTMLElement {
  return el('section', { className: 'market-section' }, [
    el('h3', { text: 'Programs' }),
    ...PROGRAM_IDS.map((id) => {
      const program = PROGRAMS[id];
      const summary = `${program.summary} ${program.chargesPerNight} use${program.chargesPerNight === 1 ? '' : 's'} a night.`;
      return state.ownedPrograms.includes(id)
        ? el('div', { className: 'offer is-owned' }, [el('div', { className: 'offer-text' }, [el('h4', { text: program.name }), el('p', { text: summary })]), el('span', { className: 'offer-done', text: 'Owned' })])
        : offer(program.name, summary, program.price, state.money >= program.price, () => actions.onBuyProgram(id));
    }),
  ]);
}

function renderFaceActions(state: CampaignState, dieId: string, faceIndex: number, actions: MarketActions): HTMLElement {
  const die = state.dice.find((candidate) => candidate.id === dieId);
  if (die === undefined) return el('div');
  const face = die.faces[faceIndex];
  const flashButtons = FLASH_ORDER.filter((color) => color !== face.color).map((color) =>
    el('button', {
      className: `btn btn-flash face-${color}`,
      attrs: { type: 'button' },
      onClick: () => actions.onRecolor(dieId, faceIndex, color),
      isDisabled: state.money < RECOLOR_PRICES[color],
    }, [glyph(color, 'flash-glyph'), el('span', { text: `Flash ${COLOR_LABEL[color].toLowerCase()}` }), el('small', { text: money(RECOLOR_PRICES[color]) })]),
  );
  const overclock = face.boost === 2
    ? el('span', { className: 'offer-done', text: 'Overclocked' })
    : el('button', { className: 'btn btn-flash', attrs: { type: 'button' }, onClick: () => actions.onOverclock(dieId, faceIndex), isDisabled: state.money < OVERCLOCK_PRICE }, [
        el('span', { text: 'Overclock: counts double' }), el('small', { text: money(OVERCLOCK_PRICE) }),
      ]);
  return el('div', { className: 'face-actions' }, [...flashButtons, overclock]);
}

function renderLab(state: CampaignState, selection: MarketSelection, actions: MarketActions): HTMLElement {
  const selectedDie = state.dice.find((die) => die.id === selection.dieId) ?? null;
  return el('section', { className: 'market-section market-lab' }, [
    el('h3', { text: 'Dice lab' }),
    el('p', { className: 'market-hint', text: 'Pick a die, then a face, then reflash it. Red faces make red files easy, but every face you take from green makes green files harder.' }),
    el('div', { className: 'lab-dice' }, state.dice.map((die) =>
      el('button', {
        className: `lab-die${die.id === selection.dieId ? ' is-selected' : ''}`,
        attrs: { type: 'button', 'aria-pressed': String(die.id === selection.dieId) },
        onClick: () => actions.onSelect({ dieId: die.id, faceIndex: null }),
      }, [el('span', { text: dieLabel(die) }), renderDieNet(die), el('small', { text: dieSummary(die) })]))),
    selectedDie === null
      ? null
      : el('div', { className: 'lab-bench' }, [
          el('h4', { text: `${dieLabel(selectedDie)}: choose a face` }),
          renderDieNet(selectedDie, { selectedFace: selection.faceIndex, onFaceClick: (faceIndex) => actions.onSelect({ dieId: selectedDie.id, faceIndex }) }),
          selection.faceIndex === null ? null : renderFaceActions(state, selectedDie.id, selection.faceIndex, actions),
        ]),
    offer('Spare standard die', 'Keep a second build ready and swap dice between runs.', SPARE_DIE_PRICE, state.money >= SPARE_DIE_PRICE, actions.onBuySpareDie),
  ]);
}

export function renderMarket(state: CampaignState, selection: MarketSelection, actions: MarketActions): HTMLElement {
  return el('div', { className: 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Market' } }, [
    el('div', { className: 'overlay-panel market' }, [
      el('header', { className: 'overlay-head' }, [
        el('h2', { text: 'Market' }),
        el('span', { className: 'market-cash', text: `Cash ${money(state.money)}` }),
        el('button', { className: 'btn btn-quiet', text: 'Close', attrs: { type: 'button' }, onClick: actions.onClose }),
      ]),
      el('div', { className: 'market-columns' }, [
        el('div', {}, [renderHardware(state, actions), renderPrograms(state, actions)]),
        renderLab(state, selection, actions),
      ]),
    ]),
  ]);
}
