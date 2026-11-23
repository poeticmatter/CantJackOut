# Design log

What changed and why, newest first. **Game design** is the game itself: rules, content and balance. **Game development** is everything else: the screens, visuals and sound, tooling, and fixes that don't change the rules. A change that does both has an entry in each.

## Game design

### 2026-11-23: Dice pairing, second version: four colors, three streams and a jackpot
The owner revised the pairing experiment below, and this version replaces it. The 3-color version is kept in git history.
- **Dice:** four colors. Every die is the same: 1 red, 1 blue, 2 green and 2 yellow faces.
- **Files:** a file is a pair of two different colors, so there are exactly six: R+B, R+G, R+Y, B+G, B+Y, G+Y. Two dice of the same color never pair.
- **Streams:** a run can work on 3 files, like Can't Stop's three runners. With four colors and no same-color files, no set of three can be held forever: the best is 86%. In the 3-color version, RR+BB+GG never missed.
- **Jackpot:** when all four dice match, the player puts one block in any file they could legally advance.

The owner decided again on payment per finished file and no dice upgrades. They added that an upgrade must never change the odds of a miss, which rules out any die with a different color mix. The stake stays gone, and reroute frees every stream. Splice stays off.

**Exact odds** for four dice (`npm run stats:pairing`):
- **Chance each file is in at least one split:** R+B 23.30%; R+G, R+Y, B+G and B+Y 38.27% each; G+Y 61.73%. These match the owner's figures.
- **Jackpot:** 34 in 1,296 rolls, or 2.62%.
- **The first roll always places something:** four dice either show two different colors, which can always be paired, or are a jackpot.

Survival with three open streams, from pairs alone and then counting the jackpot. The pairs-alone range is 51.7% to 86.4% with a median of 76.5%, matching the owner's estimate of about 52% to 86%, median 77%. The jackpot adds 2.62 points to every set, for 54.3% to 89.0%, median 79.2%:
- **86.4% / 89.0%:** G+Y with R+G and R+Y, with R+G and B+Y, with R+Y and B+G, or with B+G and B+Y.
- **82.6% / 85.2%:** R+B and G+Y with any of the four middle files.
- **79.0% / 81.6%:** G+Y with R+G and B+G, or with R+Y and B+Y.
- **74.1% / 76.7%:** any three of the four middle files.
- **70.2% / 72.8%:** R+B with one middle file that has red and one that has blue.
- **51.7% / 54.3%:** R+B with R+G and R+Y, or with B+G and B+Y.

**Base lengths.** Can't Stop's column heights rise almost linearly with how often a column can be advanced. R+B is offered 23.3% of the time, exactly as often as Can't Stop's 3 and 11 columns, so it gets their 5 steps. The middle files at 38% get 8, and G+Y at 62% gets 12, just short of the 7 column's 13 at 64%. Length divided by availability comes out at 19 to 22 for every file, so each takes about the same number of offered rolls. Those are the tier 5 sizes. Lower tiers are scaled-down copies (×0.4, 0.55, 0.7, 0.85 and 1 for tiers 1 to 5), so a tier 1 server is typically R+B 2, middle files 3 and G+Y 5, 19 blocks in all. Each file varies between ×0.8 and ×1.25, with a minimum of 2 blocks.

**First-guess prices, not tuned.** As in the first version:
- A file pays $10 × (length ÷ chance it's offered) × the tier multiplier, rounded to $10. A typical tier 1 server is worth about $490 and tier 5 about $2,860.
- A server's alert limit is a third of its blocks, at least 6.
- Vesna's cut, reroute and program prices are unchanged.

**What the reference bot says, for information only.** On a fresh tier 1 server the bot banks about 4.6 blocks per run, rolls 3.2 times and flatlines 8% of runs. With no alert limit it downloads a whole tier 1 server in about 13 runs (about 820 minutes), roughly $0.60 a minute. The first-guess alert limit of 7 sits well below those 13 runs, so the bot gets purged over and over and needs about 43 runs. Watch for that in play: the alert rule looks too tight for six-file servers, and the pay rate is below the old game's $1 a minute.

### 2026-11-23: Experiment: multi-colour files and dice pairing (first version, replaced)
The owner's proposal to bring Can't Stop's core decision into the game. It is built on its own branch so it can be playtested against the old game. The owner made three decisions:
- **Streams:** a run can work on 2 files, not 3. With 3 streams, holding RR, BB and GG could never miss: 4 dice in 3 colors always contain a same-color pair. Most other sets of three also sat above 90%. Two streams give 43% to 93%, almost exactly Can't Stop's 44% to 92% for three runners.
- **Payment:** each file pays when it's finished. The server leaves once all six are sold.
- **Dice:** no dice upgrades for this experiment. Four standard dice (still 1 red, 2 blue, 3 green) all game. Custom dice, sockets and special faces are switched off, and the market sells only programs and program slots.

The rules: every server has all six two-color files (RR, RB, RG, BB, BG, GG). Each roll of 4 dice offers its 3 possible splits into two pairs. Every usable pair in the chosen split downloads a block of its file, both pairs on the same file included. A pair is unusable if its file is full or it would need a third stream. When both pairs would each open a stream but only one is free, the player picks one. A miss is a roll with no usable pair anywhere. The stake rule is gone, since a fresh run can't miss its first roll. Reroute now also frees both streams, which makes it Can't Stop's "end your turn" without the handshake. A purge wipes only unfinished files, because sold ones are already paid for. Splice is switched off because "reroll the idle dice" has no clean meaning once dice are paired. Bounce, Failsafe, Proxy chain and Deep scan carry over unchanged.

**Exact odds** for 4 standard dice (`npm run stats:pairing`). Chance each file is in at least one of the three splits: RR 13.2%, RB 38.3%, BB 40.7%, RG 46.8%, GG 68.7%, BG 74.1%. Chance the next roll isn't a miss with two streams: BB+GG and BG+GG 92.8%, RB+GG 90.4%, RG+BG 87.5%, RG+GG 86.3%, RR+BG 81.7%, BB+BG 79.6%, RB+BG 79.0%, RR+GG 77.8%, RG+BB 76.4%, RB+BB 63.6%, RR+BB 52.1%, RB+RG 51.7%, RR+RG 49.3%, RR+RB 43.4%. For three files (Can't Stop's runner count, kept for comparison): RR+BB+GG 100%, RG+BB+GG 99.3%, RB+BB+GG 99.0%, BB+BG+GG 98.4%, RB+BG+GG 97.8%, RR+BG+GG 96.3%, RG+BG+GG 93.7%, RG+BB+BG 93.1%, RB+RG+BG 92.4%, RR+RB+GG 91.4%, RB+RG+GG 91.3%, RR+RG+BG 90.0%, RR+RG+GG 88.9%, RR+BB+BG 85.4%, RR+RB+BG 84.2%, RB+BB+BG 80.2%, RR+RG+BB 77.1%, RB+RG+BB 77.0%, RR+RB+BB 68.7%, RR+RB+RG 51.8%.

**Base lengths.** Can't Stop's column heights rise almost linearly with how often a column can be advanced: 3 steps at 13.2% up to 13 at 64.4%. The same line, run through each file's chance, gives the tier 5 sizes RR 3, RB 8, BB 8, RG 10, GG 15, BG 16. Length divided by availability then comes out at 20 to 23 for every file, so each file takes about the same number of offered rolls, as in Can't Stop. Lower tiers are scaled-down copies (×0.4, 0.55, 0.7, 0.85 and 1 for tiers 1 to 5). Each file varies by ×0.8 to ×1.25 so servers of a tier differ in shape. No file is shorter than 2 blocks, which leaves RR relatively hard on tiers 1 to 3.

**First-guess prices, not tuned.** These are placeholders for the owner's playtest. They were not tuned by simulation:
- A file pays $10 × (length ÷ chance it's offered) × a tier multiplier (1, 1.25, 1.55, 1.9, 2.3), rounded to $10. That's about $560 for a typical tier 1 server and $2,940 for tier 5.
- A server's alert limit is a third of its blocks, at least 6.
- Starting cash is back to $100, since the $2,000 was only there to try out the dice for sale.
- Vesna's cut, reroute prices and program prices are unchanged from the old game.

**What the reference bot says, for information only.** The bot's split choice and push rule are new and rough, so nothing has been tuned from them. On a fresh tier 1 server it banks about 4 blocks per run, rolls 3.2 times and flatlines 18% of runs. Downloading a whole tier 1 server takes it about 20 runs (about 1,270 minutes) with no alert limit, mostly the long tail of chasing the last rare files. That's about $0.45 a minute against the old game's $1. With the first-guess alert limits it gets purged repeatedly and needs about 47 runs. Watch in play whether purges or the pay rate feel punishing. The likely fixes are higher alert limits and higher prices, but the playtest comes first.

### 2026-11-23: Dice for sale, tuned by simulation
Each die was added as a fourth die beside three standard ones, and the reference player timed on five test servers (red 3, blue 5, green 20, red 2 + blue 4, blue 6 + green 16). The first prices were off: Bulwark's two Firewall faces made it best almost everywhere, Surge was worse than a standard die at more than twice the price, Anchor and Payroll were slow, and Prism played the same as Switchback. Bulwark now has one Firewall face ($320); Surge, Anchor and Payroll carry five working faces instead of three or four ($340, $260, $200); Prism has three wild faces and is the premium all-rounder ($480); a Standard die costs $200. The specialists stay as they were: Crimson cuts a lone red server from about 380 minutes to 140, Cobalt a lone blue one from about 290 to 100, and each does nothing on other colors. The simulation doesn't value Anchor's safety or Payroll's cash, so watch those two in play.

### 2026-11-23: Custom dice instead of reflashing faces
Playtest round 2 found a broken strategy: reflash a die to all green and a green file can never miss, so with enough green dice nothing on a green server can catch you. Faces can no longer be changed. Moth sells finished dice instead, and every one of them hits any single color at most half the time, with blank faces paying for the strong ones (3 red and 3 blank; 2 red, 2 blue and 2 blank; two wild faces and four blanks; and so on). The new faces from round 1 (dual-color, Firewall, Payday, overclocked and anchored) now come only on these dice. A bought die drops into a free socket or waits as a spare. Prices are first guesses: the campaign bot no longer improves its dice at all (it used to flash red faces), so Vesna's schedule hasn't been re-checked against this change.

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

### 2026-11-23: The run builds tension
The owner asked for a more visually impressive run with a lot more juice. The run already reacted to single events; now it builds as you push your luck, and the server feels like a place.
- **Trace:** the more blocks you have at risk, the likelier the next roll is to miss, and the hotter the server's alert, the higher the trace. As it climbs, red closes in from the edges and starts to flicker, a heartbeat thumps faster under the run, the data falling through the server speeds up and turns red, and the camera leans in. Jacking out lets it all go with a green wash and a calm tone. The trace is presentation only; the rules never read it.
- **Inside the server:** the run plays over a grid floor running to a glowing horizon, with data falling through the dark and a scan beam sweeping the towers. Black ICE grows a red hex lattice in from the edges; a Tracer sweeps a searchlight across the room, both stronger as the trace rises. Every open stream has a live two-color data line from its tower down to the dice.
- **Rolls:** glyphs scramble over the dice as they tumble, as if being decrypted. With enough at stake, the last die hangs in the air while the others wait and the tray dims around it.
- **Hits:** each scoring die fires a beam at its tower before its blocks fly, the camera punches in, and shake and particles grow with how much was riding on the roll. Clean rolls in a row count up as a streak by the dice, each a step higher in pitch.
- **Jacking out:** every block you were holding streams up into a Secured counter that ticks up as they land.
- **Flatline:** the held blocks shatter and fall, the screen tears with color fringing, the picture collapses like an old CRT switching off, and an ECG beats twice and goes flat under FLATLINE.
- **Split cards** lean toward the pointer, catch a sheen of light, and press in when clicked.
- With reduced motion, all of it stays still.

### 2026-11-23: Vesna and Moth as noir silhouettes
From playtest round 2: the owner found Vesna's point-cloud face and Moth's emblem unpolished, and asked that Vesna not be based on their portrait at all. Of three directions mocked up (calling-card emblems, noir silhouettes and voice-only voiceprints), the owner picked the silhouettes, without the cigarette Vesna had in the mockup.
- **Vesna:** a silhouette in profile behind venetian blinds, lit cyan from the window, with an angled bob and a cybernetic eye. The eye flickers while she talks, and the picture glitches when you come up short.
- **Moth:** a hooded figure in the back room with glowing moth-eye goggles and a respirator, under a swaying bare bulb. The goggles flicker while Moth talks.
- **Drawn, not traced:** both are hand-drawn vector art, so they stay sharp at any size, and nothing made from the owner's photo ships any more.

### 2026-11-23: Four colors and the jackpot on screen
- **Yellow:** a new color with a diamond shape, so it never relies on color alone.
- **Files as two colors:** every file shows as two chips side by side, never a blend. Tower blocks and the file bars on server cards are split half and half between the file's two colors, and borders and badges use a neutral light.
- **Streams:** the console has three stream slots.
- **Split cards:** a same-color pair shows dimmed with a dashed outline, and the card says why it does nothing.
- **Jackpot:**
  - **Dice and screen:** all four dice flare in their color and burst, the screen flashes gold and shakes, a large JACKPOT rises from the dice, and stars rain down to a slot-machine run of bells.
  - **File picker:** the console swaps the split cards for a jackpot panel with an animated banner and one button per reachable file, each marked if it would open a stream. Number keys pick a file, and every reachable tower pulses gold.
  - **Blocks:** they fly from all four dice.
- **Flying blocks:** on any roll, each scoring die sends its blocks in its own color.
- **Stats:** `npm run stats:pairing` prints each file's odds, the jackpot chance, and survival for every set of three streams, with and without the jackpot.

### 2026-11-23: Dice pairing on screen
The run screen shows six towers, one per file, each with its price. Open streams are lit and labelled, and files the run can no longer reach are dimmed. The console shows both stream slots and how many are left. After a roll it replaces the roll buttons with the three splits. Each split shows its two pairs and the blocks it would add, flags any new stream it would open, and says why an idle pair does nothing. Hovering a split lifts the towers it would advance. Keys 1, 2 and 3 take a split. When a split can only take one of its pairs, its number key opens it and A or B picks the pair. On the net, each file bar on a server card shows its price, and the card shows what the server is still worth. `npm run stats:pairing` prints the exact pairing odds, and `npm run calibrate` reports on the new mechanic (modes `servers` and `meta`). Saves from before the experiment don't carry over.

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
