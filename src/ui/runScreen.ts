import {
  PAYDAY_CASH, acceptFlatline, bankAndJackOut, reroutePrice, rerouteRun, roll, useBounce, useFailsafe, useSplice,
} from '../game/actions';
import { type CampaignState, type RunReport, findServer, isProgramReady } from '../game/campaign';
import { formatClock } from '../game/clock';
import { FACES_PER_DIE } from '../game/dice';
import { nextSafeProbability } from '../game/policy';
import type { RollOutcome } from '../game/roll';
import { canReroute, canSplice, liveServer, runMinutes } from '../game/run';
import { sfx } from './audio';
import { type DieView, createDieView } from './dice3d';
import { el, money, wait } from './dom';
import { createFxLayer, shake } from './fx';
import { playHandshake } from './handshake';
import { renderRunConsole } from './runConsole';
import { type RunFrame, autoResolveMiss, filesFor, frameFor } from './runFrame';
import { renderRunResult } from './runResult';
import type { Store } from './store';
import { renderAlertMeter, renderTower } from './towers';

const BIG_ROLL_BLOCKS = 3;
const PARTICLES_PER_BLOCK = 6;

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
  const stage = el('div', { className: 'run-stage' }, [towers, consoleSlot]);
  const fx = createFxLayer();
  const element = el('section', { className: 'run-screen', attrs: { 'aria-label': 'Run in progress' } }, [
    header, stage, tray, resultSlot, fx.element,
  ]);

  let diceViews: DieView[] = [];
  let displayedRoll: RollOutcome | null = null;
  let displayedFilled: number[] = [];
  let displayedBanked: number[] = [];
  let isAnimating = false;
  let isStartingRun = true;
  let hasPendingUpdate = false;
  let playedReport: RunReport | null = null;
  let latestState = store.current();

  const act = (transition: (state: CampaignState) => CampaignState, sound: () => void = sfx.click) => {
    if (isAnimating) return;
    sound();
    store.apply((state) => autoResolveMiss(transition(state)));
  };

  const buildDice = (frame: RunFrame) => {
    diceViews = frame.dice.map(createDieView);
    tray.replaceChildren(...diceViews.map((view) => view.element));
    diceViews.forEach((view) => view.showFace(Math.floor(Math.random() * FACES_PER_DIE)));
  };

  const renderTowers = (frame: RunFrame) => {
    const files = filesFor(frame);
    towers.replaceChildren(
      ...frame.server.tracks.map((track, index) => {
        const file = files[index];
        return renderTower({
          track,
          banked: file.banked,
          buffered: file.buffered,
          stake: file.stake,
          previousFilled: displayedFilled[index] ?? file.banked + file.buffered,
          freshlyBanked: Math.max(0, file.banked - (displayedBanked[index] ?? file.banked)),
        });
      }),
    );
    displayedFilled = files.map((file) => file.banked + file.buffered);
    displayedBanked = files.map((file) => file.banked);
  };

  const renderHeader = (frame: RunFrame) => {
    const elapsed = frame.report === null ? runMinutes(frame.run, frame.server) : 0;
    header.replaceChildren(
      el('div', { className: 'run-target' }, [
        el('span', { className: 'run-corp', text: frame.server.corp }),
        el('h1', { className: 'run-node', text: frame.server.name }),
      ]),
      el('div', { className: 'run-mods' }, frame.server.modifiers.map((modifier) =>
        el('span', { className: `chip chip-${modifier}`, text: modifier === 'blackIce' ? 'Black ICE' : 'Tracer' }))),
      ...(frame.report === null ? [renderAlertMeter(frame.server, 1)] : []),
      el('div', { className: 'run-clock' }, [el('span', { text: 'Clock' }), el('strong', { text: formatClock(latestState.minutes + elapsed) })]),
    );
  };

  const renderConsole = (frame: RunFrame) => {
    const state = latestState;
    const price = reroutePrice(frame.server);
    consoleSlot.replaceChildren(
      renderRunConsole({
        run: frame.run,
        safeChance: nextSafeProbability({ server: liveServer(frame.server, frame.run), buffer: frame.run.buffer, dice: frame.dice }),
        isLocked: isAnimating || frame.report !== null,
        canSplice: canSplice(frame.run) && isProgramReady(state, 'splice'),
        canBounce: isProgramReady(state, 'bounce'),
        canFailsafe: isProgramReady(state, 'failsafe'),
        canReroute: canReroute(frame.run),
        reroutePrice: price,
        canAffordReroute: state.money >= price,
        paydayCash: frame.run.paydays * PAYDAY_CASH,
        charges: state.charges,
        onRoll: () => act(roll),
        onJackOut: () => act(bankAndJackOut),
        onReroute: () => act(rerouteRun, sfx.reroute),
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
    // Once the run is over, the console keeps its last live state (locked) behind the result.
    if (frame.report === null) renderConsole(frame);
    else consoleSlot.querySelectorAll('button').forEach((button) => (button.disabled = true));
    resultSlot.replaceChildren(frame.report !== null ? renderRunResult(frame.report, latestState, onLeave) : '');
    element.classList.toggle('has-result', frame.report !== null);
    element.classList.toggle('is-threatened', frame.run.status === 'missed');
  };

  /** The cell a flying block should land on: the first empty block of that file's tower. */
  const landingFor = (trackIndex: number): DOMRect | null => {
    const shaft = towers.children[trackIndex]?.querySelector('.tower-shaft');
    if (shaft === null || shaft === undefined) return null;
    const cells = shaft.children;
    const fromTop = cells.length - 1 - Math.min(cells.length - 1, displayedFilled[trackIndex] ?? 0);
    return cells[fromTop]?.getBoundingClientRect() ?? shaft.getBoundingClientRect();
  };

  const celebrateGains = (frame: RunFrame, before: readonly number[]) => {
    renderTowers(frame);
    const gained = displayedFilled.map((filled, index) => filled - (before[index] ?? filled));
    gained.forEach((blocks, index) => {
      const tower = towers.children[index];
      if (blocks <= 0 || tower === undefined) return;
      tower.classList.add('is-gaining');
      fx.floatText(tower.querySelector('.tower-shaft') ?? tower, `+${blocks}`, `tone-${frame.server.tracks[index].color}`);
      const track = frame.server.tracks[index];
      const isNewlyCracked = displayedFilled[index] >= track.length && (before[index] ?? 0) < track.length;
      if (isNewlyCracked) {
        tower.classList.add('is-cracking');
        fx.burst(tower, `var(--${track.color})`, 28);
        sfx.fileCracked(track.color);
      }
    });
    if (gained.reduce((sum, blocks) => sum + Math.max(0, blocks), 0) >= BIG_ROLL_BLOCKS) shake(stage, 1.6);
  };

  const animateRoll = async (frame: RunFrame, outcome: RollOutcome) => {
    const previous = displayedRoll?.results ?? [];
    const rerolled = new Set(outcome.results.filter((result, index) => result !== previous[index]));
    sfx.rattle(rerolled.size);
    await Promise.all(outcome.results.map((result, index) => {
      const view = diceViews[index];
      return view !== undefined && rerolled.has(result) ? view.rollTo(result.faceIndex) : Promise.resolve();
    }));
    let order = 0;
    const flights = outcome.results.map((result, index) => {
      const view = diceViews[index];
      if (view === undefined) return Promise.resolve();
      if (result.gain > 0 && result.trackIndex !== null) {
        const color = frame.server.tracks[result.trackIndex].color;
        view.setMood('hit', `var(--${color})`);
        sfx.hit(color, order++);
        const landing = landingFor(result.trackIndex);
        return landing === null ? Promise.resolve() : fx.flyBlocks(view.element, landing, `var(--${color})`, result.gain * PARTICLES_PER_BLOCK);
      }
      if (result.face.kind === 'payday') {
        view.setMood('special', 'var(--amber)');
        fx.floatText(view.element, `+${money(PAYDAY_CASH)}`, 'is-cash');
        sfx.payday();
      } else if (result.face.kind === 'firewall' && outcome.isBlocked) {
        view.setMood('special', 'var(--firewall)');
        fx.floatText(view.element, 'Blocked', 'is-firewall');
        fx.burst(view.element, 'var(--firewall)', 14);
        sfx.firewall();
      } else {
        view.setMood('dud');
      }
      return Promise.resolve();
    });
    const before = [...displayedFilled];
    await Promise.all(flights);
    if (outcome.isHit) celebrateGains(frame, before);
  };

  const playEnding = async (frame: RunFrame, report: RunReport) => {
    if (report.ending === 'flatlined') {
      sfx.flatline();
      element.classList.add('is-glitching');
      await wait(700);
      element.classList.remove('is-glitching');
    } else if (report.ending === 'downloaded') {
      sfx.download();
      element.classList.add('is-downloaded', 'is-jackpot');
      [...towers.children].forEach((tower, index) => fx.burst(tower, `var(--${frame.server.tracks[index]?.color ?? 'amber'})`, 40));
      fx.rain('$', 'var(--amber)', 36);
      shake(element, 2.4);
      await wait(900);
    } else {
      sfx.bank();
    }
    if (report.isPurged) {
      sfx.purge();
      fx.floatText(towers, 'Sysadmin purge', 'is-purge');
    }
  };

  const prepareNewRun = (frame: RunFrame) => {
    buildDice(frame);
    displayedRoll = null;
    displayedFilled = frame.server.tracks.map((track) => track.banked);
    displayedBanked = frame.server.tracks.map((track) => track.banked);
    towers.replaceChildren();
    resultSlot.replaceChildren();
    element.classList.remove('is-downloaded', 'is-jackpot', 'has-result');
    sfx.jackIn();
  };

  /** Everything that has to play before the screen can show the latest state, in order. */
  const sequenceFor = (frame: RunFrame): (() => Promise<void>) | null => {
    const steps: (() => Promise<void>)[] = [];
    if (isStartingRun) {
      isStartingRun = false;
      prepareNewRun(frame);
      renderHeader(frame);
      renderConsole(frame);
      const startMinutes = latestState.minutes;
      steps.push(() => playHandshake(element, { server: frame.server, run: frame.run, startMinutes }).then(() => renderTowers(frame)));
    }
    const outcome = frame.run.lastRoll;
    if (outcome !== null && outcome !== displayedRoll) {
      steps.push(async () => {
        await animateRoll(frame, outcome);
        displayedRoll = outcome;
      });
    }
    const report = frame.report;
    if (report !== null && report !== playedReport) {
      steps.push(async () => {
        playedReport = report;
        await playEnding(frame, report);
      });
    }
    if (steps.length === 0) return null;
    return async () => {
      for (const step of steps) await step();
    };
  };

  /** Shows the latest state, animating anything new first. Updates that arrive mid-animation wait their turn. */
  const present = () => {
    const frame = frameFor(latestState);
    if (frame === null) return;
    const sequence = sequenceFor(frame);
    if (sequence === null) {
      renderAll(frame);
      return;
    }
    isAnimating = true;
    // Keep showing the state from before the roll, locked, so the result isn't spoiled mid-tumble.
    consoleSlot.querySelectorAll('button').forEach((button) => (button.disabled = true));
    void sequence().finally(() => {
      isAnimating = false;
      if (hasPendingUpdate) {
        hasPendingUpdate = false;
        present();
      } else {
        renderAll(frameFor(latestState) ?? frame);
      }
    });
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!element.isConnected || isAnimating || latestState.run === null || event.repeat) return;
    const run = latestState.run;
    const isRollable = run.status === 'connected' || run.status === 'hit' || run.status === 'blocked';
    if (event.code === 'Space' && isRollable) {
      event.preventDefault();
      act(roll);
    } else if (event.code === 'KeyJ' && isRollable) {
      act(bankAndJackOut);
    } else if (event.code === 'KeyR' && canReroute(run) && latestState.money >= reroutePrice(findServer(latestState, run.serverId))) {
      act(rerouteRun, sfx.reroute);
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
