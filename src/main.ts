import './styles/base.css';
import './styles/net.css';
import './styles/deck.css';
import './styles/towers.css';
import './styles/dice.css';
import './styles/run.css';
import './styles/overlays.css';
import './styles/characters.css';
import './styles/market.css';
import './styles/fx.css';
import './styles/handshake.css';
import { startApp } from './ui/app';
import { startBackdrop } from './ui/backdrop';
import { createStore } from './ui/store';

const root = document.getElementById('app');
const backdrop = document.getElementById('backdrop');
if (!(root instanceof HTMLElement) || !(backdrop instanceof HTMLCanvasElement)) {
  throw new Error('index.html is missing #app or #backdrop');
}
startBackdrop(backdrop);
startApp(root, createStore());
