# Plan — Twitch-first claiming, guest bookings, wallet at payout

**Audience: the agent implementing this.** Written to be executed against the
current codebase, not to be admired. Every file path is real; every claim about
current behaviour was read out of the code on the branch
`claude/twitch-signup-flow-xbvacz`. Where something is a decision rather than an
instruction it is marked **DECISION** and must be resolved before the phase that
depends on it — do not guess and do not silently pick.

Context you should read first, in this order:
[signup-flow.md](signup-flow.md) (what the auth does now and why),
[product-process.md](product-process.md) §4 item 4 (why this project exists),
[games-and-payouts.md](games-and-payouts.md) (the payout ledger's guarantees).

---

## 1. The goal in one paragraph

A streamer should be able to go from a cold link to **booked, verified and on
the schedule** without owning a Solana wallet. The wallet is how they get *paid*,
so it is required at *payout* — the moment it protects something real — and not
before. Alongside that, an admin should be able to book someone who has no CSGN
account at all, by Twitch handle, and have the system convert that booking into
a real account the moment that person shows up.

**Today** `claimSlot` demands `phantom.verified && twitch.verified`, and the only
way to get an account at all is a Phantom wallet with on-chain history. So the
entire non-crypto streamer market — which is most good streamers — cannot even
create an account, let alone claim an hour. That is the constraint this removes.

### The target state, as four sentences

1. **Twitch alone creates an account.** Sign in with Twitch is a first-class
   auth method, peer to Sign in with Phantom, not a link you add afterwards.
2. **Twitch alone claims an hour.** The wallet check leaves `claimSlot`.
3. **An admin can reserve an hour for a Twitch handle that has no account.** The
   schedule shows the guest's real display name and avatar immediately.
4. **The wallet is asked for when money is owed** — after the stream, against a
   real number, with the fees held (never dropped) until it arrives.

---

## 2. What exists already that you must not rebuild

Read these before writing anything. Roughly half this project is wiring
together machinery that is already here and already tested.

| Thing | Where | Why it matters here |
|---|---|---|
| `twitch_account` proof token | `netlify/functions/_shared/proofTokens.ts`, minted in `twitchOAuthCallback.ts` | Same shape as the `phantom_wallet` proof. `signupWithTwitch` consumes it exactly the way `signupWithPhantom` consumes the wallet proof. **This is the whole reason Phase 1 is small.** |
| The cross-browser OAuth handoff | `src/hooks/useTwitchLink.ts`, `src/lib/twitchLink.ts`, `netlify/functions/claimTwitchLink.ts` | Twitch OAuth already works inside Phantom's in-app browser and everywhere else. Reuse the hook; do not write a second OAuth path. |
| `uniqueTwitchUsers/{twitchUserId}` | written by `signupWithPhantom.ts`, `linkTwitch.ts` | The one-Twitch-one-account lock. Create-only, so the database refuses duplicates rather than the code remembering to check. Reservations and Twitch sign-up both key off this. |
| Custom-token sign-in | `createCustomToken` in `_shared/firebaseAdmin.ts`, `signUpWithPhantom` in `src/contexts/AuthContext.tsx` | Server mints, client exchanges, Firebase user is created by the exchange. Mirror it for Twitch. |
| In-app notifications | `users/{uid}.notifications[]`, `addUserNotification` in `src/lib/slots.ts`, rendered in `src/pages/Dashboard.tsx` | A working notification channel that costs nothing. Phase 4 starts here, not with email. |
| The payout ledger | `_shared/payouts.ts`, `_shared/payoutRunner.ts` | Four guarantees, heavily tested. **Do not modify the runner's ordering.** Phase 3 adds a *source*, it does not touch the engine. |
| Claim rules, mirrored | `netlify/functions/claimSlot.ts` and `claimEligibility()` in `src/lib/slotModel.ts` | These two deliberately mirror each other. **Every rule change in this plan must land in both files, in the same commit.** Both carry a comment saying so. |

---

## 3. Phase 1 — Sign in with Twitch, and claim without a wallet

Independently shippable and independently valuable: on its own it opens the
product to every streamer who doesn't hold SOL.

### 1.1 `netlify/functions/signupWithTwitch.ts` *(new)*

Model it on `signupWithPhantom.ts` — read that file's header comment first; the
security reasoning transfers almost line for line.

```
POST { username, twitchProofToken }
  → verifyProofToken<TwitchProof>(twitchProofToken, 'twitch_account')
  → reject if uniqueTwitchUsers/{twitchUserId} exists  (409 duplicate_twitch)
  → reject if uniqueUsernames/{usernameLower} exists   (409 duplicate_username)
  → sybil gate (below)
  → commitWrites([ create uniqueUsernames, create uniqueTwitchUsers, create users/{uid} ])
  → return { customToken: createCustomToken(uid), user }
```

The user doc must be **the same shape** `signupWithPhantom` writes, so no reader
has to distinguish account types. Differences: `authMethod: 'twitch'`,
`phantom: { verified: false }`, `twitch: { verified: true, … }`, `email: ''`.
Keep every field present with an empty value rather than omitting it — that rule
is already established in `signupWithPhantom.ts` and readers depend on it.

**The sybil gate.** Wallet sign-up charges on-chain history because a keypair is
free. A Twitch account is *not* free — it needs a verified email and Twitch rate
limits creation — but it is not expensive either. Charge account age:

- `twitchOAuthCallback.ts` currently reads `id, login, display_name,
  profile_image_url` from Helix `/users`. **Also capture `created_at`** and put
  it in the `twitch_account` proof claims.
- Reject sign-up when the Twitch account is younger than `CSGN_MIN_TWITCH_AGE_DAYS`
  (default **30**), with code `twitch_too_new` and a message that names the real
  remedy: sign up with a Phantom wallet instead, or come back later.
- **Fail open on a missing `created_at`**, recording `twitchCheck: 'unavailable'`
  on the account, exactly as `signupWithPhantom` does with `walletCheck`. Same
  reasoning: this is anti-spam, not anti-fraud, and no money rests on it.

### 1.2 `netlify/functions/loginWithTwitch.ts` *(new)*

A near-copy of `loginWithPhantom.ts`, reading `uniqueTwitchUsers/{id}` instead of
`uniquePhantomWallets/{address}`. Same posture: **never creates an account,
never re-links**, 404s for an unknown Twitch id, rate limited.

### 1.3 `claimSlot.ts` — drop the wallet requirement

Current lines 72–76 require a verified wallet. Change to:

```ts
// Twitch is what goes on air, so Twitch is what claiming requires. The wallet
// is how the streamer gets PAID, and it is required at payout instead — see
// docs/plan-twitch-first-claim.md §5. Asking for it here cost us every
// streamer who does not already hold SOL, to protect nothing: an unpaid,
// unclaimed fee balance is not a loss, it is a message.
if (!isAdmin && (!user.twitch?.verified || !twitchUsername || !twitchUserId)) {
  throw forbidden('A verified Twitch channel is required to claim an hour.')
}
```

- `walletAddress` on the slot write becomes `user.phantom?.walletAddress || ''`.
  **Do not drop the field** — `Admin.tsx:586` and the payout path read it.
- Mirror the change in `claimEligibility()` (`src/lib/slotModel.ts` ~line 279):
  delete the `no_wallet` branch, keep `no_twitch`. There are existing tests in
  `src/lib/slotModel.test.ts` asserting the old behaviour — update them, and add
  one asserting a wallet-less Twitch account **is** eligible.
- Leave the admin bypass and the email-verification branch exactly as they are.

### 1.4 The modal: two front doors, one account

`src/components/auth/AuthModal.tsx` is a four-step machine (`connect` → `name` →
`done` → `email`). Keep the shape; widen step `connect`.

```
┌─────────────────────────────────────┐
│  Continue with Twitch      ← new,   │   Streamers. The larger button,
│                              primary│   because they are the scarce side.
├─────────────────────────────────────┤
│  Continue with Phantom              │   Holders, and anyone who wants the
│                                     │   wallet to be the credential.
└─────────────────────────────────────┘
   Sign in with an email and password instead
```

Both buttons behave identically from there: prove the identity → try to sign in →
on 404 go to step `name` with a pre-filled username → create → step `done`.

- Twitch's suggestion should be **the Twitch display name**, sanitised to
  `^[A-Za-z0-9_]{3,20}$`, falling back to `suggestUsername(twitchUserId)`. A
  streamer's own handle is a far better default than a generated one. Extend
  `src/lib/username.ts` with `sanitizeUsername(raw): string | null` and test it
  against real-world handles containing spaces, dots and emoji.
- The Twitch button reuses `useTwitchLink`. Inside a webview it renders
  `TwitchHandoffPanel` inline — **the sign-up flow now depends on the handoff
  working**, so treat any regression there as a P0.
- Step `done` flips by path: a Twitch account is offered *claim an hour* (primary)
  and *add your wallet* (secondary, framed as "so we can pay you"); a Phantom
  account keeps today's *watch* / *connect Twitch*.

**DECISION 1.** Do we keep requiring a wallet before a *network* (7pm–3am) slot
can be claimed? Those hours are CSGN Originals and already admin-gated, so
probably moot — but say so explicitly rather than discovering it later.

### Phase 1 acceptance

- [ ] A brand-new Twitch account with no wallet can sign up, claim an open hour, and appear on `/schedule`.
- [ ] Signing in again with the same Twitch account returns the same uid and does not create a second account.
- [ ] A Twitch account already linked to a Phantom-created account signs into *that* account rather than making a new one.
- [ ] The same Twitch account cannot end up on two CSGN accounts (kill the Firestore doc and prove the create-only write refuses).
- [ ] A Twitch account created yesterday is refused with `twitch_too_new`.
- [ ] `claimEligibility()` and `claimSlot` agree in all six states — no account / inactive / unverified email / no Twitch / Twitch-only / Twitch+wallet.

---

## 4. Phase 2 — Guest bookings, and the link that is the notification

### 4.1 The shape: a reservation, not a new slot status

`SlotStatus` is `open | confirmed | live | completed` and it is read by
`masterControl.ts`, `resolveCurrentBroadcast.ts`, `feePollerBackground.ts`,
`slotModel.ts` and the admin panel. **Do not add a fifth value.** A new status
means auditing five consumers for a state none of them expect, and the broadcast
machinery is the last thing in this codebase that should be destabilised.

Instead add a field:

```ts
/** An hour held for a Twitch channel that may not have a CSGN account yet.
 *  Inert to the broadcast machinery by construction: everything downstream keys
 *  off `assignedUid` and `streamUrl`, and a reservation sets neither. If the
 *  guest never claims, the hour simply plays intermission, exactly as an
 *  unclaimed hour does today. */
reservation?: {
  twitchUserId: string
  twitchLogin: string
  displayName: string
  profileImageUrl: string
  /** Short code the guest redeems, also the Firestore doc id under `slotInvites`. */
  inviteCode: string
  /** Free-text, admin-only: where you found them, what you promised. */
  note?: string
  reservedByUid: string
  reservedAt: string
  /** Auto-releases the hour if unclaimed. Default: slot start. */
  expiresAt: string
}
```

`status` stays `open`, `assignedUid` stays `null`. Then:

- **`isSlotClaimable()`** (`src/lib/slotModel.ts`) returns false for an unexpired
  reservation — so nobody else takes a held hour. Mirror it in `claimSlot.ts`
  (which has its own copy of the rule), with the exception that **the reservation
  holder may claim it**: compare `user.twitch.twitchUserId` to
  `slot.reservation.twitchUserId`.
- **`slotIdentity()`** returns the guest's display name with `isOpen: false` and
  a new `isReserved: true`, so `/schedule`, `/watch` and the OBS ticker all show
  "SomeStreamer · Reserved" from one rule. Check every `slotIdentity` consumer
  handles the new flag — `grep -rn "slotIdentity" src netlify`.
- **Expiry** is enforced on read (like everything else here), not by a sweeper.

### 4.2 `netlify/functions/adminReserveSlot.ts` *(new, admin-only)*

```
POST { slotId, twitchLogin, note?, expiresAt? }
  → requireAdminUser
  → GET https://api.twitch.tv/helix/users?login={login}   (app access token)
      404 → 400 twitch_channel_not_found
  → reject if uniqueTwitchUsers/{id} exists AND that uid could just claim it
      (tell the admin to assign normally — they already have an account)
  → mint inviteCode: 8 chars, base32, unambiguous alphabet (no O/0/I/1)
  → create slotInvites/{inviteCode} { slotId, twitchUserId, expiresAt, used:false }
  → update slots/{slotId}.reservation
  → return { inviteUrl: `${origin}/go/${inviteCode}`, displayName, profileImageUrl }
```

Validating against Helix is not optional politeness — it is what lets the
schedule show a real avatar and display name the instant the booking is made.
A schedule grid with faces in it is, per
[product-process.md](product-process.md) §5, the single best recruiting asset
the project has.

`twitchOAuthCallback.ts` already fetches an app token implicitly via the user
token; you will need a **client-credentials app token** here. Put it in
`_shared/twitch.ts` with the existing `memo()` TTL cache from `_shared/cache.ts`
— the token lives ~60 days and must not be re-fetched per request.

Also add `adminReleaseReservation.ts`, or extend the existing
`adminReleaseSlot.ts`. An admin who mis-types a handle needs one click back.

### 4.3 `/go/:code` — the whole reason this converts

**This is the most important screen in the plan. Build it before the email.**

A public route (`src/pages/SlotInvite.tsx`, lazy, added to `src/App.tsx`) that
renders, for a signed-out stranger:

> **You're booked on CSGN.**
> Thursday 21 Aug · 9:00–10:00 PM ET
> *(avatar)* @theirhandle
>
> Stream to your own Twitch channel at that hour. 30% of the trading fees your
> hour generates go to you.
>
> **[ Continue with Twitch ]**
>
> No email, no password. Takes about ten seconds.

One button. Behind it: `useTwitchLink` → OAuth → then a **single** server call
that does everything at once.

### 4.4 `netlify/functions/redeemSlotInvite.ts` *(new)*

```
POST { inviteCode, twitchProofToken }
  → load slotInvites/{code}; reject used / expired / unknown
  → verify the proof's twitchUserId MATCHES the invite's   ← the security property
  → if uniqueTwitchUsers/{id} exists → this person has an account → mint a
      custom token for that uid
    else → create the account (same path as signupWithTwitch, username from
      their Twitch display name)
  → assign the slot to that uid (the normal claim write from claimSlot.ts),
      clearing `reservation`
  → mark the invite used
  → return { customToken, slot }
```

Do it in **one** endpoint, not three chained calls. A guest on a phone, on a
cold link, gets exactly one round trip between tapping Twitch and being a booked
streamer. Every intermediate state you expose is a place to drop out.

The invite code is a **bearer for a specific Twitch account, not for the slot** —
possession of the code alone does nothing, because redemption requires an OAuth
proof for the matching `twitchUserId`. So the link can be posted publicly
without risk, which matters, because admins will paste it into group chats.

### 4.5 The answer to "or automatically somehow else?" — auto-match

Even without the link: whenever a Twitch identity is established for an
account — `signupWithTwitch`, `loginWithTwitch`, `linkTwitch` — look up
reservations for that `twitchUserId` and convert them.

```ts
// A guest who was booked by handle and then happens to arrive through the front
// door should not have to find the invite email we may never have sent. The
// reservation is keyed to their Twitch id, and they just proved they own it.
const held = await queryCollection('slots',
  [fieldFilter('reservation.twitchUserId', 'EQUAL', twitchUserId)], [], 5)
```

Needs a Firestore index on `reservation.twitchUserId` — add it to
`firestore.indexes.json`. Convert unexpired, future reservations automatically
and drop an in-app notification: *"You're booked for Thursday 9pm ET."*

This is the cheapest reach channel in the plan and it has no delivery risk at
all, because it fires on an action the user already took.

### Phase 2 acceptance

- [ ] Admin reserves an hour for a handle with no CSGN account; `/schedule` shows the real display name and avatar with a Reserved chip.
- [ ] Another member cannot claim that hour.
- [ ] The reserved handle, cold and signed out, opens `/go/<code>` on a phone, taps once, and lands signed in and holding the slot.
- [ ] Redeeming with a *different* Twitch account is refused, and the reservation survives.
- [ ] A redeemed code cannot be redeemed twice.
- [ ] A guest who ignores the link and signs in with Twitch from the home page is auto-assigned the reservation.
- [ ] A reservation that reaches its expiry releases the hour back to open claiming.
- [ ] `/player` treats a reserved-but-unclaimed hour exactly like an unclaimed one — intermission, no dark screen. **Verify this on a live encoder, not just in tests.**

---

## 5. Phase 3 — The wallet, at payout

### 5.1 Nothing is dropped, ever

The moment claiming stops requiring a wallet, fees start accruing to accounts
that cannot receive them. The only acceptable behaviour is **hold and tell**.

- **Do not add a balance field.** `src/pages/Dashboard.tsx` already derives
  `payoutEstimateSOL` by summing `creatorFees.feeOwedSOL` across the member's
  slots. Keep deriving. A duplicated balance is a reconciliation bug with a
  delay fuse.
- Add `paidAt` / `payoutId` to `creatorFees` so a paid slot stops counting.

### 5.2 The ask, where the number is

Three surfaces, one sentence, and the sentence always contains a real figure —
never "add a wallet to get paid" in the abstract:

1. **Immediately after a slot completes** — in-app notification: *"Your hour
   earned 0.42 SOL. Add a wallet and it goes out with the next payout run."*
2. **`/account`** — a `Notice tone="warning"` above the fee history whenever
   owed > 0 and no wallet. The `Connection` row for Wallet already shows "Not
   connected"; this makes it consequential.
3. **`/schedule`, at claim time** — nothing. Do not warn a streamer about payout
   plumbing while they are trying to book an hour. **Resist this.** It is the
   obvious place to put it and it re-creates the friction this whole project
   removes.

Attaching the wallet is the existing flow: `createPhantomChallenge` →
`verifyPhantomSignature` → a new `linkPhantom.ts` (mirror `linkTwitch.ts`:
`requireUser`, verify the proof, create-only write to
`uniquePhantomWallets/{address}`, update `users/{uid}.phantom`). **Run the
`isEstablishedWallet` check here** — the sybil gate that left the front door
belongs at the money door, where it protects something real.

### 5.3 Paying creator fees

**DECISION 2, and it blocks this phase.** `PayoutSource` already lists
`'creator_fee'`, but the entire ledger is $CSGN-denominated: `PayoutRequest`
carries `amountCsgn`, every cap in `payouts.ts` is in whole $CSGN, and
`payoutWallet.ts` signs SPL token transfers. Creator fees are **SOL**
(`creatorFees.feeOwedSOL`). So one of:

- **(a) Pay creator fees in $CSGN** at a published conversion. No new transfer
  code, reuses every cap and guarantee as-is, and it puts the token in
  streamers' hands. But it is not what the marketing says ("paid in SOL"), so
  the copy must change with it.
- **(b) Add native SOL transfers** to `payoutWallet.ts` and a parallel set of
  SOL-denominated caps. Honest to the pitch and to `docs/marketing-outreach.md`;
  a real extension of the highest-consequence code in the repository.
- **(c) Keep paying creator fees by hand** for now, and ship only the accrual,
  the ask and the hold. **Recommended for the first pass** — at current volume
  this is a handful of transfers a week, the amounts are small, and automating
  irreversible money movement is not the thing to rush next to a launch.

Whichever is chosen: a payout request for a wallet-less uid is **filed, not
dropped**. Give it `status: 'awaiting_wallet'` in the ledger, exclude it from
solvency, and retry it on the next run once a wallet appears. `payouts.ts`
already parks oversized payouts as `needs_review`; follow that pattern exactly
rather than inventing a second one.

### Phase 3 acceptance

- [ ] A Twitch-only member completes a slot with fees owed and sees the real figure on `/account` and in their notifications.
- [ ] Attaching a wallet clears the notice and the fees become payable.
- [ ] A wallet already on another account is refused without corrupting either.
- [ ] A payout run containing a wallet-less recipient completes, pays everyone else, and files that one for retry. **Prove this with a dry run first** — `adminRunPayouts` is dry-run by default and that default exists for a reason.
- [ ] The `isEstablishedWallet` gate runs at attach time.

---

## 6. Phase 4 — Reminders, in the right order

Ship these **in this order** and stop when the conversion is good enough. Each
step costs meaningfully more than the one before it.

### 6.1 In-app + the invite link *(free, already built)*

`addUserNotification` exists and `/account` renders it. The invite link from §4.3
is the primary channel: **the admin is already in a conversation with the person
they just booked** — X DM, Discord, Twitch chat, text — and the link drops into
that conversation. It carries full context, works on every platform, needs no
address, and has zero deliverability risk. Do not build email until this has
been used on real people and found wanting.

### 6.2 Email *(one dependency, real setup cost)*

**There is no transactional email in this project.** The only mail that exists is
Firebase Auth's built-in verification template, and it cannot send arbitrary
messages. Adding email means: a provider (**Resend** — cleanest API, sane free
tier), a `RESEND_API_KEY` Netlify secret, SPF/DKIM on `csgn.fun`, and a bounce
story. That is a half-day plus a domain-reputation tail, so it is fourth on the
list, not first.

When you do it:

- `_shared/email.ts` — one `sendEmail({ to, subject, html, text })`, one place
  that knows the provider, no HTML anywhere else.
- **Optional email on the reservation.** If the admin has the guest's address,
  `adminReserveSlot` takes it and sends the invite link. Never guess an address
  and never scrape one.
- Three templates, and only three: **invite** (you're booked, here's your link),
  **reminder** (T-24h and T-2h, unclaimed reservations and confirmed slots
  alike), **payout ready** (you earned X, add a wallet).
- Every send is a **create-only write** to `emailLog/{purpose}:{slotId}:{uid}`
  before the API call. That is the same idempotency shape as the payout ledger,
  and it is what stops a retried cron from mailing someone six times.
- Unsubscribe link on everything that is not the invite.

**Scheduling:** `netlify.toml` already runs `feePollerBackground` every minute,
and it already advances slot lifecycle (`confirmed → live → completed`). Fold
reminder scanning into it behind a *"has ten minutes passed"* guard rather than
adding a second scheduled function and a second billed container. If that file
gets unwieldy, split it — but measure before you add a container.

### 6.3 Twitch whispers *(genuinely automatic, genuinely more work)*

Twitch Helix has `POST /helix/whispers`. It needs a **user** access token for the
CSGN Twitch account with `user:manage:whispers`, and Twitch requires the sending
account to have a verified phone number. Limits are ~40 unique recipients/day —
comfortably above our volume for a long time.

The appeal is real: it reaches a streamer where they already are, with no email
address and no other platform. The cost is real too: a persisted, refreshable
user token (a new secret with a refresh path, unlike the app token in §4.2), and
whispers from an unknown account are easy to ignore or filter.

**Recommendation: do not build this until §6.1 has been run against at least ten
real bookings.** If the invite link converts — and it should, because a human
sent it inside a conversation the guest was already having — this is
infrastructure for a problem you don't have.

---

## 7. Sequencing, and what "done" means

| Phase | Ship independently? | Value if you stop here |
|---|---|---|
| 1 · Twitch sign-up + claim | Yes | Every streamer on earth can now join and book an hour. **The big one.** |
| 2 · Reservations + `/go/:code` | Yes, needs 1 | The schedule fills with real names, and booking someone takes one message |
| 3 · Wallet at payout | Yes, needs 1 | Nobody is owed money they cannot receive |
| 4 · Reminders | Yes, needs 2 | Fewer no-shows |

**Do not merge 1 and 2 into one pull request.** Phase 1 touches the auth and
claim gates that were just rebuilt; it deserves to land, be tested on a phone,
and sit for a day on its own.

### Cross-cutting rules for the implementing agent

1. **Mirror every claim rule.** `claimSlot.ts` and `claimEligibility()` in
   `src/lib/slotModel.ts` must never disagree. Both files say so already.
2. **Never trust a client-supplied identity.** Every Twitch fact comes from a
   verified `twitch_account` proof token, never from a request body. Every
   uniqueness lock is a create-only write, so the database refuses rather than
   the code remembering.
3. **Fail open on anti-spam, fail closed on money.** The Twitch-age check falls
   open and records why; the payout path does the opposite.
4. **Test the pure logic, not the plumbing.** Reservation eligibility, invite
   expiry, username sanitisation and reminder scheduling are all pure functions.
   The project is at 586 tests because that line has been held.
5. **Feature-flag Phase 1** behind `config/features.twitchSignup` (there is
   already a `config/*` pattern with `scheduleMeta` and `payoutLimits`), so the
   Twitch button can be pulled without a deploy if something goes wrong in front
   of an audience.
6. **Verify on a real phone in Phantom's in-app browser**, per the checklists in
   [env-setup.md](env-setup.md). Phase 1 makes the sign-up depend on the Twitch
   handoff, which means a handoff regression is now a total-signup outage rather
   than a degraded second step.

### The three decisions to resolve before coding

1. **DECISION 1** — do network (7pm–3am) slots keep any wallet requirement?
2. **DECISION 2** — creator fees in $CSGN, in SOL, or by hand for now?
   *(recommended: by hand; ship accrual + hold + ask first)*
3. **DECISION 3** — does the Twitch-age sybil gate default to 30 days, and does
   it fail open? *(recommended: yes and yes, mirroring `walletCheck`)*

---

## 8. What this does not solve

Worth saying plainly so nobody expects it.

- **It does not create demand.** A streamer who claims an hour and finds no
  audience does not claim a second one. That is programming, not product —
  [product-process.md](product-process.md) §5.
- **It weakens the sybil story.** Wallet + on-chain history is a stronger gate
  than a 30-day-old Twitch account. The mitigation is that the expensive thing
  (money) still sits behind the wallet check, and claim limits
  (`slotLimits.maxConcurrentClaims`, default 2) still apply per account.
- **It adds a second account type.** Every reader of `users/{uid}` must now cope
  with `phantom.verified === false`. Keeping the document shape identical across
  both sign-up paths is what keeps that from spreading — hold that line.
