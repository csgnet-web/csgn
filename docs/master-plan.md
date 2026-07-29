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

## 3. What's already built (stop rebuilding it)

| Piece | State |
|---|---|
| 24/7 stream + master control (`/player`) | Live — LIVE/BRB/intermission, ad-masking, auto-recovery |
| Broadcast ticker | Live — 20+ leagues, crypto dock, meme-100, spotlight, breaking |
| Over-live notices (lower-thirds) | Live |
| Admin console | Live — modular Broadcast Control |
| Schedule + one-tap claiming | Live |
| Coin Jukebox (SOL → treasury) | Built — needs a tiny mainnet dry-run |
| Meme-100 token voting | Live |
| Creator fee tracking | Live |
| VOD network autopilot | Next build |

**The product is roughly a year ahead of the audience. Nothing on this list is the
bottleneck.** The bottleneck is that ~300 people know CSGN exists.

---

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

**$CSGN determines exactly five things:**
promotion · whip-around mentions · the jukebox · sponsorships · meme-100 voting.

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

**B. CFB 27 Dynasty — 4–5×/week, 1–4 hours.** Serialized narrative. People come
back for a *story*, and a dynasty is the cheapest story engine in existence: stakes,
recurring characters, and cliffhangers with no writing required. This is retention.

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
- **Run leagues as events, not seasons, at first.** A one-night tournament has no
  ongoing management. Seasons only once people reliably show up.
- **The broadcast is the league's record.** The ticker already renders sports
  scoreboards and standings — put league results on it. Zero extra tooling, and it
  makes participants feel *televised*, which is the actual product.
- **Let participants self-organize.** Sign-ups in Discord, brackets posted, you
  host. Don't become the scheduler.
- **League nights ride existing hours.** Leagues shouldn't add streaming hours;
  they should *upgrade* hours you were already streaming.

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

**Roles:** `@live-ping` (opt-in), `@creator`, `@holder`, `@og`.

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

## 11. The whole thing on one page

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
9. **Access stays open and free; the token only governs promotion.** No auctions,
   no gates, no burning.
10. **Manage to followers, clips shipped, streams hit, and holders-who-acted** —
    not market cap.
