# CSGN autonomous network — readiness, business, and investor evaluation

> **Bottom line:** the repository contains a credible community-airtime product
> and unusually developed broadcast graphics, but it does **not** yet contain an
> autonomous newsroom or playout system. CSGN can become a compelling network;
> calling it fully autonomous today would be inaccurate.

## 1. What exists and what does not

| Capability | Current evidence | Readiness |
|---|---|---|
| 24/7 OBS output | `/player`, master-control state machine, OBS overlays and setup docs | **strong prototype** |
| Sports/crypto visual identity | multi-league ticker, crypto dock, notices, now-watching, wipes | **strongest asset** |
| Holder clip supply | TikTok OAuth/import, clip review, balance-weighted airtime schedule | **built; needs real-world rights/retention proof** |
| Founder preemption | master source/slot and OBS workflow | **built conceptually; switching still operator-shaped** |
| Autonomous 30-minute show | no rundown service, fact-packet schema, TTS/avatar renderer, `/autoplayer`, package queue, source/correction page, or watchdog | **not built** |
| Continuous editorial inputs | ticker pulls data, but no licensed newsroom source registry or claim corroboration layer | **not built** |
| Audience business | no demonstrated returning audience, sponsor case study, or retention cohort in the repository | **unproven** |
| Company/investor readiness | strategy documents exist; no data room, financial model, cap table, rights register, KPI history, or fundraising deck | **not ready** |

The core architectural conflict is explicit: `channelMode.ts` allows exactly three
modes and describes the clip reel as the fallback. The new thesis needs AUTO as
the normal state and Community Break as bounded interruption inventory. That is a
product migration, not a copy change.

## 2. Honest likelihood of success

These are planning ranges, not statistical forecasts. They assume twelve months of
focused execution, original/licensed presentation, no major legal incident, and
enough runway to operate consistently.

| Outcome by month 12 | Current plan | After the required changes |
|---|---:|---:|
| Reliable autonomous public channel | 20–30% | 65–75% |
| Small loyal audience (100+ average concurrent or equivalent watch time) | 10–20% | 30–45% |
| Sponsor-supported niche business | 5–10% | 20–30% |
| Venture-scale breakout | under 5% | 8–15% |

Why the odds are not higher:

1. **Distribution is harder than automation.** A technically flawless empty
   channel is still empty.
2. **Sports rights and data are expensive constraints.** The classic-TV feeling
   cannot depend on unlicensed highlights or cloned talent.
3. **AI presentation is easy to sample and hard to live with.** Retention depends
   on taste, writing, pacing, characters, and corrections—not novelty.
4. **The product currently leads with token machinery.** Mainstream sports viewers
   will not learn wallet mechanics before deciding whether the show is good.
5. **One desktop is a single point of failure.** It is acceptable for proof, not
   for a funded network's service-level promise.

Why this can work:

1. The sports/crypto collision is distinctive and produces news every day.
2. The repo already has a broadcast look, continuous encoder pattern, clip intake,
   control surface, and public mode history—more than most concept-stage channels.
3. A fixed wheel lets a solo founder create recognizable television without
   producing 24 unique hours.
4. The token can control scarce, disclosed participation inventory instead of
   distracting from the viewer proposition.
5. Founder streams supply personality and gaming coverage that autonomous output
   cannot manufacture convincingly.

## 3. The changes, in priority order

### P0 — required before claiming autonomy

1. Add `auto` to the canonical channel-mode model and enforce precedence:
   `owner_live > community_break > auto > safe`.
2. Build a typed package/fact schema, source registry, expiry rules, and correction
   chain. Store exactly what supported every spoken claim.
3. Build `/autoplayer` with preloading, segment-boundary switching, local SAFE
   assets, heartbeat, silence/black-frame detection, and deterministic restart.
4. Build a scheduler that produces the CSGN 30 twice per hour and never schedules
   an expired or rights-unknown package.
5. Add TTS/render workers using only licensed/original voices, plus pronunciation,
   caption, audio-loudness, duration, and render QC.
6. Change holder airtime from “share of 24 hours” to “share of published Community
   Break inventory,” with completed-second settlement and a cap.
7. Narrow launch clips to 15–45 seconds and require connected-account provenance,
   broadcast rights, moderation state, sponsor flag, and rights expiry.

### P1 — required before audience acquisition

1. Create public `/schedule`, `/sources/:packageId`, `/corrections`, `/hosts`, and
   `/editorial-policy` experiences around the autonomous show.
2. Make the viewer landing page lead with **watch now, top stories, and next live
   game**, not wallets or airtime math.
3. Add first-party measurement: session start/end, minute retention, mode and
   package IDs, exits after mode switches, return frequency, and destination health.
4. Create an archive page where each package becomes a sourced, shareable page;
   clips link back to it.
5. Run an eight-hour sports-heavy day before expanding to 24/7. “Always on” is not
   valuable if the product is repetitive or unsafe.

### P2 — required before institutional fundraising

1. Move control/scheduling to a redundant hosted worker; keep desktop OBS as one
   encoder with a warm backup path.
2. Contract the data, music, fonts, voice/likeness, submitted-media, and distribution
   rights; maintain a renewal/expiry register.
3. Form the entity, assign all IP, document cap table/token relationship, approve a
   budget, carry appropriate insurance, and establish bookkeeping/tax/compliance.
4. Build sponsor order, creative approval, delivery log, invoicing, and make-good
   workflows. An ad product is not a text box in admin.
5. Publish treasury wallets, authorities, allocation, vesting, policies, conflicts,
   and historical transactions before pitching token utility as a moat.

## 4. Audience plan: earn habit before scale

### Positioning

Do not market “AI ESPN.” That invites a feature comparison CSGN cannot win and an
IP comparison it should avoid. Use:

> **CSGN — live sports and markets for the internet economy. Always on.**

The AI story belongs in the proof: the network updates itself, cites its work, and
keeps going. The consumer promise is excellent television.

### The first audience wedge

Own **sports fans who are crypto-literate**, not three separate audiences. Lead
with major US sports and use familiar sports grammar to make crypto legible:
standings, streaks, leaders, transactions, power rankings, film room, closing line.
Gaming appears when founder personality or a major competitive/cultural event makes
it relevant.

### Twelve-week launch

| Weeks | Product | Distribution | Proof |
|---|---|---|---|
| 1–2 | private two-hour rehearsals | none | defect log and rights audit |
| 3–4 | unlisted eight-hour day | invite 25 critical viewers | ten interviews; minute-retention curve |
| 5–6 | public 4 PM–midnight | two derived clips/day; reply into live sports moments | 25 returning weekly viewers |
| 7–8 | add founder tentpole twice/week | guests with adjacent audiences | viewer lift and next-day return |
| 9–10 | one Community Break/hour | onboard ten quality TikTok creators | switch-exit rate and creator referrals |
| 11–12 | sponsor pilot | sell one daypart, not “the network” | delivery report and renewal conversation |

The founder's two weekly shows are distribution events, not filler. Book one guest,
make one defensible argument, cut five derivatives, and drive viewers into the
autonomous channel that continues after the show.

### Weekly scorecard

**Audience:** unique viewers, average minute audience, median session, 10-minute
completion, returning viewers, hours watched.

**Programming:** retention by segment/mode, Community switch exits, freshness,
rerun share, correction rate, rights incidents.

**Reliability:** uptime, SAFE minutes, black/silent incidents, READY depth, cost per
air hour.

**Business:** qualified sponsor pipeline, booked revenue, delivery, gross margin,
cash runway.

**Token:** eligible contributors, unique contributors aired, completed community
seconds, concentration, treasury receipts. Never use token price as an operating KPI.

## 5. Operate like a company

### Founder roles

The founder has only four jobs: editor-in-chief, on-air personality, product owner,
and seller. Automation does assembly; contractors handle specialized rights/design;
bookkeeping and counsel stay outside the content loop.

### First hires after funding

1. **Founding broadcast engineer:** playout reliability, data integrations,
   observability, backup encoder.
2. **Senior producer/editor:** taste, rundown, fact standards, contributor pipeline.
3. **Part-time partnerships seller:** only after retention and inventory reports
   exist; initially commission plus a small retainer.

Do not hire a large social team, newsroom, token marketer, or 3D-avatar team first.

### Data room checklist

- entity documents, cap table, IP assignments, token mint/authority/treasury map;
- 24-month monthly model with headcount, data/rights, inference/render, distribution,
  legal, insurance, and contingency;
- product demo and architecture diagram; uptime/incident history;
- weekly audience cohorts and package/mode retention;
- source, footage, music, font, voice/likeness, and contributor rights register;
- editorial, corrections, advertising, privacy, security, and treasury policies;
- sponsor pipeline, pilot order, delivery report, and testimonials;
- roadmap, use of funds, hiring plan, and top risks.

### Fundraise milestone and ask

Do not open a broad process yet. Spend 8–12 weeks producing evidence. Begin
relationship-building now; formally raise when all are true:

- 30 days of 99.5% public playout uptime;
- four consecutive weeks of returning-viewer growth;
- at least 100 average concurrent viewers **or** 10,000 weekly hours watched with a
  credible acquisition source;
- median session above ten minutes;
- one paid sponsor pilot and a second qualified buyer;
- clean rights register, entity/IP/cap table, and 18-month operating model.

A reasonable pre-seed narrative is an 18-month runway to: redundant playout, a
small licensed original slate, repeatable sponsor sales, and a measured loyal
audience. Size the dollar ask from the bottom-up model; do not reverse-engineer it
from a desired valuation.

## 6. Investor search plan

Target investors in this order:

1. sports/media technology seed funds that understand rights and audience;
2. interactive entertainment/gaming funds that understand live communities;
3. crypto infrastructure/consumer funds that accept a media-first business;
4. strategic angels: former sports-network producers, streaming executives,
   creator-economy founders, league/team digital leaders, and ad-sales operators;
5. strategic companies only when distribution/data value outweighs exclusivity risk.

Build a list of 40: 10 lead candidates, 15 specialist funds, and 15 operators.
Score each 0–2 on stage, check size, sports/media thesis, consumer experience,
crypto comfort, portfolio conflicts, follow-on capacity, and relevant introductions.
Only contact the top 15 in the first wave.

Potential thesis-fit names to research—not a claim of current availability or an
endorsement—include Courtside Ventures, Sapphire Sport, BITKRAFT Ventures, Konvoy,
Lerer Hippeau, a16z crypto, Multicoin Capital, and Solana Ventures. Verify each
fund's current team, thesis, check size, active fund, conflicts, and submission path
immediately before outreach.

### Deck: ten slides

1. **The show:** 30 seconds of the best wheel, not a logo animation.
2. **Problem:** sports television lost personality; internet finance has no trusted
   live desk; feeds do not create habit.
3. **Product:** AUTO + COMMUNITY BREAK + OWNER LIVE precedence.
4. **Why viewers return:** franchises, freshness, opinion, scoreboard, trust.
5. **Why now:** production automation makes a niche linear network economically
   possible; do not claim it makes audience automatic.
6. **Traction:** retention cohorts, returning viewers, uptime, sponsor proof.
7. **Business:** sponsorship first; syndication/data/production second; token is
   participation infrastructure, not the revenue thesis.
8. **Moat:** programming system, archive/data, contributor network, brand, and
   accumulated viewer behavior—not access to generic models.
9. **Plan/team:** next 18 months and the first two hires.
10. **Ask:** amount, runway, milestones, and specific use of funds.

### Outreach sentence

> CSGN is an always-on sports-and-markets network built for the internet economy.
> Our autonomous 30-minute desk runs continuously, our founder can take it live at
> any moment, and token holders program a bounded community break. We are raising
> after proving viewers return for the show—not merely that AI can generate it.

## 7. Kill criteria

After 12 public weeks, pause expansion and change the show if median session remains
under five minutes or fewer than 15% of weekly viewers return. Remove Community
Break from the main wheel if it causes a sustained retention drop over 10%. Do not
expand to 24/7 if SAFE exceeds 5% or daily intervention exceeds 45 minutes. Do not
raise on token momentum without audience retention and rights cleanliness.

The company wins by becoming a show people choose, not by becoming a machine that
can fill time.
