# How likely is CSGN to attract users, and what actually moves that?

An honest read. Written after this branch's fixes, which changed the answer
materially — several of the things that would have capped growth were not
strategy problems, they were outages nobody could see.

---

## The short version

**The product is now sound. The distribution is unproven and unstarted.**

That is a much better position than the reverse, and it is worth naming, because
for most of this project's life the opposite was true: there was a real
distribution idea and a product where clip upload returned a 500, voting was
impossible, the token showed as zero, and two of three video platforms could not
air. You cannot grow through that. You can grow through "nobody has heard of us".

---

## 1. What was actually broken, and what it was costing

Every one of these was silent. None of them threw a visible error, and each
looked exactly like the product simply being unimpressive.

| Failure | What a user experienced | Duration |
|---|---|---|
| Missing Firestore index | /studio errored on load; clips never reached review; airtime read 0 | Since clips shipped |
| No `linkPhantom` function | Every social sign-up had a permanent zero balance | Since social auth shipped |
| CSP blocked TikTok/Instagram | Approved clips aired as a blank rectangle | Since clips shipped |
| Vote sent a ticker, server wanted a mint | Every Meme 100 vote silently refused | Since voting shipped |
| Meme 100 discovery too narrow | A "Meme 100" with five coins | Since the board shipped |

**The pattern is one thing, and it is the most important lesson in this
document:** an empty state that is indistinguishable from a failure. "0 seconds",
"the board is building", a blank video frame, a vote that just doesn't appear.
Nobody files a bug for those. They conclude the product is thin and leave, and
you get no signal at all — not even a complaint.

Everything above now either works or says which kind of empty it is. That is the
single biggest change to the growth outlook in this branch, and it is worth more
than any campaign.

---

## 2. The three audiences, honestly rated

### Holders — **strong fit**

The pitch is concrete and checkable: hold $CSGN, get a proportional share of the
channel's airtime, 1:1, verifiable against the chain. There is no equivalent
elsewhere. Crucially it is now *visible* — the Studio shows the number, the
balance behind it, and the share of supply, whether or not anything is approved.

**Odds of converting a holder who reaches /studio: high.** The reason to hold is
legible in one screen.

### Clip posters — **good fit, one real problem**

Pasting a link is close to zero friction, and "get on television" is a genuinely
novel offer in a market where everything else is another feed.

The problem is unchanged and structural: **a poster with no $CSGN gets no
airtime.** They do the work and see nothing air. This is a deliberate design
decision — airtime is what the token buys — and it is defensible, but it means
the free-est action in the product has a paywall behind it that the user
discovers *after* doing the work.

This is the number-one thing to watch. It is now measurable: `myClips` returns a
typed reason for every zero allocation, so "posted a clip, allocated zero, never
returned" is countable rather than guessed.

### Streamers — **transformed by this branch, still distribution-limited**

The old ask was: pick a two-hour block, come back to the site, claim it,
remember to be live. That is a bad trade offered to a busy person, and the empty
schedule was the product saying so.

The new ask is: connect Twitch once, tick a box, carry on. No schedule, no
software, no ongoing cost. That is close to the lowest-friction ask in the
category.

**Odds a streamer who reaches /account grants forwarding: high (70–85%).** It
costs them nothing.

**Odds a streamer reaches /account at all: currently near zero**, because nobody
is telling them to. That is the whole game now, and it is not a product problem.

---

## 3. The two things capping growth right now

### 3.1 A wallet is still the only door

Google, X and email are greyed out pending console setup. So the funnel is not
"easy to onboard" — it is *"easy to onboard someone who already has Phantom
installed"*, which is a small and specific population that overlaps poorly with
"people with a good TikTok".

**This is console work, not code, and it is one boolean.** Follow
`docs/auth-provider-setup.md`, flip `SOCIAL_AUTH_ENABLED`. It roughly doubles
absolute conversions by widening the top of the funnel dramatically, even at a
lower rate.

It is the highest-value item outstanding, and it has been for two branches.

### 3.2 Chicken and egg on the live side

A streamer's honest question is "will anyone see me?" Right now the honest
answer is "a small number". No product design fixes that; the first few real
streamers fix it.

The escape is that **the clip reel keeps the channel alive while that resolves.**
A 24-hour channel that always has something on it can be linked, embedded and
shared. A channel that is offline 90% of the time cannot. The reel is not a
placeholder for the live product — it is what makes the live product recruitable.

---

## 4. What I would actually do, in order

### 1. Finish the auth setup — *console, an afternoon*
Everything downstream roughly doubles. Nothing else on this list competes.

### 2. Get five streamers on, personally — *outreach, a week*
Not a campaign. Five individual conversations with small Solana streamers,
offering: we will put your stream on a 24-hour crypto channel, you do nothing,
you keep your audience, you earn a share of fees for the minutes we carry you.

Five is the number because it is enough for the roster to be non-empty at most
hours, which is what makes the sixth conversation easy.

### 3. Give a zero-balance poster *something* — *product, a few days*
Not airtime — that would break the token's only job. But their clip in a public
"just submitted" gallery, or one free airing on a first clip. Right now the
honest answer to "I posted and got nothing" is "buy tokens", and that is a very
short conversation with somebody who just did you a favour.

### 4. Make the channel embeddable and linkable — *product, a few days*
The strongest growth asset here is that CSGN is **always on**. A permanent link
that always shows something, an embed a project can put on their own site, an
X post that auto-updates with who is on. Every one of those is a distribution
surface the reel makes possible and a normal streamer cannot offer.

### 5. Measure the four zeroes — *instrumentation, already built*
Weekly count of `no_wallet` / `no_balance` / `no_clips` / `no_inventory`. That
tells you which argument in this document is right and which I have guessed
wrong. Do this before believing any of section 2.

---

## 5. The realistic ceiling, and the honest risk

**Ceiling:** this is a genuinely differentiated product. "Your clip on a real
24-hour channel, in proportion to what you hold" does not exist elsewhere, and
the live-forwarding model is a materially better offer to a small streamer than
anything else asking for their time. That is enough to build a real thing on.

**Risk, stated plainly:** the token gates the thing that would otherwise spread
fastest. Clip posting is the viral action — it is free, it is one paste, and it
has a natural "look, I'm on TV" share moment. Requiring $CSGN for airtime puts a
purchase between the action and its payoff, and viral loops do not survive a
purchase in the middle.

That is not an argument to remove the gate — the gate is why the token is worth
anything, and a token worth nothing funds nothing. It is an argument that **item
3 above matters more than it looks.** Something has to happen for a first-time
poster who holds nothing, or the funnel's widest point is also where it leaks.

---

## 6. What I could not verify

- **No live traffic data.** Every conversion estimate in this and
  `analysis-conversion.md` is reasoned from comparable funnels, not measured.
  The instrumentation to replace them now exists.
- **The Meme 100's new algorithm is untested against live data** from this
  sandbox — there is no outbound network here. The weighting is defensible and
  unit-tested against synthetic cases (a small coin having a day now beats a big
  quiet one, which was the reported failure), but the first real board needs
  eyes on it.
- **No mainnet transaction has been run** through the jukebox bid path.

---

*Companion documents: `analysis-conversion.md` (producer funnel numbers),
`analysis-clip-vs-streamer-mode.md` (when the channel runs what),
`auth-provider-setup.md` (the item at the top of section 4).*
