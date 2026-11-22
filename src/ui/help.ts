import { FINAL_NIGHT, MAX_STRIKES } from '../game/campaign';
import { el } from './dom';
import { glyph } from './faceStyle';

const RULES: readonly string[] = [
  'Pick a server and jack in. Each server holds one or two files, and each file has a color.',
  'Roll your dice. Every die that shows a file’s color downloads one block of that file.',
  'Keep rolling to download more, or jack out to bank what you have. Banked blocks stay on the server for your next run.',
  'Once you’re pulling data, a roll where no die matches an unfinished file gets you jacked out, and you lose everything unbanked from that run.',
  'Download every file on a server to sell the data. Partial downloads are worth nothing.',
  'You only see a server’s files once you connect. Before that, the reward is your only hint: bigger pays mean harder servers.',
  'Every run costs time: a random handshake, plus a few minutes per roll, plus recovery if you get caught. At dawn the night ends, wherever the clock lands.',
  `At each dawn Vesna takes her cut. Come up short and she takes everything plus a strike. ${MAX_STRIKES} strikes and she takes the deck. Survive ${FINAL_NIGHT} nights to own it.`,
  'Spend money in the market between runs: more dice, programs, and reflashed faces.',
];

export function renderHelp(onClose: () => void): HTMLElement {
  return el('div', { className: 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How to play' } }, [
    el('div', { className: 'overlay-panel help' }, [
      el('header', { className: 'overlay-head' }, [el('h2', { text: 'How to play' })]),
      el('p', { className: 'help-lede', text: 'You owe Vesna for the deck. Crack corporate servers at night, sell the data, and pay her at dawn.' }),
      el('div', { className: 'help-dice' }, [
        el('div', { className: 'help-face face-red' }, [glyph('red', 'help-glyph'), el('span', { text: '1 face in 6' })]),
        el('div', { className: 'help-face face-blue' }, [glyph('blue', 'help-glyph'), el('span', { text: '2 faces in 6' })]),
        el('div', { className: 'help-face face-green' }, [glyph('green', 'help-glyph'), el('span', { text: '3 faces in 6' })]),
      ]),
      el('p', { className: 'help-caption', text: 'A standard die. Red is rare, so a short red file can be as hard as a long green one.' }),
      el('ol', { className: 'help-rules' }, RULES.map((rule) => el('li', { text: rule }))),
      el('button', { className: 'btn btn-primary', text: 'Got it', attrs: { type: 'button', autofocus: '' }, onClick: onClose }),
    ]),
  ]);
}
