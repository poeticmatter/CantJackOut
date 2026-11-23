import type { FileId } from '../game/files';
import { type SplitOption, type StreamContext, newStreams } from '../game/pairing';
import type { RollRecord } from '../game/roll';
import { el } from './dom';
import { fileGlyph, fileLabel, fileToneClass, pairGlyph } from './faceStyle';

export const SPLIT_KEYS = ['1', '2', '3'] as const;
/** Keys for the two ways to take a split whose pairs can't both open a stream. */
export const CHOICE_KEYS = ['A', 'B'] as const;

export interface SplitPickerProps {
  readonly roll: RollRecord;
  readonly context: StreamContext;
  readonly isLocked: boolean;
  /** A split whose number key was pressed and that still needs A or B. */
  readonly pendingSplit: number | null;
  readonly onChoose: (splitIndex: number, choiceIndex: number) => void;
  /** Hovering an option previews the files it would advance; null clears it. */
  readonly onPreview: (files: readonly FileId[] | null) => void;
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

/** Why a pair in this split downloads nothing, when it doesn't. */
function idlePairNote(option: SplitOption, context: StreamContext): string | null {
  const used = new Set(option.choices.flat());
  const idle = option.files.filter((file) => !used.has(file));
  if (idle.length === 0 || option.choices.length > 1) return null;
  return idle.map((file) => `${file} ${context.fullFiles.includes(file) ? 'is full' : 'needs a third stream'}`).join(', ');
}

function renderPairs(roll: RollRecord, option: SplitOption): HTMLElement {
  return el('div', { className: 'split-pairs', attrs: { 'aria-hidden': 'true' } }, option.dicePairs.map(([a, b]) =>
    el('span', { className: 'split-pair' }, [pairGlyph([roll.colors[a], roll.colors[b]], 'split-pair-glyph')])));
}

function renderSingleChoice(props: SplitPickerProps, option: SplitOption, splitIndex: number): HTMLElement {
  const files = option.choices[0];
  const note = idlePairNote(option, props.context);
  return el('button', {
    className: 'split-card',
    attrs: { type: 'button', 'aria-label': `Split ${splitIndex + 1}: ${files.map(fileLabel).join(' and ')}` },
    onClick: () => props.onChoose(splitIndex, 0),
    isDisabled: props.isLocked,
  }, [
    el('kbd', { className: 'split-key', text: SPLIT_KEYS[splitIndex] }),
    renderPairs(props.roll, option),
    renderEffects(files, props.context),
    note === null ? null : el('small', { className: 'split-note', text: note }),
  ]);
}

function renderTwoChoices(props: SplitPickerProps, option: SplitOption, splitIndex: number): HTMLElement {
  const isPending = props.pendingSplit === splitIndex;
  return el('div', { className: `split-card is-forked${isPending ? ' is-pending' : ''}` }, [
    el('kbd', { className: 'split-key', text: SPLIT_KEYS[splitIndex] }),
    renderPairs(props.roll, option),
    el('small', { className: 'split-note', text: 'Only one stream is free: pick one pair.' }),
    el('div', { className: 'split-forks' }, option.choices.map((files, choiceIndex) => withPreview(props, files,
      el('button', {
        className: 'split-fork',
        attrs: { type: 'button', 'aria-label': `Split ${splitIndex + 1}, ${fileLabel(files[0])} only` },
        onClick: () => props.onChoose(splitIndex, choiceIndex),
        isDisabled: props.isLocked,
      }, [isPending ? el('kbd', { className: 'split-key', text: CHOICE_KEYS[choiceIndex] }) : null, renderEffects(files, props.context)])))),
  ]);
}

function renderDeadSplit(props: SplitPickerProps, option: SplitOption, splitIndex: number): HTMLElement {
  return el('div', { className: 'split-card is-dead', attrs: { 'aria-label': `Split ${splitIndex + 1}: nothing usable` } }, [
    el('kbd', { className: 'split-key', text: SPLIT_KEYS[splitIndex] }),
    renderPairs(props.roll, option),
    el('small', { className: 'split-note', text: `${option.files.join(' + ')}: nothing usable` }),
  ]);
}

function withPreview<T extends HTMLElement>(props: SplitPickerProps, files: readonly FileId[], element: T): T {
  element.addEventListener('mouseenter', () => props.onPreview(files));
  element.addEventListener('mouseleave', () => props.onPreview(null));
  return element;
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
