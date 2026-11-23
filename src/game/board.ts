import { createStandardDie } from './dice';
import { FILE_IDS, type FileId } from './files';
import { DICE_PER_ROLL, chanceAnyPairFor } from './pairing';
import { type Rng, pickRandom, pickWeighted } from './random';
import type { Server, ServerFile, ServerModifier } from './server';

export const BOARD_SIZE = 6;
export const MAX_TIER = 5;

/**
 * Blocks per file on a tier 5 server, on Can't Stop's scale. Can't Stop's column heights rise
 * almost linearly with how often a column can be advanced (3 steps at 13%, 5 at 23%, 13 at 64%);
 * these follow the same line through each file's chance to be in at least one split of 4 dice.
 * R+B is offered 23.3% of the time, exactly like Can't Stop's 3 and 11 columns, so it gets their 5.
 */
const FULL_LENGTH: Record<FileId, number> = { RB: 5, RG: 8, RY: 8, BG: 8, BY: 8, GY: 12 };
/** Lower tiers are smaller copies of the same shape. */
const LENGTH_SCALE_BY_TIER: Record<number, number> = { 1: 0.4, 2: 0.55, 3: 0.7, 4: 0.85, 5: 1 };
/** Each file varies by up to this much either way, so servers of a tier differ in shape. */
const LENGTH_JITTER = { low: 0.8, high: 1.25 } as const;
const MIN_FILE_LENGTH = 2;

/**
 * First-guess prices, not tuned by simulation yet: a file pays for the rolls it should take,
 * which is its length divided by how often a roll offers it.
 */
const DOLLARS_PER_EXPECTED_ROLL = 10;
/** Harder tiers pay more for the same work, which is what makes them worth the risk. */
const PAY_MULTIPLIER_BY_TIER: Record<number, number> = { 1: 1.0, 2: 1.25, 3: 1.55, 4: 1.9, 5: 2.3 };
const PRICE_ROUNDING = 10;

/** First guess: one visit of alert room for every three blocks on the server. */
const BLOCKS_PER_ALERT = 3;
const MIN_ALERT_LIMIT = 6;

const MODIFIER_CHANCE_BY_TIER: Record<number, number> = { 1: 0, 2: 0.2, 3: 0.35, 4: 0.5, 5: 0.65 };

const STANDARD_ROLL = Array.from({ length: DICE_PER_ROLL }, (_, index) => createStandardDie(`standard-${index}`));
/** Each file's chance to be offered by a roll of the standard dice. */
export const FILE_AVAILABILITY: Record<FileId, number> = Object.fromEntries(
  FILE_IDS.map((id) => [id, chanceAnyPairFor(STANDARD_ROLL, [id])]),
) as Record<FileId, number>;

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

export function tierWeightsForNight(night: number): ReadonlyArray<readonly [number, number]> {
  const topTier = Math.min(MAX_TIER, 1 + Math.floor(night / 2));
  return Array.from({ length: topTier }, (_, index) => {
    const tier = index + 1;
    return [tier, tier === topTier ? 3 : tier === topTier - 1 ? 2 : 1] as const;
  });
}

export function filePayout(id: FileId, length: number, tier: number): number {
  const expectedRolls = length / FILE_AVAILABILITY[id];
  const price = expectedRolls * DOLLARS_PER_EXPECTED_ROLL * PAY_MULTIPLIER_BY_TIER[tier];
  return Math.round(price / PRICE_ROUNDING) * PRICE_ROUNDING;
}

function draftFile(id: FileId, tier: number, rng: Rng): ServerFile {
  const jitter = LENGTH_JITTER.low + rng.next() * (LENGTH_JITTER.high - LENGTH_JITTER.low);
  const length = Math.max(MIN_FILE_LENGTH, Math.round(FULL_LENGTH[id] * LENGTH_SCALE_BY_TIER[tier] * jitter));
  return { id, length, banked: 0, payout: filePayout(id, length, tier) };
}

export function generateServer(id: string, tier: number, rng: Rng): Server {
  const files = FILE_IDS.map((fileId) => draftFile(fileId, tier, rng));
  const totalBlocks = files.reduce((sum, file) => sum + file.length, 0);
  return {
    id,
    name: pickRandom(rng, NODES),
    corp: pickRandom(rng, CORPS),
    tier,
    files,
    modifiers: rollModifiers(tier, rng),
    isRevealed: false,
    alert: 0,
    alertLimit: Math.max(MIN_ALERT_LIMIT, Math.ceil(totalBlocks / BLOCKS_PER_ALERT)),
  };
}

function rollModifiers(tier: number, rng: Rng): ServerModifier[] {
  if (rng.next() >= MODIFIER_CHANCE_BY_TIER[tier]) return [];
  return [pickWeighted<ServerModifier>(rng, [['blackIce', 1], ['tracer', 1]])];
}

export function generateServerForNight(id: string, night: number, rng: Rng): Server {
  return generateServer(id, pickWeighted(rng, tierWeightsForNight(night)), rng);
}
