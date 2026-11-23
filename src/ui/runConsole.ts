import { MINUTES_PER_ROLL, REROUTE_MINUTES } from '../game/clock';
import { MAX_STREAMS } from '../game/pairing';
import { PROGRAMS, type ProgramId } from '../game/programs';
import { isJackpotRoll } from '../game/roll';
import { type RunState, blocksAtRisk } from '../game/run';
import { el, money, percent } from './dom';
import { fileGlyph, fileToneClass } from './faceStyle';

export interface RunConsoleProps {
  readonly run: RunState;
  /** Chance the next roll isn't a miss. */
  readonly safeChance: number;
  readonly isLocked: boolean;
  /** The split picker, or the jackpot's file picker, shown while the player chooses. */
  readonly choicePicker: HTMLElement | null;
  readonly canBounce: boolean;
  readonly canFailsafe: boolean;
  readonly canReroute: boolean;
  readonly reroutePrice: number;
  readonly canAffordReroute: boolean;
  readonly charges: Readonly<Record<ProgramId, number>>;
  readonly onRoll: () => void;
  readonly onJackOut: () => void;
  readonly onReroute: () => void;
  readonly onBounce: () => void;
  readonly onFailsafe: () => void;
  readonly onAcceptMiss: () => void;
}

function blocks(count: number): string {
  return `${count} block${count === 1 ? '' : 's'}`;
}

function narration(run: RunState): string {
  if (run.status === 'missed') return 'Trace locked on. No pair fits a stream. Run a program now, or take the hit.';
  if (run.status === 'choosing' && run.lastRoll !== null && isJackpotRoll(run.lastRoll)) return 'Four of a kind. No pair works, but the jackpot drops a block wherever you want it.';
  if (run.status === 'choosing') return 'Pair up the dice. Each pair of two different colors downloads a block of its file.';
  if (run.status === 'hit') return `Pulling data. ${blocks(blocksAtRisk(run))} at risk. A miss now loses all of it.`;
  if (run.reroutes > 0) return 'Rerouted. Your download is banked and every stream is free again.';
  return `The handshake took ${run.handshakeMinutes} minutes. You’re in. With every file open, your first roll can’t miss.`;
}

function riskTone(chance: number): string {
  if (chance >= 0.85) return 'is-safe';
  if (chance >= 0.6) return 'is-uneasy';
  return 'is-dangerous';
}

function renderStreams(run: RunState): HTMLElement {
  const free = MAX_STREAMS - run.streams.length;
  const slots = [
    ...run.streams.map((file) => el('span', { className: `stream-slot is-open ${fileToneClass(file)}` }, [fileGlyph(file, 'stream-glyph'), el('span', { text: file })])),
    ...Array.from({ length: free }, () => el('span', { className: 'stream-slot is-free', text: 'free' })),
  ];
  return el('div', { className: 'streams', attrs: { 'aria-label': `${free} of ${MAX_STREAMS} streams left this run` } }, [
    el('span', { className: 'streams-label', text: `Streams: ${free} of ${MAX_STREAMS} left` }),
    el('div', { className: 'stream-slots' }, slots),
  ]);
}

function programButton(id: ProgramId, label: string, charges: number, onClick: () => void, isLocked: boolean): HTMLButtonElement {
  return el('button', { className: 'btn btn-program', attrs: { type: 'button', title: PROGRAMS[id].summary }, onClick, isDisabled: isLocked }, [
    el('span', { text: label }),
    el('small', { text: `${charges} left tonight` }),
  ]);
}

function renderMissChoices(props: RunConsoleProps): HTMLElement {
  return el('div', { className: 'console-actions is-missed' }, [
    props.canBounce ? programButton('bounce', 'Bounce: reroll every die', props.charges.bounce, props.onBounce, props.isLocked) : null,
    props.canFailsafe ? programButton('failsafe', 'Failsafe: keep half', props.charges.failsafe, props.onFailsafe, props.isLocked) : null,
    el('button', { className: 'btn btn-danger', text: 'Take the hit', attrs: { type: 'button' }, onClick: props.onAcceptMiss, isDisabled: props.isLocked }),
  ]);
}

function renderRerouteButton(props: RunConsoleProps): HTMLElement | null {
  if (!props.canReroute) return null;
  return el('button', {
    className: 'btn btn-reroute',
    attrs: { type: 'button', title: props.canAffordReroute ? 'Bank the download without leaving. Every stream comes free.' : `You need ${money(props.reroutePrice)} to reroute.` },
    onClick: props.onReroute,
    isDisabled: props.isLocked || !props.canAffordReroute,
  }, [
    el('span', { text: `Reroute: bank ${blocksAtRisk(props.run)}, free the streams` }),
    el('small', { text: `${money(props.reroutePrice)} · +${REROUTE_MINUTES} min` }),
  ]);
}

function renderRollChoices(props: RunConsoleProps): HTMLElement {
  const isFirstRoll = props.run.status === 'connected' && props.run.rolls === 0;
  return el('div', { className: 'console-actions' }, [
    el('button', { className: 'btn btn-roll', attrs: { type: 'button' }, onClick: props.onRoll, isDisabled: props.isLocked }, [
      el('span', { text: isFirstRoll ? 'Roll' : 'Roll again' }),
      el('small', { text: `+${MINUTES_PER_ROLL} min` }),
    ]),
    el('button', { className: 'btn btn-jack', attrs: { type: 'button' }, onClick: props.onJackOut, isDisabled: props.isLocked }, [
      el('span', { text: `Jack out and bank ${blocksAtRisk(props.run)}` }),
    ]),
    renderRerouteButton(props),
  ]);
}

function renderOdds(chance: number): HTMLElement {
  return el('div', { className: `odds ${riskTone(chance)}` }, [
    el('span', { className: 'odds-label', text: 'Next roll is safe' }),
    el('strong', { className: 'odds-value', text: percent(chance) }),
    el('div', { className: 'odds-meter' }, [el('div', { className: 'odds-fill', style: { width: percent(chance) } })]),
  ]);
}

function renderActions(props: RunConsoleProps): HTMLElement | null {
  if (props.run.status === 'missed') return renderMissChoices(props);
  if (props.run.status === 'choosing') return props.choicePicker;
  return renderRollChoices(props);
}

function keyHint(run: RunState): string {
  if (run.status === 'choosing' && run.lastRoll !== null && isJackpotRoll(run.lastRoll)) return 'Number keys pick a file for the jackpot.';
  if (run.status === 'choosing') return '1, 2, 3 pick a split. A or B picks a pair when only one stream is free.';
  return 'Space rolls. J jacks out. R reroutes.';
}

export function renderRunConsole(props: RunConsoleProps): HTMLElement {
  const isRolling = props.run.status === 'connected' || props.run.status === 'hit';
  return el('div', { className: 'console' }, [
    el('p', { className: 'console-narration', text: narration(props.run) }),
    renderStreams(props.run),
    isRolling ? renderOdds(props.safeChance) : null,
    renderActions(props),
    el('p', { className: 'console-keys', text: keyHint(props.run) }),
  ]);
}
