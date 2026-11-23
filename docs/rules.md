# Can't Jack Out: how to play

*The rules as the game plays them now, in plain language.*

You owe Vesna for your deck. Every night you jack into corporate servers, download their files and sell the data. Every dawn she takes her cut. Survive ten nights of payments and the deck is yours.

It's a push-your-luck game: every roll can download more, or lose everything you have at risk.

## What you're trying to do

Make every one of Vesna's ten dawn payments. Miss one and you get a strike; at three strikes you lose. If you miss the tenth payment, you lose too.

## What's on the table

- **The net:** six servers you can break into. Each server shows its owner, its name and what the data pays when you download all of it.
- **Your deck:** the dice you roll and the programs you've loaded.
- **The clock:** the night runs from 22:00 to 06:00.
- **Your cash, Vesna's cut for tonight, and your strikes.**

### Dice

A die has six faces. A standard die has **1 red, 2 blue and 3 green** faces, so red comes up least and green most. Each color also has a shape (red triangle, blue square, green circle), so you never have to rely on color alone.

Faces can be changed at Moth's bench (see the market). Besides the three colors, a face can be:
- **Dual-color** (both shapes, side by side): it matches either of its two colors.
- **Wild** (a star): it matches any color.
- **Firewall** (a shield): it never downloads anything, but if it shows on a roll that misses, the miss is blocked.
- **Payday** (a diamond with a $): it never downloads anything, but it pays $15 every time it shows, hit or miss.

A face that downloads can also be:
- **Overclocked** (marked ×2): it downloads two blocks instead of one.
- **Anchored** (marked with an anchor): the blocks it downloads are banked on the spot and can't be lost.

### Servers

A server holds one or two **files**. Each file has a color and a length in blocks. Red files are short because red is rare; green files are long because green is common. A 2-block red file and a 12-block green file can be about equally hard.

**You don't know what's on a server until you connect to it.** Before that, the payout is your only hint: a bigger payout means a harder server. Servers that tend to catch you more often pay a little extra for the risk. Once you've connected, the server's files stay visible, along with how much of each you've banked.

Every server also has an **alert** meter. Each visit raises it by one, and getting flatlined there raises it by one more. If it's full when a run ends, the sysadmin purges the server: everything you've banked there is wiped and the alert starts over. Bigger servers can take more visits before that happens.

Some servers also have security:
- **Black ICE:** if you get flatlined here, you also lose one banked block from each unfinished file.
- **Tracer:** every run here costs 30 extra minutes.

Servers with a single red file don't appear until night 3.

## Setup

You start with $100, three standard dice, room for three dice and one program, and no programs. The night begins at 22:00.

## A run

1. **Choose a server and jack in.** Connecting takes a random 30 to 60 minutes.
2. **The stake.** Every unfinished file starts the run with one block **at risk**. If you've never banked any of that file, the connection plants a free block. Otherwise your last banked block of it goes back at risk. So even your first roll has something to lose.
3. **Roll all your dice.** Every die showing the color of an unfinished file downloads a block of that file (two if the face is overclocked). Single-color faces go to their own file first; dual-color and wild faces then go to whichever matching file still needs the most. A file never takes more blocks than it needs, and a finished file stops counting. New blocks are at risk too, unless an anchored face downloaded them.
4. **Then choose:**
   - **Roll again** to download more. Each roll takes 4 minutes.
   - **Jack out** to bank everything at risk. Banked blocks stay on the server for your next visit.
   - **Reroute** (once you've downloaded something this run): pay to bank everything at risk and stay connected. It costs 15 minutes and $30 to $70 (more on harder servers), which is less time than leaving and connecting again. A fresh stake goes at risk right away, as if you'd just connected, and the visit doesn't raise the alert again.
5. **A miss** is a roll where no die matches an unfinished file. You're **jacked out**: everything at risk is lost, and recovering costs another 20 to 40 minutes. If a Firewall face showed on the miss, it's blocked instead: you lose nothing but the roll's time and can keep going.
6. **Download every file** on a server and the run ends on its own. You're paid in full, and a new server takes its place on the net. A partial download is worth nothing.

The screen shows your chance that the next roll is safe.

## The night and the dawn

Every run moves the clock forward by its total time. You can start a run at any time before 06:00, and that run always finishes, even past dawn. Because connecting takes a random amount of time, you can never be sure which run will be your last.

You can also call it a night early.

Vesna calls at the start of each night to remind you what she's owed. At dawn she collects her cut:

| Night | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cut | $200 | $325 | $500 | $750 | $1,075 | $1,400 | $1,775 | $2,175 | $2,600 | $3,125 |

- If you have enough, you pay it and keep the rest.
- If you don't, she takes **all** your cash and you get a strike.

Then a new night begins and your programs recharge. Each server you haven't banked anything on has an even chance of disappearing overnight; a new one, possibly harder, replaces it. Harder servers show up as the nights go on, and they pay more for your time.

## The market

Moth's back room is open between runs. "Upgrade dice" in your deck panel, or "Flash faces" under any die, takes you straight to her bench.

**Deck hardware**
- **Dice socket** ($450, then $1,000, then $2,000, up to six dice): roll one more die. It comes with a standard die.
- **Program slot** ($600, then $1,400, up to three): load one more program.
- **Spare standard die** ($200): keep different dice ready and swap them between runs.

**Programs** (uses recharge every night; a program only works while it's loaded in a slot)

| Program | Price | Uses a night | What it does |
|---|---|---|---|
| Bounce | $500 | 1 | When a roll misses, reroll every die instead of getting jacked out. |
| Failsafe | $350 | 2 | When a roll misses, keep half of each file's blocks at risk (rounded down). |
| Splice | $400 | 2 | After a roll that hits, reroll the dice that downloaded nothing and keep whatever they hit. |
| Proxy chain | $450 | 2 | Halves the time of your next run. Switch it on before you jack in. |
| Deep scan | $200 | 3 | See a server's files and security without connecting or spending time. |

When a roll misses and you have Bounce or Failsafe ready, you choose whether to use one or take the hit. Otherwise you take the hit straight away.

**The bench:** pick any face on any of your dice, then pick what it should become. Every option shows its price.

| Reflash a face to | Price |
|---|---|
| Green | $60 |
| Blue | $120 |
| Red | $250 |
| Blue or green | $180 |
| Red or green | $310 |
| Red or blue | $370 |
| Wild | $600 |
| Firewall | $350 |
| Payday | $200 |

A face that downloads can also be **overclocked** ($350) or **anchored** ($300). A face keeps its overclock and anchor when you change its color, and loses them if you turn it into a Firewall or Payday face.

Every face you turn red makes red files easier and leaves fewer faces for the other colors.

**Your deck:** between runs you can seat or remove any die, and load or unload any program you own.

## End of the game

- **You win** when you pay Vesna's cut at the tenth dawn.
- **You lose** at your third strike, or if you can't pay the tenth cut.
