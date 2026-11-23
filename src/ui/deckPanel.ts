import type { CampaignState } from '../game/campaign';
import type { Die } from '../game/dice';
import { MAX_STREAMS } from '../game/pairing';
import { PROGRAMS, type ProgramId } from '../game/programs';
import { el } from './dom';
import { dieLabel, dieSummary, renderDieNet } from './dieNet';

export interface DeckPanelActions {
  readonly onToggleProgram: (program: ProgramId) => void;
  readonly onToggleProxy: () => void;
  readonly onWaitForDawn: () => void;
}

function dieTile(die: Die): HTMLElement {
  return el('div', { className: 'die-tile is-seated' }, [
    el('span', { className: 'die-tile-name', text: dieLabel(die) }),
    renderDieNet(die),
    el('span', { className: 'die-tile-summary', text: dieSummary(die) }),
  ]);
}

function renderDice(state: CampaignState): HTMLElement {
  return el('section', { className: 'deck-section' }, [
    el('h2', { className: 'deck-heading', text: `Dice ${state.dice.length}` }),
    el('p', { className: 'deck-empty', text: `Each roll splits into two pairs. A run can work on ${MAX_STREAMS} files.` }),
    el('div', { className: 'die-tiles' }, state.dice.map(dieTile)),
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
          el('span', { text: 'Route the next run through the proxy chain (half the time)' }),
        ])
      : null,
  ]);
}

export function renderDeckPanel(state: CampaignState, actions: DeckPanelActions, isProxyArmed: boolean): HTMLElement {
  return el('aside', { className: 'deck-panel', attrs: { 'aria-label': 'Your deck' } }, [
    el('h1', { className: 'deck-title', text: 'Your deck' }),
    renderDice(state),
    renderPrograms(state, actions, isProxyArmed),
    el('button', { className: 'btn btn-quiet deck-wait', text: 'Call it a night', attrs: { type: 'button', title: 'Skip ahead to dawn and settle up with Vesna.' }, onClick: actions.onWaitForDawn }),
  ]);
}
