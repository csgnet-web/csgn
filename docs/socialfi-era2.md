# CSGN — Winning SocialFi Era 2

> **A full agency consultation.** The market read, the honest positioning, the
> sign-up-friction decision (Privy), the founder's promotion playbook, the
> project's social verticals, and a 90-day operating plan.
>
> **The stated objective:** *the project and the founder become well-known and at
> the forefront of SocialFi.* Everything here is ranked against that, not against
> revenue — where the two conflict, it's flagged.
>
> Companions: [`onchain-thesis.md`](onchain-thesis.md) (what the token *is*),
> [`ecosystem-strategy.md`](ecosystem-strategy.md) (money + partnerships),
> [`master-plan.md`](master-plan.md) (product + founder playbook).

---

## 1. The market read — what Era 2 actually is

The instinct is right. The category is back, and the numbers are not subtle:
SocialFi protocols recorded **~8.2M daily active wallets in Q1 2026, up from
~2.1M a year prior** ([pen-caforr](https://pen-caforr.org/2026/04/15/socialfi-2026-8m-daily-active-wallets-but-is-the-business-model-sustainable/)).
**Farcaster** has ~**3.2M MAU and ~45 independent client apps** built on it — the
first crypto-social protocol to become a *platform* rather than an app. And
**Solana is where consumer-scale SocialFi is being built**, on throughput and fees
([QuillAudits](https://www.quillaudits.com/blog/web3-security/socialfi-solana-rise-top-projects)).

**But Era 2 is not Era 1 with better charts.** The single most important
distinction, and the thing to internalize:

> **Era 1 financialized *access to people*. It collapsed because the product
> *was* the speculation. Era 2's survivors built real social utility, where the
> token is a means, not the end.** ([Cointelegraph](https://cointelegraph.com/news/friendtech-failure-socialfi-success-adoption))

FriendTech sold keys to a chatroom. When the price stopped going up, there was
nothing left — because there was never a product underneath, only a bet on
attention. Era 2 winners have something you'd use if the token went to zero.

### 1.1 The three rules Era 2 is enforcing

1. **The product must survive the token going flat.** If your DAU depends on
   price, you're Era 1.
2. **The token must be a mechanism, not a ticket.** "Buy to access" is dead.
   "The token *does* something structural" is the live design space.
3. **Be a protocol, not an app.** Farcaster won by being the thing 45 other
   products build on. Distribution compounds when other people build your
   frontends.

### 1.2 Where the openings are

Almost everyone in Era 2 is rebuilding **the feed** — a decentralized Twitter, a
better creator-monetization graph. That lane is crowded and Farcaster is winning
it.

**Nobody is building the channel.** Every social product is asynchronous text.
There is no crypto-native *linear, live, always-on* social object. That's the gap,
and it happens to be the exact thing CSGN already built.

---

## 2. The funnel — and the Privy question

*(You asked for analysis only, no integration. This is the analysis.)*

### 2.1 The problem, stated plainly

Your current registration requires, in one sitting: **email + password + email
verification + Phantom install/connect + signature + Twitch OAuth round-trip.**

That is, conservatively, a **6-step, ~3-minute, two-app flow with a full-page
redirect in the middle.** For an audience arriving from a phone, from a link in a
reply, mid-scroll. Industry-wide, each additional step in a crypto onboarding
funnel costs roughly 20–40% of the remaining users; a wallet install step alone
routinely costs more than half. **Even a generous read puts end-to-end conversion
in the low single digits.**

For a project whose #1 objective is becoming well-known, **this is the single
largest growth constraint in the codebase** — bigger than any content decision in
this document. You can win every attention battle in §5 and still convert almost
nobody.

### 2.2 What Privy is

Privy is an embedded-wallet + auth provider — email/SMS/social login that
**provisions a real wallet behind the scenes**, so a user has a wallet without
knowing what a wallet is. Relevant facts:

| | |
|---|---|
| **Owned by** | Stripe (acquired June 2025) — a stability signal, and a payments roadmap signal |
| **Pricing** | Free to **499 MAU**; **$299/mo** Core to 2,500 MAU; usage-based past 10K MAU / 50K signatures / $1M monthly volume ([Privy](https://www.privy.io/pricing)) |
| **Solana** | Supported — but **EVM is the primary depth**; Solana is secondary ([Openfort](https://www.openfort.io/blog/best-embedded-wallets)) |
| **Model** | Embedded wallets, server wallets, plus external-wallet connection (it can sit *alongside* Phantom, not replace it) |

### 2.3 The honest analysis for CSGN specifically

**What it would genuinely fix:**
- **Collapses the funnel to one step.** Email or social → account exists → wallet
  exists. The 3-minute flow becomes ~15 seconds.
- **Removes the mobile wallet-install cliff** — the biggest single drop in your
  funnel, and the one you cannot fix with copy.
- **Lets the wallet requirement arrive *later*,** at the moment it's actually
  needed (claiming a slot, voting, getting paid) instead of at the door.
- Free at your current scale, and $299/mo only after you have 500+ real MAU — a
  problem worth having.

**What it does not fix, and the real costs:**
- **Twitch OAuth still exists.** Streamers must still connect Twitch. Privy
  shortens the *account* step, not the *streamer verification* step. Your funnel
  goes from six steps to about three, not to one.
- **Solana is Privy's second chain.** Every CSGN mechanism that matters —
  token-weighted voting, SPL jukebox payments, treasury, balance-gated features —
  is Solana-native. You'd be putting a core dependency on a vendor's secondary
  surface. Test SPL signing depth *before* committing.
- **A vendor now sits inside your auth path.** Today your auth is Firebase +
  self-custody: no third party can lock you out. That's a real property to trade
  away knowingly.
- **Embedded wallets are custodial-adjacent in perception.** A crypto-native
  audience — *your* audience, holders who vote with real balances — may read it
  as "not a real wallet." Ansem's crowd has opinions about this.
- **Migration is not free.** `uniquePhantomWallets`, wallet-linked identity, the
  proof-token flow, and now Sign-in-with-Phantom all assume a self-custodied
  Solana address.

### 2.4 The recommendation

**Don't replace. Segment.** Your product has two genuinely different users, and
the mistake is designing one door for both:

| User | What they need | Right door |
|---|---|---|
| **Viewer / voter / claimer** (the 95%) | To participate in seconds | **Privy** — email/social, wallet provisioned invisibly |
| **Streamer / holder / whale** (the 5%) | Self-custody, real balances, signature auth | **Phantom** — exactly what you just fixed |

Privy supports both paths in one SDK (embedded *and* external wallets), so this
isn't a fork — it's one integration with two entry points.

**Sequenced:**
1. **Now (free):** cut the *existing* funnel. Make Twitch verification lazy —
   required to **go live**, not to **exist**. That alone probably doubles
   conversion and costs one afternoon.
2. **Next (small spike):** prototype Privy on a branch, behind a flag,
   **viewer-path only**. Verify SPL signing, Solana balance reads, and that a
   Privy wallet can pay the jukebox. Do not touch the streamer path.
3. **Then:** if the spike is clean, ship Privy as the default door and keep
   "Sign in with Phantom" as the power-user door — which is now, conveniently,
   already built.

**Verdict: yes, but as an additional door, not a replacement — and only after the
free funnel cuts.** The cheapest conversion win available to you requires no
vendor at all.

---

## 3. Where CSGN actually sits in Era 2

**The position, in one line:**

> **Every other SocialFi project is rebuilding the feed. CSGN is the only one
> building the channel.**

That is a genuinely uncontested lane, and it's defensible for a reason most
positioning isn't: it requires infrastructure — a broadcast state machine, an
encoder pipeline, live-verification, graphics — that a feed-shaped competitor
can't ship in a quarter.

**Against the three Era 2 rules (§1.1):**

| Rule | CSGN today | Gap |
|---|---|---|
| Survives the token going flat | ✅ The channel broadcasts regardless | — |
| Token is a mechanism, not a ticket | ❌ **Currently decorative** | This is the work — [`onchain-thesis.md`](onchain-thesis.md) §6 |
| Protocol, not app | ❌ Closed system today | **Attention Hooks** is the answer |

**You pass the hardest rule already** — the one that killed Era 1 — and fail the
two that are fixable by design. That's an unusually good position.

**The narrative to own:** *social apps tokenized who you know; CSGN tokenizes
when you're watched.* **Airtime is the social primitive nobody has claimed.**

---

## 4. The strategy — five moves, ranked

**① Own a phrase before you own a market.**
"Blockspace for attention." "The channel, not the feed." "Airtime is the
primitive." Pick **one**, put it in the bio, the site header, every essay, and
say it until it's boring to you — that's roughly when strangers start repeating
it. Category creators win by naming the category.

**② Be the scoreboard for Era 2 itself.**
Don't just participate in SocialFi — **cover it**. A nightly segment ranking
SocialFi projects, mindshare, launches, on your own broadcast, with graphics
nobody else can render. Covering a category is the fastest way to become
synonymous with it, and it makes every project you cover a distribution partner.

**③ Ship the token mechanism.**
Proof-of-Broadcast → airtime as an onchain asset → hooks (`onchain-thesis.md`
§6.4). Until then you're a media project with a coin — which is precisely the
Era 1 silhouette you need to avoid.

**④ Become a protocol.**
Farcaster's lesson: 45 clients beat one app. Publish the hooks, publish the
schema, let anyone render the ticker or run a node. **Other people's frontends
are free distribution.**

**⑤ Be permanently forwardable.**
Your unfair advantage is that you can put *other people's* content on air. Every
forward (permissioned — see `onchain-thesis.md` §3.2) is a relationship, a clip,
and a creator discovering you owe them money.

---

## 5. The founder playbook — you, personally

**The premise: in SocialFi, the founder *is* the distribution.** Your account
will outgrow @CSGNet's for the first year. Plan around that instead of fighting
it.

### 5.1 X / Twitter

**Composition — 100 posts/week, not 100/day.** Sustainable beats heroic
(`master-plan.md` §13.1 was right; this is the tightened version):

| Type | Share | What it is |
|---|---|---|
| **Replies into big accounts** | ~60% | 15 seconds each; where *all* early distribution is |
| **Build-in-public receipts** | ~20% | Screenshot, diff, before/after. Proof you ship. |
| **Category takes** | ~15% | The airtime/attention thesis, repeated |
| **Announcements** | ~5% | Yes, only 5%. Billboards don't grow. |

**The five formats that will actually work for you** — these are yours, not generic:

1. **The Scoreboard Reply.** Someone makes a call. You render it as a CSGN
   lower-third and reply with the graphic. *Nobody else in the replies can do
   this.* Highest-leverage single habit in this document.
2. **The Receipt.** "Fixed Phantom connect today. Root cause: a cached address
   isn't a connection — we skipped connect() and the signature prompt never
   fired." Engineers respect specific post-mortems; this is how you get known in
   the dev community.
3. **The Live Artifact.** Clip from the broadcast with the ticker running.
   Unfakeable — it proves the network exists.
4. **The Thesis Post.** One a week, one idea, no thread padding. "Feeds tokenized
   who you know. Nobody tokenized *when you're watched*."
5. **The Open Invitation.** "Hour open at 3pm ET. Claim it, go live, keep the
   fees." Concrete, repeatable, and it *is* the product.

**Rules:** never post "we're live" without a reason to click. Never thread past
7 posts. Always reply to your own replies. Quote-tweet yourself with the artifact
when a take lands.

### 5.2 Substack — the credibility engine

X makes you visible; **long-form makes you credible**, and credibility is what
gets you into rooms with Ansem-tier people. One post a week, ~1,200 words, same
day each week.

**The first five, in order — this is a deliberate arc:**

1. **"The Feed Won. The Channel Is Still Open."** — the category thesis. Your
   flag in the ground.
2. **"What FriendTech Actually Got Wrong"** — earns authority by analyzing Era 1
   honestly, then positions Era 2 rules. Highly shareable.
3. **"Blockspace for Attention"** — the technical thesis. Airtime as a scarce,
   auctionable, programmable resource. *This is the one that gets quoted.*
4. **"I Built a TV Network Alone. Here's the Architecture."** — the engineering
   post: the state machine, ad masking, proof-of-broadcast. Dev credibility.
5. **"What We Owe Streamers Who Don't Know We Exist"** — the owed-ledger idea.
   Emotional, novel, and it markets the mechanic.

**Distribution beats writing:** every essay becomes ~10 X posts, one broadcast
segment, one Discord drop. Never publish and walk away.

### 5.3 Discord / live audio — including the Ansem stream room

**This is your highest-leverage channel and the one most people get wrong.**

The room you're already in is worth more than any campaign, because it's live
proximity to exactly the people you need. The rules:

- **Be useful before you're interesting.** Answer the market question. Have the
  chart. Be the person with the data.
- **Never pitch in the room.** Ever. Pitching in someone else's room spends
  credibility to buy nothing. The pitch happens in DMs, *after* you've been
  useful for weeks.
- **Turn the room into artifacts.** The best line said in that room, rendered as
  a CSGN graphic and posted (attributed, tagged) the next morning, is a gift to
  the person who said it and an ad for you. Do this daily and you become the
  room's unofficial broadcaster — a role nobody competes for and everyone values.
- **Ask before forwarding.** Covered in `onchain-thesis.md` §3.2. Permission
  converts your biggest risk into your best collaboration.
- **Then run your own room.** Once you're known in theirs, a CSGN audio room
  after the nightly show converts listeners into community. Same time, every
  night.

### 5.4 Personal cadence (sustainable, not heroic)

| Daily | Weekly |
|---|---|
| ~15 replies into big accounts | 1 Substack essay |
| 1 build receipt | 1 thesis post |
| 1 live artifact/clip | 1 audio room appearance |
| 1 hour in the stream room | 1 partner/creator DM |

That's ~90 minutes/day outside the broadcast. **Design for the version of you who
doesn't feel like it** — the streak is what moves you between outcome bands.

---

## 6. The project's social verticals

Each account needs a **job**. Accounts without jobs become billboards.

| Vertical | Job | Cadence | Priority |
|---|---|---|---|
| **@CSGNet (X)** | The network voice: schedule, live, clips, standings | 5–10/day | **P0** |
| **Founder X** | Thesis, build-in-public, replies | 15+/day | **P0** |
| **Discord** | The notification spine + community home | Always | **P0** |
| **Substack** | Long-form credibility | Weekly | **P1** |
| **YouTube/Shorts + TikTok** | VOD library + vertical clips | 3–5 clips/day | **P1** |
| **Farcaster** | Where Era 2 crypto-social actually lives | Daily | **P1** ← *underrated* |
| **Twitch** | Second live surface + discovery | Per broadcast | **P2** |
| **Telegram** | Trader-audience alerts | Per live | **P2** |
| **Instagram** | Reach beyond crypto | Repurposed clips | **P3** |

**Two calls worth arguing with:**

- **Farcaster is P1, not P3.** It's where Era 2 is being *built* and where the
  builders/funds actually read. 3.2M MAU is small enough that a consistent voice
  gets noticed and large enough to matter — the exact window X hasn't offered
  since 2021. Being early and loud on Farcaster is the cheapest path to "at the
  forefront of SocialFi."
- **TikTok/Shorts are not optional.** You produce hours of live video daily. Not
  cutting verticals from it is leaving the only free reach mechanism on the table.

**The content engine — one input, seven outputs.** Every broadcast hour should
mechanically yield: 1 VOD → 3–5 vertical clips → 2 X posts → 1 Farcaster post →
1 Discord drop → 1 ticker headline → 1 Substack paragraph. **Design the show so
this falls out of it**, rather than treating it as post-production.

---

## 7. The 90-day plan

**Days 1–30 — Ship the streak, plant the flag**
- Nightly hour, same time, never missed. This is the whole month's real work.
- Cut the funnel (§2.4 step 1) — Twitch lazy, not upfront.
- Substack essays 1–2. Own the phrase everywhere.
- Daily: 15 replies, 1 receipt, 1 clip. Daily presence in the stream room.
- **Ship Proof-of-Broadcast** — days of work, and it starts the token story.

**Days 31–60 — Become the scoreboard**
- Launch the **SocialFi standings segment** — the category-ownership move.
- Ship **airtime as an onchain asset**. Announce it as a primitive, not a feature.
- Privy spike behind a flag (§2.4 step 2).
- Farcaster daily. First permissioned forward. Substack 3–4.
- First paid ticker cells (revenue proves it's a business, not a project).

**Days 61–90 — Become a protocol**
- Publish **Attention Hooks** + docs. Invite builders. *This is the "forefront"
  moment* — the day other people can build on you.
- Open-source one module with a technical write-up.
- Bullpen/partner integration live on air (standings, comps).
- Substack 5. Apply to a Solana/Base builder program with shipped work.

---

## 8. Metrics, and when to change course

**Track weekly (leading indicators, all in your control):**

| Metric | 90-day target |
|---|---|
| Replies into 10k+ accounts | 100/week |
| Broadcast hours (nightly streak) | 100% |
| Clips published | 25/week |
| Slots claimed by *other people* | ↑ every week |
| Sign-up completion rate | **>25%** (from likely <5%) |
| Farcaster + X follower growth | Steady, compounding |

**The one that matters most: slots claimed by other people.** It's the only
number that proves this is a network rather than a personal channel. If it's flat
at day 60, the problem is the funnel or the offer — not your posting.

**Kill criteria, decided now while you're unemotional:**
- Nightly streak breaks 3× in a month → cut show length, don't cut the streak.
- Sign-ups still <10% after the funnel work → Privy immediately, stop debating.
- Zero external slot claims by day 60 → the product isn't the channel, it's *you*;
  pivot to the forwarding/remote model as primary.

---

## 9. Risks

1. **Being early to a narrative you can't sustain.** Owning "SocialFi channel"
   requires being on air. A dark channel makes the claim look silly.
2. **Solo-operator burnout** — still the most likely cause of death. §5.4 is
   deliberately ~90 min/day for that reason.
3. **Token launch timing.** Shipping a mechanism into a hot narrative is good;
   pumping a decorative token into it is Era 1 and the market now punishes it.
4. **Vendor dependency** (§2.3) — enter knowingly.
5. **Forwarding without permission** — the one thing that could end an
   Ansem-tier relationship permanently.
6. **Chasing every vertical.** Nine channels in §6, but **P0s are three.** Do
   three well.

---

## 10. The whole thing in five sentences

1. **Era 2 is real and Solana is where it's happening** — but the winners build
   products that survive the token going flat, and CSGN already does.
2. **Everyone else is rebuilding the feed; nobody is building the channel** —
   that's your uncontested lane and it's protected by infrastructure.
3. **The token has to become a mechanism** (proof-of-broadcast → airtime as an
   asset → hooks) or you're wearing Era 1's silhouette in Era 2's market.
4. **The founder is the distribution** — replies, receipts, one essay a week, and
   daily usefulness in the rooms where the people you need already are.
5. **The fastest path to "forefront of SocialFi" is to cover SocialFi** — be the
   scoreboard for the category, and the category will call you by name.

> **The line to own:** *Social apps tokenized who you know. CSGN tokenizes when
> you're watched.*
