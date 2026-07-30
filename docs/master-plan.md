# CSGN — The Plan

> **The single source of truth.** One document: what CSGN is, what's built, how the
> token works, and — most importantly — **what the founder actually does every
> day.** Technical build docs (`obs-setup.md`, `broadcast-graphics.md`,
> `agent-packets.md`, `env-setup.md`, `ops-cost-security-runbook.md`,
> `v1-launch-checklist.md`) stay as operational references, and
> [`ecosystem-strategy.md`](ecosystem-strategy.md) is the money-and-relationships
> companion (Ansem/Bullpen tandem, revenue-ASAP, the venue play). If anything
> anywhere disagrees with this file, this file wins.

---

## 1. Who we are — and how to say it

**A 24/7 crypto-native TV network for young men who trade, watch sports, and game.**

It looks like ESPN, runs like public-access cable, and is coin-operated like a
jukebox. Three parts:

1. **The 24/7 stream** — always-on linear TV with a broadcast-grade ticker.
2. **The shows** — CSGN Originals, hosted by the founder. This is the growth engine.
3. **The token** — $CSGN, which decides what gets *promoted*, never who gets *in*.

**One line:** *The only network where crypto, sports, and gaming are the same show.*

### 1.1 What's actually unique — lead with this

Every other crypto social product sells a **feed or a feature**. CSGN sells
**scheduled time on a channel.** That single difference cascades into everything:

| | A crypto social app | CSGN |
|---|---|---|
| What's for sale | usage | **inventory — twelve 2-hour slots a day** |
| Scarcity | none; posts are infinite | **real; a day has 24 hours** |
| Revenue on day one | usually none but the token | slot fees, ticker cells, paid spotlights, sponsorships |
| With zero users online | an empty room | **still broadcasting** |
| What compounds | followers | **a library — every show leaves a VOD and clips** |

**The fourth row is the whole thesis.** A feed with nobody in it is dead. A channel
with nobody in it is still a channel. That is why a network can be built by one
person starting from 300 followers, and a social app cannot.

The entertainment version of the same gap is just as clean: public-access cable had
open time and no audience. Twitch has audience and no schedule. ESPN has schedule
and audience but no way in. **CSGN is the first thing with a schedule, an open
door, and an ownership layer at the same time.**

And the business version: this cycle's scarce asset is attention, and everyone else
is selling *engagement*. We sell **airtime** — finite, priced, schedulable. We
already run the inventory (a real schedule), the billing (creator-fee splits, paid
spotlights), and the distribution (a broadcast ticker other streams can embed).
**A network with a token, not a token looking for a product.**

### 1.2 How to explain it — four scripts, by audience

**Lead with one comparison. The five-way analogy is a closer, not an opener** —
five comparisons at a cold listener is noise; one comparison plus one concrete
detail is a hook.

- **5 seconds · anyone:** *"It's ESPN for crypto — and anyone can get on it."*
- **15 seconds · a crypto native:** *"24/7 crypto TV. Twelve two-hour slots a day.
  Claim one, go live, and you earn 30% of the token's trading fees the whole time
  you're on air. The token gates nothing — it decides what gets promoted."*
- **30 seconds · a normie or a business person:** *"Public-access cable rebuilt for
  the internet. A channel that never stops, a schedule anyone can claim a slot on,
  a real broadcast ticker so it looks like television, and a token that works like
  a remote control for the audience — they vote on what airs and pay to put coins
  on screen."*
- **60 seconds · a partner or an investor:** the airtime-vs-engagement argument
  above, then the proof: the schedule, the fee split, the ticker, and the fact that
  the thing is already on the air.

**Then land the stack:** *"Public access cable meets TouchTunes meets Twitch meets
Pump.fun meets ESPN."* It's a great line — **once they already want to understand
it.** Used as an opener it makes a simple idea sound complicated.

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

### 3.5 Making it simple enough for a stranger

The app works. The question this section answers is whether a stranger who lands on
it can tell what to do — a different and harder bar.

**What was actually confusing, and is now fixed:**
- **The dashboard advertised mechanics that don't exist.** A signed-in user saw "My
  Bids (CSGN)", "CEO Schedule Slots", and two buttons pointing at a route that
  redirects elsewhere — all leftovers from the auction era. Replaced with one card
  showing your real upcoming slots and a claim CTA. Dead auction code deleted.
- **The hour on the air couldn't be claimed.** The most valuable slot on the
  schedule — the one where you can go live *this second* — was the one being
  refused. Fixed; it now reads "On air. Take it now."
- **Three different surfaces disagreed about what was claimable.** `/watch`,
  `/schedule` and the server each had their own rule. One rule now, shared.

**What to fix next, in order:**

**1. The funnel has three cliffs before the first action.** To claim a slot you need
a verified email, a signature-proven Phantom wallet, and a linked Twitch account.
Each is defensible on its own — email stops abuse, the wallet is how you get paid,
Twitch is where the stream points — but three verifications before *any* payoff is
where most people quit. **Don't remove them; show them.** A three-step progress
strip with the claim waiting visibly at the end converts far better than three
unexplained walls, because the reward stays in view the whole way.

**2. The Holder Zone does four things on one page.** Governance vote, Right Now rail,
Coin Jukebox, Meme-100 vote. Order it by *what you can do with what you hold right
now* — the thing your balance already unlocks goes first, and anything above your
balance shows the number you'd need. A page that leads with what you can't do reads
as a paywall.

**3. Say the payoff before the ask, everywhere.** "Claim a slot" is a task. "Go live
and earn 30% of $CSGN's trading fees while you're on air" is a reason. The second
one belongs on every claim surface, not just the schedule header.

**4. One-line rule for anything new:** if a stranger can't tell what a screen is for
in five seconds, the screen is wrong — not the stranger.

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

**$CSGN determines exactly six things:**
promotion · whip-around mentions · the jukebox · sponsorships · meme-100 voting ·
**access to the gated information pipeline** (§9).

**It never gates** claiming a slot, making an account, or going live.

**We never burn it.** Everything the network receives goes to a productive
treasury under published rules — the full policy, including which treasury receives
what, is §11.1. Value accrues three ways:

1. **Governance demand** — holding = steering what airs (balance-weighted and
   non-custodial; you keep your tokens).
2. **Treasury growth** — attention revenue accumulates and is recycled, including
   open-market $CSGN buys to pay creators.
3. **Creator alignment** — the people producing the value hold the token.

**The buy reason, in one line:** *"It's the remote control for crypto TV, and a
claim on a treasury that grows every time the network sells attention."*

*(Target allocation — community 55–65% · treasury 15–20% · creator rewards 8–12% ·
team 8–12% (2–3y vest) · liquidity 3–5%. Set for real with counsel.)*

### 5.1 Every use of $CSGN today — audited

The token is only worth what it *does*, so here is the complete list of what it
actually does in the shipped product, and how sound each one is.

| # | Use | Where it lives | Gate | State |
|---|---|---|---|---|
| 1 | **Governance vote** — holders decide what airs | `castVote` → `votes/{id}` | any balance > 0; weight = balance | live, now settled against live balances |
| 2 | **Meme-100 vote** — holders back a coin in the power ranking | `voteMeme` → `public/memeVote` | any balance > 0; weight = balance | live, re-settled every 30 min |
| 3 | **Right Now rail** — put your own line on the broadcast ticker | `submitRightNow` | ≥ threshold in `config/tokenGates` | live, threshold now tunable |
| 4 | **Creator-fee share** — 30% of $CSGN's pump.fun creator fees to whoever is on air | fee poller → Creator Fees | none — claim a slot and stream | live |
| 5 | **Coin Jukebox** — pay to put a coin on screen | `jukeboxSpotlight` | SOL today | live in SOL; **$CSGN not accepted yet** |
| 6 | **Gated information pipeline** | Discord (§9) | holding tier | **not built** |

**Three things were wrong, and are fixed:**

**The tally could be inflated without limit.** A ballot stored the weight held at
cast time and the tally was incremented from it — so the weight never changed. Sell
after voting and it still counted. Worse: vote, send the bag to a fresh wallet, vote
again, and the same coins counted twice. Repeat for arbitrary inflation at the cost
of gas. Both the governance vote and the Meme-100 were exposed. Tallies are now
**settled against live on-chain balances** — tokens can only sit in one wallet at a
time, so the cycling attack collapses to a single count and a seller drops to zero.
Governance votes settle on close; the Meme-100 never closes, so it re-settles every
30 minutes. A wallet whose balance can't be read keeps its stored weight rather than
being zeroed, so an RPC hiccup can never silently delete someone's vote.

**The Right Now threshold was hardcoded in two places.** 5,000,000 $CSGN is a fixed
*token* count, which is a *moving dollar cost* — at 10× the price it's a wall nobody
climbs, at 1/10th it's free. It now lives in `config/tokenGates`, is enforced from
there, displayed from there, and tunable from Broadcast Control without a deploy.

**The published number and the enforced number could drift.** Same fix: one source.

**Two gaps remain, both worth closing:**

1. **$CSGN can't pay for a jukebox play.** SOL works; the token doesn't. This is the
   most natural sink the product has and it's the obvious next build — it needs SPL
   transfer verification, where today only SOL transfers are verified.
2. **No treasury surface anywhere in the product.** §11.1 says a public address with
   published rules is what replaces burning — but nothing in the app shows it. A
   `/treasury` readout (balance, inflows, the hold rules, the address) is the
   highest-trust, lowest-effort token feature available and it is currently missing.

**One thing to be honest about in public:** any wallet can vote with any balance, so
the *wallet count* on a vote is trivially inflatable even after settling. **Tokens
are the signal; wallets are decoration.** Lead with the token weight everywhere and
never quote a wallet count as if it were turnout.

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

### 7.1 The strategy in one move: be the scoreboard, not another voice

The next cycle's crypto social apps all compete on the same axis — more posting,
more tipping, more tokenized engagement. Every one of them is trying to be **a
louder voice.** Voices compete for attention and split it.

**Scoreboards get cited by everyone competing for it.**

If CSGN keeps the numbers the niche argues about, every argument routes through
CSGN's numbers. That is the only mechanism by which a 300-follower account gets
quoted by a 300,000-follower account without asking for a favor — you don't ask,
you publish the standings and they cite you because they need the number.

**The scoreboards to own:**

| Scoreboard | Status | Why it travels |
|---|---|---|
| **Meme-100** — top 100 memecoins by volume, market cap, social, and holder token-votes | built | every coin community has a reason to check it, screenshot it, and campaign in it |
| **Caller Standings** — public calls from big crypto accounts tracked like a stat line: entry, current, ROI, hit rate, W–L | **build next** | flattering at the top, brutal at the bottom, quotable by everyone in between |
| **League tables** — CFB 27 dynasty, Rocket League, CS:GO standings and power rankings | in flight | turns a game night into a recurring publication |
| **Weekly power rankings** — L1s, launchpads, whatever's hot, ranked like a CFB poll | free | the collision format (§7.2) in scoreboard form |

Each is a **recurring artifact other people share on your behalf.** That's the
difference between content (you push it) and a scoreboard (they pull it).

**Why CSGN specifically can do this:** it takes the sports instinct to think in
standings, and a broadcast ticker to render them like they're official. You have
both. A feed can't show a standings table that feels authoritative — a lower-third
can.

### 7.2 The five things that actually move it

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

### 7.3 What not to do
Paid engagement pods · generic crypto-influencer promos · airdrop farming · price
posting · buying followers · the same "we're live" tweet every day. All of it buys
numbers that don't compound.

### 7.4 The numbers to manage
**Not market cap.** Weekly:
1. Followers (the base)
2. Clips shipped (the input you control)
3. Streams hit vs. planned (the discipline)
4. Holders-who-acted (the built counter — the real signal)

If followers and holders-who-acted rise while the cap stays flat, it's working. The
cap follows.

---

### 7.5 Six cheap ways to boost reach, ranked by effort-to-value

Not strategy — the specific, small things that are worth doing this week.

**1. Put the ticker in every clip.** Free, already built, permanent. A clip with a
broadcast ticker in frame looks like television and carries CSGN branding whether or
not anyone says the name. Nothing else on this list costs zero and compounds forever.

**2. Give the ticker away as an OBS source.** A co-branded ticker any streamer can
drop into their own stream. It costs them nothing, makes their stream look like a
network, and puts CSGN permanently in front of an audience larger than ours. It is
**distribution disguised as a gift** — and the same asset works for the flagship
partner (§11.4) and for every mid-tier creator.

**3. Recruit slot claimants, not followers.** Every claimed slot is a creator
promoting CSGN to *their* audience, on our schedule, with our ticker on screen.
**Ten claimants beat a thousand followers.** The schedule is not inventory waiting to
be filled — it is the growth engine, and hand-recruiting the first fifty people onto
it is the highest-return time available.

**4. Post the scoreboard daily.** One recurring artifact out-performs fifty posts,
because people check back for it and quote it (§7.1). Start with the Meme-100 — it's
already built — then Caller Standings.

**5. Reply, don't broadcast.** At this follower count, a reply into a large thread
reaches more people than an original post to your own timeline. This is the single
biggest composition change available and it's free (§13.1).

**6. Make every clip name someone.** A coin, a team, a person. **People share what
makes their thing look important, never what makes yours look important.** A clip
about "CSGN's new feature" travels nowhere; a clip ranking someone's coin travels
through their whole community.

---

## 8. The next 180 days

Six months is long enough to build something real and short enough that the crypto
cycle still looks roughly like it does today. The shape of the plan follows one
belief: **the first 90 days are entirely about the streak and the scoreboard; the
second 90 are about turning attention into inventory that other people pay for.**

Read this with §13 (the content plan) — that section sets the daily floor, this one
sets what the months are for.

### Phase 1 · Days 1–30 — go live and never miss

**The only goal: the daily show exists and does not skip.** Nothing else in this
document matters if that fails.

**Committed slate:** daily 30-min Whiparound + 4–5 league streams a week (1–4 hrs).
~15 hrs/week live before clipping.

| | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| **Whiparound** (30 min) | Y | Y | Y | Y | Y | Y | Y |
| **CFB / league night** | Y | — | Y | Y | — | Y | Y |
| **Clips due** | 2 | 1 | 2 | 2 | 1 | 2 | 2 |

**Rules that make it survivable:**
- **Whiparound is fixed-time, fixed-length.** Never let 30 min sprawl to 60.
- **Length is the shock absorber.** A 1-hour Dynasty night still counts; skipping doesn't.
- **Batch prep once a day** — 20 minutes collecting stories. The show is delivery, not research.
- **Bank two evergreen segments in week 1** so a sick day never breaks the streak.
- **One rest valve:** drop a league night before ever dropping the Whiparound.

**Week by week:**
- **W1** — Stickman rig running; Whiparound daily from day 1; Dynasty ep. 1–2; two
  emergency segments banked; ticker in frame on every clip.
- **W2** — daily clips; first collision-format post; Dynasty 3–4; **Meme-100 posted
  daily from @CSGN** (the first scoreboard, §7.1); Discord live-ping shipped.
- **W3** — first Rocket League one-night tournament; first coin-community spotlight;
  jukebox mainnet dry-run with a tiny payment; VOD autopilot filling the night block.
- **W4** — first guest appearance; publish month-1 numbers publicly; first ten
  creators hand-recruited to claim slots.

**Exit test:** 30 consecutive Whiparounds, ~60 clips shipped, the Meme-100 posted
every day, and at least 3 slots claimed by someone who isn't you.

### Phase 2 · Days 31–90 — become the scoreboard

Volume alone doesn't compound. Recurring artifacts do. This phase builds the things
other people quote (§7.1).

- **Ship Caller Standings.** Public calls from big accounts tracked like a stat line
  — entry, current, ROI, hit rate, W–L — rendered on the ticker. This is the single
  highest-leverage build in the whole 180 days: it's the mindshare asset *and* the
  thing that makes a partner conversation easy.
- **Ship the `/treasury` page.** Address, balance, inflows, published hold rules
  (§11.1). This is what "we don't burn" means in practice, and right now it's a
  claim with nothing behind it.
- **Ship $CSGN as a jukebox currency.** The token's most natural sink, still missing.
- **Recruit slot claimants relentlessly.** Every claimed slot is a creator promoting
  CSGN to *their* audience. **Ten claimants is worth more than a thousand followers**
  — reframe the schedule as the growth engine, not as inventory to be filled.
- **League table for whichever league is running.** Standings on the ticker turn a
  game night into a publication.
- **First paid thing.** One coin community sponsors one segment. The number barely
  matters; proving the inventory sells is what matters.

**Exit test:** 90-day streak intact, Caller Standings live and cited by at least one
account bigger than yours, treasury page public, one paid sponsor, 10+ distinct
people have claimed a slot.

### Phase 3 · Days 91–135 — sell the inventory

The audience is now real enough that airtime has a price.

- **Partner-token surface live**, with the tenancy terms in §11.3–11.6 written down
  and repeatable. Approach the flagship tenant with **the ticker-as-a-gift and the
  Caller Standings** (§11.4), not with a request.
- **Sponsorship tiers published** — ticker cell, segment, league team, night. Real
  prices, publicly listed. Published prices make a network look like a network.
- **The VOD library becomes a product** — 30/60-min shows, consistently formatted
  (§13.4), filling the night block automatically.
- **Second league running** so there are two standings to publish.
- **Open the creator platform** to the first cohort beyond hand-recruits.

**Exit test:** one flagship tenant live, 3–5 paying sponsors, the night block filling
itself, and creator payouts going out on time every week.

### Phase 4 · Days 136–180 — make it not depend on you

The failure mode of a founder-led network is that it *stays* founder-led.

- **A second recurring host** — anyone whose slot is reliably good, promoted into a
  named show.
- **The gated information pipeline** (§9) — the sixth token use, and the one that
  makes holding worth something between votes.
- **Publish a real six-month report** — followers, clips, streams hit, holders who
  acted, treasury balance, sponsors, payouts. Being the network that publishes its
  own numbers is itself a positioning move nobody else in crypto makes.
- **Decide the next cycle's bet** from evidence rather than vibes: whichever of
  leagues / partner tenancy / creator platform actually produced, gets the next six
  months.

**Exit test:** the network airs a full week that the founder did not personally host,
and the numbers don't collapse.

### What would make me change this plan

- **A slot-claim flood.** If claiming takes off, stop everything and make the creator
  experience excellent — that's the network building itself.
- **A partner saying yes early.** Pull Phase 3 forward; distribution beats sequencing.
- **The streak breaking twice in a month.** Cut the slate, don't cut the streak.
- **The market going risk-off hard.** Lean *harder* into sports — it's the half that
  doesn't care what BTC did (§2.2), and it's why the wedge exists.

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

**Revenue** (all → treasury, per the rules in §11.1):
1. Coin Jukebox spotlights — flat price per play, any accepted currency (§11.2)
2. Sponsorships — coin communities sponsoring shows, segments, league teams
3. **Partner-token tenancy** — a flat fee per tenant surface (§11.3), the piece that
   makes the partner surface a product line instead of a one-off favor
4. Creator-channel take-rate (once the VOD platform opens)
5. Ad/placement inventory — lower-thirds, ticker slots
6. Creator-fee flywheel — trading volume the content drives

**Costs** are low — infra, RPC, a data feed, hosting: hundreds a month, not
thousands. **This is a distribution problem, not a burn-rate problem.**

**Ramp** is community-count-driven: ~10 sponsoring communities covers ops; 100+
makes the treasury self-funding.

**Risks:**
- **Irrelevance** (the real one) → the daily streak, clips, borrowed reach.
- **Solo burnout** → the shock-absorber rules above; a co-host when affordable.
- **Platform dependency** (Twitch/X/ESPN/RPC) → own-ingest path, caches, paid RPC.
- **Token distrust** → no burn gimmicks; a public treasury address with published
  hold and drip rules (§11.1), transparent reporting, non-custodial governance.

**Build order once the slate is running:** VOD network autopilot (fills 7 PM–3 AM;
live from the same PC always pre-empts and auto-returns — `/player` already does
this) → reels + per-view attention accounting → open the creator platform.

---

## 11. The partner-token surface — and what the jukebox actually is

Two things kept getting tangled together, and they need separating because one is a
**business model** and the other is a **product mechanic**:

- **The partner-token surface** — how another project's token rides on CSGN.
- **The Coin Jukebox** — how anyone pays to put a coin on screen.

They meet at exactly one place: **the treasury rule.** Start there, because it's
the part that was never actually written down.

### 11.0 What he actually asked for — read this before the rest of §11

He said it publicly, in his own words:

> *"need more devs experimenting onchain / need more novel mechanisms / need more
> creative speculation games / we have the infra & we have the mobile apps in place
> to onboard, need good coins & more fair launch startups / vibe shift 🔜"*

And in the exchange that followed — *"pessimism is not a very useful trait to have…
without the builders and speculators willing to try out new things all tech would
remain stagnant"* → *"new protocols will build on the concepts we learned from these
and realize the sustainable concepts"* → **"exactly."**

**This inverts the entire approach.** Everything below in §11 was written as *"how
do we integrate his token without losing autonomy"* — a favor request, however well
dressed. That is not what he's asking for. He is publicly stating unmet demand:
**novel onchain mechanisms, creative speculation games, and fair-launch startups
actually shipping things.**

So the pitch stops being *"will you let us use $ANSEM"* and becomes **"here is one
of the things you said the space needs, it's live, come look."** That is a
categorically stronger position: you are supplying his stated demand, not asking
for a favor. And the token integration becomes something he might want, rather than
something you're requesting.

**What CSGN already is, restated in his vocabulary:**

| He asked for | CSGN already is |
|---|---|
| a **fair launch startup** | launched on pump.fun, no VC, no presale, creator fees split with streamers |
| a **novel onchain mechanism** | **airtime as a priced onchain good** — twelve finite two-hour slots a day, claimable by anyone, paid for in SOL, verified on-chain before anything renders |
| a **creative speculation game** | the **Meme-100** — token-weighted voting that decides which coins get real broadcast airtime, settled against live balances |
| **devs experimenting onchain** | the Coin Jukebox: pay-per-play for a scarce *non-financial* good (television time), which is genuinely not a thing anyone else is doing |
| **good coins** | the network's whole job is surfacing them, on a scoreboard, on air |

**The one thing missing from that list is a real speculation game with stakes**, and
it's the obvious thing to build next — see §11.7.

**How to approach him, concretely:**

1. **Don't DM an ask.** He already replied to you in public and agreed with you.
   That's warm, and the worst thing to do with warm is convert it into a request.
2. **Ship, then show.** Build the mechanism, put it on air, post it. He told the
   whole timeline what he's looking for; the winning move is to be an example of it
   and let him find it.
3. **When you do talk, lead with the mechanism, not the token.** "We turned
   broadcast airtime into an onchain good and holders vote what airs" is
   interesting to him. "Can we add $ANSEM" is the fourth thing you mention, not the
   first.
4. **Bring the gift** — the co-branded ticker he can drop into his own stream
   (§11.4). It costs him nothing and it's the only part of this that's *for* him.
5. **Be a builder in public about the failures too.** He explicitly said past
   failures are prerequisites. Publishing what didn't work — a mechanic you killed,
   a number that disappointed — is on-thesis for the exact person you're talking to,
   and almost nobody in crypto does it.

**On the other creator doing something similar:** correct instinct — it's fine, and
it's arguably good. A category with one participant is a curiosity; a category with
two is a **trend**, and trends get written about. Compete on the half they can't
copy: **sports, the schedule, and the scoreboards** (§2.2, §7.1). Being the second
crypto-TV project is a much better position than being the only one, provided you're
the one that owns the standings everyone quotes.

### 11.1 The treasury rule — what replaces burning

**Nothing is ever burned. Not $CSGN, not SOL, not a partner's token.**

Be precise about what a burn is actually *for*: it buys **credibility** — proof
that supply won't come back to hit the market. It buys that one thing by destroying
capital, permanently, once. We buy the same credibility a better way.

**Every token the network receives goes to a treasury under published rules:**

1. **A public address.** Anyone can watch the balance. No trust required.
2. **A no-sell window** — a stated minimum hold on any partner token received.
   Start at 180 days.
3. **A drip cap** — if anything is ever sold, never more than a stated share of that
   token's daily volume, and never more than a stated share of holdings per month.
   Published up front, not promised in a DM.
4. **A stated purpose** — the treasury funds distribution, creator payouts, and
   liquidity. Working capital, not a pile.

A burn is a press release. **A rule-bound public treasury is a balance sheet** — it
does the same reassurance job while the capital stays productive. That is the whole
answer to "why don't you burn," and it's a stronger answer, not a weaker one.

**Which treasury receives — one sentence:**

> **The treasury that receives is the treasury whose stage it is.**

- Someone pays to put a coin on **CSGN's** ticker → **CSGN treasury.** We sold our
  airtime, we get paid. Currency can be SOL, $CSGN, or any accepted partner token.
- Someone pays into a **partner's own surface** — an $ANSEM-holders-only vote, an
  $ANSEM night → **the partner's treasury.** CSGN bills a flat sponsorship fee in
  SOL or USDC instead of taking a cut of the token flow.

That second rule is deliberately generous, and it's why the pitch lands. On a
surface built to serve *their* community, *they* own the sink — CSGN never looks
like it's farming someone else's holders. It also keeps the books clean:
sponsorship is revenue, partner tokens are an asset position, and the two never
blur.

### 11.2 What the Coin Jukebox actually is

**A play is a purchase of airtime. It is not an endorsement.** Every rule below
follows from that one sentence.

- **A play** = one spotlight run — the coin rises from behind the crypto dock, holds
  for the spotlight duration with the payer's note, then settles back. Price lives
  in `config/ticker.spotlightSol`.
- **Flat price, FIFO queue. No bidding, ever.** "Pay more to jump the queue" is an
  auction in a costume, and auctions are out (§5). Flat price is also the honest
  version: a whale and a group chat pay the same to get on TV.
- **A per-wallet cap per hour**, so one buyer can't own the ticker. The broadcast's
  credibility *is* the inventory's value — protecting it is protecting revenue.
- **Any accepted currency.** SOL today; $CSGN and accepted partner tokens next.
  Price is set in one currency and quoted in the others.
- **Payment is verified on-chain before anything renders**, and each signature is
  redeemable exactly once. Already how the endpoint works — it re-reads the
  confirmed transaction rather than trusting the client.
- **Every paid play is marked `PAID SPOTLIGHT` on screen.** Non-negotiable.
  Unlabeled paid promotion of a financial asset is the single mistake that can
  actually end a network. It also *raises* the value of the unpaid segments, because
  it makes them credible by contrast.

**One line:** *TouchTunes for crypto TV — put money in, your coin plays on
television.*

**Status, honestly:** on-chain verification, single-use signatures, the flat price
and the `PAID SPOTLIGHT` disclosure are **built**. The **FIFO queue** and the
**per-wallet hourly cap** are **specified here and not yet built** — today a play
renders immediately and a determined buyer could dominate the lane. Build both
before promoting the jukebox publicly; neither is large. (The payment path also
still needs one live-mainnet dry run with a tiny amount.)

### 11.3 The tenancy model — Ansem as flagship tenant, not landlord

Don't build "an Ansem integration." Build a **partner-token surface** any token can
plug into, and make $ANSEM the first and flagship tenant. Identical effort, and:

- **Autonomy preserved** — you built a slot, not a marriage. If the relationship
  cools, the surface stays and someone else fills it.
- **Repeatable revenue** — it becomes a sponsorship tier you can sell again and
  again instead of a one-off favor.
- **It's a better offer to him, not worse.** "You're the flagship tenant on a
  surface built for partners" is more legitimate than "we bolted your token on."

### 11.4 The slate — what to build, ranked by effort-to-value

**Tier 1 — ship these before the call (days, not weeks):**

**1. Ticker presence.** A permanent $ANSEM cell in the crypto dock plus a recurring
spotlight lane. **Zero architecture — it's config.** Visible, immediate, demoable on
a screen-share.

**2. An $ANSEM holder vote** over one specific, bounded thing: a weekly segment, a
Meme-100 wildcard entry, or which coin gets the spotlight on his night. *Why it's
cheap:* the voting primitive is already mint-agnostic in everything but one
constant — `getCsgnBalance(wallet)` reads a single hardcoded mint in three places.
Generalizing to `getTokenBalance(wallet, mint)` plus a `config/partnerToken` doc is
an afternoon. Signature proof, one-ballot-per-wallet, atomic tallies and the on-air
result are all built and tested already.

**Tier 2 — the two that actually get a yes:**

**3. The co-branded ticker as an OBS source he drops into his own stream.** Costs
him nothing, instantly makes his stream look like a network broadcast, and carries
his token cell. **This is the highest-leverage item on the entire list for CSGN** —
it puts the CSGN ticker permanently in front of an audience hundreds of times
larger than ours, and it reads as a gift rather than an ask. Distribution disguised
as a favor. Offer it to every mid-tier creator too; the ticker is the product that
travels.

**4. The Caller Standings.** Track his public calls like a stat line — entry,
current, ROI, hit rate, W–L — rendered as a broadcast stat card. His entire brand is
being right about coins; a network that keeps his box score, on television,
permanently, is flattering *and* screenshot-able. Then franchise it across every
big caller and it becomes CSGN's single biggest mindshare asset (§7.1) — with him
sitting at #1, which is exactly why he'll promote it.

**Tier 3 — the follow-ups, once the relationship is real:**

**5. $ANSEM as an alternate jukebox currency.** Pay in $ANSEM to play a coin;
proceeds to the CSGN treasury under §11.1's published rules. Small change to the
payment verifier (same re-read-the-confirmed-tx pattern) and it creates the real,
recurring $ANSEM sink demand that a partner actually wants.

**6. A community draft league.** His community drafts a portfolio against CSGN's,
head-to-head, weekly standings on the ticker. Sports-native, costs nothing, and
rivalry is the most reliable engagement engine there is.

**7. Meme-100 wildcard.** A guaranteed slot for his community's pick.

**8. A recurring segment designed to work whether or not he shows up.** His time is
the scarce input, so never build anything whose value depends on a busy person's
recurring attendance. Cover his calls, track his moves, name the segment after the
franchise rather than the man. If he appears, it's a tentpole — not a dependency.

### 11.5 What to refuse

- **No token merge, no swap, no shared treasury.** Instant loss of autonomy.
- **No equity or governance over CSGN itself.** Partner tokens govern *partner
  surfaces*, never the network.
- **No exclusivity.** The surface stays open to other partners — that clause is what
  keeps this a product instead of a dependency.
- **No gating core access** behind $ANSEM. The token scope rule (§5) applies to
  partners too: promotion, never admission.

### 11.6 The pitch, in one paragraph

*"We turned broadcast airtime into an onchain good — twelve finite two-hour slots a
day, anyone can claim one, holders vote on what airs, and you can pay to put a coin
on television. It's a fair launch, it's live right now, and the creator fees go to
whoever is on air. If you want in: your token gets a permanent ticker cell and a
spotlight lane, your holders get a balance-weighted vote that resolves on air, and
we keep your call record as a stat line on TV — your box score, permanently, on a
network. Anything your holders spend on your own surface goes to your treasury, not
ours; we bill a flat fee. We never burn and never dump — public address, published
hold rules. And here's a co-branded ticker you can drop straight into your own
stream. No merge, no swap, no exclusivity."*

**Order matters.** The mechanism comes first because that's what he said he's
looking for (§11.0); the token integration is the offer, not the ask. Ship #1 and
#2 before any call. Lead with #3 and #4 — the gift and the box score. #5 is the
follow-up.

---

### 11.7 The missing piece: a real speculation game

His ask names something CSGN doesn't have yet — a **speculation game**, not just a
vote. The design that fits the network (sports-native, broadcastable, and honest)
is a **draft league for coins**:

- Wallets **draft a portfolio** of memecoins for the week — a fixed number of picks,
  locked at a published time.
- Performance is **scored like a fantasy league** off public prices, and the
  **standings run on the ticker** all week.
- **The prize is airtime and status**, not money: the winner's pick gets a spotlight,
  the top of the table gets read out on air, and the standings are a permanent
  scoreboard (§7.1).

**Why this design specifically:**

- **Nothing is escrowed and there are no entry fees**, so it's a leaderboard over
  public data — not a pooled-stakes contest with payouts, which is a different and
  much heavier thing legally. Keep it that way; the moment money is pooled and paid
  out on price outcomes, it's a regulated activity in most places and worth real
  legal advice before touching.
- **The speculation is real anyway** — people buy their picks. That's the "creative
  speculation game" without CSGN ever holding a stake or taking a rake.
- **It's uniquely ours.** It needs the sports instinct to think in drafts and
  standings, and a broadcast ticker to make the table look official. A feed can't
  render a standings table that feels real. A lower-third can.
- **It's a weekly content engine** — draft day, mid-week movers, Sunday final
  standings. Three shows out of one mechanic.

Build it after Caller Standings (they share the same scoring/rendering spine) and
you have two things that are exactly what he said the space needs, both on air, both
quotable, neither of them a favor.

### 11.8 The continuous vote — a "TV remote for crypto" (ideation, not scheduled)

> **Status: ideation.** Logged here to consolidate the product direction, not
> committed to the build order. The time-block schedule (§4) stays the shipping
> model; this is the version of the network we grow *toward* if the vote mechanic
> proves out. Everything below is a design sketch with its risks named, not a spec.

**The idea in one line:** instead of selling twelve fixed 2-hour slots a day, the
channel becomes a **live, always-on vote** — the token picks *what plays right now*
from a short shortlist of the best current streams, and viewers can change the
channel at will. A **TV remote for crypto**, where the remote is the token.

**How it would work:**

- At any moment the network presents **3–5 curated options** — the best relevant
  live streams right now (a big Twitch trader, an X broadcast, a tournament, a
  founder AMA), chosen by the curator and/or surfaced by activity.
- Holders **vote with token-as-weight** — the exact mechanism already built for the
  Meme-100 and governance votes (`castVote` / `settleVotes`, weight = live on-chain
  $CSGN balance, re-settled against real holdings so a sold bag stops counting).
- When enough weight lands on one option, **that stream goes live on the channel.**
  The vote never closes; it's a running tally, so the channel re-tunes itself as
  conviction moves — no time blocks, no dead air, always the thing the audience most
  wants on.
- **The forwarded streamer doesn't have to know or have an account.** We **log what
  they're owed** (their share of the fee/attention their airtime generated) against
  their channel identity. When they later create a CSGN account and verify that
  channel, the ledger is already waiting — *"your stream generated you $1,000 and you
  didn't even know."* That first-contact moment is itself the growth hook.
- **The curator's prerogative stays intact.** Holding the majority of weight means
  the CEO/curator can **put himself on at any time** — not a rule-break, the exact
  opposite: the rules say weight decides, and he'd be spending real weight to do it.
  It's the honest expression of "curator," not an override around the rules.

**Why it could beat time-blocks:**

- **No empty slots, ever.** A block with a no-show is dead air (which is exactly the
  failure §11.8's parent problem — the STARTING_SOON revert — exists to paper over).
  A continuous vote always resolves to *something live*.
- **It's self-programming.** The schedule stops being a thing the founder has to fill
  every day; the audience fills it, and the founder curates the shortlist.
- **It's the same "airtime is the asset" thesis (§1.1)**, just priced continuously
  instead of in 2-hour lots — closer to a real-time market for attention.
- **It manufactures the owed-money surprise at scale** — every forwarded stream is a
  potential creator who discovers CSGN already owes them money.

**The risks to solve before this is more than a sketch — name them honestly:**

1. **Owing money to people who never signed up is a real liability, not a
   flourish.** An accrued-payout ledger tied to identities we don't control needs a
   clear, published rule for what's actually owed, when it's claimable, and what
   happens to unclaimed balances — and it wants the same "no pooled stakes / no
   promised yield" discipline §11.7 already draws. Treat it as a treasury
   obligation (§11.1), not a marketing line.
2. **Forwarding someone's stream is a rights question.** Embedding a Twitch/X live
   feed onto our own broadcast-to-X output is not automatically permitted; the safe
   default is *link/hand-off and co-sign*, or explicit opt-in, not silent
   re-broadcast. Get this wrong once publicly and it's the story.
3. **Moderation surface explodes.** The moment the audience can vote *arbitrary*
   external streams onto the channel, anything can end up on air. The 3–5 **curated**
   shortlist is the control — the vote chooses *among vetted options*, it doesn't
   nominate freely. Keep it that way.
4. **Whale capture.** Token-as-weight means the biggest bag can pin the channel.
   That's tolerable (it's the same honesty as the curator prerogative), but it needs
   to be *visible* — show the weights on air like a live poll, so it reads as an
   honest market, not a hidden hand.
5. **It competes with the slot business.** Slots are the day-one revenue (§10). A
   continuous vote could cannibalize the thing that pays the bills before it's proven.
   The sane sequencing is: run it as **one show first** — a nightly "you hold the
   remote" hour inside the existing schedule — measure whether the vote actually moves
   and whether forwarded creators convert, and only then consider it as the default
   programming layer.

**One-line verdict:** it's a genuinely better *shape* than fixed blocks and it reuses
machinery CSGN already has (token-weight voting, the treasury/owed ledger, the
emergency-override cut-in that already lets one Firestore write change what /player
shows). But the owed-money and stream-rights questions are load-bearing — build it as
a single vetted-shortlist hour, prove the loop, and let it earn its way to being the
whole channel.

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

## 13. The content plan — an honest read

The stated plan: start streaming immediately, cut 30/60-minute VODs, 5–10 clips a
day, 50–75 posts a day from @CSGN and 100 a day from the personal account.

**The instinct is right and the arithmetic is wrong.** High posting volume genuinely
is how crypto Twitter is won — the accounts that own the timeline post dozens of
times a day. But 175 posts is one every five and a half minutes across a sixteen-hour
day, on top of streaming, on top of cutting ten clips, on top of editing a VOD. That
is roughly a fourteen-hour day with no slack in it, and the plan already names week 6
as the point where things break (§12.4).

Four changes make the same ambition survivable.

### 13.1 Change the composition, not the number

Of 100 posts, maybe 10 should be original. **The other 90 are replies.**

Replies take fifteen seconds, and at 300 followers they are where *all* the
distribution is — you are borrowing someone else's audience every time. Original
posts are the expensive ones: they need a take, a format, a reason to exist. Trying
to write 175 originals a day is what burns people out by week three; writing 15
originals and 160 replies is a completely different day and reaches more people.

**Track replies-into-big-accounts as a weekly number.** It's the borrowed-reach
input, it's fully in your control, and it's the one that moves followers early.

### 13.2 Give the two accounts different jobs

Two accounts both posting 75+ times a day will converge on saying the same things,
which is the worst outcome: double the work, half the credibility, and X's spam
heuristics notice duplicate text across accounts you control.

| | Personal account | @CSGN |
|---|---|---|
| Role | **the human** | **the network** |
| Volume | 100–150/day, mostly replies | **10–20/day, all production** |
| Content | takes, fights, sports opinions, live reactions | scoreboards, clips, standings, results, "now live" |
| Production | zero — thumbs, fast | high — every post is a finished artifact |
| Goal | followers | subscribers |

**People follow people and subscribe to networks.** A network account posting 75
times a day reads as a bot and gets muted; a network account that publishes the
Meme-100 every day and five great clips reads as ESPN. Dropping @CSGN from 75 to 20
is not a reduction in ambition — it's what makes it look like a network.

**Never post identical text from both.** Ever.

### 13.3 Make the format manufacture the clips

5–10 clips a day is the right target, but it only works if the stream reliably
*produces* 5–10 clippable moments. Hoping for them doesn't scale. Build segments
whose entire job is to generate a moment:

- a ranking **reveal** (the Meme-100 top 3, live, with reactions)
- a **hot-take round** with a timer
- **worst take of the day**, read out loud
- a **live grade** on something that just happened
- the **standings update** for whichever league is running

And the operational rule that already exists but is worth repeating because it's the
one that actually fails: **mark the clip while streaming or it doesn't exist.**
Harvesting later is what kills the habit.

**One free multiplier: clip with the ticker in frame.** Every clip then carries CSGN
branding automatically and looks like television instead of a webcam. It costs
nothing, it's already built, and it's the cheapest brand asset available.

### 13.4 Make the VOD a show, not a recording

A three-hour stream doesn't become a 60-minute VOD by trimming the ends. The
question is what the VOD *is* for someone who wasn't there. Same open, same
segments, same close, every time — so it's watchable cold. That's what turns the
back catalogue into the library that compounds (§1.1) instead of an archive nobody
opens.

### 13.5 Design the floor, not the ceiling

The plan above is a ceiling. Ceilings get missed, and a missed ceiling feels like
failure, and that's what ends streaks. So define the **minimum viable day** and treat
it as the actual commitment:

> **One stream · three clips · thirty replies · one scoreboard post.**

That's maybe three hours. It is hittable on a sick day, a travel day, a red day. Do
that and the streak survives; everything above it is upside. **The streak is the
asset — not any individual day's volume.**

Two more operational notes:
- **Batch the posting.** Three blocks of 30–40 minutes beats being on X all day.
  Being on X all day is what quietly destroys the streaming.
- **Keep links out of most posts.** Link in a reply. High link ratio on a young
  account is a reach-limiting signal, and it's an easy own goal.

---

### 13.6 The floor plan, as an actual daily schedule

The floor (§13.5) is *one stream · three clips · thirty replies · one scoreboard
post*. Here is what that looks like as hours, so it's a routine rather than an
intention. Times are illustrative — the **shape** is the point: three posting
blocks, one show, one clipping block, and a hard stop.

| Block | Length | What happens |
|---|---|---|
| **Morning · reply block** | 30–40 min | 40–60 replies into whatever CT and sports Twitter are arguing about. No originals. Thumbs only. |
| **Prep** | 20 min | Collect the day's stories. The show is delivery, not research. |
| **Scoreboard post** | 5 min | The Meme-100 from @CSGN. Same time every day. This is the artifact. |
| **The show** | 30 min fixed | Whiparound. Fixed time, fixed length, never sprawls. Mark clips **while live**. |
| **Clip block** | 30–45 min | Cut the marked moments. 3 minimum, 5–10 on a good day. Ticker in frame on all of them. |
| **Afternoon · reply block** | 30–40 min | Another 40–60 replies. Different timeline than the morning. |
| **Long stream (some days)** | 1–4 hrs | League night, Dynasty, or hanging in someone else's chat (§13.7). |
| **Evening · post block** | 20 min | 5–10 originals from the personal account: takes, clips, the collision format. |

That's ~3 hours on a floor day and ~6 on a league day, and it hits ~150 posts
without a single hour of "being on X." **The blocks are what protect the streaming.**
Sprinkling posts across the whole day is what quietly eats it.

**Weekly, not daily:** one collision-format post (§7.2), one guest appearance or
space, and ten hand-recruited slot claimants. Those three are the growth; everything
in the table above is the base.

### 13.7 Streaming into other people's rooms — the highest-leverage hour you have

Sitting in someone else's token Discord and talking is not a distraction from the
plan. At this follower count **it may be the single best use of an hour**, for the
same reason replies beat originals: you are in a room that someone else filled.

Rules that make it work instead of wasting it:

- **Stream it as CSGN.** You in a room is a conversation; you in a room *with the
  CSGN ticker on screen* is a broadcast, and every clip that comes out of it carries
  the network. This is the free-multiplier rule (§7.5) applied to borrowed rooms.
- **Claim the slot.** If you're going to talk for two hours anyway, do it inside a
  CSGN slot so it's on the schedule, it's on the ticker, and the fee accounting runs.
  Nothing gets left as "just a Discord thing."
- **Be a guest, not a promoter.** Say the network's name once, at the top or when
  someone asks. Anyone who pitches in someone else's room gets remembered for
  pitching. The ticker does the promoting for you, silently.
- **Take the clips out.** Their room, your clips — the useful asymmetry. Three
  clips from an hour in a big room out-reach a whole day of solo posting.
- **Show up more than once.** One appearance is a novelty; being *the guy who's
  always there and always has a take* is how you become a fixture, and fixtures get
  invited to things.
- **Never claim endorsement.** Being in someone's Discord is not a partnership, and
  implying it is the fastest way to lose the room.

**Where this compounds:** every big token community is a room, every room is a
distribution node, and the network's whole pitch to those communities is *"your coin
gets airtime."* Hanging in their chat is the free version of that pitch, delivered in
person, before you ever ask for anything.

---

## 14. The whole thing on one page

1. **The wedge is the intersection.** Gaming × sports × crypto × trading for young
   men. Not "better crypto content" — *the only show that's all four.*
2. **We sell airtime, not engagement.** Everyone else in crypto social sells a feed;
   we sell twelve two-hour slots a day. A feed with nobody in it is dead — a channel
   with nobody in it is still broadcasting. That's why one person can build this.
3. **Be the scoreboard, not another voice.** Meme-100, Caller Standings, league
   tables. Voices compete for attention; scoreboards get *cited* by everyone
   competing for it — the only way a 300-follower account gets quoted by a
   300,000-follower one.
4. **Sports is the differentiator and the distribution.** It's what Ansem/ThreadGuy/
   Rasmr can't do, it keeps the show fun on red days, and sports takes travel.
5. **The founder is the product for 90 days.** The platform is the moat later.
6. **Stream as the Stickman.** It removes every excuse not to go live and is an
   ownable network asset a face can't be. Face for tentpoles.
7. **Leagues are content engines with a hard rule:** 30 min/week of admin max, or
   it's a second job. Dynasty → Rocket League → CS:GO.
8. **The daily Whiparound is non-negotiable.** Length is the shock absorber; the
   streak is the asset.
9. **1–3 clips a day, every day**, each naming a coin, team, or person.
10. **Work both timelines and borrow audiences** — at 300 followers, one guest spot
    beats a month of posting.
11. **Access stays open and free; the token only governs promotion** — plus the
    gated info pipeline. No auctions, no gates on getting on air, and no burning:
    the treasury receives, holds under published rules, and deploys (§11.1).
12. **Run both dynasties.** Offline/modded is the reliable engine; the 12-team
    online league is the social one — and *coverage* (rankings, recaps, standings
    on the ticker) is its actual product, MFL-style.
13. **Partner tokens are a surface, not a favor.** Build it once so $ANSEM is the
    flagship tenant, not the landlord — same effort, keeps autonomy, resells. The
    two things that get a yes: a co-branded ticker he drops into *his own* stream,
    and a Caller Standings board that keeps his box score on television.
14. **The infrastructure is not the bottleneck** and won't be for a long time.
    Every real blocker found so far has been fixed; go make content.
15. **Manage to followers, clips shipped, streams hit, and holders-who-acted** —
    not market cap. And know the real risk is stopping in week 6.
16. **Post volume is right; the composition was wrong.** ~15 originals and ~160
    replies, not 175 originals. The personal account is the human (high volume,
    low production); @CSGN is the network (10–20/day, every post a finished
    artifact). Never the same text from both.
17. **Design the floor, not the ceiling.** One stream · three clips · thirty
    replies · one scoreboard post. Hittable on a bad day — and the streak is the
    asset, not any single day's volume.
18. **The pitch is the mechanism, not the token.** He publicly asked for novel
    onchain mechanisms, creative speculation games, and fair-launch startups
    shipping things. CSGN is all three already — so ship, then show. Never
    convert a warm public exchange into a DM'd request.
19. **Hanging in someone else's room, streamed as CSGN and inside a claimed
    slot, is the best hour available at 300 followers** — their room, your clips.
    Say the network's name once; let the ticker do the promoting.
20. **Ten slot claimants beat a thousand followers.** Every claimed slot is a
    creator promoting CSGN to their own audience, with our ticker on screen.
