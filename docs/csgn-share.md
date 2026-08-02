# CSGN Share — a Nielsen ratings book for streaming

> **Status: design.** The measurement layer. It answers "how are we actually
> doing" in a currency that means something, and it feeds three other systems:
> Draft seeding ([`token-voting.md`](token-voting.md) §3.3), slot pricing, and
> the entire "be the scoreboard" growth strategy ([`master-plan.md`](master-plan.md) §7.1).

---

## 1. Why "30 share" is the right instinct

In network television there are two numbers, and almost everyone outside the
business confuses them.

**RATING** is your share of *everyone*. In 1980, 84 million US homes had a TV;
a show watched in 25 million of them did a **30 rating**.

**SHARE** is your share of *everyone currently watching anything*. If 60 million
homes had the set on at that hour and 25 million were on you, that's a **42
share** — 42% of all viewing, at that moment, was you.

Share is the better number, and the reason is the thing that makes it perfect for
CSGN specifically:

> **Share removes time of day from the equation.**

A rating punishes you for airing at 4 AM — there's nobody up, so your rating is
microscopic no matter how good you are. A share asks a different question: *of
the people who ARE up, how many chose you?* Suddenly 4 AM is winnable. A 40 share
at 4 AM is a genuine achievement and it reads like one.

**CSGN broadcasts 24 hours a day and always will.** Two-thirds of that airtime
happens when a rating would call it worthless. Share is the only metric under
which our dead hours are worth competing for — and once they're worth competing
for, they're worth claiming, worth drafting for, and worth selling.

That is not a reporting decision. It's the metric that makes the back half of the
schedule a business.

---

## 2. The definitions

### 2.1 The competitive set — our "universe"

Nielsen has a panel. We have public APIs, which is better in one way (it's a
census of the tracked set, not a sample) and worse in another (we have to decide
what's in it, in public, and defend it).

**The CSGN Set** is a published list of ~120 channels: crypto/trading/degen
streamers on Twitch and Kick, plus CSGN itself. Two rules keep it honest:

1. **It's published.** Every channel in the set, listed, with the date it was
   added. A ratings book with a secret denominator is a press release.
2. **It changes on a schedule, not on a whim.** Additions and removals happen at
   the monthly Book (§5), never mid-period, and never in response to a bad week.

Inclusion criteria: primarily crypto/trading content, English-language, and a
28-day average concurrent viewership above a stated floor. Boring, mechanical,
arguable at the edges — which is exactly what a denominator should be.

### 2.2 The numbers

Let **CCV(c, m)** be concurrent viewers of channel *c* at minute *m*.

```
CUS(m)   = Σ CCV(c, m) for all c in the CSGN Set
           "Crypto Users Streaming" — our HUT-equivalent. Everyone watching
           anything in the category, right now.

Share    = CCV(csgn, m) / CUS(m) × 100
           Our share of category viewing. THE headline number.

Rating   = CCV(csgn, m) / Universe × 100
           Universe = the 28-day peak of CUS. Fixed for the period, so the
           rating is comparable across days the way a real rating is.

AMA      = mean CCV(csgn, m) over a window
           Average Minute Audience. The actual currency of TV advertising —
           what an advertiser buys is the average minute, not the peak.

Cume     = unduplicated viewers over a window
           Reach. From our own analytics for CSGN; NOT computable for other
           channels from public data, so it's reported for us only.

TSV      = Time Spent Viewing = (AMA × minutes) / Cume
           Average minutes per viewer. The retention number.
```

**Share and rating both get reported, always together.** They tell different
stories and quoting one without the other is how ratings get used to lie: a
40 share on a 0.6 rating means we won a very small room.

### 2.3 Dayparts — and the happy accident

Real networks report by daypart, not by hour, because that's how audiences
actually behave and how inventory is actually sold. Ours, in ET:

| Daypart | Hours ET | Character |
|---|---|---|
| **Overnight** | 3 AM – 7 AM | Asia hours. Tiny CUS, high win-rate. Where share is cheap and real |
| **Early** | 7 AM – 11 AM | EU close, US pre-market |
| **Daytime** | 11 AM – 3 PM | US market hours |
| **Fringe** | 3 PM – 7 PM | Post-close, audience rebuilding |
| **PRIME** | 7 PM – 11 PM | Peak CUS. The most contested hours in the category |
| **Late** | 11 PM – 3 AM | Second peak. Degen hours |

Note what fell out of this: **the 7 PM – 3 AM ET network block is exactly Prime +
Late.** The CSGN Originals block already occupies the two dayparts where the
audience is biggest and the competition is hardest — which is the correct
programming instinct, arrived at before anyone measured it. The eight open blocks
that the Draft covers are Overnight through Fringe: lower CUS, higher winnable
share, and therefore a genuinely attractive proposition to a smaller streamer.
**"Come win a daypart"** is a better recruiting pitch than "come claim an hour."

### 2.4 The mainland-US question — the honest answer

You asked for relative performance on the mainland US, and here is the part I
won't fudge: **Twitch and Kick do not expose per-stream viewer geography.** There
is no public API that will tell you what share of another channel's concurrents
are in the United States. Anyone who tells you they can compute a true US-only
share for a competitor from public data is estimating and calling it measurement.

What we can do, in descending order of rigour:

**1. Real US data for CSGN itself.** Our own site analytics, our X broadcast
insights, and our Discord all report geography for *our* audience. So **CSGN's US
composition is measured, not modelled.** Report it as its own number:
*"68% of CSGN's audience is US."*

**2. Daypart as a geography proxy for the set.** This is the honest workaround
and it's what makes the whole thing defensible. ET dayparts *are* a US filter:
7 PM–11 PM ET is US prime and essentially nothing else's prime. A channel drawing
heavily at 8 PM ET is drawing Americans, whatever its passport. So we report
**US Prime Share** — share measured only in the 7 PM – 11 PM ET window — and
label it exactly that. It is a defensible statement about the American audience
without a single fabricated geo number.

**3. Language and schedule flags on set members.** Channels are tagged EN/US-
scheduled vs. EN/non-US-scheduled from their published stream times. Used to
produce a secondary **US-Weighted Share**, always reported *alongside* the raw
share and clearly marked as modelled. Never as the headline.

> **The rule: the headline is measured, the model is a footnote, and the footnote
> says it's a model.** A ratings book's only asset is that people believe it. We
> get exactly one chance to establish that ours is the one you can check.

---

## 3. Where the data comes from

The good news: this is nearly free, because the machinery exists.

**Twitch Helix `/streams` takes up to 100 `user_login` values per request.** A
120-channel set is **two API calls per minute**. `feePollerBackground` already
runs every minute and already calls Helix (v1.3's `logSlotActivity`), with the
app token flow already written. Kick has a public channel endpoint; the same
pattern applies.

Per minute:

```
1. Poll the set → CCV for every channel        (2 Helix calls + Kick)
2. Write ratings/minutes/{ISO-minute}          (one doc, whole set)
3. Roll into ratings/dayparts/{date}/{daypart} (incremental AMA + share)
```

One document per minute is 1,440 writes/day — trivial. Minute docs get a 90-day
`expiresAt` (the TTL pattern the repo already uses everywhere); daypart and daily
rollups are kept forever, because a ratings book with no history is worthless.

**A note on `viewer_count` honesty.** Helix concurrents include embeds, autoplay,
and idle tabs. This is true for every channel in the set equally, which is
precisely why *share* is the right currency and raw concurrents aren't: the
inflation is in both the numerator and the denominator and largely divides out.
Say this in the methodology page rather than waiting to be accused of it.

---

## 4. Per-slot ratings — where this becomes a business

Every slot gets a card, because this is how a network sells inventory:

```
┌──────────────────────────────────────────────┐
│  1:00 PM – 3:00 PM ET · @streamername        │
│                                              │
│  AMA          412 concurrent                 │
│  SHARE        23.1        ▲ 4.2 vs 4-wk avg  │
│  RATING       1.8                            │
│  TSV          19 min                         │
│  LEAD-IN      +31%   retained from prior hour│
│  LEAD-OUT     -12%   handed to next hour     │
└──────────────────────────────────────────────┘
```

Four uses, in order of how soon they pay:

**Draft seeding.** 40% of a streamer's `draftRating` is their recent normalized
share. The ratings book decides who gets nominated — same as a real network.

**Slot pricing.** Once dayparts have four weeks of share data, an hour has a
demonstrable audience, and an hour with a demonstrable audience has a price. This
is the mechanism by which §10's business model stops being a rate card and starts
being a rate card *backed by numbers*.

**Programming decisions.** Lead-in and lead-out retention are the classic network
scheduling tools and they tell you things nothing else will: which show is
actually carrying its neighbour, and which slot is bleeding an audience someone
else built. That's how you decide what to move, not vibes.

**Creator status.** A streamer can point at "I did a 23 share in Daytime" — a
number that exists nowhere else in crypto streaming, that we issued, and that
they'll quote. **Every time they quote it, they cite us.** That is the scoreboard
strategy (§7.1) working exactly as intended.

---

## 5. The Book, and the Sweeps

Ratings are content. Publish them like content.

**THE BOOK** — monthly. Every channel in the set, ranked by AMA and share, by
daypart. Published on the site, posted as a graphic, read out on air. Nobody else
in crypto streaming publishes anything like it, and the day a competitor screenshots
their own row to brag, we have become the industry's record-keeper.

**SWEEPS** — four weeks a year (Feb, May, Jul, Nov, same as broadcast). The Book
is the ratings basis for the following quarter's slot pricing, so everyone has a
reason to bring their best content to a known window. Real networks have run on
this exact incentive for fifty years and it works: **sweeps manufacture event
programming.** Announce the dates a quarter ahead and watch the schedule improve
by itself.

**THE OVERNIGHT** — a daily post, ~9 AM ET, with yesterday's Prime share. One
graphic, one number, every day, forever. This is the highest-consistency content
object available to us: it requires no guest, no idea, and no founder, and it
compounds into an archive.

---

## 6. The broadcast graphic

Share belongs on air, where it does double duty as a metric and as a signal that
this is a real network:

```
        ┌───────────────────────────────┐
        │  CSGN  ·  DAYTIME             │
        │                               │
        │      SHARE      27.4          │
        │      RATING      2.1          │
        │      AMA         512          │
        │                               │
        │   ▲ 3.8 vs. 4-week average    │
        └───────────────────────────────┘
```

Bottom-right, on the quarter-hour, ten seconds. It reads as a network confidently
showing its homework — the same instinct behind a stock ticker or a scorebug.
It's also the cheapest possible proof that the numbers exist and are being kept.

Implementation is the pattern already in `docs/broadcast-graphics.md`: a Firestore
doc the OBS overlay polls, exactly like `config/ticker`.

---

## 7. Build order

1. **The set, published.** A JSON list and a methodology page. No code. Do this
   first because it's the part that has to be defensible, and writing it down is
   how you find out whether it is.
2. **The minute poller.** Extend `feePollerBackground` to sample the set and write
   `ratings/minutes/*`. Ships dark. **Every day you delay this is a day of history
   you can never get back** — start collecting before anything consumes it.
3. **Daypart rollups + the internal dashboard.** Look at four weeks before
   publishing anything.
4. **The Overnight post.** Daily, automated, one graphic.
5. **Per-slot cards** in `/account` and the admin panel.
6. **The Book**, once there are two months of history to make it credible.
7. **The on-air bug** and Draft seeding, last — both consume the metric, so both
   want it stable first.

---

## 8. What to be honest about

**Concurrents are not people.** They're sessions, inflated by embeds and idle
tabs, on every channel in the set. Share divides most of that out; raw AMA does
not. Publish the methodology and this is a strength — we're the only ones who
explained it.

**We chose the denominator.** Any set we publish is a set we picked, and someone
will eventually claim we picked it to flatter ourselves. The defence is procedural
and has to be in place *before* the accusation: published criteria, published
membership, changes only at the Book, and never a removal in a month where it
would help us.

**Our own numbers will be small at first.** A 3 share is a 3 share. Publishing it
honestly for six months is the only thing that gives the 30 share credibility when
it arrives — and a ratings book that only started reporting once the numbers got
good is a ratings book nobody will believe.
