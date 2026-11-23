import { FINAL_NIGHT, MAX_STRIKES } from '../game/campaign';
import { el } from './dom';
import { glyph } from './faceStyle';

const RULES: readonly string[] = [
  'Pick a server and jack in. Each server holds one or two files, and each file has a color.',
  'Every run starts with one block of each unfinished file at risk: a free one on a server you haven’t touched, otherwise the last block you banked there.',
  'Roll your dice. Every die that shows a file’s color downloads one block of that file.',
  'Keep rolling to download more, or jack out to bank everything at risk. A roll where no die matches an unfinished file jacks you out, and everything at risk is lost.',
  'Mid-run, you can pay to reroute: bank what you have and keep going, without the handshake of a fresh visit.',
  'Download every file on a server to sell the data. Partial downloads are worth nothing.',
  'Every visit raises a server’s alert, and getting caught raises it twice. When it fills, the sysadmin wipes everything you banked there.',
  'Every run costs time: a random handshake, plus a few minutes per roll, plus recovery if you get caught. At dawn the night ends, wherever the clock lands.',
  `At each dawn Vesna takes her cut. Come up short and she takes everything plus a strike. ${MAX_STRIKES} strikes and she takes the deck. Survive ${FINAL_NIGHT} nights to own it.`,
  'Between runs, Moth’s back room sells more dice, programs and reflashed faces. “Upgrade dice” in your deck panel takes you straight to her bench.',
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
