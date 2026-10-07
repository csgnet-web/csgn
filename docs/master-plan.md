# CSGN Master Business and Operating Plan

> **Authoritative plan — October 2026.** This is the only business, product, programming, growth, and roadmap document. Technical setup belongs in `docs/autonomy-runbook.md`, `docs/obs/README.md`, and the narrowly scoped engineering runbooks. If another file conflicts with this plan, this plan wins.

## Executive summary

**CSGN is the sports network for the internet economy.** It is a 24/7 linear channel where sports, crypto markets, competitive gaming, creator culture, and new forms of organized competition are programmed with the pace and clarity of television.

The immediate product is an autonomous live network operated from one home-PC OBS installation. Two original AI-assisted commentators host a continuously refreshed thirty-minute program wheel. One uses the founder's licensed voice; the other uses a separately licensed original voice. Deterministic graphics—not generative narration—own scores, prices, schedules, standings, clocks, sources, disclosures, and corrections.

The existing CSGN product remains the participation layer:

- the permanent lower-third carries sports scores, crypto prices, $CSGN highlighting, Coin Spotlight, and the holder-funded Right Now Rail;
- approved TikTok clips and advertisements enter short, labeled breaks through the existing connected-account and moderation flow;
- a connected Twitch streamer can be selected from Admin and preempt autonomous programming;
- the founder's live program feed can always take control;
- $CSGN provides access to bounded participation and promotion, not editorial truth.

The long-term ambition is not merely an AI crypto stream. It is a new network category: **sports-and-markets entertainment**, capable of originating its own competitions, personalities, formats, data products, and rights inventory. That includes 37U football, corporate lacrosse, gaming treated as sport, personality-led studio shows, debate formats, documentaries, and eventually live event production.

This plan is ambitious but does not assume that market leadership or thousands of daily viewers are automatic. CSGN earns that position through reliability, distinctive programming, distribution, rights ownership, measurable retention, and a production-cost advantage competitors cannot easily match.

---

## 1. Mission, category, and audience promise

### Mission

Build the most entertaining and efficient always-on network covering sports, crypto, and gaming as sport—and use that network to create competitions and programming traditional media would never originate.

### The viewer promise

> Turn on CSGN at any time and understand what matters in sports and crypto within ten minutes, then stay because the personalities and formats are fun.

### Category

CSGN is not:

- a token project looking for token utility;
- a scrolling social feed;
- a playlist of disconnected creator clips;
- an AI avatar reading headlines;
- an imitation of ESPN branding, talent, or protected show formats;
- a source of gambling picks or personalized financial advice.

CSGN is a **programmed network**. The scarce asset is airtime. The schedule, editorial selection, recurring personalities, live data, participation layer, and original rights make the channel a product even when no creator is currently live.

### Initial audience

The primary viewer is 18–34 and overlaps several behaviors:

- follows major US sports and sports culture;
- checks crypto markets and X throughout the day;
- treats creators and group chats as commentators;
- understands gaming, fantasy, memes, and internet-native competition;
- wants highlights, arguments, and context rather than another dashboard.

Sports is the broad acquisition surface. Crypto provides urgency, identity, participation, and a native business ecosystem. Gaming supplies personalities, rivalries, and new forms of competition. They must feel like one culture—not three unrelated channels sharing a ticker.

---

## 2. The complete product portfolio

### 2.1 CSGN Live Network

The core product is the continuous channel delivered through OBS to the current distribution destination and embedded on `/watch`.

Source precedence:

```text
1. OWNER LIVE
2. SELECTED CONNECTED TWITCH STREAMER
3. SCHEDULED COMMUNITY / AD BREAK
4. CSGN AUTO
5. SAFE
```

- **OWNER LIVE:** founder-hosted special coverage, gameplay, interviews, and event broadcasts.
- **STREAM TAKEOVER:** a connected, consented Twitch member chosen from the admin roster. Verified completed airtime remains the basis for any creator economics.
- **COMMUNITY / AD BREAK:** a short, reviewed TikTok-originated pod. Advertisements are unmistakably disclosed and frequency-capped.
- **CSGN AUTO:** the default two-commentator autonomous program.
- **SAFE:** locally cached, rights-cleared evergreen programming with current deterministic ticker data.

A single director must eventually own all five sources. It cuts only at clean boundaries, maintains one authoritative on-air state, records completed seconds, and automatically takes SAFE when health checks fail.

### 2.2 The CSGN 30

The launch format is a stable thirty-minute wheel that repeats twice per hour while its facts, visuals, and discussion update:

| Clock | Segment | Purpose |
|---:|---|---|
| `0:00` | Cold Open | State the most important current story immediately |
| `0:20` | First Takeaway | Verified facts, one useful interpretation, what changes next |
| `4:00` | The Scoreboard | Live/recent sports, shown as graphics rather than read aloud |
| `7:00` | Market Season | BTC/ETH/SOL and one consequential market story treated like standings |
| `11:00` | CSGN ID | Short identity/reset and clear mode/source label |
| `11:30` | The Board | Four concise current stories, no more than two crypto items |
| `16:00` | Film Room | Durable original explanation, strategy, history, or tape/data breakdown |
| `20:00` | Numbers Game | One deterministic comparison, ranking, or model output |
| `23:00` | Community Break | Approved member content or disclosed TikTok advertisement |
| `25:00` | The Finish | Strongest opinion, debate, correction, or viewer counterargument |
| `28:30` | Next / Reset | Upcoming games, next update, sources, clean loop point |

Dayparts alter editorial emphasis without creating a different production system:

- **6–10 AM ET:** overnight results, morning slate, global markets.
- **10 AM–4 PM:** breaking news, explainers, press conferences, durable Film Room.
- **4 PM–1 AM:** live games first, scoreboard whiparound, founder or streamer takeovers.
- **1–6 AM:** international sports, crypto, and clearly time-stamped best-of packages.

### 2.3 Permanent BottomLine and audience participation

The existing lower-third remains a separate OBS layer and a core product:

- sports scores and schedules;
- crypto prices and market movement;
- $CSGN token highlighting;
- Coin Spotlight;
- Right Now Rail messages submitted by qualifying holders;
- breaking labels, now/next, votes, and corrections where configured.

Coin Spotlight and the Right Now Rail are the existing promotional products. CSGN must not create redundant generic sponsorship controls that compete with them. Paid placement is labeled; it never changes reporting, rankings, scores, or corrections.

### 2.4 Community and TikTok break network

Members connect their own TikTok account, import a post, grant necessary rights, and submit it. Admin reviews the actual source post. Approved clips receive bounded airtime rather than becoming the default program.

The same intake can support revolutionary TikTok-native advertising:

- advertiser connects the account that published the creative;
- creative is submitted as `contentKind: ad` with campaign and disclosure fields;
- rights, claims, music, likeness, and territory are reviewed;
- the director schedules it only inside an ad-eligible break;
- the overlay says `ADVERTISEMENT · @account` for the full play;
- frequency caps prevent repetition;
- completed plays—not scheduled plays—drive delivery reports.

This is not a separate self-serve ad marketplace at launch. It is the existing connected-account workflow with stricter metadata, review, and reporting.

### 2.5 Connected-streamer network

A member connects Twitch, verifies control, and explicitly grants forwarding consent. The roster service detects who is live, audience size, title, category, and recent CSGN airtime. Admin receives ranked recommendations and can put a creator on air with one action.

The product advantage is curation: CSGN does not relay every live channel. A streamer earns the interruption by being timely, watchable, safe, and relevant. The viewer should understand who is on, why, and when AUTO returns.

### 2.6 Founder live programming

The founder remains a programming advantage, not an operational dependency. OWNER LIVE supports:

- breaking-news reaction;
- marquee sports and crypto moments;
- interviews;
- gameplay and gaming culture;
- event desk coverage;
- pilots for future original shows.

The autonomous network provides the daily floor. Founder appearances create peaks and personality. The founder should not need to manually fill dead air.

### 2.7 $CSGN participation layer

$CSGN is the remote, not the facts department. Existing and intended uses include:

- eligibility and prioritization for Right Now Rail messages;
- Coin Spotlight participation;
- token-weighted votes on eligible entertainment topics and pilots;
- community-break allocation under caps and anti-concentration rules;
- recognition, access, and future community grants.

The token never determines scores, sources, corrections, safety decisions, whether an ad is disclosed, or whether a reported allegation airs. Treasury activity, creator compensation, promotional payments, and company revenue must be accounted for separately.

### 2.8 Website and member product

The website is the network companion:

- `/watch`: live channel, current identity, schedule, interaction entry points;
- `/autoplayer`: chrome-free OBS program source;
- Admin → Autopilot: daily control room;
- accounts/profiles: verified identity, wallet, Twitch, TikTok, history;
- participation: votes, Right Now, Coin Spotlight, clip submissions;
- schedule/history: what aired, who appeared, completed airtime;
- treasury: disclosed on-chain balances and rules;
- source/transcript pages: future public evidence and correction record for packages.

The website must funnel toward watching, participating, or connecting a creator account. Legacy mechanics should not compete in primary navigation.

### 2.9 Automated Discord newsroom

Discord is the private operating companion and the public community loop—not an independent content generator.

**Newsroom channels:**

- `#wire-sports`, `#wire-crypto`, `#wire-gaming`: normalized candidates from approved sources;
- `#needs-review`: rumors, injuries, investigations, ads, and first-time sources;
- `#ready-queue`: packages that passed checks and their expiry;
- `#on-air-now`: source, segment, package ID, remaining time, health;
- `#alerts`: stale data, silence, black frames, queue depth, destination, disk;
- `#corrections`: proposed, approved, aired, propagated;
- `#social-desk`: suggested X posts, clip captions, thumbnails, and publish times;
- `#daily-report`: uptime, SAFE minutes, packages, clips, viewers, actions.

Bots may recommend copy and create drafts from approved packages. They may not publish unsupported breaking news, remove disclosure, invent a source, or silently alter an aired correction. Every social suggestion inherits the package ID and source set.

### 2.10 Distribution and clip factory

Every approved fact packet should become one content tree:

```text
fact packet
  → broadcast package
  → transcript + source page
  → 20–45 second vertical clip candidates
  → score/headline card
  → X/Threads draft
  → Discord summary
```

Vertical derivatives must work without sound, show the evidence, include captions, preserve promotion/correction labels, and end with a specific next-live-update time. CSGN publishes fewer, stronger artifacts rather than flooding every platform with generic AI summaries.

---

## 3. Original programming roadmap

Original programming is how CSGN moves from efficient aggregator to defensible network. Formats must use original names, art, music, characters, and rules. “Similar to” describes audience function, never copying protected expression.

### Phase A: recurring studio franchises

#### The CSGN 30
Always-on flagship described above. It establishes anchors, segment names, graphic language, and editorial trust.

#### The Debate Desk
A 30-minute, two-perspective show inspired by the energy of fast sports argument programs without copying their names, timing gimmicks, set, or characters. Five defensible topics, a visible evidence card, concise positions, and an explicit final call. Pilot weekly only after the newsroom can supply five non-forced arguments.

#### CSGN Live
A one-hour personality-led show serving the cultural role that interactive sports-entertainment shows once served: audience prompts, rankings, challenges, gaming, sports culture, crypto crossover, and live reactions. It should be founder-led initially; AI anchors support data and transitions rather than pretending to have lived experience.

#### Market Season
A daily program treating networks, ecosystems, tokens, and protocols like teams in a league—standings, momentum, injuries/risks, transactions, and film-room explanations—without giving individualized investment advice.

#### Film Room
A weekly 6–12 minute original that builds authority: sports tactics, salary-cap/economics, game design, market structure, creator business, or the mechanics behind a major story.

### Phase B: gaming as sport

CSGN treats structured gaming competition with the same grammar as sport:

- scheduled matches and seasons;
- teams, standings, transactions, injuries/availability, and rivalry;
- pregame, desk, highlights where rights permit, and postgame;
- verified results and transparent rules;
- creator-led commentary and documentary storytelling.

Start with games where CSGN can organize the league and therefore own the schedule, data, participant releases, broadcast rights, and story arcs. Online dynasty leagues and community tournaments are cheaper pilots than purchasing third-party esports rights.

### Phase C: owned sports properties

#### 37U Football
37U is a CSGN-originated football property designed around adult competition, personality, accessibility, and digital-first storytelling. Before announcing the format, CSGN must define:

- what “37U” means and eligibility rules;
- tackle, flag, seven-on-seven, or another format;
- player safety, insurance, medical coverage, waivers, and venue rules;
- league/team ownership and governance;
- officiating and discipline;
- season length and geography;
- compensation and eligibility;
- music, marks, likeness, statistics, wagering-data restrictions, and media rights.

**Pilot:** one combine/content day and one exhibition, not a full league. Produce player profiles, mic'd-up material with releases, a draft/ranking show, live game coverage, and postgame. The success gate is repeat viewing and sponsor/venue demand—not merely viral impressions.

#### Corporate Lacrosse League
A company-based lacrosse competition can combine adult recreation, professional identity, recruiting culture, and B2B distribution. Companies field teams; CSGN owns the format, schedule, broadcast, standings, and season narrative.

Start in one city with four to six teams and a one-day pilot. Required foundations:

- employer/team participation agreement;
- player eligibility and release;
- venue, officials, medical plan, insurance, and equipment rules;
- company mark permissions;
- anti-harassment and conduct policy;
- owned broadcast and derivative rights;
- clear separation from employment decisions;
- season budget and minimum committed team fees.

The broadcast opportunity is larger than the live match: team reveals, employee-athlete profiles, weekly power rankings, transaction parody used carefully, office rivalry, and a championship special.

### Phase D: event and rights studio

Once CSGN can reliably produce its own events, it can offer production and distribution to emerging leagues, crypto conferences, gaming tournaments, combines, and creator competitions. CSGN should prefer partnerships where it receives enduring footage/data/format rights, not just a one-day production fee.

### Programming greenlight rules

A new show or league launches only when it has:

1. a distinct audience job;
2. a named accountable producer;
3. a repeatable source of stories or competition;
4. documented media and participant rights;
5. a production budget and stop-loss;
6. a distribution plan beyond CSGN's owned account;
7. a measurable pilot gate;
8. no dependency that threatens the core 24/7 channel.

---

## 4. Autonomous production system

### 4.1 Editorial pipeline

```text
licensed data + approved primary sources
  → normalize / deduplicate / timestamp / rights-tag
  → rank for daypart
  → FACT PACKET
  → structured two-anchor script
  → claim/source validator
  → pronunciation + policy + disclosure checks
  → voice and visual render
  → automated QC
  → READY queue
  → director / OBS / distribution
  → transcript, sources, clips, social drafts, archive
```

**Code owns:** scores, prices, arithmetic, schedules, clocks, source labels, expiry, disclosures, priority, and timeouts.

**Models own:** summaries, transitions, analogies, debate positions, headlines, and derivative copy only from supplied fact packets.

**Human approval remains required for:** reported allegations, injuries/trades without primary confirmation, investigations, first-time sources, political/high-risk claims, advertisements, corrections, and any package whose rights status is unclear.

### 4.2 Content freshness

Every item has `createdAt`, `sourcePublishedAt`, `freshUntil`, `lastVerifiedAt`, and `updatePolicy`.

- live scores: seconds/minutes depending on licensed feed;
- schedules/standings: refreshed around event changes and at least daily;
- prices: server-cached frequent updates with visible timestamp;
- breaking news: revalidated before every replay;
- analysis: fact dependencies expire independently;
- evergreen: still requires rights and periodic accuracy review;
- reruns: visibly labeled `RECORDED` with original time.

Expired content cannot be selected. If the READY queue falls below threshold, the director uses deterministic boards and SAFE content; it never asks a model to improvise live facts.

### 4.3 Two-anchor production

Anchor A uses the founder's explicitly consented clone for commentary. Anchor B uses a contracted or designed original voice with synthetic-use rights. Each anchor needs a written character bible, pronunciation dictionary, emotional range, prohibited behaviors, and disclosure policy.

For launch, pre-render audio and limited avatar shots. Real-time talking avatars add latency and failure modes without improving most data-led segments. Use anchors for openings, transitions, opinions, and chemistry; use full-screen graphics for facts.

### 4.4 Playout director

The director is the missing keystone. It must:

- resolve the five-source precedence order;
- finish or requeue a community/ad play correctly;
- cut Twitch/OWNER sources at a safe transition;
- resume AUTO at a segment boundary;
- reject stale/unready packages;
- maintain program audio normalization;
- record actual start/end/completed seconds;
- publish one on-air document consumed by web, ticker, Discord, and archive;
- heartbeat every few seconds;
- take SAFE automatically on failure;
- restart in SAFE after a reboot.

### 4.5 Home-PC OBS architecture

A home PC can be sufficient for the first growth stage if it behaves like a broadcast appliance:

- wired Ethernet, UPS, adequate cooling, and automatic OS updates disabled during air;
- dedicated restricted OS account without wallets, email, or social sessions;
- OBS 1920×1080, 30 fps, hardware encoding, local one-hour recordings;
- browser sources kept warm rather than refreshed on every cut;
- local SAFE media and fonts;
- separate audio buses/limiters for anchors, clips, streams, music, and alerts;
- OBS WebSocket restricted to localhost/VPN and strong credentials;
- automatic reboot/relaunch into SAFE;
- second-device monitoring over a different network;
- remote power/recovery plan and documented manual fallback.

A home setup is **not** sufficient by itself for mature 24/7 service. Power, ISP, Windows updates, GPU drivers, disk, and physical access are single points of failure. After retention is proven, add a cloud or second-location standby encoder that can take over without changing the destination.

### 4.6 Observability and failover

Monitor:

- program heartbeat and current package;
- queue depth and hours planned;
- data-source freshness/errors;
- audio loudness and silence;
- black/frozen frames;
- render failures and durations;
- CPU/GPU temperature and utilization;
- free disk and recording health;
- OBS dropped frames and reconnects;
- destination ingest/playback health;
- Discord/webhook delivery;
- SAFE entries and recovery time.

Critical alerts go to Discord and a second out-of-band channel. An alert is not a fallback. SAFE must happen automatically.

---

## 5. Admin product: one daily control room

Admin → Autopilot should become the only screen needed for routine operation:

### Always visible

- actual mode and source;
- program preview and audio meters;
- current/next package, time remaining, freshness, sources;
- READY minutes and SAFE inventory;
- destination, OBS, renderer, feeds, disk, and heartbeat health;
- critical actions: TAKE OWNER, RETURN AUTO, TAKE STREAM, TAKE SAFE, HOLD NEXT, KILL AUDIO.

### Collapsible workflows

- editorial review and corrections;
- two-anchor package/script/voice render;
- TikTok community/ad review;
- connected Twitch roster and recommendation;
- ticker, Coin Spotlight, and Right Now controls;
- social/Discord drafts;
- history, delivery, and incident logs.

Specialized pages may remain for accounting, auth events, treasury, and deep configuration, but duplicate daily controls should disappear.

Every on-air action needs confirmation appropriate to risk, success/failure feedback, an audit entry, and a visible effect preview. Never make an operator coordinate two contradictory mode systems.

---

## 6. Business model

### Core principle

CSGN monetizes a valuable audience, finite attention inventory, owned formats, and production capability. It does not rely on token appreciation as operating revenue.

### Revenue lines

1. **Existing $CSGN products:** Coin Spotlight and Right Now Rail participation routed according to published treasury rules.
2. **TikTok-native ad breaks:** reviewed creative from connected accounts, labeled and delivery-reported.
3. **Original-program integrations:** disclosed segment support, set presence, challenges, or presenting relationships that do not influence facts.
4. **Event and league partnerships:** team fees, venue partnerships, production fees, distribution rights, and brand support for 37U/corporate lacrosse/gaming properties.
5. **Production studio services:** broadcast packages for emerging competitions and ecosystem events where they strengthen CSGN's library or relationships.
6. **Content licensing:** future licensing of original formats, footage, data packages, and documentaries.
7. **Creator economics:** verified completed airtime can participate in defined fee/revenue pools; terms must be transparent and never promise unsupported income.

### Financial discipline

Maintain separate ledgers for company revenue, treasury/token receipts, advertiser liabilities, creator amounts, event budgets, and prizes. Publish material token treasury rules. No burn narrative, appreciation promise, fake guarantee, or undisclosed paid editorial treatment.

Each show/event has a contribution view:

```text
cash revenue
- rights/data
- talent/voice
- rendering/compute
- distribution
- production labor
- venue/insurance/officials (events)
- creator obligations
= contribution before overhead
```

Do not scale an original league until the pilot budget, rights chain, insurance, and repeat-demand case are understood.

---

## 7. Growth and distribution plan

### Efficiency is a moat only if content is wanted

Automation lowers the cost and reaction time of good programming; it does not force the market to watch. The moat becomes real when CSGN combines:

- reliable 24/7 availability;
- trusted, fast fact handling;
- recognizable original personalities and franchises;
- owned community and event rights;
- a database of packages, sources, transcripts, clips, and performance;
- distribution partners who benefit from appearing;
- feedback loops that improve programming from retention data.

### The growth loop

```text
live event → fast verified take → strong broadcast moment
→ vertical clip/card → argument or useful share
→ next-live promise → live viewer
→ participation/creator appearance → their audience redistributes
→ retention data improves the next rundown
```

### Daily distribution output

From the approved package system, produce at most:

- two high-conviction vertical clips;
- one morning slate card;
- one evening results/market card;
- timely score/breaking cards when genuinely useful;
- one audience question that can feed The Finish;
- Discord news and social recommendations.

Do not auto-post everything. Human approval remains the default for commentary and breaking news until a narrowly defined format has at least 30 clean days.

### Platform roles

- **X:** live conversation, current clips/cards, crypto/sports network graph, broadcast destination if operationally best.
- **TikTok / Reels / Shorts:** discovery through self-contained arguments, surprising data, and personality.
- **Discord:** retention, newsroom transparency, alerts, community sourcing, and draft recommendations.
- **Website:** owned viewing, identity, participation, sources, archive, conversion.
- **Twitch creators:** supply, personalities, cross-audience takeovers—not necessarily CSGN's sole distribution destination.
- **Partners/teams/companies:** distribution nodes for original competitions and appearances.

### Viral artifact requirements

Every clip needs:

1. recognizable moment in the first second;
2. surprising verified fact by second five;
3. clear position or payoff by second twelve;
4. visible evidence or source context;
5. captions and strong mobile composition;
6. an unresolved prompt worth responding to;
7. next update/show time;
8. inherited ad/correction labels.

“An AI said this” is not a durable hook. The take, evidence, personality, or access must be the hook.

### Audience milestones

Use gates rather than promises:

- **Proof:** 100 daily unique viewers, meaningful 10-minute completion, positive 7-day return.
- **Fit:** 1,000 daily viewers with organic clip-to-live conversion and repeatable returning cohorts.
- **Franchise:** recurring segments with independent search/direct demand and partner reposting.
- **Network:** several original franchises, owned event rights, and reliable multi-daypart viewing.

Thousands of daily viewers are an outcome to earn, not a planning assumption.

---

## 8. Metrics

### North star

**Weekly returning viewers who watch at least ten minutes.** This rewards reach, retention, and habit without hiding behind total impressions.

### Programming

- median session minutes and 10/30-minute completion;
- segment entry-to-exit retention;
- return at 1, 7, and 28 days;
- AUTO vs streamer vs community/ad retention;
- unique viewers by daypart;
- repeat demand for named franchises.

### Distribution

- qualified views, shares, saves, comments per 1,000 views;
- clip → live click and live ten-minute conversion;
- creator/partner repost rate;
- source-page opens;
- follower/email/Discord conversion;
- percentage of clips above account median.

### Trust and operations

- unsupported-claim count (target zero);
- correction count, severity, and propagation time;
- stale content incidents;
- playout uptime and SAFE percentage;
- silence/black-frame incidents over five seconds;
- READY minutes and generation failure rate;
- daily human minutes excluding live hosting;
- mean detection and recovery time.

### Business

- revenue and contribution per broadcast hour;
- repeat advertiser/partner rate;
- delivered vs contracted ad plays;
- cost per finished package/clip;
- creator liability and payment timing;
- event pilot contribution and renewal intent.

---

## 9. Gaps that can stop CSGN

### Critical product gaps

1. **No single production director yet.** `/player` and `/autoplayer` still need one authoritative source resolver and boundary-safe handoff.
2. **No production package queue/render worker.** The demo package editor proves the contract but not scalable generation.
3. **No licensed sports/news feed selected.** Placeholder data must never be mistaken for a broadcast product.
4. **No automated voice/render/QC pipeline.** Browser speech is rehearsal-only.
5. **No health-driven SAFE failover.** Manual recovery cannot support unattended 24/7 claims.
6. **Community clips are not yet first-class ad campaigns.** Disclosure, frequency caps, campaign delivery, and rights metadata are missing.
7. **No public transcript/source/correction pages for generated packages.** Trust and derivative propagation need them.
8. **Admin still contains historical schedule/accounting complexity.** Daily operation needs one cockpit after director migration.

### Business and legal gaps

1. sports data display/broadcast licenses;
2. news text/image/video rights and source terms;
3. founder voice consent record and second-voice synthetic license;
4. music and visual asset chain of title;
5. community/advertiser broadcast and derivative rights;
6. defamation, financial-promotion, synthetic-media, privacy, and advertising review;
7. event insurance, medical, venue, participant, mark, and footage agreements;
8. accounting treatment for token treasury, creator fees, ads, and prizes;
9. platform concentration and destination contingency.

### Growth gaps

1. no proven recurring franchise yet;
2. insufficient original reporting/access if the channel only summarizes public news;
3. no systematic guest/team/company distribution partnerships;
4. no clip-to-live attribution and cohort dashboard;
5. risk of high output with low distinctiveness;
6. risk that synthetic talent feels generic or uncanny;
7. no second operator/recovery owner for founder absence.

Each gap has an owner and deadline before 24/7 public positioning.

---

## 10. Roadmap from here

### Stage 0 — visible demo (current)

- `/autoplayer` 30-minute wheel and two-anchor demo;
- hosted audio support and rehearsal voices;
- Admin Autopilot mode/editor surface;
- existing TikTok review and Twitch roster exposed in that control room;
- existing permanent lower-third preserved.

**Exit:** founder approves the product shape, anchor roles, and visual direction.

### Stage 1 — real two-hour rehearsal (weeks 1–2)

- select licensed data/news sources;
- create two voice assets and character bibles;
- implement `factPackets`, `packages`, `renders`, and `playoutQueue` server contracts;
- add server-side script generation with claim IDs;
- add voice rendering, object storage, and FFmpeg QC;
- build 30 READY minutes and two SAFE hours;
- wire Discord newsroom/alerts/drafts.

**Exit:** 14 consecutive two-hour unlisted rehearsals with zero unsupported claims, rights violations, unlabeled ads/reruns, or silence/black frames over five seconds.

### Stage 2 — one eight-hour public daypart (weeks 3–8)

- implement the single director and automatic SAFE;
- connect licensed live data;
- add public sources/transcripts/corrections;
- add TikTok ad metadata, disclosure, cap, and play log;
- add OBS/PC/destination telemetry;
- publish two selected verticals daily;
- begin partner/guest distribution.

**Exit:** 30 days at 99.5% playout uptime, SAFE under 5%, daily operation under 45 minutes, positive four-week returning-viewer trend, and no unresolved material correction.

### Stage 3 — 24/7 (months 3–4)

- add overnight/global packages and deeper evergreen library;
- add second-location/cloud standby;
- tune dayparts from retention;
- graduate narrowly safe social formats to auto-publish;
- sell/operate first TikTok-native ad campaigns;
- pilot weekly Debate Desk.

**Exit:** four stable weeks, queue never below threshold, failover proven, advertiser delivery auditable, and 20% of viewers reaching ten minutes.

### Stage 4 — personality and gaming franchises (months 4–8)

- launch weekly CSGN Live;
- launch owned online gaming league/season;
- expand Film Room and Market Season;
- recruit recurring contributors;
- create original music/visual/character package;
- develop one repeatable partner distribution network.

### Stage 5 — owned sports pilots (months 6–18)

- legally and financially define 37U;
- run a combine/content day and exhibition;
- recruit one-city corporate lacrosse pilot;
- secure venue, insurance, officials, medical, releases, and rights;
- produce documentary/studio lead-in and postgame;
- greenlight seasons only from pilot evidence.

### Stage 6 — network scale

- multiple original shows and seasons;
- rights and format library;
- production partnerships and licensing;
- professional newsroom and engineering coverage;
- redundant playout infrastructure;
- credible competition with established sports networks in personality, studio, and non-event programming.

---

## 11. Team and ownership

### Minimum launch responsibilities

- **Founder / executive producer:** voice, taste, final editorial standard, marquee hosting, partnerships.
- **News producer:** source approval, fact packets, risky-item review, corrections, rundowns.
- **Broadcast/product engineer:** director, render pipeline, OBS, telemetry, recovery.
- **Distribution producer:** clips, social approvals, Discord, partner delivery, analytics.

One person may cover multiple roles at first, but every live day needs a named on-call owner. The system should reduce repetitive labor, not erase accountability.

### Hiring triggers

- hire/contract a producer when daily approval exceeds 45 minutes;
- add engineering/on-call redundancy before public 24/7 claims;
- add sales/partnership ownership only after delivery and retention are measurable;
- hire event operations expertise before any 37U or lacrosse physical pilot;
- retain specialist counsel before paid ads, synthetic talent at scale, or owned competition.

---

## 12. Capital and operating priorities

Spend in this order:

1. rights-cleared data and source access;
2. reliable voice/visual identity and music;
3. queue, render, director, QC, monitoring, and failover;
4. distribution/editorial labor;
5. original pilot rights and production;
6. sales expansion after measurable inventory exists.

Do not spend early capital on a large studio, many simultaneous shows, real-time avatar novelty, an unproven full sports season, or growth ads sending viewers to unreliable programming.

Maintain at least three budgets: core network monthly burn, each original-program contribution budget, and each physical-event standalone budget.

---

## 13. Operating rules

1. **Never fake live.** Show `AS OF`, `RECORDED`, source, and mode honestly.
2. **Never let a model calculate a displayed fact.** Use deterministic code/data.
3. **Never air unreviewed ads, allegations, or unclear rights.**
4. **Never create a second product for something Coin Spotlight, Right Now, TikTok intake, or Twitch roster already does.**
5. **Never resume mid-sentence after a takeover.** Return at a clean boundary.
6. **Never call a manual fallback autonomous.** SAFE is automatic.
7. **Never confuse output with demand.** Retention and return decide programming.
8. **Never copy a competitor's protected show identity.** Build original franchises.
9. **Never expand physical events before insurance, medical, rights, and economics are complete.**
10. **Never create another strategy document.** Update this plan or the technical runbook.

---

## 14. Founder decisions required now

The engineering sequence is defined. Work is blocked only on these product inputs:

1. names, looks, relationship, temperament, and prohibited traits for both anchors;
2. final consented founder voice recordings and licensed second voice;
3. selected sports/news/data providers and purchased rights;
4. first thirty minutes of scripts and source packets;
5. pronunciation dictionary;
6. original music/sonic identity and visual anchor assets;
7. initial SAFE library;
8. whether the first owned competition pilot is gaming, 37U exhibition, or corporate lacrosse;
9. daily public launch daypart and primary stream destination.

After those are supplied, the next engineering work is execution: queue APIs, render worker, director, telemetry, Discord automation, and rehearsal—not more ideation.
