import type { Color } from './dice';
import { averageDownload } from './difficulty';
import { type Rng, pickRandom, pickWeighted, randomInt } from './random';
import type { Server, ServerModifier, Track } from './server';

export const BOARD_SIZE = 6;
export const MAX_TIER = 5;

/**
 * Tier windows in reference-rig runs. Tier 1 matches one Can't Stop column (~3.6 turns);
 * tier 4 is roughly a whole solo Can't Stop game (~11 turns).
 */
const TIER_RUN_WINDOWS: Record<number, readonly [number, number]> = {
  1: [2.4, 3.8],
  2: [3.8, 5.5],
  3: [5.5, 7.5],
  4: [7.5, 10.5],
  5: [10.5, 14],
};

/** Harder tiers pay more per minute, which is what makes upgrading worth it. */
const PAY_PER_MINUTE: Record<number, number> = { 1: 1.0, 2: 1.25, 3: 1.55, 4: 1.9, 5: 2.3 };
const MODIFIER_CHANCE_BY_TIER: Record<number, number> = { 1: 0, 2: 0.2, 3: 0.35, 4: 0.5, 5: 0.65 };

/** Steps per file at tier 1; later tiers scale these up. Green is long because it is easy to push. */
const BASE_LENGTH: Record<Color, number> = { red: 3, blue: 6, green: 12 };
const PRICING_TRIALS = 300;
const GENERATION_ATTEMPTS = 40;

const CORPS = [
  'Halcyon Biotech', 'Morrow-Kade', 'Sable Mutual', 'Ninefold Logistics', 'Ouro Dynamics',
  'Lattice Savings', 'Verdigris Pharma', 'Kessler Broadcast', 'Tsunagi Freight', 'Paragon Civic',
  'Aster & Vane', 'Hollow Pine Security', 'Meridian Orbital', 'Cinder Agritech', 'Quill Reinsurance',
];
const NODES = [
  'payroll mirror', 'R&D vault', 'mail spool', 'cold archive', 'board minutes', 'patent cache',
  'client ledger', 'audit trail', 'dev sandbox', 'HR records', 'shipping manifests', 'black budget',
  'security footage', 'prototype schematics', 'offshore books', 'trial data',
];

type ColorPattern = readonly Color[];
const SINGLE_FILE: readonly ColorPattern[] = [['red'], ['blue'], ['green']];
const TWO_FILES: readonly ColorPattern[] = [['red', 'blue'], ['red', 'green'], ['blue', 'green']];

export function tierWeightsForNight(night: number): ReadonlyArray<readonly [number, number]> {
  const topTier = Math.min(MAX_TIER, 1 + Math.floor(night / 2));
  return Array.from({ length: topTier }, (_, index) => {
    const tier = index + 1;
    return [tier, tier === topTier ? 3 : tier === topTier - 1 ? 2 : 1] as const;
  });
}

export function generateServer(id: string, tier: number, rng: Rng): Server {
  const [minRuns, maxRuns] = TIER_RUN_WINDOWS[tier];
  const windowCenter = (minRuns + maxRuns) / 2;
  let closest: { server: Server; minutes: number; distance: number } | null = null;
  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const draft = draftServer(id, tier, rng);
    const result = averageDownload(draft, PRICING_TRIALS, randomInt(rng, 1, 1_000_000));
    const distance = Math.abs(result.runs - windowCenter);
    if (closest === null || distance < closest.distance) closest = { server: draft, minutes: result.minutes, distance };
    if (result.runs >= minRuns && result.runs <= maxRuns) break;
  }
  if (closest === null) throw new Error(`Could not generate a tier ${tier} server`);
  return { ...closest.server, reward: priceServer(tier, closest.minutes) };
}

export function priceServer(tier: number, expectedMinutes: number): number {
  return Math.max(50, Math.round((expectedMinutes * PAY_PER_MINUTE[tier]) / 10) * 10);
}

function draftServer(id: string, tier: number, rng: Rng): Server {
  const twoFileChance = Math.min(0.7, 0.2 + tier * 0.12);
  const pattern = pickRandom(rng, rng.next() < twoFileChance ? TWO_FILES : SINGLE_FILE);
  const scale = 1 + (tier - 1) * (pattern.length === 1 ? 0.62 : 0.36);
  const tracks: Track[] = pattern.map((color) => ({
    color,
    length: Math.max(2, Math.round(BASE_LENGTH[color] * scale * (0.8 + rng.next() * 0.5))),
    banked: 0,
  }));
  return {
    id,
    name: pickRandom(rng, NODES),
    corp: pickRandom(rng, CORPS),
    tier,
    reward: 0,
    tracks,
    modifiers: rollModifiers(tier, rng),
    isRevealed: false,
  };
}

function rollModifiers(tier: number, rng: Rng): ServerModifier[] {
  if (rng.next() >= MODIFIER_CHANCE_BY_TIER[tier]) return [];
  return [pickWeighted<ServerModifier>(rng, [['blackIce', 1], ['tracer', 1]])];
}

export function generateServerForNight(id: string, night: number, rng: Rng): Server {
  return generateServer(id, pickWeighted(rng, tierWeightsForNight(night)), rng);
}
