import type { CampaignState } from '../game/campaign';
import type { Die } from '../game/dice';
import { PROGRAMS, PROGRAM_IDS, type ProgramId } from '../game/programs';
import {
  ANCHOR_PRICE, FACE_DESIGNS, type FaceDesign, OVERCLOCK_PRICE, SPARE_DIE_PRICE, designPrice, faceFromDesign, isFaceOfDesign,
  nextProgramSlotPrice, nextSocketPrice,
} from '../game/shop';
import { MOTH, renderCall } from './characterCall';
import { el, money } from './dom';
import { dieLabel, dieSummary, faceContent, renderDieNet } from './dieNet';
import { COLOR_LABEL, describeFace, faceClasses } from './faceStyle';

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
  readonly onFlash: (dieId: string, faceIndex: number, design: FaceDesign) => void;
  readonly onOverclock: (dieId: string, faceIndex: number) => void;
  readonly onAnchor: (dieId: string, faceIndex: number) => void;
}

export interface Market {
  readonly element: HTMLElement;
  update(state: CampaignState, selection: MarketSelection): void;
}

const DESIGN_BLURB: Record<FaceDesign['kind'], string> = {
  single: 'Downloads its color.',
  dual: 'Matches either color; goes where it’s needed most.',
  wild: 'Matches any color.',
  firewall: 'Never downloads. If it shows on a miss, the miss is blocked.',
  payday: 'Never downloads. Pays cash every time it shows.',
};

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
    offer('Dice socket', 'Roll one more die every time. Comes with a standard die seated in it.', nextSocketPrice(state), state, actions.onBuySocket),
    offer('Program slot', 'Load one more program into the deck.', nextProgramSlotPrice(state), state, actions.onBuyProgramSlot),
    offer('Spare standard die', 'A blank to flash into a second build. Swap dice between runs.', SPARE_DIE_PRICE, state, actions.onBuySpareDie),
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

function designLabel(design: FaceDesign): string {
  switch (design.kind) {
    case 'single': return COLOR_LABEL[design.color];
    case 'dual': return `${COLOR_LABEL[design.colors[0]]} or ${COLOR_LABEL[design.colors[1]].toLowerCase()}`;
    case 'wild': return 'Wild';
    case 'firewall': return 'Firewall';
    case 'payday': return 'Payday';
  }
}

function designButton(state: CampaignState, die: Die | null, faceIndex: number | null, design: FaceDesign, actions: MarketActions): HTMLElement {
  const price = designPrice(design);
  const current = die !== null && faceIndex !== null ? die.faces[faceIndex] : null;
  const preview = faceFromDesign(design, current ?? { kind: 'payday' });
  const isCurrent = current !== null && isFaceOfDesign(current, design);
  const canBuy = current !== null && !isCurrent && state.money >= price;
  return el('button', {
    className: `design ${isCurrent ? 'is-current' : ''}`,
    attrs: { type: 'button', title: DESIGN_BLURB[design.kind] },
    onClick: () => {
      if (die !== null && faceIndex !== null) actions.onFlash(die.id, faceIndex, design);
    },
    isDisabled: !canBuy,
  }, [
    el('span', { className: `design-face ${faceClasses(preview)}` }, faceContent(preview, 'design')),
    el('span', { className: 'design-name', text: designLabel(design) }),
    el('span', { className: 'design-price', text: isCurrent ? 'Current' : money(price) }),
  ]);
}

function upgradeButton(label: string, blurb: string, price: number, isDone: boolean, canUse: boolean, onBuy: () => void): HTMLElement {
  return el('button', { className: 'design design-upgrade', attrs: { type: 'button', title: blurb }, onClick: onBuy, isDisabled: !canUse }, [
    el('span', { className: 'design-name', text: label }),
    el('span', { className: 'design-blurb', text: blurb }),
    el('span', { className: 'design-price', text: isDone ? 'Done' : money(price) }),
  ]);
}

function renderFlashMenu(state: CampaignState, die: Die | null, faceIndex: number | null, actions: MarketActions): HTMLElement {
  const face = die !== null && faceIndex !== null ? die.faces[faceIndex] : null;
  const isData = face?.kind === 'data';
  const isOverclocked = face?.kind === 'data' && face.boost === 2;
  const isAnchored = face?.kind === 'data' && face.isAnchored;
  const target = (action: (dieId: string, index: number) => void) => () => {
    if (die !== null && faceIndex !== null) action(die.id, faceIndex);
  };
  const targetText = die === null || faceIndex === null || face === null
    ? 'Pick a face on any die above. Every option and its price is listed here.'
    : `${dieLabel(die)}, face ${faceIndex + 1}: ${describeFace(face)}`;
  return el('div', { className: 'flash-menu' }, [
    el('p', { className: `flash-target${face === null ? ' is-waiting' : ''}`, text: targetText }),
    el('h4', { text: 'Reflash it as' }),
    el('div', { className: 'design-grid' }, FACE_DESIGNS.map((design) => designButton(state, die, faceIndex, design, actions))),
    el('h4', { text: 'Or upgrade it' }),
    el('div', { className: 'design-grid is-upgrades' }, [
      upgradeButton('Overclock', 'Downloads two blocks instead of one.', OVERCLOCK_PRICE, isOverclocked, isData && !isOverclocked && state.money >= OVERCLOCK_PRICE, target(actions.onOverclock)),
      upgradeButton('Anchor', 'Blocks it downloads are banked on the spot.', ANCHOR_PRICE, isAnchored, isData && !isAnchored && state.money >= ANCHOR_PRICE, target(actions.onAnchor)),
    ]),
  ]);
}

function renderBench(state: CampaignState, selection: MarketSelection, actions: MarketActions): HTMLElement {
  const die = state.dice.find((candidate) => candidate.id === selection.dieId) ?? null;
  const faceIndex = die === null ? null : selection.faceIndex;
  return el('section', { className: 'market-section bench' }, [
    el('h3', { text: 'The bench' }),
    el('div', { className: 'bench-dice' }, state.dice.map((candidate) => {
      const isSelected = candidate.id === die?.id;
      return el('div', { className: `bench-die${isSelected ? ' is-selected' : ''}${state.loadout.diceIds.includes(candidate.id) ? ' is-seated' : ''}` }, [
        el('span', { className: 'bench-die-name', text: `${dieLabel(candidate)}${state.loadout.diceIds.includes(candidate.id) ? '' : ' (spare)'}` }),
        renderDieNet(candidate, {
          selectedFace: isSelected ? faceIndex : null,
          onFaceClick: (index) => actions.onSelect({ dieId: candidate.id, faceIndex: index }),
        }),
        el('small', { text: dieSummary(candidate) }),
      ]);
    })),
    renderFlashMenu(state, die, faceIndex, actions),
  ]);
}

function mothLine(): string[] {
  return ['Bring me a die. I’ll teach it to lie.', 'Click a face, pick what it should be. Red costs. Wild costs more.'];
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
    update(state, selection) {
      cash.textContent = `Cash ${money(state.money)}`;
      body.replaceChildren(renderBench(state, selection, actions), el('div', { className: 'market-side' }, [renderHardware(state, actions), renderPrograms(state, actions)]));
    },
  };
}
