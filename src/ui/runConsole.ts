import { MINUTES_PER_ROLL, REROUTE_MINUTES } from '../game/clock';
import { PROGRAMS, type ProgramId } from '../game/programs';
import { type RunState, downloadedSinceStake } from '../game/run';
import { el, money, percent } from './dom';

export interface RunConsoleProps {
  readonly run: RunState;
  /** Chance the next roll doesn't get you caught. */
  readonly safeChance: number;
  readonly isLocked: boolean;
  readonly canSplice: boolean;
  readonly canBounce: boolean;
  readonly canFailsafe: boolean;
  readonly canReroute: boolean;
  readonly reroutePrice: number;
  readonly canAffordReroute: boolean;
  readonly paydayCash: number;
  readonly charges: Readonly<Record<ProgramId, number>>;
  readonly onRoll: () => void;
  readonly onJackOut: () => void;
  readonly onReroute: () => void;
  readonly onSplice: () => void;
  readonly onBounce: () => void;
  readonly onFailsafe: () => void;
  readonly onAcceptMiss: () => void;
}

function atRisk(run: RunState): number {
  return run.buffer.reduce((sum, blocks) => sum + blocks, 0);
}

function blocks(count: number): string {
  return `${count} block${count === 1 ? '' : 's'}`;
}

function narration(run: RunState): string {
  if (run.status === 'missed') return 'Trace locked on. Nothing hit this time. Run a program now, or take the hit.';
  if (run.status === 'blocked') return `Nothing hit, but your Firewall face ate the trace. ${blocks(atRisk(run))} still at risk.`;
  if (run.status === 'hit') return `Pulling data. ${blocks(atRisk(run))} at risk. A miss now loses all of it.`;
  if (run.reroutes > 0 && run.rolls > 0) return 'Rerouted. Your download is banked, and a fresh block of each file is back at risk.';
  return `The handshake took ${run.handshakeMinutes} minutes. You’re in, with one block of each file at risk: miss your first roll and you lose it.`;
}

function riskTone(chance: number): string {
  if (chance >= 0.85) return 'is-safe';
  if (chance >= 0.6) return 'is-uneasy';
  return 'is-dangerous';
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
  const secured = downloadedSinceStake(props.run);
  return el('button', {
    className: 'btn btn-reroute',
    attrs: { type: 'button', title: props.canAffordReroute ? 'Bank the download without leaving. A fresh stake goes at risk.' : `You need ${money(props.reroutePrice)} to reroute.` },
    onClick: props.onReroute,
    isDisabled: props.isLocked || !props.canAffordReroute,
  }, [
    el('span', { text: `Reroute: bank ${secured} and stay` }),
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
      el('span', { text: `Jack out and bank ${atRisk(props.run)}` }),
    ]),
    renderRerouteButton(props),
    props.canSplice ? programButton('splice', 'Splice: reroll idle dice', props.charges.splice, props.onSplice, props.isLocked) : null,
  ]);
}

export function renderRunConsole(props: RunConsoleProps): HTMLElement {
  const isMissed = props.run.status === 'missed';
  return el('div', { className: 'console' }, [
    el('p', { className: 'console-narration', text: narration(props.run) }),
    isMissed
      ? null
      : el('div', { className: `odds ${riskTone(props.safeChance)}` }, [
          el('span', { className: 'odds-label', text: 'Next roll is safe' }),
          el('strong', { className: 'odds-value', text: percent(props.safeChance) }),
          el('div', { className: 'odds-meter' }, [el('div', { className: 'odds-fill', style: { width: percent(props.safeChance) } })]),
        ]),
    isMissed ? renderMissChoices(props) : renderRollChoices(props),
    props.paydayCash > 0 ? el('p', { className: 'console-payday', text: `Payday faces: ${money(props.paydayCash)} this run` }) : null,
    el('p', { className: 'console-keys', text: 'Space rolls. J jacks out. R reroutes.' }),
  ]);
}
