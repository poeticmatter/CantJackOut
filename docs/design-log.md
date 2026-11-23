# Design log

What changed and why, newest first. **Game design** is the game itself: rules, content and balance. **Game development** is everything else: the screens, visuals and sound, tooling, and fixes that don't change the rules. A change that does both has an entry in each.

## Game design

### 2026-11-23: Vesna's cut, retuned for stakes
With the stake rule, the new file lengths and the risk premium, servers pay more for the same time, and the campaign bot's win rate jumped from about 47% to 77% on the old schedule. Vesna's cut is now about 27% higher, from $200 on night 1 to $3,125 on night 10. Over 150 bot campaigns that gives a 53% win rate and 1.9 strikes on average, with losses spread from night 4 to night 10. A 20% raise left the bot at 61%; 35% dropped it to 37%.

Generated servers with the new rules, from `npm run calibrate generation`:

| Tier | Reference runs (median) | Reward | Alert limit | Lone red, per minute |
|---|---|---|---|---|
| 1 | 2.3 to 3.9 (3.4) | $150 to $320 | 5 to 8 | $1.33 |
| 2 | 3.8 to 5.9 (4.7) | $270 to $890 | 8 to 12 | none generated |
| 3 | 5.6 to 7.8 (6.0) | $570 to $1,080 | 11 to 16 | $2.07 |
| 4 | 7.4 to 10.6 (8.4) | $920 to $2,280 | 16 to 22 | none generated |
| 5 | 9.5 to 15.9 (13.2) | $1,530 to $4,020 | 22 to 33 | $3.20 |

### 2026-11-23: Four new kinds of face
From playtest round 1 ("there can be more dice sides"). Moth's bench sells:
- **Dual-color** faces match either of two colors and go to whichever matching file needs more. Each costs the two colors' prices added together ($180 to $370), which sits between a single color and wild ($600).
- **Firewall** faces never download, but showing on a miss blocks it. It's a per-die, always-on cousin of Bounce: weaker per miss, but it never runs out ($350).
- **Payday** faces never download, but pay $15 every time they show. Money now, at the price of a face that can't hit ($200).
- **Anchor** is an upgrade for a face that downloads, like Overclock: its blocks are banked on the spot ($300).

None of these prices are tuned yet: the campaign bot doesn't buy them. Watch in playtest whether Payday pays for itself too fast early on, and whether Firewall makes Bounce pointless.

### 2026-11-23: Server alert
From playtest round 1, which asked for another kind of pressure alongside the clock and Vesna. Every server has an alert meter: a visit adds one, a flatline adds one more, and if it's full when a run ends the sysadmin purges everything banked there. Each server's limit is set from simulation at one and a half times what the reference player usually needs, so purges punish banking after every hit and camping on one server, not normal play. Limits run from 5 visits on small servers to about 30 on the biggest. Rerouting doesn't count as a new visit. The purge is part of each server's price.

### 2026-11-23: Reroute
From playtest round 1: instead of jacking out and back in, you can pay to bank what's at risk and stay connected. It costs 15 minutes, against an average 45-minute handshake, plus $30 to $70 by server tier, roughly what the 30 minutes it saves are worth at that tier. So rerouting is a choice between time and cash, and which is tighter changes over the night. A fresh stake goes at risk straight away, so a reroute never makes the next roll free.

### 2026-11-23: A stake on every run, and red files that pay for their risk
Playtest round 1 found the first rolls of a run meaningless: with the safe opening roll, a miss before you'd downloaded anything only cost time, so you simply rolled until you hit. Now every unfinished file starts each run with one block at risk: a free one if nothing of that file is banked, otherwise the last banked block. A miss on the very first roll costs something, and every return visit has a stake. This replaces the safe opening roll.

The stake changes the colors very differently. A lone red file hits only 42% of rolls with the starting dice, so risking a block on every run makes it drift backwards: a red 4-block server went from about 190 minutes to about 800, and a cautious player could never finish it. Blue roughly doubled; green barely changed. Generation, which sizes servers to fit each tier's run window, ended up making almost nothing but green servers. So:
- File lengths are retuned for the stake: red starts at 2 blocks and grows slowly with tier (each extra red block now costs far more runs than the last), blue starts at 3, green stays at 12. Every combination of files shows up again.
- Lone red files only appear from night 3, once the player has had time to upgrade.
- Servers that flatline the reference player more than 30% of the time pay a premium for the risk. A lone red file flatlines about 57% of runs and now pays about a third more per minute than the base rate for its tier, which answers the playtest note that an all-red file paid too little for how hard it is.

### 2026-11-22: Vesna's cut, strikes and ten nights
The metagame is a debt: Vesna's cut is due at every dawn and grows from $150 to $2,450 over ten nights. Coming up short costs all your cash and a strike, not the game, so one bad night doesn't force a desperate all-in push. Three strikes lose. The first schedule (rising to $3,000) let a simple bot win only 29% of games, with losses piling up in the last two nights. The softer schedule gives that bot about 47%; it never re-tunes its dice and ignores most programs, so a thoughtful player should do better. Most of its games still pick up one or two strikes, so the pressure holds to the end.

### 2026-11-22: A night clock with a random handshake
Each run costs a random 30 to 60 minutes to connect, 4 minutes per roll and 20 to 40 minutes after getting caught. The fixed cost of a run stops "roll once, jack out, repeat" from paying off. Its randomness means you never know for sure which run before 06:00 is your last, so "it's my final run, so push no matter what" never becomes a certain, thoughtless situation. Any run started before dawn finishes.

### 2026-11-22: The market: sockets, programs and a dice lab
Getting stronger means more dice (up to six), more program slots (up to three), five programs and a lab for reflashing single faces. Reflashing is a trade-off: a red face helps on red files but leaves fewer faces for the other colors. Rewards are always priced against the starting dice, so every upgrade raises what you earn per hour. Harder servers also pay more per minute, which is the reason to take them on.

### 2026-11-22: Hidden servers, priced by simulation
A server's files stay hidden until you connect (or run Deep scan); the payout is the only hint. Each server is priced by simulating a skilled player with the starting dice, so the payout honestly tracks difficulty. Servers come in five tiers by how many runs they take: tier 1 is about one Can't Stop column (around 3 runs), and tier 4 is about a whole solo game of Can't Stop (around 9 runs). From tier 2 on, servers can carry Black ICE or a Tracer.

### 2026-11-22: A safe opening roll
A miss before you've downloaded anything this run only costs the roll's time. Without it, 58% of runs on a red server ended on the first roll, before the player had made a single choice. Can't Stop never does that, because a turn's first roll always places a runner. Once you're holding unbanked blocks, a miss jacks you out as before.

### 2026-11-22: Starting dice calibrated to Can't Stop
The starting deck has three standard dice (1 red, 2 blue, 3 green faces). Exact Can't Stop numbers:
- With three runners placed, a roll survives between 43.8% of the time (2-3-12) and 92.0% (6-7-8); the median is 79.6%.
- A solo bot using the rule of 28 needs 10.9 turns per game, or 3.6 turns per column, and 19.7% of its turns bust.

Three standard dice on a one-file server hit 42.1% (red), 70.4% (blue) and 87.5% (green), which sits inside Can't Stop's range. A one-file server that takes as long as one Can't Stop column is red 4, blue 7 or green 15. Green has to be about twice as long as the face counts suggest, because green runs can be pushed much further. Played well, 17 to 31% of runs on blue and green servers flatline, close to Can't Stop's 20% bust rate. On red, the right play with the starting dice is to bank after the first hit; that's meant as a reason to upgrade.

### 2026-11-22: Push your luck on colored files
Pick a server and roll. Every die matching an unfinished file downloads a block; jack out to bank, or keep rolling and risk losing everything unbanked. Banked progress stays on the server between runs, but only a complete download sells. A finished file stops counting as a hit, like a claimed column in Can't Stop, so pushing gets riskier near the end of a server. Servers hold one or two files. Two-file servers almost never miss until one file finishes; watch in playtest whether that stretch feels like a rush or like dead time.

## Game development

### 2026-11-23: Vesna and Moth on the line
From playtest round 1, which wanted Vesna to contact you through a cyberpunk terminal as a wireframe character. Vesna now calls on an encrypted link at the start of every night and at dawn: her face is a glowing point-cloud mesh drawn live, her jaw moves while her lines type out, she blinks and turns her head, and she glitches when you come up short. The face is built from the owner's portrait by `tools/pointcloud.py`, which samples points most densely on the features, triangulates them and writes the result to `src/assets/vesna.json`. The photo itself stays out of the repository. Drawing it live costs little, so there's no video to download, and the face can react to what's happening. The market's dice maker, Moth, gets the same treatment in amber, with a moth for an emblem.

### 2026-11-23: Moth's back room
From playtest round 1: the market lacked character, and it took a while to find out that dice could be upgraded at all. The market is now Moth's back room: her line at the top, a workbench with all your dice laid out, and every reflash option listed with its price before you pick anything. Programs are chips in a cabinet. The deck panel has an "Upgrade dice" button and a "Flash faces" button under every die, both of which open the bench with that die picked. The market also no longer replays its fade-in on every click: open overlays stay mounted while the game updates behind them.

### 2026-11-23: The handshake, and a lot more juice
From playtest round 1: jacking in landed you straight on the run screen, and a successful download didn't feel like much.
- Jacking in now plays a connection sequence: an access log types out (proxies, credentials, each ICE layer, a warning for Black ICE or a Tracer, the files found), the progress bar climbs in uneven jerks, the clock ticks through the handshake's minutes, and "Access granted" flashes. It takes 2.5 to 3.5 seconds, longer for a slower handshake, and a click or key skips it.
- On a hit, blocks fly from each die into its tower, the tower flashes and a "+N" rises over it. A file that fills bursts and says "Cracked", with its own chord. Big rolls shake the screen.
- A full download sweeps light across the screen, bursts every tower, rains dollar signs and shakes, then the result counts the payout up from zero with a tick per step.
- Stake blocks are dashed and pulse amber; blocks flash white as they're banked; at-risk blocks flicker red while you decide on a miss.
- Firewall and Payday faces get their own reactions: "Blocked" with a shield sound, "+$15" with coins.
- The console no longer jumps to the roll's result while the dice are still tumbling.

### 2026-11-23: Saves from v0.1 don't carry over
Faces, servers and runs changed shape, so the save version went up: an older save can't be loaded, and the game starts fresh.

### 2026-11-22: Published on GitHub Pages
The game is at https://poeticmatter.github.io/CantJackOut/. `npm run deploy` builds it and publishes the `gh-pages` branch.

### 2026-11-22: The rules document and this log
`docs/rules.md` describes the game as it plays now, and this log records changes in two parts. Both are kept up to date with every change.

### 2026-11-22: Sodium-vapor night
The look is a rainy city at night instead of the usual hacker green: violet ink, streetlight amber for money, time and actions, and three neon file colors, each with its own shape. The run screen is the loud part: files stand as towers of data blocks, like Can't Stop's columns, with 3D dice tumbling below them. Hits fire a beam into their tower and new blocks drop in; unbanked blocks pulse. Getting jacked out glitches the screen, and a full download lights the towers. Behind everything a skyline sits under steady rain. All sound is synthesized in the browser. Motion follows the system's reduced-motion setting.

### 2026-11-22: Saving, help and shortcuts
The game saves in the browser after every action, so a run survives a reload. The rules open on first play and stay one click away. During a run, Space rolls and J jacks out.

### 2026-11-22: Balance tools
`npm run stats` prints the exact Can't Stop numbers and runs the rule-of-28 bot. `npm run calibrate` sweeps how hard the reference player pushes, tabulates server sizes, checks that generated servers fall inside their tier, and plays whole campaigns with a bot (`npm run calibrate meta 100`).

### 2026-11-22: Started as a standalone single-player game
Can't Jack Out is single-player, so it doesn't use GameKit or the two-player game template. It's plain TypeScript and Vite, with the rules kept apart from the screens and covered by tests.
