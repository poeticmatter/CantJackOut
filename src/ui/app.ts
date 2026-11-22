import { deepScan, jackIn, waitForDawn } from '../game/actions';
import type { CampaignState } from '../game/campaign';
import { settleDawn } from '../game/dawn';
import {
  buyProgram, buyProgramSlot, buySocket, buySpareDie, overclockFace, recolorFace, toggleDieInLoadout,
  toggleProgramInLoadout,
} from '../game/shop';
import { sfx, toggleMute } from './audio';
import { renderDawn, renderEnding } from './dawnScreen';
import { renderDeckPanel } from './deckPanel';
import { el } from './dom';
import { renderHelp } from './help';
import { renderHud } from './hud';
import { type MarketSelection, renderMarket } from './market';
import { createRunScreen } from './runScreen';
import { renderServerCard } from './serverCard';
import type { Store, Transition } from './store';

interface UiState {
  isMarketOpen: boolean;
  isHelpOpen: boolean;
  isProxyArmed: boolean;
  isShowingRunResult: boolean;
  marketSelection: MarketSelection;
}

export function startApp(root: HTMLElement, store: Store): void {
  const ui: UiState = {
    isMarketOpen: false,
    isHelpOpen: !store.hasSavedGame,
    isProxyArmed: false,
    isShowingRunResult: false,
    marketSelection: { dieId: null, faceIndex: null },
  };

  const apply = (transition: Transition, sound: () => void = sfx.click) => {
    if (store.apply(transition)) sound();
  };

  const runScreen = createRunScreen(store, () => {
    ui.isShowingRunResult = false;
    render();
  });

  const renderNet = (state: CampaignState): HTMLElement =>
    el('main', { className: 'net-screen' }, [
      el('section', { className: 'board', attrs: { 'aria-label': 'Servers on the net' } }, state.board.map((server) =>
        renderServerCard(server, state, {
          onJackIn: (serverId) => {
            const useProxy = ui.isProxyArmed;
            ui.isProxyArmed = false;
            store.apply((current) => jackIn(current, serverId, useProxy));
          },
          onScan: (serverId) => apply((current) => deepScan(current, serverId)),
        }))),
      renderDeckPanel(state, {
        onToggleDie: (dieId) => apply((current) => toggleDieInLoadout(current, dieId)),
        onToggleProgram: (program) => apply((current) => toggleProgramInLoadout(current, program)),
        onToggleProxy: () => {
          ui.isProxyArmed = !ui.isProxyArmed;
          render();
        },
        onWaitForDawn: () => {
          if (window.confirm('Call it a night? The clock jumps to dawn and Vesna collects.')) apply(waitForDawn);
        },
      }, ui.isProxyArmed),
    ]);

  const renderOverlays = (state: CampaignState): (HTMLElement | null)[] => [
    ui.isMarketOpen && state.phase === 'net'
      ? renderMarket(state, ui.marketSelection, {
          onClose: () => {
            ui.isMarketOpen = false;
            render();
          },
          onBuySocket: () => apply(buySocket, sfx.coins),
          onBuyProgramSlot: () => apply(buyProgramSlot, sfx.coins),
          onBuyProgram: (program) => apply((current) => buyProgram(current, program), sfx.coins),
          onBuySpareDie: () => apply(buySpareDie, sfx.coins),
          onSelect: (selection) => {
            ui.marketSelection = selection;
            render();
          },
          onRecolor: (dieId, faceIndex, color) => apply((current) => recolorFace(current, dieId, faceIndex, color), sfx.coins),
          onOverclock: (dieId, faceIndex) => apply((current) => overclockFace(current, dieId, faceIndex), sfx.coins),
        })
      : null,
    ui.isHelpOpen
      ? renderHelp(() => {
          ui.isHelpOpen = false;
          render();
        })
      : null,
  ];

  const hudActions = {
    onOpenMarket: () => {
      ui.isMarketOpen = true;
      render();
    },
    onOpenHelp: () => {
      ui.isHelpOpen = true;
      render();
    },
    onToggleSound: () => {
      toggleMute();
      render();
    },
    onNewGame: () => {
      if (!window.confirm('Start a new game? This one will be lost.')) return;
      ui.isShowingRunResult = false;
      store.startNewGame();
    },
  };

  function renderMainContent(state: CampaignState): HTMLElement {
    if (state.phase === 'dawn') return renderDawn(state, () => apply(settleDawn, sfx.coins));
    if (state.phase === 'won' || state.phase === 'lost') return renderEnding(state, () => store.startNewGame());
    return renderNet(state);
  }

  function render(): void {
    const state = store.current();
    const isRunVisible = state.phase === 'run' || ui.isShowingRunResult;
    const overlays = renderOverlays(state).filter((overlay): overlay is HTMLElement => overlay !== null);
    if (isRunVisible) {
      // Re-inserting the run screen would restart its CSS animations mid-roll, so keep it mounted.
      if (root.firstElementChild !== runScreen.element) root.replaceChildren(runScreen.element);
      while (root.lastElementChild !== null && root.lastElementChild !== runScreen.element) root.lastElementChild.remove();
      root.append(...overlays);
      runScreen.update(state);
      return;
    }
    root.replaceChildren(renderHud(state, hudActions), renderMainContent(state), ...overlays);
    const autofocus = root.querySelector<HTMLElement>('[autofocus]');
    autofocus?.focus();
  }

  store.subscribe((state, previous) => {
    if (previous.phase !== 'run' && state.phase === 'run') runScreen.beginRun();
    if (previous.phase === 'run' && state.phase !== 'run') ui.isShowingRunResult = true;
    render();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    ui.isMarketOpen = false;
    ui.isHelpOpen = false;
    render();
  });
  render();
}
