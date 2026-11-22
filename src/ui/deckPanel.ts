import type { CampaignState } from '../game/campaign';
import type { Die } from '../game/dice';
import { PROGRAMS, type ProgramId } from '../game/programs';
import { el } from './dom';
import { dieLabel, dieSummary, renderDieNet } from './dieNet';

export interface DeckPanelActions {
  readonly onToggleDie: (dieId: string) => void;
  readonly onToggleProgram: (program: ProgramId) => void;
  readonly onToggleProxy: () => void;
  readonly onWaitForDawn: () => void;
}

function dieTile(die: Die, isSeated: boolean, onToggle: () => void): HTMLElement {
  return el('button', {
    className: `die-tile${isSeated ? ' is-seated' : ''}`,
    attrs: { type: 'button', 'aria-pressed': String(isSeated), title: isSeated ? 'Pull this die from the deck' : 'Seat this die in the deck' },
    onClick: onToggle,
  }, [
    el('span', { className: 'die-tile-name', text: dieLabel(die) }),
    renderDieNet(die),
    el('span', { className: 'die-tile-summary', text: dieSummary(die) }),
  ]);
}

function renderSockets(state: CampaignState, actions: DeckPanelActions): HTMLElement {
  const seated = state.loadout.diceIds.map((id) => state.dice.find((die) => die.id === id)).filter((die): die is Die => die !== undefined);
  const spare = state.dice.filter((die) => !state.loadout.diceIds.includes(die.id));
  const emptySockets = Array.from({ length: state.diceSockets - seated.length }, () =>
    el('div', { className: 'die-tile is-empty', text: 'Empty socket' }));
  return el('section', { className: 'deck-section' }, [
    el('h2', { className: 'deck-heading', text: `Dice ${seated.length} of ${state.diceSockets} sockets` }),
    el('div', { className: 'die-tiles' }, [...seated.map((die) => dieTile(die, true, () => actions.onToggleDie(die.id))), ...emptySockets]),
    spare.length > 0 ? el('h3', { className: 'deck-subheading', text: 'Spare dice' }) : null,
    spare.length > 0 ? el('div', { className: 'die-tiles' }, spare.map((die) => dieTile(die, false, () => actions.onToggleDie(die.id)))) : null,
  ]);
}

function checkbox(isChecked: boolean, onChange: () => void): HTMLInputElement {
  const input = el('input', { attrs: { type: 'checkbox' } });
  input.checked = isChecked;
  input.addEventListener('change', onChange);
  return input;
}

function renderPrograms(state: CampaignState, actions: DeckPanelActions, isProxyArmed: boolean): HTMLElement {
  const loaded = state.loadout.programIds;
  const programTiles = state.ownedPrograms.map((id) => {
    const isLoaded = loaded.includes(id);
    return el('button', {
      className: `program-tile${isLoaded ? ' is-loaded' : ''}`,
      attrs: { type: 'button', 'aria-pressed': String(isLoaded), title: PROGRAMS[id].summary },
      onClick: () => actions.onToggleProgram(id),
    }, [
      el('span', { className: 'program-name', text: PROGRAMS[id].name }),
      el('span', { className: 'program-charges', text: `${state.charges[id]}/${PROGRAMS[id].chargesPerNight} tonight` }),
    ]);
  });
  const canArmProxy = loaded.includes('proxy') && state.charges.proxy > 0;
  return el('section', { className: 'deck-section' }, [
    el('h2', { className: 'deck-heading', text: `Programs ${loaded.length} of ${state.programSlots} slots` }),
    programTiles.length > 0
      ? el('div', { className: 'program-tiles' }, programTiles)
      : el('p', { className: 'deck-empty', text: 'No programs yet. The market sells them.' }),
    canArmProxy
      ? el('label', { className: 'proxy-toggle' }, [
          checkbox(isProxyArmed, actions.onToggleProxy),
          el('span',{ text: 'Route the next run through the proxy chain (half the time)' }),
        ])
      : null,
  ]);
}

export function renderDeckPanel(state: CampaignState, actions: DeckPanelActions, isProxyArmed: boolean): HTMLElement {
  return el('aside', { className: 'deck-panel', attrs: { 'aria-label': 'Your deck' } }, [
    el('h1', { className: 'deck-title', text: 'Your deck' }),
    renderSockets(state, actions),
    renderPrograms(state, actions, isProxyArmed),
    el('button', { className: 'btn btn-quiet deck-wait', text: 'Call it a night', attrs: { type: 'button', title: 'Skip ahead to dawn and settle up with Vesna.' }, onClick: actions.onWaitForDawn }),
  ]);
}
