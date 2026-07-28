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

The product is roughly a year ahead of its audience. **The entire near-term game
is distribution and giving the token a legible reason to be held** — not more
features, and definitely not burning supply.

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

## 3. Token structure (rebuilt from first principles — no burn)

### 3.1 What $CSGN is *for*
$CSGN is the **coordination + settlement token of CSGN's attention economy.** It
does three jobs:
1. **Coordinate attention** — holding it is voting power over what the network
   shows (the remote control): the slate, the meme-100 ranking, the crawl, the
   game-league decisions. *Balance-weighted and non-custodial* — you keep your
   tokens and still wield power.
2. **Gate access** — thresholds/tiers unlock creating a channel, better
   revenue-share rates, priority reel placement, and submission rights. Demand
   that rises structurally with the creator base.
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
- **Daily clips to X** from the 24/7 board — the cheapest top-of-funnel there is.
- Full agency-grade plan in §7 (folded in from the former marketing audit).

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

---

## 8. Roadmap / activation

| When | Focus | Deliverables |
|---|---|---|
| **Weeks 1–2** | Activate + de-risk | Mainnet dry-run the jukebox; publish the first **treasury/State-of-the-Network report**; rewrite homepage + pinned post to "Crypto has a TV channel now / remote control for crypto TV / claim on a growing treasury"; instrument holders-who-acted as the North Star; start the daily clip habit |
| **Weeks 3–4** | First ignition | Ship + run **Live Coin Battle #1**; recruit the first 5–10 coin communities; first KOL segment |
| **Month 2** | Retention loop | Game leagues (CFB 27 Dynasty with recruiting-by-vote + coin-team sponsorships); jukebox queue + dynamic pricing; begin Prong 2 (generalized creator channels + per-view payouts) |
| **Month 3** | Scale | 10+ communities cycling; creator-channel beta; deepen liquidity; publish recurring treasury reports; remove single-operator risk |
| **Quarters 2–4** | Platform | Open the creator-channel platform (Prong 2), migrate to a treasury DAO, external raise into proven traction |

**The one thing:** run the **Live Coin Battle every week and clip it.** It is
simultaneously the product demo, the acquisition engine, the token-demand driver,
and the appointment that makes CSGN a *channel* — and it makes two communities
market you for free. Everything else is amplification.

---

## 9. First-principles summary (the whole thesis in six lines)
1. Attention is the next asset crypto financializes → **Attention Capital Markets.**
2. CSGN produces, prices, allocates, and pays out attention as a real broadcast → it
   is the flagship, not a tool.
3. Three prongs: the 24/7 stream, the creator-channel/VOD platform (the digital
   third place), and the content/attention itself.
4. $CSGN is the coordination + settlement token — the remote control and a claim on
   a **productive treasury.**
5. **We never burn.** Revenue feeds the treasury, which recycles into distribution
   and creator payouts (including open-market $CSGN buys).
6. The near-term game is distribution + a legible buy reason — not more features.
