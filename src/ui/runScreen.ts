import { acceptFlatline, bankAndJackOut, reroutePrice, rerouteRun, roll, takeChoice, useBounce, useFailsafe } from '../game/actions';
import { type CampaignState, type RunReport, findServer, isProgramReady } from '../game/campaign';
import { formatClock } from '../game/clock';
import { FACES_PER_DIE } from '../game/dice';
import { FILE_COLORS, type FileId, fileIndex } from '../game/files';
import { survivalChance } from '../game/pairing';
import { type RollChoice, type RollRecord, isJackpotRoll } from '../game/roll';
import { canReroute, runMinutes, streamContext } from '../game/run';
import { sfx } from './audio';
import { type DieView, createDieView } from './dice3d';
import { el, wait } from './dom';
import { createFxLayer, shake } from './fx';
import { playHandshake } from './handshake';
import { renderRunConsole } from './runConsole';
import { type RunFrame, autoResolveMiss, filesFor, frameFor } from './runFrame';
import { choiceKeyAction } from './runKeys';
import { renderRunResult } from './runResult';
import { renderJackpotPicker, renderSplitPicker } from './splitPicker';
import type { Store } from './store';
import { renderAlertMeter, renderTower } from './towers';

const BIG_ROLL_BLOCKS = 3;
const PARTICLES_PER_DIE = 4;
const JACKPOT_PARTICLES_PER_DIE = 10;
const JACKPOT_FLASH_MILLISECONDS = 1100;

export interface RunScreen {
  readonly element: HTMLElement;
  /** Call when a new run starts so the dice tray and towers rebuild from scratch. */
  beginRun(): void;
  update(state: CampaignState): void;
}

function colorVar(color: string): string {
  return `var(--${color})`;
}

/** Which dice fed which file: each usable pair of a split, or all four dice for a jackpot. */
function diceFlights(rollRecord: RollRecord, choice: RollChoice): { readonly dice: readonly number[]; readonly file: FileId | null }[] {
  if (choice.kind === 'jackpot') return [{ dice: [0, 1, 2, 3], file: choice.file }];
  const option = rollRecord.options[choice.splitIndex];
  const remaining = [...option.choices[choice.choiceIndex]];
  return option.dicePairs.map((pair, pairIndex) => {
    const file = option.files[pairIndex];
    const at = file === null ? -1 : remaining.indexOf(file);
    if (at === -1) return { dice: pair, file: null };
    remaining.splice(at, 1);
    return { dice: pair, file };
  });
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
  let displayedFaces: readonly number[] | null = null;
  let displayedChoice: RollChoice | null = null;
  let displayedFilled: number[] = [];
  let displayedBanked: number[] = [];
  let pendingSplit: number | null = null;
  let isAnimating = false;
  let isStartingRun = true;
  let hasPendingUpdate = false;
  let playedReport: RunReport | null = null;
  let latestState = store.current();

  const act = (transition: (state: CampaignState) => CampaignState, sound: () => void = sfx.click) => {
    if (isAnimating) return;
    pendingSplit = null;
    sound();
    store.apply((state) => autoResolveMiss(transition(state)));
  };

  const choose = (choice: RollChoice) => act((state) => takeChoice(state, choice));

  const markTowers = (className: string, files: readonly FileId[] | null) => {
    for (const tower of towers.children) {
      const file = tower.getAttribute('data-file');
      tower.classList.toggle(className, files !== null && files.some((candidate) => candidate === file));
    }
  };
  const previewFiles = (files: readonly FileId[] | null) => markTowers('is-preview', files);

  const buildDice = (frame: RunFrame) => {
    diceViews = frame.dice.map(createDieView);
    tray.replaceChildren(...diceViews.map((view) => view.element));
    diceViews.forEach((view) => view.showFace(Math.floor(Math.random() * FACES_PER_DIE)));
  };

  const renderTowers = (frame: RunFrame) => {
    const files = filesFor(frame);
    towers.replaceChildren(
      ...frame.server.files.map((file, index) =>
        renderTower({
          file,
          banked: files[index].banked,
          buffered: files[index].buffered,
          stream: files[index].stream,
          previousFilled: displayedFilled[index] ?? files[index].banked + files[index].buffered,
          freshlyBanked: Math.max(0, files[index].banked - (displayedBanked[index] ?? files[index].banked)),
        })),
    );
    displayedFilled = files.map((file) => file.banked + file.buffered);
    displayedBanked = files.map((file) => file.banked);
    const lastRoll = frame.run.lastRoll;
    const isPickingJackpot = frame.report === null && frame.run.status === 'choosing' && lastRoll !== null && isJackpotRoll(lastRoll);
    markTowers('is-jackpot-target', isPickingJackpot ? lastRoll.jackpotFiles : null);
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

  const renderChoicePicker = (frame: RunFrame, isLocked: boolean): HTMLElement | null => {
    const lastRoll = frame.run.lastRoll;
    if (frame.run.status !== 'choosing' || lastRoll === null) return null;
    const context = streamContext(frame.run, frame.server);
    if (isJackpotRoll(lastRoll)) {
      return renderJackpotPicker({ roll: lastRoll, context, isLocked, onPreview: previewFiles, onPick: (file) => choose({ kind: 'jackpot', file }) });
    }
    return renderSplitPicker({
      roll: lastRoll, context, isLocked, pendingSplit, onPreview: previewFiles,
      onChoose: (splitIndex, choiceIndex) => choose({ kind: 'split', splitIndex, choiceIndex }),
    });
  };

  const renderConsole = (frame: RunFrame) => {
    const state = latestState;
    const price = reroutePrice(frame.server);
    const isLocked = isAnimating || frame.report !== null;
    consoleSlot.replaceChildren(
      renderRunConsole({
        run: frame.run,
        safeChance: survivalChance(frame.dice, streamContext(frame.run, frame.server)),
        isLocked,
        choicePicker: renderChoicePicker(frame, isLocked),
        canBounce: isProgramReady(state, 'bounce'),
        canFailsafe: isProgramReady(state, 'failsafe'),
        canReroute: canReroute(frame.run),
        reroutePrice: price,
        canAffordReroute: state.money >= price,
        charges: state.charges,
        onRoll: () => act(roll),
        onJackOut: () => act(bankAndJackOut),
        onReroute: () => act(rerouteRun, sfx.reroute),
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
  const landingFor = (index: number): DOMRect | null => {
    const shaft = towers.children[index]?.querySelector('.tower-shaft');
    if (shaft === null || shaft === undefined) return null;
    const cells = shaft.children;
    const fromTop = cells.length - 1 - Math.min(cells.length - 1, displayedFilled[index] ?? 0);
    return cells[fromTop]?.getBoundingClientRect() ?? shaft.getBoundingClientRect();
  };

  /** A finished file bursts in both of its colors. */
  const burstFile = (tower: Element, file: FileId, count: number) => {
    FILE_COLORS[file].forEach((color) => fx.burst(tower, colorVar(color), count / 2));
  };

  const celebrateGains = (frame: RunFrame, before: readonly number[]) => {
    renderTowers(frame);
    const gained = displayedFilled.map((filled, index) => filled - (before[index] ?? filled));
    gained.forEach((blocks, index) => {
      const tower = towers.children[index];
      if (blocks <= 0 || tower === undefined) return;
      const file = frame.server.files[index];
      tower.classList.add('is-gaining');
      fx.floatText(tower.querySelector('.tower-shaft') ?? tower, `+${blocks}`, 'is-gain');
      if (displayedFilled[index] >= file.length && (before[index] ?? 0) < file.length) {
        tower.classList.add('is-cracking');
        burstFile(tower, file.id, 28);
        sfx.fileCracked(FILE_COLORS[file.id][1]);
      }
    });
    if (gained.reduce((sum, blocks) => sum + Math.max(0, blocks), 0) >= BIG_ROLL_BLOCKS) shake(stage, 1.6);
  };

  /** Four of a kind: the dice flare, the screen flashes and the banner drops in. */
  const celebrateJackpot = async (rollRecord: RollRecord) => {
    const color = colorVar(rollRecord.colors[0]);
    sfx.jackpot();
    element.classList.add('is-jackpot-roll');
    diceViews.forEach((view) => {
      view.setMood('special', color);
      fx.burst(view.element, color, 18);
    });
    fx.floatText(tray, 'JACKPOT', 'is-jackpot');
    fx.rain('★', 'var(--yellow)', 24);
    shake(element, 2);
    await wait(JACKPOT_FLASH_MILLISECONDS);
    element.classList.remove('is-jackpot-roll');
  };

  const animateRoll = async (frame: RunFrame, rollRecord: RollRecord) => {
    sfx.rattle(diceViews.length);
    diceViews.forEach((view) => view.setMood('idle'));
    await Promise.all(rollRecord.faceIndexes.map((faceIndex, index) => diceViews[index]?.rollTo(faceIndex) ?? Promise.resolve()));
    if (isJackpotRoll(rollRecord)) {
      await celebrateJackpot(rollRecord);
    } else if (frame.run.status === 'missed' || (frame.report !== null && rollRecord.chosen === null)) {
      diceViews.forEach((view) => view.setMood('dud'));
      sfx.probeMiss();
    }
  };

  /** Blocks fly from each die that scored, in that die's own color, to its file's tower. */
  const animateChoice = async (frame: RunFrame, rollRecord: RollRecord, choice: RollChoice) => {
    const before = [...displayedFilled];
    const particles = choice.kind === 'jackpot' ? JACKPOT_PARTICLES_PER_DIE : PARTICLES_PER_DIE;
    const flights = diceFlights(rollRecord, choice).flatMap(({ dice, file }, pairIndex) => {
      const views = dice.map((dieIndex) => diceViews[dieIndex]);
      if (file === null) {
        views.forEach((view) => view?.setMood('dud'));
        return [];
      }
      sfx.hit(FILE_COLORS[file][1], pairIndex);
      const landing = landingFor(fileIndex(file));
      return dice.map((dieIndex) => {
        const view = diceViews[dieIndex];
        const color = colorVar(rollRecord.colors[dieIndex]);
        view?.setMood('hit', color);
        return landing === null || view === undefined ? Promise.resolve() : fx.flyBlocks(view.element, landing, color, particles);
      });
    });
    await Promise.all(flights);
    celebrateGains(frame, before);
  };

  const playEnding = async (report: RunReport) => {
    if (report.ending === 'flatlined') {
      sfx.flatline();
      element.classList.add('is-glitching');
      await wait(700);
      element.classList.remove('is-glitching');
    } else if (report.payout > 0) {
      sfx.download();
      element.classList.add('is-downloaded', 'is-jackpot');
      report.filesSold.forEach((file) => {
        const tower = towers.children[fileIndex(file)];
        if (tower !== undefined) burstFile(tower, file, 40);
      });
      fx.rain('$', 'var(--amber)', 12 + 12 * report.filesSold.length);
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
    displayedFaces = null;
    displayedChoice = null;
    pendingSplit = null;
    displayedFilled = frame.server.files.map((file) => file.banked);
    displayedBanked = frame.server.files.map((file) => file.banked);
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
    const rollRecord = frame.run.lastRoll;
    if (rollRecord !== null && rollRecord.faceIndexes !== displayedFaces) {
      steps.push(async () => {
        await animateRoll(frame, rollRecord);
        displayedFaces = rollRecord.faceIndexes;
        displayedChoice = null;
      });
    }
    const choice = rollRecord?.chosen ?? null;
    if (rollRecord !== null && choice !== null && choice !== displayedChoice) {
      steps.push(async () => {
        await animateChoice(frame, rollRecord, choice);
        displayedChoice = choice;
      });
    }
    const report = frame.report;
    if (report !== null && report !== playedReport) {
      steps.push(async () => {
        playedReport = report;
        await playEnding(report);
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

  const rerenderConsole = () => {
    const frame = frameFor(latestState);
    if (frame !== null && frame.report === null) renderConsole(frame);
  };

  const handleChoiceKey = (key: string, rollRecord: RollRecord) => {
    const action = choiceKeyAction(key, rollRecord, pendingSplit);
    if (action.kind === 'split') choose({ kind: 'split', splitIndex: action.splitIndex, choiceIndex: action.choiceIndex });
    else if (action.kind === 'jackpot') choose({ kind: 'jackpot', file: rollRecord.jackpotFiles[action.fileIndex] });
    else if (action.kind === 'pend' || action.kind === 'cancel') {
      pendingSplit = action.kind === 'pend' ? action.splitIndex : null;
      rerenderConsole();
    }
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!element.isConnected || isAnimating || latestState.run === null || event.repeat) return;
    const run = latestState.run;
    if (run.status === 'choosing' && run.lastRoll !== null) {
      handleChoiceKey(event.key, run.lastRoll);
      return;
    }
    const isRollable = run.status === 'connected' || run.status === 'hit';
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
