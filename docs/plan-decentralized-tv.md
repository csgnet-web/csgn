# Plan — Decentralized TV: holder-uploaded airtime

**This document is the brief for the implementing agent.** Read it start to
finish before writing anything. The "why" lines are load-bearing, and §0 records
three collisions with policy this repository has already settled — if you
re-derive those from first principles you will build something the project has
explicitly decided against.

Read alongside it, in this order:
[analysis-onboarding-and-supply.md](analysis-onboarding-and-supply.md) (why this
is the right next move), [master-plan.md](master-plan.md) §5 and §11.1 (what the
token may and may not do), [token-voting.md](token-voting.md) §2.4–2.5 (linear
vs. curve, and the anti-capture cap), [plan-network-growth.md](plan-network-growth.md)
Part A (verified airtime, shipped), and
[marketing-outreach.md](marketing-outreach.md) §1 (what we may never claim).

---

## The idea in one paragraph

CSGN becomes a channel that is **always on**, because the people who hold the
token fill it. A member uploads a clip, orders their segments, and sees exactly
when their content airs. Their share of the day's inventory follows their share
of the supply. The owner keeps a curated block and can toggle it off at will,
which silently hands those hours back to the holder pool. Nobody has to be live,
and nobody has to be recruited, for the channel to have something on it.

**The product feeling we are buying:** you open the app, upload fifteen seconds,
and at 2:04 PM it is on television. That loop — upload, scheduled, aired, "47
people watched you" — is the whole thing. Everything below is in service of
making it feel that immediate.

---

## 0. Three collisions to resolve before writing code

These are not edge cases. Each one is a place where the obvious implementation
breaks a rule the project has already committed to in writing.

### 0.1 The token must not become an access gate

`master-plan.md` §5: *"It never gates claiming a slot, making an account, or
going live."* `tokenGates.ts` restates it: every token gate is a **promotion**
gate — it decides whose message is amplified, never who may take part.

Holder-weighted airtime is compatible with that **only if**:

- Every verified member gets a **non-zero floor** of airtime holding nothing.
- Claiming a live hour, making an account, and going live stay free and
  unweighted, exactly as they are now.

Build it so that holding more makes your voice *louder*, never so that holding
nothing makes you *silent*. If a zero-holder can be scheduled for zero seconds,
this rule is broken.

### 0.2 Linear weight hands the channel to one wallet

`token-voting.md` §2.4: *linear where ownership should decide, a square-root
curve where participation should*, plus §2.5's anti-capture cap.

A literal reading of "airtime proportional to percentage held" is linear, and
linear means a wallet with 40% of supply gets 40% of the broadcast. That is not
decentralized TV; that is one person's channel with extra steps. **Use the curve
and the cap** (§2 below). The owner asked for airtime by share of holdings, and
this delivers that — monotonically, transparently, with a published formula —
without letting one buyer take the network.

### 0.3 Uploaded airtime must not earn creator fees

`plan-network-growth.md` Part A (shipped) makes the creator fee depend on
*verified live broadcast*: `payableAirtime()` scales the fee by the share of
Twitch samples that found the channel live. If an uploaded segment also earned
fees, then buying tokens and uploading a loop would print money, and the
verification that just shipped would be trivially bypassed.

**Decision to implement:** uploaded segments earn **no** creator fee. Fees
generated during holder-uploaded inventory accrue to the treasury under
§11.1's published rules. Live claimed hours keep earning exactly as they do
today. The airtime you get for holding is *distribution*, not income — and the
copy must say so, because `marketing-outreach.md` §1 forbids implying otherwise.

> **Owner decision required.** This is the one place where I am guessing at
> intent rather than following a stated decision. If uploaded segments are meant
> to earn, say so and the fee model needs redesigning from the top — but be
> aware it re-opens the exact hole Part A was built to close.

### 0.4 And a fourth, for the later phases

`master-plan.md` §11.1: *"Nothing is ever burned. Not $CSGN, not SOL, not a
partner's token."* The z500 integration and the "showcase leagues by how much
CSGN is burned" mechanic (§7) both require burning $CSGN. That is a direct
reversal of published policy, not an extension of it. It is entirely the owner's
call to reverse — but it must be reversed **deliberately and in public**, since
§11.1 is currently the answer given to "why don't you burn." See §7 for three
ways to get the same effect, two of which keep the policy intact.

---

## 1. What already exists that you must not rebuild

Roughly half of this is wiring together machinery that is already here.

| Thing | Where | Why it matters |
|---|---|---|
| Intermission VOD rotation | `config/vodPlaylist`, `Player.tsx:473`, `masterControl.ts` INTERMISSION | `/player` **already** plays a list of MP4/WebM URLs whenever nobody is live. This is the seam. The new schedule replaces the list; the playback path barely changes. |
| Pre-computed public docs | `public/memeBoard`, `public/seasonStandings` (planned) | The house pattern: server ranks/orders, client and OBS overlay just read. Ranking on the client is not an option — the overlays share no TypeScript. |
| Self-throttled poller steps | `feePollerBackground.ts` (`refreshMemeBoard`, `settleMemeVote`) | Cross-cutting rule 4: new periodic work goes here, gated on its own output doc's timestamp. **Do not add a second scheduled function.** |
| Live balance settlement | `_shared/settleVotes.ts`, `readLiveWeights` | Weights **must** be re-settled against live on-chain balances. `master-plan.md` §5.1 documents the attack: store a weight at submit time and a holder can sell, or cycle the bag to a fresh wallet, and keep the airtime. |
| Supply-share math | `src/lib/holdings.ts` | `circulatingSupply`, `supplySharePct`, `tokensToNextStep` — already pure and tested. |
| The network block toggle | `networkBlockEnabled`, `isNetworkSlot` | The owner's 7pm–3am block already has a flag. §3 reads it; do not invent a second one. |
| Viewer sampling | `streamActivity.peakViewers` / `viewerSampleSum` (shipped in Part A) | This is where "47 people watched your clip" comes from, for free. |
| Slot lifecycle | `advanceSlotLifecycles`, `pickActiveSlot` | Live claimed hours already win over everything. Uploaded content fills what is left. |

---

## 2. The allocation — one pure, tested function

`src/lib/airtimeShare.ts`. Pure, no I/O, unit-tested, mirroring
`memeBoard.ts` structurally because that is the house pattern for a published
scoring formula.

```ts
export const AIRTIME_FLOOR_SECONDS = 30      // everyone, holding nothing
export const AIRTIME_MAX_SHARE = 0.10        // no member takes >10% of a day
export const AIRTIME_MIN_SEGMENT = 5         // shorter than this is a flicker
export const AIRTIME_MAX_SEGMENT = 120       // longer than this is a takeover

export function airtimeShares(
  members: Array<{ uid: string; balance: number }>,
  inventorySeconds: number,
  supply: number,
): Array<{ uid: string; seconds: number; sharePct: number; capped: boolean }>
```

The rules, and why each exists:

- **Weight is `sqrt(supplyShare)`, not `supplyShare`.** §0.2. Influence still
  grows with the bag, monotonically and visibly — a holder with 4× the tokens
  gets 2× the airtime. Sub-linear is what stops the channel being purchasable.
- **A floor of `AIRTIME_FLOOR_SECONDS` for every verified member**, allocated
  before the weighted split. §0.1. Thirty seconds a day is a real place on
  television for someone who holds nothing, and it is what keeps this a
  promotion gate.
- **A cap of `AIRTIME_MAX_SHARE` per member per day**, applied after weighting,
  with the excess redistributed across everyone else and re-capped until stable.
  This is `token-voting.md` §2.5's anti-capture cap. Without it §0.2 happens.
- **Allocate proportions, not absolute seconds.** The function takes
  `inventorySeconds` as an argument and never assumes 86,400. This is what makes
  the owner's toggle work automatically — see §3.
- **Deterministic and stable-sorted** (`seconds → sharePct → uid`) so two runs
  over the same inputs produce the same schedule, and a member's slot does not
  jitter between recomputes.

Verification is in §8. Test the whale case first: one wallet with 90% of supply
must not receive more than `AIRTIME_MAX_SHARE` of the day.

---

## 3. The inventory — and the toggle that changes it

Inventory is **derived every recompute, never stored**:

```
inventory = 24h
          − live claimed slots (status confirmed/live, any hour)
          − the owner's network block, IF networkBlockEnabled
          − house reserve (station ident, promos — a published constant)
```

Because §2 allocates *proportions of whatever inventory exists*, flipping
`networkBlockEnabled` off hands eight hours to the holder pool with no other
change, and flipping it back reclaims them. That is exactly the behaviour the
owner asked for, and it falls out of the arithmetic rather than needing a
migration.

**Two guarantees the toggle must keep:**

- **A flip never invalidates content that has already aired.** The schedule is
  rebuilt forward from now; the past is a log, not a plan.
- **A flip mid-segment lets the current segment finish.** Cutting a member off
  four seconds into their fifteen is the kind of thing that makes people stop
  uploading.

---

## 4. The schedule — pre-computed, public, and previewable

A new self-throttled step in `feePollerBackground.ts` writes
**`public/airtimeSchedule`**: an ordered, timestamped playlist covering the next
few hours.

```
{ builtAt, horizonEndsAt, items: [
    { startsAt, seconds, uid, username, clipId, url, title }
] }
```

- **Pre-computed server-side** because the OBS overlay and `/player` share no
  TypeScript with `src/` (`plan-network-growth.md` C6 makes this point about
  standings; it applies identically here).
- **Timestamped, so preview is real.** "Your clip airs at 2:04 PM" is the single
  most motivating string in this product, and it is only honest if the schedule
  is built ahead of time and stable.
- **Rebuilt on a horizon, not per-play.** Rebuilding on every playback would
  make the preview a lie.
- **Never leaves dead air.** If holder content runs short, fall through to
  `config/vodPlaylist` and then the animated network board — the fallbacks
  `/player` already has.
- **Live always wins.** A claimed hour that goes live pre-empts the schedule;
  pre-empted segments return to the pool for the next rebuild rather than being
  consumed.

`/player` changes less than you would expect: `INTERMISSION` already rotates a
list. It now rotates *this* list, and reports back what actually aired.

---

## 5. Upload, moderation, and the risk that can end the channel

### 5.1 This is the part that can go badly wrong

One copyrighted music video on a Twitch channel is a DMCA strike. Three is the
channel. A single piece of illegal content is worse than that. The moderation
design is therefore not a feature, it is the thing that keeps the network alive:

- **Nothing airs unreviewed. Ever.** Approval is pre-air, not post-hoc. There is
  no "flag it after it broadcasts" version of this that is survivable.
- **First upload from a member is always held**, regardless of holdings. A large
  bag is not a trust signal, and §0.1 means it must not buy one.
- **The owner can pull anything instantly**, and a pull removes it from the
  built schedule without a rebuild.
- **Keep an immutable record of what aired when** — `auditLog` per aired
  segment. When a takedown notice arrives, "we do not know what we broadcast" is
  not an answer.
- **Terms and a DMCA path** must ship *with* this, not after: an accepted
  upload agreement, a stated takedown route, and a named agent. `Terms.tsx`
  exists and will need real work. **This needs counsel before launch**, the same
  way the games' prize structure did. Nothing in this repo is legal advice.

### 5.2 Storage and transcoding — the honest new-infrastructure cost

This is the one genuinely new piece of infrastructure in the plan, and the
estimate should not be soft: the repo has **no file storage today** and no
transcode path. Uploads must be normalized to one container, codec, resolution
and frame rate, or playback stutters and the broadcast looks amateur.

Options, with the trade-off stated rather than a recommendation dressed as a
fact:

| Option | For | Against |
|---|---|---|
| Firebase Storage + a transcode function | Same project, same auth, cheapest to wire | You own the encoding pipeline, and video encoding in a Netlify function is a poor fit for a 10s wall clock |
| Cloudflare Stream / mux | Upload, transcode, HLS and thumbnails solved; signed playback | A new vendor, a new bill, a new secret |

Whichever is chosen: **hard caps on duration, file size and daily uploads per
member**, enforced server-side. `_shared/http.ts` already caps request bodies
for exactly this class of reason.

### 5.3 What the member actually sees — /studio

The whole point is that this feels like TikTok, not like a broadcast console.
The screen is four things and nothing else:

1. **"You have 4m 20s of airtime today."** With the one line that makes the
   token concrete: *hold more, get more* — and `tokensToNextStep` from
   `holdings.ts` already computes "how much more for the next step."
2. **Upload** — from a phone, one tap, with a visible progress bar.
3. **Order** — drag your clips. This is the "order their seconds" requirement,
   and it should feel like a playlist, not a form.
4. **Preview** — "Airs at 2:04 PM, 5:31 PM, 9:12 PM today," and per clip: in
   review / approved / aired.

Then the loop closes: **after it airs, notify them** — "You were on CSGN at
2:04 PM. 47 people were watching." The viewer count comes free from the sampler
shipped in Part A. That notification is the reason they come back tomorrow, and
it is the cheapest thing in this document to build.

---

## 6. Phases

| Phase | What lands | Value if you stop here |
|---|---|---|
| **1** | `airtimeShare.ts` + inventory derivation + `public/airtimeSchedule` built from the **existing** `config/vodPlaylist`, played by `/player` | The channel is on 24/7 with owner-supplied content on a real schedule. No uploads, no new infrastructure, no legal surface. **This is a week of work and most of the strategic value.** |
| **2** | Upload + moderation queue + `/studio` | Holders fill the channel. This is the product. |
| **3** | Aired-notifications, viewer counts, "your clip aired" history | The retention loop closes. |
| **4** | League showcase + z500 (§7) | — |

**Ship Phase 1 first and alone.** It is self-contained, it de-risks everything
after it, and it answers the "is anything ever on?" objection before a single
upload exists.

---

## 7. Later — leagues, burning, and z500

Deliberately thin, because these depend on decisions that are not mine and on an
external protocol I cannot read from here.

**The burn collision.** Both "showcase leagues by $CSGN burned" and the z500
buy+burn mechanic contradict `master-plan.md` §11.1. Three ways forward:

1. **Reverse §11.1 deliberately.** Fine, but do it in public and rewrite the
   section — the current text is the answer given to "why don't you burn," and
   quietly contradicting it costs more credibility than the burn buys.
2. **Buy + lock instead of burn.** Same demand mechanic, same signal, capital
   stays productive, §11.1 survives intact. Ranking is by amount locked.
   This is the version that fits what the project has already said.
3. **Burn only the partner token, never $CSGN.** Works for outbound alignment,
   does nothing for a CSGN sink.

**z500 / $ANSEM.** The mechanic as described (airdrop supply to $ANSEM holders,
buy+burn $ANSEM to climb the leaderboard) is a token-supply and treasury
decision, not an engineering task, and it needs the owner and counsel before it
needs an agent. Note that §11.1's *"the treasury that receives is the treasury
whose stage it is"* rule already covers the shape of it cleanly. **I cannot
verify ansem.io's integration surface from here** — no public API spec was
available to me, and everything I know about z500 came from the essay in the
request. Treat any integration detail as unverified until their docs are read.

**The 12-team flagship league.** Fits the existing `SlotRequest` /
notifications model and the season-standings work in `plan-network-growth.md`
C2 far better than it fits this document. It should get its own brief once
Phase 2 is live.

---

## 8. Verification

**Phase 1**
- Unit-test `airtimeShares` across: a single whale (must hit the cap, never
  exceed it), a long tail of zero-holders (all must receive the floor), an empty
  member list, an inventory of zero, and a supply of zero (must not divide by
  zero).
- Flip `networkBlockEnabled` off and confirm the eight hours redistribute
  without a redeploy — and that nothing already aired is altered.
- Claim a live hour inside the holder window and confirm it pre-empts, and that
  the pre-empted segments return to the pool.
- Rebuild the schedule twice with unchanged inputs — byte-identical output.
- Starve the schedule (no content) and confirm the fallback chain reaches the
  network board rather than dead air.

**Phase 2**
- Upload as a brand-new member: it must be **held**, not aired, whatever the
  balance.
- Reject an item that is already in a built schedule and confirm it does not
  air.
- Confirm every aired segment has an `auditLog` entry naming what aired, when,
  and whose it was.
- Confirm a zero-holder can still upload and still airs their floor.

**Always**
- `npm run lint && npm test && npm run build`.
- Watch a full hour of the built schedule on `/player` in OBS before it goes to
  the broadcast. Stutter, black frames and audio jumps at segment boundaries are
  the failure mode that makes the whole thing look cheap, and they only show up
  in real playback.

---

## Cross-cutting rules

1. **Pure logic in `src/lib/`, persistence in the poller.** `airtimeShare.ts` is
   pure and tested; `feePollerBackground` writes.
2. **No second scheduled function.** The schedule builder is a self-throttled
   step gated on `public/airtimeSchedule.builtAt`.
3. **Weights settle against live balances**, never a stored snapshot.
4. **Fail toward "something is on".** Every failure path ends in the fallback
   chain, never in dead air.
5. **Nothing airs unreviewed**, and the aired log is immutable.
6. **The token amplifies, it never admits.** A zero-holder always has a place.
7. **Uploaded airtime is distribution, not income** — and the copy never implies
   otherwise (`marketing-outreach.md` §1).
