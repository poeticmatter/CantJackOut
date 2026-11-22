# Can't Jack Out: design notes

Push-your-luck hacking game built on Can't Stop's core loop. Browser, Vite + TypeScript.

Run it with `npm install`, then `npm run dev`. Tests: `npm test`. Balance tools: `npm run stats`, `npm run calibrate [bias|servers|generation|meta N]`.

## Core loop
- Servers hold 1 or 2 files. Each file has a color and a length in blocks.
- Dice have 6 faces. A standard die has 1 red, 2 blue and 3 green faces. Every die matching an unfinished file adds 1 block (2 if the face is overclocked; wild faces match anything).
- Roll again or jack out to bank. Once you have unbanked blocks, a roll with no match flatlines you and the unbanked blocks are lost.
- **Safe opening (designer decision):** a miss with nothing unbanked only costs the roll's time. Without this, 58% of red-server runs died on the first roll, which Can't Stop never does (your first roll always places runners).
- Finished files stop counting as hits, like claimed columns, so pushing gets riskier as a server nears completion.
- Only a full download pays. A server's files are hidden until you connect; the reward is the only hint.

## Clock (anti "roll once, jack out")
- A night is 22:00 to 06:00. Each run costs a random 30–60 minute handshake, plus 4 minutes per roll, plus 20–40 minutes of dumpshock if you flatline.
- Any run started before dawn finishes. Because the handshake is random, you never know for sure which run is your last.
- Vesna's cut is due at each dawn. Short means she takes everything plus a strike; 3 strikes loses. Survive 10 nights to win.

## Can't Stop calibration (exact, from `npm run stats`)
| Can't Stop | Value |
|---|---|
| Roll survival with 3 runners | 43.8% (2-3-12) to 92.0% (6-7-8), median 79.6% |
| Rule-of-28 solo bot | 10.9 turns per game, 3.6 turns per column, 19.7% of turns bust |

| Can't Jack Out, starting rig (3 standard dice) | Value |
|---|---|
| Hit chance on a 1-file server | red 42.1%, blue 70.4%, green 87.5% |
| 1-file server equal to one Can't Stop column (~3.5 runs) | red 4, blue 7, green 15 |
| Runs that flatline, reference policy | 17–31% (red: 0%; the right play on red is to bank after the first hit) |
| Tier 1 / tier 4 servers | ~3 runs (one column) / ~9 runs (a whole solo game) |

Rewards are priced by simulating the reference policy with the starting rig, so upgrades raise your effective pay rate. Higher tiers also pay more per minute.

## Meta balance (`npm run calibrate meta 100`)
A simple bot that only buys sockets, Bounce and red faces, and never re-tunes its loadout, wins about 47% of the time, averaging 2.1 strikes. Losses are spread across nights 5–10.

## Open questions for playtest
- Two-file servers are near-safe (88–99.5% hit) until one file finishes. Is that early stretch boring, or a satisfying burst?
- Is red-only on the starting rig ("bank after the first hit") dull, or a clear signal to upgrade?
- Does the random handshake make the last run feel uncertain enough?
- The hit-chance readout is always visible. Does it help, or take away the gut-feel tension?
