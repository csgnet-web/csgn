# Where the Netlify bill was going, and what it is now

You said credits were burning. They were, and almost all of it was one loop.

---

## The headline

| | Before | After |
|---|---|---|
| Scheduled runs per day | 1,440 | **~500** (idle-aware) |
| Billed wall clock per run | ~30–46s | **~2–4s** |
| **Compute per day** | **~12–18 hours** | **~25–35 minutes** |
| Viewer-driven invocations | 1 per viewer per poll | **1 per 45s, total** |

That is roughly a **95% cut in function compute**, and it comes from three
changes, none of which trades away anything the product needs.

---

## 1. The poller was paying to wait — `~90%` of the bill

`feePollerBackground` ran every minute and did this:

```ts
for (let i = 0; i < 4; i++) {
  const dexData = await fetchDexData()
  ...
  if (i < 3) await sleep(POLL_INTERVAL_MS)   // 15 seconds
}
```

Four DexScreener samples, fifteen seconds apart. **Netlify bills wall clock**,
so every single minute of every single day the project was paying for a
container to sit and do nothing for 45 seconds. 1,440 runs × 45s = **18 hours
of billed compute per day** to produce four readings of a number instead of one.

### Why one sample is enough

Fee accrual is **cumulative and delta-based**, not an average of samples.
`_feeState` on the slot carries the running `tierVolumeMap` and the previous
estimate, so the same total is reached whether it is stepped once a minute or
four times. The only thing lost is sub-minute attribution when the market cap
crosses a pump.fun fee tier boundary mid-minute — a fraction of a percent on a
single hour's fee.

> **If finer resolution is ever genuinely wanted, raise the cron rate. Never
> re-add a sleep.** Paying a serverless container to wait is the one cost that
> cannot be optimised after the fact.

### And it was probably being killed anyway

The file is named `feePollerBackground.ts`, but Netlify's background-function
convention requires a **hyphen** (`something-background.ts`). So this was an
ordinary scheduled function with an ordinary execution ceiling — tens of
seconds — and a ~46-second run would have been terminated partway through the
loop.

Which means **everything after the loop very likely never ran**: the
`config/ticker` write, and the on-air *now live* / *up next* auto-fill. Billed
for the full wall clock, then killed before its last writes. If the ticker's
automatic fields have looked stale, this is why.

---

## 2. The channel is cold most of the day — `~65%` of what was left

By design, clips are the source of last resort: unless the operator has put
somebody on air or a roster member is actually live, **nothing on a poll tick
changes**. No fee is accruing, no minute counter is running, no status is
advancing. A full pass every sixty seconds was discovering the same nothing
sixty times an hour.

So the poller now runs on a duty cycle:

| State | Definition | Cadence |
|---|---|---|
| **HOT** | A slot is assigned, **or** anybody on the roster is live | every minute |
| **COLD** | Clip mode, nobody live anywhere | **every 3 minutes** |

The state is written to `config/feePollerRun.cold` at the end of each pass, so
the *next* tick can decide to skip before doing any billable work at all.

Three properties keep this safe:

1. **Unknown means hot.** A missing or corrupt flag runs the full pass. A wrong
   guess costs an invocation, never a minute of fee accrual.
2. **Every ambiguous lock still runs** — no lock, a garbled date, a
   future-dated one. Cold can never wedge the poller off.
3. **The operator short-circuits it.** `adminLiveNow` writes `cold: false` the
   moment it puts somebody on air, so the poller is hot again on the very next
   tick rather than up to three minutes later.

The only cost is up to three minutes of lag on noticing that a streamer went
live — and the operator is not cutting to them inside sixty seconds anyway.

Pinned by tests in `netlify/functions/__tests__/feePoller.test.ts`.

---

## 3. Public reads now come from the edge

Several endpoints answer the **same question for everybody** and were being
invoked once per viewer per poll. Two hundred people with `/watch` open was two
hundred invocations a minute for one identical JSON body.

`memo()` in `_shared/cache.ts` already stopped that becoming Firestore reads,
but a memo hit is still a container being started and billed. Now these carry
edge-cache headers, so the request does not reach a container at all:

| Endpoint | Browser | Edge | Stale-while-revalidate |
|---|---|---|---|
| `publicRoster` | 20s | 45s | 120s |
| `memeBoard` | 30s | 120s | 600s |
| `lookupCoin` | 15s | 60s | 300s |
| `publicProfiles` (single) | 60s | — | — |

Two headers, doing different jobs: `Cache-Control` is what the viewer's browser
may keep; `Netlify-CDN-Cache-Control` is what the edge may keep and for how long
it may keep serving a stale copy while refreshing in the background. The second
is what actually collapses the invocation count.

**`cachedJson()` must never be used for anything that varies by caller** —
a balance, a member's own reel, an admin queue. Caching one member's answer and
serving it to the next is not a performance bug, it is a data leak. That is why
it is a separate named helper rather than a flag on `json()`, and why
`memeBoard?force=1`, `health` and the recommended-profiles rail are explicitly
`no-store`.

---

## What was deliberately NOT changed

- **The one-minute cron while hot.** Verified airtime divides by samples taken,
  and slowing the sampler during an hour that decides money would change what
  people are paid. The duty cycle only slows the cold path.
- **Firestore listeners on the client.** Those are a Firebase cost, not a
  Netlify one, and they are what keep `/watch` and `/player` live without
  polling a function at all.
- **The self-throttles inside the pass.** `refreshMemeBoard` (5 min),
  `refreshAirtimeSchedule` (10 min), `settleMemeVote` (30 min) and
  `topUpSchedule` (15 min) already skip their own work; they cost one cheap
  read each on a tick that does nothing.

---

## If the bill is still high after this

Check in this order:

1. **Netlify dashboard → Functions → invocations by function.** If anything
   other than `feePollerBackground` is in the top three, something is polling
   it from the client. Find the `setInterval`.
2. **Build minutes.** Every push to a deploy branch is a build. If you are
   pushing many small commits, that is real money and it is not runtime.
3. **Bandwidth.** The largest asset shipped is the firebase vendor chunk
   (~355 kB / 110 kB gzipped). It is cached hard by the CDN; if bandwidth is
   the line item, look at `/player` being open in OBS 24/7 re-fetching.
4. **`feePollerBackground` runtime.** If a run creeps back over a few seconds,
   something new in the pass is doing network I/O per member. The roster
   sampler is the one to watch as the roster grows — it is one Helix request
   per hundred members, so it stays cheap, but a per-member call would not.
