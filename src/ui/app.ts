import { deepScan, jackIn, waitForDawn } from '../game/actions';
import type { CampaignState } from '../game/campaign';
import { settleDawn } from '../game/dawn';
import {
  anchorFace, buyProgram, buyProgramSlot, buySocket, buySpareDie, flashFace, overclockFace, toggleDieInLoadout,
  toggleProgramInLoadout,
} from '../game/shop';
import { sfx, toggleMute } from './audio';
import { VESNA, renderCall } from './characterCall';
import { renderDawn, renderEnding } from './dawnScreen';
import { renderDeckPanel } from './deckPanel';
import { el } from './dom';
import { renderHelp } from './help';
import { renderHud } from './hud';
import { type Market, type MarketActions, type MarketSelection, createMarket } from './market';
import { createRunScreen } from './runScreen';
import { renderServerCard } from './serverCard';
import type { Store, Transition } from './store';
import { nightBriefing } from './vesnaLines';

interface UiState {
  isHelpOpen: boolean;
  isProxyArmed: boolean;
  isShowingRunResult: boolean;
  marketSelection: MarketSelection;
  /** The last night whose briefing from Vesna the player has dismissed. */
  briefedNight: number;
}

const NO_SELECTION: MarketSelection = { dieId: null, faceIndex: null };

/** Keeps the overlays that stay open in place, so they don't replay their entrance on every update. */
function syncChildren(slot: HTMLElement, wanted: readonly HTMLElement[]): void {
  for (const child of [...slot.children]) {
    if (!wanted.some((overlay) => overlay === child)) child.remove();
  }
  for (const overlay of wanted) {
    if (overlay.parentElement !== slot) slot.append(overlay);
  }
}

export function startApp(root: HTMLElement, store: Store): void {
  const opening = store.current();
  const ui: UiState = {
    isHelpOpen: !store.hasSavedGame,
    isProxyArmed: false,
    isShowingRunResult: false,
    marketSelection: NO_SELECTION,
    briefedNight: store.hasSavedGame && opening.minutes > 0 ? opening.night : 0,
  };
  const mainSlot = el('div', { className: 'main-slot' });
  const overlaySlot = el('div', { className: 'overlay-slot' });
  root.replaceChildren(mainSlot, overlaySlot);
  let market: Market | null = null;
  let help: HTMLElement | null = null;
  let briefing: HTMLElement | null = null;

  const apply = (transition: Transition, sound: () => void = sfx.click) => {
    if (store.apply(transition)) sound();
  };

  const runScreen = createRunScreen(store, () => {
    ui.isShowingRunResult = false;
    render();
  });

  const marketActions: MarketActions = {
    onClose: () => closeMarket(),
    onBuySocket: () => apply(buySocket, sfx.coins),
    onBuyProgramSlot: () => apply(buyProgramSlot, sfx.coins),
    onBuyProgram: (program) => apply((current) => buyProgram(current, program), sfx.coins),
    onBuySpareDie: () => apply(buySpareDie, sfx.coins),
    onSelect: (selection) => {
      ui.marketSelection = selection;
      sfx.click();
      render();
    },
    onFlash: (dieId, faceIndex, design) => apply((current) => flashFace(current, dieId, faceIndex, design), sfx.flash),
    onOverclock: (dieId, faceIndex) => apply((current) => overclockFace(current, dieId, faceIndex), sfx.flash),
    onAnchor: (dieId, faceIndex) => apply((current) => anchorFace(current, dieId, faceIndex), sfx.flash),
  };

  function openMarket(selection: MarketSelection): void {
    ui.marketSelection = selection;
    market = createMarket(marketActions);
    render();
  }

  function closeMarket(): void {
    market = null;
    render();
  }

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
        onUpgradeDie: (dieId) => openMarket({ dieId, faceIndex: null }),
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

  const hudActions = {
    onOpenMarket: () => openMarket(NO_SELECTION),
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
      ui.briefedNight = 0;
      store.startNewGame();
    },
  };

  function dismissBriefing(): void {
    ui.briefedNight = store.current().night;
    briefing = null;
    render();
  }

  /** Vesna calls at the start of every night, once the rules are out of the way. */
  function briefingFor(state: CampaignState): HTMLElement | null {
    const isDue = state.phase === 'net' && state.minutes === 0 && ui.briefedNight !== state.night && !ui.isHelpOpen;
    if (!isDue) return null;
    if (briefing !== null) return briefing;
    const goButton = el('button', { className: 'btn btn-primary', text: 'Get to work', attrs: { type: 'button' }, onClick: dismissBriefing });
    briefing = el('div', { className: 'overlay overlay-call', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Vesna calls' } }, [
      renderCall(VESNA, { lines: nightBriefing(state), actions: [goButton] }),
    ]);
    return briefing;
  }

  function helpOverlay(): HTMLElement | null {
    if (!ui.isHelpOpen) return null;
    help ??= renderHelp(() => {
      ui.isHelpOpen = false;
      help = null;
      render();
    });
    return help;
  }

  function renderMainContent(state: CampaignState): HTMLElement {
    if (state.phase === 'dawn') return renderDawn(state, () => apply(settleDawn, sfx.coins));
    if (state.phase === 'won' || state.phase === 'lost') return renderEnding(state, () => store.startNewGame());
    return renderNet(state);
  }

  function render(): void {
    const state = store.current();
    if (state.phase !== 'net') market = null;
    market?.update(state, ui.marketSelection);
    const isRunVisible = state.phase === 'run' || ui.isShowingRunResult;
    if (isRunVisible) {
      // Re-inserting the run screen would restart its CSS animations mid-roll, so keep it mounted.
      if (mainSlot.childElementCount !== 1 || mainSlot.firstElementChild !== runScreen.element) mainSlot.replaceChildren(runScreen.element);
      runScreen.update(state);
    } else {
      mainSlot.replaceChildren(renderHud(state, hudActions), renderMainContent(state));
      mainSlot.querySelector<HTMLElement>('[autofocus]')?.focus();
    }
    const overlays = [market?.element ?? null, isRunVisible ? null : briefingFor(state), helpOverlay()];
    syncChildren(overlaySlot, overlays.filter((overlay): overlay is HTMLElement => overlay !== null));
  }

  store.subscribe((state, previous) => {
    if (previous.phase !== 'run' && state.phase === 'run') runScreen.beginRun();
    if (previous.phase === 'run' && state.phase !== 'run') ui.isShowingRunResult = true;
    render();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    market = null;
    ui.isHelpOpen = false;
    help = null;
    render();
  });
  render();
}
