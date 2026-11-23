# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm test           # vitest: rules tests plus a headless UI smoke test (jsdom)
npm run build      # typecheck and production build
npm run deploy     # build and publish to GitHub Pages (gh-pages branch)
npm run stats      # exact Can't Stop statistics, the calibration target
npm run stats:pairing  # exact odds for the dice-pairing experiment (files offered, jackpot, three-stream survival)
npm run calibrate [servers|meta N]   # reference-bot reports (information only during the pairing experiment)
```

## Architecture

A single-player, push-your-luck browser game in plain TypeScript and Vite, with no framework and no backend. Live at https://poeticmatter.github.io/CantJackOut/.

- `src/game/`: pure rules. All state is an immutable `CampaignState`; actions are functions from state to new state. Randomness comes from a seeded generator whose state lives in the campaign (`withRng`), so saves are deterministic.
  - `dice.ts`, `files.ts`, `pairing.ts`, `roll.ts`, `server.ts`, `run.ts`: dice, the six two-color files, splitting four dice into pairs (streams, jackpots, misses, exact odds), a roll, servers, and a single run's state machine.
  - `campaign.ts`, `actions.ts`, `dawn.ts`, `shop.ts`: the campaign, run actions, Vesna's dawn payment, and the market and loadout.
  - `policy.ts`, `difficulty.ts`, `board.ts`: the reference player (split choice and push rule), simulated difficulty, and server generation and first-guess pricing.
- `src/ui/`: DOM views built with the small `el()` helper. `app.ts` routes between screens and keeps open overlays mounted; `runScreen.ts` stays mounted during a run so its dice animations aren't restarted. `handshake.ts` and `fx.ts` are the run's connection sequence and particles; `tension.ts` turns blocks at risk, miss odds and alert into a 0-1 trace that `atmosphere.ts` feeds to the cyberspace canvas (`cyberspace.ts`), stream lines, vignette and heartbeat; `flatline.ts` and `bankStream.ts` play the run's two endings; `characterCall.ts` shows Vesna and Moth as lit silhouettes: hand-drawn SVGs in `src/assets/` whose classed parts (`portrait-eye`, `portrait-bulb`, `portrait-blinds`) are animated by `characters.css`.
- `src/sim/`: balance scripts run with `tsx`.

During the dice-pairing experiment, file lengths and prices come from tables in `board.ts` (first guesses), not from simulation. The owner asked not to retune anything from bot simulations until they have playtested it.

## Rules document and design log

Claude keeps two documents in `docs/` and updates them in the same change as the work they describe, without being asked:

- **`docs/rules.md`**: the game's rules as it plays them now, in plain language, as a new player would read them: what you're trying to do, what's on the table, setup, a run, how it ends. No code names, file paths or jargon. Every change to the rules or content (including prices, timings and Vesna's schedule) updates it, so it always matches the game.
- **`docs/design-log.md`**: what changed and why, newest first, in two sections:
  - **Game design**: the game itself: rules, content (dice, servers, programs, numbers) and balance.
  - **Game development**: everything else: the screens, visuals and sound, tooling, and fixes that don't change the rules.

  One entry per change, headed by its date and a short title, in the section it belongs to; a change that does both gets an entry in each. Say what changed for players and, when it's known, why. Leave how it was built to the commits.

## Playtests

The owner's playtest feedback is playtester feedback; Claude owns the design. Record each round in `playtest/` before changing code, then propose changes.
