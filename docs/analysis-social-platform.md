# What CSGN needs to become an addictive social platform

An honest read on the gap between what's built and what a social product
actually is. Written after this branch.

---

## The finding, stated first

**CSGN is a broadcast product with a token attached. It is not a social platform,
and no amount of polish on the current surfaces will make it one.**

That is not a criticism of what's built — the broadcast product is now good. It's
a statement about what's *missing*, and the missing thing is specific and
buildable: **there is no way for one member to see another member.**

You cannot look at somebody's reel. You cannot see what aired last night or who
posted it. You cannot follow anyone. Every screen shows either the channel or
your own things. For something calling itself a network, there is no network in
the interface at all.

---

## What actually makes a social product addictive

Not notifications, not streaks, not badges. Those are amplifiers bolted onto a
loop that already works. The loop itself is always the same three beats:

1. **I made something.**
2. **It was seen.**
3. **I found out it was seen.**

Every durable social product is that. TikTok's view count, Instagram's likes,
Strava's kudos, GitHub's stars — all the same loop, different noun.

Here is where CSGN sits today:

| Beat | Status |
|---|---|
| I made something | ✅ Paste a link. Genuinely frictionless. |
| It was seen | ✅ It airs on a real channel. **Stronger than any competitor's version of this.** |
| I found out it was seen | ❌ **Nothing. Silence.** |

**The third beat does not exist.** A member's clip goes out on television — the
most emotionally valuable thing this product can produce — and the app says
nothing at all. No notification, no record, no number, no moment.

That is the entire gap. Beats one and two are built and beat two is *better than
the alternatives*, which is a rare position. Beat three is a few days of work and
it is worth more than everything else on any roadmap.

---

## The five things to build, in order

### 1. The "you were on" moment — *days, and worth more than the rest combined*

When a clip finishes airing:

- A record on the Studio: **"@you aired at 4:12 PM · 34 seconds · during CSGN Originals"**
- A running lifetime total: **"You've been on CSGN 14 times"**
- A share card, generated, with the poster frame, their handle, the time, the
  CSGN mark

The share card is the growth mechanism and the emotional payoff at once. "I was
on TV" is a genuinely rare thing for somebody to be able to post, and it carries
its own explanation of what CSGN is to everyone who sees it.

Right now this data already exists — the schedule knows exactly when every clip
aired. Nothing is being *computed*; it's being thrown away.

### 2. Member profiles that are actually channels — *a week*

`/u/:username` exists and shows nearly nothing. It should be:

- Their reel, playable
- What they've aired, with times
- Their on-air look, as their page's identity — the colour they picked *is* their
  brand
- Total time on air, as a hero number
- A follow button

The on-air look is the sleeper here. Members already choose a colour, a shape and
an entrance. That's an identity system nobody is currently allowed to see.

### 3. Follows, and a reason to have them — *a week*

Following someone should mean: **you get told when they're about to air.** Not a
feed — a channel doesn't have feeds — but an alert. "@handle is on in 4 minutes"
is a notification people open, because it expires.

This is the one notification the product can send that is genuinely useful rather
than an interruption, and it exists because CSGN is a *schedule*. That's an
advantage a feed-based product structurally cannot have.

### 4. Make airtime feel like something — *days*

"4 min 12 sec" is a number. Translate it:

- **"That's about 9 clips a day"** — divide by their average clip length
- **"You're 31st of 118 holders by airtime"** — a leaderboard of a thing people
  already own
- **"Nobody has aired more this week than @handle"**

An airtime leaderboard is the most natural competitive surface this product has
and it does not exist.

### 5. Reactions on the live channel — *a week*

While something is on air, let signed-in viewers hit one button. Count it. Show
the count on the broadcast HUD. Tell the member afterwards: **"1,204 reactions
while you were on."**

This closes beat three for *live* the way item 1 closes it for clips, and it
makes the channel two-way for the first time.

---

## What NOT to build

**A feed.** The single most tempting wrong move. CSGN's whole differentiation is
that there is one channel and one thing on it. A feed makes it a worse TikTok
with a smaller library, competing on the axis where it is weakest.

**Comments under clips.** Moderation cost with no loop benefit at this size. The
reaction button gets you the signal without the liability.

**Streaks or daily check-ins.** Manufactured engagement on a product that does
not yet have the real kind. Build the real loop first; if it works, it does not
need a streak, and if it does not work, a streak will not save it.

---

## The honest risk, restated

Clip posting is the viral action — free, one paste, and it has a natural "look,
I'm on TV" share moment. But **airtime requires holding $CSGN**, so a first-time
poster who holds nothing does the work and sees nothing air.

Viral loops do not survive a purchase in the middle.

I am not arguing to remove the gate — it is why the token is worth anything. I am
arguing that **something has to happen for a zero-balance poster**, and the
cheapest honest version is:

> **One free airing on your first clip, ever.**

It costs the network a few seconds of air once per member. It gets a new poster
all the way through the loop — made it, seen, told about it — before they are
asked for anything. And the "you were on" share card they get at the end is the
best recruitment asset this product could possibly have, produced by somebody who
has not spent a cent.

That single change converts the token gate from a wall into an upgrade path.

---

## Where the product genuinely stands

**Beat two is world-class.** "Your clip airs on a real 24-hour channel" is a
stronger claim than anything a feed product can make, and it is built and
working.

**Beat three is missing entirely**, and it is days of work, not months.

**There is no social graph**, and that is the difference between a product people
use and a product people belong to.

The order is not negotiable: build the moment, then the profile, then the follow.
A social graph with nothing to feel is an address book.

---

*Companion documents: `analysis-attracting-users.md` (distribution),
`analysis-conversion.md` (funnel numbers), `design-overview.md` (per-page fixes).*
