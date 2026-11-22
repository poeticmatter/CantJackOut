# Can't Jack Out: how to play

*The rules as the game plays them now, in plain language.*

You owe Vesna for your deck. Every night you jack into corporate servers, download their files and sell the data. Every dawn she takes her cut. Survive ten nights of payments and the deck is yours.

It's a push-your-luck game: every roll can download more, or lose everything you haven't banked yet.

## What you're trying to do

Make every one of Vesna's ten dawn payments. Miss one and you get a strike; at three strikes you lose. If you miss the tenth payment, you lose too.

## What's on the table

- **The net:** six servers you can break into. Each server shows its owner, its name and what the data pays when you download all of it.
- **Your deck:** the dice you roll and the programs you've loaded.
- **The clock:** the night runs from 22:00 to 06:00.
- **Your cash, Vesna's cut for tonight, and your strikes.**

### Dice

A die has six faces, each red, blue or green. A standard die has **1 red, 2 blue and 3 green** faces, so red comes up least and green most. Each color also has a shape (red triangle, blue square, green circle), so you never have to rely on color alone.

A face can be changed in the market. It can also become:
- **Wild** (a star): it matches any color.
- **Overclocked** (marked ×2): it downloads two blocks instead of one.

### Servers

A server holds one or two **files**. Each file has a color and a length in blocks. Red files are short because red is rare; green files are long because green is common. A 5-block red file and a 10-block blue file can be about equally hard.

**You don't know what's on a server until you connect to it.** Before that, the payout is your only hint: a bigger payout means a harder server. Once you've connected, the server's files stay visible, along with how much of each you've downloaded so far.

Some servers also have security:
- **Black ICE:** if you get jacked out here, you also lose one banked block from each unfinished file.
- **Tracer:** every run here costs 30 extra minutes.

## Setup

You start with $100, three standard dice, room for three dice and one program, and no programs. The night begins at 22:00.

## A run

1. **Choose a server and jack in.** Connecting takes a random 30 to 60 minutes. You see the time once you're in.
2. **Roll all your dice.** Every die showing the color of an unfinished file downloads a block of that file (two if the face is overclocked). Colored dice go to their own file first; wild dice then go to whichever file still needs the most. A file never takes more blocks than it needs, and a finished file stops counting.
3. **Then choose:**
   - **Roll again** to download more. Each roll takes 4 minutes.
   - **Jack out** to bank everything you downloaded this run. Banked blocks stay on the server for your next visit.
4. **A miss** is a roll where no die matches an unfinished file.
   - If you haven't downloaded anything yet this run, nothing happens: the security hasn't noticed you. Keep rolling.
   - If you have, you're **jacked out**. Everything unbanked from this run is lost, and recovering costs another 20 to 40 minutes.
5. **Download every file** on a server and the run ends on its own. You're paid in full, and a new server takes its place on the net. A partial download is worth nothing.

The screen shows your chance of hitting on the next roll.

## The night and the dawn

Every run moves the clock forward by its total time. You can start a run at any time before 06:00, and that run always finishes, even past dawn. Because connecting takes a random amount of time, you can never be sure which run will be your last.

You can also call it a night early.

At dawn Vesna collects her cut:

| Night | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cut | $150 | $250 | $400 | $600 | $850 | $1,100 | $1,400 | $1,700 | $2,050 | $2,450 |

- If you have enough, you pay it and keep the rest.
- If you don't, she takes **all** your cash and you get a strike.

Then a new night begins and your programs recharge. Each server you haven't banked anything on has an even chance of disappearing overnight; a new one, possibly harder, replaces it. Harder servers show up as the nights go on, and they pay more for your time.

## The market

You can shop between runs.

**Deck hardware**
- **Dice socket** ($450, then $1,000, then $2,000, up to six dice): roll one more die. It comes with a standard die.
- **Program slot** ($600, then $1,400, up to three): load one more program.
- **Spare standard die** ($200): keep different dice ready and swap them between runs.

**Programs** (uses recharge every night; a program only works while it's loaded in a slot)

| Program | Price | Uses a night | What it does |
|---|---|---|---|
| Bounce | $500 | 1 | When a roll misses, reroll every die instead of getting jacked out. |
| Failsafe | $350 | 2 | When a roll misses, keep half of each file's unbanked blocks (rounded down). |
| Splice | $400 | 2 | After a roll that hits, reroll the dice that downloaded nothing and keep whatever they hit. |
| Proxy chain | $450 | 2 | Halves the time of your next run. Switch it on before you jack in. |
| Deep scan | $200 | 3 | See a server's files and security without connecting or spending time. |

When a roll misses and you have Bounce or Failsafe ready, you choose whether to use one or take the hit. Otherwise you take the hit straight away.

**Dice lab:** pick a die, pick one of its faces, and reflash it.
- To green: $60. To blue: $120. To red: $250. To wild: $600.
- Overclock a face: $350.

Every face you turn red makes red files easier and leaves fewer faces for the other colors.

**Your deck:** between runs you can seat or remove any die, and load or unload any program you own.

## End of the game

- **You win** when you pay Vesna's cut at the tenth dawn.
- **You lose** at your third strike, or if you can't pay the tenth cut.
