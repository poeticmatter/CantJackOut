import { type CampaignState, isProgramReady, loadoutDice } from '../game/campaign';
import { hitProbability } from '../game/dice';
import { type Server, hasBankedProgress, openColors } from '../game/server';
import { el, money, percent } from './dom';
import { renderFileBar } from './towers';

const MODIFIER_TEXT = {
  blackIce: { name: 'Black ICE', summary: 'Flatlining here also burns one banked block from each unfinished file.' },
  tracer: { name: 'Tracer', summary: 'Every run here costs 30 extra minutes.' },
} as const;

export interface ServerCardActions {
  readonly onJackIn: (serverId: string) => void;
  readonly onScan: (serverId: string) => void;
}

function renderArchitecture(server: Server, state: CampaignState): HTMLElement {
  const colors = openColors(server, server.tracks.map(() => 0));
  const odds = hitProbability(loadoutDice(state), colors);
  return el('div', { className: 'card-architecture' }, [
    ...server.tracks.map(renderFileBar),
    server.modifiers.length > 0
      ? el('div', { className: 'card-mods' }, server.modifiers.map((modifier) =>
          el('span', { className: `chip chip-${modifier}`, text: MODIFIER_TEXT[modifier].name, attrs: { title: MODIFIER_TEXT[modifier].summary } })))
      : null,
    el('p', { className: 'card-odds', text: `Your deck hits ${percent(odds)} of rolls here` }),
  ]);
}

function renderUnknown(server: Server, state: CampaignState, actions: ServerCardActions): HTMLElement {
  const canScan = isProgramReady(state, 'deepScan') && state.phase === 'net';
  return el('div', { className: 'card-unknown' }, [
    el('div', { className: 'card-static', attrs: { 'aria-hidden': 'true' } }),
    el('p', { text: 'Architecture unknown. Jack in to see what it holds.' }),
    canScan
      ? el('button', { className: 'btn btn-quiet btn-small', text: `Deep scan (${state.charges.deepScan} left)`, attrs: { type: 'button' }, onClick: () => actions.onScan(server.id) })
      : null,
  ]);
}

export function renderServerCard(server: Server, state: CampaignState, actions: ServerCardActions): HTMLElement {
  const isInProgress = hasBankedProgress(server);
  return el('article', { className: `server-card${server.isRevealed ? ' is-revealed' : ''}${isInProgress ? ' is-in-progress' : ''}` }, [
    el('header', { className: 'card-head' }, [
      el('span', { className: 'card-corp', text: server.corp }),
      el('h3', { className: 'card-node', text: server.name }),
    ]),
    el('div', { className: 'card-reward' }, [
      el('strong', { text: money(server.reward) }),
      el('span', { text: isInProgress ? 'when fully downloaded, in progress' : 'when fully downloaded' }),
    ]),
    server.isRevealed ? renderArchitecture(server, state) : renderUnknown(server, state, actions),
    el('button', {
      className: 'btn btn-primary card-jack',
      text: 'Jack in',
      attrs: { type: 'button', 'aria-label': `Jack in to ${server.corp} ${server.name}` },
      onClick: () => actions.onJackIn(server.id),
      isDisabled: state.phase !== 'net' || state.loadout.diceIds.length === 0,
    }),
  ]);
}
