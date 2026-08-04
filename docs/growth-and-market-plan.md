# CSGN — position, economics, and the plan forward

An honest assessment of where this project stands, what the numbers actually
require, and what to do for the next six months.

Everything here is written to be argued with. Where a figure is an assumption it
says so, and the formulas are given so you can re-run them against live data
instead of trusting a number someone wrote down in August.

---

## 1. Where the project actually stands

**The build is the strongest asset, and it is stronger than most of what it will
be compared to.** That is not flattery, it's the finding of having read all of
it. Specifics that matter to a technical evaluator:

- `/player` is a real broadcast system, not a page with an iframe. A unit-tested
  state machine, a playback gate that refuses to reveal a feed until frames are
  confirmed advancing, deterministic ad masking, wedge detection with rebuild,
  and fail-open deadlines so the network can never sit dark. The comments
  explain *why* each guard exists, usually naming the incident it came from.
- Money paths fail loud rather than silent. Payment verification distinguishes
  "no payment found" from "couldn't reach the chain," which is the distinction
  most projects get wrong exactly once and expensively.
- Cost engineering is deliberate: one shared Firestore listener per session,
  bounded query windows, server-side polling fanned through single documents,
  TTL caches with stampede protection, and rules that refuse unbounded anonymous
  list queries.
- 560 tests, typed end to end, MIT licensed, documented well enough that someone
  could genuinely run their own node.

**The weakest asset is distribution.** There is a working network and no
audience. That asymmetry is the whole strategic problem, and everything below is
about it.

**The genuinely novel idea** is not "streaming plus crypto" — that has been
tried repeatedly and mostly failed. It is that *the streamer is paid out of the
trading fees generated while they are on screen*, verifiably, on-chain. That is
a real alignment mechanism: attention creates volume, volume creates fees, fees
pay the person creating the attention. Nobody has to be told to believe in it;
it either shows up in a wallet or it doesn't.

That is also the thing to lead with everywhere, because it is checkable. Which
brings us to the numbers.

---

## 2. The economics, with the real fee schedule

These come from `netlify/functions/_shared/feeCalc.ts` — the same tiers the
product pays against, not an estimate.

pump.fun's creator fee rate **declines as market cap rises**:

| Market cap (SOL) | ≈ USD at $200/SOL | Creator fee rate |
|---|---|---|
| 420 – 1,470 | $84k – $294k | 0.95% |
| 9,820 – 14,740 | $1.96M – $2.9M | 0.70% |
| 24,560 – 29,470 | $4.9M – $5.9M | 0.55% |
| 49,120 – 54,030 | $9.8M – $10.8M | 0.35% |
| 98,240+ | $19.6M+ | **0.05%** |

The project keeps 70% of the creator fee; the streamer on air gets 30%.

```
founder / treasury income  =  volume × creator_fee_rate × 0.70
streamer income for a slot =  slot_volume × creator_fee_rate × 0.30
```

### 2a. What $5,000–10,000/month actually requires

Volume needed, by market cap, for the treasury side alone:

| Market cap | Fee rate | Daily volume for $5k/mo | Daily volume for $10k/mo |
|---|---|---|---|
| ~$2M | 0.70% | **$34k** | **$68k** |
| ~$5M | 0.55% | $55k | $110k |
| ~$10M | 0.35% | $68k | $136k |
| ~$20M | 0.05% | $476k | $953k |
| ~$100M | 0.05% | $476k | $953k |

*(Assumes SOL ≈ $200; re-run with the live price. Daily volume = monthly ÷ 30.)*

**This is the single most important finding in this document, and it inverts the
question you asked.**

At a ~$2M market cap you need **$68k/day** of volume to clear $10k/month. That
is an ordinary, achievable number for a Solana token with a real community —
roughly 3% daily turnover.

At a ~$100M market cap you need **$953k/day** — fourteen times more volume — to
earn *the same money*, because the fee rate has collapsed from 0.70% to 0.05%.

**The $100M market cap goal and the $5–10k/month income goal actively fight each
other.** They are not the same objective and pursuing the first is the slower
route to the second. Income comes from *turnover at a modest cap*. Market cap is
a separate, valuation-shaped goal — worth wanting, but as an exit or fundraising
outcome, not as an income strategy.

If the actual priority is "replace my salary and keep building," the target is
**$2–10M market cap with high, sustained turnover**, and you can stop optimising
for the headline number entirely.

### 2b. When streaming becomes worth a streamer's time

This decides whether the supply side of the marketplace ever works.

A 2-hour slot earns `slot_volume × rate × 0.30`. Assuming volume is spread
evenly across the day (it isn't — being on air during US prime time is worth
more, which is a real thing to tell streamers):

| Daily volume | Market cap ~$2M (0.70%) | Market cap ~$10M (0.35%) |
|---|---|---|
| $68k | $12 per 2h slot | $6 |
| $250k | $44 | $22 |
| $500k | $88 | $44 |
| $2M | $350 | $175 |

**Below roughly $500k/day volume, nobody streams for the money.** A Twitch
partner with 100 concurrent viewers makes more from subs in two hours. Early
streamers must be recruited on something else — exposure to a new audience,
being early to a network, token upside, or simply that it costs them nothing
because they were streaming anyway.

That last point is the honest pitch and it is strong: **"keep streaming exactly
what you already stream, on your own channel, and get paid an extra amount on
top."** Zero switching cost is the entire supply-side argument until volume is
real. Do not oversell the payout early — a streamer who was promised $200 and
receives $12 never comes back, and the on-chain record means you cannot quietly
round up.

---

## 3. The honest answer on $100M in six months

**Probability: low. Low single-digit percent, and that is being generous.**

Base rates matter here. An enormous number of tokens launch on Solana; the
fraction that ever touch a $100M market cap is a small fraction of one percent,
and of those that touch it, most do not hold it for a month. Six months is also
the wrong duration for a *product* to compound — it is the duration in which a
*narrative* can compound, which tells you which lever actually moves that number.

What would have to be true, roughly in order of how much each matters:

1. **A cultural moment, not a feature.** Nothing at $100M got there by shipping.
   They got there because something became briefly unavoidable — a personality, a
   feud, a stunt, a format people screenshot. The product is what makes it *stick*
   after; it is almost never what causes it.
2. **A recognisable human at the front.** Anonymous infrastructure does not
   command that valuation on a six-month horizon. Your personal account matters
   more than the project account, and the plan below reflects that.
3. **One genuine flagship moment** — a tournament, a named creator going live on
   CSGN, an on-chain payout that is large enough to screenshot.
4. **Liquidity depth that survives the attention.** Thin books turn a spike into
   a wick and a wick into a permanent credibility loss.

What is *substantially* more likely, and worth naming as the real plan:

| Outcome | 6-month odds | Why |
|---|---|---|
| $5–10k/month income from fees | **Realistic** | Needs $68k/day volume at a $2M cap — see §2a |
| $2–10M market cap held | **Plausible** | A working product plus consistent output gets here without a miracle |
| Portfolio/hiring outcome from the codebase | **High** | The build already justifies this today |
| $100M market cap | **Low single digits** | Requires a cultural moment you cannot schedule |
| Acquisition or funded round | **Moderate** | The product and the fee mechanism are genuinely fundable |

The strategy that follows is built to make the realistic outcomes near-certain
while keeping the outlier possible — because the actions are the same ones
either way, and the difference is whether a moment lands on top of them.

---

## 4. The problem to solve first: cold start

CSGN is a two-sided marketplace with a circular dependency:

> streamers come for money → money comes from volume → volume comes from
> attention → attention comes from streamers

Every two-sided marketplace breaks this the same way: **one side is faked or
subsidised until the other is real.** For CSGN, the side you can control is the
supply side, and the way you subsidise it is with your own face.

**You are the first streamer. Not as a placeholder — as the product.** For the
first 90 days CSGN is a show that happens to have a network behind it, not a
network waiting for shows. This resolves the loop because your streams generate
the attention that generates the volume that makes the payouts real enough to
recruit streamer #2 with a screenshot instead of a pitch.

Concretely, three things must be true before you recruit anyone:

1. **The network is never dark.** Intermission programming is already built; use
   it. A visitor who arrives to a black screen does not come back.
2. **At least one payout has happened and is public.** One transaction hash and
   a screenshot is worth more than any amount of copy.
3. **The claim flow works on a phone, first try.** Most of the people you want
   arrive on mobile from X. (Sign-up is now one wallet signature — this is in
   good shape.)

---

## 5. Content plan

### 5a. Your Twitch — the credibility engine, not the income

Set the expectation correctly: **Twitch will not produce $5–10k/month at the
scale you will realistically be at this year.** Affiliate subs net roughly $2.50
each; $5,000/month means about 2,000 active subs, which implies a channel far
larger than a new one gets in six months. At 20–100 concurrent viewers, expect
somewhere in the low hundreds per month from Twitch directly.

That is fine, because Twitch is not the income line. **The fee stream is the
income line** (§2a), and Twitch is what creates the volume that feeds it.

What to actually stream — the format follows from the product:

- **A market show, live, on a fixed schedule.** 3–4 sessions a week, same days,
  same time, 2–3 hours. Consistency beats production value; a schedule people
  can plan around is the single biggest driver of returning viewers.
- **Trade or analyse live with the CSGN ticker on screen.** The broadcast
  graphics already exist. The overlay showing live fees accruing *is the pitch* —
  viewers watch a number go up that is provably shared with whoever is on air.
- **Bring guests.** Every guest is a candidate streamer for the network, and
  guesting is a much easier ask than "claim an hour on my platform."
- **Do the payout on stream.** Run the payout, show the transaction, show the
  wallet. That clip is your best recruiting asset and it costs nothing to make.

The realistic Twitch ladder: 10–20 CCV in month 1 is normal and not a failure
signal; 50–100 by month 3 with consistency; 200+ by month 6 needs either a raid
economy or a moment. Do not chase Twitch CCV as an end — chase the clip volume
it produces.

### 5b. X — two accounts with different jobs

**Do not run them the same way.** This is the most common mistake and it wastes
one of the two accounts.

**Founder personal account — the growth engine.**
People follow people. This account carries opinion, calls, receipts, and
personality. It is where the $100M scenario would actually start, if it starts.

- 3–5 posts/day minimum, of which most are replies. Replying under larger
  accounts in your niche is still the highest-leverage growth mechanic on X, and
  it is unglamorous enough that most people won't do it consistently.
- Post the build. "Shipped wallet-only sign-up, one signature, here's why email
  was the wrong credential" is a genuinely good post and you generate several a
  week just by working. Technical founders under-post their own work by an order
  of magnitude.
- Take positions. An account with no opinions is an account with no reason to
  follow it. This is a risk surface and it is also the entire mechanism.
- Long-form threads sparingly — one strong thread a week beats five weak ones.

**@CSGNet — the proof account.**
This one does not chase followers, it accumulates evidence. Payout receipts,
who's live now, schedule announcements, clip highlights, milestone numbers.
Every post should be something a skeptic could verify.

**On X monetisation, honestly:** X's creator revenue share pays against
engagement from verified users and is, for accounts of the size you'll reach in
six months, a modest line — realistically tens to low hundreds of dollars a
month, occasionally more on a viral month. Treat it as a rounding error, not an
income stream. The account's value is distribution, and distribution converts to
volume, and volume is where the money is.

### 5c. On "1,000+ concurrent viewers on X at all times"

This is the one goal in your list I'd push back on, for two reasons.

**It's the wrong metric, and sophisticated investors know it.** A 24/7 stream
sitting at a flat concurrent number is the signature of either bot traffic or
idle tabs, and anyone who has evaluated a streaming asset will read it that way.
It invites the exact scrutiny you don't want.

**What actually impresses,** in roughly descending order:

1. **Cumulative fees paid to streamers, on-chain and verifiable.** This is your
   unfair advantage. No competitor can fake it and any investor can check it
   themselves in a block explorer. Lead with this number in every deck.
2. **Supply-side retention** — how many distinct streamers claimed a slot, and
   what share came back for a second. A marketplace that retains supply is a
   marketplace. This is the number a serious investor asks for third and most
   projects cannot answer.
3. **Volume/market-cap turnover ratio.** Shows a live market rather than a dead
   chart, and it is exactly what your fee revenue is a function of.
4. **Holder count trend**, especially holders who survived a drawdown.
5. **Peak concurrent during a scheduled event**, versus the baseline. A stream
   that goes from 40 to 900 for a tournament tells a growth story. A flat 1,000
   tells nothing.

Set the goal as **"1,000+ peak concurrent on a scheduled event by month 6"** and
publish the baseline alongside it. It is more achievable, more credible, and it
is a number you can be proud of instead of one you have to defend.

---

## 6. Six-month operating plan

**Months 1–2 — be the show.**
Fixed Twitch schedule, 3–4×/week, no exceptions. Network never dark. Ship the
first public payout with a transaction hash. Founder X to 3–5 posts/day.
@CSGNet posts every payout and every live slot. *Success = 8 consecutive weeks
of schedule kept, first payout public, one repeat guest.*

**Month 3 — recruit streamer #2 through #5.**
Only now, with receipts. Target small Twitch streamers (20–200 CCV) who are
already live at the hours you can't cover — the pitch is zero switching cost and
found money. *Success = 3+ distinct external streamers claimed an hour, at least
one returned.*

**Month 4 — the flagship event.**
One scheduled, promoted, unmissable thing. A tournament with a $CSGN prize pool,
or a named creator taking an hour. This is the first honest attempt at a moment.
Everything up to now exists to make sure the network doesn't embarrass you when
attention arrives. *Success = peak concurrent 5–10× baseline; volume spike that
does not fully retrace.*

**Month 5 — convert attention to structure.**
Whatever worked in month 4, make it recurring — a weekly named show, a standing
tournament. Recurring beats spectacular. Start the investor conversation now,
with six months of on-chain payout history as the lead artifact. *Success =
recurring format with a returning audience; deck built on verifiable metrics.*

**Month 6 — compound or reassess.**
If turnover is holding and streamers are returning, push distribution harder. If
supply-side retention is near zero after five months of real effort, that is
information: the payout is not yet worth a streamer's time (§2b), and the answer
is volume, not more recruiting.

---

## 7. Risks that could actually kill this

Listed because a plan that omits them isn't a plan.

1. **Twitch's Terms of Service on re-broadcast.** CSGN captures a streamer's
   Twitch feed and re-broadcasts it to X. Twitch has historically taken a dim
   view of rebroadcasting its streams to other platforms, and the exposure sits
   on *your* account and your streamers' accounts. **Get this checked properly
   before recruiting at any scale** — a takedown after you've onboarded fifty
   streamers is far worse than a redesign now. A "streamer opts in explicitly and
   we only mirror while they're claimed" posture helps but is not a legal
   opinion, and this document is not one either.
2. **Regulatory.** Paying people a share of token trading fees, promoting a
   token, and describing it as earnings touches securities and money-transmission
   questions that vary by jurisdiction. Worth an actual lawyer before the numbers
   get big enough to be interesting to someone else.
3. **The single OBS box.** The 24/7 promise currently depends on one machine in
   one room. Document the failover, or the first power cut is a public outage of
   the thing your pitch is named after.
4. **Founder bandwidth.** Streaming 4×/week, two X accounts at volume, recruiting
   streamers, and continuing to build is three full-time jobs. The realistic
   failure mode is not that the plan is wrong, it is that it is not survivable at
   that intensity for six months. Decide now what gets dropped in a bad week —
   drop building before you drop the schedule, because the schedule is the asset.
5. **The fee cliff.** Success at raising market cap *reduces* your fee rate
   (§2a). Model the crossover before you celebrate it, and be ready to explain to
   streamers why their per-slot payout fell when the chart went up. That
   conversation is much better had early.

---

## 8. The short version

- **The build is genuinely good and is already a portfolio-grade asset.** That
  outcome is in hand today, independent of the token.
- **$5–10k/month is realistic** and needs ~$68k/day volume at a ~$2M market cap.
  It does *not* need $100M — and chasing $100M makes it harder, because the fee
  rate collapses.
- **$100M in six months is a low-single-digit-percent outcome** requiring a
  cultural moment, not a feature. Build so that a moment *can* land; don't
  premise the plan on scheduling one.
- **You are the cold-start solution.** Be the show for 90 days, make one payout
  public, then recruit with receipts.
- **Lead every investor conversation with cumulative on-chain payouts to
  streamers.** It is verifiable, unfakeable, and nobody else in the category has
  it.
- **Trade the "1,000 CCV at all times" goal for "1,000+ peak on a scheduled
  event."** More achievable, more credible, and it survives scrutiny.
