import { FINAL_NIGHT, MAX_STRIKES } from '../game/campaign';
import type { Color } from '../game/dice';
import { el } from './dom';
import { glyph } from './faceStyle';

const RULES: readonly string[] = [
  'Pick a server and jack in. Every server holds six files, one for each pair of different colors: R+B, R+G, R+Y, B+G, B+Y and G+Y. Servers differ in how long each file is.',
  'Roll four dice, then split them into two pairs. You see all three ways to split them and pick one. Each pair of two different colors downloads a block of the file with those two colors. Two dice of the same color never pair.',
  'A run can work on three files at most: its streams. A file opens a stream the first time you download from it. A pair whose file is full, or that would need a fourth stream, does nothing.',
  'Jackpot: if all four dice show the same color, put one block in any file you can reach (an open stream, or a new one if a stream is free).',
  'Keep rolling to download more, or jack out to bank everything at risk. A roll with no usable pair and no jackpot jacks you out, and everything at risk is lost. With every file open, your first roll can’t miss.',
  'Mid-run, you can pay to reroute: bank what you have and free every stream, without the handshake of a fresh visit.',
  'The fence pays for each file as soon as all of it is banked. Short files are rare pairs, and pay about as much as long common ones. Once all six are sold, the server leaves the net.',
  'Every visit raises a server’s alert, and getting caught raises it twice. When it fills, the sysadmin wipes every unfinished file there. Files you’ve sold are safe.',
  'Every run costs time: a random handshake, plus a few minutes per roll, plus recovery if you get caught. At dawn the night ends, wherever the clock lands.',
  `At each dawn Vesna takes her cut. Come up short and she takes everything plus a strike. ${MAX_STRIKES} strikes and she takes the deck. Survive ${FINAL_NIGHT} nights to own it.`,
  'Between runs, Moth’s back room sells program slots and programs.',
];

const DIE_FACES: readonly (readonly [Color, string])[] = [
  ['red', '1 face in 6'],
  ['blue', '1 face in 6'],
  ['green', '2 faces in 6'],
  ['yellow', '2 faces in 6'],
];

export function renderHelp(onClose: () => void): HTMLElement {
  return el('div', { className: 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How to play' } }, [
    el('div', { className: 'overlay-panel help' }, [
      el('header', { className: 'overlay-head' }, [el('h2', { text: 'How to play' })]),
      el('p', { className: 'help-lede', text: 'You owe Vesna for the deck. Crack corporate servers at night, sell the data, and pay her at dawn.' }),
      el('div', { className: 'help-dice' }, DIE_FACES.map(([color, odds]) =>
        el('div', { className: `help-face face-${color}` }, [glyph(color, 'help-glyph'), el('span', { text: odds })]))),
      el('p', { className: 'help-caption', text: 'Every die is the same, and you roll four. Red and blue are rare, so the R+B file is short.' }),
      el('ol', { className: 'help-rules' }, RULES.map((rule) => el('li', { text: rule }))),
      el('button', { className: 'btn btn-primary', text: 'Got it', attrs: { type: 'button', autofocus: '' }, onClick: onClose }),
    ]),
  ]);
}
