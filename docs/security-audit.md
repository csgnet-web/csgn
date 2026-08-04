# Security, cost and correctness audit

Full pass over `firestore.rules`, all 28 Netlify functions, every client-side
Firestore write, the CSP, and the dependency tree. Dated August 2026, against
the v1.19 tree.

Findings are recorded with what was actually done about them — including the
two that were deliberately **not** acted on, because "we looked and decided" is
the useful record, not a clean list that hides the judgement calls.

---

## Fixed

### 1. The fee poller was anonymously invokable — HIGH

**`netlify/functions/feePollerBackground.ts`**

Netlify serves every function at `/.netlify/functions/<name>`, scheduled ones
included, so the cron schedule was not an access control. Anyone who knew the
path could invoke the single most expensive thing in the codebase:

- ~45 seconds of held container per call (four DexScreener polls at 15s
  intervals) — and Netlify bills wall clock, not CPU
- one Twitch Helix call
- schedule top-up, slot-lifecycle advance, vote settlement and meme-board
  refresh, all writing to Firestore

Being a **background** function made it worse rather than better: it returns to
the caller immediately and keeps running, so requests stack concurrently instead
of queueing. A loop with no concurrency limit could hold an unbounded number of
containers and burn the DexScreener and Twitch quotas at the same time.

**Fixed with two independent controls**, because one is infrastructure and the
other is code and they fail differently:

1. `netlify.toml` returns 404 for the public path with `force = true`. Public
   HTTP is served by the CDN; the scheduler invokes internally and never crosses
   it, so this closes the outside world without touching the cron.
2. A single-flight lock in the function (`config/feePollerRun`). A run that
   starts within 45s of the last one exits before doing any billable work.

The lock is deliberately **shorter than the 60s cron period and non-throwing**.
A guard able to reject the real scheduled run would be a self-inflicted outage
on the job that drives fee tracking, slot lifecycle and token stats — so it
skips, it never fails, and an unreadable lock runs anyway. `shouldRunPoll` is
pure and unit-tested on both halves of that contract (including future-dated
locks from clock skew, which must not be able to wedge the poller off).

> **Verify after deploy:** `curl -i https://csgn.fun/.netlify/functions/feePollerBackground`
> must return 404, **and** `public/tokenStats` must keep updating every minute.
> Check both — the first without the second means the redirect caught the cron.

### 2. Members could not dismiss their own notifications — MEDIUM (silent)

**`firestore.rules`**

`users/{userId}` allowed `update: if isAdmin()`, but `/account` lets a member
dismiss a notification and mark all read by writing `notifications` on their own
document. Every one of those writes was denied, and the client's `catch` wrote
it to `console.warn` — so for every non-admin member the buttons silently did
nothing, forever, with no error surfaced.

Fixed by scoping a self-update to exactly one field:

```
allow update: if isAdmin()
  || (isSignedIn() && request.auth.uid == userId
      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['notifications'])
      && request.resource.data.notifications.size() <= 50);
```

`hasOnly` rejects the entire write if any other key changes, so this cannot
become a privilege-escalation path — `role`, `status`, `phantom`, `twitch`,
`slotLimits` and `username` all stay server-only. The size cap is a cost guard:
the array lives on a document the member can rewrite, so without a ceiling it is
free storage that every subsequent profile read pays to transfer.

### 3. Two unauthenticated endpoints had no rate limit — MEDIUM

- **`resolveCurrentBroadcast`** — no auth and no limit, and every call costs a
  slots query plus a document write. Now 10/min per IP. Internal callers
  (`claimSlot`, the admin force-resolve) invoke `resolveBroadcast()` directly and
  never touch the limit.
- **`twitchOAuthCallback`** — the single-use OAuth state makes it self-limiting
  for real flows, but a bogus state still costs a Firestore read before it can be
  rejected. Now 20/min per IP: far above any human returning from Twitch, far
  below useful read amplification.

Every other function was already covered. Full matrix: 27 of 28 functions carry
`requireUser`/`requireAdminUser` or a rate limit or both; `health` is the
exception and returns a constant.

### 4. Dependency vulnerabilities — 2 CRITICAL, 4 HIGH

`npm audit fix` (lockfile only, no manifest changes) cleared:

| Package | Severity | Issue |
|---|---|---|
| `protobufjs` | critical | Arbitrary code execution; code injection via bytes field defaults |
| `websocket-driver` | critical | Resource limit bypass via message compression |
| `@grpc/grpc-js` | high | Malformed request/compressed message crashes |
| `ws` | high | Uninitialised memory disclosure; memory-exhaustion DoS |
| `react-router` | high | **Open redirect via protocol-relative (`//`) URL reinterpretation** |

The react-router open redirect is worth naming: it is the same bug class that
`src/lib/authReturn.ts` independently defends against, since that module hands a
stored path straight to `navigate()`. The library is patched *and* the path
validator rejects `//`, `/\`, backslashes and anything without a leading slash.
Defence in depth, not either/or.

Tests, typecheck, lint and build all pass on the updated tree.

---

## Reviewed and deliberately not changed

### 5. `react-router` RSC-mode CSRF advisory — NOT APPLICABLE

`react-router@7.18.2` falls inside `>=7.12.0 <8.3.0` for "RSC Mode CSRF Bypass
Allows Action Execution Before 400". The remedy is a major bump to 8.3.0.

**Not applicable here.** CSGN is a pure client-side SPA on `BrowserRouter` with
no React Server Components, no server actions and no router-handled mutations —
the entire mechanism the advisory describes does not exist in this build. A
major router upgrade is a large, risky change across every route and would be
churn taken on for a vulnerability that cannot be reached. Revisit if this ever
adopts a router-driven server runtime.

### 6. `bigint-buffer` buffer overflow — ACCEPTED, ISOLATED

`bigint-buffer <=1.1.5` (overflow in `toBigIntLE()`) arrives via
`@solana/spl-token` → `@solana/buffer-layout-utils`. There is no fixed release;
npm's suggested "fix" is `@solana/spl-token@0.1.8`, a four-minor downgrade that
would break the SPL token calls outright.

Accepted because reachability is narrow: the only importer is
`src/lib/spotlightPay.ts`, used on `/participate` alone, and the buffers it
decodes come from our own transaction construction and from Solana RPC
responses — not from arbitrary attacker-supplied input. That route is also
lazy-loaded, so the code is not even shipped to visitors who never open it.
Re-check when the Solana packages publish a patched dependency.

### 7. CSP allows `script-src 'unsafe-inline'` — ACCEPTED, DOCUMENTED

`netlify.toml`'s Content-Security-Policy includes `'unsafe-inline'` in
`script-src`, which weakens the header's value as an XSS mitigation.

It is there for the third-party embeds the product is built on: Twitch's
`embed.twitch.tv` player and X's `platform.twitter.com` widgets both inject
inline script. Removing it without moving to a nonce- or hash-based policy would
break the live player and the `/watch` broadcast embed — i.e. the product.
Tightening this properly means generating per-response nonces, which needs an
edge function; worth doing, but as its own change with its own testing, not as a
line edit during an audit.

---

## Cost model — what actually scales

The read-amplification work in v1.18 holds up. Slot data is one shared listener
per session (`LiveSlotContext`), bounded to a −3h/+8d window with an explicit
`limit` of 120; `firestore.rules` refuses any anonymous `slots` list without a
limit ≤150, so a single request can never bill the whole collection.
`publicProfiles` is TTL-cached with stampede protection. DexScreener is polled
server-side only and fanned out through one document.

**The term that grows with success** is live document fan-out. The fee poller
writes the active slot document and `public/tokenStats` once a minute, and every
connected browser subscribes to both — so Firestore reads scale as
`concurrent viewers × 2 per minute`:

| Concurrent viewers | Reads/day from fan-out | Approx. cost/day |
|---|---|---|
| 1,000 | ~2.9M | ~$1.70 |
| 10,000 | ~29M | ~$17 |
| 100,000 | ~288M | ~$170 |

Sound at the scale this is designed for, and the first thing to re-engineer if
concurrency ever reaches six figures — at which point the fix is the one the OBS
ticker already uses: serve the hot documents from a cached edge endpoint instead
of a per-client Firestore listener. Worth knowing *before* it is a surprise on
an invoice.

---

## Posture summary

| Area | State |
|---|---|
| Credential model | Ed25519 signature over a single-use, short-lived server nonce; one audited verification path; wallet→uid mapping written once at registration and only ever read afterwards |
| Registration abuse | Per-IP rate limit + on-chain activity requirement (`isEstablishedWallet`); uniqueness enforced by create-only index writes, so the database refuses duplicates rather than the code remembering to check |
| Privilege escalation | No client write can reach `role`, `status`, or any verification flag; every such field is server-only through firebase-admin |
| Private data | `toPublicProfile` is a hand-written allowlist and the only path out of the users collection — no email, no wallet, no role beyond a label |
| Secrets | No non-`VITE_` env var is referenced in client code; proof-signing secret has a 32-char minimum; Twitch access tokens never leave the function that mints them |
| Money paths | Payment verification fails loud rather than silent (`_shared/solana.ts`); payout wallet is derived and asserted against a configured address at startup |
