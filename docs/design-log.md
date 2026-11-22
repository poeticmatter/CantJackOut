# Design log

What changed and why, newest first. **Game design** is the game itself: rules, content and balance. **Game development** is everything else: the screens, visuals and sound, tooling, and fixes that don't change the rules. A change that does both has an entry in each.

## Game design

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
