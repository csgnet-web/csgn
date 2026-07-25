# CSGN Master Plan

> **The canonical plan.** This document consolidates and supersedes the scattered
> planning docs (`forward-strategy.md`, `business-spec.md`, `founder-readout.md`,
> `consultant-review.md`, `token-design-space.md`, `broadcast-graphics.md`) into
> one place: the pitch, everything that already exists, the full option space, the
> token's value-accrual model, the programming system (including the video-game
> leagues), distribution, and the sequenced roadmap. The originals remain as
> deeper dives; when they disagree, **this file wins.**

---

## 1. The pitch

**CSGN is Public-Access Cable × TouchTunes × Twitch × Pump.fun × ESPN.**

- **Public-Access Cable** — a 24/7 channel that's *always on*, scrappy, communal,
  and anyone can get on it.
- **TouchTunes** — you pay to put your thing (your coin) on the screen right now,
  like dropping a dollar to play your song on the bar jukebox.
- **Twitch** — live creators, chat energy, personalities you follow.
- **Pump.fun** — crypto-native, degen culture, coins as the content.
- **ESPN** — broadcast-grade production: real scoreboards, ticker, lower-thirds,
  stats, a *look* that says "this is a network," not a webcam.

**One-liner:** *The 24/7 network where watching crypto and trading it are the same
act — and holding the token is the remote control.*

**Elevator:** CSGN is a live TV network for crypto. A broadcast-grade ticker runs
real markets, sports and the meme-100 power ranking; creators go live and earn
real on-chain trading fees; and anyone can pay SOL to play their coin into the
spotlight like a crypto jukebox. Hold $CSGN and you steer the whole thing — vote
the slate, rank the meme-100, submit the crawl, trigger spotlights — while every
paid feature buys and burns the token. It's the ESPN of crypto with a coin-
operated remote.

---

## 2. What CSGN is TODAY (the honest inventory)

### 2.1 Product (built, shipping)
- **`/player` Master Control** — a unit-tested state machine (LIVE / STARTING_SOON
  / BRB / INTERMISSION / OVERRIDE), FeedGate ad-masking, brand wipes, auto-reconnect,
  intermission VOD playlist, four-signal LIVE detection. One OBS browser source.
- **The ticker band** (`docs/obs/csgn-ticker.html`) — 20+ league auto-scoreboard
  (MLB diamonds, NFL down-and-distance, golf boards, MMA weight/title, games-back),
  a crypto LED dock with a 24h chart, the meme-100 power ranking, the rising coin
  spotlight, two-row BREAKING, admin chyron, and the fan-action counter.
- **Over-live interstitials** (`docs/obs/csgn-lowerthirds.html`) — LIVE NOW / UP
  NEXT / HOLDERS VOTE notices that break into the feed and clear.
- **Admin control plane** — a SaaS-style dashboard: broadcast control, ticker
  controls, slot/schedule/fees management, the live fan-action KPI.
- **Accounts & fees** — email + Phantom + Twitch identity; creator-fee revenue
  share tied to on-chain volume per market-cap tier; verifiable stream activity.

### 2.2 Token mechanics (built — the levers to activate)
| Mechanic | What it does | Value effect |
|---|---|---|
| **Coin Jukebox (SOL)** | Pay SOL to spotlight your coin | Treasury buys & burns $CSGN → deflation |
| **Buy-and-burn spotlight ($CSGN)** | Alt path: burn $CSGN to spotlight | Direct deflation |
| **Meme-100 power vote** | Balance-weighted vote blends with vol/mcap/social | Hold-to-govern demand |
| **Slate vote** | Token-weighted vote on tonight's stream | Hold-to-govern demand |
| **Holder Right Now** | Hold ≥5M to push a ticker headline | Hold-to-access demand |
| **Fan-action counter** | Counts every on-air action, airs it | Makes participation visible |
| **Creator fees** | On-chain volume → streamer payout | Content↔volume flywheel |

> Two on-chain paths (jukebox SOL, $CSGN burn) still need a **tiny mainnet dry-run**
> before public launch.

---

## 3. Strategic thesis (the wedge)

1. **Lead with the one content where the viewer and the buyer are the same person:**
   live crypto markets + degen culture + first-to-every-story. That is the wedge.
2. **Sports and video games are retention and personality**, not the wedge — they
   keep the community the wedge recruits.
3. **Give the token a legible buy reason** ("remote control for crypto TV, and
   every feature burns it") and market it harder than the product.
4. **Borrow audiences; don't manufacture them.** Grade every move by "whose
   followers does this put us in front of."
5. **Spend more on distribution than production** until the follower + concurrent-
   viewer curves bend. The product is a year ahead of the audience — stop widening
   that lead and convert it.

**Niche to own:** *the ESPN of live crypto* — broadcast-grade, real-time crypto-
market TV. Nobody owns it; pump.fun streams are chaotic and low-production.

---

## 4. The full option space (clustered, by horizon)

### Horizon 1 — activate what exists (this quarter)
- Launch the Coin Jukebox + burn ticker ("X $CSGN burned this week", permanent).
- Turn the meme-100 power ranking into an appointment ("tonight's #1 at 9pm").
- Homepage + pinned post rewrite around the one-line token thesis.
- Daily clip cadence to X from the 24/7 board.
- Recruit 5–10 coin communities into spotlights/votes/battles.

### Horizon 2 — new mechanics that deepen the loop (1–2 quarters)
- **Live Coin Battle** — two communities' coins compete for the night's spotlight,
  decided by on-chain volume + the meme-100 vote, narrated live. Clippable, drives
  buys (volume is the score), self-marketing.
- **Jukebox queue + dynamic pricing** — pay more to jump the queue / extend the
  feature; a visible on-air "now playing / up next" coin queue.
- **Prediction beats** — holder-voted "which coin 2x's first tonight" with an
  on-air scoreboard.
- **Creator coins** — "pump.fun for channels": each creator/show has a coin; going
  live and volume feed each other. (See `token-design-space.md`.)

### Horizon 3 — platform (2+ quarters)
- Open jukebox/spotlight API for launchpads and communities.
- Streamer marketplace with fee-share + creator coins.
- Rights/《syndication》of the broadcast format.

---

## 5. Token value-accrual model (the core)

**Value accrues when demand to hold rises and/or supply falls — and both must be
legible to a stranger.**

- **Demand (hold):** the remote control — vote the slate, rank the meme-100,
  submit the crawl, trigger spotlights; all *balance-weighted and non-custodial*
  (you keep your tokens and still wield power). Coin communities buy standing to
  be featured/voted up → recurring, self-marketing demand.
- **Supply (burn):** every paid jukebox play → treasury buy-and-burn; the $CSGN
  burn spotlight path removes supply directly. Make the burn a permanent on-air
  element.
- **Reflexivity:** content → volume → creator fees → on-screen proof ("$X earned
  this session") → more holders → more governance value → more content. Instrument
  with the **holders-who-acted** counter (built) and publish it weekly as the
  North Star — **manage to that, not market cap.**

**The test:** can a stranger say in one line why they'd buy? After activation —
*"It's the remote control for crypto TV, and every feature burns it."*

---

## 6. Programming system

### 6.1 The always-on backbone (Public Access)
24/7 output via `/player`: live creators when scheduled, intermission VODs +
network board otherwise. Never dead air. The ticker + interstitials + jukebox run
continuously so the channel is alive even with no host.

### 6.2 The nightly appointment (ESPN)
One flagship show at a fixed ET hour — the wedge made live: markets desk +
first-to-every-story + the meme-100 reveal + a Live Coin Battle. Appointment
viewing is the thing worth clipping and the thing worth holding to influence.

### 6.3 Video-game leagues (the retention engine)
Games are how you keep the community the wedge recruits, and how casual viewers
*participate* rather than watch. Design principle: **every league ties an on-chain
$CSGN action to an on-screen outcome.**

**CFB 27 Online Dynasty (flagship):**
- A persistent, multi-week dynasty streamed on CSGN with a real standings/ticker
  presence (reuse the sports scoreboard rails — the ticker already renders CFB).
- **Recruiting-by-vote:** holders cast token-weighted votes on dynasty decisions
  (which recruit to chase, 4th-and-goal go-for-it, coordinator hires). The vote is
  the existing slate-vote mechanic repointed — balance-weighted, non-custodial.
- **Coin-team sponsorships:** a memecoin community "sponsors" a team for a season
  (jukebox-style SOL payment → their ticker/logo rides that team's lower-third);
  proceeds buy-and-burn $CSGN.
- **Season-long power ranking:** teams ranked by a blend of on-field results +
  holder votes + sponsor volume — same power-score pattern as the meme-100.
- **Playoff bracket predictions:** holder-voted bracket with an on-air leaderboard;
  the fan-action counter tallies every pick.

**Portable pattern for other titles (Black Ops / dynasty modes / racing):**
- *Watch* → the game on `/player`.
- *Vote* → holders steer a decision (balance-weighted).
- *Pay* → communities sponsor via the jukebox (SOL → buy-and-burn).
- *Score* → an on-air power ranking + the action counter make participation visible.

This turns games from "content the founder streams" into "a live board the
audience holds tokens to influence" — retention + token demand in one loop.

---

## 7. Distribution & growth

- **One repeatable, shareable, crypto-native event** (the Live Coin Battle) as the
  top-of-funnel. It forces two crowds and their buys into the board.
- **Borrowed audience** — every move graded on whose followers it reaches: coin
  communities, mid-tier streamers on the fee-share, KOLs given a spotlight.
- **Daily clips to X** from the 24/7 feed — the cheapest top-of-funnel there is.
- **Reduce operator surface** to survive: one nightly show + the 24/7 backbone +
  daily clips; a co-host or automation to remove the single-point-of-failure.
- See the companion **marketing audit** (`docs/marketing-audit.md`) for the full
  agency-grade plan, personas, creative, and calendar.

---

## 8. Sequenced roadmap

| When | Focus | Deliverables |
|---|---|---|
| **Weeks 1–2** | Activate + de-risk | Mainnet dry-run the jukebox/burn; ship the "burned this week" ticker; rewrite homepage/pinned post to the token thesis; instrument holders-who-acted as the North Star |
| **Weeks 3–4** | First ignition | Ship + run the weekly Live Coin Battle; recruit the first 5 coin communities; start daily clips |
| **Month 2** | Retention loop | CFB 27 Dynasty with recruiting-by-vote + coin-team sponsorships; jukebox queue + dynamic pricing |
| **Month 3** | Scale | 10+ communities; creator-coin pilot; deepen liquidity as demand arrives; remove single-operator risk |

**Gate:** manage to **followers, holders, and holders-who-acted** — not market
cap. If the audience grows while the cap stays flat, the audience was the business.

---

## 9. Risks (and the mitigations)

- **Irrelevance** (death by obscurity) → the ignition event + daily clips + borrowed
  audience.
- **Token distrust** (a bad burn, a pay-to-feature optic) → dry-run on-chain paths,
  publish the burn ledger, keep governance non-custodial and transparent.
- **Platform dependency** (Twitch/X/ESPN/CoinGecko/RPC) → own-ingest path for feeds
  (see `broadcast-graphics.md`), cache/fallbacks, a paid RPC.
- **Single operator** → co-host/automation/backup.
- **Regulatory surface** (fee "payouts", pay-to-feature) → frame payouts as
  discretionary rewards; keep the jukebox as "pay to feature content," not a
  security; counsel review before scaling.

---

## 10. Source documents (consolidated here)
- `docs/forward-strategy.md` — the three-arm gap analysis + five-sentence reframe.
- `docs/business-spec.md` — the 30-day operating plan + weekly KPI grid.
- `docs/founder-readout.md` — the behavioural read (stop polishing, start distributing).
- `docs/consultant-review.md` — SWOT + value-accrual thesis.
- `docs/token-design-space.md` — "pump.fun for channels" horizon.
- `docs/broadcast-graphics.md` — the on-air graphics build + own-ingest path.
- `docs/marketing-audit.md` — the agency-grade marketing plan (companion).
- `docs/obs/*` — the actual on-air instruments (ticker, interstitials, master.lua).
