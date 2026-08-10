# Token economics — why $CSGN works, stated so it can be argued with

> **Status: design.** This is the token document. Where
> [`../archive/master-plan.md`](../archive/master-plan.md) §5 or
> [`../archive/onchain-thesis.md`](../archive/onchain-thesis.md) §6 disagree with it on
> token design, **this file is newer**.
>
> It answers four questions in order: what is actually wrong with the token today, why
> [`the-grid.md`](the-grid.md) fixes it, what an investor is entitled to be shown, and
> where the legal line sits.
>
> Companions: [`the-grid.md`](the-grid.md) (the mechanism itself),
> [`token-voting.md`](token-voting.md) (supply share and hold age),
> [`csgn-share.md`](csgn-share.md) (the ratings that price inventory).
> Sequenced by [`../plan.md`](../plan.md).

---

## 1. The diagnosis — it is narrower than "no utility"

The project has already said the honest thing about its own token
([`../archive/onchain-thesis.md`](../archive/onchain-thesis.md) §1.2): *"the product works
identically if you delete the token and charge in SOL."* That is true, but "it needs more
utility" is the wrong diagnosis and acting on it would make things worse.

Here is the audit from `master-plan.md` §5.1 with the column that matters added:

| # | Use | Gate | **Side** |
|---|---|---|---|
| 1 | Governance vote | balance > 0 | **hold** |
| 2 | Meme-100 vote | balance > 0 | **hold** |
| 3 | Right Now rail | ≥ threshold | hold, but a one-off |
| 4 | Creator-fee share | none | neither — needs no token at all |
| 5 | Coin Jukebox | pay per play | **spend** |
| 6 | Gated info pipeline | tier | not built |

The two hold-side uses are votes, and a vote is worth what the decision is worth — today,
very little. The one real economic use is **spend-side**. And a token you spend is
demanded only for the length of a transaction:

> **Demand for a spend-side token ≈ transaction flow × holding period, and the holding
> period is minutes.** Adding more things to spend it on adds more paths from a buyer to
> a seller. It is the velocity problem, and no quantity of utility solves it.

**The fix is a change of kind, not of amount:**

> **Ration by stock. Don't price by flow.**

Stop selling the token's use for tokens. Make the use *a function of what you hold*, so
that acquiring the right and keeping the right are the same act. That is
[`the-grid.md`](the-grid.md), and everything below is why it works.

---

## 2. Why the Grid is sound microeconomics

Four claims, each of which should survive a hostile reading.

### 2.1 It kills velocity

To receive airtime tomorrow you must hold today. There is no transaction, so there is no
seller on the other side of the use. Demand for CSGN's attention converts into demand for
**float** rather than for throughput — and float that is being used for something is float
that is not on the order book.

### 2.2 It is sybil-proof by construction

Airtime is denominated in share of circulating supply. Splitting a bag across a thousand
wallets produces exactly the same number of seconds, because the numerator and the
denominator both stay put. This is the same property that makes supply-share voting work
([`token-voting.md`](token-voting.md) §2.1), and it is rarer than it sounds: almost every
points program, quest system and airdrop in this industry is gameable by wallet count.

### 2.3 It is supply-move invariant

"1% of the network is 1% of the day" is true at a $2M market cap and a $2B one. No
constant needs retuning when the price moves, which — see §6 — is precisely the failure
mode the existing purses have.

### 2.4 It is grounded in something exogenous

This is the one that matters. **Airtime is worth what the audience makes it worth, not
what the token price makes it worth.** The value of a second of CSGN comes from how many
people are watching, which is a fact about the world and not a fact about the token. That
breaks the reflexive loop that killed Era 1 — [`../archive/socialfi-era2.md`](../archive/socialfi-era2.md)
§1.1 — where the product *was* the speculation and there was nothing underneath when the
price stopped going up.

Underneath this one there is a television channel that broadcasts whether or not anyone
is buying.

### 2.5 And it keeps the doctrine intact

Nothing is locked, deposited, escrowed, staked or burned. **Holding is the stake.** That
is what the live site already tells users on `/about` — *"Nothing here burns your tokens,
locks them, escrows them, or asks you to deposit them"* — and the Grid is the first
mechanism in the product that makes that promise *load-bearing* rather than merely true.

---

## 3. The two-market structure — what makes airtime priceable

The same inventory is allocated two ways, on purpose.

| | Allocated by | Paid in | What it is for |
|---|---|---|---|
| **The Grid** | supply share | nothing | Token demand |
| **The Open Rate Card** | posted price / auction | SOL, USDC, $CSGN, partner tokens | Cash revenue — **and the price signal** |

Without the cash market, Grid seconds have no observable value and every claim in this
document is unfalsifiable. With it, they have a market price, and that yields the number
an investor actually wants:

> **Airtime Yield** — *"1% of supply received $X of inventory this week, valued at
> open-market rates."*

Say exactly what that is and what it is not. It is a **disclosure**, computed from two
public numbers: the rate card and the Grid allocation. It is **in kind** — television, not
money. There is **no cash, no promise, no redemption, and no claim on anything**. It is
closer to a REIT's FFO than to a dividend, and the reason to publish it is that it lets
someone value the token from the outside without taking a word of this on trust.

**The dial.** The split between Grid and rate card is the network's monetary policy: widen
the Grid and token demand rises while cash revenue falls; narrow it and the reverse.
Publish the ratio, move it slowly, and log every change in
[`../decisions.md`](../decisions.md). A dial that is public and slow is a policy. The same
dial undisclosed is a rug.

---

## 4. The demand engine

> **CSGN's ad inventory is sold once — into the token. Every future advertiser buys it
> from a previous one, on the open market.**

A coin team that wants recurring airtime has two options: rent it for cash, forever, or
buy the token once and hold it. Fixed supply of seconds, demand rising with the audience:
this is the economics of a **spectrum licence, a taxi medallion, an airline landing
slot** — except no regulator issues it, and the inventory regenerates every morning.

The artifact that sells this is not a paragraph, it is a table. Publish the **break-even**:
at the current rate card and the current token price, here is the number of weeks past
which owning is cheaper than renting, and here is how that number moves if the audience
doubles. Arithmetic a skeptic can re-run is what persuades; adjectives are not.

Two honest qualifications:

- **It only works if the rate card clears.** See §8.
- **It is a better argument at scale than at 300 followers.** Today the honest version is
  "here is the mechanism and here is the arithmetic"; the persuasive version needs an
  audience number to plug in.

---

## 5. What investors actually want in 2026 — and none of it needs outreach

The current meta is not "utility." It is **revenue-funded buybacks and transparent,
rules-based capital policy**: Hyperliquid routes ~97% of protocol fees into open-market
HYPE purchases, Aave's onchain buyback funds repurchases from the fee switch and
distributes to stakers, and the recurring research finding is that *rules-based policies
with clear caps, schedules and reporting are valued more than ad hoc purchases, whatever
the mechanism*
([tokenomist](https://tokenomist.ai/research/buyback-and-burn-explained-what-they-are-who-is-doing-them-and-whether-they-actually-work),
[Venture](https://blog.venturemagazine.net/governance-tokens-with-real-cash-flow-mechanics-a-2026-map-dd04deab6056),
[DWF Labs](https://www.dwf-labs.com/research/547-token-buybacks-in-web3)).

Seven things CSGN can put on the table. Every one is **unilateral** — no listing, no
partner, no fund, no favour, no DM.

### 5.1 The Airtime Buyback

**CSGN already promises this and has never named it.** `master-plan.md` §5 says value
accrues partly through *"open-market $CSGN buys to pay creators."* That is Aave's
buyback-to-stakers shape, sitting unlabelled in a strategy doc, unmeasured and unreported.

Name it, and publish the rule the way the research says it has to be published: **the
percentage of cash revenue committed, the cadence, the cap, the wallet, the transaction
links, and a monthly report.**

The story is better than the standard version, and it is worth saying out loud: **this
buyback pays the talent.** Not a burn, not a treasury pile — network revenue converted on
the open market and paid to the people who made the programming. It satisfies the meta
without touching the no-burn doctrine, and it is the only version of a buyback that also
buys content.

### 5.2 Published revenue, weekly

§5.1 is a press release until there is a revenue line under it. One number a week, in
public, including the weeks it is small. A buyback policy with no published denominator is
exactly the "ad hoc" shape the research says the market discounts.

### 5.3 The balance-sheet rule

> **Treasury outflow over any 30 days ≤ trailing-30-day revenue.**

Prizes, buybacks and payouts come out of earnings; the treasury is working capital, not a
pile to spend down. This is the sentence that makes `master-plan.md` §11.1's "productive
treasury" checkable instead of aspirational, and it is the single cheapest credibility
purchase available.

### 5.4 Proof-of-Broadcast

The data already exists — `streamActivity` samples verified live-minutes server-side once
a minute. Publishing it as a signed attestation turns "I streamed" into verifiable history
([`../archive/onchain-thesis.md`](../archive/onchain-thesis.md) §6.3 ③). It is days of
work, it is the substrate for sponsor escrow and settled prizes, and "verifiable" is a
property investors and developers both pay attention to.

### 5.5 Airtime Yield

§3. The valuation anchor. Nobody else in this category publishes anything an outsider can
value the token from.

### 5.6 The refusal list, treated as a feature

**No airdrop. No points program. No farming. No burn. No lockups.** The pitch documents
have always refused these; the mistake was treating it as an omission to be explained.
After a cycle in which nearly every points program disappointed the people who farmed it,
refusing them is a positioning asset. Put it on the page.

### 5.7 DePIN framing for the venue play

Screens in bars, barbershops and arcades are physical nodes carrying the network, and the
venue MVP is ~80% built ([`../archive/ecosystem-strategy.md`](../archive/ecosystem-strategy.md)
§4). DePIN is a category investors are actively funding and CSGN has a real, unfaked
physical footprint story available to it. It is also the one revenue line that pays at 300
followers, because a bar does not care how many followers you have.

---

## 6. A live liability, stated precisely

Purses, entry fees and gates are denominated in **token counts**, which makes them
floating **dollar** liabilities. Verified in code:

| Constant | Value | File |
|---|---|---|
| `PERFECT_CARD_PURSE_CSGN` | `100_000` daily | `src/lib/games/startingFive.ts` |
| `SQUARES_TARGET_PRIZE_CSGN` | `500_000` | `src/lib/games/squares.ts` |
| `DEFAULT_ENTRY_FEE_CSGN` | `6_250` per square | `src/lib/games/squares.ts` |
| `rightNowMinCsgn` | `5_000_000` | `src/lib/tokenGates.ts` |
| `DEFAULT_SPOTLIGHT_CSGN` | `1_000_000` | `netlify/functions/jukeboxSpotlight.ts` |

**Be precise about what the problem is and isn't.** These are not hardcoded — the purse
and entry fee are live-editable from Game Control via `config/games`, the gate from
`config/tokenGates`, the spotlight price from `config/ticker`. The codebase already
understands the hazard; `jukeboxSpotlight.ts` carries the comment *"a fixed token count is
a moving dollar cost."*

The problem is that **the unit is wrong, so staying correct requires a human to notice**.
At 10× the price the daily jackpot costs 10× to fund and a Squares square costs 10× to
buy — the game prices out its own audience precisely when the network is winning — and
nothing fails loudly. It just gets quietly more expensive until someone looks.

**The recommendation: denominate in supply share or in dollars, resolve to tokens at
settlement.** The same move `master-plan.md` §5.1 already made once when the Right Now
threshold was pulled into config — this is the second half of that fix. Design finding
only; no code in this branch.

---

## 7. Where the line is, and what sits on the other side of it

> A **non-transferable, expiring, cash-non-redeemable access credit** is a different
> instrument from a **transferable claim on future value.**

Everything in §§2–6 is deliberately the first thing. Grid seconds cannot be sold,
transferred, or redeemed for money; they expire daily; and Airtime Yield is a disclosure
about in-kind access, not a distribution. That is not an accident of design, it is the
design.

The following are genuinely interesting, and each one crosses the line. **Every one needs
counsel before it ships**, and none of them is a prerequisite for anything above:

- **Airtime as a transferable onchain asset** — an hour you can hold, sell, or borrow
  against; the schedule becomes an order book
  ([`../archive/onchain-thesis.md`](../archive/onchain-thesis.md) §6.3 ①).
- **Airtime futures and forward leases** — pre-selling next quarter's Fringe.
- **Prediction markets on channel state**, resolved by Proof-of-Broadcast (§5.4).
- **A streamer index** — pricing a creator's performance as an instrument.

The point of building the safe layer first is that this tier becomes an **option, not a
dependency**. Nothing in §§2–6 has to be unwound to get here, and nothing in §§2–6 is
waiting on a lawyer.

---

## 8. Sequencing, metrics, and what would prove this wrong

**Build order** (the product side is in [`the-grid.md`](the-grid.md) §10):

1. Supply-share denomination everywhere — display-layer only, one afternoon
   ([`token-voting.md`](token-voting.md) §5).
2. Publish the inventory and the rate card. A page, not a system, but it is what makes
   everything else quotable.
3. Re-denominate purses, fees and gates (§6).
4. **Grid accrual, read-only** — every holder sees their seconds.
5. The Grid on air, links only.
6. The Airtime Buyback ledger and the weekly revenue post (§5.1, §5.2).
7. Partner Day, dark.
8. Harberger ticker cells — hold the cell while you keep paying, anyone may take it at
   your own stated price ([`../archive/onchain-thesis.md`](../archive/onchain-thesis.md)
   §6.3 ⑤). Fastest real revenue in the whole stack, and it prices the rail continuously
   instead of by admin fiat.
9. Proof-of-Broadcast.
10. With counsel: §7.

**Metrics that mean something:**

| Metric | Why |
|---|---|
| Share of supply that **spent** its seconds yesterday | The real DAU. Wallet counts are decoration |
| Grid fill rate | Is there a network, or a schedule with our own reruns in it |
| Charter contributors | The cold-start number |
| **Open-market fill rate** | Does the rate card clear at any price |
| Float held ≥ 30 days | Is the mechanism actually absorbing supply |
| Trailing-30-day revenue vs. treasury outflow | §5.3, checkable by anyone |

**The falsification test, stated plainly:**

> **If the open-market inventory will not sell for cash at any price, Airtime has no
> price, the yield in §3 is fiction, and this design fails.**

That is not a hedge, it is the experiment. Everything here rests on attention being worth
money to someone other than us. If §5.2's revenue line stays at zero for a quarter while
the rate card sits published and unfilled, the correct response is to stop, say so, and go
back to selling attention for cash — not to widen the Grid and call the resulting number
adoption.
