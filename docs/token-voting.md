# Supply-Weight Voting — and The 30-Minute Draft

> **Status: design.** Two proposals that share one engine. The first replaces
> "vote weight = token balance" with something meaningfully harder to buy. The
> second is the user-facing product that makes it matter every single hour.
>
> Builds on [`master-plan.md`](master-plan.md) §5 (the token does six things),
> §5.1 (the live-settle fix), and §11.8 (the continuous vote, logged as ideation).
> **This document is the answer to §11.8's five open risks** — read §3.6 for how
> each one is closed.

---

## 0. The one-paragraph version

Your vote is your **percentage of the network**, aged by how long you've held it.
Nothing is deposited, locked, escrowed, or burned — the tokens never leave your
wallet and you can sell mid-vote. Because voting consumes nothing, **your bag
votes in every open question at once, permanently**, which is a property no
deposit-based system can have. Every thirty minutes, that standing weight decides
something real and visible: who gets the next open hour on a 24/7 television
network. That is the whole design.

---

## 1. Why "weight = balance" isn't enough yet

The shipped system (`castVote`, `voteMeme`, `settleVotes`) already does the hard
correctness work: weight is the wallet's live on-chain balance, signature-proven,
and re-settled against real holdings so a seller drops to zero and the
wallet-cycling attack collapses. That's genuinely good, and it's the foundation
everything below sits on.

But it has three problems that no amount of settling fixes, because they aren't
bugs — they're properties of using a raw balance as a vote:

**1. A vote can be bought in the last ten seconds.** Balance is a spot reading.
Buy at T-10s, vote, sell at T+10s. You paid slippage and fees for a decision. On
a low-float token this is cheap, and on any vote that decides money it is
*rational*. The live-settle fix stops you counting twice; it does nothing to stop
you counting once, briefly, for exactly as long as it takes.

**2. Raw token counts are illegible.** "412,000,000 $CSGN backs option B" tells a
viewer nothing. Is that a lot? Two people or two thousand? The number moves when
supply moves. A vote nobody can read at a glance is a vote that doesn't get cast,
and it is unusable as a broadcast graphic — which for a television network is
disqualifying.

**3. Nothing distinguishes conviction from presence.** A wallet that has held
since launch and a wallet that bought this morning are identical to the tally.
Every governance system in crypto tries to fix this with lockups — veTokens,
staking, escrow — and every one of them buys that fix by taking custody of your
tokens. We've ruled that out (§5: "non-custodial; you keep your tokens"), and we
should keep ruling it out. So we need the *effect* of a lockup without the lockup.

---

## 2. The model

### 2.1 Denominate in supply share, not tokens

Every weight is expressed as a **percentage of circulating supply**, everywhere —
the app, the API, the on-air graphic, the wallet's own profile.

```
share(wallet) = balance(wallet) / circulatingSupply
```

This is not a cosmetic change. It reframes the entire product:

- **Shares always sum to 100%.** A ballot becomes a live cap table of opinion.
  Anyone can read it in one second, including someone who has never heard of us.
- **It's supply-move invariant.** The number means the same thing at any market
  cap, at any price, forever.
- **It makes the honest thing legible.** §5.1 correctly says *"tokens are the
  signal; wallets are decoration."* Supply share is the cleanest possible way to
  say that out loud. And it makes whale concentration visible rather than
  buried — which we *want*, per §11.8 risk 4.
- **It gives us the headline number a network needs: turnout.** "**31.4% of
  supply voted**" is a real, quotable, honest metric. A wallet count isn't.

> **The one line to put on the ballot:** *You control 0.42% of the network.*
> Not "you hold 4,200,000 $CSGN." The first sentence makes someone want more.

### 2.2 Conviction from age, not lockups

Weight is multiplied by how long the wallet has held, measured from chain
history. **Nothing is locked. You can sell at any moment.** You simply can't
*buy* the multiplier, because the thing being multiplied is time.

```
weight(wallet) = share(wallet) × ageMultiplier(heldSince)

ageMultiplier:
  < 24 hours    1.0×      "New"
  ≥ 7 days      1.5×      "Held"
  ≥ 30 days     2.0×      "Seasoned"
  ≥ 90 days     2.5×      "Charter"
```

The multiplier is capped at 2.5× on purpose. High enough that age is decisive in
a close vote; low enough that a large new holder is never silenced — this is a
network that wants new holders, and a governance system that tells them to come
back in a quarter is a governance system that costs us the buyer.

**`heldSince` is the timestamp of the wallet's most recent *net increase* in
$CSGN.** Buying more resets the clock on the whole position. That rule is
deliberately blunt, and it's what makes every attack below fail at once:

| Attack | Why it fails |
|---|---|
| Buy the vote at T-10s | The new bag is 1.0× and its share is diluted by every aged holder at 2.5× |
| Flash-loan a position | Borrowed tokens have an age of zero. Nothing to multiply |
| Split across fresh wallets | Every fresh wallet's clock starts at zero, *and* live-settle already collapses the double count |
| Top up an old wallet to hide new money | The top-up resets that wallet to 1.0×. Aging is all-or-nothing |
| Buy an old wallet | Possible — and the cost is a negotiated OTC purchase from someone with no reason to sell cheap. That's a real price, which is the point |

The last row matters: this isn't unbreakable, it's *expensive*. That's all any
voting system can honestly claim. The difference is that here the cost is paid to
another holder rather than to a burn address, which is exactly the treasury-first
posture in §11.1.

**Implementation note.** `heldSince` is derivable from the wallet's $CSGN
transfer history via `getSignaturesForAddress` on the token account, walking back
to the last net-increase. That's a few RPC calls per voter — too slow for a live
tally, fine for a settle. So: **the live tally uses raw share (cheap, instant,
good enough to show on air) and the settle applies the age multiplier.** This is
exactly the split `settleVotes.ts` already draws between the running tally and
the settled one, and its existing doc comment says why. Cache `heldSince` per
wallet with a short TTL; it only ever moves forward.

### 2.3 Voting consumes nothing — so it never stops

This is the property that makes the whole thing feel different, and it falls out
for free from refusing deposits.

Because casting a vote doesn't spend, lock, or move anything, **one wallet's
weight is simultaneously present in every open question**. There is no budget to
allocate, no "which vote do I care about most," no unstaking period. Your bag has
a standing position on all of it, always, and changing your mind is one tap and
zero gas.

Nothing with a deposit can do this. veToken systems make you choose where to
point your locked stake. We don't have a stake to point. **Your bag is always
voting** — and if you sell, it stops voting the instant it leaves, in every
question at once.

Practically, this means a holder always has a live standing ballot across:

| Question | Cadence | What it decides |
|---|---|---|
| **The Draft** | every open hour | who goes on air next (§3) |
| **Meme-100** | continuous | the community pick on the power ranking |
| **The Spotlight** | continuous | which coin the jukebox features between paid plays |
| **Tomorrow's slate** | daily | which coins make the Starting 5 board |
| **Squares axes** | daily | what the board is scored on |
| **Network questions** | as raised | schedule, formats, treasury policy |

Six standing positions, one balance, nothing escrowed. Set them once and they
persist until you change them or sell.

### 2.4 Where the square-root curve applies instead

Linear supply-share is right for **editorial** questions — what airs, what gets
promoted. A network's audience *should* be weighted by ownership, that's what
ownership is for, and §11.8 is right that a curator spending real weight to put
himself on air is honest rather than a rule-break.

It is wrong for **games**, where linear weight means one wallet buys the
leaderboard and the game stops being a game. So Squares allowances and Starting 5
entry counts use a square-root curve on supply share instead
(`src/lib/games/squares.ts`, `startingFive.ts`) — influence grows with stake,
sub-linearly, and everyone gets one free entry regardless of holdings.

**The rule: linear where ownership should decide, sqrt where fun should.**

### 2.5 Quorum and the anti-capture cap

Two guardrails, both stated in supply share so they're auditable:

- **Quorum.** A network question only binds if **≥ 5% of circulating supply**
  participated. Below that it's advisory and we say so on air. A decision made by
  0.3% of supply is not a mandate, and pretending otherwise is how governance
  theatre starts.
- **The 25% cap — draft votes only.** In a single Draft, no one wallet may supply
  more than **25% of all weight cast in that draft**. Weight above the cap is
  clipped for that draft only; nothing is confiscated and nothing is locked.

The cap exists because the Draft runs *every hour* and decides who eats. One
wallet pinning all twelve open hours daily would end the product — not because
it's unfair, but because nobody else would bother showing up, and then there is
nothing to vote on. Note this is a *narrower* rule than §11.8's curator
prerogative, which stays intact everywhere else: the curator can still put
himself on air, he just can't do it every hour on the hour.

---

## 3. THE 30-MINUTE DRAFT

The product that makes all of the above matter sixteen times a day.

### 3.1 The shape

CSGN registers streamers with verified Twitch accounts. That roster is a standing
list. A background watcher checks who on it is **live right now**, once a minute,
forever. Thirty minutes before every open hour, the network freezes a shortlist of
whoever's actually broadcasting, opens a token-weighted vote, and puts it on air
with a countdown. At the top of the hour the vote closes, the winner is assigned
the slot, and `/player` cuts to them.

**The audience programs the channel, in public, every hour.**

The **7 PM – 3 AM ET network block stays exactly as it is** — CSGN Originals,
programmed, not drafted. The Draft runs on the eight open 2-hour blocks from
3 AM to 7 PM ET. That boundary already exists in code
(`_shared/schedule.ts: NETWORK_START_HOURS_ET`) and in the shared `slotIdentity`
rule, so the Draft inherits it rather than re-deciding it.

### 3.2 The clock

For an open slot starting at **T**:

| Time | State | What happens |
|---|---|---|
| **always** | `WATCHING` | Roster polled every minute. Availability history accrues |
| **T-35** | `SEEDING` | Candidate pool assembled from who's live, ranked (§3.3) |
| **T-30** | `LOCKED` | Top 5 frozen as the ballot. Goes live in-app, on the ticker, on air |
| T-30 → T-2 | `OPEN` | Token-weighted voting. Running tally visible everywhere |
| **T-2** | `LAST CALL` | Countdown graphic. Reuses the existing `STARTING_SOON` last-call |
| **T-0** | `SETTLED` | Vote settles against live balances + age. Winner assigned. Player cuts |

Thirty minutes is the right number and it's worth saying why: long enough for a
streamer to see they're nominated and stay on, long enough for a vote to actually
move, and short enough that the shortlist is still *true* when it closes. An hour
out, half the board has gone offline.

### 3.3 Seeding the board — how five names get picked

Fifty people could be live. Five go on the ballot. This selection has to be
mechanical and published, or the Draft is just curation wearing a costume.

```
draftRating = 0.40 × normalizedShare(last 7 days)     — do they draw? (§ csgn-share.md)
            + 0.25 × rotationBonus(slots since last aired)
            + 0.20 × holderStanding(standing votes for this streamer)
            + 0.15 × reliability(finished slots / claimed slots)
```

- **Share** is the CSGN Share metric ([`csgn-share.md`](csgn-share.md)) — the
  ratings book decides who's on the ballot, exactly like a real network.
- **Rotation** climbs the longer you've gone without an hour, so the board can't
  ossify into the same five faces. This is the single most important term: a draft
  that always nominates the same people is a schedule.
- **Holder standing** is the persistent vote from §2.3 — you can back a streamer
  permanently, and it raises their odds of being *nominated*, not just of winning.
- **Reliability** punishes claiming an hour and not showing. Dead air is the one
  unforgivable sin for a channel.

Everyone live and eligible is shown on a public **draft board** with their rating
and its four components. If you're sixth, you can see exactly why.

### 3.4 Edge cases — where a live network actually dies

Every one of these is a real Tuesday, and each needs a decided answer before this
ships. Dead air is not an acceptable outcome for any of them.

| Situation | Rule |
|---|---|
| **Nobody live at T-30** | No draft. The hour falls through to today's open-claim flow, unchanged. The Draft is additive; it never removes the existing path |
| **Exactly one candidate** | Auto-assign, no ballot. Don't run an election with one name on it — it makes the mechanic look fake |
| **Winner goes offline between T-0 and air** | Runner-up promoted automatically. The watcher already knows they're live. Then third. Then open claim |
| **Everyone goes offline** | Slot reverts to open. `/player` runs its existing intermission board |
| **Exact tie on weight** | Most distinct wallets wins (a real signal, cheaply gamed but not for free); then earliest continuous-live time |
| **Same streamer wins repeatedly** | Cooldown: after winning, `rotationBonus` resets to zero and rebuilds. They can win again — they just have to beat a fresher board |
| **Zero votes cast** | Highest `draftRating` wins by default. The seeding is the fallback, so the hour is always filled |
| **A candidate goes offline mid-vote** | Struck from the ballot live; weight on them is released and their backers are prompted to re-cast. Never settle onto a dark channel |

### 3.5 The data model

```
drafts/{slotId}
  slotId, status: watching|locked|open|settled|abandoned
  lockedAt, closesAt                  — T-30 and T-0
  candidates: [{ twitchLogin, displayName, uid, draftRating,
                 ratingBreakdown, liveSince, viewerCount, struck? }]
  tally: { [twitchLogin]: { shareBps, wallets, cappedShareBps } }
  winner, runnersUp, settledAt, settlementNote

streamerAvailability/{twitchLogin}    — written by the watcher, 1/min
  live, viewerCount, lastLiveAt, liveMinutesToday, lastAiredSlotId
```

`drafts/{slotId}` is world-readable so the OBS ticker can poll it unauthenticated
over the Firestore REST API, the same way `config/ticker` already does. Ballots
stay server-only, matching `votes/{id}/ballots/{wallet}`.

### 3.6 Cost — and why the watcher is nearly free

The important engineering fact: **Twitch Helix `/streams` accepts up to 100
`user_login` values in one request.** A 100-streamer roster is *one API call per
minute* — and `feePollerBackground` already runs every minute and already calls
Helix for the active slot's channel (v1.3, `logSlotActivity`). The watcher is an
extension of a loop that exists, not a new service.

At 1,000 registered streamers it's 10 calls/minute, still comfortably inside
Helix's rate limit. The Firestore write cost is bounded by only writing
`streamerAvailability` on *change*, not every tick.

### 3.7 How this closes §11.8's five risks

The continuous-vote sketch in the master plan is logged as ideation with five
named blockers. This design is deliberately the version that doesn't have them:

| §11.8 risk | Closed by |
|---|---|
| **1. Owing money to people who never signed up** | Doesn't arise. Only *registered* streamers are draftable, so there's no accrued-payout ledger against identities we don't control |
| **2. Re-broadcast rights** | Doesn't arise. A drafted streamer is claiming their own slot under the existing consent flow. It's the shipped model, triggered a different way |
| **3. Moderation surface explodes** | The pool is registered, Twitch-verified accounts only. Nobody can vote an arbitrary external stream onto the channel |
| **4. Whale capture** | Made visible (supply share on air, §2.1), damped (age multiplier, §2.2), and capped for drafts specifically (25%, §2.5) |
| **5. Cannibalizes the slot business** | It doesn't replace slot claiming — it's a second route into the *same* open hours. An hour nobody drafts is still claimable exactly as today, and the 7 PM–3 AM revenue block is untouched |

That's the argument for building this one first: it's the part of the continuous
vote that is already legally, operationally, and technically clear.

---

## 4. Making it a game, not a governance panel

Voting UI is where products go to be ignored. Everything here is designed to be
watched, not administered — these are broadcast graphics first and features
second.

**THE FLOOR.** One hundred seats, each seat = 1% of supply, lit by how that
percent is voting. Unvoted supply sits dark. The whole electorate on one screen,
readable in half a second, and it fills up in real time during a draft. This is
the single asset that makes token voting *look* like something on television.

**THE SWING METER.** *"0.8% of supply flips this."* Show every voter exactly how
far from decisive they are, live. This is the highest-conversion element in the
entire design — it turns a passive holder into a participant by telling them
they're close, and it's honest, because it's just arithmetic on a public tally.

**WHALE CAM.** A wallet over 1% of supply moves its vote → it's an on-air event
with a lower third. This deliberately converts §11.8's whale-capture risk into
content. A hidden whale is a scandal; a whale with a chyron is a character.

**CALLED IT.** A permanent, public record per wallet: the drafts you backed that
won, the Meme-100 picks that ran. Status only — it buys no weight and no money.
The scoreboard *is* the reward, and per §7.1 of the master plan, being the
scoreboard is the whole growth strategy.

**TURNOUT.** Broadcast "% of supply that voted" after every draft, next to the
last one. It's the network's own ratings number for its own audience, and unlike
a wallet count it can't be faked.

**THE CHARTER BADGE.** 90-day holders get a visible mark. It costs nothing to
give, can't be bought, and is the only status in the product that money genuinely
cannot accelerate.

---

## 5. Build order

Each step is independently shippable and independently useful. Nothing here
requires the step after it.

1. **Supply-share denomination.** Display-layer only — divide by circulating
   supply everywhere weight is shown. One afternoon. Immediately makes every
   existing vote legible and gives us the turnout number.
2. **The Floor + the swing meter.** Pure rendering over the existing tally.
   Broadcast asset, no new trust surface.
3. **The watcher.** Extend `feePollerBackground` to poll the roster and write
   `streamerAvailability`. Ships dark — no UI, just data accruing, which also
   gives us the availability history the seeding formula needs.
4. **The Draft, one hour a day.** Exactly §11.8's own advice: prove the loop on a
   single nightly hour before it touches the schedule. Measure whether the vote
   actually moves and whether drafted streamers show up.
5. **Age multiplier at settle.** Add `heldSince` resolution to `settleVotes`.
   Wants the most care of anything here — it's the piece that decides outcomes.
6. **The Draft on all eight open blocks**, only once 4 has a month of data.

---

## 6. What to be honest about

Three things we should say out loud rather than have someone find:

**Age can be bought, by buying an old wallet.** OTC purchase of an aged position
is a real path around the multiplier. It's expensive and it pays another holder,
which is the outcome we'd choose anyway — but it's not "unbuyable," and we
shouldn't say it is.

**Turnout will be low at first, and that's fine.** Early votes will settle with a
handful of wallets and a large share concentrated in few hands. Publishing
turnout honestly from day one is what makes the number credible later. A quorum
rule that we actually enforce — including saying "this didn't reach quorum, it's
advisory" on air — is worth more than any number we could report.

**The Draft has to survive its first boring day.** The failure mode isn't a
whale; it's a Tuesday at 6 AM with two candidates and nine votes. The rules in
§3.4 exist so that day still produces a filled hour and a working channel. If the
mechanic only looks good on a busy night, it isn't a mechanic — it's a demo.
