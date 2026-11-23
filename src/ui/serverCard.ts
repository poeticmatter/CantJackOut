import { type CampaignState, isProgramReady } from '../game/campaign';
import { type Server, hasBankedProgress, remainingValue } from '../game/server';
import { el, money } from './dom';
import { renderAlertMeter, renderFileBar } from './towers';

const MODIFIER_TEXT = {
  blackIce: { name: 'Black ICE', summary: 'Flatlining here also burns one banked block from each unfinished file.' },
  tracer: { name: 'Tracer', summary: 'Every run here costs 30 extra minutes.' },
} as const;

export interface ServerCardActions {
  readonly onJackIn: (serverId: string) => void;
  readonly onScan: (serverId: string) => void;
}

function renderArchitecture(server: Server): HTMLElement {
  return el('div', { className: 'card-architecture' }, [
    ...server.files.map(renderFileBar),
    server.modifiers.length > 0
      ? el('div', { className: 'card-mods' }, server.modifiers.map((modifier) =>
          el('span', { className: `chip chip-${modifier}`, text: MODIFIER_TEXT[modifier].name, attrs: { title: MODIFIER_TEXT[modifier].summary } })))
      : null,
    renderAlertMeter(server),
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
      el('strong', { text: money(remainingValue(server)) }),
      el('span', { text: isInProgress ? 'left to sell, paid per file' : 'across six files, paid per file' }),
    ]),
    server.isRevealed ? renderArchitecture(server) : renderUnknown(server, state, actions),
    el('button', {
      className: 'btn btn-primary card-jack',
      text: 'Jack in',
      attrs: { type: 'button', 'aria-label': `Jack in to ${server.corp} ${server.name}` },
      onClick: () => actions.onJackIn(server.id),
      isDisabled: state.phase !== 'net',
    }),
  ]);
}
