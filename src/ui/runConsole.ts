import { MINUTES_PER_ROLL } from '../game/clock';
import { PROGRAMS, type ProgramId } from '../game/programs';
import type { RunState } from '../game/run';
import type { Server } from '../game/server';
import { el, percent } from './dom';

export interface RunConsoleProps {
  readonly run: RunState;
  readonly server: Server;
  readonly hitChance: number;
  readonly isLocked: boolean;
  readonly canSplice: boolean;
  readonly canBounce: boolean;
  readonly canFailsafe: boolean;
  readonly charges: Readonly<Record<ProgramId, number>>;
  readonly onRoll: () => void;
  readonly onJackOut: () => void;
  readonly onSplice: () => void;
  readonly onBounce: () => void;
  readonly onFailsafe: () => void;
  readonly onAcceptMiss: () => void;
}

function narration(run: RunState): string {
  const unbanked = run.buffer.reduce((sum, steps) => sum + steps, 0);
  if (run.status === 'missed') return 'Trace locked on. Nothing hit this time. Run a program now, or take the hit.';
  if (run.status === 'hit') return `Pulling data. ${unbanked} block${unbanked === 1 ? '' : 's'} unbanked. A miss now loses all of it.`;
  if (run.rolls === 0) {
    return `The handshake took ${run.handshakeMinutes} minutes. You're in. Until you pull data, a miss only costs time.`;
  }
  return 'No signal. ICE hasn’t noticed you yet, so keep probing.';
}

function riskTone(hitChance: number): string {
  if (hitChance >= 0.85) return 'is-safe';
  if (hitChance >= 0.6) return 'is-uneasy';
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

function renderRollChoices(props: RunConsoleProps): HTMLElement {
  const unbanked = props.run.buffer.reduce((sum, steps) => sum + steps, 0);
  const isConnected = props.run.status === 'connected';
  const jackOutLabel = unbanked > 0 ? `Jack out and bank ${unbanked}` : 'Jack out';
  return el('div', { className: 'console-actions' }, [
    el('button', { className: 'btn btn-roll', attrs: { type: 'button' }, onClick: props.onRoll, isDisabled: props.isLocked }, [
      el('span', { text: isConnected && props.run.rolls === 0 ? 'Roll' : 'Roll again' }),
      el('small', { text: `+${MINUTES_PER_ROLL} min` }),
    ]),
    el('button', { className: 'btn btn-jack', attrs: { type: 'button' }, onClick: props.onJackOut, isDisabled: props.isLocked }, [
      el('span', { text: jackOutLabel }),
    ]),
    props.canSplice ? programButton('splice', 'Splice: reroll idle dice', props.charges.splice, props.onSplice, props.isLocked) : null,
  ]);
}

export function renderRunConsole(props: RunConsoleProps): HTMLElement {
  const isMissed = props.run.status === 'missed';
  const isAtRisk = props.run.status === 'hit';
  return el('div', { className: 'console' }, [
    el('p', { className: 'console-narration', text: narration(props.run) }),
    isMissed
      ? null
      : el('div', { className: `odds ${riskTone(props.hitChance)}` }, [
          el('span', { className: 'odds-label', text: isAtRisk ? 'Next roll hits' : 'Chance to hit' }),
          el('strong', { className: 'odds-value', text: percent(props.hitChance) }),
          el('div', { className: 'odds-meter' }, [el('div', { className: 'odds-fill', style: { width: percent(props.hitChance) } })]),
        ]),
    isMissed ? renderMissChoices(props) : renderRollChoices(props),
    el('p', { className: 'console-keys', text: 'Space rolls. J jacks out.' }),
  ]);
}
