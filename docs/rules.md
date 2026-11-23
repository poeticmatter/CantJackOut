# Can't Jack Out: how to play

*The rules as the game plays them now, in plain language. This is the dice-pairing experiment.*

You owe Vesna for your deck. Every night you jack into corporate servers, download their files and sell the data. Every dawn she takes her cut. Survive ten nights of payments and the deck is yours.

It's a push-your-luck game: every roll can download more, or lose everything you have at risk.

## What you're trying to do

Make every one of Vesna's ten dawn payments. Miss one and you get a strike; at three strikes you lose. If you miss the tenth payment, you lose too.

## What's on the table

- **The net:** six servers you can break into. Each server shows its owner, its name and what its data is still worth.
- **Your deck:** four dice and the programs you've loaded.
- **The clock:** the night runs from 22:00 to 06:00.
- **Your cash, Vesna's cut for tonight, and your strikes.**

### Dice

You roll four dice, and every die is the same: **1 red, 1 blue, 2 green and 2 yellow** faces. Red and blue are rare; green and yellow are common. Each color also has a shape (red triangle, blue square, green circle, yellow diamond), so you never have to rely on color alone. Your dice never change.

### Servers

Every server holds the same six **files**, one for each pair of two different colors: **R+B, R+G, R+Y, B+G, B+Y and G+Y**. A file shows as its two colors side by side. A file is a tower of blocks. Servers differ only in how tall each file is, and in their security and alert.

Files for rare pairs are short and files for common pairs are tall, the way Can't Stop's 2 and 12 columns are short and its 7 column is tall. Each file pays its own price, and a short rare file pays about as much as a tall common one at the same tier.

| How often a roll offers each file | R+B | R+G, R+Y, B+G, B+Y | G+Y |
|---|---|---|---|
| Chance at least one split has it | 23% | 38% each | 62% |

Servers come in five tiers. Harder tiers have taller files and pay more for the same work. Each file can be up to a fifth shorter or a quarter taller than the typical size below, and is never shorter than 2 blocks.

| Tier | R+B | R+G, R+Y, B+G, B+Y | G+Y | Typical value |
|---|---|---|---|---|
| 1 | 2 | 3 | 5 | $490 |
| 2 | 3 | 4 | 7 | $820 |
| 3 | 4 | 6 | 8 | $1,430 |
| 4 | 4 | 7 | 10 | $2,040 |
| 5 | 5 | 8 | 12 | $2,860 |

Tier 1 servers show up from the first night, and harder tiers join as the nights go on.

**You don't know a server's file sizes until you connect to it.** Before that, its value is your only hint. Once you've connected, the files stay visible, with each one's price and how much of it you've banked.

Every server also has an **alert** meter. Each visit raises it by one, and getting flatlined there raises it by one more. If it's full when a run ends, the sysadmin purges the server: every unfinished file there is wiped back to zero and the alert starts over. Files you've already sold are safe. A server's alert limit is a third of its total blocks, rounded up, and never less than 6.

Some servers also have security:
- **Black ICE:** if you get flatlined here, you also lose one banked block from each unfinished file.
- **Tracer:** every run here costs 30 extra minutes.

## Setup

You start with $100, four dice, one program slot and no programs. The night begins at 22:00.

## A run

1. **Choose a server and jack in.** Connecting takes a random 30 to 60 minutes.
2. **Roll the four dice.** Each roll takes 4 minutes.
3. **Split them into two pairs.** There are three ways to do it, and you see all three. A pair of two different colors downloads one block of the file with those two colors: a red and a blue download R+B. Two dice of the same color never make a pair. If both pairs of your split work, both count, even if they match the same file (then that file gets two blocks). New blocks are **at risk** until you bank them.
4. **Streams.** A run can work on **three files** at most. A file becomes one of your streams the first time you download from it. A pair does nothing if its file is full, or if it would need a fourth stream. If both pairs of a split would each open a new stream but you only have one free, you pick which one to take. The split you choose decides which streams you open.
5. **Jackpot.** If all four dice show the same color (about 1 roll in 38), no pair works, but you put one block in any file you choose: one of your open streams, or any other file if you still have a stream free.
6. **Then choose:**
   - **Roll again** to download more.
   - **Jack out** to bank everything at risk. Banked blocks stay on the server for your next visit.
   - **Reroute** (once you have something at risk): pay to bank everything at risk and stay connected. Every stream comes free again. It costs 15 minutes and $30 to $70 (more on harder servers), which is less time than leaving and connecting again, and the visit doesn't raise the alert again.
7. **A miss** is a roll with no usable pair in any split and no jackpot. You're **jacked out**: everything at risk is lost, and recovering costs another 20 to 40 minutes. On a server where every file is still open, your first roll can't miss.
8. **Selling.** When every block of a file is banked, the fence buys it and you're paid its price at the end of the run. When all six files are sold, the server is cracked and a new one takes its place on the net.

The screen shows your streams, how many are left, and your exact chance that the next roll isn't a miss. With three streams open:

| Your three streams | Chance the next roll isn't a miss, counting the jackpot |
|---|---|
| G+Y with two middle files that don't share green or yellow, like R+G, B+Y, G+Y (4 sets) | 89% |
| R+B, G+Y and any middle file (4 sets) | 85% |
| G+Y with R+G and B+G, or with R+Y and B+Y (2 sets) | 82% |
| Any three of the middle files R+G, R+Y, B+G, B+Y (4 sets) | 77% |
| R+B with one middle file that has red and one that has blue, like R+B, R+G, B+Y (4 sets) | 73% |
| R+B, R+G, R+Y or R+B, B+G, B+Y (2 sets) | 54% |

## The night and the dawn

Every run moves the clock forward by its total time. You can start a run at any time before 06:00, and that run always finishes, even past dawn. Because connecting takes a random amount of time, you can never be sure which run will be your last.

You can also call it a night early.

Vesna calls at the start of each night to remind you what she's owed. At dawn she collects her cut:

| Night | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cut | $200 | $325 | $500 | $750 | $1,075 | $1,400 | $1,775 | $2,175 | $2,600 | $3,125 |

- If you have enough, you pay it and keep the rest.
- If you don't, she takes **all** your cash and you get a strike.

Then a new night begins and your programs recharge. Each server you haven't banked anything on has an even chance of disappearing overnight; a new one, possibly harder, replaces it.

## The market

Moth's back room is open between runs. It sells no dice: everyone rolls the same four.

**Program slot** ($600, then $1,400, up to three): load one more program.

**Programs** (uses recharge every night; a program only works while it's loaded in a slot)

| Program | Price | Uses a night | What it does |
|---|---|---|---|
| Bounce | $500 | 1 | When a roll misses, reroll every die instead of getting jacked out. |
| Failsafe | $350 | 2 | When a roll misses, keep half of each file's blocks at risk (rounded down). |
| Proxy chain | $450 | 2 | Halves the time of your next run. Switch it on before you jack in. |
| Deep scan | $200 | 3 | See a server's files and security without connecting or spending time. |

When a roll misses and you have Bounce or Failsafe ready, you choose whether to use one or take the hit. Otherwise you take the hit straight away.

**Your deck:** between runs you can load or unload any program you own.

## End of the game

- **You win** when you pay Vesna's cut at the tenth dawn.
- **You lose** at your third strike, or if you can't pay the tenth cut.
