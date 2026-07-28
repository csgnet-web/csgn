# CSGN — Master Analysis
### Thesis · Token Structure · Business Plan · Research

> **The single source of truth.** This document consolidates every prior planning
> file (forward-strategy, business-spec, founder-readout, consultant-review,
> token-design-space, marketing-audit — now deleted) into one analysis, rebuilt
> from first principles. Technical build docs (`obs-setup.md`,
> `broadcast-graphics.md`, `agent-packets.md`, `env-setup.md`,
> `ops-cost-security-runbook.md`, `v1-launch-checklist.md`) remain as operational
> references. **When anything disagrees with this file, this file wins.**

---

## 0. Executive summary

CSGN is building **crypto's entertainment flagship**: a broadcast-grade, 24/7
network where watching crypto and participating in it are the same act. It is the
pioneer of what the next crypto cycle will call **Attention Capital Markets (ACM)**
— treating attention itself as the underlying asset, and giving it a market, a
settlement layer, and a payout rail.

Three prongs make the network:
1. **The 24/7 stream** — always-on, broadcast-grade linear TV for crypto.
2. **The VOD / creator-channel system** — the infrastructure that lets anyone spin
   up their own channel and get paid for the attention their content commands
   (down to a reel of their VOD auto-playing) — a **digital third place**, and the
   next step of the TV-Internet convergence.
3. **The content & the attention it commands** — the actual programming and the
   audience it aggregates, which is the raw material of the ACM.

The token, **$CSGN**, is the **coordination and settlement token of this attention
economy** — *not* a deflationary meme. **We do not burn $CSGN.** Any $CSGN the
network receives goes to a **productive treasury** that funds distribution, creator
payouts, and liquidity. Value accrues to the token through (a) real demand to hold
it (governance/curation power + access tiers), (b) a growing, productive treasury
that recycles revenue back into the network (including buying $CSGN to pay
creators), and (c) the token being the unit of account for a compounding attention
market.

**Access is deliberately open.** Any verified user can claim up to 2 slots, free.
The token is *not* the gate on getting on air — it governs **attention**
(placement, promotion, spotlights), which is the genuinely scarce asset. Editorial
control comes from CSGN's own **Originals slate** owning the tentpole hours, the
way a broadcast network runs owned-and-operated programming alongside affiliates
(§2A).

The product is roughly a year ahead of its audience. **The entire near-term game
is distribution — a consistent Originals slate, a clip habit, a Discord "we're
live" ping, and hand-recruited creators and coin communities** — plus giving the
token a legible reason to be held. Not more features, and not burning supply.

---

## 1. The thesis

### 1.1 Attention Capital Markets
Every crypto cycle has a meta. DeFi financialized money; NFTs financialized
ownership; the next one **financializes attention.** friend.tech, pump.fun, and
the "livestream a coin" era were crude first drafts. The pattern underneath them:

> **Attention is the scarce asset. Whoever can measure it, allocate it, and pay it
> out on-chain owns the market for it.**

CSGN is purpose-built to be that venue. It already **produces** attention (the
broadcast), **prices** it (the jukebox, sponsorships, the meme-100 power ranking),
**allocates** it (holder governance decides what airs), and **pays it out** (creator
fees, treasury payouts). That full loop — produce → price → allocate → pay — is an
Attention Capital Market, and CSGN is the first entity building all four legs as a
real broadcast product rather than a speculative toy.

### 1.2 Crypto's entertainment flagship
Crypto has trillions in assets and no flagship entertainment brand. It has memes
and chaos, not a network. CSGN's unfair advantage is that it *looks and behaves
like a network* (ESPN-grade ticker, lower-thirds, scoreboards, master control) in
a category of webcams. The wedge is **live crypto markets + degen culture +
first-to-every-story** — the one content where the viewer and the trader are the
same person. Sports and video-game leagues are **retention and personality**, not
the wedge; they keep the community the wedge recruits.

**Positioning:** *The ESPN of crypto — coin-operated.* Hold the token, hold the
remote.

---

## 2. The three prongs (product architecture)

### Prong 1 — The 24/7 stream
Always-on linear TV via `/player` (a unit-tested master-control state machine),
the broadcast ticker, and over-live interstitials. Live creators when scheduled;
curated VOD + a network board otherwise. Never dead air. This is the **spine**:
the thing that makes CSGN a *channel*, not a website, and a 24/7 canvas for
attention.

**The O&O slate (CSGN Originals).** The anchor programming that gives the channel
its identity and supplies the clip factory:

| Show | Cadence | Job it does | Token hook |
|---|---|---|---|
| **The Whiparound** — daily crypto/news rundown | Daily, fixed ET hour | **The wedge.** Watching and trading in the same act; the appointment that makes CSGN a channel | Meme-100 reveal, Right Now rail, holder headlines |
| **CFB 27 Online Dynasty** | Series, 2–3×/week | **Retention + narrative.** A multi-week story people follow; the ticker already renders CFB | Recruiting/4th-down votes; coin-community team sponsorships |
| **Casual FPS block** (3–4 streams) | Rotating | **Personality + volume.** Fills hours, humanizes the network, low prep | Slate votes on what's played |

The Whiparound is the tentpole — build the daily habit around it first; Dynasty
is the serialized hook that gives people a *reason to come back on a schedule*;
FPS is the connective tissue that keeps the channel warm and the clip supply high.

**Sequencing note:** a daily show is the hardest commitment to keep and the
easiest to under-deliver on. Start the Whiparound at a length you can sustain
(15–20 min beats a 60-min show you skip twice a week) — consistency is the product.

### Prong 2 — The VOD / creator-channel system (the platform)
The compounding prong. CSGN's internal VOD system is being generalized so **any
user can create their own channel** and monetize the attention their content
commands — at every granularity, down to *a reel of their VOD auto-playing between
segments and the creator getting paid for those views.*

This is the **digital third place** — not home (feed), not work (charts), but the
communal channel you leave on. And it is the **next revolutionary step of the
TV-Internet convergence**: TV had passive linear programming; the internet had
on-demand and creators; CSGN fuses them — **linear, always-on, communal TV where
every second of attention is measured and paid on-chain.** No incumbent does this,
because no incumbent settles attention on a public ledger.

Mechanically: creator channels → VOD library → auto-programmed reels/segments →
per-view attention accounting → treasury payouts in $CSGN. The token is how value
moves between the audience, the creators, and the network.

### Prong 3 — Content & attention as capital
The programming itself (the nightly show, the Live Coin Battle, the meme-100
reveal, the game leagues) aggregates an audience whose attention is the ACM's raw
material. Every on-air moment is priceable inventory (a spotlight, a sponsorship,
a lower-third). CSGN doesn't sell ads against attention — it **runs a market for
it.**

---

## 2A. Programming, access & editorial control

### 2A.1 The core question: open claims *or* token-as-remote?
Today any verified user can claim **up to 2 concurrent future/live slots**
(`claimSlot.ts`; per-user override via `slotLimits.maxConcurrentClaims`, admins
exempt). Zero people have signed up yet. The tempting "crypto" move is to gate
slot access behind $CSGN — make the token the remote. **That would be a mistake
right now, and the reason is a supply/demand asymmetry:**

- **Slots are abundant.** 12 slots/day ≈ 84/week. Demand for them is currently
  zero.
- **Attention is scarce.** That's the thing everybody actually wants.

**A token should price the scarce asset, not the abundant one.** Gating slots
with $CSGN taxes the side of the market that is already empty — it suppresses the
supply of creators (the only thing that grows the network) in exchange for
trivial token demand. You'd be charging admission to an empty theater.

So the resolution is not "open claims **vs.** token-as-remote." It's:

> **Access stays open and free. The token governs *attention*.**

This is the YouTube/TikTok structure — anyone may publish; *distribution* is the
scarce, allocated good — with a broadcast-network twist.

### 2A.2 The three tiers (where control actually lives)
| Tier | What it is | How it's governed | Cost |
|---|---|---|---|
| **1. Access** | Claiming a slot and going live | Open to any verified account, 2 concurrent slots | **Free** |
| **2. Placement** | *Which* hour, promotion, whip-around mentions, reel rotation | Founder-curated now → holder-voted as it scales | **Earned / voted** |
| **3. Amplification** | Coin Jukebox spotlight, sponsorships, priority reel placement | Market-priced | **SOL / $CSGN** |

Tier 1 grows supply. Tier 2 is the editorial spine. Tier 3 monetizes. The token
is the remote for **tiers 2 and 3 — the scarce ones** — and never blocks tier 1.

### 2A.3 How the founder keeps programming control (levers already built)
Nothing new is needed to keep a firm hand on the schedule:
- **The O&O anchor schedule.** CSGN's own original content owns the tentpole
  hours; claimed slots fill in *around* it. This is exactly how real networks work
  — **owned-and-operated programming plus affiliates.** Editorial identity comes
  from the anchors, not from restricting affiliates.
- **`isClaimable` per slot** (enforced in `claimSlot.ts`) — mark prime-time hours
  un-claimable so they're reserved for anchors, tentpoles, and invited guests.
  *(Gap: there's no admin UI toggle for this yet — it's server-enforced only.
  Worth adding, since it's the single most useful editorial lever.)*
- **`slotLimits.maxConcurrentClaims` per user** — a **merit ladder**, not a
  paywall. Default 2; raise it for creators who show up, hit their times, and
  bring an audience. Reward reliability with inventory.
- **Admin override + release** (`adminReleaseSlot`) — reclaim any slot.

### 2A.4 Why open claims are themselves a growth engine
Every creator who claims a slot brings their own (small) audience to a CSGN URL.
The network **aggregates many small audiences into one channel** — and that
aggregate is what sponsors pay for and what the token governs. Open claiming is
the cheapest supply-side growth CSGN has: it converts other people's audiences
into network inventory at zero CAC. Gate it and that engine never starts.

**Keep it open and balanced** (2 slots) for now. The moment slots become
genuinely contested — more claim demand than hours — *that* is when scarcity is
real and token-weighted priority for the contested hours becomes fair rather than
extractive. Ship the mechanic when the constraint binds, not before.

### 2A.5 Right now: the constraint is demand, not access
Nobody has signed up. That is **not** evidence the claim rules are wrong; it's
evidence nobody has been *asked*. Before touching the mechanic, verify the funnel
works end-to-end (the Auth Events log now captures failed attempts, which it
previously dropped) and then go recruit the first ten creators by hand. Ten
booked creators is a schedule; a schedule is a channel.

---

## 3. Token structure (rebuilt from first principles — no burn)

### 3.1 What $CSGN is *for*
$CSGN is the **coordination + settlement token of CSGN's attention economy.** It
does three jobs:
1. **Coordinate attention** — holding it is voting power over what the network
   shows (the remote control): the slate, the meme-100 ranking, the crawl, the
   game-league decisions. *Balance-weighted and non-custodial* — you keep your
   tokens and still wield power.
2. **Tier the scarce goods** — thresholds unlock *upgrades*, never basic entry:
   better revenue-share rates, priority reel placement, creator-channel tooling,
   and submission rights. Demand that rises structurally with the creator base.
   **Note the boundary (§2A):** getting on air at all — claiming a slot on the
   24/7 channel — stays open and free. The token tiers *attention and upside*, not
   admission; gating admission would strangle the supply side we're trying to grow.
3. **Settle payouts** — the treasury pays creators and the network in $CSGN, so
   value earned from attention is denominated in the token.

### 3.2 Why we do **not** burn
Burning optimizes for a one-time supply-shock narrative and bleeds the network of
capital it needs. CSGN is a *growth* business that needs fuel for distribution and
creator payouts. So **every $CSGN (or SOL) the network receives goes to a
productive treasury, never the incinerator.** A burn destroys capital; a treasury
*deploys* it — and a treasury that grows with attention revenue backs the token far
more durably than a shrinking supply. This is a sovereign-wealth-fund model, not a
deflation gimmick.

### 3.3 Supply & allocation (target structure)
*(Illustrative target — final numbers set with counsel + market conditions. The
live token is the existing pump.fun mint; this is the intended end-state structure
the treasury migrates toward.)*

| Allocation | % | Purpose | Vesting |
|---|---|---|---|
| **Community / circulating** | 55–65% | Already-circulating supply, market | — |
| **Treasury (network fund)** | 15–20% | Distribution, creator payouts, liquidity | DAO-governed drawdown |
| **Creator rewards pool** | 8–12% | Pays creators for attention over time | Streamed by usage |
| **Team & ops** | 8–12% | Build + run | 2–3y linear, 6–12m cliff |
| **Liquidity** | 3–5% | Depth on the primary DEX | Locked |

Guiding principles: majority already in the community's hands; a large *productive*
treasury; a creator-rewards pool that is **earned, not airdropped**; transparent,
governed drawdown.

### 3.4 Where value comes from (accrual, non-burn)
1. **Access demand.** Creating a channel, earning better fee splits, priority reel
   placement, and crawl/submission rights require holding $CSGN. As the creator and
   holder base grows, structural buy-and-hold demand grows with it.
2. **Governance/curation demand.** The remote control: the more the network is
   worth watching, the more it's worth being able to steer — and that steering is
   balance-weighted, so influence scales with holdings.
3. **Productive treasury + buyback-to-pay.** Attention revenue (jukebox SOL,
   sponsorships, ad/placement deals) flows to the treasury. The treasury uses
   proceeds to **buy $CSGN on the open market to pay creators** — sustained,
   programmatic buy pressure that *recycles* value to contributors instead of
   destroying it. The treasury also seeds liquidity and funds distribution.
4. **Creator alignment.** Creators are paid in $CSGN for the attention their
   content commands, so the people producing the network's value hold and use its
   token.

**The one-line buy reason:** *"$CSGN is the remote control for crypto's TV network,
and a claim on the treasury that grows every time the network sells attention."*

### 3.5 Treasury policy (the engine)
- **Inflows:** jukebox SOL, sponsorships, placement/ad deals, any $CSGN fees, a
  share of creator-channel revenue.
- **Outflows (governed):** creator payouts (via open-market $CSGN buys),
  distribution/marketing, liquidity provision, infrastructure.
- **Transparency:** publish a periodic treasury + payout report ("State of the
  Network") so holders can see attention revenue → treasury → payouts. The
  fan-action counter already makes participation legible; the treasury report makes
  the economy legible.

### 3.6 Governance
Start pragmatic (founder-led with token-weighted signaling votes already built),
migrate toward a treasury DAO as the treasury grows. All curation votes
(slate, meme-100, game leagues) are the same balance-weighted, non-custodial
primitive — no lockups, no staking, change your vote anytime.

---

## 4. The attention-market mechanics (ACM primitives, all built)

| Primitive | What it does | ACM role |
|---|---|---|
| **Coin Jukebox (SOL)** | Pay SOL to play your coin into the spotlight | *Prices* attention; funds the treasury |
| **Meme-100 power ranking** | Vol + mcap + social + holder votes → live rank | *Allocates* attention democratically |
| **Slate / game-league votes** | Token-weighted control of what airs | *Coordinates* attention |
| **Holder Right Now** | Hold to push a ticker headline | *Gates* attention by stake |
| **Creator fees / payouts** | On-chain volume + views → creator income | *Pays out* attention |
| **Fan-action counter** | Counts + airs every on-air action | *Measures* attention |

Together these are the four legs — **price, allocate, coordinate, pay, measure** —
of an Attention Capital Market. No mechanic burns; the jukebox and any fees feed
the treasury.

> The Coin Jukebox's on-chain path (SOL → treasury) still needs a **tiny mainnet
> dry-run** before public launch.

---

## 5. Business plan (full)

### 5.1 Market & opportunity
- **Creator economy:** a >$250B market (2024 estimates) growing double-digits; its
  core unsolved problem is *fair, granular, real-time monetization of attention* —
  exactly what on-chain settlement enables.
- **Crypto attention plays** proved demand: friend.tech did >$40M in fees at peak;
  pump.fun has done hundreds of millions in cumulative fees launching coins-as-
  content. Both proved people will pay to attach themselves to attention — but
  neither built a *broadcast product* or a durable brand.
- **Live streaming:** Twitch alone is billions of watch-hours/quarter; crypto has
  no equivalent flagship. That vacuum is the SOM.
- **TAM → SAM → SOM (directional):** TAM = creator economy + crypto attention
  markets ($100B+). SAM = crypto-native creators + trading communities seeking
  distribution ($ low billions of attention spend). SOM (24 months) = the core of
  Crypto Twitter + Solana coin communities — thousands of communities, tens of
  thousands of degens — enough to make CSGN the default "crypto TV."

### 5.2 Product
The three prongs (§2). MVP is live (24/7 stream + ticker + jukebox + votes +
creator fees); the compounding build is Prong 2 (generalized creator channels +
per-view attention payouts).

### 5.3 Revenue model (diversified, treasury-funded)
1. **Attention placement (jukebox / spotlights)** — SOL per feature; scales with
   coin-community demand.
2. **Sponsorships** — coin communities sponsor shows, segments, game-league teams
   (SOL/USDC/$CSGN → treasury).
3. **Creator-channel take-rate** — a network cut of creator-channel attention
   revenue (Prong 2).
4. **Ad/placement inventory** — lower-thirds, ticker slots, interstitials sold as
   programmatic attention inventory.
5. **Premium/access tiers** — $CSGN-gated creator tools, analytics, priority
   placement.
6. **Creator-fee flywheel** — on-chain trading volume the content drives (indirect,
   proves the thesis on-screen).

### 5.4 Go-to-market
Distribution-first (the product is ahead of the audience). The engine:
- **One repeatable, shareable, crypto-native event** — the **Live Coin Battle**
  (two communities' coins compete for the spotlight by on-chain volume + votes),
  weekly, clipped. Forces two fanbases and their buys into the board; they market
  CSGN to win.
- **Borrow audiences** — grade every move by "whose followers does this reach":
  coin communities (jukebox/sponsorships/battles), KOL segments, creators on the
  fee share.
- **Daily clips to X** from the 24/7 board — the cheapest top-of-funnel there is,
  now fed by the Originals slate (§2, Prong 1).
- **Discord as the notification spine** (below).
- Full agency-grade plan in §7 (folded in from the former marketing audit).

#### The content → clip → notify loop (the actual daily machine)
The Originals slate exists to feed this loop; the loop is what compounds.

```
Originals (Whiparound / Dynasty / FPS)
      ↓  produce
   live show  →  VOD  →  1–3 clips/day
      ↓                        ↓
 Discord ping            X / TikTok / YT Shorts
 ("live now")            (discovery)
      ↓                        ↓
   viewers  →  wallet connect  →  holders  →  on-air actions
```

**Discord quick-notification system.** Discord is the *retention and re-attention*
layer — the thing that converts a one-time clip viewer into a recurring viewer.
Design it to do three jobs, and only three:
1. **"We're live" ping** — role-mentionable, fires the second `/player` flips to
   LIVE, with the show name and a deep link. This is the highest-value automation
   CSGN can build; a channel without a "we're live" ping loses most of its
   returning audience.
2. **Clip drop** — every clip auto-posted so the community has something to share.
3. **On-air action alerts** — a spotlight played, a vote opened, a battle starting.
   This makes the token's powers *visible* to people who haven't used them yet.

Implementation note: fire these from the existing server side (the fee poller
already detects live state and writes `streamActivity`), not from the browser — a
Discord webhook call on the LIVE transition is a small, high-leverage addition.

**Rule of thumb:** Discord notifies, X acquires, the channel retains. Don't invert
those jobs — a Discord that becomes the destination is a Discord that starves the
channel.

#### Social strategy & day-to-day execution
The trap with a daily show + a dynasty series + FPS streams is producing a lot of
*content* and no *distribution*. Bind them:
- **One clip per show, minimum, same day.** Not "when there's a good one." The
  habit is the asset; quality averages up over weeks.
- **Every clip names a coin or a person.** Degens share what makes their bag or
  their name look important — a clip about "CSGN" gets ignored; a clip about
  *$WIF hitting the board* gets reposted by the $WIF community.
- **Post into other people's attention.** Reply to live CT threads with a relevant
  ticker/board clip. You have the best-looking visual asset in any thread.
- **Dynasty is the serialized hook** — post the cliffhanger, not the recap
  ("holders vote the 4th-and-1 tonight").
- **The Whiparound is the appointment** — same hour daily, announced the same way
  every day. Predictability is what makes a channel a habit.
- **~30–45 min/day**, treated as non-negotiable operating time, not a project.

### 5.5 Operations & org
Currently near-solo — the #1 operational risk. Near-term: one nightly show + the
24/7 backbone + daily clips; add a co-host/booker and automate the 24/7 loop to
remove the single point of failure. Hiring order as revenue allows: (1) a
community/booking lead, (2) a clips/social operator, (3) an on-chain/full-stack
engineer for Prong 2.

### 5.6 Financial model (directional)
- **Cost base is low:** infra + RPC + a paid data feed + hosting are hundreds/
  month, not thousands (see `ops-cost-security-runbook.md`). This is a *distribution*
  cost problem, not a burn-rate problem.
- **Revenue ramp is community-count-driven:** N sponsoring communities × average
  monthly attention spend. 10 communities at modest spend covers ops; 100+ makes
  the treasury self-funding. Model to **communities activated** and **holders-who-
  acted**, and let ARPU rise as inventory (game leagues, creator channels) grows.
- **Treasury is the balance sheet:** attention revenue accumulates; drawdowns fund
  growth; open-market $CSGN buys pay creators. The token's floor rises with the
  treasury.

### 5.7 Milestones (see §8 for the calendar)
Activate (dry-run jukebox, treasury report, homepage thesis) → First ignition
(Live Coin Battle, 5–10 communities) → Retention loop (game leagues, creator
channels) → Scale (creator-channel platform, DAO treasury).

### 5.8 Funding
Bootstrapped + treasury-funded is viable given the low cost base; a strategic
raise (or a treasury-backed community round) makes sense *once distribution is
proven* — raise into traction, not before. Any raise capitalizes the treasury and
creator pool, never a burn.

### 5.9 Risks & mitigations
- **Irrelevance (death by obscurity)** → the ignition event + daily clips + borrowed
  audience.
- **Token distrust / pay-to-feature optics** → transparent treasury reports, no
  burn gimmicks, non-custodial governance, dry-run on-chain paths.
- **Platform dependency** (Twitch/X/ESPN/CoinGecko/RPC) → own-ingest path for feeds
  (`broadcast-graphics.md`), caching/fallbacks, paid RPC.
- **Single operator** → co-host/automation/backup.
- **Regulatory surface** (payouts, pay-to-feature, token) → frame payouts as
  discretionary creator rewards; jukebox as "pay to feature content," not a
  security; counsel review before scaling the treasury/DAO.

---

## 6. Research & evidence supporting the thesis

*(Directional grounding, not audited figures — validate before external use.)*

- **The attention economy is real and mispriced.** Herbert Simon's thesis ("a
  wealth of information creates a poverty of attention") is now the defining scarcity
  of the internet. Ad markets ($700B+) price attention crudely and pay creators
  last; on-chain settlement lets CSGN price and pay it *directly and in real time* —
  the structural unlock.
- **The creator economy ($250B+, double-digit growth) is starved for granular
  monetization.** Platforms take large cuts and pay on opaque schedules. Per-view,
  per-reel, real-time on-chain payout (Prong 2) is a genuine 10x on fairness and
  latency.
- **Crypto has repeatedly paid for attention.** friend.tech (>$40M fees at peak) and
  pump.fun (hundreds of $M cumulative fees) proved people pay to attach to
  attention — but both were mechanics, not media brands. The gap CSGN fills is the
  *durable, broadcast-grade brand* on top of the mechanic.
- **Meta-cycle logic.** DeFi (money) → NFTs (ownership) → the next leg
  financializes **attention/entertainment**. Being the flagship *brand* of that leg
  — not just a tool — is the winner-take-most position.
- **"Third place" demand.** Ray Oldenburg's third-place concept + the decline of
  communal spaces explains why an always-on, communal *channel* (not a feed)
  resonates; Discord/Twitch proved the appetite, but neither is linear, communal
  TV that pays attention out on-chain.
- **Comps to internalize:** ESPN (broadcast authority + ticker as brand),
  TouchTunes (pay-to-play attention, coin-operated UX), Twitch (creator + chat
  energy), pump.fun (crypto-native coins-as-content), Bloomberg (data-dense
  authority). CSGN is deliberately the intersection — *Public-Access Cable ×
  TouchTunes × Twitch × Pump.fun × ESPN.*

---

## 7. Marketing (agency-grade, folded in)

**Big Idea:** *"Crypto has a TV channel now."* Everything ladders to that.
**Positioning:** for CT degens who live in markets all day, CSGN is the 24/7 TV
network where watching and trading are the same act — broadcast-grade and
coin-operated, unlike Discords, charts, or chaotic pump.fun cams.
**Tagline:** *The ESPN of crypto. Coin-operated.* Support: *Hold the token. Hold
the remote.* · *Pay a coin, play a coin.*

**Audiences (concentric):** (1) **Degens** — core; hook = the Jukebox + meme-100.
(2) **Coin communities & KOLs** — distribution multipliers; hook = spotlights,
battles, sponsorships. (3) **Streamers & game fans** — retention; hook = creator
channels + fee share + the leagues.

**Three repeatable campaign formats:**
- **"Get Your Coin On TV"** — jukebox-as-meme clips; every clip is an ad *and*
  proof.
- **"Live Coin Battle"** — the weekly appointment; two fanbases market it for you.
- **"Hold the Remote"** — the token narrative; show a phone changing what's on TV,
  end on the treasury (not a burn).

**Channels:** X (3–5 posts/day: clips, the daily meme-100 #1, battle trailers,
treasury updates, reply-into-threads), coin Telegrams (borrowed audience),
pump.fun/Dexscreener (context), the broadcast itself (owned CTAs), YouTube/TikTok
(repurpose). *No* paid generic crypto ads or engagement pods.

**Content engine:** the 24/7 board is a clip factory — marketing is mostly
*harvesting* (capture → caption with the coin ticker → post daily → let the
community re-share). ~30 min/day as a habit.

**Funnel / North Star:** manage to **holders-who-acted per week** (the built
counter), not market cap. Reach → interest (concurrent viewers) → wallet connect →
**hold** → **act** → advocate.

### 7.1 How CSGN grows *as a crypto project* (not just as a channel)

A media brand grows on audience. A crypto project grows on **holders with a
reason to stay**. CSGN has to do both, and the mistake would be running the token
playbook (announcements, partnerships, price talk) instead of the media playbook.
The order that works:

**1. Content earns the audience; the token converts it.** Never lead with the
token to a cold viewer. Lead with the show, the clip, the coin on the board — then
the token is the obvious next step ("you can *decide* what's on this thing"). A
crypto project that markets its token to people who don't consume its product is
just asking for exit liquidity, and CT can smell it.

**2. Make holders visible on screen.** The single most under-used asset is that
CSGN can *show* participation: the fan-action counter, the holder headline on the
crawl, the vote result changing the schedule. **Being seen is the reward.** This
is why the on-air action counter matters more than any airdrop — it converts
holding into status, and status is what people actually buy in crypto.

**3. Recruit communities, not followers.** One coin community with 3,000 holders
is worth more than 3,000 individual followers, because it comes with a Telegram, a
mod who will raid, and a reason to care (their coin on the board). Every
spotlight, battle, and dynasty sponsorship should be sold as *"your community gets
airtime"* — they do the distribution for you. **Target: 10 activated communities
before worrying about anything else.**

**4. Let creators be the growth loop.** Open claiming (§2A) means every creator
you onboard imports their audience. Ten reliable creators × a few hundred viewers
each is a real channel, and it costs nothing. Treat creator recruiting as the
primary growth channel, not a side feature — and use the merit ladder
(`maxConcurrentClaims`) to reward the ones who show up.

**5. Ship proof, not promises.** In this niche, credibility comes from things that
visibly *work*: a channel that's actually always on, a jukebox play that actually
appears on air in 60 seconds, a vote that actually changes tonight's game, a
treasury report with real numbers. Every one of those is a marketing asset. The
roadmap-and-partnership style of crypto marketing is dead weight here.

**6. Be honest about the phase.** At a ~$4k cap with no audience, the goal is not
price — it's **proof of format**. Publish the audience and participation numbers
even while they're small; being early and transparent builds the exact trust that
lets the token re-rate when the meta arrives. Manage to holders-who-acted, say so
publicly, and let the cap follow.

**What to explicitly NOT do:** paid engagement pods, generic "crypto influencer"
promos, airdrop farming, price-prediction posting, or token-gating the parts of
the product that are supposed to be growing (see §2A). Each of these buys a
number that doesn't compound.

---

## 8. Roadmap / activation

| When | Focus | Deliverables |
|---|---|---|
| **Weeks 1–2** | Activate + de-risk | **Launch the Originals slate** (Whiparound daily; Dynasty ep. 1; FPS block) — the schedule is the product; **Discord "we're live" ping**; verify the sign-up funnel end-to-end (Auth Events now logs failures) and **hand-recruit the first 10 creators**; mainnet dry-run the jukebox; rewrite homepage + pinned post; start the daily clip habit |
| **Weeks 3–4** | First ignition | Ship + run **Live Coin Battle #1**; recruit the first 5–10 coin communities; first KOL segment; publish the first **treasury/State-of-the-Network report** |
| **Month 2** | Retention loop | Game leagues (CFB 27 Dynasty with recruiting-by-vote + coin-team sponsorships); jukebox queue + dynamic pricing; begin Prong 2 (generalized creator channels + per-view payouts) |
| **Month 3** | Scale | 10+ communities cycling; creator-channel beta; deepen liquidity; publish recurring treasury reports; remove single-operator risk |
| **Quarters 2–4** | Platform | Open the creator-channel platform (Prong 2), migrate to a treasury DAO, external raise into proven traction |

**The one thing:** run the **Live Coin Battle every week and clip it.** It is
simultaneously the product demo, the acquisition engine, the token-demand driver,
and the appointment that makes CSGN a *channel* — and it makes two communities
market you for free. Everything else is amplification.

---

## 9. First-principles summary (the whole thesis in eight lines)
1. Attention is the next asset crypto financializes → **Attention Capital Markets.**
2. CSGN produces, prices, allocates, and pays out attention as a real broadcast → it
   is the flagship, not a tool.
3. Three prongs: the 24/7 stream, the creator-channel/VOD platform (the digital
   third place), and the content/attention itself.
4. $CSGN is the coordination + settlement token — the remote control and a claim on
   a **productive treasury.**
5. **We never burn.** Revenue feeds the treasury, which recycles into distribution
   and creator payouts (including open-market $CSGN buys).
6. **Access stays open; the token governs attention.** Slots are abundant, attention
   is scarce — price the scarce thing. Open claiming is a free supply-side growth
   engine; gating it would strangle the network before it starts.
7. **Editorial control comes from the Originals slate** (Whiparound · Dynasty · FPS)
   owning the tentpole hours — owned-and-operated programming alongside affiliates —
   plus `isClaimable`, the `maxConcurrentClaims` merit ladder, and admin override.
8. The near-term game is distribution — a consistent slate, a daily clip habit, a
   Discord "we're live" ping, and hand-recruited creators and communities — not more
   features.
