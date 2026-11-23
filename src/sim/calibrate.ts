/**
 * Tunes the reference risk appetite and shows how long servers take with the starting rig.
 * Targets from `npm run stats`: ~3.6 turns per Can't Stop column, ~20% of turns bust.
 * Run with: npm run calibrate
 */
import type { Color } from '../game/dice';
import { averageDownload } from '../game/difficulty';
import { generateServer } from '../game/board';
import { createRng } from '../game/random';
import type { Server, ServerModifier } from '../game/server';
import { playCampaign } from './metaBot';

const TRIALS = 3000;

function testServer(tracks: [Color, number][], modifiers: ServerModifier[] = []): Server {
  return {
    id: tracks.map(([color, length]) => `${color}${length}`).join('+') + modifiers.map((m) => `:${m}`).join(''),
    name: 'test',
    corp: 'test',
    tier: 1,
    reward: 0,
    tracks: tracks.map(([color, length]) => ({ color, length, banked: 0 })),
    modifiers,
    isRevealed: true,
    alert: 0,
    alertLimit: Number.MAX_SAFE_INTEGER,
  };
}

function describe(server: Server, riskAppetite?: number): string {
  const result = averageDownload(server, TRIALS, 7, riskAppetite);
  const flatlineRate = (result.flatlines / result.runs) * 100;
  return `${server.id.padEnd(22)} runs ${result.runs.toFixed(2).padStart(5)}  minutes ${result.minutes.toFixed(0).padStart(4)}  flatlined ${flatlineRate.toFixed(0).padStart(2)}%`;
}

const GENERATED_PER_TIER = 30;

function reportGeneration(): void {
  const rng = createRng(99);
  for (let tier = 1; tier <= 5; tier++) {
    const started = performance.now();
    const servers = Array.from({ length: GENERATED_PER_TIER }, (_, index) =>
      generateServer(`t${tier}-${index}`, tier, rng, { allowsLoneRed: true }));
    const msEach = (performance.now() - started) / servers.length;
    const measured = servers.map((server) => ({ server, ...averageDownload(server, 400, 3) }));
    const runs = measured.map((entry) => entry.runs).sort((a, b) => a - b);
    const rewards = servers.map((server) => server.reward).sort((a, b) => a - b);
    const limits = servers.map((server) => server.alertLimit).sort((a, b) => a - b);
    const shapes = new Set(servers.map((server) => server.tracks.map((track) => track.color[0] + track.length).join('+')));
    const loneRed = measured.filter((entry) => entry.server.tracks.length === 1 && entry.server.tracks[0].color === 'red');
    const loneRedRate = loneRed.length === 0
      ? 'none'
      : `$${(loneRed.reduce((sum, entry) => sum + entry.server.reward / entry.minutes, 0) / loneRed.length).toFixed(2)}/min over ${loneRed.length}`;
    console.log(
      `tier ${tier}: runs ${runs[0].toFixed(1)}-${runs[runs.length - 1].toFixed(1)} (median ${runs[Math.floor(runs.length / 2)].toFixed(1)})` +
        `  reward $${rewards[0]}-$${rewards[rewards.length - 1]}  alert limit ${limits[0]}-${limits[limits.length - 1]}` +
        `  lone red ${loneRedRate}  ${msEach.toFixed(0)}ms each\n        e.g. ${[...shapes].slice(0, 6).join(', ')}`,
    );
  }
}

function reportCampaigns(): void {
  const games = Number(process.argv[3] ?? 200);
  const results = Array.from({ length: games }, (_, index) => playCampaign(1000 + index));
  const wins = results.filter((result) => result.outcome === 'won').length;
  const lossesByNight = new Map<number, number>();
  for (const result of results) {
    if (result.outcome === 'lost') lossesByNight.set(result.nightReached, (lossesByNight.get(result.nightReached) ?? 0) + 1);
  }
  const average = (pick: (result: (typeof results)[number]) => number) =>
    (results.reduce((total, result) => total + pick(result), 0) / games).toFixed(2);
  console.log(`win rate ${((wins / games) * 100).toFixed(0)}%  strikes ${average((result) => result.strikes)}  servers cracked ${average((result) => result.serversCracked)}`);
  const losses = [...lossesByNight].sort((a, b) => a[0] - b[0]).map(([night, count]) => `${night}:${count}`);
  console.log(`losses by night: ${losses.join(' ')}`);
}

const mode = process.argv[2] ?? 'servers';
if (mode === 'generation') {
  reportGeneration();
} else if (mode === 'meta') {
  reportCampaigns();
} else if (mode === 'bias') {
  const probes = [testServer([['red', 4]]), testServer([['blue', 8]]), testServer([['green', 12]]), testServer([['red', 3], ['blue', 6]])];
  for (const bias of [0.6, 0.8, 1, 1.25, 1.5, 2]) {
    console.log(`\nrisk appetite ${bias}`);
    for (const server of probes) console.log('  ' + describe(server, bias));
  }
} else {
  const specs: [Color, number][][] = [
    [['red', 3]], [['red', 4]], [['red', 5]], [['red', 6]],
    [['blue', 6]], [['blue', 8]], [['blue', 10]], [['blue', 12]],
    [['green', 9]], [['green', 12]], [['green', 15]], [['green', 18]],
    [['red', 3], ['blue', 6]], [['red', 4], ['green', 10]], [['blue', 8], ['green', 12]],
    [['red', 5], ['blue', 10]], [['red', 6], ['green', 15]], [['blue', 12], ['green', 18]],
  ];
  for (const spec of specs) console.log(describe(testServer(spec)));
  console.log(describe(testServer([['blue', 8]], ['blackIce'])));
  console.log(describe(testServer([['blue', 8]], ['tracer'])));
}
