# Where the Netlify bill goes, and what holds it down

Credits were burning again: **300 in a week, with no traffic and no deploys.**
That second half is the important part — it means the bill had nothing to do
with visitors, and everything to do with a cron job talking to itself.

---

## The headline

| | Before | After |
|---|---|---|
| Cron period | every minute | **every 2 minutes** |
| Scheduled invocations / month | 43,200 | **21,600** |
| Passes that do real work while idle | every 1–3 min | **every 10 min** |
| Firestore reads per pass, 200-member roster | ~200 | **1 + one per live member** |
| Idle tick cost | a full pass | **one document read, then return** |
| **Poller credits / month** | **~1,200** | **~120** |

Roughly a **90% cut**, and the part that matters for "no traffic": an empty
channel now costs about **60 credits a month**, against a 1,000-credit
allowance. The rest of the budget is free for deploys and actual visitors.

Estimated, not measured — the real figure depends on how many hours a day
somebody is actually on the channel. Check it against the dashboard after a
week; the diagnostic order is at the bottom of this page.

---

## The exchange rate, because everything follows from it

Netlify bills function compute at **10 credits per GB-hour**, and a function
gets **1 GB** by default. So:

> ### One credit = six minutes of wall clock.
> ### A 1,000-credit month = 100 hours of function runtime. That is the whole budget.

Two other line items matter and are easy to forget, because neither is runtime:

| Item | Cost | What it means here |
|---|---|---|
| Function compute | 10 credits / GB-hour | 6 minutes of runtime per credit |
| **Production deploy** | **15 credits each** | ~66 deploys = the entire month |
| Bandwidth | 20 credits / GB | The firebase chunk is ~110 kB gzipped |
| CDN requests | 2 credits / 10k | Only matters with real traffic |

**A deploy costs the same whether you changed a compiler or a comma.** Thirty
pushes in a week is 450 credits before a single function runs.

---

## What was actually happening

`schedule = "* * * * *"` is **43,200 invocations a month**. At roughly ten
seconds a pass that is ~120 hours of compute — *over the entire monthly
allowance on a channel with no viewers*. The measured 300 credits/week works
out to about 10.7 seconds per invocation, which is exactly what a pass costs
when it makes twenty-odd sequential network round trips.

### Why the previous fix didn't take

The last pass at this added a duty cycle: a `cold` boolean that let the poller
skip two ticks in three. It barely moved the bill, and the reason is worth
keeping:

```ts
await recordDutyCycle(!active && !roster.some((e) => e.live))
```

**Cold required that nobody on the roster was live anywhere on Twitch.** On a
network of real streamers somebody is nearly always broadcasting to their own
audience — which costs us nothing and decides nothing — so the flag sat false
essentially forever and the full pass ran every single minute regardless.

> The lesson: *hot* has to mean "we are doing something expensive that matters
> **right now**", not "something is happening somewhere in the world."

---

## What holds it down now

### 1. The cron period — halved, and no further

`*/2 * * * *`. Straight 50% cut in invocations.

It does not go lower, and the reason is not comfort. Verified airtime is scored
on **samples taken**, and `AIRTIME_MIN_SAMPLES = 10` is the floor below which an
hour cannot be judged at all:

| Cron | Samples in a 1-hour slot | Verdict |
|---|---|---|
| 1 min | 60 | Fine, and expensive |
| **2 min** | **30** | **3× the floor. Chosen.** |
| 3 min | 20 | Workable |
| 5 min | 12 | One missed tick from `unverified` |

A slot that falls under the floor settles as `unverified`, which **pays out in
full without evidence**. Slowing the cron past ~3 minutes would quietly convert
a cost decision into a payout decision. Don't.

### 2. Three tiers, and the pass names the minute it is next due

Rather than re-deciding every tick, each pass writes `nextDueAt` to
`config/feePollerRun`. An idle tick reads one document and returns.

| Tier | Meaning | Next pass due |
|---|---|---|
| **HOT** | A slot is on the clock — fees accruing, samples deciding a payout | every tick |
| **WARM** | Nobody on the channel, but a roster member is live and could be cut to | 4 min |
| **COLD** | Clips carrying the air, nothing live anywhere | 10 min |

Four properties keep this from ever costing anyone money:

1. **Unknown means run.** A missing lock, a garbled date, a future-dated one, a
   missing due time — every ambiguous input resolves toward running. A wrong
   guess costs one invocation; the other direction costs a streamer their fee
   accrual, silently.
2. **An assigned hour is never slept through.** `nextDueAtMs` caps the due time
   at the next slot's start, so an idle channel wakes exactly when the schedule
   says something begins rather than up to ten minutes late.
3. **The operator short-circuits it.** `adminLiveNow` marks the poller due *now*
   the moment it puts somebody on air.
4. **An overlap guard still collapses duplicates** — 30 seconds, far below the
   cron period so it can never turn away a real scheduled run.

### 3. The roster sampler stopped scaling with the roster

It issued **one Firestore read per consenting member, every pass**, to read
counters it was about to leave untouched for everyone offline. Two hundred
members with three live was two hundred round trips to increment three numbers —
so the cost of a pass grew with the size of the network while the work stayed
the same.

Offline members' counters cannot have changed (this module is the only writer of
`liveMinutes/{uid}`), so they are carried forward from the published roster and
only live members get an authoritative read. **One round trip plus one per live
member.**

### 4. The pass overlaps its I/O

It is almost entirely network round trips, and Netlify bills the wall clock they
take. Independent reads now run in one `Promise.all` instead of in series, and
the self-throttling housekeeping runs underneath the rest of the pass.

### 5. Documentation pushes no longer deploy

`build.ignore` in `netlify.toml` skips the build when every changed file is
Markdown. The published site would be byte-for-byte identical, and the deploy
costs 15 credits either way.

---

## ⚠️ The trap this change had to step around

`refreshLiveRoster` credited minutes like this:

```ts
const liveMinutes = running.liveMinutes + (sample.live ? 1 : 0)
```

That `+ 1` silently encoded **"the poller runs once a minute"** into every
member's minute counter — the denominator that splits payouts. Nothing said so
and nothing checked it.

Changing the cron to `*/2` without touching this would have under-credited
**every streamer on the network by exactly half**, indefinitely, and not with an
error — with smaller numbers that looked entirely plausible.

So the counter now credits the **measured gap** since the last observation
(`creditMinutes`), clamped to `MAX_SAMPLE_CREDIT_MIN`. Six passes at one minute
and three passes at two minutes both pay six minutes. That property is what
makes the cron period a **cost** decision instead of a **payout** decision, and
it is pinned by tests in `__tests__/feePoller.test.ts`.

> If you change the cron period, check `MAX_SAMPLE_CREDIT_MIN` and
> `AIRTIME_MIN_SAMPLES`. Those two constants are the only things standing
> between a cost tweak and a payout bug.

---

## What was deliberately NOT changed

- **Sampling rate during an assigned hour.** Hot runs every tick. An hour that
  decides money is not where savings come from.
- **Firestore listeners on the client.** A Firebase cost, not a Netlify one, and
  they are what keep `/watch` and `/player` live without polling a function.
- **Edge caching on public endpoints.** `publicRoster`, `memeBoard`,
  `lookupCoin` already answer from the CDN; `cachedJson()` must never be used
  for anything that varies by caller.

## What this trades away

- Up to **10 minutes** to notice a roster member going live during a cold
  stretch (was 3). The operator's board rebuilds on demand, so a human looking
  at it never sees stale data — `ROSTER_STALE_MS` was widened to 14 minutes to
  match the new idle cadence.
- `public/tokenStats` and the ticker refresh every 10 minutes while idle rather
  than every minute.

Both are invisible on a channel nobody is watching, which is precisely when they
apply.

---

## If the bill is still high

1. **Netlify dashboard → Functions → invocations by function.** Anything other
   than `feePollerBackground` in the top three means something is polling it
   from the client. Find the `setInterval`.
2. **Deploy count.** 15 credits each, and it is not runtime — it will not show
   up anywhere in the functions view.
3. **`feePollerBackground` duration.** If a pass creeps past a few seconds,
   something new in it is doing per-member network I/O.
4. **Bandwidth.** `/player` open in OBS 24/7 re-fetching is the one to check.
