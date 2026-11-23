import { describe, expect, it } from 'vitest';
import { traceLevel } from './tension';

const CALM = { blocksAtRisk: 0, safeChance: 0.8, alert: 0, alertLimit: 8 };

describe('traceLevel', () => {
  it('is zero with nothing at risk on a quiet server', () => {
    expect(traceLevel(CALM)).toBe(0);
  });

  it('rises as more blocks are at risk', () => {
    expect(traceLevel({ ...CALM, blocksAtRisk: 8 })).toBeGreaterThan(traceLevel({ ...CALM, blocksAtRisk: 3 }));
  });

  it('rises as the next roll gets more likely to miss', () => {
    expect(traceLevel({ ...CALM, blocksAtRisk: 5, safeChance: 0.5 })).toBeGreaterThan(traceLevel({ ...CALM, blocksAtRisk: 5, safeChance: 0.9 }));
  });

  it('carries some tension from the server alert alone', () => {
    expect(traceLevel({ ...CALM, alert: 8 })).toBeGreaterThan(0);
  });

  it('never goes above one', () => {
    expect(traceLevel({ blocksAtRisk: 100, safeChance: 0, alert: 20, alertLimit: 8 })).toBe(1);
  });
});
