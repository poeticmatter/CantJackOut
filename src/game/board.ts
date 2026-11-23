import type { Color } from './dice';
import { averageDownload } from './difficulty';
import { type Rng, pickRandom, pickWeighted, randomInt } from './random';
import { ALERT_PER_FLATLINE, ALERT_PER_VISIT, type Server, type ServerModifier, type Track } from './server';

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

/**
 * Servers that flatline the reference player more often than this pay a premium on top of
 * their time, because a swingy server is worth less to a player with a payment due at dawn.
 */
const ORDINARY_FLATLINE_SHARE = 0.3;
const RISK_PREMIUM_PER_FLATLINE_SHARE = 1;

/**
 * Blocks per file at tier 1, and how much each tier adds. Green is long because it is easy to push.
 * Red grows slowly: with a block at stake on every run, each extra red block costs far more runs than the last.
 */
const BASE_LENGTH: Record<Color, number> = { red: 2, blue: 3, green: 12 };
const GROWTH_PER_TIER: Record<Color, number> = { red: 0.25, blue: 0.62, green: 0.62 };
/** On a two-file server each file grows more slowly, since the pair shares the tier's run budget. */
const TWO_FILE_GROWTH_SHARE = 0.58;
const PRICING_TRIALS = 300;
const GENERATION_ATTEMPTS = 40;

/**
 * With a stake on every run, a lone red file drifts backwards for the starting dice (they hit
 * red 42% of the time), so lone red files wait until the player has had a couple of nights to upgrade.
 */
export const LONE_RED_FIRST_NIGHT = 3;

/** Alert room beyond what the reference player needs, so purges punish timid play, not normal play. */
const ALERT_HEADROOM = 1.5;
const MIN_ALERT_LIMIT = 4;
/** Before a server's alert limit is set, it is measured with no limit at all. */
const UNLIMITED_ALERT = Number.MAX_SAFE_INTEGER;

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
const SINGLE_FILE_WITHOUT_RED: readonly ColorPattern[] = [['blue'], ['green']];
const TWO_FILES: readonly ColorPattern[] = [['red', 'blue'], ['red', 'green'], ['blue', 'green']];

export function tierWeightsForNight(night: number): ReadonlyArray<readonly [number, number]> {
  const topTier = Math.min(MAX_TIER, 1 + Math.floor(night / 2));
  return Array.from({ length: topTier }, (_, index) => {
    const tier = index + 1;
    return [tier, tier === topTier ? 3 : tier === topTier - 1 ? 2 : 1] as const;
  });
}

export interface GenerationOptions {
  readonly allowsLoneRed: boolean;
}

export function generateServer(id: string, tier: number, rng: Rng, options: GenerationOptions): Server {
  const [minRuns, maxRuns] = TIER_RUN_WINDOWS[tier];
  const windowCenter = (minRuns + maxRuns) / 2;
  let closest: { server: Server; alert: number; distance: number } | null = null;
  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const draft = draftServer(id, tier, options, rng);
    const result = averageDownload(draft, PRICING_TRIALS, randomInt(rng, 1, 1_000_000));
    if (!Number.isFinite(result.runs)) continue;
    const distance = Math.abs(result.runs - windowCenter);
    const alert = result.runs * ALERT_PER_VISIT + result.flatlines * ALERT_PER_FLATLINE;
    if (closest === null || distance < closest.distance) closest = { server: draft, alert, distance };
    if (result.runs >= minRuns && result.runs <= maxRuns) break;
  }
  if (closest === null) throw new Error(`Could not generate a finishable tier ${tier} server`);
  const alertLimit = Math.max(MIN_ALERT_LIMIT, Math.ceil(closest.alert * ALERT_HEADROOM));
  return priceWithAlertLimit({ ...closest.server, alertLimit }, rng);
}

/** Prices the server with its alert limit in force, widening a limit too tight to finish under. */
function priceWithAlertLimit(server: Server, rng: Rng): Server {
  for (let alertLimit = server.alertLimit; ; alertLimit++) {
    const limited: Server = { ...server, alertLimit };
    const result = averageDownload(limited, PRICING_TRIALS, randomInt(rng, 1, 1_000_000));
    if (Number.isFinite(result.minutes)) {
      return { ...limited, reward: priceServer(server.tier, result.minutes, result.flatlines / result.runs) };
    }
  }
}

export function priceServer(tier: number, expectedMinutes: number, flatlineShare: number): number {
  const riskPremium = 1 + Math.max(0, flatlineShare - ORDINARY_FLATLINE_SHARE) * RISK_PREMIUM_PER_FLATLINE_SHARE;
  return Math.max(50, Math.round((expectedMinutes * PAY_PER_MINUTE[tier] * riskPremium) / 10) * 10);
}

function draftLength(color: Color, tier: number, fileCount: number, rng: Rng): number {
  const growth = GROWTH_PER_TIER[color] * (fileCount === 1 ? 1 : TWO_FILE_GROWTH_SHARE);
  const scale = 1 + (tier - 1) * growth;
  return Math.max(2, Math.round(BASE_LENGTH[color] * scale * (0.8 + rng.next() * 0.5)));
}

function draftServer(id: string, tier: number, options: GenerationOptions, rng: Rng): Server {
  const twoFileChance = Math.min(0.7, 0.2 + tier * 0.12);
  const singleFile = options.allowsLoneRed ? SINGLE_FILE : SINGLE_FILE_WITHOUT_RED;
  const pattern = pickRandom(rng, rng.next() < twoFileChance ? TWO_FILES : singleFile);
  const tracks: Track[] = pattern.map((color) => ({ color, length: draftLength(color, tier, pattern.length, rng), banked: 0 }));
  return {
    id,
    name: pickRandom(rng, NODES),
    corp: pickRandom(rng, CORPS),
    tier,
    reward: 0,
    tracks,
    modifiers: rollModifiers(tier, rng),
    isRevealed: false,
    alert: 0,
    alertLimit: UNLIMITED_ALERT,
  };
}

function rollModifiers(tier: number, rng: Rng): ServerModifier[] {
  if (rng.next() >= MODIFIER_CHANCE_BY_TIER[tier]) return [];
  return [pickWeighted<ServerModifier>(rng, [['blackIce', 1], ['tracer', 1]])];
}

export function generateServerForNight(id: string, night: number, rng: Rng): Server {
  return generateServer(id, pickWeighted(rng, tierWeightsForNight(night)), rng, { allowsLoneRed: night >= LONE_RED_FIRST_NIGHT });
}
