# Squares, Starting 5, and the payout wallet

> **Status: engines shipped, unit-tested, not yet wired to UI or run against
> mainnet.** The game logic and the payout ledger are code. The screens that
> render them and the scheduled job that settles them are not built yet.
>
> Related: [`token-voting.md`](token-voting.md) (the same no-deposit principle),
> [`master-plan.md`](master-plan.md) §11.7 (the speculation-game brief, and its
> legal caution — read §5 below).

---

## 1. The principle both games are built on

Neither game takes an entry fee. Not in SOL, not in $CSGN, not in anything.

**How much you can play is a function of what you HOLD, not what you SPEND.**
Tokens never leave the wallet, are never escrowed, are never locked, and are never
burned. You can sell your entire bag halfway through a game; you simply get fewer
entries in the next one.

This is the token thesis (§5: *"non-custodial; you keep your tokens"*) expressed
as a board game, and it has a second effect that matters more than the first:
**everyone gets one free entry, including a wallet holding zero.** That isn't
generosity, it's the funnel. A non-holder plays for free, watches a holder cover
nine squares to their one, and has just been shown what the token does — which no
amount of marketing copy achieves.

The purse comes from the **treasury**, not from the players. A normal squares pool
moves money between entrants and takes a rake; here the network funds a fixed
prize out of attention revenue. The game is pure distribution: **the network pays
the audience to show up.**

### The allowance curve

Both games size entries off share of circulating supply, on a square root:

```
allowance = free + floor( sqrt( min(sharePct, 1) ) × (max - free) )
```

| | Free | Max | Reaches max at |
|---|---|---|---|
| Squares | 1 square | 10 squares | 1% of supply |
| Starting 5 | 1 lineup | 5 lineups | 1% of supply |

Sub-linear on purpose. Linear allocation would let one wallet own the board, and a
board one wallet owns isn't a game, it's a withdrawal. The square root is the same
instinct as quadratic voting: influence grows with stake, but the hundredth token
buys far less than the first. A wallet at 0.01% of supply — a hundredth of the
reference holder — still gets a *third* of the way to the cap, not a hundredth.

Note the deliberate split with [`token-voting.md`](token-voting.md) §2.4:
**linear supply-share where ownership should decide (what airs), square root where
fun should (the games).**

---

## 2. Squares

`src/lib/games/squares.ts` · `provablyFair.ts` · 33 tests

The office pool, unchanged in shape: a 10×10 grid, you take squares, digits 0–9
are drawn onto the rows and columns *after* the grid fills, and at the end of each
period the square at (last digit of one score, last digit of the other) wins. It's
the most successful casual betting game ever invented — your aunt plays it and she
can't name a player.

**The axes are named, not hardcoded to home/away.** CSGN runs both: a real game on
sports nights, and on a slow afternoon a crypto board where the axes are the last
digits of the $CSGN and SOL prices at the top of each hour. Same engine.

**Periods** default to a back-loaded four-checkpoint split (15% / 20% / 15% / 50%)
in basis points, so the purse divides in exact integer arithmetic. A purse must
never be split with floating point; 0.1 + 0.2 losing a token is a support ticket
forever.

**Unclaimed squares roll over.** If nobody held the winning square, that period's
share carries into the next board rather than being kept. `settleBoard` reconciles
to the token: everything paid plus the rollover equals the purse exactly, with
rounding dust handed to the last winner.

### The draw is the integrity story

Digits are assigned only *after* entries close. While you were picking, your
square had no number — so no square was better than any other and there was
nothing to game.

The randomness is **derived, never generated**. The seed is a Solana blockhash
sampled after the entry deadline, which gives three properties for free:

1. **Unpredictable at entry time** — nobody knows the hash of a block that doesn't
   exist yet.
2. **Unforgeable afterward** — the hash is on-chain at a known slot.
3. **Verifiable by a stranger** — blockhash + the published functions = the same
   board, byte for byte.

The PRNG is xmur3 + sfc32 with an unbiased back-to-front Fisher–Yates. Both are
tiny and identical in any language, which is the point: a skeptic should be able
to re-implement the draw in ten lines of Python and get our exact answer.
`isSeedValid` refuses a seed sampled before entries closed, so a board that can't
prove that ordering cannot settle.

---

## 3. Starting 5

`src/lib/games/startingFive.ts` · 38 tests

Daily fantasy where the athletes are coins. Pick five off the day's slate, name a
captain, lock before tip-off, score on how they moved. Eleven seconds to enter,
and it gives someone a reason to keep CSGN on a second monitor from lock to
settle — which is the actual product. **The game is a retention mechanic wearing a
jersey.**

Four decisions, each load-bearing:

**One pick per tier** — anchor (>$1B), core ($100M–1B), swing ($10–100M),
moonshot (<$10M), plus a wildcard that takes anything. Without tiers every lineup
is five microcaps and the game is a coin flip decided by whoever got the luckiest
rug. Tiers give skill somewhere to live and make no two lineups alike.

**A captain at 1.5×** — one decision worth more than the other four. It's the pick
people argue about on air, which makes it the pick that writes our content.

**Contrarian leverage** — a pick almost nobody rostered is worth up to 1.5× more
*when it hits*, scaling to 1.0× at 50% ownership. **Applied to gains only, and the
asymmetry is the whole point:** if leverage cut both ways it would just be
volatility and the rational play would still be the consensus lineup. One-sided,
being early is a free option — precisely the behaviour a network that broadcasts
coin discovery should reward.

**Captained losses are not multiplied either.** A captained loser costs its raw
loss and no more. Punishing the bold pick 1.5× on the downside teaches everyone to
captain the anchor, and a game whose optimal play is the boring play dies quietly.

Scoring is 1 point per 0.1% move, so a 10% day is 100 points and the leaderboard
reads in whole numbers. **Lineups can finish below zero** — a game where the worst
outcome is "nothing happened" has no stakes.

**Ties share a rank and split the pooled shares** (standard competition numbering:
1, 2, 2, 4). There is no tiebreak worth having: the player controls their picks
and nothing else, so breaking a tie on submission time would decide real money on
something they couldn't have played for. A tie straddling the last paid place
brings both rows in, so they split that place rather than one silently taking all
of it.

### The prize: 100,000 $CSGN for a perfect card

The live prize is a **jackpot for going 5-for-5**, not a curve for finishing
highest. 100,000 $CSGN, treasury-funded, daily.

Paying the perfect card is the more valuable design, and the reason is
retention. A rank curve has one winner and ninety-nine people who can compute by
2pm that they've lost — so they stop watching. A perfect-card jackpot is binary
and survives all day: **you're alive until one of your five goes red**, and while
you're alive you are watching five charts and our channel. It also produces the
best broadcast graphic the game can generate — *"14 cards still perfect"* —
counting down live through the session.

Two modes, admin-selectable per slate:

| Mode | Behaviour | When to use it |
|---|---|---|
| **Split** | Every perfect card shares the jackpot evenly | Large field — many winners, each meaningful |
| **Lottery** | One perfect card drawn, takes it all | Small field — 100k split forty ways is forgettable; handed to one person it's a story that recruits the next forty |

The lottery draw uses the same provably-fair seed as the Squares digits: one
ticket per perfect **card** (not per wallet — a holder who earned three lineups
and went perfect on two takes two tickets), shuffled against a blockhash sampled
after the slate settled. A settlement in lottery mode with **no published seed
refuses to draw** rather than falling back to the first row; a silent fallback in
a lottery is indistinguishable from rigging it.

**Nobody perfect → the whole purse rolls into tomorrow.** The jackpot growing in
public is the game advertising itself.

One guard worth naming because it costs six figures if it's missing: an unpriced
pick scores as *flat*, and flat clears a zero threshold — so a settle run against
a broken price feed would mark **every** card perfect and pay out the entire
jackpot on no data. `ScoredPick.priced` separates "flat" from "we don't know",
and the perfect-card rule requires the former. The rollover is the safe failure.

The `leaderboard` mode (top-ten rank curve) is retained for a bigger field later:
top-heavy but paying ten deep, and **a short field doesn't let the treasury keep
the difference** — if eight people entered a ten-place curve, the unpaid tail is
redistributed. The player who cashes for a small amount is the player who comes
back tomorrow, and tomorrow is the only metric this game exists to move.

---

## 4. The payout wallet

```
EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv
```

`_shared/payouts.ts` (rules, pure) · `payoutWallet.ts` (signing) ·
`payoutRunner.ts` (sequence) · `adminRunPayouts.ts` (endpoint) · 53 tests

This is the highest-consequence code in the repository. Everything else, at worst,
shows someone the wrong number. This spends money, irreversibly, to strangers,
unattended, on a schedule.

It is built on one assumption: **this process will crash mid-run.** Not might —
will. Netlify functions have a wall-clock limit, RPC times out, a deploy lands at
3 AM while the daily settle is halfway through the field. Every rule exists so
that when it happens, nobody is paid twice and nobody is skipped.

### The four guarantees

**1. Idempotent by construction.** A payout's id is derived from what it's *for* —
`source:sourceId:wallet` — never from a counter, a timestamp, or a nonce. Any of
those would make a retry look like a new payout. Re-running a settlement produces
the same ids, and the ledger write that claims one is a **CREATE**, which fails if
the id exists. Double payment isn't prevented by being careful; it's prevented by
the database refusing.

**2. Signature recorded before broadcast.** We sign, write the signature to the
ledger, and only then send. Crash between the two and recovery re-broadcasts the
*identical* signed transaction — same signature, so the cluster deduplicates it.
Broadcasting first and recording after is the classic way to pay twice.

**3. Capped at every level.** Per payout, per run, per ET day, tunable from
`config/payoutLimits` without a deploy. A bug that computes a nine-figure prize
hits a ceiling and files for review instead of emptying the wallet. When a ceiling
truncates a run, payouts go out largest-first — a truncated run should pay the
winner, not the tenth-place consolation.

**4. Solvent before the first transfer.** A run that can't cover its whole field
never starts. The check budgets **associated-token-account rent for first-time
winners** — which for a game whose job is turning viewers into holders is the
common case, not the edge case. Budgeting zero for it is how a payout run dies on
its first real new user.

### Recovery

| Ledger state | Action | Why |
|---|---|---|
| `confirmed` / `failed` / `needs_review` | skip | Terminal |
| `pending` | re-sign | No signature was ever recorded, so nothing was broadcast |
| `sending` **with** a signature | **ask the chain** | It may or may not have landed. Never re-sign — that creates a second transaction that could also land |
| `sending` **without** a signature | back to `pending` | A torn write. The signature is written first, so this can only mean nothing was sent |

An `unknown` answer from the chain leaves the record in `sending` for the next run
to ask again. That's a payout that stays stuck rather than one that pays twice,
and between those two failure modes there is no contest.

### Operational notes

- **`adminRunPayouts` is admin-only and dry-run by default.** You must pass
  `dryRun: false` to move a token. An endpoint that pays by default is one
  fat-fingered curl from an incident — and the dry run returns the batch, the
  solvency check and the review queue, which is what you wanted to see anyway.
- **Winners are never accepted from the request body.** They're recomputed from
  the stored game document. A payout endpoint that pays whoever the caller names
  is not a payout endpoint, it's a withdrawal endpoint.
- **Key handling** is in [`env-setup.md`](env-setup.md) — hot wallet, thin float,
  rotate freely.
- **Dry-run against a tiny real mainnet payment before this pays anyone.** The
  same caution the jukebox SPL path still carries (§v1.6). Nothing here has
  touched mainnet.

---

## 5. Before either game goes live

Two things are genuinely open, and neither is a code problem.

**Get legal advice on the prize structure.** `master-plan.md` §11.7 draws the
right line: *"the moment money is pooled and paid out on price outcomes, it's a
regulated activity in most places."* These games are deliberately on the safer
side of it — **no entry fee, nothing pooled from players, and the purse is a
treasury-funded prize** — which is a materially different structure from a stakes
contest and closer to a sweepstakes. But "no consideration" is a legal conclusion,
not a design decision, and Starting 5 pays on price outcomes. **Have counsel
confirm the structure and the jurisdictional exclusions before a single payout
runs.** Nothing in this repo is legal advice.

**Squares' purse is still undecided.** Starting 5 is set at 100,000 $CSGN daily
(and configurable from Game Control). The weekly Squares board has a cadence and
an engine but no committed purse. The treasury funds it (§11.1), so it's a
published, budgeted commitment — announcing a game before deciding what it pays
is how you end up funding it out of panic.

### Admin — Game Control

`config/gameBanner` and `config/games`, both admin-only, both editable from
Broadcast Control → **Game Control** (`src/components/admin/GameControlsCard.tsx`):

- **The /watch strip** — the game, the headline, a countdown target, and the
  rotating lines. This used to be four constants in `Watch.tsx`, so announcing a
  game or putting a clock on it required a deploy. There's a live preview in the
  card that renders through the same pure resolver the page uses.
- **Starting 5** — purse, carried jackpot, prize mode, daily lock hour (ET).
- **Squares** — weekly cadence: the ET day and hour entries close and the digits
  are drawn.

### What's left to build

| | |
|---|---|
| Squares board UI | grid, claim flow, live winning-square highlight |
| Starting 5 slate UI | slate screen, lineup builder, the still-perfect counter |
| Slate construction | daily job that builds a slate from the Meme-100 + tiering |
| Settlement job | scheduled function: draw → score → `adminRunPayouts`; also writes `users/{uid}.gameStats`, which the profile already renders |
| Broadcast graphics | the live winning square, and the perfect-card countdown — the best ambient tension either game produces, and the first costs one function call (`winningSquareIndex`) |
| Admin | board/slate creation and the payout review queue (purse + cadence are done) |
