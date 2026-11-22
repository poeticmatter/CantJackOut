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
npm run calibrate [bias|servers|generation|meta N]   # balance tools
```

## Architecture

A single-player, push-your-luck browser game in plain TypeScript and Vite, with no framework and no backend. Live at https://poeticmatter.github.io/CantJackOut/.

- `src/game/`: pure rules. All state is an immutable `CampaignState`; actions are functions from state to new state. Randomness comes from a seeded generator whose state lives in the campaign (`withRng`), so saves are deterministic.
  - `dice.ts`, `roll.ts`, `server.ts`, `run.ts`: dice, how a roll feeds files, servers, and a single run's state machine.
  - `campaign.ts`, `actions.ts`, `dawn.ts`, `shop.ts`: the campaign, run actions, Vesna's dawn payment, and the market and loadout.
  - `policy.ts`, `difficulty.ts`, `board.ts`: the reference push-your-luck player, simulated difficulty, and server generation and pricing.
- `src/ui/`: DOM views built with the small `el()` helper. `app.ts` routes between screens; `runScreen.ts` stays mounted during a run so its dice animations aren't restarted.
- `src/sim/`: balance scripts run with `tsx`.

Server payouts are priced by simulating the reference player with the starting dice. After any change to dice, clock or server rules, rerun `npm run calibrate generation` and `npm run calibrate meta 100`, and record the results in the design log.

## Rules document and design log

Claude keeps two documents in `docs/` and updates them in the same change as the work they describe, without being asked:

- **`docs/rules.md`**: the game's rules as it plays them now, in plain language, as a new player would read them: what you're trying to do, what's on the table, setup, a run, how it ends. No code names, file paths or jargon. Every change to the rules or content (including prices, timings and Vesna's schedule) updates it, so it always matches the game.
- **`docs/design-log.md`**: what changed and why, newest first, in two sections:
  - **Game design**: the game itself: rules, content (dice, servers, programs, numbers) and balance.
  - **Game development**: everything else: the screens, visuals and sound, tooling, and fixes that don't change the rules.

  One entry per change, headed by its date and a short title, in the section it belongs to; a change that does both gets an entry in each. Say what changed for players and, when it's known, why. Leave how it was built to the commits.

## Playtests

The owner's playtest feedback is playtester feedback; Claude owns the design. Record each round in `playtest/` before changing code, then propose changes.
