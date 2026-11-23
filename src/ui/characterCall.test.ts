// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTH, VESNA, renderCall } from './characterCall';

const LINES = ['You owe me for that deck.', 'Ten nights.'];

function mountCall(options: { isHostile?: boolean } = {}): HTMLElement {
  const call = renderCall(VESNA, { lines: LINES, actions: [], ...options });
  document.body.replaceChildren(call);
  return call;
}

beforeEach(() => {
  vi.useFakeTimers();
  // Full motion, so lines type out over time instead of appearing at once.
  window.matchMedia = (query: string) => ({ matches: false, media: query }) as MediaQueryList;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('renderCall', () => {
  it('shows the caller as a silhouette', () => {
    const call = renderCall(MOTH, { lines: LINES, actions: [] });
    expect(call.querySelector('.call-portrait svg')).not.toBeNull();
  });

  it('marks the call as talking while a line types out', () => {
    const call = mountCall();
    vi.advanceTimersByTime(300);
    expect(call.classList.contains('is-talking')).toBe(true);
  });

  it('stops talking when a click finishes the lines', () => {
    const call = mountCall();
    vi.advanceTimersByTime(300);
    call.click();
    expect(call.classList.contains('is-talking')).toBe(false);
  });

  it('glitches the picture when the news is bad', () => {
    const call = mountCall({ isHostile: true });
    expect(call.querySelector('.call-portrait.is-glitching')).not.toBeNull();
  });
});
