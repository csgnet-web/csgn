# CSGN — The Plan

> **The single source of truth.** One document: what CSGN is, what's built, how the
> token works, and — most importantly — **what the founder actually does every
> day.** Technical build docs (`obs-setup.md`, `broadcast-graphics.md`,
> `agent-packets.md`, `env-setup.md`, `ops-cost-security-runbook.md`,
> `v1-launch-checklist.md`) stay as operational references. If anything anywhere
> disagrees with this file, this file wins.

---

## 1. What CSGN is

**A 24/7 crypto-native TV network for young men who trade, watch sports, and game.**

It looks like ESPN, runs like public-access cable, and is coin-operated like a
jukebox. Three parts:

1. **The 24/7 stream** — always-on linear TV with a broadcast-grade ticker.
2. **The shows** — CSGN Originals, hosted by the founder. This is the growth engine.
3. **The token** — $CSGN, which decides what gets *promoted*, never who gets *in*.

**One line:** *The only network where crypto, sports, and gaming are the same show.*

---

## 2. The wedge — why the intersection wins

This is the most important page in the document.

### 2.1 The competitive read
Ansem, ThreadGuy, and Rasmr already own "crypto talk." They're good at it, they
were early, and their audiences are crypto-native. **Trying to be a better crypto
streamer than them is a losing fight** — same content, same audience, later start,
smaller following.

But look at what they *don't* do: **none of them have sports takes.** Sports
Twitter doesn't speak crypto. Gaming creators don't do markets. And yet:

> **The 22-year-old up at 2 AM trading a memecoin is the same person who has a CFB
> playoff opinion and 900 hours in CS. That's one person — and nobody is
> programming for all three at once.**

That intersection — **gaming × sports × crypto × trading, for young men** — is the
hyperniche. It isn't a smaller slice of crypto Twitter; it's a *different, wider*
audience nobody currently serves as a single show.

### 2.2 Why it's defensible
- **Crypto influencers can't fake it.** Sports credibility takes years of actually
  caring. They won't pivot into it.
- **Sports media can't speak crypto.** Structurally late and compliance-bound.
- **The blend is genuinely more fun.** Pure crypto content is either euphoric or
  grim, and it dies when the market is flat. Sports supplies **daily narrative fuel
  and low-stakes conflict** — there's always a game, always a bad take to fight
  about. That's what makes the show entertaining on a red day.
- **Sports takes travel further than crypto takes.** They're argumentative and
  evergreen; crypto takes are in-group and expire in a week. The sports half is the
  *distribution* half.

### 2.3 What this means practically
Lead with personality and takes, not product. The jukebox, meme-100, and VOD
platform are the **moat later**; the founder on camera is the **growth now**.

> **For the next 90 days: the founder is the product. The network is the stage.**

---

## 3. Is the app actually ready for real users?

Short answer: **yes for the first few hundred, with two caveats.** The honest audit:

### 3.1 What's built and solid
| Piece | State |
|---|---|
| 24/7 stream + master control (`/player`) | Live — LIVE/BRB/intermission, ad-masking, auto-recovery |
| Broadcast ticker | Live — 20+ leagues, crypto dock, meme-100, spotlight, breaking |
| Over-live notices (lower-thirds) | Live |
| Admin console | Live — modular Broadcast Control |
| Schedule + one-tap claiming | Live |
| Meme-100 token voting | Live |
| Creator fee tracking | Live |
| Coin Jukebox (SOL → treasury) | Built — **needs a tiny mainnet dry-run** |
| VOD network autopilot | Next build |

**Sign-up path is genuinely production-grade.** Uniqueness is enforced on four
axes (email, username, wallet, Twitch) in a single atomic commit; wallet and
Twitch ownership are signature/OAuth-proven server-side; every endpoint is
per-IP rate-limited; slot claiming is transactional so two people can't take the
same hour. The 2-slot limit is a per-user field, so raising it for a good creator
is a one-field edit.

**Inventory is self-maintaining.** The fee poller keeps a rolling 7-day horizon of
slots seeded automatically — nobody has to remember to create the schedule.

### 3.2 The two things that were actually broken (both now fixed)
Worth naming, because they're exactly what "does it work when someone signs up"
means in practice:

1. **Auth Events was hiding failed sign-ups.** Events fired *before* a session
   exists (`signin-start`, `signup-email-start`, and any failure) were rejected by
   the Firestore rule and the error was swallowed. The admin log recorded wins and
   hid every loss — so "nobody has signed up" and "everybody bounced off a broken
   form" looked identical. Now logged server-side.
2. **Every auto-seeded slot was landing in the reserved block.** The seeder
   hardcoded the old `'ceo'` type, which maps to the network block — so a new user
   would have opened `/schedule` and found **zero Claim buttons**. Fixed, plus the
   sweep now self-heals legacy slots, and 8 tests pin the shape.

### 3.3 Where it breaks at scale (and when to care)
- **Firestore reads are the cost ceiling.** Each browser session opens 3 listeners,
  one covering ~110 slot docs. That's ~110 reads per visitor on connect. Fine at
  hundreds of concurrent users; at ~10k concurrent it's real money. **Fix when it
  matters:** collapse the schedule into a single pre-computed `public/schedule`
  doc the client reads instead of the collection. Don't do it yet.
- **Netlify function concurrency** is fine — claims are rare, single-digit
  writes.
- **Single RPC endpoint** (public Solana) for balance checks. Move to a paid RPC
  before any promotion that could spike wallet verification.
- **Twitch Helix polling** is one call/minute — nowhere near limits.

### 3.4 Do these before/around launch
1. **Dry-run the Coin Jukebox with a tiny mainnet payment** (the one untested
   on-chain path).
2. **Run one real sign-up yourself, end to end,** on a fresh email + wallet. Then
   check Auth Events — it will now show the whole funnel.
3. **Paid RPC key** in env.
4. **Seed the network block with real show names** so `/schedule` reads as a
   programmed lineup, not a generic block.

**Verdict: the infrastructure is not the bottleneck and won't be for a long time.
Go make content.**

## 4. The schedule (simple version)

| Block | Hours (ET) | Who programs it |
|---|---|---|
| **Open** | 3 AM – 7 PM (8 slots) | Anyone with a verified account — one tap on `/schedule`, free, 2 slots max |
| **Network** | 7 PM – 3 AM (4 slots) | CSGN Originals |

- **No auctions.** Slots are claimed, never bid on.
- **One admin toggle** returns the network block to open claiming.
- **Open claiming is free growth** — every creator who claims brings their own
  small audience at zero cost. Never gate it.
- **Editorial control is the shape of the schedule**, not restrictions on people:
  prime time is ours, the rest is theirs. Owned-and-operated plus affiliates.

---

## 5. The token — deliberately narrow

**$CSGN determines exactly six things:**
promotion · whip-around mentions · the jukebox · sponsorships · meme-100 voting ·
**access to the gated information pipeline** (§9).

**It never gates** claiming a slot, making an account, or going live.

**We never burn it.** Every $CSGN or SOL the network receives goes to a
**productive treasury** that funds distribution, creator payouts, and liquidity. A
burn destroys capital; a treasury deploys it. Value accrues three ways:

1. **Governance demand** — holding = steering what airs (balance-weighted and
   non-custodial; you keep your tokens).
2. **Treasury growth** — attention revenue accumulates and is recycled, including
   open-market $CSGN buys to pay creators.
3. **Creator alignment** — the people producing the value hold the token.

**The buy reason, in one line:** *"It's the remote control for crypto TV, and a
claim on a treasury that grows every time the network sells attention."*

*(Target allocation — community 55–65% · treasury 15–20% · creator rewards 8–12% ·
team 8–12% (2–3y vest) · liquidity 3–5%. Set for real with counsel.)*

---

## 6. The founder's playbook

### 6.1 Camera vs. the Stickman V-Tuber — **use the Stickman**

Recommendation: **Stickman is the default; the face comes out for tentpoles.**

The reasoning is operational, not aesthetic:

- **The #1 risk to this whole plan is not streaming.** Every day you're tired,
  unshaven, in a bad room, or not feeling it is a day the streak breaks. A mascot
  removes every one of those excuses. **Consistency beats polish, and it isn't close.**
- **A mascot is an ownable asset a face can never be.** Stickman can live in the
  ticker, sit in the corner of every clip, appear on a lower-third, become an
  emote, react to a bad beat, go on merch. That's a network identity. A webcam is
  just a webcam.
- **It's distinctive in both directions.** Crypto is faceless PFPs; sports media is
  talking heads. An animated character with real sports takes is memorable in a way
  neither side has.
- **Clips get a recurring character.** Characters compound across clips; a face in
  a webcam box doesn't.

The honest tradeoff: **you lose some parasocial trust.** People bond with faces.
Mitigate by (a) letting the voice carry all the personality — the mascot should be
expressive, not a static PNG — and (b) going face-on for milestones, big
announcements, and any moment where sincerity matters.

Build it **cheap to run**: a handful of mic-driven expressions and poses, not a
rigged 3D model that becomes its own production burden.

### 6.2 The shows

**A. The Whiparound — daily, 30 minutes.** The wedge made literal: crypto news +
sports + whatever's funny, in one rundown. This is the habit-former. Fixed hour,
fixed length, every day. Its whole advantage over Ansem/ThreadGuy is that it's *not
just crypto* — the sports segment is the differentiator, not a side dish. Lead with
it some days.

**B. Two dynasties — they do different jobs. Run both.**

| | **Offline Dynasty** (yours, modded) | **Online Dynasty** (12 teams, weekly) |
|---|---|---|
| **Job** | Daily/most-days content engine | Weekly appointment + community |
| **Cadence** | 3–4×/week, whenever you want | One fixed night, weekly |
| **Depends on** | Nobody | 11 other humans showing up |
| **Content type** | Your narrative, your rules, mod chaos | Rivalries, drama, other people's teams |
| **Risk** | None | No-shows, scheduling, dead weeks |

The offline dynasty is the **reliable** one — no coordination, full mod control,
and you can stream it any night the schedule needs filling. The online 12-team
league is the **social** one: it manufactures rivalries and gives 11 other people
a reason to post about CSGN every week. **The MFL model (@thereal.mfl) is exactly
right** — the value isn't the games, it's the *coverage*: standings graphics,
power rankings, weekly recaps, trash talk, storylines. That coverage is what's
clippable and what makes participants feel televised.

**Run the online league like a broadcast, not a game night:**
- **One fixed night, always.** Advance the week on schedule whether or not
  everyone played — a league that waits for stragglers dies.
- **Coverage is the product.** Weekly power rankings post, a standings graphic on
  the ticker, one recap clip per week. This is what MFL actually sells.
- **12 teams, but recruit 16 interested people.** Attrition is guaranteed; a
  waitlist means a no-show is replaced, not a hole.
- **Deadline, not a schedule.** "Games due by Sunday 8 PM ET" beats trying to
  coordinate 12 calendars. You broadcast the recap; they play on their own time.
- **Sim the missing.** Publicly, no drama. Nobody holds up the league.

**C. Casual FPS / Rocket League — rotating.** Fills hours, keeps the channel warm,
low prep, high clip yield.

### 6.3 The leagues — the rule that keeps them easy

Leagues are content engines *and* recruiting engines: every participant is a
distribution node who brings friends and posts about it. But they have one failure
mode — **they become an admin job that eats the hours you should be streaming.**

> **The rule: no league that costs more than ~30 minutes of admin per week outside
> the stream itself. If it needs more, it isn't a league, it's a second job.**

Start in this order, by effort-to-content ratio:

| League | Coordination cost | Content yield | Verdict |
|---|---|---|---|
| **CFB 27 Dynasty** | None — you play solo | Very high (serialized) | **Start here** |
| **Rocket League** | Low — 2–3 per team, 5-min games | High (fast, clippable) | **Second** |
| **CS:GO** | High — 10 players, long matches, no-shows | Medium | **Last / occasional event** |

Practical design:
- **Run Rocket League and CS:GO as one-night events, not seasons.** A tournament
  has no ongoing management. Seasons only once people reliably show up. (The CFB
  online league is the exception — it's a season by nature, which is why it needs
  the deadline discipline above.)
- **The broadcast is the league's record.** The ticker already renders sports
  scoreboards and standings — put league results on it. Zero extra tooling, and it
  makes participants feel *televised*, which is the actual product.
- **Let participants self-organize.** Sign-ups in Discord, brackets posted, you
  host. Don't become the scheduler.
- **League nights ride existing hours.** Leagues shouldn't add streaming hours;
  they should *upgrade* hours you were already streaming.

**Rewarding participation (without inventing a new economy).** Use what's already
built — the point is recognition and access, not payouts:
1. **Airtime.** Winners get named on the ticker and in the recap clip. Being on TV
   is the prize; it costs nothing and is the thing people screenshot.
2. **A slot.** Winners get a claimable slot promoted on the schedule — the merit
   ladder (`maxConcurrentClaims`) raised for people who show up and perform.
3. **Roles + access.** A `@champion` Discord role and access to the gated
   information pipeline (§9). Status is the reward.
4. **$CSGN from the treasury**, modestly, once the treasury is real. Keep it a
   *bonus on top of status*, never the reason people show up — a league that pays
   attracts people farming it, and they leave the moment it stops.

---

## 7. Growth: 300 followers → owning the hyperniche

Be honest about the starting point: **at ~300 followers, distribution is
effectively zero.** Nothing compounds yet. So the strategy is entirely about
*borrowing* reach until the base is big enough to compound on its own.

### 7.1 The five things that actually move it

**1. Post takes, not updates.** "CSGN is live" reaches nobody. "Ohio State is a
fraud and so is your bag" gets argued with — and arguments are distribution. Your
sports opinions are the most shareable asset you have, and they cost nothing.

**2. Work both timelines.** The structural advantage of the wedge: you can reply
into **crypto CT and sports Twitter**. That's double the surface area of any
pure-crypto streamer — and in sports you aren't competing with Ansem at all.

**3. Run the collision format.** Sports framing on crypto topics is inherently novel
and screenshot-able:
- *"Power rankings: L1s as CFB programs"*
- *"Trade deadline — which bags are you selling?"*
- *"Draft grades for this week's launches"*
- *"Coach on the hot seat: which founder gets fired first?"*

Nobody else can make these — they'd need both halves. **This is the content moat.**
Make one every week.

**4. Clip discipline: 1–3/day, every day.** Mark timestamps while streaming;
harvesting later is what kills the habit. Every clip names a coin, a team, or a
person — people share what makes *their* thing look important, never yours.

**5. Borrow audiences on purpose.** At 300 followers, one guest spot beats a month
of solo posting. Go on other people's streams and spaces. Invite mid-tier creators
onto yours. Recruit coin communities with "your coin gets airtime." Every league
participant is a node. **Grade every move by: whose followers does this reach?**

### 7.2 What not to do
Paid engagement pods · generic crypto-influencer promos · airdrop farming · price
posting · buying followers · the same "we're live" tweet every day. All of it buys
numbers that don't compound.

### 7.3 The numbers to manage
**Not market cap.** Weekly:
1. Followers (the base)
2. Clips shipped (the input you control)
3. Streams hit vs. planned (the discipline)
4. Holders-who-acted (the built counter — the real signal)

If followers and holders-who-acted rise while the cap stays flat, it's working. The
cap follows.

---

## 8. The next 30 days

**Committed slate:** daily 30-min Whiparound + 4–5 CFB/league streams a week
(1–4 hrs). ~15 hrs/week live before clipping — a real load solo, so the plan
protects it.

| | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| **Whiparound** (30 min) | Y | Y | Y | Y | Y | Y | Y |
| **CFB / league night** | Y | — | Y | Y | — | Y | Y |
| **Clips due** | 2 | 1 | 2 | 2 | 1 | 2 | 2 |

**Rules that make it survivable:**
- **Whiparound is fixed-time, fixed-length.** Never let 30 min sprawl to 60. The
  streak matters more than any single episode.
- **Length is the shock absorber.** A 1-hour Dynasty night still counts; skipping
  doesn't.
- **Batch prep once a day** — 20 minutes collecting stories. The show is delivery,
  not research.
- **Bank two evergreen segments in week 1** so a sick day never breaks the streak.
- **One rest valve:** drop a league night before ever dropping the Whiparound.

**Week by week:**
- **Week 1** — Stickman rig running; Whiparound daily from day 1; Dynasty ep. 1–2;
  Discord live-ping shipped; two emergency segments banked.
- **Week 2** — daily clips to X; first collision-format post; Dynasty 3–4; first 10
  creators hand-recruited; open-slot alerts live.
- **Week 3** — first Rocket League one-night tournament; first coin-community
  spotlight; VOD autopilot filling the network block.
- **Week 4** — first guest appearance (theirs or yours); publish month-1 numbers;
  first Live Coin Battle inside a league night.

---

## 9. Discord — the notification spine

Small and purpose-built. Seven channels, not twenty.

| Channel | Purpose | Posts |
|---|---|---|
| `#announcements` | Slate changes, news | Founder |
| `#live-now` | **Auto** "we're live" + link | Bot |
| `#clips` | **Auto** clip drops | Bot |
| `#on-air-actions` | **Auto** spotlight / vote / meme-100 | Bot |
| `#schedule` | **Auto** open slots + tonight's lineup | Bot |
| `#leagues` | Sign-ups, brackets, results | Everyone |
| `#general` | The third place | Everyone |

**Roles:** `@live-ping` (opt-in), `@creator`, `@holder`, `@og`, `@champion`.

### The gated information pipeline — a real sixth use for $CSGN
This is the best token utility available that doesn't touch access to the product:
**hold $CSGN → get the information edge.** It's cheap to run, genuinely valuable,
and it's the one thing a trading-adjacent audience will actually pay attention for.

| Tier | Channel | What's in it |
|---|---|---|
| Public | `#general`, `#clips` | Everything after it airs |
| **Holder** (`@holder`) | `#the-wire` | The raw feed *before* it's on air: what's about to be spotlighted, the news the Whiparound is about to cover, on-chain alerts from our own poller, early league lines |
| **Creator** (`@creator`) | `#creators` | Slot/booking coordination, fee questions |

Why this works: **the network already generates the feed** — the fee poller watches
Helix and DexScreener, the ticker ingests news, you're prepping a rundown daily
anyway. Piping that into a holder channel a few minutes early costs nothing and is
the exact thing this audience values. It also keeps you on top of everything,
because the pipeline you build for them *is* your own dashboard.

**Verification:** wallet-connect grants `@holder` — the balance check
(`getCsgnBalance`) and the signature-proof flow already exist; a small bot ties the
proven wallet to a Discord ID and syncs the role. Re-check periodically so the role
reflects current holdings.

**Keep it honest:** it's an *information* edge, not financial advice or a signal
group. Frame it as "the newsroom feed," and never let it become a call channel —
that's a different, worse business with real liability.

**Automations, in priority order:**
1. **"We're live" ping** — the single highest-value automation available. Fires off
   the live detection the server already does; a channel without it loses most of
   its returning audience.
2. **Open-slot alerts** — turns idle inventory into supply.
3. **Clip drops** — gives members something to share.
4. **On-air action alerts** — makes the token's powers visible to non-holders.

**Never:** @everyone, bot spam in `#general`, or letting Discord become the
destination. *Discord notifies, X acquires, the channel retains.*

---

## 10. Business model

**Revenue** (all → treasury):
1. Coin Jukebox spotlights (SOL per play)
2. Sponsorships — coin communities sponsoring shows, segments, league teams
3. Creator-channel take-rate (once the VOD platform opens)
4. Ad/placement inventory — lower-thirds, ticker slots
5. Creator-fee flywheel — trading volume the content drives

**Costs** are low — infra, RPC, a data feed, hosting: hundreds a month, not
thousands. **This is a distribution problem, not a burn-rate problem.**

**Ramp** is community-count-driven: ~10 sponsoring communities covers ops; 100+
makes the treasury self-funding.

**Risks:**
- **Irrelevance** (the real one) → the daily streak, clips, borrowed reach.
- **Solo burnout** → the shock-absorber rules above; a co-host when affordable.
- **Platform dependency** (Twitch/X/ESPN/RPC) → own-ingest path, caches, paid RPC.
- **Token distrust** → no burn gimmicks, transparent treasury reports,
  non-custodial governance.

**Build order once the slate is running:** VOD network autopilot (fills 7 PM–3 AM;
live from the same PC always pre-empts and auto-returns — `/player` already does
this) → reels + per-view attention accounting → open the creator platform.

---

## 11. Partner tokens — how to integrate $ANSEM without losing autonomy

Ansem wants his token in novel apps. There's a version of this that's great for
CSGN and a version that quietly makes you a subsidiary. The difference is framing.

### 11.1 The move: don't build an "Ansem integration" — build a **partner-token surface**
Make it a *product* that any partner token can plug into, and make $ANSEM the
first and flagship one.

This is strictly better on every axis:
- **Same effort** — the work is identical.
- **Autonomy preserved** — you're not married to one token; you've built a slot any
  partner can fill. If the relationship cools, the surface stays and someone else
  fills it.
- **It's repeatable revenue** — the partner surface becomes a sponsorship tier you
  can sell again and again, instead of a one-off favor.
- **It's a better pitch to Ansem, not worse.** "You're the flagship partner on a
  surface built for partners" is a stronger, more legitimate offer than "we bolted
  your token onto our app."

### 11.2 What to actually integrate (ranked by effort-to-value)

**1. $ANSEM governance surface — do this first.** His holders get a
balance-weighted vote over one specific, bounded thing: a weekly segment, a
meme-100 wildcard entry, or which coin gets a spotlight on his night.

*Why it's the right first move:* **the voting primitive already exists and is
mint-agnostic in everything but one constant.** `getCsgnBalance(wallet)` is used in
exactly three places and reads a single hardcoded mint. Generalizing to
`getTokenBalance(wallet, mint)` plus a `config/partnerToken` doc is a genuinely
small change — an afternoon, not a project. Everything downstream (signature proof,
one-ballot-per-wallet, atomic tallies, the on-air result) is already built and
tested.

**2. Co-branded ticker + spotlight presence.** $ANSEM gets a permanent price cell
in the crypto dock and a recurring spotlight. **Zero architecture** — it's config.
Visible, immediate, and demoable on a call.

**3. $ANSEM as an alternate jukebox currency.** Pay in $ANSEM instead of SOL to
play a coin. Treasury holds it. Small change to the payment verifier (same
re-read-the-confirmed-tx pattern), and it creates real $ANSEM sink demand — which
is the thing he actually wants.

**4. A recurring show/segment.** The distribution win. Costs no code.

### 11.3 What to refuse
- **No token merge, no swap, no shared treasury.** Instant loss of autonomy.
- **No equity or governance over CSGN itself.** Partner tokens govern *partner
  surfaces*, never the network.
- **No exclusivity.** The surface must stay open to other partners — that clause is
  what keeps this a product instead of a dependency.
- **No gating core access** behind $ANSEM. The token scope rule (§5) applies to
  partners too: promotion, never admission.

### 11.4 The pitch, in one paragraph
*"We built a partner-token surface into a live 24/7 broadcast: your holders get a
real on-air vote, your token gets permanent ticker presence and a spotlight lane,
and holders can spend it to put coins on TV. It's live inventory on a real network,
it's demoable today, and you're the flagship partner. No merge, no swap — your
token, our stage."*

Ship #1 and #2 for a call, keep #3 as the follow-up. Total build: days, not weeks.

---

## 12. Honest odds — can this be crypto's entertainment flagship?

You asked directly, so here's a direct answer rather than a pep talk.

### 12.1 The assessment
**Base rate for "small crypto media project becomes the category flagship" is
low — low single-digit percent.** Most die of obscurity, not of bad product.
Against that base rate, CSGN has three genuinely unusual advantages and two
genuinely hard problems.

**What's unusually strong (rare, hard to copy):**
1. **The product is years ahead of the audience.** Broadcast-grade infrastructure
   at a $4k cap is not normal. Most competitors will never build this.
2. **The wedge is real and unoccupied.** Gaming × sports × crypto for young men
   isn't a crowded lane — it's an *empty* one, and the founder credibly occupies it.
   This is the single best thing about the project.
3. **Cost base is near zero.** You can't be forced to quit by a burn rate. Time is
   the only currency, which means the runway is "as long as you keep going."

**What's genuinely hard:**
1. **Distribution from ~300 followers is brutal**, and it's the only thing that
   matters. There is no clever substitute for months of showing up.
2. **Solo operator.** Every projection assumes one person sustains ~15 hrs/week of
   live production plus clipping plus community plus dev. Burnout is the most
   likely cause of death, not competition.

### 12.2 Realistic outcome bands (12 months, if the slate is actually run)
| Outcome | Odds | What it looks like |
|---|---|---|
| **Quit / fade** | ~45% | The streak breaks in month 2–3, the channel goes quiet |
| **Real niche channel** | ~35% | 5–20k followers, a real community, modest token, sustainable side income |
| **Category-relevant** | ~15% | 50k+, known in CT and gaming, real sponsors, token with an actual market |
| **The flagship** | ~5% | The default answer to "where do I watch crypto" |

**The 5% is not the plan — the 35–50% is.** And notice: the difference between
"fade" and "niche channel" is almost entirely *consistency*, not strategy. The
difference between "niche" and "flagship" is one breakout moment plus being
positioned to catch it — which is exactly what the infrastructure buys you.

### 12.3 What most changes the odds
1. **Hitting the daily streak for 90 days.** Nothing else comes close. This single
   variable moves you between bands.
2. **The 12-team online league actually running weekly.** It's 11 other people with
   a reason to post — the highest-leverage distribution asset in the plan.
3. **One partner/KOL relationship landing** (§11) — borrowed reach compresses
   months into weeks.
4. **Being live and good when the crypto-streaming meta returns.** You can't time
   it; you can only already be there. That's the whole bet, and it's a sound one.

### 12.4 The honest risk to name out loud
**The most likely failure is not competition — it's the founder quietly stopping
in week 6.** Every rule in §8 (fixed length, length as shock absorber, banked
segments, drop the league before the Whiparound) exists for that reason. Build for
the version of you who doesn't feel like streaming, because that's the one who
decides this.

---

## 13. The whole thing on one page

1. **The wedge is the intersection.** Gaming × sports × crypto × trading for young
   men. Not "better crypto content" — *the only show that's all four.*
2. **Sports is the differentiator and the distribution.** It's what Ansem/ThreadGuy/
   Rasmr can't do, it keeps the show fun on red days, and sports takes travel.
3. **The founder is the product for 90 days.** The platform is the moat later.
4. **Stream as the Stickman.** It removes every excuse not to go live and is an
   ownable network asset a face can't be. Face for tentpoles.
5. **Leagues are content engines with a hard rule:** 30 min/week of admin max, or
   it's a second job. Dynasty → Rocket League → CS:GO.
6. **The daily Whiparound is non-negotiable.** Length is the shock absorber; the
   streak is the asset.
7. **1–3 clips a day, every day**, each naming a coin, team, or person.
8. **Work both timelines and borrow audiences** — at 300 followers, one guest spot
   beats a month of posting.
9. **Access stays open and free; the token only governs promotion** — plus the
   gated info pipeline. No auctions, no gates on getting on air, no burning.
10. **Run both dynasties.** Offline/modded is the reliable engine; the 12-team
    online league is the social one — and *coverage* (rankings, recaps, standings
    on the ticker) is its actual product, MFL-style.
11. **Partner tokens are a surface, not a favor.** Build it once so $ANSEM is the
    flagship tenant, not the landlord — same effort, keeps autonomy, resells.
12. **The infrastructure is not the bottleneck** and won't be for a long time.
    Two real blockers were found and fixed; go make content.
13. **Manage to followers, clips shipped, streams hit, and holders-who-acted** —
    not market cap. And know the real risk is stopping in week 6.
