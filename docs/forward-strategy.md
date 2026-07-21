# CSGN Forward Strategy — All Three Arms, Mapped

> Owner: founder-operator (solo). Status: strategy refresh, July 2026.
> Companion to `docs/business-spec.md` (the 30-day operating plan) and the
> `CSGN Business Plan.docx` (the investor narrative). Where those describe what
> we're building, this describes **why it hasn't moved the market cap yet and
> what changes**. Same ground rule as business-spec: **Built** is verified
> against the repo; everything else says **Planned**. No hype filler.

---

## 0. The one number that anchors everything: $3.8k market cap

Read the rest of this document through this single fact.

$3.8k market cap is, functionally, **pre-launch**. A pump.fun token needs
~$69k to graduate to a full AMM; we are at ~5% of that. It means: near-zero
holders, near-zero daily volume, and therefore **near-zero creator fees**. The
entire thesis — *content → volume → fees → creators want slots* — has an
ignition problem: at this cap, 30% of the tier fee rate on a few hundred dollars
of daily volume is **pennies**. The incentive that is supposed to pull creators
and reward the founder does not economically exist yet.

So the honest diagnosis is not "the product is unfinished." The product is
**over-built for the audience it has.** The gap is not engineering. It is
**audience and token demand.** This document reorders the whole operation around
that.

**Analytical note:** the founder listed the three arms as (1) on-screen, (2)
outreach/token, (3) gaps. This doc answers **(3) first**, because the gap
analysis determines what arms 1 and 2 should even be optimizing for. Perfecting
the ticker is wasted motion if nobody is pointed at the screen.

---

## 1. Arm 3 first — the professional gaps keeping us at $3.8k

Six gaps, ranked by how much they explain the flat cap.

### Gap 1 — Product-audience inversion (the root cause)

Eight months (Feb–Jul 2026) of genuinely senior engineering: a unit-tested
master-control state machine, a scale-invariant fee poller, a broadcast-grade
20-league ticker, a VOD program-director spec, a graphics package. **All Built,
all impressive, none of it a growth input.** The changelog is a product
changelog, not an audience changelog. There is no line in any doc that reads
"followers went from X to Y" or "peak concurrents hit Z." We have been measuring
what we can control (code) instead of what we're trying to move (attention).

**What this means:** the next 90 days must invert the ratio. Roughly **80% of
founder hours on audience and distribution, 20% on code** — the exact opposite of
the last 90 days. The engineering is a moat *once there is something to defend.*
Right now there is nothing behind the wall.

### Gap 2 — The token has no buyer

Ask the blunt question: **why would a stranger buy $CSGN today?** The only
on-chain utility is that *the streamer on screen* earns a fee cut. A viewer, a
holder, a passerby gets **nothing** from holding. The token and the content are
two separate objects bolted together by a mechanic that only pays the person
broadcasting. A token with no buyer-side reason to exist sits at $3.8k no matter
how good the broadcast is. **This is the single highest-leverage fix and it gets
its own section (Section 5).**

### Gap 3 — The content audience and the token audience are different people

This is the subtle one, and it is fatal if unaddressed. The token is a Solana
memecoin marketed to **crypto Twitter**. The content the founder wants to make —
CFB 27 dynasty, hyper-realistic modded offline dynasty, Black Ops/LoL with
friends — is **gaming-culture content.** A degen who apes memecoins does not
necessarily want to watch a College Football franchise; a CFB-dynasty viewer does
not care about a Solana pair. **The flywheel assumes the content audience buys
the token, but the two audiences barely overlap.**

The model only works if one of three things is true:

- **(a)** the content is crypto-native enough that watching it makes you want to
  trade (live markets, coin coverage, degen drama, on-air fees flowing), or
- **(b)** the *personality/community* is crypto-native and the games are just how
  the community hangs out (the streamer-coin model), or
- **(c)** we run two funnels and accept the cost.

The current plan quietly assumes (a) while producing content that points at (b)
or neither. **Pick deliberately.** This doc's recommendation is a blend of (a)
and (b): lead the funnel with the crypto-native wedge; use the games as
retention/personality for the community that wedge builds — never as top-of-funnel.

### Gap 4 — No working top-of-funnel

The clip engine, the four-platform distribution, the newsroom Discord — all
**Planned.** At $3.8k the binding constraint is discovery, and the discovery
machine isn't running. A network with the best ticker in crypto and zero daily
clips in the timeline is invisible. Distribution is not a Phase-2 nicety here;
it is *the* Phase-1 product.

### Gap 5 — Surface area too wide for one operator

Twenty-plus sports leagues in the ticker. Five content formats. Crypto + sports +
entertainment + gaming verticals. TMZ **and** ESPN. This is a network's worth of
scope run by one person. Breadth with no audience reads as unfocused; there is no
single thing CSGN is unambiguously *the* place for. **A solo founder wins with a
wedge, not a network map.** Breadth is the reward for winning the wedge, not the
way in.

### Gap 6 — The flywheel has no ignition source

The flywheel is real but it is drawn as already spinning. At $3.8k it is at rest,
and a flywheel at rest doesn't start from "produce more programming" — the fees
are too small to pull creators, and the founder is the only creator. **Something
external has to spin it the first quarter-turn: borrowed audience (partnerships),
a reason-to-trade event, or a token-demand mechanic that doesn't depend on volume
existing first.** Sections 4 and 5 are that ignition.

### What is genuinely strong (keep, don't second-guess)

- The **product/engineering moat is real** — *conditional on an audience.* The
  ticker especially is a legitimate broadcast asset most crypto projects can't
  build.
- The **anchor-tenant call** (own show before marketplace) is correct.
- **Auctions-off** until there's an audience is correct (empty rooms burn
  arriving creators).
- The **clip-as-top-of-funnel instinct** is correct — it just has to actually run.

The strategy below keeps all four and fixes the six gaps around them.

---

## 2. The reframe — the strategy in five sentences

1. **Pick one wedge where the content audience and the token audience are the
   same people:** live crypto markets + degen culture + first-to-every-story.
   That is the "TMZ of crypto" pillar, and it is the only content that makes
   watching and trading the same act.
2. **Give the token a buyer-side reason to exist** (Section 5) so demand doesn't
   depend on trading volume that doesn't exist yet.
3. **Borrow audience instead of manufacturing it** — every strategic move is
   graded "does this put us in front of someone else's followers?"
4. **Make trading part of the show** — the on-air experience should make buying
   feel like tipping the person on screen, with the fee counter visible.
5. **Spend more on distribution than production** until the follower and
   concurrent-viewer curves bend.

Games (CFB, modded dynasty, Black Ops/LoL) are **retention and personality**, not
the wedge. They keep the community that the wedge recruits. That ordering is the
whole strategic correction.

---

## 3. Arm 1 — Perfecting what's on screen

Two parts: the ticker (make it the data spine **and** a revenue surface) and the
content slate (assign each format a job, then rank).

### 3.1 The ticker — from "best-looking" to "load-bearing"

The ticker (`docs/obs/csgn-ticker.html`) is already broadcast-grade: ESPN
scoreboard integration across 20+ leagues, MLB diamond/count, down-and-distance,
golf leaderboards, a CoinGecko crypto LED with 7d sparklines, a 6 AM ET rollover,
and — critically — **two admin-driven Firestore rails already Built**: the
`rightNow` event rail and the `spotlight` coin takeover (`config/ticker`, polled
60s). Tuning knobs live in `CONFIG` (7s main dwell, 10-min spotlight cadence,
30s spotlight dwell).

"As professional and data-rich as possible" is nearly done on the *sports* side.
The upgrades that matter now are the ones that (a) serve the crypto wedge and
(b) turn the most-polished asset into **revenue inventory.**

| Upgrade | Why it matters | Built / Planned |
|---|---|---|
| **Always-on $CSGN bug** — price + 24h change pinned in a fixed cell, not just in rotation | The token should never be off-screen on our own network; it's the whole point | Data exists (`public/tokenStats`); **Planned** placement |
| **Live "fees flowing now" counter** — on-air readout of creator fees earned this session | Makes the thesis *visible*: money moving to the person on screen, in real time. This is the single most on-brand graphic we can add | Fee engine **Built**; on-air readout **Planned** |
| **Crypto majors anchor** — BTC/ETH/SOL always-on, plus a market-mood beat (Fear & Greed, notable liquidations) | This is what the *token* audience actually watches; it makes the ticker crypto-native, not sports-first | **Planned** (same CoinGecko/Dexscreener plumbing) |
| **`rightNow` rail as paid/holder inventory** | Turn the rail into "your message on a live broadcast" — sold in $CSGN or gated to holders (Section 5) | Rail **Built**; monetization **Planned (policy)** |
| **`spotlight` as paid placement** | Other Solana projects pay (buy-and-burn $CSGN) for a 30s on-air fire-card. Crypto-native, drives token demand, already coded | Spotlight **Built**; sales motion **Planned** |
| **Reliability guard** — never show a dead/empty cell on a data-source failure | On a 24/7 unattended encoder, one blank cell reads as amateur. `ticker-smoke.mjs` exists; extend it | Smoke test **Built**; failure-fallbacks **partly Built** |

**Editorial rebalance:** the sports breadth is beautiful texture, but on a
*crypto* network it should be the B-plot. Weight the rotation crypto-first
(majors + $CSGN + spotlight get more screen time than, say, WCBB). Keep the
20 leagues — the depth signals "real network" — but let crypto lead every cycle.

**Do not over-invest further here.** The ticker is already at 90%. The six rows
above are days of work, not months; ship them and stop. Additional ticker polish
is the exact Gap-1 trap (engineering instead of audience).

### 3.2 The content slate — one job per format, then ranked

The mistake to avoid is treating all five formats as equal programming. **Each
does a different job.** Assign the job, then rank by contribution to the wedge.

| Format | Job to be done | Verdict | Schedule role |
|---|---|---|---|
| **Nightly flagship (markets/drama whip-around)** | **The wedge.** Crypto-native, watch-and-trade, clip factory | **Lead everything with this** | Appointment, nightly, 8pm ET (as business-spec) |
| **CFB 27 online dynasty (16 externals + founder)** | **Distribution + community.** 16 coaches = 16 audience feeds | **Yes — but run it as a recruiting engine, not a game** | Weekly appointment "league night" |
| **Offline modded hyper-real dynasty** | **Differentiation + craft.** "You cannot get this anywhere else" | **Yes — as premium VOD/series + clip source** | Banked VOD, series strip, clip mining |
| **Informal Black Ops / LoL w/ friends** | **Personality + glue.** Cheap, funny, human, bonding | **Yes — but capped; it is not growth** | Filler/hang hours, clip mining |
| **Sports-first ticker content** | **Texture/credibility** | **Keep, de-weight** | Always-on B-plot |

**The CFB dynasty call (the one the founder most wants a decision on):** do it,
but the value is **not the football.** Sixteen external humans each with even a
small following is **sixteen distribution channels** who will post about *their*
team, *their* rivalry, *their* season. That is borrowed audience (Gap 6
ignition) disguised as a game. So:

- **Recruit the 16 for their audiences, not their skill.** Every coach should be
  a mini-node who brings followers. A coach with 2k engaged followers is worth
  more than a great player with 50.
- **Tie it to the token.** Draft order, franchise assignment, mid-season
  stakes, or a "commissioner's ruling" can be **holder-voted** (utility, not
  payouts — Section 5). Holders having a say in a live league is real,
  crypto-native token utility that costs nothing to grant.
- **Make it a *narrative*, not a save file.** Standings graphic on the ticker,
  weekly recap clips per team, a power-ranking segment on the flagship. The
  dynasty is a **content and recruiting spine**, aired weekly, that each of 16
  people is incentivized to hype.
- **Coordination realism (solo founder):** 16 live humans is a scheduling
  nightmare. Run it **asynchronously** — coaches submit game plans / play their
  games on their own time, founder plays and broadcasts the marquee matchups and
  the recap show. Do **not** try to get 17 people live simultaneously weekly;
  that breaks the solo constraint.

**Modded offline dynasty:** this is your "craft" flex — proof the network has
production values nobody else does. It is **excellent VOD and clip inventory**
(the hyper-real look screenshots and clips well) and a differentiation story for
the brand. It is **not** live top-of-funnel — it's slow. Bank it, series-strip
it, mine clips from it.

**Informal streams:** keep them, cap them. They are the *glue* that turns viewers
into a community and they produce the funniest clips (which travel). But hours of
Black Ops with friends do not recruit a crypto audience, so they ride shotgun —
never the marquee.

---

## 4. Arm 2 — UGC outreach, the marketing machine, and revenue

### 4.1 What "UGC outreach streams" should actually be

The highest-ROI outreach format for a solo crypto network is the **reaction / raid
/ co-stream loop**, because it is *manufactured borrowed audience*:

- **React & cover** — the flagship covers other people's content, tokens, and
  drama by name. Every coin you spotlight and every CT personality you cover has
  an incentive to reshare (their bag, their ego, their audience). This is the
  TMZ mechanic and it is the cheapest reach we have.
- **Guest / Space raids** — bring CT personalities on; their appearance is their
  promotion. One mid-size guest is worth a week of cold posting.
- **Co-streams with the 16 CFB coaches** — see 3.2; the league is an outreach
  engine.
- **"Your project on the ticker"** — outreach to small Solana projects offering a
  spotlight/`rightNow` placement (Section 5 monetizes this). Every project you
  feature markets CSGN to *their* holders for you.

**The process (repeatable, solo-survivable):**

```
Cover/feature someone by name  →  they reshare to their audience
      →  clip it  →  4-platform distribution  →  claim/watch CTA
      →  new followers  →  next night, feature the next node
```

The unit of growth is **"who did we put on screen today, and did their audience
see it?"** Track that explicitly.

### 4.2 The marketing cadence (the "every hour on X" ask)

"Present every day and hour on X, daily on other socials" is correct as an
ambition and **impossible manually for a solo founder.** Split it into three
tiers by how much human touch each needs:

| Tier | Cadence | How it survives solo |
|---|---|---|
| **Automated presence** | Hourly-ish on X | Ticker-style auto-posts: $CSGN price beats, "live now" posts, coin-spotlight cards, market-mood posts — piped from `tokenStats` + a scheduler. Machine keeps the account *alive* between human posts |
| **The daily clip drop** | ≥1–3/day, all 4 platforms | AI-cut from flagship + games, founder approves. Clustered at 8pm ET + US lunch. **This is the non-negotiable floor from business-spec §2.2** |
| **Live human voice** | Nightly + reactive | The founder replying, quote-tweeting drama, being *first*. This is the part that can't be automated and is the actual brand |

**Rule:** automation buys *presence* (never a dead timeline); clips buy *reach*;
the human voice buys *identity*. Don't automate the third or the account dies of
blandness; don't hand-do the first or the founder burns out. Off-X, one daily
cross-post to TikTok/Reels/Shorts of the day's best clip is the whole obligation —
depth on X, presence everywhere else.

**Measure it or it's theater:** follower delta, clip views by format, and
"features → reshares" weekly. Kill formats that don't move followers; double the
ones that do. (business-spec's KPI grid already frames this — hold to it.)

### 4.3 Revenue — the actual money map

Two buckets: **token fees** (the built-in engine) and **services** (what we sell
on top). Ranked by how soon they can produce real dollars at our size.

| Revenue line | Mechanic | Depends on | Built / Planned |
|---|---|---|---|
| **Coin Spotlight placements** | Projects pay (buy-and-burn $CSGN) for a 30s on-air fire-card + ticker rail | Any audience at all; sales hustle | Spotlight **Built**; sales/pricing **Planned** |
| **`rightNow` rail placements** | Paid or holder-gated event messages on the live rail | Same | Rail **Built**; policy **Planned** |
| **Creator/network trading fees** | The tier engine (`tradingVolumeSOL × tierRate × 0.30`) | **Volume**, i.e. audience + token demand | **Built**, dormant until volume exists |
| **Holder-gated services** | Squares/Grid games, gated Discord/alpha, gated segments | Token demand (Section 5) | Games **Planned**; gating pattern **Built** |
| **Slot marketplace (auctions)** | Creators bid for slots | An audience worth claiming (G3 gate) | **Built, switched off** — keep off |
| **Sponsorships** | On-stream brand integration | Meaningful concurrents | **Planned**, later |

**The near-term money is the ticker, not the fee split.** At $3.8k the fee engine
pays pennies, but the **Coin Spotlight is sellable today** — it's a real,
crypto-native ad unit on a live broadcast, and every buyer is also a marketer for
us and a source of buy-and-burn token demand. That is the revenue line to
operationalize first: a price sheet, a DM template, and 10 outreach messages to
small Solana projects this week.

**Hard line (unchanged from business-spec, restated because it's load-bearing):**
holder benefits stay **utility/access only** — no payouts, no revenue-share, no
yield language without securities counsel. And **manufactured/wash volume is off
the table** — not just legally radioactive but strategically useless: fake volume
builds no audience and the fee it generates is our own money laundered in a
circle. Volume has to come from *reasons to trade* (events, spotlights, the
on-air fee hook), never from faking the tape.

---

## 5. The token — giving $CSGN a reason to be bought (fixing Gap 2)

This is the crux of the $3.8k problem and the highest-leverage section in the doc.

Today a holder gets nothing. Every item below gives the **buyer** — not just the
streamer — a reason to hold, and every one rides rails **already built** (the
ticker's admin config, Firestore-gated features, the slot system):

| Utility | What the holder gets | Rail it rides | Token-demand logic |
|---|---|---|---|
| **On-air voice** | Hold ≥X $CSGN → post to the `rightNow` rail on a live broadcast | Ticker `rightNow` (**Built**) | "Be on TV" is a real reason to buy |
| **Program votes** | Holders vote CFB draft order, "commissioner" calls, next informal game, guest asks | Firestore poll doc + on-air readout (**Planned, trivial**) | Governance-as-engagement; costs nothing to grant |
| **Gated community** | Holder Discord: alpha, the newsroom wire, first access | Discord role gate (**Planned**) | Recurring reason to *keep* holding |
| **Gated games** | Squares/Grid premium tiers, holder leaderboards on-air | Games engine (**Planned**) | Ties Phase-2 product to the token |
| **Buy-and-burn from Spotlight** | Every paid spotlight burns $CSGN → supply pressure holders benefit from | Spotlight (**Built**) + burn (**Planned**) | Aligns the ad business with the token |
| **Holder recognition on-air** | Top holders named on the network board / a holder ticker beat | IntermissionBoard + ticker (**Built** surfaces) | Status is a memecoin's core product |

None of these are payouts or yield — they are **access, voice, status, and
supply mechanics**, which is exactly the safe/utility framing the risk section
already commits to. Ship two of them (recommend: **on-air voice** + **buy-and-burn
spotlight**, both on Built rails) and the token finally has a buyer-side story.

**The uncomfortable possibility, stated plainly:** the token may not be what
works — the *audience* might. The plan's own thesis is "volume follows
attention." It is entirely possible the right sequence is *build the crypto-native
audience first, add token demand mechanics as that audience arrives, and let the
cap follow* — rather than expecting a $3.8k token to bootstrap an audience. If
after a focused 90 days the audience curve bends but the token doesn't, that is a
signal to lean into audience/services and treat the token as a **community layer**,
possibly with a catalyst/relaunch moment tied to real traction rather than
willed into life at $3.8k. Don't marry the current mint over the mission.

---

## 6. Sequencing, KPIs, and gates (how this meshes with the 30-day plan)

business-spec.md's 30-day plan is sound; this section **re-prioritizes** it around
the six gaps. The reordering, not the task list, is the point.

**Priority stack for the next 90 days (in order):**

1. **Turn on the top-of-funnel** — daily clips actually shipping, 4 platforms.
   (Gap 4. Nothing else matters if this is off.)
2. **Give the token a buyer** — ship on-air voice + buy-and-burn spotlight.
   (Gap 2/5. This is what a $3.8k cap is starving for.)
3. **Sell the first spotlights** — price sheet + 10 outreach DMs. (Arm 2 revenue;
   real dollars + borrowed audience.)
4. **Lock the wedge** — flagship crypto-first every night; ticker crypto-weighted.
   (Gap 3/5.)
5. **Recruit the CFB 16 as distribution nodes** — audience-first, token-tied,
   async. (Gap 6 ignition.)
6. **Ship the six ticker rows** — then *stop* engineering and go back to 1–5.
   (Gap 1 discipline.)

**The KPIs that actually matter now** (add to business-spec's grid, these lead):

| Leading KPI | Why it's the real scoreboard | Source |
|---|---|---|
| @CSGNet follower delta / week | The audience curve is the whole game | X analytics |
| Clip views by format / week | Tells us which content to make more of | Platform dashboards |
| "Features → reshares" / week | Measures the borrowed-audience engine | Manual log |
| Unique $CSGN holders | The token-demand curve, honestly | Solscan/Dexscreener |
| Spotlights sold | First real revenue + borrowed reach | Admin/sales log |
| Peak concurrents | Lagging confirmation the wedge works | X Media Studio |

Market cap is a **lagging** metric — it moves *after* holders and attention do.
Managing to the cap directly is the trap; manage to followers, holders, and
reshares, and the cap follows or it tells you the token isn't the vehicle (§5).

**One added decision gate:**

| Gate | When | Rule |
|---|---|---|
| **G5 — Token vehicle check** | Day 90 | If followers/concurrents are up materially but holders/cap are flat, stop force-feeding the current mint. Shift weight to audience + services and design a catalyst/relaunch around real traction. Audience is the asset; the token is one way to monetize it |

(G1–G4 from business-spec stand unchanged.)

---

## 7. The sharpest calls, said once

- **The problem was never the product; it's that we built a network before we
  built an audience.** Invert the hour split: 80% audience/distribution, 20% code,
  until the follower curve bends.
- **A token nobody can benefit from buying stays at $3.8k regardless of the
  broadcast.** Give the *buyer* a reason (on-air voice + buy-and-burn), on rails
  already built, this quarter.
- **The content audience and the token audience must be forced to overlap.** Lead
  with the crypto-native wedge (live markets/drama); demote games to
  retention/personality/craft. They are not the way in.
- **The CFB 16 are a distribution engine wearing a football helmet.** Recruit for
  audience, tie to the token, run it async. Same for every "feature" — borrow
  audience, don't manufacture it.
- **Sell the Coin Spotlight now.** It's the one revenue line that pays real
  dollars at our size, and every buyer markets us to their holders and burns our
  token doing it.
- **Manage to followers, holders, and reshares — not to market cap.** The cap is
  the scoreboard, not the game. If it stays flat while the audience grows, the
  audience was the business all along.

---

*Cross-references: `docs/business-spec.md` (30-day operating plan + KPI grid),
`docs/broadcast-graphics.md` (the on-air graphics build), `docs/obs/csgn-ticker.html`
(the ticker + admin rails), `CSGN Business Plan.docx` (investor narrative),
`src/lib/slots.ts` (fee engine + slot marketplace toggle).*
