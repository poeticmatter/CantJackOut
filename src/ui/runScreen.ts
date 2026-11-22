import { acceptFlatline, bankAndJackOut, roll, useBounce, useFailsafe, useSplice } from '../game/actions';
import { type CampaignState, type RunReport, findServer, isProgramReady, loadoutDice } from '../game/campaign';
import { formatClock } from '../game/clock';
import { type Die, FACES_PER_DIE } from '../game/dice';
import { nextHitProbability } from '../game/policy';
import type { RollOutcome } from '../game/roll';
import { type RunState, canSplice, runMinutes, serverAfterRun } from '../game/run';
import type { Server } from '../game/server';
import { sfx } from './audio';
import { type DieView, createDieView } from './dice3d';
import { el, wait } from './dom';
import { renderRunConsole } from './runConsole';
import { renderRunResult } from './runResult';
import type { Store } from './store';
import { renderTower } from './towers';

/** What the run screen is showing: a live run, or the replay of one that just ended. */
interface RunFrame {
  readonly server: Server;
  readonly run: RunState;
  readonly report: RunReport | null;
  readonly dice: readonly Die[];
}

function frameFor(state: CampaignState): RunFrame | null {
  if (state.run !== null) {
    return { server: findServer(state, state.run.serverId), run: state.run, report: null, dice: loadoutDice(state) };
  }
  const report = state.lastRunReport;
  if (report === null) return null;
  return { server: report.serverBefore, run: report.finalRun, report, dice: loadoutDice(state) };
}

/** A miss with no rescue program loaded resolves straight away instead of asking. */
function autoResolveMiss(state: CampaignState): CampaignState {
  if (state.run?.status !== 'missed') return state;
  const hasRescue = isProgramReady(state, 'bounce') || isProgramReady(state, 'failsafe');
  return hasRescue ? state : acceptFlatline(state);
}

export interface RunScreen {
  readonly element: HTMLElement;
  /** Call when a new run starts so the dice tray and towers rebuild from scratch. */
  beginRun(): void;
  update(state: CampaignState): void;
}

export function createRunScreen(store: Store, onLeave: () => void): RunScreen {
  const towers = el('div', { className: 'towers' });
  const consoleSlot = el('aside', { className: 'run-console' });
  const tray = el('div', { className: 'dice-tray' });
  const header = el('header', { className: 'run-head' });
  const resultSlot = el('div', { className: 'run-result-slot' });
  const element = el('section', { className: 'run-screen', attrs: { 'aria-label': 'Run in progress' } }, [
    header, el('div', { className: 'run-stage' }, [towers, consoleSlot]), tray, resultSlot,
  ]);

  let diceViews: DieView[] = [];
  let displayedRoll: RollOutcome | null = null;
  let displayedFilled: number[] = [];
  let isAnimating = false;
  let isStartingRun = true;
  let hasPendingUpdate = false;
  let playedReport: RunReport | null = null;
  let latestState = store.current();

  const act = (transition: (state: CampaignState) => CampaignState) => {
    if (isAnimating) return;
    sfx.click();
    store.apply((state) => autoResolveMiss(transition(state)));
  };

  const buildDice = (frame: RunFrame) => {
    diceViews = frame.dice.map(createDieView);
    tray.replaceChildren(...diceViews.map((view) => view.element));
    diceViews.forEach((view) => view.showFace(Math.floor(Math.random() * FACES_PER_DIE)));
  };

  const filledFor = (frame: RunFrame): number[] => {
    if (frame.report !== null) return serverAfterRun(frame.server, frame.run).tracks.map((track) => track.banked);
    return frame.server.tracks.map((track, index) => track.banked + frame.run.buffer[index]);
  };

  const renderTowers = (frame: RunFrame) => {
    const finalServer = frame.report !== null ? serverAfterRun(frame.server, frame.run) : frame.server;
    const filled = filledFor(frame);
    towers.replaceChildren(
      ...finalServer.tracks.map((track, index) =>
        renderTower({
          track,
          banked: track.banked,
          buffered: frame.report !== null ? 0 : frame.run.buffer[index],
          previousFilled: displayedFilled[index] ?? filled[index],
        }),
      ),
    );
    displayedFilled = filled;
  };

  const renderHeader = (frame: RunFrame) => {
    const clock = formatClock(latestState.minutes + (frame.report === null ? runMinutes(frame.run, frame.server) : 0));
    header.replaceChildren(
      el('div', { className: 'run-target' }, [
        el('span', { className: 'run-corp', text: frame.server.corp }),
        el('h1', { className: 'run-node', text: frame.server.name }),
      ]),
      el('div', { className: 'run-mods' }, frame.server.modifiers.map((modifier) =>
        el('span', { className: `chip chip-${modifier}`, text: modifier === 'blackIce' ? 'Black ICE' : 'Tracer' }))),
      el('div', { className: 'run-clock' }, [el('span', { text: 'Clock' }), el('strong', { text: clock })]),
    );
  };

  const renderConsole = (frame: RunFrame) => {
    const state = latestState;
    consoleSlot.replaceChildren(
      renderRunConsole({
        run: frame.run,
        server: frame.server,
        hitChance: nextHitProbability({ server: frame.server, buffer: frame.run.buffer, dice: frame.dice }),
        isLocked: isAnimating || frame.report !== null,
        canSplice: canSplice(frame.run) && isProgramReady(state, 'splice'),
        canBounce: isProgramReady(state, 'bounce'),
        canFailsafe: isProgramReady(state, 'failsafe'),
        charges: state.charges,
        onRoll: () => act(roll),
        onJackOut: () => act(bankAndJackOut),
        onSplice: () => act(useSplice),
        onBounce: () => act(useBounce),
        onFailsafe: () => act(useFailsafe),
        onAcceptMiss: () => act(acceptFlatline),
      }),
    );
  };

  const renderAll = (frame: RunFrame) => {
    renderHeader(frame);
    renderTowers(frame);
    renderConsole(frame);
    resultSlot.replaceChildren(frame.report !== null ? renderRunResult(frame.report, latestState, onLeave) : '');
    element.classList.toggle('has-result', frame.report !== null);
  };

  const animateRoll = async (frame: RunFrame, outcome: RollOutcome) => {
    const previous = displayedRoll?.results ?? [];
    const rerolled = new Set(outcome.results.filter((result, index) => result !== previous[index]));
    sfx.rattle(rerolled.size);
    await Promise.all(
      outcome.results.map((result, index) => {
        const view = diceViews[index];
        return view !== undefined && rerolled.has(result) ? view.rollTo(result.faceIndex) : Promise.resolve();
      }),
    );
    let order = 0;
    outcome.results.forEach((result, index) => {
      diceViews[index]?.setMood(result.gain > 0 ? 'hit' : 'dud');
      const track = result.trackIndex === null ? null : frame.server.tracks[result.trackIndex];
      if (track !== null && result.gain > 0) sfx.hit(track.color, order++);
    });
    if (!outcome.isHit && frame.run.status === 'connected') sfx.probeMiss();
  };

  const playEnding = async (report: RunReport) => {
    if (report.ending === 'flatlined') {
      sfx.flatline();
      element.classList.add('is-glitching');
      await wait(700);
      element.classList.remove('is-glitching');
    } else if (report.ending === 'downloaded') {
      sfx.download();
      element.classList.add('is-downloaded');
    } else {
      sfx.bank();
    }
  };

  /** Shows the latest state, animating a new roll first. Updates that arrive mid-animation wait their turn. */
  const present = () => {
    const frame = frameFor(latestState);
    if (frame === null) return;
    if (isStartingRun) {
      isStartingRun = false;
      buildDice(frame);
      displayedRoll = null;
      displayedFilled = [];
      element.classList.remove('is-downloaded');
      sfx.jackIn();
    }
    const outcome = frame.run.lastRoll;
    const rollToAnimate = outcome !== null && outcome !== displayedRoll ? outcome : null;
    const endingToPlay = frame.report !== null && frame.report !== playedReport ? frame.report : null;
    if (rollToAnimate === null && endingToPlay === null) {
      renderAll(frame);
      return;
    }
    isAnimating = true;
    renderConsole(frame);
    const sequence = async () => {
      if (rollToAnimate !== null) {
        await animateRoll(frame, rollToAnimate);
        displayedRoll = rollToAnimate;
      }
      if (endingToPlay !== null) {
        playedReport = endingToPlay;
        await playEnding(endingToPlay);
      }
    };
    void sequence()
      .finally(() => {
        isAnimating = false;
        if (hasPendingUpdate) {
          hasPendingUpdate = false;
          present();
        } else {
          renderAll(frame);
        }
      });
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!element.isConnected || isAnimating || latestState.run === null || event.repeat) return;
    const status = latestState.run.status;
    const isRollable = status === 'connected' || status === 'hit';
    if (event.code === 'Space' && isRollable) {
      event.preventDefault();
      act(roll);
    } else if (event.code === 'KeyJ' && isRollable) {
      act(bankAndJackOut);
    }
  };
  window.addEventListener('keydown', handleKey);

  return {
    element,
    beginRun() {
      isStartingRun = true;
    },
    update(state) {
      latestState = state;
      if (isAnimating) {
        hasPendingUpdate = true;
        return;
      }
      present();
    },
  };
}
