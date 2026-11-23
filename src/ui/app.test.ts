// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp } from './app';
import { createStore } from './store';

const MAX_CLICKS = 300;

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buttonLabelled(root: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(label) && !candidate.disabled);
}

async function settle(): Promise<void> {
  for (let index = 0; index < 5; index++) await flush();
}

function mountApp(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div><div id="toasts"></div>';
  const root = document.getElementById('app');
  if (root === null) throw new Error('missing #app');
  startApp(root, createStore());
  return root;
}

async function playOneRun(root: HTMLElement): Promise<void> {
  root.querySelector<HTMLButtonElement>('.card-jack')?.click();
  for (let clicks = 0; clicks < MAX_CLICKS && root.querySelector('.run-result') === null; clicks++) {
    await settle();
    const next =
      root.querySelector<HTMLButtonElement>('.btn-roll:not(:disabled)') ??
      root.querySelector<HTMLButtonElement>('button.split-card:not(:disabled), .split-fork:not(:disabled)') ??
      buttonLabelled(root, 'Take the hit');
    next?.click();
  }
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  // jsdom has no matchMedia; reporting reduced motion makes every animation resolve instantly.
  window.matchMedia = (query: string) => ({ matches: true, media: query }) as MediaQueryList;
  // jsdom has no canvas either; the game already draws nothing when a canvas has no context.
  HTMLCanvasElement.prototype.getContext = () => null;
});

describe('app', () => {
  it('opens with the rules for a first-time player', () => {
    const root = mountApp();
    expect(root.querySelector('.help')).not.toBeNull();
  });

  it('plays a run through to its result screen', async () => {
    const root = mountApp();
    buttonLabelled(root, 'Got it')?.click();
    await playOneRun(root);
    expect(root.querySelector('.run-result')).not.toBeNull();
  });

  it('plays a run without any action being rejected', async () => {
    const root = mountApp();
    buttonLabelled(root, 'Got it')?.click();
    await playOneRun(root);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('returns to the net after a run', async () => {
    const root = mountApp();
    buttonLabelled(root, 'Got it')?.click();
    await playOneRun(root);
    (buttonLabelled(root, 'Back to the net') ?? buttonLabelled(root, 'Face the dawn'))?.click();
    expect(root.querySelector('.net-screen, .dawn-screen')).not.toBeNull();
  });

  it('opens the market between runs', () => {
    const root = mountApp();
    buttonLabelled(root, 'Got it')?.click();
    buttonLabelled(root, 'Market')?.click();
    expect(root.querySelector('.market')).not.toBeNull();
  });

  it('has Vesna call at the start of the night', () => {
    const root = mountApp();
    buttonLabelled(root, 'Got it')?.click();
    expect(root.querySelector('.call-vesna')).not.toBeNull();
  });

  it('offers the three splits after a roll', async () => {
    const root = mountApp();
    buttonLabelled(root, 'Got it')?.click();
    root.querySelector<HTMLButtonElement>('.card-jack')?.click();
    await settle();
    root.querySelector<HTMLButtonElement>('.btn-roll')?.click();
    await settle();
    expect(root.querySelectorAll('.split-card')).toHaveLength(3);
  });
});
