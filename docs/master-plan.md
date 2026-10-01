# CSGN Master Business Plan

> **Operating version — October 2026.** This document replaces the slot-marketplace, clip-first, burn, and “token as the product” plans. CSGN is an autonomous linear network. The broadcast earns attention; community and token mechanics deepen participation after the channel is worth watching.

## 1. Executive decision

**CSGN is live AI television for people who follow sports and crypto.** It packages verified live data, sourced stories, original analysis, and community programming into a channel that is always on and looks like television rather than a feed.

The launch product is one repeatable program: **The CSGN 30**, a 30-minute wheel updated throughout the day. Sports is the front door, crypto is covered with the urgency and visual language of sports, and the existing permanent lower-third supplies scores, prices, token highlighting, and the holder-funded Right Now Rail.

CSGN does **not** launch with an hour-long daily studio show and a second debate show. Those formats require distinct talent, editorial rhythms, and enough original reporting to avoid repetition. They become products only after the 30-minute wheel proves retention.

### The promise

> Turn it on at any time and understand what matters in sports and crypto within ten minutes.

### Source priority

1. **OWNER LIVE** — founder-led special coverage; always preempts.
2. **COMMUNITY** — bounded, rights-cleared pods inside the wheel.
3. **AUTO** — the default 24/7 program.
4. **SAFE** — locally cached evergreen packages and deterministic graphics.

There is no generic intermission and no clip-first baseline. Empty inventory returns to AUTO. Failure returns to SAFE.

## 2. Customer and problem

The primary viewer is 18–34, watches live sports, follows markets on X, and treats creators as commentators. Their information is fragmented across score apps, group chats, streams, and timelines. They do not need another infinite feed; they need selection, context, and company.

The first customer is the viewer. The second is a sports/crypto project that needs credible, disclosed distribution. The third is the creator who wants a television-quality stage without building a network alone.

The job CSGN performs:

- **Viewer:** compress the live internet into an entertaining, trustworthy channel.
- **Sponsor/project:** buy finite, labeled broadcast inventory with delivery reporting.
- **Creator:** appear in programmed blocks and earn from completed airtime.
- **Holder:** influence bounded entertainment and promotion inventory, never facts.

## 3. Product

### 3.1 The CSGN 30

The canonical wheel is implemented in `/autoplayer` and controlled in Admin → Autopilot. Its clock is deterministic: Cold Open; First Takeaway; Scoreboard; Market Season; station ID; The Board; Film Room; Numbers Game; Community Break; The Finish; reset.

Every package has an expiry, sources, rights status, review class, script hash, duration, sponsor state, and correction linkage. Code owns scores, prices, clocks, math, ordering, labels, and timeouts. Models may summarize or create transitions only from approved fact packets.

### 3.2 Trust is a visible feature

Every current item shows an “as of” time. Analysis is labeled. Promotions are labeled. Reruns are labeled. Scores and prices come from approved data APIs, not generated prose. Rumors require human approval or two independent approved sources. Corrections remain attached to every derivative.

The production chain fails closed: invalid or stale packages never enter READY; low queue depth takes SAFE; a stale heartbeat, black frame, silence, render error, disk pressure, or destination failure triggers an operator alert.

### 3.3 Community and $CSGN

The permanent lower-third remains the audience interaction layer:

- score and crypto modules stay deterministic;
- token highlighting is clearly promotional;
- the Right Now Rail accepts holder messages above a configurable balance threshold;
- token-weighted votes choose eligible entertainment topics, pilots, and community grants;
- no balance can alter a score, source, correction, or safety decision.

Community clips receive at most two minutes per wheel at launch. They must be 15–45 seconds, originate from the connected account, carry broadcast/derivative rights, and pass moderation. Allocation is based on completed seconds with square-root token weighting and a 10% daily identity cap.

## 4. Business model

CSGN sells scarce, measurable airtime—not favorable coverage.

| Product | Launch constraint | Buyer |
|---|---|---|
| Presenting sponsor | one per daypart | consumer, sports, exchange, wallet |
| 30-second spot | maximum one per wheel | approved advertisers |
| Ticker sponsor | one per day | brand partner |
| Sponsored Film Room | disclosed; editorial approval | protocol, league, product |
| Community promotion | only in labeled inventory | token projects/holders |
| Production services | fixed-price branded broadcast package | ecosystems and events |

**Do not forecast token appreciation as revenue.** Treasury receipts, sponsor revenue, and production revenue are separate. Creator payouts are expenses accrued only for completed, verified airtime.

### Initial pricing tests

Run direct sales, not self-serve ads: $250–500/day ticker sponsorship; $500–1,500 sponsored package; $1,500–5,000 event/daypart takeover; and $3,000–10,000 white-label broadcast production. These are hypotheses. Raise only after delivery reports show impressions, completed minutes, clips, and attributable actions.

## 5. Go-to-market

The channel itself is the acquisition engine. Every wheel should create at least one useful vertical clip, one sourced card, and one opinion prompt. Publish derivatives with a consistent show slug, visible source, and a direct invitation to watch the next update—not a generic token pitch.

Launch in three stages:

1. **Private proof:** fourteen consecutive two-hour rehearsals with no silence/black frame over five seconds, unsupported claim, unlabeled rerun, or rights violation.
2. **Eight-hour public day:** 4 PM–midnight ET for 30 days. Target 99.5% uptime, <5% SAFE time, <45 daily operator minutes, and 20% of viewers reaching ten minutes.
3. **24/7:** only after overnight evergreen inventory exists and four-week returning-viewer growth is positive.

Founder-led shows unlock later:

- **30-minute debate format:** pilot after the channel can source five defensible daily arguments and book a second voice consistently.
- **One-hour personality show:** pilot after recurring live audience and clip distribution justify its production cost.

## 6. Viral growth analysis

### Why it can spread

CSGN has a rare content loop: live events create high-intent moments; a channel turns them into a take; the take becomes a clip; disagreement distributes the clip; the next scheduled update converts attention back to live viewing. Crypto adds identity and participation, while sports supplies daily narrative and a much larger conversation graph.

The niche is not “AI broadcaster.” AI is production leverage, not the hook. The hook is **sports television for the internet economy that reacts at internet speed**.

### The viral unit

Design each distributable clip around:

1. a recognizable event in the first second;
2. one surprising but verifiable number by second five;
3. a clear opinion by second twelve;
4. a visual proof/source on screen;
5. an unresolved prompt viewers can argue about;
6. the next live update time.

The share object must work without sound, carry CSGN branding without obscuring the evidence, and land on a source/transcript page. “AI says” is never the premise.

### Four loops

- **Moment loop:** publish a verified score/market reaction within five minutes; update rather than delete when facts change.
- **Argument loop:** daily ranking or binary debate invites quote-posts; best counterargument enters The Finish with attribution.
- **Community loop:** selected fan message/clip airs, its creator receives a timestamped share link, and their audience watches for the appearance.
- **Partner loop:** a league, creator, or project receives an on-brand broadcast card and delivery report, then reposts the artifact to its audience.

### 90-day execution

**Days 1–14 — reliability.** Run unlisted rehearsals, build 30 READY minutes and two SAFE hours, verify source/rights metadata, and record failure reasons. Publish nothing generated automatically.

**Days 15–30 — repeatable clips.** Broadcast one eight-hour daypart. Hand-pick two clips/day: one live sports reaction, one Market Season/Numbers Game. Test three opening structures, but keep the show identity fixed.

**Days 31–60 — participation.** Add one daily audience argument and one Community Break/hour. Give every participant a pre-cut vertical asset and exact air timestamp. Start two distribution partnerships where the partner has a genuine editorial role.

**Days 61–90 — franchises.** Name the best-retaining recurring segment, publish it at the same time daily, sell one disclosed presenting sponsorship, and pilot the 30-minute founder debate once weekly.

### Scoreboard and kill criteria

Track weekly cohorts, not vanity impressions:

- median live minutes/viewer and percent reaching 10 minutes;
- returning viewers at 7 and 28 days;
- clip view → live-session conversion;
- shares per 1,000 views and comments per 1,000 views;
- source-page opens and correction rate;
- READY minutes, SAFE minutes, silence/black-frame incidents;
- sponsor renewal and revenue per broadcast hour;
- community submissions approved, completed, and reshared.

After 30 public days, change the opening if fewer than 15% reach ten minutes. Reduce Community Break if retention falls more than 10% at entry. Stop a clip format after 20 attempts if it cannot exceed the account's median share rate. Do not expand to 24/7 until uptime and return-viewer gates pass.

## 7. Team, governance, and risk

The minimum operating team is an executive producer/editor, broadcast engineer, and partnerships/distribution lead; one founder may cover the first and third roles temporarily. Voice and likeness must be original and contractually licensed. Do not imitate real anchors, reuse protected show branding, or air unlicensed sports footage.

Material risks: data licensing, defamation from fast reporting, financial-promotion rules, synthetic-media disclosure, music/media rights, platform dependence, wallet/security exposure, and sponsor influence. Mitigations are source classes, immutable audit logs, human approval for reported claims/ads, isolated playout credentials, SAFE assets, counsel review, and public correction/sponsorship policies.

## 8. Product roadmap

### Now — showcaseable control plane

- `/autoplayer`: a 1920×1080 clock-driven CSGN 30 output with AUTO/COMMUNITY/OWNER_LIVE/SAFE identity, rehearsal segment previews, safe lower-third clearance, and operator-controlled editorial frame.
- Admin → Autopilot: mode cuts, return-to-auto, hold-next, SAFE, editable lead/context/update promise, and links to every segment preview.
- Existing ticker/lower-third remains a separate OBS layer.

### Next — production automation

1. Define and validate the package/queue schema server-side.
2. Add heartbeat, destination, audio, black-frame, queue-depth, and freshness telemetry.
3. Integrate licensed sports and market providers; remove all demonstration cards.
4. Build fact-packet ingestion, human review, render workers, and immutable corrections.
5. Add completed-airtime logs and per-package derivative/export pages.
6. Wire OBS websocket/hotkeys to the same authoritative mode document.

### Explicitly retired

The old `/oldplayer` fallback, clip-first programming, open 24-hour slot marketplace as the primary product, burn mechanics, unlabeled token promotion, and generic intermission state are legacy. Old URLs redirect; historical implementation may remain in Git, not in the product narrative.

## 9. The next seven founder actions

1. Put `/autoplayer?preview=1` in a 1920×1080 OBS Browser Source beneath the existing permanent lower-third.
2. Rehearse every segment from Admin → Autopilot and verify title-safe spacing.
3. Choose licensed providers for scores/news and confirm broadcast/display rights in writing.
4. Commission original voice, music, sonic ID, and host character guidelines.
5. Build 30 minutes of reviewed packages plus two hours of SAFE inventory.
6. Run the first unlisted two-hour rehearsal and log every visible or audible failure.
7. Do not announce “autonomous” until fourteen clean rehearsals pass.
