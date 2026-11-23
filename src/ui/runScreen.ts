import { acceptFlatline, bankAndJackOut, reroutePrice, rerouteRun, roll, takeSplit, useBounce, useFailsafe } from '../game/actions';
import { type CampaignState, type RunReport, findServer, isProgramReady } from '../game/campaign';
import { formatClock } from '../game/clock';
import { FACES_PER_DIE } from '../game/dice';
import { FILE_COLORS, type FileId, fileIndex } from '../game/files';
import { survivalChance } from '../game/pairing';
import type { RollRecord, SplitChoice } from '../game/roll';
import { canReroute, runMinutes, streamContext } from '../game/run';
import { sfx } from './audio';
import { type DieView, createDieView } from './dice3d';
import { el, wait } from './dom';
import { createFxLayer, shake } from './fx';
import { playHandshake } from './handshake';
import { renderRunConsole } from './runConsole';
import { type RunFrame, autoResolveMiss, filesFor, frameFor } from './runFrame';
import { renderRunResult } from './runResult';
import { CHOICE_KEYS, SPLIT_KEYS, renderSplitPicker } from './splitPicker';
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

function fileTone(file: FileId): string {
  return `var(--file-${file})`;
}

/** Which of a split's two pairs actually downloaded, given the choice the player took. */
function appliedPairs(rollRecord: RollRecord, choice: SplitChoice): boolean[] {
  const option = rollRecord.options[choice.splitIndex];
  const remaining = [...option.choices[choice.choiceIndex]];
  return option.files.map((file) => {
    const at = remaining.indexOf(file);
    if (at === -1) return false;
    remaining.splice(at, 1);
    return true;
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
  let displayedChoice: SplitChoice | null = null;
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

  const choose = (splitIndex: number, choiceIndex: number) => act((state) => takeSplit(state, splitIndex, choiceIndex));

  const previewFiles = (files: readonly FileId[] | null) => {
    for (const tower of towers.children) {
      const file = tower.getAttribute('data-file');
      tower.classList.toggle('is-preview', files !== null && files.some((candidate) => candidate === file));
    }
  };

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
    const context = streamContext(frame.run, frame.server);
    const isLocked = isAnimating || frame.report !== null;
    const lastRoll = frame.run.lastRoll;
    const splitPicker = frame.run.status === 'choosing' && lastRoll !== null
      ? renderSplitPicker({ roll: lastRoll, context, isLocked, pendingSplit, onChoose: choose, onPreview: previewFiles })
      : null;
    consoleSlot.replaceChildren(
      renderRunConsole({
        run: frame.run,
        safeChance: survivalChance(frame.dice, context),
        isLocked,
        splitPicker,
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

  const celebrateGains = (frame: RunFrame, before: readonly number[]) => {
    renderTowers(frame);
    const gained = displayedFilled.map((filled, index) => filled - (before[index] ?? filled));
    gained.forEach((blocks, index) => {
      const tower = towers.children[index];
      if (blocks <= 0 || tower === undefined) return;
      const file = frame.server.files[index];
      tower.classList.add('is-gaining');
      fx.floatText(tower.querySelector('.tower-shaft') ?? tower, `+${blocks}`, `tone-${FILE_COLORS[file.id][1]}`);
      const isNewlyFull = displayedFilled[index] >= file.length && (before[index] ?? 0) < file.length;
      if (isNewlyFull) {
        tower.classList.add('is-cracking');
        fx.burst(tower, fileTone(file.id), 28);
        sfx.fileCracked(FILE_COLORS[file.id][1]);
      }
    });
    if (gained.reduce((sum, blocks) => sum + Math.max(0, blocks), 0) >= BIG_ROLL_BLOCKS) shake(stage, 1.6);
  };

  const animateRoll = async (frame: RunFrame, rollRecord: RollRecord) => {
    sfx.rattle(diceViews.length);
    diceViews.forEach((view) => view.setMood('idle'));
    await Promise.all(rollRecord.faceIndexes.map((faceIndex, index) => diceViews[index]?.rollTo(faceIndex) ?? Promise.resolve()));
    if (frame.run.status === 'missed' || (frame.report !== null && rollRecord.chosen === null)) {
      diceViews.forEach((view) => view.setMood('dud'));
      sfx.probeMiss();
    }
  };

  const animateChoice = async (frame: RunFrame, rollRecord: RollRecord, choice: SplitChoice) => {
    const option = rollRecord.options[choice.splitIndex];
    const applied = appliedPairs(rollRecord, choice);
    const before = [...displayedFilled];
    const flights = option.dicePairs.map((pair, pairIndex) => {
      const file = option.files[pairIndex];
      const views = pair.map((dieIndex) => diceViews[dieIndex]).filter((view): view is DieView => view !== undefined);
      if (!applied[pairIndex]) {
        views.forEach((view) => view.setMood('dud'));
        return Promise.resolve();
      }
      views.forEach((view) => view.setMood('hit', fileTone(file)));
      sfx.hit(FILE_COLORS[file][1], pairIndex);
      const landing = landingFor(fileIndex(file));
      const source = views[0];
      return landing === null || source === undefined ? Promise.resolve() : fx.flyBlocks(source.element, landing, fileTone(file), PARTICLES_PER_BLOCK);
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
        if (tower !== undefined) fx.burst(tower, fileTone(file), 40);
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

  /** 1, 2, 3 take a split; a split that can only take one of its pairs waits for A or B. */
  const handleSplitKey = (event: KeyboardEvent, rollRecord: RollRecord) => {
    const splitIndex = SPLIT_KEYS.findIndex((key) => event.key === key);
    const choiceIndex = CHOICE_KEYS.findIndex((key) => event.key.toUpperCase() === key);
    if (splitIndex !== -1) {
      const option = rollRecord.options[splitIndex];
      if (option.choices.length === 1) choose(splitIndex, 0);
      else if (option.choices.length > 1) {
        pendingSplit = splitIndex;
        rerenderConsole();
      }
    } else if (choiceIndex !== -1 && pendingSplit !== null) {
      choose(pendingSplit, choiceIndex);
    } else if (event.key === 'Escape' && pendingSplit !== null) {
      pendingSplit = null;
      rerenderConsole();
    }
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!element.isConnected || isAnimating || latestState.run === null || event.repeat) return;
    const run = latestState.run;
    if (run.status === 'choosing' && run.lastRoll !== null) {
      handleSplitKey(event, run.lastRoll);
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
