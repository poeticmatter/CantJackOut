/**
 * Shows how the reference player fares on generated servers and whole campaigns.
 * In the dice-pairing experiment these numbers are for information only: prices and
 * Vesna's cut are first guesses waiting on the owner's playtest, not tuned from this.
 * Run with: npm run calibrate [servers|meta N]
 */
import { MAX_TIER, generateServer } from '../game/board';
import { averageDownload } from '../game/difficulty';
import { createRng } from '../game/random';
import { remainingValue } from '../game/server';
import { playCampaign } from './metaBot';

const GENERATED_PER_TIER = 20;
const TRIALS_PER_SERVER = 40;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function reportServers(): void {
  const rng = createRng(99);
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const servers = Array.from({ length: GENERATED_PER_TIER }, (_, index) => generateServer(`t${tier}-${index}`, tier, rng));
    const measured = servers.map((server) => ({ server, ...averageDownload(server, TRIALS_PER_SERVER, 3) }));
    const runs = median(measured.map((entry) => entry.runs));
    const minutes = median(measured.map((entry) => entry.minutes));
    const flatlineShare = median(measured.map((entry) => entry.flatlines / entry.runs));
    const value = median(servers.map(remainingValue));
    const rate = median(measured.map((entry) => remainingValue(entry.server) / entry.minutes));
    const alert = median(servers.map((server) => server.alertLimit));
    console.log(
      `tier ${tier}: median runs ${runs.toFixed(1)}  minutes ${minutes.toFixed(0)}  flatlined ${(flatlineShare * 100).toFixed(0)}%` +
        `  value $${value}  $${rate.toFixed(2)}/min  alert limit ${alert}`,
    );
  }
}

function reportCampaigns(): void {
  const games = Number(process.argv[3] ?? 100);
  const results = Array.from({ length: games }, (_, index) => playCampaign(1000 + index));
  const wins = results.filter((result) => result.outcome === 'won').length;
  const lossesByNight = new Map<number, number>();
  for (const result of results) {
    if (result.outcome === 'lost') lossesByNight.set(result.nightReached, (lossesByNight.get(result.nightReached) ?? 0) + 1);
  }
  const average = (pick: (result: (typeof results)[number]) => number) =>
    (results.reduce((total, result) => total + pick(result), 0) / games).toFixed(2);
  console.log(`win rate ${((wins / games) * 100).toFixed(0)}%  strikes ${average((result) => result.strikes)}  files sold ${average((result) => result.filesSold)}`);
  const losses = [...lossesByNight].sort((a, b) => a[0] - b[0]).map(([night, count]) => `${night}:${count}`);
  console.log(`losses by night: ${losses.join(' ')}`);
}

const mode = process.argv[2] ?? 'servers';
if (mode === 'meta') reportCampaigns();
else reportServers();
