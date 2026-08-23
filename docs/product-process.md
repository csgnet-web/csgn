# The product process — from cold click to first users

The one job this document has: describe every step a stranger takes between
seeing CSGN for the first time and doing something that matters, name what
should be cut from that path, and say what to measure. It is written to be
argued with; where a number is an assumption it says so.

Companion documents: [signup-flow.md](signup-flow.md) for how the auth actually
works, [growth-and-market-plan.md](growth-and-market-plan.md) for the economics
this rests on, [marketing-outreach.md](marketing-outreach.md) for the campaign
built on top of it.

---

## 1. The two funnels, stated separately

They are different people with different jobs and they must not share a CTA.
Almost every conversion mistake in this product came from writing one button for
both.

**Funnel A — the viewer.** Lands on `/`, watches, follows, maybe buys. Their
conversion event is *coming back*. They do not need an account and should not be
asked for one before they've seen anything.

**Funnel B — the streamer.** Lands on `/` or `/schedule`, and their conversion
event is **claiming an hour and going live**. That is the only event that makes
the network exist. Everything in the product should be readable as either
"serves the streamer getting on air" or "serves the viewer coming back", and
anything that is neither is a candidate for the cut list in §4.

### Funnel B, step by step, as it stands today

| # | Step | State |
|---|---|---|
| 1 | Land on `/` | Fixed today — the page now carries a one-sentence pitch, three checkable facts, and a wallet CTA where two dead "Coming Soon" tiles used to be |
| 2 | Tap Join | Opens the modal directly, no page change |
| 3 | Continue with Phantom → approve signature | 2 taps, ~6 seconds |
| 4 | Create account (username pre-filled) | 1 tap |
| 5 | "I want to go on air → connect Twitch" | 1 tap; inside Phantom's browser this now hands out to Safari and polls, instead of failing (see signup-flow.md) |
| 6 | Approve on Twitch | 0–2 taps if already signed into Twitch in Safari |
| 7 | `/schedule` → claim an hour | 2 taps |
| 8 | Stream to their own Twitch at that hour | — |

**Eight steps, roughly nine taps, no typing, no email, no password.** Before
today, step 5 was inside step 3, and it was unfinishable for anyone arriving in
the Phantom app — which is where the traffic comes from.

The elevator-pitch demo is steps 1–4: **three taps and about fifteen seconds**
from "here's the site" to "you have an account." Steps 5–8 are the streamer
close and need a laptop or a patient investor, not an elevator.

---

## 2. Where people actually leave, in order

Ranked by expected loss, not by how easy each is to fix.

1. **`/` says nothing and shows OFFLINE.** Before there is programming most of
   the day, the hero is an offline panel. A visitor who cannot answer "what is
   this" in four seconds is gone, and no sign-up flow can rescue that. *Partly
   addressed:* the pitch block now sits below the stage. *Not addressed:* the
   offline state itself should sell the network rather than apologise for the
   feed — see §4, item 1.
2. **Nothing to come back for.** No email captured, no push, no calendar. A
   visitor who leaves is gone for good unless they follow @CSGNet, which is
   asked for exactly once, in the offline panel. This is the largest unfixed
   leak in the product.
3. **The wallet gate.** Sign-up requires Phantom, and a wallet with no on-chain
   history is refused outright. That is deliberate and correct as anti-sybil,
   but it means a non-crypto streamer — the majority of good streamers — cannot
   join at all. See §4, item 4 for the honest options.
4. **The Twitch hop.** Was fatal, is now a handoff. Expect it to still cost
   people: any step that involves the words "open Safari" loses some.
5. **An empty schedule.** A streamer who claims an hour and finds no audience
   does not claim a second one. This is the retention problem, not the
   acquisition problem, and it is solved by programming, not by product.

---

## 3. What "necessary" means here

A feature is necessary if removing it would break one of these five sentences:

1. A stranger can tell what CSGN is within four seconds.
2. A streamer can get from that page to on-air without help.
3. A viewer can watch what is live right now.
4. A streamer can see what they earned and that it was paid.
5. An operator can run the network — schedule, override, settle, pay.

Everything else is depth. Depth is not bad; depth *before an audience* is the
expensive kind of bad, because every feature is a support surface, a
correctness surface, a payout surface and a page nobody visits.

---

## 4. The cut list

Ranked by value-per-hour of cutting. Items marked **DONE** shipped with this
change; the rest are recommendations with an explicit recommendation attached,
because deleting shipped, tested, on-chain-adjacent features is an owner's call
and not one to make silently.

### DONE — cut today

| Cut | Why |
|---|---|
| Twitch out of sign-up | It gated the account instead of the broadcast, and it was unfinishable in the browser most users arrive in. |
| Email + password out of sign-up | Never the credential; three fields and a round trip for a key nobody used after the first sign-in. Still available as recovery on `/account`, and it appears automatically for the one rejection it solves. |
| Typing a username | Pre-filled from the wallet. The primary button is live on arrival. |
| The sign-in / sign-up choice | The wallet knows. One door. |
| Two disabled "Coming Soon" game tiles on `/` | The largest block below the stage was two buttons that cannot be pressed. Replaced with the pitch and the sign-up. |
| `/about/streamer-quick-apply` | An orphan page, linked from nowhere, describing an apply-and-review flow that has not existed since claiming became self-serve, pointing at a URL that redirects elsewhere. Now redirects to `/schedule`. |
| `consumeTwitchOAuthResult`, `registerDraft` | Dead with the flow they served. |

### RECOMMENDED — cut or hide before the first campaign

1. **Make the offline state sell, not apologise.** *(Highest value on this
   list.)* `OfflinePanel` currently says "Stream starting soon" and points at X.
   For a cold visitor arriving from an ad during the ~20 hours a day nothing is
   live, that is the whole product experience. It should carry the schedule for
   today, the last payout with its transaction hash, and one clip. Two hours of
   work, and it converts the traffic the campaign is about to buy.
2. **Add one way to come back.** Pick exactly one: an email capture on the
   offline panel ("tell me when we're live"), or a prominent follow-@CSGNet
   with the next slot time. Not both, and not a notification system. Right now
   there is no re-engagement channel at all, which makes every ad dollar a
   one-shot.
3. **Hide a feature until it is playable.** The Meme 100
   board, supply-weighted voting and the jukebox spotlight are real, tested
   code, and they are depth for an audience that does not exist yet. They are
   already off the main nav; finish the job by removing `GamesPanel`,
   `HolderPanel`, `MemeVoteCard` and `RecommendedProfiles` from `/account` so a
   brand-new member's first screen shows exactly two things: *connect Twitch*
   and *claim an hour*. Keep `/participate` reachable by direct link for
   testing. **This is a hide, not a delete** — the code stays, the route stays,
   the tests stay, and it is one commit to reverse. It also drops a 294 KB
   Solana bundle off the path most users take.
4. **Decide the wallet question, explicitly.** Today Phantom is mandatory and a
   fresh wallet is refused. That is right for the *payout* (fees go to a wallet)
   and wrong for the *front door* (most good streamers do not have a funded
   Solana wallet). Three options, ranked:
   - **(a) Keep it.** Honest, self-selecting for a crypto-native audience, zero
     work. The cost is the entire non-crypto streamer market.
   - **(b) Let a streamer claim an hour with Twitch alone, and require the
     wallet at payout.** The wallet is only needed when there is money to send,
     and the on-chain sybil check moves to the moment it protects something
     real. Meaningful work — the claim path and the payout runner both assume a
     verified wallet — but it is the option that unlocks supply.
   - **(c) Embedded wallets (Privy or similar),** already analysed in
     [socialfi-era2.md](socialfi-era2.md). Best conversion, real cost, real
     dependency, and it should not be started the same week as a campaign.

   **Recommendation: (a) for the first campaign, (b) as the next real project.**
   Do not attempt (c) before there is proof the funnel is the constraint.
5. **XP.** A number on the header and the profile that no rule reads. Either
   give it one meaning that matters (claim priority is the obvious one) or take
   it off the screen. A metric with no consequence teaches members that the
   numbers here are decoration.
6. **Trim the docs directory.** Nineteen strategy documents with overlapping
   vocabulary is a real cost the day someone else joins. `campaign.md`,
   `master-plan.md`, `the-pitch.md`, `ecosystem-strategy.md`, `socialfi-era2.md`,
   `onchain-thesis.md` and `csgn-share.md` say many of the same things in
   different words. Fold them into one strategy document plus this one, and
   archive the rest.

### KEEP — load-bearing, do not touch

`/player` and the master-control state machine (this is the network),
`/schedule` and `claimSlot` (this is the transaction), the fee poller and
`feeCalc` (this is the product's only real claim), `/treasury` (this is the
proof), `/admin` (this is the operator), the security and rate-limiting
work (this is what keeps the bill and the blast radius small).

---

## 5. The first-users sequence

The cold-start analysis in [growth-and-market-plan.md](growth-and-market-plan.md)
§4 is right and this is its operational form. Three gates, in order. **Do not
start a gate before the one before it is true** — the most expensive mistake
available here is buying attention for a network that is dark.

### Gate 1 — Nothing is broken and nothing is dark *(before any outreach)*

- [ ] Walk the phone test in [env-setup.md](env-setup.md): sign up in Phantom's
      in-app browser on a real iPhone, three taps, no help.
- [ ] Link Twitch from that same browser via the Safari handoff. Confirm the
      Phantom tab turns green without a reload.
- [ ] Claim an hour, go live, confirm `/player` picks it up and the fee readout
      moves.
- [ ] Run a payout. Keep the transaction hash. **This is the single most
      valuable asset the project can produce and it takes one afternoon.**
- [ ] Confirm the network is never dark: intermission programming runs when no
      slot is claimed.

### Gate 2 — One real show, three weeks *(before recruiting anyone)*

The founder is streamer #1 — not as a placeholder, as the product. Fixed
schedule, 3–4 sessions a week, same days, same time. The CSGN ticker on screen
with fees accruing *is* the pitch; nobody has to be told to believe a number
going up. Do the payout on stream. That clip is the recruiting asset.

Exit criteria: three consecutive weeks hit, at least one payout screenshot
published, at least one clip worth sending cold.

### Gate 3 — Ten streamers, one at a time *(the actual recruiting)*

The ask is not "join my platform." It is:

> Keep streaming exactly what you already stream, on your own channel, and get
> paid an extra amount on top of it.

Zero switching cost is the whole supply-side argument until volume is real.
**Do not oversell the payout.** A streamer promised $200 who receives $12 never
comes back, and the on-chain record means you cannot quietly round up. Quote the
real number from the fee table, say it is small today and say why it grows.

Ten is the target because ten streamers × three hours a week is thirty
programmed hours, which is the point where the schedule stops looking empty to
a visitor — the thing that makes streamer eleven easy.

---

## 6. What to measure

Six numbers. Not a dashboard — six numbers, written down weekly, by hand if
necessary. Anything not on this list is not being optimised this quarter.

| Metric | Where it comes from | Why it is on the list |
|---|---|---|
| Unique visitors to `/` | Netlify analytics | The denominator for everything |
| **Accounts created** | `auditLogs` → `signupWithPhantom` | Funnel A→B conversion; this is the number the auth work moves |
| **Twitch links completed** | `auditLogs` → `linkTwitch` | The step that just got fixed. Its ratio to accounts created is the health of the handoff |
| **Hours claimed** | `auditLogs` → `claimSlot` | The only event that makes the network exist |
| Hours actually streamed | `streamActivity.liveCheckCount` per slot | Claimed ≠ aired. The gap is the honesty metric |
| Fees paid out, in dollars | payout runner | The only proof that any of it is real |

Two ratios matter more than any absolute number early on:
**Twitch links ÷ accounts** (is the handoff working?) and
**hours streamed ÷ hours claimed** (are the streamers real?).

If the first drops below ~50%, the handoff regressed — go straight to the two
verification steps at the end of [signup-flow.md](signup-flow.md).

---

## 7. Today's build, in one line

Sign-up went from *"email, password, confirm password, wallet, and a Twitch hop
that cannot complete in the browser most of our users arrive in"* to
**three taps and a signature**, with Twitch moved past the finish line and made
to work across two browsers. That removes the failure the funnel was losing
everyone to. It does not create demand — §5 does that, and it is the part that
cannot be shipped.
