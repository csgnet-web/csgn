# How hard is CSGN to start, and who actually posts?

An honest read on two questions: what it costs a stranger to get going, and what
share of content producers who land on /studio will actually put a video up.

Written after the changes in this branch. Where a number is a guess it is
labelled a guess, and the reasoning is shown so you can disagree with it.

---

## 1. The three doors, and what each one costs

There are now three ways to matter on CSGN, and they cost wildly different
amounts of effort. That is deliberate — but only one of them was ever measured
honestly.

| Path | What it costs | Who it is for |
|---|---|---|
| **Post a clip** | Sign in, paste a link, wait for review | Anyone with an existing post |
| **Be forwarded live** | Connect Twitch, tick one box, then nothing | Streamers who already stream |
| **Reserve a block** | All of the above, plus be live at a specific time | People who want a guaranteed slot |

The middle row is new in this branch and it is the important one. Before it, a
streamer's only route was the bottom row — which asked them to think like a
programmer scheduling a channel, in exchange for a share of fees they could not
size in advance. That is a bad trade offered to a busy person, and the empty
schedule was the product telling us so.

### Step count, honestly

**Post a clip** — from cold visitor to submitted:

1. Tap Post in the tab bar
2. Sign in (wallet signature — see §3)
3. Paste a link
4. Tap Add

Four steps, one of which is a wallet signature. **Then a wait for review**, which
is not a step but is the part people feel.

**Be forwarded** — from cold to earning:

1. Tap You
2. Sign in
3. Connect Twitch (OAuth round trip)
4. Tick the forwarding box
5. Stream, whenever, as normal

Five steps, and the fifth is something they were doing anyway. That last property
is the whole design: no other step is ever required again.

---

## 2. What was actually broken, and what it cost

Four things in this branch were not "rough edges". They were the feature not
working, silently, in a way nobody could report because nothing said an error had
happened.

| Broken | Who it silently failed | Now |
|---|---|---|
| No `linkPhantom` function existed | **Every** social sign-up. Balance permanently 0, airtime permanently 0 | Wallet linkable from Studio |
| CSP blocked TikTok + Instagram iframes | 2 of the 3 advertised platforms — approved clips aired as a blank box | All three air |
| `vm.tiktok.com` links rejected | The default way a phone shares a TikTok | Resolved server-side |
| Meme 100 needed poller **and** deployed rules | Everyone, and it looked like an empty board | Served by its own function |

The pattern across all four is the same and worth naming: **an empty state that
is indistinguishable from a failure.** "0 seconds", "the board is building", a
blank video frame. Each of these was a real outage wearing the costume of a
normal, quiet product. That is the most expensive class of bug there is, because
nobody files it — they just conclude the thing does not work and leave.

Every one of them now says which kind of empty it is.

---

## 3. The honest friction: the wallet

With Google, X and email switched off until the console setup is done, **the only
working door is a Phantom wallet.** That has to be stated plainly because it is,
right now, the single largest constraint on everything below.

What it costs a person who does not have one: install a browser extension or an
app, write down a seed phrase, and understand what signing a message means.
Realistically **five to fifteen minutes and a real trust decision** — not four
steps.

What it costs a crypto-native: about twenty seconds.

So the current funnel is not "easy to onboard". It is *easy to onboard someone who
already holds tokens*, which is a much smaller population and one that overlaps
poorly with "people with a good TikTok". The conversion numbers in §4 are given
for both states because the difference between them is the largest single number
in this document.

**This is the highest-value thing on the list and it is not a code change.** It is
an afternoon in the Google Cloud and X developer consoles, following
`docs/auth-provider-setup.md`, and flipping `SOCIAL_AUTH_ENABLED` to `true`.

---

## 4. Producer conversion: what share actually posts?

The question is: of people who reach /studio signed in, what fraction submits at
least one clip?

There is no CSGN data yet, so this is reasoning from comparable funnels, and it
is a **guess with a stated basis** rather than a measurement.

### The comparable

The closest analogue is not TikTok sign-up (where posting is the entire point of
the app). It is a **cross-posting or syndication tool** — somebody who already has
content deciding whether to point it somewhere new. Historical funnels for that
shape land roughly at:

- 40–60% of people who reach the composer submit something, *when the content
  already exists elsewhere and the action is a paste*
- 10–20% *when it requires producing anything new*

CSGN is firmly in the first category by design. Pasting a link is the whole ask.

### The adjustments, up and down

| Factor | Direction | Size |
|---|---|---|
| The content already exists — paste, don't produce | ↑ | Large |
| Review queue: nothing airs immediately | ↓ | Moderate |
| No wallet → no airtime, so a poster with no bag gets nothing | ↓ | **Large** |
| Wallet-only sign-in (current state) | ↓ | **Large** |
| Genuine novelty: "on television" is not another feed | ↑ | Moderate |

### The estimate

| State | Signed-in → posts a clip | Basis |
|---|---|---|
| **Today** (wallet-only sign-in) | **45–60%** | The population that got through a wallet install is heavily self-selected — they are already committed. High rate, tiny denominator. |
| **With social sign-in on** | **25–35%** | Bigger, much colder top of funnel. Lower rate, far more people. |

**The second row is worth several times the first in absolute posts**, and that is
the argument for prioritising the auth setup over anything else in this document.

### The number nobody likes

Of members who post a clip, the share who get **zero airtime because they hold no
$CSGN** could easily be **half or more** at launch. The product is honest about
this now — the Studio says which zero it is and links to /participate — but it is
still a person doing the work of posting and getting nothing on air.

This is a deliberate design decision (airtime is what the token buys) and it is
defensible. It is also the single biggest reason a producer will post once and
never return. Worth watching as a real metric: *posted a clip, allocated zero
seconds, never came back*.

---

## 5. Streamer conversion, under the new model

The old question was "will a Twitch streamer claim a two-hour block?" — and the
honest answer was **very few**, because it asks a busy person to schedule around
an unproven channel for an unsized payout.

The new question is much easier: **"will a Twitch streamer tick a box that might
put them in front of a new audience, and cost them nothing?"**

That is a different order of ask. It has no ongoing cost, no scheduling, no
software, and no downside they can name. The realistic barriers are only:

1. **Do they trust us to re-broadcast them?** Real, and the reason the grant is a
   separate, versioned, withdrawable flag rather than something implied by a
   connect button.
2. **Is there an audience on the other side?** Currently the honest answer is
   "small", and no amount of product design fixes that. This is a chicken-and-egg
   problem that gets solved by the first few real streamers, not by us.

Estimate: of streamers who reach /account and connect Twitch at all, **70–85%
will grant forwarding**, because it is close to free. The hard number is not this
one — it is how many streamers reach /account in the first place, which is a
distribution problem, not a product one.

---

## 6. What I would fix next, in order

1. **Finish the auth setup.** Everything in §4 roughly doubles in absolute terms.
   It is console work, not code, and the switch is one boolean.
2. **Cut the review wait, or make it visible.** "Pending" with no ETA is where a
   first-time poster's enthusiasm goes to die. Even "usually within a few hours"
   would help; an approval push notification would help more.
3. **Give a zero-balance poster *something*.** Not airtime — that would break the
   token's only job — but their clip in a public "submitted" gallery, or a single
   free airing on their first clip. Right now the honest answer to "I posted and
   got nothing" is "buy tokens", and that is a very short conversation.
4. **Measure the four zeroes.** `myClips` now returns a `reason` for every zero
   allocation. Counting them by kind, weekly, tells you exactly which of these
   arguments is real and which I have guessed wrong.

---

*Estimates in §4 and §5 are reasoned guesses from comparable funnels, not
measurements. The instrumentation to replace them with real numbers now exists —
see item 4.*
