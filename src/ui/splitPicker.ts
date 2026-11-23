import type { FileId } from '../game/files';
import { type SplitOption, type StreamContext, newStreams } from '../game/pairing';
import type { RollRecord } from '../game/roll';
import { el } from './dom';
import { COLOR_LABEL, fileGlyph, fileLabel, fileToneClass, pairGlyph } from './faceStyle';
import { withTilt } from './tilt';

export const SPLIT_KEYS = ['1', '2', '3'] as const;
/** Keys for the two ways to take a split whose pairs can't both open a stream. */
export const CHOICE_KEYS = ['A', 'B'] as const;

interface PickerProps {
  readonly roll: RollRecord;
  readonly context: StreamContext;
  readonly isLocked: boolean;
  /** Hovering an option previews the files it would advance; null clears it. */
  readonly onPreview: (files: readonly FileId[] | null) => void;
}

export interface SplitPickerProps extends PickerProps {
  /** A split whose number key was pressed and that still needs A or B. */
  readonly pendingSplit: number | null;
  readonly onChoose: (splitIndex: number, choiceIndex: number) => void;
}

export interface JackpotPickerProps extends PickerProps {
  readonly onPick: (file: FileId) => void;
}

function withPreview<T extends HTMLElement>(props: PickerProps, files: readonly FileId[], element: T): T {
  element.addEventListener('mouseenter', () => props.onPreview(files));
  element.addEventListener('mouseleave', () => props.onPreview(null));
  return element;
}

function blockCounts(files: readonly FileId[]): Map<FileId, number> {
  const counts = new Map<FileId, number>();
  for (const file of files) counts.set(file, (counts.get(file) ?? 0) + 1);
  return counts;
}

/** "+1 RB, opens a stream" for every file the choice advances. */
function renderEffects(files: readonly FileId[], context: StreamContext): HTMLElement {
  const opening = newStreams(context.streams, files);
  return el('ul', { className: 'split-effects' }, [...blockCounts(files)].map(([file, blocks]) =>
    el('li', { className: `split-effect ${fileToneClass(file)}` }, [
      fileGlyph(file, 'split-effect-glyph'),
      el('strong', { text: `+${blocks} ${file}` }),
      opening.includes(file) ? el('span', { className: 'split-new-stream', text: 'opens a stream' }) : null,
    ])));
}

function idleReason(roll: RollRecord, option: SplitOption, pairIndex: number, context: StreamContext): string {
  const file = option.files[pairIndex];
  if (file === null) {
    const color = roll.colors[option.dicePairs[pairIndex][0]];
    return `two ${COLOR_LABEL[color].toLowerCase()} don’t pair`;
  }
  return context.fullFiles.includes(file) ? `${file} is full` : `${file} needs a fourth stream`;
}

/** Why a pair in this split downloads nothing, when it doesn't. */
function idlePairNote(props: PickerProps, option: SplitOption): string | null {
  if (option.choices.length > 1) return null;
  const used = [...(option.choices[0] ?? [])];
  const reasons = option.files.flatMap((file, pairIndex) => {
    const at = file === null ? -1 : used.indexOf(file);
    if (at !== -1) {
      used.splice(at, 1);
      return [];
    }
    return [idleReason(props.roll, option, pairIndex, props.context)];
  });
  return reasons.length === 0 ? null : reasons.join(', ');
}

function renderPairs(roll: RollRecord, option: SplitOption): HTMLElement {
  return el('div', { className: 'split-pairs', attrs: { 'aria-hidden': 'true' } }, option.dicePairs.map(([a, b], pairIndex) =>
    el('span', { className: `split-pair${option.files[pairIndex] === null ? ' is-same' : ''}` }, [pairGlyph([roll.colors[a], roll.colors[b]], 'split-pair-glyph')])));
}

function renderSingleChoice(props: SplitPickerProps, option: SplitOption, splitIndex: number): HTMLElement {
  const files = option.choices[0];
  const note = idlePairNote(props, option);
  return withTilt(el('button', {
    className: 'split-card',
    attrs: { type: 'button', 'aria-label': `Split ${splitIndex + 1}: ${files.map(fileLabel).join(' and ')}` },
    onClick: () => props.onChoose(splitIndex, 0),
    isDisabled: props.isLocked,
  }, [
    el('kbd', { className: 'split-key', text: SPLIT_KEYS[splitIndex] }),
    renderPairs(props.roll, option),
    renderEffects(files, props.context),
    note === null ? null : el('small', { className: 'split-note', text: note }),
  ]));
}

function renderTwoChoices(props: SplitPickerProps, option: SplitOption, splitIndex: number): HTMLElement {
  const isPending = props.pendingSplit === splitIndex;
  return el('div', { className: `split-card is-forked${isPending ? ' is-pending' : ''}` }, [
    el('kbd', { className: 'split-key', text: SPLIT_KEYS[splitIndex] }),
    renderPairs(props.roll, option),
    el('small', { className: 'split-note', text: 'Only one stream is free: pick one pair.' }),
    el('div', { className: 'split-forks' }, option.choices.map((files, choiceIndex) => withPreview(props, files,
      withTilt(el('button', {
        className: 'split-fork',
        attrs: { type: 'button', 'aria-label': `Split ${splitIndex + 1}, ${fileLabel(files[0])} only` },
        onClick: () => props.onChoose(splitIndex, choiceIndex),
        isDisabled: props.isLocked,
      }, [isPending ? el('kbd', { className: 'split-key', text: CHOICE_KEYS[choiceIndex] }) : null, renderEffects(files, props.context)]))))),
  ]);
}

function renderDeadSplit(props: SplitPickerProps, option: SplitOption, splitIndex: number): HTMLElement {
  return el('div', { className: 'split-card is-dead', attrs: { 'aria-label': `Split ${splitIndex + 1}: nothing usable` } }, [
    el('kbd', { className: 'split-key', text: SPLIT_KEYS[splitIndex] }),
    renderPairs(props.roll, option),
    el('small', { className: 'split-note', text: idlePairNote(props, option) ?? 'Nothing usable' }),
  ]);
}

function renderSplit(props: SplitPickerProps, option: SplitOption, splitIndex: number): HTMLElement {
  if (option.choices.length === 0) return renderDeadSplit(props, option, splitIndex);
  const card = option.choices.length === 1 ? renderSingleChoice(props, option, splitIndex) : renderTwoChoices(props, option, splitIndex);
  return withPreview(props, option.choices.flat(), card);
}

export function renderSplitPicker(props: SplitPickerProps): HTMLElement {
  return el('div', { className: 'split-picker', attrs: { role: 'group', 'aria-label': 'Choose how to pair the dice' } },
    props.roll.options.map((option, splitIndex) => renderSplit(props, option, splitIndex)));
}

/** Number keys for a jackpot's files, in tower order. */
export function jackpotKey(index: number): string {
  return String(index + 1);
}

/** Four of a kind: no pair works, but the player drops one block in any file they can reach. */
export function renderJackpotPicker(props: JackpotPickerProps): HTMLElement {
  const color = COLOR_LABEL[props.roll.colors[0]].toLowerCase();
  return el('div', { className: 'jackpot-picker', attrs: { role: 'group', 'aria-label': 'Jackpot: choose a file' } }, [
    el('div', { className: 'jackpot-banner', attrs: { 'data-text': 'Jackpot' } }, [el('span', { text: 'Jackpot' })]),
    el('p', { className: 'jackpot-text', text: `Four ${color}. Put a block in any file you can reach.` }),
    el('div', { className: 'jackpot-files' }, props.roll.jackpotFiles.map((file, index) => withPreview(props, [file],
      el('button', {
        className: `jackpot-file ${fileToneClass(file)}`,
        attrs: { type: 'button', 'aria-label': `Jackpot: one block of ${fileLabel(file)}` },
        onClick: () => props.onPick(file),
        isDisabled: props.isLocked,
      }, [
        el('kbd', { className: 'split-key', text: jackpotKey(index) }),
        fileGlyph(file, 'jackpot-file-glyph'),
        el('strong', { text: `+1 ${file}` }),
        newStreams(props.context.streams, [file]).length > 0 ? el('span', { className: 'split-new-stream', text: 'opens a stream' }) : null,
      ])))),
  ]);
}
