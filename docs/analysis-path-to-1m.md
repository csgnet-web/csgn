# CSGN: the whole thing, honestly — and the road from $3,600 to $1,000,000+

You asked for two things: a total rundown of the project, and the best ways for
CSGN to succeed as a network — specifically how a token at **~$3,600** gets to
**$1,000,000+**, and how the online presence gets to *king of the niche*.

This is that, written the way I'd write it if I had money in it.

---

## Part 0 — The one-paragraph version

CSGN is a 24-hour television channel where **the shelf is finite and the shelf
space is owned**. A day has 86,400 seconds; your share of them is your share of
the token. Clips run by default, live members interrupt when they're worth
interrupting for, and the whole thing streams to X. The product is now
genuinely built and genuinely works. What it does not have is anybody watching.
That is a much better problem than the reverse, and it is entirely a
distribution problem — so the rest of this document is mostly about distribution.

---

# PART ONE — THE RUNDOWN

## 1. What exists, and how solid each piece is

| Piece | State | Honest grade |
|---|---|---|
| **The channel** (`/watch`, `/player`, OBS) | Runs 24/7, clip reel + live cut-ins, broadcast graphics as loadable HTML | **A** — this is real television |
| **Clip pipeline** | Paste, share-sheet, or TikTok import → review → airs, exact durations | **A−** — review is manual and will bottleneck |
| **Airtime economics** | 1:1 with supply share, 25% per-member ceiling, locked at 2 AM ET | **A** — the maths is clean and testable |
| **Streamer roster** | Connect Twitch once, grant forwarding, get carried while live | **A** — nothing to schedule, which is the whole trick |
| **Operator tooling** | Live-now board, five alert kinds, desktop notifications | **B+** — good, but only while a browser tab is open |
| **Mode transparency** | Public "why is this on" + switch log, shipped this round | **A** |
| **Meme 100** | 100 memecoins ranked on votes/volume/momentum/maturity/size | **B** — data sources unverified from the sandbox |
| **Coin jukebox** | CSGN-only bidding, 12-hour reign, treasury-bound | **B+** |
| **Fee split** | 30% of creator fees to the streamer who earned them | **B** — paid by hand, which does not scale past ~20 |
| **Onboarding** | Wallet-optional sign-up, no minimum to post | **A−** |
| **Presence** | @CSGNet, a site, a press release. No audience. | **D** — and this is the whole problem |

Read the grades in order and the shape is unmistakable: **every A is a build
problem and the only D is a distribution problem.** You have spent the project's
life so far on the wrong side of that line, correctly — but the ratio has to
invert now.

## 2. The two economic loops

**Loop A — the holder loop (works today):**
buy $CSGN → your share of the day goes up → post a clip → watch yourself on
television → tell someone → they buy.

**Loop B — the streamer loop (works today):**
connect Twitch → keep streaming as normal → get carried on CSGN → earn 30% of
the creator fees your hour generates → your audience discovers CSGN.

Loop A creates *demand for the token*. Loop B creates *audience*. Neither is
theoretical any more; both have been built. Both are currently running at
roughly zero volume because nobody has been pointed at them.

**The critical dependency nobody states out loud:** Loop A's payoff is
"watch yourself on television", and that is only a payoff if somebody else is
also watching. A channel with four viewers makes the airtime worthless
regardless of how correctly it is allocated. **Viewers are the load-bearing
variable of the entire token economy**, not holders. Grow viewers and the token
follows; grow holders without viewers and you have sold seats in an empty room.

## 3. The honest weaknesses

I would rather name these now than have them found later.

1. **One operator.** Alerts land in a browser tab. If you sleep, the channel can
   sit on a dead stream for hours. *(Fix: see §11.)*
2. **Manual review is a cliff.** It works at 10 clips a day and stops working at
   100. TikTok import makes 100 a day arrive faster than paste ever would.
3. **Manual fee payouts.** Fine for a handful of streamers. A liability at
   twenty, and a reputational one the first time somebody is paid late.
4. **Unverified data sources.** The Meme 100's feeds have never been exercised
   against the live APIs from this environment. First deploy is the first test.
5. **Rebroadcast risk.** You are re-transmitting other people's live video. The
   consent record is versioned and timestamped, which is right — but a DMCA or a
   angry streamer is a *when*, not an *if*, and there should be a documented
   takedown path before it happens.
6. **The token is on a bonding curve.** Below graduation, price is thin and
   news-driven. Any campaign that draws attention before there is depth
   produces a spike and a dump, and a dump reads as a failed project even when
   the product is fine.

---

# PART TWO — THE ROAD TO $1,000,000+

## 4. What $1M actually costs, in dollars

This is the part people avoid, so here it is with the arithmetic shown.

**Assumptions** (check these against the live pool before acting — I cannot
reach the chain from this environment):

- 1,000,000,000 supply, standard pump.fun issuance
- Current market cap ≈ **$3,600** → price ≈ **$0.0000036**
- $1,000,000 market cap → price ≈ **$0.001** — a **~278×** move

### Stage 1 — reach graduation

While the token is on the bonding curve, market cap moves with net buying along
the curve. Getting from a few thousand to graduation is on the order of
**$15,000–$30,000 of net inflow**, depending on where the curve currently sits.

### Stage 2 — graduation to $1M

Once on a constant-product pool, raising the price by a factor of *k* takes
roughly **Q × (√k − 1)** of net buying, where Q is the quote (SOL) side of the
pool. With a typical graduation pool and a ~14× move from there to $1M:

> √14.5 ≈ 3.8 → **≈ 2.8 × Q** of net buying ≈ **$30,000–$40,000**

### The headline number

> **Roughly $50,000 to $80,000 of net buying takes CSGN from here to a
> $1,000,000 market cap.** Not millions. Not a fund. Fifty to eighty thousand
> dollars that stays in.

That reframes the entire problem, and it is the single most useful sentence in
this document:

| Path | People | Average buy |
|---|---|---|
| Whale-led | 5–10 | $8,000 |
| Community-led | **150** | **$400** |
| Broad | 700 | $100 |

**Aim for the middle row.** Ten whales can leave in ten minutes and they will;
150 people who each bought $400 *because they want airtime* do not, because
selling costs them the thing they bought it for. This is the difference between
a chart and a network, and CSGN is one of the very few tokens where the product
gives holders a reason not to sell.

## 5. The single strategic point

**Sell airtime, not the token.**

Every crypto project of this size fails the same way: it markets the token to
people who buy tokens. Those people are mercenary by definition and leave on the
next candle. CSGN has something almost none of them have — **an actual product
that a specific person wants**:

> *"You have 40,000 followers on X and you make clips. There is a television
> channel that will air them, tonight, and the amount of time you get is
> exactly your share of a token that costs $400. Nobody has to approve you and
> you don't have to make anything new."*

That pitch converts a **creator**, not a trader. A creator who buys $400 of
$CSGN to get airtime is buying a product; the token is the receipt. Sell it that
way and you get 150 holders who behave like customers.

## 6. The three growth engines, ranked

### Engine 1 — the Meme 100 and the jukebox (most underrated)

These are **other people's marketing budgets pointed at you**, and they are
already built.

- A memecoin project that enters the Meme 100 will screenshot it. Every one of
  them has a Telegram of thousands.
- A project that wins the jukebox and gets 12 hours of spotlight on a live
  channel *tells its own holders* — because it makes them look early.
- Both mechanisms make CSGN the **scoreboard** for a niche that has no
  scoreboard, and scoreboards get cited. Citation is free distribution forever.

**Do this**: after every daily settlement, post the Meme 100 top 10 to
@CSGNet, tagging every project in it. Ten tags a day, every day. Some fraction
retweet. That is a compounding, zero-cost, fully automatable acquisition channel
and it is the highest-leverage thing on this list.

### Engine 2 — streamers as distribution

Each connected streamer is a doorway to their own audience. The maths is
brutal but favourable: a streamer with 200 concurrent viewers who is carried for
two hours exposes CSGN to more people than the site will get organically in a
month.

**Do this**: target streamers in the 50–500 concurrent range. Big enough to move
the needle, small enough that a "we'll put you on a TV channel and pay you fees"
offer is genuinely exciting rather than beneath them. Twenty of those is the
whole ballgame.

### Engine 3 — clips as portable proof

Every clip that airs is a piece of content whose creator has a personal reason
to share the fact that it aired. That is the cheapest possible marketing: the
creator does it, for free, because it flatters them.

**Do this**: make the moment of airing shareable. When a member's clip airs,
they should be able to post *"I was just on CSGN"* with a graphic in one tap.
This is not built yet and it is the highest-ROI unbuilt feature in the product.

## 7. The 90-day plan

### Days 1–30 — make it undeniable

Goal: **the channel is visibly alive and the loop visibly completes.**

- Run the channel every single day. Uptime is the product.
- Get to **10 connected Twitch channels**. Personal outreach, one at a time.
- Get **one member carried live, publicly, every day** — even for twenty
  minutes. The schedule record is the proof.
- Post the Meme 100 top 10 daily, tagging projects.
- Ship the "I was on CSGN" share card.
- **Do not run a price campaign.** There is no depth to absorb it.

Success looks like: 10 roster members, 30+ clips in rotation, a schedule with
names on it every day for 30 days.

### Days 31–60 — turn the audience into holders

Goal: **make buying $CSGN the obvious move for someone already watching.**

- Every surface answers "how do I get more airtime" in one tap. (Mostly done.)
- Publish the airtime ledger: *who got how many seconds yesterday, and why.*
  Transparency here is a marketing asset, not a compliance chore — it is proof
  that ownership does something.
- Run the **first jukebox campaign** aimed at projects, not traders: "12 hours
  of spotlight on a live channel, bid in $CSGN." Every bid is a buy.
- Start the outreach to 50–500-viewer streamers in volume. Target 30 connected.

Success looks like: 100+ holders, daily jukebox bidding, graduation in sight.

### Days 61–90 — the run

Goal: **graduate and hold above it.**

- Land one recognisable name as a guest — a founder, a known streamer, anyone
  whose audience is real. One credible guest is worth a hundred posts.
- Launch the **CSGN Originals block** as one weekly appointment show. One. A
  weekly thing people plan around beats a nightly thing that skips.
- Now run the price-facing campaign — but the pitch stays *airtime*, and every
  post points at a channel that has been on air for 90 consecutive days.

Success looks like: graduated, 150+ holders, 30 roster channels, a schedule
somebody could describe to a friend.

## 8. What NOT to do

Every one of these is tempting and every one of them is how this dies.

- **Do not buy volume or use a volume bot.** It puts the token in front of
  traders, not creators, and traders are exactly the holders you cannot keep.
- **Do not launch a second token, an NFT, or staking.** Airtime is the utility.
  Anything else dilutes the one sentence that makes CSGN comprehensible.
- **Do not pay influencers for posts.** $2,000 to a paid account buys a spike
  and zero retention. $2,000 spent as fee payouts to five real streamers buys
  five doorways to real audiences.
- **Do not chase a listing.** A listing on a thin token is an exit for whoever
  is holding, not an entrance.
- **Do not let the channel go dark to work on features.** A day off air costs
  more credibility than a week of features earns.

---

# PART THREE — KING OF THE NICHE

## 9. Name the niche precisely

"Crypto TV" is not a niche, it is a category with no incumbent because nobody
wants it. The niche CSGN can actually own is narrower and much more winnable:

> **The channel crypto watches while it trades.**

Second-screen, always-on, ambient. Not something you sit down for — something
you leave on. That reframes the competition: you are not competing with
YouTube, you are competing with a muted CNBC stream and a Telegram tab. Both are
beatable.

It also tells you what the content has to be: **glanceable**. Tickers, the Meme
100, the jukebox, short clips, a live face when there is one worth carrying.
Everything currently built is already the right shape for this. Lean into it
rather than drifting toward long-form.

## 10. The presence plan

**One channel, done properly, beats five done badly.** That channel is X,
because that is where this audience already is and because the broadcast already
streams there.

| Cadence | Post | Why |
|---|---|---|
| Daily | Meme 100 top 10, projects tagged | Compounding free reach |
| Daily | "On air now" with a graphic | Proves the channel exists |
| Per event | "X was just on CSGN" when a member is carried | Streamer amplifies |
| Per event | Jukebox winner announcement | Winning project amplifies |
| Weekly | The airtime ledger — who got what | Proof the token works |
| Weekly | One clip of the week | Shareable, flatters a member |

Two rules for all of it:

1. **Always tag someone who benefits from resharing.** A post that flatters
   nobody gets no reach.
2. **Never post about the price.** A channel that talks about its own chart
   reads as a token with a channel attached. You want the reverse.

### The asset that does the most work

The **OBS graphics package** (`docs/obs/`). Every graphic that goes out is a
screenshot somebody might take. Broadcast-grade visuals are the single cheapest
way for a small project to look like an institution — and looking like an
institution is most of what "king of the niche" means at this size.

## 11. Fix these before scale, not after

Four things that are fine now and become serious at 10× the size.

| Fix | When it becomes urgent | What it looks like |
|---|---|---|
| **Alerts off the browser tab** | Now | Push the five operator alerts to Telegram or Discord via webhook. It is one function and it converts "I have to watch a board" into "the board tells me". |
| **Review triage** | ~50 clips/day | Auto-approve members with a clean history; review only first-timers. |
| **Automatic payouts** | ~20 streamers | The ledger already exists; the transfer is the manual step. |
| **A written takedown path** | Before any real growth | One page: how a streamer withdraws, how a rights-holder complains, how fast you act. |

---

## 12. If you do only five things

1. **Run the channel every day for 90 days without exception.** Uptime is the
   only unfakeable signal a network has.
2. **Post the Meme 100 top 10 daily, tagging every project in it.** Free,
   compounding, automatable.
3. **Personally recruit 20 streamers in the 50–500 viewer range.** One at a
   time. This is the growth.
4. **Ship the "I was just on CSGN" share card.** The cheapest marketing in the
   product, done by the members themselves.
5. **Sell airtime, never the token.** 150 people who bought $400 for a reason
   beat 10 who bought $8,000 for a chart, every single time.

---

## 13. The honest odds

**Getting to $1,000,000 market cap: genuinely achievable.** It needs $50–80k of
net buying, and the product gives 150 people a real reason to be part of it.
Most tokens at $3,600 cannot say that; almost none of them have something to
sell that isn't the token itself.

**Getting there and staying there: harder, and it depends on one number** —
whether the channel has viewers. Airtime allocated perfectly on a channel nobody
watches is worth nothing, and the market will price that correctly. Every
recommendation above is ultimately in service of that one variable.

**The thing that would make me most confident**: a week where a member is
carried live every single day, three clips air from three different people, and
the schedule has names on it a stranger could scroll through. That week is
cheap, it requires no capital, and it is the difference between a project and a
network.

---

*Assumptions on curve and pool arithmetic in §4 should be re-checked against the
live pool before any decision rests on them. Everything else here is derived
from the product as it now stands in this repository.*
