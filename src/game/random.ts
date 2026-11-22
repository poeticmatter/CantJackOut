/** Seedable PRNG whose state is a plain number, so it can live inside saved game state. */
export interface Rng {
  next(): number;
  readonly state: number;
}

export function createRng(seed: number): Rng {
  let state = seed | 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return state;
    },
  };
}

/** Inclusive on both ends. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

export function pickRandom<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickRandom called with an empty list');
  return items[Math.floor(rng.next() * items.length)];
}

export function pickWeighted<T>(rng: Rng, entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return entries[entries.length - 1][0];
}
