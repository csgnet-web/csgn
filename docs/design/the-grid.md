# The Grid — the cap table is the programming schedule

> **Status: design.** The community programming layer. It answers the two questions the
> project has never answered together: *what does the token actually do*, and *what plays
> during the sixteen hours nobody has claimed?*
>
> The answer is the same answer. **The 16 open hours are allocated 1:1 to supply share,
> every day, and holders fill them with video.**
>
> Companion to [`token-economics.md`](token-economics.md) (why this is sound, and the
> investor case), [`csgn-share.md`](csgn-share.md) (the ratings that decide placement),
> and [`token-voting.md`](token-voting.md) (supply share, hold age, the Draft).
> Sequenced by [`../plan.md`](../plan.md).

---

## 0. The one-paragraph version

CSGN broadcasts twelve two-hour blocks a day. Four of them — 7 PM to 3 AM ET — are CSGN
Originals and are not touched by anything in this document. The other eight, **3 AM to
7 PM ET, sixteen hours**, are open. Today they are open in the sense that a room with no
furniture is open. Under the Grid they are allocated **pro rata to $CSGN supply share**,
every day, and the people who hold that supply decide what plays in their seconds — by
uploading it, or by pointing their seconds at somebody else's video. Anyone who claims a
slot and goes live still bumps the whole thing, instantly. Nothing is locked, spent,
escrowed or burned. **You hold, you get television.**

---

## 1. The arithmetic, which is the entire pitch

The schedule template already exists in
[`../../netlify/functions/_shared/schedule.ts`](../../netlify/functions/_shared/schedule.ts):
eight `open` blocks at 3, 5, 7, 9, 11, 13, 15 and 17 ET, four `network` blocks at 19, 21,
23 and 1. Sixteen open hours is **57,600 seconds**, so:

| You hold | You program |
|---|---|
| 1% of supply | **576 seconds** — 9 min 36 s, every day |
| 0.5% | 288 s — 4 min 48 s |
| 0.1% | 57.6 s — about one clip |
| 0.01% | 5.8 s — a bumper |

> **1% of the network is 1% of the day.**

That sentence is checkable by a stranger with a calculator, it means the same thing at any
price and any market cap, and it is the first description of $CSGN that does not contain
the word "utility."

**Seconds expire.** Unused airtime does not bank, does not compound, and cannot be sold.
It reappears tomorrow. This is deliberate: an expiring allocation is a prompt, and *"you
have 9 minutes of television today and nothing in it"* is a far stronger prompt than an
empty schedule page has ever been. Loss aversion recruits; an open invitation does not.

---

## 2. Producers and Talent

The Grid creates two roles, and naming them properly is most of the product design.

**Producers** are holders. They own seconds. They do not vote on what airs — voting is a
committee, and committees are not television. They *program*: they choose what runs in
their own time, the way a person who bought the hour would.

**Talent** are the people who make the video. Anyone. No token required, ever.

A Producer with 9 minutes and nothing to put in them, and a creator with a good video and
no tokens, need each other. That is the whole ecosystem in one sentence:

> **Creators campaign to holders instead of to us.**

CSGN never picks winners. It publishes the tally, renders the graphics, and runs the
clock. That is the same posture as the ratings book in [`csgn-share.md`](csgn-share.md),
and it is the only posture that scales past one person's taste.

Two consequences worth stating plainly:

- **Holding becomes a job title, not a bet.** "I'm a producer on a TV network" is
  something a 22-year-old will say out loud. "I'm a governance participant" is not.
- **Whales become talent scouts.** The largest holder has the most airtime to fill and
  the most to lose from filling it badly (§4). The rational move for a big bag is to go
  find good video, which is exactly the behaviour a network wants from its biggest
  stakeholder.

---

## 3. Precedence — live always wins

The Grid is the **floor** of the schedule, never the ceiling. For any open block, in
order:

| Priority | State | Source |
|---|---|---|
| 1 | `OVERRIDE` | Admin. Unchanged |
| 2 | `LIVE` / `STARTING_SOON` / `BRB` | A claimed slot, or a Draft winner ([`token-voting.md`](token-voting.md) §3) |
| 3 | **`GRID`** | *New.* Producer-directed video for that block |
| 4 | `INTERMISSION` | The existing board + `VodRotator` |

This is an extension of the state machine already shipped in
[`../../src/lib/masterControl.ts`](../../src/lib/masterControl.ts), whose initial state is
already `INTERMISSION` — the network already refuses to show nothing. `GRID` slots in
above that fallback and below every live path, so:

- **The channel is never empty again.** That is the point, and it is worth more than any
  individual feature in this document.
- **Going live is visibly an upgrade.** Claiming an hour now *displaces scheduled
  programming* instead of filling a hole. That makes claiming an event, gives the
  claimant an audience that was already there, and gives the ticker something to say.
- **Nothing about the existing claim flow changes.** The Grid is additive. An hour nobody
  drafts and nobody claims used to be dead air; now it is programming.

**Supplanted Producers are made whole.** If a live claim takes a block, the seconds
scheduled into it roll to tomorrow, capped at 2× a normal day's allocation so the rollover
can never snowball. A Producer should never have a reason to resent a streamer going live
— that would set the two halves of the network against each other, which is the one
outcome the design cannot survive.

---

## 4. The ladder — quality without an editor

Allocate airtime purely by holdings and a whale can put a quarter of the day to sleep.
This is the real objection to the whole design and it needs a mechanical answer, not a
moderation answer.

> **Ownership buys you minutes. Ratings buy you primetime.**

Two axes, and the second one already exists on paper.
[`csgn-share.md`](csgn-share.md) §2.3 defines four ET dayparts that map exactly onto the
sixteen open hours:

| Daypart | ET | Role on the ladder |
|---|---|---|
| **Overnight** | 3 AM – 7 AM | Where everyone starts. Tiny audience, cheap share, nothing to lose |
| **Early** | 7 AM – 11 AM | EU close, US pre-market |
| **Daytime** | 11 AM – 3 PM | US market hours |
| **Fringe** | 3 PM – 7 PM | The prize. Best audience of the four, and it hands off into Prime |

**How many seconds you get is your supply share. Which daypart they land in is your
trailing CSGN Share.** Promotion and relegation, published, mechanical, recomputed on a
fixed cadence.

The properties that fall out of it:

- **A whale with bad content self-relegates to 4 AM.** No one has to make a judgement
  call, and no one can accuse us of one.
- **A creator with a hit climbs.** Talent with zero tokens can reach Fringe on the
  strength of somebody else's seconds, which is what keeps the door genuinely open.
- **It is promotion/relegation**, which this audience reads natively and argues about for
  free.
- It makes [`csgn-share.md`](csgn-share.md) load-bearing instead of aspirational — the
  ratings book stops being a marketing artifact and starts deciding something.

**Start the ladder off.** Until there are four weeks of share data the ladder has nothing
to rank on, so v1 places by rotation and recency and the ladder switches on when the data
exists. Say that publicly rather than shipping a ranking computed from noise.

---

## 5. Cold start — the Charter 50

The honest position: a network needs roughly **fifty people reliably supplying content**
before calling itself a network is true rather than aspirational. It does not have them.
Nothing in the product currently recruits them, and the Grid does not conjure them either
— it gives them a reason.

**Make the bar public and make it a countdown.**

```
        ┌─────────────────────────────┐
        │  CHARTER CONTRIBUTORS       │
        │                             │
        │        37 / 50              │
        │                             │
        │  the network declares       │
        │  itself at fifty            │
        └─────────────────────────────┘
```

On air, on `/watch`, on the ticker, in every post. Why it works:

- **It is scarce, and the scarcity is real** — there will only ever be a first fifty.
- **It costs nothing to give.** A badge, a permanent row in the credits, a name read on
  air. The same property that makes the Charter holder badge work in
  [`token-voting.md`](token-voting.md) §4: money cannot accelerate it, and after the
  fiftieth it cannot be bought at any price.
- **It is a recruitment ad that runs itself**, and it converts the project's weakest
  number into its most compelling one. A countdown from 37 is interesting. "We have 37
  contributors" is not.
- **Crossing 50 is an event**, not a metric — an on-air declaration, an essay, a clip.
  [`../plan.md`](../plan.md) sequences it as the midpoint of the quarter, which is what
  gives the campaign an arc instead of a checklist.

Be straight about the ordering problem: **until contributors exist, the Grid is thin.**
The fallback ladder in §3 carries it, the house library and reruns fill the rest, and the
counter tells the truth about how thin it is. A grid that is 20% full and honest about it
is a better artifact than a grid padded with filler and described as full.

---

## 6. Getting video in — links now, uploads at fifty

### 6.1 What already exists

The Grid is not a new subsystem. It is
[`../../src/components/player/VodRotator.tsx`](../../src/components/player/VodRotator.tsx)
with an owner column and a clock.

| Need | Already shipped |
|---|---|
| Playing a VOD on air | `VodRotator` — plays MP4, and **advances on error so the network never stalls** |
| The playlist document | `config/vodPlaylist`, read in `src/pages/Player.tsx`, admin-managed |
| Degrading to nothing gracefully | `VodRotator` already falls back to `IntermissionBoard` on an empty list |
| Playing other people's video | the Twitch / Kick / YouTube path `/player` already uses for live forwarding |
| Never-dead-air discipline | `INITIAL_STATE` is `INTERMISSION` in `masterControl.ts` |

The work is the allocator — a daily job that turns supply shares into a running order —
plus an upload surface. The playout half is done.

### 6.2 V1: paste a link

An unlisted YouTube URL, a Twitch clip, an X video, or a direct MP4. `VodRotator` already
handles the last case; the rest reuse the embed path the player uses for live forwarding.

**Zero hosting cost, zero transcoding, no new vendor, no new attack surface.** It ships
against code that exists, which is the only reason to do it this way first — the point of
v1 is to find out whether people will supply video at all, and paying a CDN to answer that
question is the wrong order.

### 6.3 V2, at Charter 50: real upload

A TikTok-shaped upload surface, once fifty contributors have proved the demand. The cost
objection dies on one observation:

> **A linear channel delivers each video once — to the encoder — no matter how many people
> are watching.**

CSGN's output is a single OBS browser source feeding a single RTMPS push to X. Ten
thousand viewers do not multiply the origin fetch; X's CDN carries them. So the playout
bill is a function of *the clock*, not the audience:

| | At Cloudflare Stream rates | Note |
|---|---|---|
| Playout | 16 h/day ≈ 29,200 min/month × $1 per 1,000 min ≈ **$29/mo** | Delivery |
| A 5,000-minute library | × $5 per 1,000 min ≈ **$25/mo** | Storage |
| **Total** | **≈ $55/month** | Bunny Stream is roughly half again |

Rates: [Cloudflare Stream](https://blog.blazingcdn.com/en-us/cloudflares-pricing-for-video-streaming-services)
($5 per 1,000 min stored, $1 per 1,000 min delivered) and
[Bunny Stream](https://bunny.net/pricing/stream/).

**The part that does scale with viewers is on-demand browsing on the website** — a viewer
scrolling a library streams from the origin. Cap it, defer it, or serve it from the same
per-minute meter with a hard monthly ceiling. Given the cost discipline in
[`../ops/backend-hardening.md`](../ops/backend-hardening.md), that ceiling should be set
before the feature ships, not after the invoice.

---

## 7. Moderation — the largest new risk, named

This is the biggest operational surface the project has ever taken on, and softening it
here would be dishonest. **The output goes to X under the network's name.** One bad
sixty-second clip at 4 AM is an account-level problem, not a support ticket.

**Review before air. Always. No auto-publish, ever.** The Grid computes the running
order; a human clears every new contributor's first items. Once a Producer has a clean
record their subsequent uploads can go to a lighter-touch queue, but the first ones never
do.

**Mechanical eligibility, published, checked before a human ever looks:**

- duration bounds and a resolution floor
- no third-party music — the venue-licensing problem in
  [`../archive/ecosystem-strategy.md`](../archive/ecosystem-strategy.md) §4.4 applies to
  the feed itself
- **every paid placement labelled `PAID SPOTLIGHT` on screen.** The jukebox rule from
  `master-plan.md` §11.2 extends to VOD verbatim and is not negotiable: unlabeled paid
  promotion of a financial asset is the single mistake that can actually end a network
- rights attested by the uploader at submit time, in a checkbox with their wallet on it

**Strikes attach to the wallet, not the upload.** Producer-level accountability is the
only version that scales, and it reuses the wallet-as-identity model already shipped in
`signupWithPhantom`. Three strikes suspends the *account's* ability to direct seconds; the
tokens are untouched, because confiscating someone's holdings for a content violation
would break the one promise the token actually makes.

**Uploaded is not owned.** This is the standing risk, and it is the same one flagged for
forwarding in [`../archive/onchain-thesis.md`](../archive/onchain-thesis.md) §7: someone
will upload something they don't have the rights to, and an attestation checkbox is a
defence, not a shield. Budget for takedowns as an ordinary operating cost.

---

## 8. Partner Day — one toggle

The Grid reads exactly one mint-specific thing: a wallet's balance. Generalise that and
the entire mechanic becomes rentable to any token, on a switch.

```
config/partnerDay
  enabled      boolean          — the switch
  mint         string           — the partner SPL mint
  name, symbol string           — for the on-air furniture
  gridShare    0.0 – 1.0        — how much of the day is reallocated
  startsAt, endsAt              — the window
  disclosure   string           — the on-air affiliation line (§8.3)
```

When `enabled`, `gridShare` of the day's seconds are allocated by **the partner mint's**
supply share instead of $CSGN's. Everything downstream — the ladder, review, playout,
graphics — is unchanged, because none of it knows which token it is counting.

### 8.1 The one code change it needs

`getCsgnBalance(wallet)` becomes `getTokenBalance(wallet, mint)`. That's it. The read is
already isolated, and the generalisation is scoped as packet **B2** in
[`../archive/agent-packets.md`](../archive/agent-packets.md). The admin toggle sits beside
the existing `GameControlsCard` / `TickerControlsCard` pattern, so it flips **live, from a
phone, with no deploy** — on to promote a partner, off to put the focus back on the
content.

### 8.2 Why a partner wants it — the supply-side argument

State it once, sharply, because it is the part that lands:

> **Most token utility creates sell pressure. Holdings-rationed utility creates only buy
> pressure.** A token you *spend* reaches the market. A token you must *hold* to use never
> does.

Every "utility" a memecoin gets offered is a sink that ends with a market maker holding
the bag and selling it. The Grid has no sell leg anywhere in it. Nothing is spent, sent,
locked, escrowed, staked or burned — the mechanism reads a balance and nothing else. The
only way to get more airtime is to hold more, and the only way to lose it is to sell.

For **$ANSEM** specifically, which launched on pump.fun in June 2026 and has **no product,
no roadmap and no revenue behind it**
([crypto.news](https://crypto.news/what-is-ansem-coin-solana-influencer-memecoin-explained/),
[Phemex](https://phemex.com/academy/who-is-ansem-solana-trader-ansem-token-frenzy)):

1. **It would be the token's first mechanism of any kind.** Not its best one — its only
   one.
2. **It converts a pure attention asset into a claim on attention.** That is the correct
   thematic shape for a coin named after a caller, and it reads well on air.
3. **The ask is nothing.** No build, no signature, no integration, no appearance, no
   treasury movement. The mechanism works on a public mint whether or not anyone
   participates.
4. **It is non-exclusive by construction**, which is what keeps CSGN a product rather
   than a dependency — the tenancy argument from `master-plan.md` §11.3.

### 8.3 How it launches, and what CSGN refuses

**Built, configured, switched off, and demoed.** The right move is not a pitch; it is
showing someone a working takeover of a real television network with their ticker on it
and their holders programming it, and asking whether they'd like it turned on. Then
flipping one boolean. That is the zero-outreach version, and it is also the version that
respects the "ask first" doctrine the project already holds on anything using someone
else's name.

If a partner day ever runs without an explicit yes, the `disclosure` field is not optional
and the on-air line reads **"unaffiliated — $CSGN network surface"**. Reading a public
mint's balances is not a rights problem; implying an endorsement is.

The refusal list from `master-plan.md` §11.5 carries over unchanged:

- **No token merge, no swap, no shared treasury.**
- **No equity or governance over CSGN itself.** Partner tokens govern partner surfaces.
- **No exclusivity.** The surface stays open to everyone.
- **No core access gated behind a partner token.** Promotion, never admission.
- **Money spent on a partner's own surface goes to the partner's treasury** (§11.1);
  CSGN bills a flat sponsorship fee instead of taking a cut of their holders' flow.

---

## 9. The data model

```
grid/{etDate}
  status: computing | scheduled | live | settled
  holderDaySeconds        57_600
  partnerDay?             { mint, symbol, gridShare }
  computedAt, seed        — the allocation is reproducible

grid/{etDate}/blocks/{slotId}
  daypart                 overnight | early | daytime | fringe
  runningOrder: [{ producerWallet, itemId, seconds, startsAt }]
  supplantedBy?           slotId claimed live → seconds rolled

producers/{wallet}
  secondsToday, secondsRolled, streak
  charterNumber?          1–50, permanent
  strikes, standing

items/{itemId}
  ownerWallet, kind: link | upload, url, durationSec
  status: submitted | cleared | rejected | retired
  reviewedBy, reviewedAt, rejectionReason
  share7d, daypartRank    — feeds the ladder
```

`grid/{etDate}/blocks/*` is world-readable so the OBS browser sources can poll it
unauthenticated over the Firestore REST API, exactly as `config/ticker` already does.
`producers/*` and `items/*` stay server-only, matching the pattern used for
`votes/{id}/ballots/{wallet}`.

**Rounding.** Seconds are integers and the allocation must reconcile to 57,600 exactly.
Distribute the remainder largest-share-first and log it — a schedule that doesn't add up
is a bug report every single day.

---

## 10. Build order

Each step is independently useful and independently shippable.

1. **Read-only accrual.** Show every holder their seconds. No uploads, no playout, no
   risk. This is the daily notification and the entire pitch, and it is a display layer
   over a balance read the app already does.
2. **Submissions by link** + the review queue. Nothing airs yet.
3. **The allocator** — the daily job that turns shares into a running order. Ships dark;
   compare its output against what an operator would have scheduled.
4. **`GRID` in master control**, one daypart only. Overnight, where the audience is
   smallest and the cost of getting it wrong is lowest.
5. **The Charter 50 counter**, live everywhere, from day one of step 2 — it recruits the
   contributors that steps 3 and 4 need.
6. **All four dayparts**, once step 4 has run a month without dead air.
7. **The ladder**, once [`csgn-share.md`](csgn-share.md) has four weeks of data.
8. **Partner Day**, built and dark.
9. **Uploads**, at fifty contributors.

---

## 11. What to be honest about

**The first version will look thin.** Twenty percent of sixteen hours is three hours of
real programming and thirteen of reruns and board. Publishing the fill rate honestly from
day one is the only thing that will make a full grid credible later — the same argument
[`csgn-share.md`](csgn-share.md) §8 makes about publishing a 3 share.

**Ratings-based placement can entrench.** Whoever wins Fringe early accumulates the
audience that keeps them there. The rotation term exists to fight it, and it will need
tuning in public.

**A whale can still be annoying**, just not in primetime. Twenty-five percent of Overnight
is a real amount of bad television, and the honest answer is that it airs at 4 AM and the
ladder is doing its job.

**This is a content-moderation business now.** The project has spent a year being an
infrastructure business where the worst outcome was a wrong number on a screen. §7 is not
a section to skim.

**Nobody may show up.** The Grid is a supply-side bet: that people want television more
than they want a governance vote. If fill rate is under 20% at day 60,
[`../plan.md`](../plan.md) says to fall back to curated house VOD and say so publicly. The
mechanism would be wrong, not the audience.
