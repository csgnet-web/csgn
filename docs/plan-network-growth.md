# Plan — Verified airtime, an open season, and the raid chain

**This document is the brief for the implementing agent.** Read it start to
finish before writing anything; the "why" lines are load-bearing, and several of
them record a decision that will be re-derived wrongly from first principles.

Read alongside it, in this order: [signup-flow.md](signup-flow.md) (how auth
works now), [plan-twitch-first-claim.md](plan-twitch-first-claim.md) (the
prerequisite, and the settled decisions on payouts),
[product-process.md](product-process.md) §6 (the metrics), and
[marketing-outreach.md](marketing-outreach.md) §1 (what we are never allowed to
claim).

---

## Context

CSGN is a 24/7 crypto streaming network: streamers claim an hour, broadcast to
their own Twitch channel, and take 30% of the $CSGN creator fees generated
during that hour. The build is strong; the distribution is not. Three concrete
problems prompted this work.

**1. The payout does not depend on whether the stream happened.**
`netlify/functions/feePollerBackground.ts` accrues `creatorFees.feeOwedSOL` from
the DexScreener 24h-volume delta across the slot window, regardless of whether
the claimant was broadcasting. The same poller samples Twitch Helix once a
minute and stores `streamActivity.liveCheckCount` — verified live minutes — and
**nothing reads it for the fee**. `CreatorFeesTab.tsx` even *displays* "Live
minutes" next to the amount owed without it affecting that amount. So a streamer
can claim an hour, never go live, and accrue the full fee. Nobody ends up
*owing*; the exposure is CSGN overpaying for dark air. It is also the exact
reason automated payment is unsafe: you cannot auto-pay an amount that does not
depend on whether the work happened.

**2. The wallet requirement is the conversion ceiling.** Claiming demands a
verified Phantom wallet, so most good streamers cannot participate.
`docs/plan-twitch-first-claim.md` fixes this and is a **hard prerequisite** for
everything below.

**3. There is no reason to come back.** A streamer who claims one hour has no
reason to claim a second. At current volume a two-hour slot pays around $12, so
the fee cannot be the reason on its own.

### Decisions already made by the owner — do not reopen

- **Pro-rate the fee by verified live minutes**, with a grace band.
- **Fully open.** Anyone with a verified Twitch claims any open hour. No roster,
  no auditions, no application. The 7pm–3am network block stays the owner's own
  daily content, which is already how `isNetworkSlot` + `networkBlockEnabled`
  work — leave that untouched.
- **Season + standings, plus optional crew mechanics.** Participation must
  **never** be a requirement. The pitch is *"keep your normal Twitch schedule;
  this is an easy additional way to earn."* Someone who streams alone and
  ignores every social feature must lose nothing.
- **Prize pool from both $CSGN treasury and SOL fee revenue.**
- Creator-fee *transfers* stay manual until the pull-based claim contract
  (`docs/plan-twitch-first-claim.md` §5.3–5.5). $CSGN prizes can automate now.

### Intended outcome

A streamer goes from a cold link to booked in three taps, streams the show they
were going to stream anyway, watches a verified payable number rise *only while
they are actually live*, gets raided into their hour and raids out of it, and
appears on a season leaderboard they never had to opt into.

---

## Part A — Verified airtime, and what it unlocks

### A1. Stop throwing away the Helix response

`isTwitchChannelLive()` (`feePollerBackground.ts:134`) calls
`helix/streams?user_login=` every minute and reduces the entire response to
`data.length > 0`. That response already contains `viewer_count`, `title`,
`game_name` and `started_at`. **Same call, same cost, all discarded.**

Replace it with `sampleTwitchStream(login, token)` returning
`{ live, viewerCount, title, gameName, startedAt } | null`, and widen
`StreamActivity` (`src/lib/slots.ts:92`):

```ts
checkCount?: number        // total samples taken, live or not  ← the fairness denominator
peakViewers?: number
viewerSampleSum?: number   // ÷ liveCheckCount = average concurrent
lastTitle?: string
lastGameName?: string
```

`checkCount` is the important one. See A2.

### A2. The payable fraction — one pure, tested function

Put it in `netlify/functions/_shared/feeCalc.ts`. **The server computes it and
stores the result on the slot; the client only reads the stored value.** That
avoids a second implementation — unlike `claimSlot.ts` / `slotModel.ts`, which
must mirror each other, this has exactly one home.

```ts
export const AIRTIME_FULL_CREDIT = 0.85   // ≥85% of samples live → paid in full
export const AIRTIME_FLOOR       = 0.20   // <20% → nothing
export const AIRTIME_MIN_SAMPLES = 10     // below this we cannot judge

export function payableAirtime(a: { liveCheckCount: number; checkCount: number }):
  { fraction: number; ratio: number; reason: 'full' | 'prorated' | 'no_show' | 'unverified' }
```

The rules, and why each exists:

- **Divide by samples taken, not by slot minutes.** Netlify's scheduler is
  at-least-once and drifts; the poller also self-throttles at 45s
  (`shouldRunPoll`). A run that misses six minutes of an hour must not dock the
  streamer 10% for *our* outage.
- **`checkCount < AIRTIME_MIN_SAMPLES` → `unverified`, fraction 1.0**, flagged
  for admin review. Fail open toward the streamer: thin telemetry is our
  problem. This mirrors the `walletCheck: 'unavailable'` fail-open already in
  `signupWithPhantom.ts`.
- **≥0.85 → 1.0.** Encoder restarts, a Twitch hiccup, a five-minute BRB cost
  nothing. This is the answer to "what if my stream cuts out."
- **0.20–0.85 → linear.** Explicable in one sentence, which is the bar.
- **<0.20 → 0.0, reason `no_show`.**

### A3. Apply it at snapshot lock

The poller already freezes the number at slot end by writing
`creatorFees.snapshotLockedAt` (~`feePollerBackground.ts:641`). Extend that
branch to write:

```
creatorFees.grossFeeSOL / grossFeeUSD      // what the volume produced
creatorFees.airtime = { liveCheckCount, checkCount, ratio, fraction, reason }
creatorFees.feeOwedSOL = gross × fraction  // existing field keeps its meaning: what we owe
creatorFees.paymentStatus = reason === 'no_show' ? 'void' : 'pending'
```

**Never retro-apply to completed slots.** Changing what a finished hour owed,
after the fact, is precisely the credibility loss this product is built against.
Gate on a start date in `config/season`.

### A4. Show it live — this is the retention mechanic, not the policy

`src/components/watch/StreamInfoBar.tsx` renders "Live Earnings" from
`creatorFees.feeOwedUSD`. Change it to show the **payable** estimate with the
airtime beside it: `$4.12 · 42/48 min live`. A number that rises only while you
are genuinely broadcasting is the single best reason not to cut out early. Do
the same on `/account`.

### A5. What to automate now

| | Decision |
|---|---|
| **$CSGN payouts (season prizes)** | **Automate.** `_shared/payouts.ts` / `payoutRunner.ts` are already $CSGN-denominated with caps, solvency, idempotency and crash-safety. Prizes route straight through. No new transfer code. |
| **SOL creator fees** | **Still manual → claim contract.** Needs native SOL transfers that don't exist. Build the Payable tab (A6) and leave the engine alone. **Neither `payouts.ts` nor `payoutRunner.ts` should appear in this phase's diff.** |

Pro-rating is what makes the manual run trivial rather than a judgement call:
the number is verified, locked, and explainable.

### A6. The Payable view

`src/components/admin/CreatorFeesTab.tsx` already shows per-slot fee state,
wallet resolution (`walletFor`), and live minutes — but it is flat, and its
`users` prop is only `{ uid, walletAddress }`. Add a group-by-member layer:

- `Map<assignedUid, Slot[]>` over slots where `feeOwedSOL > 0 && !paidAt`.
- Widen the `AdminUser` prop to carry `username` / `displayName`.
- Wallet-less members appear **greyed with the held amount** — that list is the
  nudge list.
- **Mark paid requires a transaction signature**, writes `paidAt`,
  `paidTxSignature`, `paidByUid` across the group in one batch via a new
  `netlify/functions/adminMarkFeesPaid.ts`, plus `auditLog('markFeesPaid', …)`.
  Validate base58 / 64–88 chars; do not verify on-chain.
- `HistoryLedger<T>` groups by *time*, not entity — reuse it for the settled
  history, not for the member axis.

---

## Part B — Conversion: from a cold link to a recurring hour

**Prerequisite: `docs/plan-twitch-first-claim.md` Phases 1–2 must land first.**

### B1. Schedule-matched onboarding — the highest-leverage feature here

The moment Twitch is linked we know the channel, and Twitch will tell us when
they usually stream **on an app access token, with no extra scope and no second
consent screen**:

- `GET /helix/schedule?broadcaster_id=` — their declared schedule, if set
- `GET /helix/videos?user_id=&type=archive&first=20` — past broadcasts with
  `created_at` + `duration`, to infer the pattern

The post-link screen then is not "browse the schedule," it is:

> **You usually stream Tue & Thu around 8pm ET.**
> Those hours are open on CSGN.
> `[ Claim Tue 8pm ]  [ Claim Thu 8pm ]  [ Pick other hours ]`

One tap from linked to booked, against hours they were already going to stream.
This is the owner's "keep your normal schedule" pitch made mechanical.

Reuse the app-token helper (`twitchAppToken()`, `feePollerBackground.ts:103`) —
lift it to `_shared/twitch.ts` with the existing `memo()` TTL cache rather than
writing a second one.

**A structural insight to exploit:** open hours are 3am–7pm ET, because 7pm–3am
is the owner's block. That window is **EU and Asia prime time**. Non-US
streamers are the natural first target, and the schedule matcher surfaces them
automatically.

### B2. Recurring claims

`claimSlot` books one hour. Add "every week at this hour" — a `recurringClaims`
entry per user, honoured by `topUpSchedule()` (`feePollerBackground.ts:222`),
which already seeds a week ahead. Retention and grid-filling in one feature.
Respect `slotLimits.maxConcurrentClaims`, and auto-release a recurrence after N
consecutive `no_show` results, which A2 now detects.

### B3. The post-stream moment

Nothing happens today when a slot completes. Add one notification: what you
earned, minutes live, who you raided, your standings movement, and a one-tap
**claim the same hour next week**. The best moment to book the second hour is
immediately after the first.

---

## Part C — The season and the raid chain

### C1. Read this before touching member ranking

`netlify/functions/publicProfiles.ts` contains a deliberate, documented stance
*against* a member leaderboard — `rankProfiles` + `sampleProfiles` shuffle the
discovery rail specifically so it is **not** one ("a leaderboard by bag size
would be easier to compute and would make the network worse").

That objection is to ranking members **by wealth**. Season standings rank
members **by contribution** — hours aired, audience brought, fees generated —
which is its opposite. Keep them as separate surfaces with separate rationales:
**do not reuse `rankProfiles`, and do not turn the discovery rail into a
leaderboard.** Leave `RecommendedProfiles` shuffling exactly as it is.

### C2. Standings — automatic, never opt-in

Everyone who streams is in it; there is nothing to join. Mirror
`src/lib/games/memeBoard.ts` structurally — it is the house pattern for a
published scoring formula:

- Pure module `src/lib/season.ts`, unit-tested, no I/O.
- **Exported weights** so the formula is checkable, max-normalized per term so
  one big entrant cannot swamp the blend (`normalizer()` at `memeBoard.ts:136`).
- Stable sort (`points → liveMinutes → username.localeCompare`) so order does
  not jitter between refreshes.

Three terms, from data we already collect:

| Term | Source |
|---|---|
| **Airtime** | `streamActivity.liveCheckCount` |
| **Audience** | average concurrent viewers, from the sample added in A1 |
| **Contribution** | `creatorFees.feeOwedSOL` generated during the hour |

**Cap the audience term** — viewer counts are gameable and Twitch's numbers are
all we have.

Follow the `settleVotes.ts` doctrine exactly, because it is the right shape
here: *a running tally is cheap, incremental and good enough for air; a settled
tally is the one that decides anything.* The poller keeps a live board; a
settle step at season end decides prizes, and is idempotent and re-runnable.

**Persistence:** another self-throttled step inside `feePollerBackground`,
gated on its own output doc's `updatedAt` — the same shape as `settleMemeVote()`
(every 30 min) and `refreshMemeBoard()`. No second scheduled function; there is
only one in the repo and that is deliberate. Write a pre-ranked
`public/seasonStandings`; tune weights and dates from `config/season`.

**Also fix the dead stat layer while you are here.** `xp`, `slotsCompleted` and
`gameStats` are read in `Header.tsx`, `Dashboard.tsx` and `publicProfiles.ts`
but **have no writer anywhere** — every member renders `XP 0`. The season
accrual should populate `slotsCompleted` and season points, so those surfaces
come alive instead of lying. If a field will still have no writer after this
work, delete it from the UI.

### C3. The raid chain — the mechanic that makes it a collective

**Build this one.** When your hour ends the next streamer is already known —
`config/ticker.upNext` is computed every minute via `_shared/onAir.ts`, so the
data source exists.

- Five minutes before your slot ends, `/account` and the on-air lower third
  show: **Up next: @nextstreamer** with a one-tap copy of `/raid nextstreamer`.
- Both sides get credit: the raider gets standings points, the receiver gets the
  audience.
- The network gets one audience walking down the schedule instead of 24
  disconnected hours.

Why it is the right mechanic for this product:

- It uses Twitch's own native feature, so nothing has to be built inside anyone's
  stream.
- **It is opt-in by construction** — ignore it and you lose nothing, which is
  the owner's hard requirement.
- It grows every participant's channel, which a streamer wants far more than $12.
- It is the strongest line in the recruiting pitch: *you get raided into, and
  you raid out.*

**Do not build raid verification in v1.** Detecting an incoming raid needs
EventSub plus a user token per channel. Credit the outgoing click (we know who
clicked and when) and sanity-check it against the receiver's viewer jump in the
sample from A1. Good enough, and say so in the copy rather than implying
certainty.

### C4. Co-hosting — reuse what exists

The `Slot` type already carries `requests: SlotRequest[]` with accept/decline
and notification wiring (`src/lib/slots.ts:102`, `acceptSlotRequest` /
`declineSlotRequest`). A claimant marks their hour "open to a guest," another
member requests, the claimant accepts. **No new data model.**

### C5. Prizes

- **$CSGN season pool** — automated through the existing ledger, top N by
  points at season end, via a new `'season'` `PayoutSource` (see cross-cutting
  rule 6 for exactly how far that is allowed to reach into the engine).
  `adminSettleVote.ts` is the pattern to mirror: settle, write back, then pay.
  (The `'leaderboard'` prize mode this section used to point at lived in
  `GameControlsCard.tsx`, which was removed with the games — there is no
  placeholder left to fill, so C5 starts from the ledger's own contract.)
- **SOL from fee revenue** — a stated share of network fee revenue, paid by
  hand until the claim contract.
- Publish standings and the pool size on a public page. **The leaderboard is a
  recruiting asset, not a feature.**

### C6. On air

Precedent is to pre-compute server-side and let the overlay poll a `public/*`
doc — `feePollerBackground` already writes a fully-ranked `public/memeBoard`
this way. The ticker (`docs/obs/csgn-ticker.html`) also already has a `"golf"`
item kind that renders a multi-row leaderboard card, which is the closest
existing renderer to standings. Add `public/seasonStandings` to its fetch list
and a `buildStandingsGroup(...)` beside the other builders. Both overlays are
standalone HTML with their own `decodeFs` copy and hardcoded Firestore URLs —
no TypeScript is shared, so ranking must be pre-computed server-side.

---

## Part D — Outreach

### D1. Targeting, derived from the product

- **Streamers whose usual hours fall in 3am–7pm ET** — EU and Asia prime time.
  Our open inventory is their best slot. Nobody has articulated this yet and it
  is a real structural advantage.
- Crypto and markets streamers first: the mechanism needs no explanation, and
  they generate the volume the fee is made of.
- 10–200 CCV. Below that there is no audience; above it CSGN is not yet worth
  their time.

### D2. The message — the owner's own words, better than an agency's

> Keep streaming exactly what you already stream, on your own channel, on your
> normal schedule. This is just an easy extra way to earn while you do it.

Then three specifics: your hour pays 30% of the fees it generates; you get
raided into it and raid out of it; you are on the season board automatically.

Everything in `docs/marketing-outreach.md` §1 (the refusal list) still binds —
in particular, **never quote an income, only a real figure from a real hour.**

### D3. Mechanics that manufacture outreach

Each of these is a recurring post that costs nothing once built: the **weekly
schedule card** (the grid with names in it), the **weekly standings image**
(everyone on it shares it), **payout receipts**, and the **raid chain as a
story** — "the audience that walked through six channels last night."

### D4. Instrument it

Add to the six metrics in `docs/product-process.md` §6: `raidsInitiated`,
`recurringClaims`, `scheduleMatchAccepts`. Each maps to one mechanic above, so a
dead mechanic is visible within a week instead of a quarter.

---

## Sequencing

| Phase | Depends on | Value if you stop here |
|---|---|---|
| **A** · Verified airtime + Payable view | Nothing | Payouts reflect reality; automation becomes safe; the live meter becomes a reason to stay on air |
| **B** · Schedule match + recurring claims | Twitch-first plan Ph. 1–2 | Streamers book hours they were already going to stream, and book them repeatedly |
| **C** · Season + raid chain | A (needs the airtime data) | A reason to come back, and a mechanic that grows every member's channel |
| **D** · Outreach | B, C | — |

Ship A first and alone. It is self-contained, it changes money, and it deserves
to sit for a few days before anything is layered on it.

---

## New surfaces, at a glance

Everything else is an edit to a file named inline above.

| New | Part | Purpose |
|---|---|---|
| `netlify/functions/_shared/twitch.ts` | A1/B1 | App-token helper lifted out of the poller, `memo()`-cached; Helix `users` / `schedule` / `videos` / `streams` |
| `netlify/functions/adminMarkFeesPaid.ts` | A6 | Batch-writes `paidAt` + signature across a member's slots |
| `src/lib/season.ts` | C2 | Pure scoring: exported weights, normalizer, stable sort. Modelled on `src/lib/games/memeBoard.ts` |
| `config/season` | C2/C5 | Window, weights, prize pool. House recipe — no rules deploy |
| `public/seasonStandings` | C2/C6 | Pre-ranked board the client and the OBS ticker both read |
| `src/pages/Standings.tsx` | C2 | Public leaderboard page — a recruiting asset, so it must be shareable |
| Recurring claims | B2 | Per-user; honoured by `topUpSchedule()`. Decide doc vs. subcollection when you get there — it is small either way |

## Cross-cutting rules

1. **Mirror every claim rule.** `claimSlot.ts` and `claimEligibility()` in
   `src/lib/slotModel.ts` must never disagree; both files say so already.
2. **Pure logic in `src/lib/`, persistence in the poller.** `memeBoard.ts` states
   this split explicitly and the project is at 586 tests because that line has
   been held. `payableAirtime` and `src/lib/season.ts` are pure and tested.
3. **Fail open toward the streamer on telemetry, closed on money.** Thin
   sampling pays in full and flags; a payout never goes out unverified.
4. **New periodic work goes in `feePollerBackground` as a self-throttled step**,
   gated on its own output doc's timestamp. Do not add a second scheduled
   function.
5. **New runtime config follows the house recipe:** `config/<name>` (world-
   readable by ID, admin-writable, no rules deploy) → `normalize<Name>()` +
   defaults in `src/lib/` → `onSnapshot` where needed → admin card with a
   seeded-once form (`GameControlsCard.tsx` is the canonical example).
6. **Do not touch the payout *engine*.** Precisely: the runner's step ordering
   and its four guarantees (idempotent ids, signature-before-broadcast, caps at
   every level, solvency before the first transfer) must not change, and no diff
   in Parts A, B or D should include `_shared/payouts.ts` or
   `_shared/payoutRunner.ts` at all.

   The one sanctioned exception is C5: paying a $CSGN season pool means adding a
   `'season'` value to the `PayoutSource` union and a `seasonPayoutRequests()`
   builder in `payoutRunner.ts`. (The Squares and Starting 5 builders that used
   to model this were removed with those games — see `payout-wallet.md`, and note
   the engine now has no endpoint at all.) That is *using* the ledger the way it was
   designed to be used — a new source, feeding the same engine — not modifying
   it. If a change to C5 requires touching the run sequence, the design is
   wrong; stop and re-plan rather than editing the sequence.
7. **Never retro-apply a rule change to a completed slot.**

---

## Verification

**Part A**
- Unit-test `payableAirtime` across: full, pro-rated, no-show, `unverified`
  (thin samples), and zero `checkCount` (must not divide by zero).
- Simulate a poller outage: 60-minute slot, 30 samples taken, 29 live → must pay
  in full, *not* 48%.
- Run a slot end-to-end on a real channel: go live, cut out for ten minutes,
  come back. Confirm `feeOwedSOL` = gross × fraction, `grossFeeSOL` preserved,
  and the Payable tab shows the same number as `/account`.
- Confirm a completed slot from before the cutover date is untouched.
- Mark a group paid twice — must not double-count or clear an already-settled
  slot.

**Part B**
- Link a Twitch account with a declared schedule and one without; both must
  produce sensible suggestions or degrade to "pick other hours" — never an empty
  screen.
- Verify no second Twitch consent screen appears (app token, no new scopes).
- Set a weekly recurrence, confirm `topUpSchedule` seeds it, then no-show twice
  and confirm it auto-releases.

**Part C**
- Standings recompute must be idempotent — run the settle step twice, identical
  output.
- Confirm the discovery rail still shuffles and is still not a leaderboard.
- Confirm `XP` on `/account` shows a real number, or is gone.
- Season settle → `adminRunPayouts` **dry run first** (it is dry-run by default
  and that default exists for a reason).
- Load the OBS ticker against a seeded `public/seasonStandings` and confirm it
  renders without touching `src/`.

**Always**
- `npm run lint && npm test && npm run build`.
- Walk the phone checklists in `docs/env-setup.md` — Part B touches the sign-up
  path, where a regression is a total-signup outage rather than a degraded step.
